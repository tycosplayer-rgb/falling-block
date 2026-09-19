import { attachControls } from './game/input';
import {
  allLayouts,
  applyMove,
  canPlaceMorph,
  cellKey,
  clonePose,
  isSupported,
  isWin,
  levelForTiles,
  occupied,
  pickMorphRelocate,
  pickPlusRelocate,
  roll,
  softSet,
  supportSet,
  tilesEqual,
  timeMinusSet,
  timerDuration,
  timerStartSet,
} from './game/logic';
import { LEVELS } from './game/levels';
import {
  loadLastLevelIndex,
  loadMaxUnlocked,
  saveLastLevelIndex,
  unlockAfterClear,
} from './game/progress';
import { drawFrame, resetCamera, type AnimState } from './game/render';
import {
  playBounce,
  playFall,
  playMorph,
  playRoll,
  playVictory,
  playWin,
  unlockAudio,
} from './game/sfx';
import { solveFrom } from './game/solver';
import type { Dir, Level, Pose } from './game/types';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const levelLabel = document.getElementById('level-label') as HTMLButtonElement;
const movesLabel = document.getElementById('moves-label')!;
const timerLabel = document.getElementById('timer-label')!;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const levelSelect = document.getElementById('level-select')!;
const levelGrid = document.getElementById('level-grid')!;
const btnLevelsClose = document.getElementById('btn-levels-close') as HTMLButtonElement;
const overlay = document.getElementById('overlay')!;
const overlayMsg = document.getElementById('overlay-msg')!;
const btnOverlay = document.getElementById('btn-overlay') as HTMLButtonElement;

let levelIndex = 0;
let maxUnlocked = 0;
let level: Level = LEVELS[0];
let pose: Pose = clonePose(level.start);
let moves = 0;
let busy = false;
let anim: AnimState | null = null;
let animStarted = 0;
let animDuration = 0;
let pendingAfterAnim: (() => void) | null = null;

/** Timer: once per life; deadline via performance.now(). */
let timerStarted = false;
let timerDeadline: number | null = null;
let plusCell: string | null = null;
let timerFailed = false;

/** Live floor + morph pad (map-morph levels). */
let liveTiles: string[] = [];
let morphCell: string | null = null;
/** Brief flash after morph (ms timestamp end). */
let morphFlashUntil = 0;

/** Working level with liveTiles applied for physics / draw. */
function playLevel(): Level {
  return levelForTiles(level, liveTiles);
}

function resize() {
  const wrap = canvas.parentElement!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function remainingSeconds(now = performance.now()): number {
  if (!timerStarted || timerDeadline == null) return 0;
  return Math.max(0, (timerDeadline - now) / 1000);
}

function updateHud(now = performance.now()) {
  levelLabel.textContent = `关卡${levelIndex + 1}·${level.name}`;
  movesLabel.textContent = `步数${moves}`;
  if (timerStarted && timerDeadline != null && !timerFailed) {
    const sec = remainingSeconds(now);
    timerLabel.textContent = `限时 ${sec.toFixed(1)}`;
    timerLabel.classList.remove('hidden');
  } else {
    timerLabel.textContent = '';
    timerLabel.classList.add('hidden');
  }
}

/** Stop countdown immediately (e.g. on clear) and hide the badge. */
function stopTimer() {
  timerStarted = false;
  timerDeadline = null;
  timerLabel.textContent = '';
  timerLabel.classList.add('hidden');
}

function loadLevel(i: number) {
  levelIndex = Math.max(0, Math.min(LEVELS.length - 1, i));
  level = LEVELS[levelIndex];
  pose = clonePose(level.start);
  moves = 0;
  busy = false;
  anim = null;
  pendingAfterAnim = null;
  timerStarted = false;
  timerDeadline = null;
  timerFailed = false;
  plusCell = level.timePlus?.[0] ?? null;
  liveTiles = [...level.tiles];
  morphCell = level.mapMorph?.[0] ?? null;
  morphFlashUntil = 0;
  hideOverlay();
  updateHud();
  saveLastLevelIndex(levelIndex);
  resetCamera();
}

function showOverlay(message: string, buttonText: string, onClick: () => void) {
  overlayMsg.textContent = message;
  btnOverlay.textContent = buttonText;
  overlay.classList.remove('hidden');
  btnOverlay.onclick = () => {
    hideOverlay();
    onClick();
  };
}

function hideOverlay() {
  overlay.classList.add('hidden');
  btnOverlay.onclick = null;
}

function startAnim(
  kind: AnimState['kind'],
  from: Pose,
  to: Pose,
  dir: Dir,
  durationMs: number,
  after?: () => void,
) {
  busy = true;
  animStarted = performance.now();
  animDuration = durationMs;
  anim = {
    kind,
    t: 0,
    from: clonePose(from),
    to: clonePose(to),
    dir,
    fallDepth: 7,
  };
  pendingAfterAnim = after ?? null;

  if (kind === 'roll') playRoll(from.ori, to.ori);
  else if (kind === 'fall') playFall();
  else if (kind === 'win') {
    if (levelIndex >= LEVELS.length - 1) playVictory();
    else playWin();
  }
}

function poseTouches(pose: Pose, cells: Set<string>): boolean {
  return occupied(pose).some((c) => cells.has(cellKey(c.x, c.y)));
}

/** Timer then morph contacts after a settle (mid bounce or final). */
function processSettleContacts(p: Pose) {
  processTimerContacts(p);
  if (timerFailed) return;
  processMorphContact(p);
}

/**
 * After a move settles on `pose` (standing or lying), apply timer contacts once.
 * Order: start → minus → plus (plus relocates after +5).
 */
function processTimerContacts(p: Pose) {
  if (timerFailed) return;

  const lv = playLevel();
  const starts = timerStartSet(lv);
  if (!timerStarted && poseTouches(p, starts)) {
    timerStarted = true;
    timerDeadline = performance.now() + timerDuration(lv) * 1000;
  }

  if (!timerStarted || timerDeadline == null) {
    updateHud();
    return;
  }

  const minus = timeMinusSet(lv);
  if (poseTouches(p, minus)) {
    timerDeadline = Math.max(performance.now(), timerDeadline - 5000);
  }

  if (plusCell && poseTouches(p, new Set([plusCell]))) {
    timerDeadline = timerDeadline + 5000;
    const occ = new Set(occupied(p).map((c) => cellKey(c.x, c.y)));
    const extra = morphCell ? [morphCell] : [];
    const next = pickPlusRelocate(lv, plusCell, occ, extra);
    plusCell = next;
  }

  updateHud();
  if (remainingSeconds() <= 0) {
    failTimer();
  }
}

/**
 * Map-morph: on contact, pick a random other layout still solvable from
 * current pose, apply it, then relocate the morph pad (prefer far).
 */
function processMorphContact(p: Pose) {
  if (!morphCell || !poseTouches(p, new Set([morphCell]))) return;

  const layouts = allLayouts(level);
  const candidates: string[][] = [];
  for (const L of layouts) {
    if (tilesEqual(L, liveTiles)) continue;
    const temp = levelForTiles(level, L);
    if (!temp.tiles.includes(level.target) && !new Set(temp.tiles).has(level.target)) {
      continue;
    }
    const support = supportSet(temp);
    const soft = softSet(temp);
    if (!isSupported(p, support, soft)) continue;
    if (!canPlaceMorph(temp, plusCell ? [plusCell] : [])) continue;
    const solved = solveFrom(temp, p);
    if (!solved.solvable) continue;
    candidates.push(L);
  }

  if (candidates.length > 0) {
    const chosen = candidates[Math.floor(Math.random() * candidates.length)]!;
    liveTiles = [...chosen];
    morphFlashUntil = performance.now() + 280;
    playMorph();
  }

  // Always try to relocate morph after trigger (even if map unchanged).
  const lv = playLevel();
  // Drop plus if it vanished with the layout
  if (plusCell && !new Set(liveTiles).has(plusCell)) {
    plusCell = null;
  }
  const occ = new Set(occupied(p).map((c) => cellKey(c.x, c.y)));
  const extra = plusCell ? [plusCell] : [];
  const next = pickMorphRelocate(lv, morphCell, occ, extra);
  morphCell = next;
}

function failTimer() {
  if (timerFailed) return;
  // Do not interrupt a win celebration / overlay
  if (isWin(pose, level.target)) return;
  if (anim && anim.kind === 'win') return;
  if (!overlay.classList.contains('hidden')) return;
  timerFailed = true;
  busy = true;
  anim = null;
  pendingAfterAnim = null;
  updateHud();
  showOverlay('时间到！', '重新开始', () => loadLevel(levelIndex));
}

function tryMove(dir: Dir) {
  if (busy || timerFailed || !overlay.classList.contains('hidden') || isLevelSelectOpen()) return;

  const lv = playLevel();
  const result = applyMove(lv, pose, dir);
  const mid = roll(pose, dir); // landing pose before bounce (for animation)
  const support = supportSet(lv);
  const soft = softSet(lv);
  const midSupported = isSupported(mid, support, soft);
  const bounceDir = result.bounceDir;

  if (!result.ok) {
    startAnim('roll', pose, mid, dir, 190, () => {
      if (midSupported && result.bounced && bounceDir) {
        // Mid-landing counts for timer (even if rebound fails)
        processSettleContacts(mid);
        if (timerFailed) return;
        // Landed on bounce then rebound into void / soft collapse
        playBounce();
        startAnim('roll', mid, result.pose, bounceDir, 160, () => {
          startAnim('fall', result.pose, result.pose, bounceDir, 460, () => {
            showOverlay('弹回去之后掉下去了！', '重新开始', () => loadLevel(levelIndex));
          });
        });
      } else {
        // Failed landing still contacts cells occupied by mid
        processSettleContacts(mid);
        if (timerFailed) return;
        const softCollapse =
          mid.ori === 'standing' && soft.has(cellKey(mid.x, mid.y));
        startAnim('fall', mid, mid, dir, 460, () => {
          showOverlay(
            softCollapse ? '薄冰塌了！不能直立踩上去' : '掉下去了！方块落入虚空',
            '重新开始',
            () => loadLevel(levelIndex),
          );
        });
      }
    });
    return;
  }

  const landed = result.pose;
  const didBounce = result.bounced;

  startAnim('roll', pose, mid, dir, 210, () => {
    if (didBounce && bounceDir) {
      processSettleContacts(mid);
      if (timerFailed) return;
      playBounce();
      startAnim('roll', mid, landed, bounceDir, 180, () => {
        pose = landed;
        moves += 1;
        processSettleContacts(landed);
        if (timerFailed) return;
        updateHud();
        finishAfterLand(dir);
      });
    } else {
      pose = landed;
      moves += 1;
      processSettleContacts(landed);
      if (timerFailed) return;
      updateHud();
      finishAfterLand(dir);
    }
  });
}

function finishAfterLand(dir: Dir) {
  if (isWin(pose, level.target)) {
    stopTimer();
    updateHud();
    startAnim('win', pose, pose, dir, 520, () => {
      maxUnlocked = unlockAfterClear(levelIndex, LEVELS.length);
      if (levelIndex >= LEVELS.length - 1) {
        showOverlay(
          `通关！全部 ${LEVELS.length} 关完成\n本关步数 ${moves}`,
          '再玩一次',
          () => loadLevel(0),
        );
      } else {
        showOverlay(`过关！「${level.name}」· ${moves} 步`, '下一关', () =>
          loadLevel(levelIndex + 1),
        );
      }
    });
  } else {
    busy = false;
    anim = null;
  }
}


function isLevelSelectOpen() {
  return !levelSelect.classList.contains('hidden');
}

function closeLevelSelect() {
  levelSelect.classList.add('hidden');
}

function openLevelSelect() {
  hideOverlay();
  renderLevelGrid();
  levelSelect.classList.remove('hidden');
}

function renderLevelGrid() {
  maxUnlocked = loadMaxUnlocked(LEVELS.length);
  levelGrid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'level-pick' + (i === levelIndex ? ' current' : '');
    btn.disabled = i > maxUnlocked;
    btn.innerHTML = `<span class="lvl-num">${i + 1}</span><span class="lvl-name">${
      i > maxUnlocked ? '未解锁' : lv.name
    }</span>`;
    btn.addEventListener('click', () => {
      if (i > maxUnlocked) return;
      closeLevelSelect();
      loadLevel(i);
    });
    levelGrid.appendChild(btn);
  });
}


function tick(now: number) {
  if (anim) {
    const t = Math.min(1, (now - animStarted) / animDuration);
    anim.t = t;
    if (t >= 1) {
      const after = pendingAfterAnim;
      pendingAfterAnim = null;
      if (anim.kind === 'roll' && after) {
        anim = null;
        after();
      } else if (anim.kind === 'fall') {
        anim = null;
        after?.();
      } else if (anim.kind === 'win') {
        anim = null;
        busy = false;
        after?.();
      } else {
        anim = null;
        busy = false;
        after?.();
      }
    }
  }

  // Countdown tick: HUD + expiry (like a fall). Skip once cleared.
  if (
    timerStarted &&
    !timerFailed &&
    timerDeadline != null &&
    !isWin(pose, level.target) &&
    !(anim && anim.kind === 'win')
  ) {
    updateHud(now);
    if (remainingSeconds(now) <= 0) {
      failTimer();
    }
  }

  const wrap = canvas.parentElement!;
  drawFrame(ctx, playLevel(), pose, anim, wrap.clientWidth, wrap.clientHeight, {
    plusCell,
    morphCell,
    timerActive: timerStarted && !timerFailed,
    morphFlash: performance.now() < morphFlashUntil,
  });
  requestAnimationFrame(tick);
}

window.addEventListener(
  'keydown',
  (e) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')
    ) {
      e.preventDefault();
    }
  },
  { passive: false },
);


levelLabel.addEventListener('click', () => {
  void unlockAudio();
  openLevelSelect();
});
btnLevelsClose.addEventListener('click', () => {
  closeLevelSelect();
});
levelSelect.addEventListener('click', (e) => {
  if (e.target === levelSelect) closeLevelSelect();
});

btnRestart.addEventListener('click', () => {
  void unlockAudio();
  loadLevel(levelIndex);
});

document.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((btn) => {
  btn.addEventListener('click', () => {
    void unlockAudio();
    const dir = btn.dataset.dir as Dir;
    tryMove(dir);
  });
});

// Unlock audio on gestures without gating gameplay on the promise.
const unlockOnGesture = () => {
  void unlockAudio();
};
window.addEventListener('pointerdown', unlockOnGesture, { capture: true });
window.addEventListener('touchstart', unlockOnGesture, { capture: true, passive: true });
window.addEventListener('keydown', unlockOnGesture, { capture: true });

attachControls(canvas, (dir) => {
  void unlockAudio();
  tryMove(dir);
});
window.addEventListener('resize', resize);

maxUnlocked = loadMaxUnlocked(LEVELS.length);
loadLevel(loadLastLevelIndex(LEVELS.length));
// Visiting a level keeps it unlocked for select.
maxUnlocked = Math.max(maxUnlocked, levelIndex);
unlockAfterClear(Math.max(0, maxUnlocked - 1), LEVELS.length);
resize();
requestAnimationFrame(tick);

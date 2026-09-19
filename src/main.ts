import { attachControls } from './game/input';
import {
  applyMove,
  cellKey,
  clonePose,
  isSupported,
  isWin,
  occupied,
  pickPlusRelocate,
  roll,
  softSet,
  supportSet,
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
  playRoll,
  playVictory,
  playWin,
  unlockAudio,
} from './game/sfx';
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

/**
 * After a move settles on `pose` (standing or lying), apply timer contacts once.
 * Order: start → minus → plus (plus relocates after +5).
 */
function processTimerContacts(p: Pose) {
  if (timerFailed) return;

  const starts = timerStartSet(level);
  if (!timerStarted && poseTouches(p, starts)) {
    timerStarted = true;
    timerDeadline = performance.now() + timerDuration(level) * 1000;
  }

  if (!timerStarted || timerDeadline == null) {
    updateHud();
    return;
  }

  const minus = timeMinusSet(level);
  if (poseTouches(p, minus)) {
    timerDeadline = Math.max(performance.now(), timerDeadline - 5000);
  }

  if (plusCell && poseTouches(p, new Set([plusCell]))) {
    timerDeadline = timerDeadline + 5000;
    const occ = new Set(occupied(p).map((c) => cellKey(c.x, c.y)));
    const next = pickPlusRelocate(level, plusCell, occ);
    plusCell = next;
  }

  updateHud();
  if (remainingSeconds() <= 0) {
    failTimer();
  }
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

  const result = applyMove(level, pose, dir);
  const mid = roll(pose, dir); // landing pose before bounce (for animation)
  const support = supportSet(level);
  const soft = softSet(level);
  const midSupported = isSupported(mid, support, soft);
  const bounceDir = result.bounceDir;

  if (!result.ok) {
    startAnim('roll', pose, mid, dir, 190, () => {
      if (midSupported && result.bounced && bounceDir) {
        // Mid-landing counts for timer (even if rebound fails)
        processTimerContacts(mid);
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
        processTimerContacts(mid);
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
      processTimerContacts(mid);
      if (timerFailed) return;
      playBounce();
      startAnim('roll', mid, landed, bounceDir, 180, () => {
        pose = landed;
        moves += 1;
        processTimerContacts(landed);
        if (timerFailed) return;
        updateHud();
        finishAfterLand(dir);
      });
    } else {
      pose = landed;
      moves += 1;
      processTimerContacts(landed);
      if (timerFailed) return;
      updateHud();
      finishAfterLand(dir);
    }
  });
}

function finishAfterLand(dir: Dir) {
  if (isWin(pose, level.target)) {
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

  // Countdown tick: HUD + expiry (like a fall)
  if (timerStarted && !timerFailed && timerDeadline != null) {
    updateHud(now);
    if (
      remainingSeconds(now) <= 0 &&
      !isWin(pose, level.target) &&
      !(anim && anim.kind === 'win')
    ) {
      failTimer();
    }
  }

  const wrap = canvas.parentElement!;
  drawFrame(ctx, level, pose, anim, wrap.clientWidth, wrap.clientHeight, {
    plusCell,
    timerActive: timerStarted && !timerFailed,
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

import { attachControls } from './game/input';
import { clonePose, isSupported, isWin, roll, tileSet } from './game/logic';
import { LEVELS } from './game/levels';
import { drawFrame, type AnimState } from './game/render';
import type { Dir, Level, Pose } from './game/types';
import { SCREEN_DIR_DELTA, screenDeltaToWorldDir } from './game/view';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const levelLabel = document.getElementById('level-label')!;
const movesLabel = document.getElementById('moves-label')!;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const overlay = document.getElementById('overlay')!;
const overlayMsg = document.getElementById('overlay-msg')!;
const btnOverlay = document.getElementById('btn-overlay') as HTMLButtonElement;

let levelIndex = 0;
let level: Level = LEVELS[0];
let pose: Pose = clonePose(level.start);
let moves = 0;
let tiles = tileSet(level);
let busy = false;
let anim: AnimState | null = null;
let animStarted = 0;
let animDuration = 0;
let pendingAfterAnim: (() => void) | null = null;

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

function updateHud() {
  levelLabel.textContent = `关卡 ${levelIndex + 1} · ${level.name}`;
  movesLabel.textContent = `步数 ${moves}`;
}

function loadLevel(i: number) {
  levelIndex = Math.max(0, Math.min(LEVELS.length - 1, i));
  level = LEVELS[levelIndex];
  pose = clonePose(level.start);
  tiles = tileSet(level);
  moves = 0;
  busy = false;
  anim = null;
  pendingAfterAnim = null;
  hideOverlay();
  updateHud();
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
}

function tryMove(dir: Dir) {
  if (busy || !overlay.classList.contains('hidden')) return;

  const next = roll(pose, dir);
  const supported = isSupported(next, tiles);

  if (!supported) {
    startAnim('roll', pose, next, dir, 190, () => {
      startAnim('fall', next, next, dir, 460, () => {
        showOverlay('掉下去了！方块落入虚空', '重新开始', () => loadLevel(levelIndex));
      });
    });
    return;
  }

  startAnim('roll', pose, next, dir, 210, () => {
    pose = next;
    moves += 1;
    updateHud();

    if (isWin(pose, level.target)) {
      startAnim('win', pose, pose, dir, 520, () => {
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

  const wrap = canvas.parentElement!;
  drawFrame(ctx, level, pose, anim, wrap.clientWidth, wrap.clientHeight);
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

btnRestart.addEventListener('click', () => {
  loadLevel(levelIndex);
});

document.querySelectorAll<HTMLButtonElement>('[data-screen-dir]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const screen = btn.dataset.screenDir as keyof typeof SCREEN_DIR_DELTA;
    const delta = SCREEN_DIR_DELTA[screen];
    if (!delta) return;
    tryMove(screenDeltaToWorldDir(delta.dx, delta.dy));
  });
});

attachControls(canvas, tryMove);
window.addEventListener('resize', resize);

loadLevel(0);
resize();
requestAnimationFrame(tick);

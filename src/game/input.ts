import type { Dir } from './types';
import { SCREEN_DIR_DELTA, screenDeltaToWorldDir } from './view';

const SWIPE_THRESHOLD = 36; // px — ignore small jitters
const KEY_COOLDOWN_MS = 140;

export type MoveHandler = (dir: Dir) => void;

/**
 * Touch/mouse swipe + keyboard (arrows / WASD).
 * Screen deltas are converted through the same isometric inverse as the map,
 * so "up on screen" matches visual map up, not raw world +N.
 * Page scroll/zoom are disabled; swipes only move the block.
 */
export function attachControls(
  target: HTMLElement,
  onMove: MoveHandler,
): () => void {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let lastKeyAt = 0;
  let lastTouchEnd = 0;

  const begin = (x: number, y: number) => {
    tracking = true;
    startX = x;
    startY = y;
  };

  const end = (x: number, y: number) => {
    if (!tracking) return;
    tracking = false;
    const dx = x - startX;
    const dy = y - startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < SWIPE_THRESHOLD) return;
    onMove(screenDeltaToWorldDir(dx, dy));
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = e.target as HTMLElement;
    if (el.closest('button')) return;
    target.setPointerCapture?.(e.pointerId);
    begin(e.clientX, e.clientY);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!tracking) return;
    end(e.clientX, e.clientY);
  };

  const onPointerCancel = () => {
    tracking = false;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const screenKey: Record<string, keyof typeof SCREEN_DIR_DELTA> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      W: 'up',
      s: 'down',
      S: 'down',
      a: 'left',
      A: 'left',
      d: 'right',
      D: 'right',
    };
    const screen = screenKey[e.key];
    if (!screen) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastKeyAt < KEY_COOLDOWN_MS) return;
    lastKeyAt = now;
    const { dx, dy } = SCREEN_DIR_DELTA[screen];
    onMove(screenDeltaToWorldDir(dx, dy));
  };

  const prevent = (e: Event) => e.preventDefault();

  const preventWheelZoom = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  };

  const preventTouchMove = (e: TouchEvent) => {
    e.preventDefault();
  };

  const preventDoubleTapZoom = (e: TouchEvent) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = now;
  };

  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('gesturestart', prevent, { passive: false });
  document.addEventListener('gesturechange', prevent, { passive: false });
  document.addEventListener('gestureend', prevent, { passive: false });
  document.addEventListener('wheel', preventWheelZoom, { passive: false });
  document.addEventListener('touchmove', preventTouchMove, { passive: false });
  document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });

  return () => {
    target.removeEventListener('pointerdown', onPointerDown);
    target.removeEventListener('pointerup', onPointerUp);
    target.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('gesturestart', prevent);
    document.removeEventListener('gesturechange', prevent);
    document.removeEventListener('gestureend', prevent);
    document.removeEventListener('wheel', preventWheelZoom);
    document.removeEventListener('touchmove', preventTouchMove);
    document.removeEventListener('touchend', preventDoubleTapZoom);
  };
}

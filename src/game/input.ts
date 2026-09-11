import type { Dir } from './types';
import { unlockAudio } from './sfx';
import { screenDeltaToWorldDir } from './view';

const SWIPE_THRESHOLD = 36;
const KEY_COOLDOWN_MS = 140;

export type MoveHandler = (dir: Dir) => void;

/**
 * Swipe + keyboard. Screen deltas are matched to projected world axes
 * (same isometric transform as the map). D-pad is wired separately in main.
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
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    onMove(screenDeltaToWorldDir(dx, dy));
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = e.target as HTMLElement;
    if (el.closest('button')) return;
    void unlockAudio(); // sync resume kick while gesture is live
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

  const keyScreenDelta: Record<string, { dx: number; dy: number }> = {
    ArrowUp: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
    w: { dx: 0, dy: -1 },
    W: { dx: 0, dy: -1 },
    s: { dx: 0, dy: 1 },
    S: { dx: 0, dy: 1 },
    a: { dx: -1, dy: 0 },
    A: { dx: -1, dy: 0 },
    d: { dx: 1, dy: 0 },
    D: { dx: 1, dy: 0 },
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = keyScreenDelta[e.key];
    if (!delta) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastKeyAt < KEY_COOLDOWN_MS) return;
    lastKeyAt = now;
    void unlockAudio();
    onMove(screenDeltaToWorldDir(delta.dx, delta.dy));
  };

  const prevent = (e: Event) => e.preventDefault();
  const preventWheelZoom = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  };
  const preventTouchMove = (e: TouchEvent) => e.preventDefault();
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

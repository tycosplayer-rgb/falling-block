/** Shared isometric view constants — keep input & render in sync. */
import type { Dir } from './types';

export const VIEW_SKEW_X = 0.9;
export const VIEW_SKEW_Y = 0.5;
export const VIEW_Z_SCALE = 0.72;

/**
 * Screen-space vectors of +1 step on each world axis, under the same
 * projection as the map: sx ~ (x - y)*skewX, sy ~ (x + y)*skewY.
 *
 *   +X (E) -> (+skewX, +skewY)  screen down-right
 *   -X (W) -> (-skewX, -skewY)  screen up-left
 *   +Y (S) -> (-skewX, +skewY)  screen down-left
 *   -Y (N) -> (+skewX, -skewY)  screen up-right
 */
export const WORLD_DIR_SCREEN: Record<Dir, { dx: number; dy: number }> = {
  E: { dx: VIEW_SKEW_X, dy: VIEW_SKEW_Y },
  W: { dx: -VIEW_SKEW_X, dy: -VIEW_SKEW_Y },
  S: { dx: -VIEW_SKEW_X, dy: VIEW_SKEW_Y },
  N: { dx: VIEW_SKEW_X, dy: -VIEW_SKEW_Y },
};

/**
 * Map a screen-space swipe / key delta to the nearest world roll Dir,
 * by matching against the projected world axes (same transform as the map).
 */
export function screenDeltaToWorldDir(dx: number, dy: number): Dir {
  let best: Dir = 'E';
  let bestDot = -Infinity;
  for (const dir of ['N', 'S', 'E', 'W'] as Dir[]) {
    const a = WORLD_DIR_SCREEN[dir];
    const dot = dx * a.dx + dy * a.dy;
    if (dot > bestDot) {
      bestDot = dot;
      best = dir;
    }
  }
  return best;
}

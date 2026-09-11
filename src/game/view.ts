/** Shared view constants — dimetric projection (not pure isometric).
 *
 * Pure (x-y)/(x+y) isometric makes opposite corners of a unit square share
 * the same screen-x, so a standing block's front-left and back-right vertical
 * edges coincide. Unequal axis scales keep those edges apart.
 */
import type { Dir } from './types';

/** Screen Δ for +1 world X */
export const AXIS_X = { sx: 0.92, sy: 0.36 };
/** Screen Δ for +1 world Y */
export const AXIS_Y = { sx: -0.58, sy: 0.50 };
export const VIEW_Z_SCALE = 0.78;

/** @deprecated aliases kept for any leftover imports */
export const VIEW_SKEW_X = AXIS_X.sx;
export const VIEW_SKEW_Y = AXIS_X.sy;

/**
 * Screen-space vectors of +1 step on each world axis (same as project()).
 *   E = +X, W = -X, S = +Y, N = -Y
 */
export const WORLD_DIR_SCREEN: Record<Dir, { dx: number; dy: number }> = {
  E: { dx: AXIS_X.sx, dy: AXIS_X.sy },
  W: { dx: -AXIS_X.sx, dy: -AXIS_X.sy },
  S: { dx: AXIS_Y.sx, dy: AXIS_Y.sy },
  N: { dx: -AXIS_Y.sx, dy: -AXIS_Y.sy },
};

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

/** Pixel offsets for D-pad buttons along projected axes (radius ~52). */
export function dpadOffset(dir: Dir, radius = 52): { x: number; y: number } {
  const v = WORLD_DIR_SCREEN[dir];
  const len = Math.hypot(v.dx, v.dy) || 1;
  return { x: (v.dx / len) * radius, y: (v.dy / len) * radius };
}

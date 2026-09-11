/** Shared isometric view constants — keep input & render in sync. */
export const VIEW_SKEW_X = 0.9;
export const VIEW_SKEW_Y = 0.5;
export const VIEW_Z_SCALE = 0.72;

/**
 * Map a screen-space direction (e.g. swipe / arrow) into a world roll Dir,
 * using the inverse of the same isometric projection as the map.
 *
 * Screen: sx ∝ (x - y)*skewX,  sy ∝ (x + y)*skewY
 * Inverse: x ∝ u+v,  y ∝ v-u  where u=sx/skewX, v=sy/skewY
 */
export function screenDeltaToWorldDir(
  dx: number,
  dy: number,
): 'N' | 'S' | 'E' | 'W' {
  const u = dx / VIEW_SKEW_X;
  const v = dy / VIEW_SKEW_Y;
  const worldDx = (u + v) / 2;
  const worldDy = (v - u) / 2;
  if (Math.abs(worldDx) >= Math.abs(worldDy)) {
    return worldDx >= 0 ? 'E' : 'W';
  }
  return worldDy >= 0 ? 'S' : 'N';
}

/** Unit screen vectors for D-pad / arrow keys (screen up/down/left/right). */
export const SCREEN_DIR_DELTA: Record<
  'up' | 'down' | 'left' | 'right',
  { dx: number; dy: number }
> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

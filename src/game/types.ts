/** Cardinal directions for a 90° roll. */
export type Dir = 'N' | 'S' | 'E' | 'W';

/** Block orientation on the map. */
export type Orientation = 'standing' | 'horizontal' | 'vertical';

/**
 * Block pose.
 * - standing: occupies (x, y)
 * - horizontal (E–W): occupies (x, y) and (x+1, y)  — x is the west cell
 * - vertical (N–S): occupies (x, y) and (x, y+1)    — y is the north cell
 */
export interface Pose {
  x: number;
  y: number;
  ori: Orientation;
}

export interface Level {
  /** Display name (Chinese). */
  name: string;
  /** Solid floor tiles as "x,y" keys (includes soft / bounce cells). */
  tiles: string[];
  /**
   * Soft tiles: only support the block when lying flat.
   * Standing on any soft cell collapses → fall.
   * Must also appear in `tiles`.
   */
  soft?: string[];
  /**
   * Bounce tiles: if the block lands lying and occupies any bounce cell,
   * it immediately rolls once in the opposite direction (one bounce per input).
   * Must also appear in `tiles`.
   */
  bounce?: string[];
  /** Target hole / goal tile. Must be standing upright on this cell to win. */
  target: string;
  /** Starting pose. */
  start: Pose;
}

export type Cell = { x: number; y: number };

/** Outcome of one player input after special-tile resolution. */
export type MoveResult =
  | { ok: true; pose: Pose; bounced: boolean }
  | { ok: false; pose: Pose; reason: 'fall' };

import type { Cell, Dir, Level, MoveResult, Orientation, Pose } from './types';

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCell(key: string): Cell {
  const [xs, ys] = key.split(',');
  return { x: Number(xs), y: Number(ys) };
}

export function poseKey(p: Pose): string {
  return `${p.x},${p.y},${p.ori}`;
}

/** Cells currently occupied by the block. */
export function occupied(pose: Pose): Cell[] {
  const { x, y, ori } = pose;
  if (ori === 'standing') return [{ x, y }];
  if (ori === 'horizontal') return [{ x, y }, { x: x + 1, y }];
  return [{ x, y }, { x, y: y + 1 }];
}

/** Roll the block 90° in the given direction (does not check support). */
export function roll(pose: Pose, dir: Dir): Pose {
  const { x, y, ori } = pose;

  if (ori === 'standing') {
    switch (dir) {
      case 'N':
        return { x, y: y - 2, ori: 'vertical' };
      case 'S':
        return { x, y: y + 1, ori: 'vertical' };
      case 'W':
        return { x: x - 2, y, ori: 'horizontal' };
      case 'E':
        return { x: x + 1, y, ori: 'horizontal' };
    }
  }

  if (ori === 'horizontal') {
    switch (dir) {
      case 'N':
        return { x, y: y - 1, ori: 'horizontal' };
      case 'S':
        return { x, y: y + 1, ori: 'horizontal' };
      case 'W':
        return { x: x - 1, y, ori: 'standing' };
      case 'E':
        return { x: x + 2, y, ori: 'standing' };
    }
  }

  // vertical
  switch (dir) {
    case 'N':
      return { x, y: y - 1, ori: 'standing' };
    case 'S':
      return { x, y: y + 2, ori: 'standing' };
    case 'W':
      return { x: x - 1, y, ori: 'vertical' };
    case 'E':
      return { x: x + 1, y, ori: 'vertical' };
  }
}

export function opposite(dir: Dir): Dir {
  switch (dir) {
    case 'N':
      return 'S';
    case 'S':
      return 'N';
    case 'E':
      return 'W';
    case 'W':
      return 'E';
  }
}

export function tileSet(level: Level): Set<string> {
  return new Set(level.tiles);
}

export function softSet(level: Level): Set<string> {
  return new Set(level.soft ?? []);
}

export function bounceSet(level: Level): Set<string> {
  return new Set(level.bounce ?? []);
}

export function bounceFixedMap(level: Level): Record<string, Dir> {
  return level.bounceFixed ?? {};
}

export function bounceRandomSet(level: Level): Set<string> {
  return new Set(level.bounceRandom ?? []);
}

export function trapSet(level: Level): Set<string> {
  return new Set(level.trap ?? []);
}

export function hiddenSupportSet(level: Level): Set<string> {
  return new Set(level.hiddenSupport ?? []);
}

export function timerStartSet(level: Level): Set<string> {
  return new Set(level.timerStart ?? []);
}

export function timeMinusSet(level: Level): Set<string> {
  return new Set(level.timeMinus ?? []);
}

export function timePlusSet(level: Level): Set<string> {
  return new Set(level.timePlus ?? []);
}

/** Default countdown seconds when Level.timerSeconds is omitted. */
export const DEFAULT_TIMER_SECONDS = 45;

export function timerDuration(level: Level): number {
  return level.timerSeconds ?? DEFAULT_TIMER_SECONDS;
}

/**
 * Cells that must not host a relocating +5 tile (specials + traps + current).
 * Target and occupied cells are filtered by the caller.
 */
export function plusRelocateBlocked(level: Level): Set<string> {
  const blocked = new Set<string>();
  for (const s of level.soft ?? []) blocked.add(s);
  for (const s of level.bounce ?? []) blocked.add(s);
  for (const s of Object.keys(level.bounceFixed ?? {})) blocked.add(s);
  for (const s of level.bounceRandom ?? []) blocked.add(s);
  for (const s of level.trap ?? []) blocked.add(s);
  for (const s of level.timerStart ?? []) blocked.add(s);
  for (const s of level.timeMinus ?? []) blocked.add(s);
  return blocked;
}

function chebyshev(a: string, b: string): number {
  const pa = parseCell(a);
  const pb = parseCell(b);
  return Math.max(Math.abs(pa.x - pb.x), Math.abs(pa.y - pb.y));
}

/**
 * Pick a new +5 cell: floor solid in tiles, not blocked specials, not occupied,
 * not current plus, not target. Prefer maximum Chebyshev distance from `from`.
 */
export function pickPlusRelocate(
  level: Level,
  from: string,
  occupiedKeys: Set<string>,
  extraBlocked: Iterable<string> = [],
): string | null {
  const support = supportSet(level);
  const blocked = plusRelocateBlocked(level);
  for (const s of extraBlocked) blocked.add(s);
  const candidates: string[] = [];
  for (const t of level.tiles) {
    if (t === from) continue;
    if (t === level.target) continue;
    if (blocked.has(t)) continue;
    if (!support.has(t)) continue;
    if (occupiedKeys.has(t)) continue;
    candidates.push(t);
  }
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  let bestDist = -1;
  for (const c of candidates) {
    const d = chebyshev(from, c);
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/** All authored layouts: tiles (layout 0) then mapLayouts. */
export function allLayouts(level: Level): string[][] {
  return [level.tiles, ...(level.mapLayouts ?? [])];
}

/** Set-equality of tile lists (order / dupes ignored). */
export function tilesEqual(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const t of sa) if (!sb.has(t)) return false;
  return true;
}

/**
 * Clone level with a new floor list; drop specials whose cells are gone.
 * hiddenSupport is kept (never listed in tiles).
 */
export function levelForTiles(base: Level, tiles: string[]): Level {
  const keys = new Set(tiles);
  const keep = (arr?: string[]) => {
    if (!arr) return undefined;
    const next = arr.filter((k) => keys.has(k));
    return next.length ? next : undefined;
  };
  const keepFixed = (rec?: Record<string, Dir>) => {
    if (!rec) return undefined;
    const out: Record<string, Dir> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (keys.has(k)) out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  };
  return {
    ...base,
    tiles: [...tiles],
    soft: keep(base.soft),
    bounce: keep(base.bounce),
    bounceFixed: keepFixed(base.bounceFixed),
    bounceRandom: keep(base.bounceRandom),
    trap: keep(base.trap),
    timerStart: keep(base.timerStart),
    timeMinus: keep(base.timeMinus),
    timePlus: keep(base.timePlus),
    mapMorph: keep(base.mapMorph),
  };
}

/**
 * Cells that must not host a relocating morph pad.
 * Target / occupied / current morph filtered by caller.
 */
export function morphRelocateBlocked(
  level: Level,
  extraBlocked: Iterable<string> = [],
): Set<string> {
  const blocked = new Set<string>();
  for (const s of level.soft ?? []) blocked.add(s);
  for (const s of level.bounce ?? []) blocked.add(s);
  for (const s of Object.keys(level.bounceFixed ?? {})) blocked.add(s);
  for (const s of level.bounceRandom ?? []) blocked.add(s);
  for (const s of level.trap ?? []) blocked.add(s);
  for (const s of level.timerStart ?? []) blocked.add(s);
  for (const s of level.timeMinus ?? []) blocked.add(s);
  for (const s of level.timePlus ?? []) blocked.add(s);
  for (const s of extraBlocked) blocked.add(s);
  return blocked;
}

/**
 * Pick a new morph cell: solid support floor, not specials, not occupied,
 * not current morph, not target. Prefer max Chebyshev distance from `from`.
 */
export function pickMorphRelocate(
  level: Level,
  from: string,
  occupiedKeys: Set<string>,
  extraBlocked: Iterable<string> = [],
): string | null {
  const support = supportSet(level);
  const blocked = morphRelocateBlocked(level, extraBlocked);
  const candidates: string[] = [];
  for (const t of level.tiles) {
    if (t === from) continue;
    if (t === level.target) continue;
    if (blocked.has(t)) continue;
    if (!support.has(t)) continue;
    if (occupiedKeys.has(t)) continue;
    candidates.push(t);
  }
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  let bestDist = -1;
  for (const c of candidates) {
    const d = chebyshev(from, c);
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/** True if morph pad can be placed somewhere on this level's tiles. */
export function canPlaceMorph(
  level: Level,
  extraBlocked: Iterable<string> = [],
): boolean {
  const support = supportSet(level);
  const blocked = morphRelocateBlocked(level, extraBlocked);
  for (const t of level.tiles) {
    if (t === level.target) continue;
    if (blocked.has(t)) continue;
    if (!support.has(t)) continue;
    return true;
  }
  return false;
}

/**
 * Cells that actually support the block:
 * (tiles − trap) ∪ hiddenSupport
 */
export function supportSet(level: Level): Set<string> {
  const support = new Set(level.tiles);
  for (const t of level.trap ?? []) support.delete(t);
  for (const h of level.hiddenSupport ?? []) support.add(h);
  return support;
}

/**
 * Soft tiles only support a lying block.
 * Standing on any soft cell → collapse (unsupported).
 * Support is checked against `support` (use supportSet), not raw tiles.
 */
export function isSupported(
  pose: Pose,
  support: Set<string>,
  soft: Set<string> = new Set(),
): boolean {
  const cells = occupied(pose);
  for (const c of cells) {
    const key = cellKey(c.x, c.y);
    if (!support.has(key)) return false;
    if (pose.ori === 'standing' && soft.has(key)) return false;
  }
  return true;
}

export function touchesBounce(pose: Pose, bounce: Set<string>): boolean {
  if (pose.ori === 'standing') return false;
  return occupied(pose).some((c) => bounce.has(cellKey(c.x, c.y)));
}

/**
 * Fixed bounce Dir for a lying pose: first occupied cell (in occupied() order)
 * that appears in bounceFixed. Standing → null.
 */
export function fixedBounceDir(
  pose: Pose,
  bounceFixed: Record<string, Dir>,
): Dir | null {
  if (pose.ori === 'standing') return null;
  for (const c of occupied(pose)) {
    const key = cellKey(c.x, c.y);
    if (Object.prototype.hasOwnProperty.call(bounceFixed, key)) {
      return bounceFixed[key];
    }
  }
  return null;
}

/**
 * Resolve which bounce direction(s) apply after landing on `mid`.
 * Priority: bounceFixed → bounceRandom → classic bounce.
 * Standing never bounces. Returns null if no bounce.
 */
export function bounceDirsForLanding(
  level: Level,
  mid: Pose,
  inputDir: Dir,
): Dir[] | null {
  if (mid.ori === 'standing') return null;

  const fixed = fixedBounceDir(mid, bounceFixedMap(level));
  if (fixed) return [fixed];

  if (touchesBounce(mid, bounceRandomSet(level))) {
    return [...DIRS];
  }

  if (touchesBounce(mid, bounceSet(level))) {
    return [opposite(inputDir)];
  }

  return null;
}

/**
 * All possible outcomes of one player input (random bounce expands to 4).
 * Used by the solver (existential) and by applyMove (picks one).
 */
export function applyMoveOutcomes(
  level: Level,
  pose: Pose,
  dir: Dir,
): MoveResult[] {
  const support = supportSet(level);
  const soft = softSet(level);

  const mid = roll(pose, dir);
  if (!isSupported(mid, support, soft)) {
    return [{ ok: false, pose: mid, reason: 'fall' }];
  }

  const bounceDirs = bounceDirsForLanding(level, mid, dir);
  if (!bounceDirs) {
    return [{ ok: true, pose: mid, bounced: false }];
  }

  return bounceDirs.map((bdir) => {
    const back = roll(mid, bdir);
    if (!isSupported(back, support, soft)) {
      return {
        ok: false as const,
        pose: back,
        reason: 'fall' as const,
        bounced: true,
        bounceDir: bdir,
      };
    }
    return {
      ok: true as const,
      pose: back,
      bounced: true,
      bounceDir: bdir,
    };
  });
}

/**
 * Apply one player roll, resolving soft collapse and a single bounce rebound.
 * Random bounce: picks one of the 4 dirs uniformly (gameplay).
 */
export function applyMove(level: Level, pose: Pose, dir: Dir): MoveResult {
  const outcomes = applyMoveOutcomes(level, pose, dir);
  if (outcomes.length === 1) return outcomes[0];
  return outcomes[Math.floor(Math.random() * outcomes.length)]!;
}

/** Win condition: upright exactly on the target tile. */
export function isWin(pose: Pose, target: string): boolean {
  return pose.ori === 'standing' && cellKey(pose.x, pose.y) === target;
}

export function boundsOf(level: Level): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const keys = [...level.tiles, ...(level.hiddenSupport ?? [])];
  for (const t of keys) {
    const { x, y } = parseCell(t);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

export const DIRS: Dir[] = ['N', 'S', 'E', 'W'];

export function clonePose(p: Pose): Pose {
  return { x: p.x, y: p.y, ori: p.ori };
}

export type { Orientation };

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

export function trapSet(level: Level): Set<string> {
  return new Set(level.trap ?? []);
}

export function hiddenSupportSet(level: Level): Set<string> {
  return new Set(level.hiddenSupport ?? []);
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
 * Apply one player roll, resolving soft collapse and a single bounce rebound.
 */
export function applyMove(level: Level, pose: Pose, dir: Dir): MoveResult {
  const support = supportSet(level);
  const soft = softSet(level);
  const bounce = bounceSet(level);

  let next = roll(pose, dir);
  if (!isSupported(next, support, soft)) {
    return { ok: false, pose: next, reason: 'fall' };
  }

  let bounced = false;
  if (touchesBounce(next, bounce)) {
    const back = roll(next, opposite(dir));
    bounced = true;
    if (!isSupported(back, support, soft)) {
      return { ok: false, pose: back, reason: 'fall' };
    }
    next = back;
  }

  return { ok: true, pose: next, bounced };
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

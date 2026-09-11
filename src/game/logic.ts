import type { Cell, Dir, Level, Orientation, Pose } from './types';

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

export function tileSet(level: Level): Set<string> {
  return new Set(level.tiles);
}

/** True if every occupied cell has solid floor support. */
export function isSupported(pose: Pose, tiles: Set<string>): boolean {
  return occupied(pose).every((c) => tiles.has(cellKey(c.x, c.y)));
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
  for (const t of level.tiles) {
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

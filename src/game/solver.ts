import {
  DIRS,
  applyMoveOutcomes,
  isSupported,
  isWin,
  poseKey,
  softSet,
  supportSet,
} from './logic';
import type { Dir, Level, Pose } from './types';

export interface SolveResult {
  solvable: boolean;
  moves: Dir[] | null;
  nodes: number;
}

/**
 * BFS shortest-path solver (soft / bounce / bounceFixed / bounceRandom /
 * trap / hiddenSupport).
 *
 * Random bounce: expands all 4 cardinal outcomes (existential — solvable if
 * some random results allow a win). Gameplay picks one dir at random.
 */
export function solveLevel(level: Level): SolveResult {
  const support = supportSet(level);
  const soft = softSet(level);
  const start = level.start;

  if (!isSupported(start, support, soft)) {
    return { solvable: false, moves: null, nodes: 0 };
  }
  if (isWin(start, level.target)) {
    return { solvable: true, moves: [], nodes: 1 };
  }

  const visited = new Set<string>([poseKey(start)]);
  type Node = { pose: Pose; path: Dir[] };
  const queue: Node[] = [{ pose: start, path: [] }];
  let nodes = 1;
  let qi = 0;

  while (qi < queue.length) {
    const cur = queue[qi++];
    for (const dir of DIRS) {
      const outcomes = applyMoveOutcomes(level, cur.pose, dir);
      for (const result of outcomes) {
        if (!result.ok) continue;
        const next = result.pose;
        const key = poseKey(next);
        if (visited.has(key)) continue;
        visited.add(key);
        nodes++;
        const path = cur.path.concat(dir);
        if (isWin(next, level.target)) {
          return { solvable: true, moves: path, nodes };
        }
        queue.push({ pose: next, path });
      }
    }
  }

  return { solvable: false, moves: null, nodes };
}

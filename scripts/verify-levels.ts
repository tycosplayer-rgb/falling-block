import { LEVELS } from '../src/game/levels.ts';
import {
  DIRS,
  applyMove,
  isSupported,
  isWin,
  roll,
  softSet,
  tileSet,
} from '../src/game/logic.ts';
import { tumblingCorners } from '../src/game/render.ts';
import { solveLevel } from '../src/game/solver.ts';
import type { Pose } from '../src/game/types.ts';

function aabbOf(pose: Pose) {
  if (pose.ori === 'standing') {
    return { min: [pose.x, pose.y, 0], max: [pose.x + 1, pose.y + 1, 2] };
  }
  if (pose.ori === 'horizontal') {
    return { min: [pose.x, pose.y, 0], max: [pose.x + 2, pose.y + 1, 1] };
  }
  return { min: [pose.x, pose.y, 0], max: [pose.x + 1, pose.y + 2, 1] };
}

function assertRollGeometry() {
  const poses: Pose[] = [
    { x: 5, y: 5, ori: 'standing' },
    { x: 5, y: 5, ori: 'horizontal' },
    { x: 5, y: 5, ori: 'vertical' },
  ];
  const eps = 1e-9;
  for (const pose of poses) {
    for (const dir of DIRS) {
      const next = roll(pose, dir);
      const corners = tumblingCorners(pose, dir, 1);
      const box = aabbOf(next);
      for (const c of corners) {
        if (
          c.x < box.min[0] - eps ||
          c.x > box.max[0] + eps ||
          c.y < box.min[1] - eps ||
          c.y > box.max[1] + eps ||
          c.z < box.min[2] - eps ||
          c.z > box.max[2] + eps
        ) {
          throw new Error(
            `roll geometry mismatch: ${pose.ori} ${dir} corner (${c.x},${c.y},${c.z}) vs AABB ${JSON.stringify(box)}`,
          );
        }
      }
    }
  }
  console.log('✓ Roll animation geometry matches physics at t=1\n');
}

assertRollGeometry();

let failed = 0;

console.log(`Verifying ${LEVELS.length} levels…\n`);

for (let i = 0; i < LEVELS.length; i++) {
  const level = LEVELS[i];
  const tiles = tileSet(level);
  const soft = softSet(level);

  for (const s of level.soft ?? []) {
    if (!tiles.has(s)) {
      console.error(`✗ Level ${i + 1}「${level.name}」: soft ${s} missing from tiles`);
      failed++;
    }
  }
  for (const b of level.bounce ?? []) {
    if (!tiles.has(b)) {
      console.error(`✗ Level ${i + 1}「${level.name}」: bounce ${b} missing from tiles`);
      failed++;
    }
  }

  if (!tiles.has(level.target)) {
    console.error(`✗ Level ${i + 1}「${level.name}」: target ${level.target} is not a solid tile`);
    failed++;
    continue;
  }

  if (!isSupported(level.start, tiles, soft)) {
    console.error(`✗ Level ${i + 1}「${level.name}」: start pose has no support`);
    failed++;
    continue;
  }

  const result = solveLevel(level);
  if (!result.solvable || !result.moves) {
    console.error(`✗ Level ${i + 1}「${level.name}」: UNSOLVABLE (explored ${result.nodes} nodes)`);
    failed++;
    continue;
  }

  let pose = { ...level.start };
  for (const dir of result.moves) {
    const step = applyMove(level, pose, dir);
    if (!step.ok) {
      console.error(`✗ Level ${i + 1}「${level.name}」: replay fell at move ${dir}`);
      failed++;
      pose = { x: -999, y: -999, ori: 'standing' };
      break;
    }
    pose = step.pose;
  }
  if (pose.x === -999) continue;

  if (!isWin(pose, level.target)) {
    console.error(`✗ Level ${i + 1}「${level.name}」: replay did not finish on target`);
    failed++;
    continue;
  }

  console.log(
    `✓ Level ${i + 1}「${level.name}」: ${result.moves.length} moves · ${result.nodes} nodes · ${result.moves.join('')}`,
  );
}

console.log('');
if (failed > 0) {
  console.error(`${failed} level(s) failed verification.`);
  process.exit(1);
}

console.log(`All ${LEVELS.length} levels are solvable.`);
process.exit(0);

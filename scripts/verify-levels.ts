import { LEVELS } from '../src/game/levels.ts';
import {
  DIRS,
  applyMoveOutcomes,
  bounceFixedMap,
  bounceRandomSet,
  bounceSet,
  isSupported,
  isWin,
  poseKey,
  roll,
  softSet,
  supportSet,
  tileSet,
  trapSet,
  hiddenSupportSet,
} from '../src/game/logic.ts';
import { tumblingCorners } from '../src/game/render.ts';
import { solveLevel } from '../src/game/solver.ts';
import type { Dir, Level, Pose } from '../src/game/types.ts';

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

/**
 * Replay a move sequence allowing existential random-bounce branches:
 * at each input, any successful outcome may continue (same as solver).
 */
function replayExists(level: Level, moves: Dir[]): boolean {
  let poses: Pose[] = [{ ...level.start }];
  for (const dir of moves) {
    const nextMap = new Map<string, Pose>();
    for (const p of poses) {
      for (const step of applyMoveOutcomes(level, p, dir)) {
        if (!step.ok) continue;
        nextMap.set(poseKey(step.pose), step.pose);
      }
    }
    if (nextMap.size === 0) return false;
    poses = [...nextMap.values()];
  }
  return poses.some((p) => isWin(p, level.target));
}

let failed = 0;

console.log(`Verifying ${LEVELS.length} levels…\n`);

for (let i = 0; i < LEVELS.length; i++) {
  const level = LEVELS[i];
  const tiles = tileSet(level);
  const soft = softSet(level);
  const bounce = bounceSet(level);
  const bounceFixed = bounceFixedMap(level);
  const bounceRandom = bounceRandomSet(level);
  const traps = trapSet(level);
  const hidden = hiddenSupportSet(level);
  const support = supportSet(level);

  const specialSets: { name: string; keys: string[] }[] = [
    { name: 'soft', keys: [...soft] },
    { name: 'bounce', keys: [...bounce] },
    { name: 'bounceFixed', keys: Object.keys(bounceFixed) },
    { name: 'bounceRandom', keys: [...bounceRandom] },
    { name: 'trap', keys: [...traps] },
  ];

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
  for (const b of Object.keys(bounceFixed)) {
    if (!tiles.has(b)) {
      console.error(`✗ Level ${i + 1}「${level.name}」: bounceFixed ${b} missing from tiles`);
      failed++;
    }
  }
  for (const b of level.bounceRandom ?? []) {
    if (!tiles.has(b)) {
      console.error(`✗ Level ${i + 1}「${level.name}」: bounceRandom ${b} missing from tiles`);
      failed++;
    }
  }

  // Mutual exclusion: soft / bounce / bounceFixed / bounceRandom / trap
  const owner = new Map<string, string>();
  for (const { name, keys } of specialSets) {
    for (const k of keys) {
      const prev = owner.get(k);
      if (prev) {
        console.error(
          `✗ Level ${i + 1}「${level.name}」: cell ${k} in both ${prev} and ${name}`,
        );
        failed++;
      } else {
        owner.set(k, name);
      }
    }
  }

  for (const t of level.trap ?? []) {
    if (!tiles.has(t)) {
      console.error(`✗ Level ${i + 1}「${level.name}」: trap ${t} missing from tiles`);
      failed++;
    }
  }

  for (const h of level.hiddenSupport ?? []) {
    if (tiles.has(h)) {
      console.error(`✗ Level ${i + 1}「${level.name}」: hiddenSupport ${h} must not appear in tiles`);
      failed++;
    }
  }

  if (!tiles.has(level.target)) {
    console.error(`✗ Level ${i + 1}「${level.name}」: target ${level.target} is not a solid tile`);
    failed++;
    continue;
  }

  if (traps.has(level.target)) {
    console.error(`✗ Level ${i + 1}「${level.name}」: target ${level.target} must not be a trap`);
    failed++;
    continue;
  }

  if (!isSupported(level.start, support, soft)) {
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

  if (!replayExists(level, result.moves)) {
    console.error(`✗ Level ${i + 1}「${level.name}」: existential replay did not finish on target`);
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

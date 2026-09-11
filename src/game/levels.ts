import type { Level } from './types';

/** Helper: filled rectangle of tiles inclusive. */
function rect(x0: number, y0: number, x1: number, y1: number): string[] {
  const out: string[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) out.push(`${x},${y}`);
  }
  return out;
}

function uniq(tiles: string[]): string[] {
  return [...new Set(tiles)];
}

/**
 * Levels for 落井下石 — every level verified by `npm run verify-levels`.
 * +x east, +y south. Win = standing upright on target.
 */
export const LEVELS: Level[] = [
  // 1 — 教学：直线
  {
    name: '起步',
    tiles: rect(0, 0, 3, 0),
    target: '3,0',
    start: { x: 0, y: 0, ori: 'standing' },
  },

  // 2 — 宽拐弯（2 格宽走廊可转身）
  {
    name: '拐弯',
    tiles: uniq([
      ...rect(0, 0, 4, 1),
      ...rect(3, 2, 4, 5),
      ...rect(5, 4, 7, 5),
    ]),
    target: '7,5',
    start: { x: 0, y: 0, ori: 'standing' },
  },

  // 3 — 中间缺口，需绕行
  {
    name: '小心缺口',
    tiles: uniq([
      ...rect(0, 0, 6, 0),
      ...rect(0, 1, 1, 3),
      ...rect(5, 1, 6, 3),
      ...rect(0, 3, 6, 4),
      // hole around (2,1)(3,1)(4,1)(2,2)(3,2)(4,2)
    ]),
    target: '6,4',
    start: { x: 0, y: 0, ori: 'standing' },
  },

  // 4 — 窄桥：两端平台 + 单格桥（必须以直立过桥）
  {
    name: '窄桥',
    tiles: uniq([
      ...rect(0, 0, 2, 2),
      '3,1',
      '4,1',
      '5,1',
      ...rect(6, 0, 8, 2),
    ]),
    target: '8,1',
    start: { x: 0, y: 1, ori: 'standing' },
  },

  // 5 — 不规则错落（目标取可直立到达格）
  {
    name: '错落台',
    tiles: uniq([
      ...rect(0, 0, 3, 1),
      ...rect(2, 2, 5, 3),
      ...rect(4, 4, 6, 5),
      '6,6',
      '7,6',
    ]),
    target: '6,6',
    start: { x: 0, y: 0, ori: 'standing' },
  },

  // 6 — 环湖：中间挖空
  {
    name: '环岛',
    tiles: uniq([
      ...rect(0, 0, 6, 0),
      ...rect(0, 1, 0, 4),
      ...rect(6, 1, 6, 4),
      ...rect(0, 5, 6, 5),
      ...rect(1, 1, 2, 2), // 内角小平台通向目标岛
      '2,3',
      '3,3',
      '4,3', // 目标在环内需绕
    ]),
    target: '2,2',
    start: { x: 0, y: 0, ori: 'standing' },
  },

  // 7 — 双桥：上下两条窄路
  {
    name: '双桥',
    tiles: uniq([
      ...rect(0, 1, 2, 3),
      '3,1',
      '4,1',
      '5,1',
      '3,3',
      '4,3',
      '5,3',
      ...rect(6, 1, 8, 3),
    ]),
    target: '8,2',
    start: { x: 0, y: 2, ori: 'standing' },
  },

  // 8 — 蛇形双宽走廊
  {
    name: '蛇形',
    tiles: uniq([
      ...rect(0, 0, 5, 1),
      ...rect(4, 2, 5, 4),
      ...rect(0, 3, 3, 4),
      ...rect(0, 5, 1, 7),
      ...rect(2, 6, 7, 7),
    ]),
    target: '7,7',
    start: { x: 0, y: 0, ori: 'standing' },
  },

  // 9 — 十字枢纽
  {
    name: '十字',
    tiles: uniq([
      ...rect(3, 0, 5, 1),
      ...rect(0, 2, 8, 4),
      ...rect(3, 5, 5, 7),
      ...rect(6, 6, 8, 7),
    ]),
    target: '8,7',
    start: { x: 0, y: 3, ori: 'standing' },
  },

  // 10 — 镂空高原（若干洞）
  {
    name: '镂空',
    tiles: uniq([
      ...rect(0, 0, 6, 4).filter((k) => {
        const holes = new Set(['2,1', '4,1', '3,2', '1,3', '5,3', '2,4']);
        return !holes.has(k);
      }),
      ...rect(5, 4, 7, 7),
      ...rect(2, 6, 4, 7),
    ]),
    target: '2,7',
    start: { x: 0, y: 0, ori: 'standing' },
  },

  // 11 — 长途折返
  {
    name: '长途',
    tiles: uniq([
      ...rect(0, 2, 3, 4),
      ...rect(3, 0, 5, 2),
      ...rect(5, 2, 7, 5),
      ...rect(7, 5, 10, 6),
      ...rect(9, 3, 10, 4),
      ...rect(11, 3, 12, 4),
    ]),
    target: '12,4',
    start: { x: 0, y: 3, ori: 'standing' },
  },

  // 12 — 终章迷宫
  {
    name: '终章',
    tiles: uniq([
      ...rect(0, 0, 2, 2),
      ...rect(2, 2, 4, 4),
      ...rect(4, 0, 6, 1),
      ...rect(5, 1, 6, 5),
      ...rect(6, 5, 9, 6),
      ...rect(8, 2, 9, 4),
      ...rect(9, 0, 11, 2),
      ...rect(10, 3, 11, 7),
      ...rect(7, 7, 9, 7),
    ]),
    target: '7,7',
    start: { x: 0, y: 0, ori: 'standing' },
  },
];

export function getLevel(index: number): Level {
  return LEVELS[index];
}

export function levelCount(): number {
  return LEVELS.length;
}

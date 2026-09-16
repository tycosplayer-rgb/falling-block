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

  // 13 — 软塌教学（与脆桥同结构、更短）：必须躺着压过两格薄冰
  {
    name: '薄冰',
    tiles: uniq([
      ...rect(0, 0, 2, 2),
      '3,1',
      '4,1',
      ...rect(5, 0, 7, 2),
    ]),
    soft: ['3,1', '4,1'],
    target: '7,1',
    start: { x: 0, y: 1, ori: 'standing' },
  },

  // 14 — 更长软桥：两格宽台方便转身，软桥仍只两格
  {
    name: '脆桥',
    tiles: uniq([
      ...rect(0, 0, 2, 2),
      '3,1',
      '4,1',
      ...rect(5, 0, 8, 2),
    ]),
    soft: ['3,1', '4,1'],
    target: '8,1',
    start: { x: 0, y: 1, ori: 'standing' },
  },

  // 15 — 弹回教学：直路有弹簧，躺着撞会弹回，需绕行
  {
    name: '弹簧',
    tiles: uniq([...rect(0, 0, 6, 1), '3,2', '3,3', ...rect(2, 4, 6, 5)]),
    bounce: ['3,0', '3,1'],
    target: '6,5',
    start: { x: 0, y: 0, ori: 'standing' },
  },

  // 16 — 弹回门：中间弹簧格须直立踩过（躺着会弹）
  {
    name: '回力',
    tiles: uniq([
      ...rect(0, 1, 3, 3),
      '4,2',
      ...rect(5, 1, 8, 3),
    ]),
    bounce: ['4,2'],
    target: '8,2',
    start: { x: 0, y: 2, ori: 'standing' },
  },

  // 17 — 软塌 + 弹回：先躺过薄冰，再直立过弹簧
  {
    name: '险途',
    tiles: uniq([
      ...rect(0, 0, 2, 2),
      '3,1',
      '4,1',
      ...rect(5, 0, 7, 2),
      '8,1',
      ...rect(9, 0, 11, 2),
    ]),
    soft: ['3,1', '4,1'],
    bounce: ['8,1'],
    target: '11,1',
    start: { x: 0, y: 1, ori: 'standing' },
  },

  // 18 — 综合：软桥、绕弹簧、抵达终点
  {
    name: '新章',
    tiles: uniq([
      ...rect(0, 2, 2, 4),
      '3,3',
      '4,3',
      ...rect(5, 2, 7, 4),
      '6,1',
      '6,0',
      '7,0',
      '8,0',
      ...rect(8, 1, 8, 3),
      ...rect(9, 2, 11, 4),
    ]),
    soft: ['3,3', '4,3'],
    bounce: ['6,1', '6,0'],
    target: '11,3',
    start: { x: 0, y: 3, ori: 'standing' },
  },

  // 19 — 多重薄冰走廊：需反复转身对齐站位
  {
    name: '碎冰河',
    tiles: uniq([
      ...rect(0, 0, 3, 2),
      '4,1', '5,1',
      ...rect(6, 0, 8, 2),
      '9,1', '10,1',
      ...rect(11, 0, 13, 2),
      '14,1', '15,1',
      ...rect(16, 0, 18, 2),
    ]),
    soft: ['4,1', '5,1', '9,1', '10,1', '14,1', '15,1'],
    target: '18,1',
    start: { x: 0, y: 1, ori: 'standing' },
  },

  // 20 — 上下环廊：捷径被弹簧封死，须绕行
  {
    name: '弹幕',
    tiles: uniq([
      ...rect(0, 2, 3, 4),
      ...rect(4, 0, 7, 1),
      ...rect(4, 5, 7, 6),
      '4,2', '5,2', '6,2', '7,2',
      '4,4', '5,4', '6,4', '7,4',
      '7,3',
      ...rect(8, 2, 11, 4),
      ...rect(12, 0, 15, 1),
      ...rect(12, 5, 15, 6),
      '12,2', '13,2', '14,2', '15,2',
      '12,4', '13,4', '14,4', '15,4',
      '15,3',
      ...rect(16, 2, 19, 4),
    ]),
    bounce: ['5,2', '6,2', '5,4', '6,4', '13,2', '14,2', '13,4', '14,4', '9,3', '10,3'],
    target: '19,3',
    start: { x: 0, y: 3, ori: 'standing' },
  },

  // 21 — 交替闸加长：两段薄冰 + 三道弹门
  {
    name: '交替闸',
    tiles: uniq([
      ...rect(0, 1, 2, 3),
      '3,2', '4,2',
      ...rect(5, 0, 7, 4),
      '8,2',
      ...rect(9, 1, 11, 3),
      '12,2', '13,2',
      ...rect(14, 0, 16, 4),
      '17,2',
      ...rect(18, 1, 20, 3),
      '21,2',
      ...rect(22, 0, 24, 4),
    ]),
    soft: ['3,2', '4,2', '12,2', '13,2'],
    bounce: ['8,2', '17,2', '21,2'],
    target: '24,2',
    start: { x: 0, y: 2, ori: 'standing' },
  },

  // 22 — 九曲：高低折返 + 四段薄冰，约 38 步
  {
    name: '九曲',
    tiles: uniq([
      ...rect(0, 0, 3, 2),
      '4,1', '5,1',
      ...rect(6, 0, 8, 4),
      ...rect(7, 5, 10, 7),
      '11,6', '12,6',
      ...rect(13, 4, 16, 7),
      ...rect(14, 0, 17, 3),
      '18,1', '19,1',
      ...rect(20, 0, 22, 4),
      ...rect(21, 5, 24, 7),
      '25,6', '26,6',
      ...rect(27, 4, 30, 7),
    ]),
    soft: ['4,1', '5,1', '11,6', '12,6', '18,1', '19,1', '25,6', '26,6'],
    bounce: ['8,2', '15,5', '21,2', '28,5'],
    target: '30,6',
    start: { x: 0, y: 1, ori: 'standing' },
  },

  // 23 — 深渊试炼：三段薄冰 + 三道弹门 + 上下干扰弹簧，约 45 步
  {
    name: '深渊试炼',
    tiles: uniq([
      ...rect(0, 1, 2, 3),
      '3,2', '4,2',
      ...rect(5, 0, 8, 4),
      '9,2',
      ...rect(10, 1, 12, 3),
      '13,2', '14,2',
      ...rect(15, 0, 18, 4),
      '19,2',
      ...rect(20, 1, 22, 3),
      '23,2', '24,2',
      ...rect(25, 0, 28, 4),
      '29,2',
      ...rect(30, 1, 32, 3),
    ]),
    soft: ['3,2', '4,2', '13,2', '14,2', '23,2', '24,2'],
    bounce: [
      '9,2', '19,2', '29,2',
      '6,0', '7,0', '6,4', '7,4',
      '16,0', '17,0', '16,4', '17,4',
      '26,0', '27,4',
    ],
    target: '32,2',
    start: { x: 0, y: 2, ori: 'standing' },
  },
];

export function getLevel(index: number): Level {
  return LEVELS[index];
}

export function levelCount(): number {
  return LEVELS.length;
}

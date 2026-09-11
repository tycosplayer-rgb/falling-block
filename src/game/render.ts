import { boundsOf, parseCell } from './logic';
import type { Dir, Level, Pose } from './types';
import { AXIS_X, AXIS_Y, VIEW_Z_SCALE } from './view';

export type AnimKind = 'idle' | 'roll' | 'fall' | 'win';

export interface AnimState {
  kind: AnimKind;
  /** 0..1 progress */
  t: number;
  from: Pose;
  to: Pose;
  dir: Dir;
  /** For fall: world-units downward */
  fallDepth: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface ViewTransform {
  originX: number;
  originY: number;
  tile: number;
  xx: number; // screen-x scale of world +X
  yx: number; // screen-x scale of world +Y (usually negative)
  xy: number; // screen-y scale of world +X
  yy: number; // screen-y scale of world +Y
  zScale: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInQuad(t: number): number {
  return t * t;
}

function project(p: Vec3, vt: ViewTransform): { sx: number; sy: number } {
  // Dimetric: independent X/Y axis scales so unit-square diagonals do not share sx.
  const sx = vt.originX + (p.x * vt.xx + p.y * vt.yx) * vt.tile;
  const sy =
    vt.originY + (p.x * vt.xy + p.y * vt.yy) * vt.tile - p.z * vt.tile * vt.zScale;
  return { sx, sy };
}

function boxAABB(pose: Pose): { min: Vec3; max: Vec3 } {
  if (pose.ori === 'standing') {
    return {
      min: { x: pose.x, y: pose.y, z: 0 },
      max: { x: pose.x + 1, y: pose.y + 1, z: 2 },
    };
  }
  if (pose.ori === 'horizontal') {
    return {
      min: { x: pose.x, y: pose.y, z: 0 },
      max: { x: pose.x + 2, y: pose.y + 1, z: 1 },
    };
  }
  return {
    min: { x: pose.x, y: pose.y, z: 0 },
    max: { x: pose.x + 1, y: pose.y + 2, z: 1 },
  };
}

/** 8 corners in index = x + 2*y + 4*z */
function aabbCorners(min: Vec3, max: Vec3): Vec3[] {
  const xs = [min.x, max.x];
  const ys = [min.y, max.y];
  const zs = [min.z, max.z];
  const out: Vec3[] = new Array(8);
  for (let zi = 0; zi < 2; zi++) {
    for (let yi = 0; yi < 2; yi++) {
      for (let xi = 0; xi < 2; xi++) {
        out[xi + yi * 2 + zi * 4] = { x: xs[xi], y: ys[yi], z: zs[zi] };
      }
    }
  }
  return out;
}

function rotateXZ(p: Vec3, pivotX: number, theta: number): Vec3 {
  const lx = p.x - pivotX;
  const lz = p.z;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: pivotX + lx * c + lz * s, y: p.y, z: -lx * s + lz * c };
}

function rotateYZ(p: Vec3, pivotY: number, theta: number): Vec3 {
  const ly = p.y - pivotY;
  const lz = p.z;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: p.x, y: pivotY + ly * c + lz * s, z: -ly * s + lz * c };
}

/** Corners of the block tumbling 90° around the roll-edge. t in [0,1]. */
export function tumblingCorners(from: Pose, dir: Dir, t: number): Vec3[] {
  const { min, max } = boxAABB(from);
  const corners = aabbCorners(min, max);
  const theta = (Math.PI / 2) * t;
  switch (dir) {
    case 'E':
      return corners.map((p) => rotateXZ(p, max.x, theta));
    case 'W':
      return corners.map((p) => rotateXZ(p, min.x, -theta));
    case 'S':
      return corners.map((p) => rotateYZ(p, max.y, theta));
    case 'N':
      return corners.map((p) => rotateYZ(p, min.y, -theta));
  }
}

const CUBE_FACES: [number, number, number, number][] = [
  [0, 2, 3, 1], // z = min (bottom)
  [4, 5, 7, 6], // z = max (top)
  [0, 1, 5, 4], // y = min (north)
  [2, 6, 7, 3], // y = max (south)
  [0, 4, 6, 2], // x = min (west)
  [1, 3, 7, 5], // x = max (east)
];

const FACE_COLORS = {
  top: '#ff9b5a',
  standingTop: '#ffc28a',
  south: '#c2410c',
  east: '#9a3412',
  north: '#ea580c',
  west: '#fb923c',
  bottom: '#7c2d12',
};

function faceTint(faceIndex: number, standing: boolean): string {
  switch (faceIndex) {
    case 1:
      return standing ? FACE_COLORS.standingTop : FACE_COLORS.top;
    case 2:
      return FACE_COLORS.north;
    case 3:
      return FACE_COLORS.south;
    case 4:
      return FACE_COLORS.west;
    case 5:
      return FACE_COLORS.east;
    default:
      return FACE_COLORS.bottom;
  }
}

function computeView(level: Level, width: number, height: number): ViewTransform {
  const b = boundsOf(level);
  const xx = AXIS_X.sx;
  const yx = AXIS_Y.sx;
  const xy = AXIS_X.sy;
  const yy = AXIS_Y.sy;
  const zScale = VIEW_Z_SCALE;
  const pad = 52;

  const usableW = Math.max(100, width - pad * 2);
  const usableH = Math.max(100, height - pad * 2);

  // Project AABB of the whole map (including a standing block height)
  const worldCorners: Vec3[] = [];
  for (const x of [b.minX, b.maxX + 1]) {
    for (const y of [b.minY, b.maxY + 1]) {
      worldCorners.push({ x, y, z: 0 });
      worldCorners.push({ x, y, z: 2.4 });
    }
  }

  const probe: ViewTransform = {
    originX: 0,
    originY: 0,
    tile: 1,
    xx,
    yx,
    xy,
    yy,
    zScale,
  };
  let minSX = Infinity;
  let maxSX = -Infinity;
  let minSY = Infinity;
  let maxSY = -Infinity;
  for (const c of worldCorners) {
    const s = project(c, probe);
    minSX = Math.min(minSX, s.sx);
    maxSX = Math.max(maxSX, s.sx);
    minSY = Math.min(minSY, s.sy);
    maxSY = Math.max(maxSY, s.sy);
  }
  const spanX = Math.max(0.001, maxSX - minSX);
  const spanY = Math.max(0.001, maxSY - minSY);
  const tile = Math.max(18, Math.min(70, Math.min(usableW / spanX, usableH / spanY)));

  const vt: ViewTransform = {
    originX: 0,
    originY: 0,
    tile,
    xx,
    yx,
    xy,
    yy,
    zScale,
  };
  minSX = Infinity;
  maxSX = -Infinity;
  minSY = Infinity;
  maxSY = -Infinity;
  for (const c of worldCorners) {
    const s = project(c, vt);
    minSX = Math.min(minSX, s.sx);
    maxSX = Math.max(maxSX, s.sx);
    minSY = Math.min(minSY, s.sy);
    maxSY = Math.max(maxSY, s.sy);
  }
  vt.originX = width / 2 - (minSX + maxSX) / 2;
  vt.originY = height / 2 - (minSY + maxSY) / 2;
  return vt;
}

function drawQuad(
  ctx: CanvasRenderingContext2D,
  pts: { sx: number; sy: number }[],
  fill: string,
  stroke: string,
) {
  ctx.beginPath();
  ctx.moveTo(pts[0].sx, pts[0].sy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

/** 12 edges of a cuboid as corner-index pairs. */
const CUBE_EDGES: [number, number][] = [
  [0, 1], [1, 3], [3, 2], [2, 0], // bottom z-min
  [4, 5], [5, 7], [7, 6], [6, 4], // top z-max
  [0, 4], [1, 5], [2, 6], [3, 7], // vertical
];

function faceFrontFacing(pts: { sx: number; sy: number }[]): boolean {
  // Screen-space signed area; canvas Y grows downward so >0 means CCW on screen.
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.sx * b.sy - b.sx * a.sy;
  }
  return area > 1e-6;
}

function drawCuboid(
  ctx: CanvasRenderingContext2D,
  corners: Vec3[],
  vt: ViewTransform,
  standing: boolean,
  alpha: number,
  glow: boolean,
) {
  const projected = corners.map((c) => project(c, vt));
  type Face = {
    depth: number;
    pts: { sx: number; sy: number }[];
    color: string;
    front: boolean;
    indices: number[];
  };
  const faces: Face[] = [];
  for (let fi = 0; fi < CUBE_FACES.length; fi++) {
    const idx = CUBE_FACES[fi];
    const pts = idx.map((i) => projected[i]);
    const world = idx.map((i) => corners[i]);
    const cx = (world[0].x + world[1].x + world[2].x + world[3].x) / 4;
    const cy = (world[0].y + world[1].y + world[2].y + world[3].y) / 4;
    const cz = (world[0].z + world[1].z + world[2].z + world[3].z) / 4;
    faces.push({
      depth: cx + cy - cz * 1.4,
      pts,
      color: faceTint(fi, standing),
      front: faceFrontFacing(pts),
      indices: idx,
    });
  }
  faces.sort((a, b) => a.depth - b.depth);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (glow) {
    ctx.shadowColor = '#fde68a';
    ctx.shadowBlur = 22;
  }

  // Fill only front faces — no per-face stroke (that hid shared edges).
  for (const f of faces) {
    if (!f.front) continue;
    ctx.beginPath();
    ctx.moveTo(f.pts[0].sx, f.pts[0].sy);
    for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].sx, f.pts[i].sy);
    ctx.closePath();
    ctx.fillStyle = f.color;
    ctx.fill();
  }

  // Draw every cuboid edge once so silhouettes never drop out mid-roll.
  const edgeVisible = new Set<string>();
  for (const f of faces) {
    if (!f.front) continue;
    const ids = f.indices;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % ids.length];
      edgeVisible.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    }
  }

  // Stroke every geometric edge once (after fills) so no prism edge disappears
  // when a face is edge-on or depth-sorted oddly during a roll.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(40, 14, 8, 0.9)';
  ctx.lineWidth = Math.max(1.35, vt.tile * 0.05);
  ctx.beginPath();
  for (const [a, b] of CUBE_EDGES) {
    const pa = projected[a];
    const pb = projected[b];
    ctx.moveTo(pa.sx, pa.sy);
    ctx.lineTo(pb.sx, pb.sy);
  }
  ctx.stroke();
  // Soft outer silhouette for edges on front faces (extra clarity)
  ctx.strokeStyle = 'rgba(255, 220, 180, 0.22)';
  ctx.lineWidth = Math.max(0.8, vt.tile * 0.025);
  ctx.beginPath();
  for (const [a, b] of CUBE_EDGES) {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!edgeVisible.has(key)) continue;
    const pa = projected[a];
    const pb = projected[b];
    ctx.moveTo(pa.sx, pa.sy);
    ctx.lineTo(pb.sx, pb.sy);
  }
  ctx.stroke();
  ctx.restore();
}

function drawTileSlab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vt: ViewTransform,
  kind: 'floor' | 'target' | 'soft' | 'bounce',
) {
  const h = 0.22;
  const min = { x, y, z: -h };
  const max = { x: x + 1, y: y + 1, z: 0 };
  const corners = aabbCorners(min, max);
  const projected = corners.map((c) => project(c, vt));
  const checker = (x + y) & 1;

  let topFill: string;
  let sideE: string;
  let sideS: string;
  if (kind === 'target') {
    topFill = '#fbbf24';
    sideE = '#b45309';
    sideS = '#92400e';
  } else if (kind === 'soft') {
    topFill = checker ? '#7dd3fc' : '#38bdf8';
    sideE = '#0284c7';
    sideS = '#0369a1';
  } else if (kind === 'bounce') {
    topFill = checker ? '#f9a8d4' : '#f472b6';
    sideE = '#db2777';
    sideS = '#9d174d';
  } else {
    topFill = checker ? '#4b6a96' : '#3e5a82';
    sideE = '#243552';
    sideS = '#1b2940';
  }

  ctx.lineWidth = Math.max(1, vt.tile * 0.03);
  ctx.lineJoin = 'round';

  // east side (x max) indices 1,3,7,5
  drawQuad(ctx, [1, 3, 7, 5].map((i) => projected[i]), sideE, 'rgba(0,0,0,0.25)');
  // south side (y max) 2,6,7,3
  drawQuad(ctx, [2, 6, 7, 3].map((i) => projected[i]), sideS, 'rgba(0,0,0,0.25)');
  // top z max 4,5,7,6
  drawQuad(ctx, [4, 5, 7, 6].map((i) => projected[i]), topFill, 'rgba(8,12,24,0.55)');

  if (kind === 'target') {
    const c = project({ x: x + 0.5, y: y + 0.5, z: 0.02 }, vt);
    ctx.beginPath();
    ctx.arc(c.sx, c.sy, vt.tile * 0.22, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(1.5, vt.tile * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.sx, c.sy, vt.tile * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120, 53, 15, 0.55)';
    ctx.fill();
  } else if (kind === 'soft') {
    // Crack mark — only safe while lying flat
    const a = project({ x: x + 0.25, y: y + 0.35, z: 0.03 }, vt);
    const b = project({ x: x + 0.55, y: y + 0.55, z: 0.03 }, vt);
    const c = project({ x: x + 0.8, y: y + 0.4, z: 0.03 }, vt);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1.2, vt.tile * 0.045);
    ctx.stroke();
  } else if (kind === 'bounce') {
    // Spring chevron
    const a = project({ x: x + 0.3, y: y + 0.65, z: 0.03 }, vt);
    const b = project({ x: x + 0.5, y: y + 0.3, z: 0.03 }, vt);
    const c = project({ x: x + 0.7, y: y + 0.65, z: 0.03 }, vt);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1.4, vt.tile * 0.05);
    ctx.stroke();
  }
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  level: Level,
  pose: Pose,
  anim: AnimState | null,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(90,120,180,0.07)';
  for (let i = 0; i < 36; i++) {
    const x = ((i * 97) % width) + 8;
    const y = ((i * 53) % height) + 8;
    ctx.beginPath();
    ctx.arc(x, y, 1.15, 0, Math.PI * 2);
    ctx.fill();
  }

  const vt = computeView(level, width, height);
  const tiles = level.tiles.map(parseCell).sort((a, b) => a.x + a.y - (b.x + b.y));
  const target = parseCell(level.target);
  const soft = new Set(level.soft ?? []);
  const bounce = new Set(level.bounce ?? []);

  for (const t of tiles) {
    const key = `${t.x},${t.y}`;
    let kind: 'floor' | 'target' | 'soft' | 'bounce' = 'floor';
    if (t.x === target.x && t.y === target.y) kind = 'target';
    else if (soft.has(key)) kind = 'soft';
    else if (bounce.has(key)) kind = 'bounce';
    drawTileSlab(ctx, t.x, t.y, vt, kind);
  }

  let corners: Vec3[];
  let standing = pose.ori === 'standing';
  let alpha = 1;
  let glow = false;

  if (anim && anim.kind === 'roll') {
    const t = easeOutCubic(anim.t);
    corners = tumblingCorners(anim.from, anim.dir, t);
    standing = t < 0.5 ? anim.from.ori === 'standing' : anim.to.ori === 'standing';
  } else if (anim && anim.kind === 'fall') {
    const t = easeInQuad(anim.t);
    const { min, max } = boxAABB(anim.from);
    const base = aabbCorners(min, max);
    corners = base.map((p) => ({ x: p.x, y: p.y, z: p.z - t * anim.fallDepth }));
    standing = anim.from.ori === 'standing';
    alpha = 1 - t * 0.85;
  } else if (anim && anim.kind === 'win') {
    const bounce = Math.sin(anim.t * Math.PI) * 0.45;
    const { min, max } = boxAABB(anim.to);
    corners = aabbCorners(min, max).map((p) => ({ ...p, z: p.z + bounce }));
    standing = true;
    glow = true;
  } else {
    const { min, max } = boxAABB(pose);
    corners = aabbCorners(min, max);
  }

  drawCuboid(ctx, corners, vt, standing, alpha, glow);
}

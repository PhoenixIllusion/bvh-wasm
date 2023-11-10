import { memory, __new as alloc, Create, test_bvh, BuildBVH } from '../build/release.min.js';

export const TILE_SIZE_X = 320;
export const TILE_SIZE_Y = 240;

const perf = (label: string, func: ()=>void) => {
  const now = performance.now();
  func();
  console.log(label, performance.now()-now);
}

export const setup = async (buffer: Float32Array): Promise<{bvh: number, out: Float32Array, out_ref: number}> => {
  const bvh = Create(buffer.length/9);
  const out_ref = alloc(TILE_SIZE_X * TILE_SIZE_Y * 4, 0);
  const _bvh_data  = new Uint32Array(memory.buffer, bvh.valueOf(), 1);
  const triangles = new Float32Array(memory.buffer, _bvh_data[0], buffer.length );
  const out = new Float32Array(memory.buffer, out_ref, TILE_SIZE_X*TILE_SIZE_Y);

  triangles.set(buffer, 0);
  perf('build bvh', () => {
    BuildBVH(bvh);
  })
  return {bvh: bvh.valueOf(), out, out_ref };
}

export const render = (ray: Ray, loc: Loc, vals: {out: Float32Array, out_ref: number, bvh: number}): Float32Array => {
  const [OX,OY,OZ] = ray.o;
  const [P0X,P0Y,P0Z] = ray.p0;
  const [P1X,P1Y,P1Z] = ray.p1;
  const [P2X,P2Y,P2Z] = ray.p2;
  const {x,y, SCREEN_W, SCREEN_H } = loc;
  vals.out.fill(0);
  //perf('render-batch', () => {
    test_bvh(vals.out_ref, SCREEN_W, SCREEN_H, vals.bvh, OX,OY,OZ, P0X,P0Y,P0Z, P1X,P1Y,P1Z, P2X,P2Y,P2Z, x, TILE_SIZE_X, y, TILE_SIZE_Y);
  //})
  return vals.out;
}

export interface Ray {
  o: number[],
  p0: number[];
  p1: number[];
  p2: number[];
}
export interface Loc {
  SCREEN_W: number;
  SCREEN_H: number;
  x: number;
  y: number;
}
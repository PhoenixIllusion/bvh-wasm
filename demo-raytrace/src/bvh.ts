import { memory, __new as alloc, Create, test_bvh, BuildBVH } from '../build/release.min.js';

const HEATMAP = false;
const perf = (label: string, func: ()=>void) => {
  const now = performance.now();
  func();
  console.log(label, performance.now()-now);
}

export interface SetupResponse {
  out?: Float32Array;
  out_ref: number;
  bvh: number;
}

export const setup = async (buffer: Float32Array): Promise<SetupResponse> => {
  const bvh = Create(buffer.length/9);
  const _bvh_data  = new Uint32Array(memory.buffer, bvh.valueOf(), 1);
  const triangles = new Float32Array(memory.buffer, _bvh_data[0], buffer.length );

  triangles.set(buffer, 0);
  perf('build bvh', () => {
    BuildBVH(bvh);
  })
  return {bvh: bvh.valueOf(), out: undefined, out_ref: 0 };
}

const offscreenRender = (out: Uint8ClampedArray, width: number, height: number, buffer: Float32Array, range: { min: number, max: number}, timeTaken: number) => {
  const delta = range.max - range.min;
  const t = (v: number) => (v-range.min)/delta;
  for(let y=0;y<height;y++) {
    for(let x=0;x<width;x++) {
      const buff_idx = (x + y*width);
      const idx = buff_idx* 4;
      if(HEATMAP) {
        out[idx] = 255 * timeTaken/20;
      }
      if(buffer[buff_idx] > 0) {
        const c = buffer[buff_idx];
        const v = (1.0-t(c));
        out[idx+1] = out[idx+2] = v*255;
        if(!HEATMAP) {
          out[idx] = out[idx+1];
        }
        out[idx+3] = 255;
      } else {
        const idx = buff_idx* 4;
        out[idx+3] = 255;
      }
    }
  }
}

export const render = (ray: Ray, target: RenderTarget, buffer: ArrayBuffer, range: Range, vals: SetupResponse): RenderResponse => {
  const [OX,OY,OZ] = ray.o;
  const [P0X,P0Y,P0Z] = ray.p0;
  const [P1X,P1Y,P1Z] = ray.p1;
  const [P2X,P2Y,P2Z] = ray.p2;
  const {x,y, SCREEN_W, SCREEN_H, TILE_SIZE_X, TILE_SIZE_Y } = target;
  if(!vals.out) {
    vals.out_ref = alloc(TILE_SIZE_X * TILE_SIZE_Y * 4, 0);
    vals.out = new Float32Array(memory.buffer, vals.out_ref, TILE_SIZE_X*TILE_SIZE_Y);
  }

  vals.out.fill(0);
  const NOW = performance.now();
  test_bvh(vals.out_ref, SCREEN_W, SCREEN_H, vals.bvh, OX,OY,OZ, P0X,P0Y,P0Z, P1X,P1Y,P1Z, P2X,P2Y,P2Z, x, TILE_SIZE_X, y, TILE_SIZE_Y);
  const DUR = performance.now() - NOW;
  vals.out.forEach(v => {
    if(v != 0) {
      range.min = Math.min(range.min, v);
      range.max = Math.max(range.max, v);
    }
  });
  const canvas = new Uint8ClampedArray(buffer);
  canvas.fill(0);
  offscreenRender(canvas, TILE_SIZE_X, TILE_SIZE_Y, vals.out, range, DUR);
  return { range, canvas: buffer };
}

export interface RenderResponse {
  range:  Range,
  canvas: ArrayBuffer
}
export interface Range {
  min: number;
  max: number;
}
export interface RenderTarget {
  SCREEN_W: number;
  SCREEN_H: number;
  TILE_SIZE_X: number;
  TILE_SIZE_Y: number;
  x: number;
  y: number;
}

export interface Ray {
  o: number[],
  p0: number[];
  p1: number[];
  p2: number[];
}

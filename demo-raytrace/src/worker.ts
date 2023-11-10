import { Ray, Range, RenderTarget, SetupResponse } from './bvh';

let setup: Promise<SetupResponse>|undefined;

export interface SetupRequest {
  tri_count: number,
  buffer: Float32Array
}

export interface WorkerRequest {
  render: {
    ray: Ray,
    target: RenderTarget,
    range: Range,
    buffer: ArrayBuffer
  }
}
async function _loadBVH() {
  const BVH = await import('./bvh');
  return {
    SetupBVH: BVH.setup,
    RenderBVH: BVH.render
  }
};
const loadBVH = _loadBVH();

self.onmessage = async (e) => {
  const { SetupBVH, RenderBVH } = await loadBVH;
  const {tri_count, buffer, render} = e.data as SetupRequest & WorkerRequest;
  if(tri_count != undefined) {
    setup = SetupBVH(buffer);
    await setup;
    postMessage(true);
  }
  if(render) {
    const vals = await setup!;
    const { ray, target, range, buffer } = render;
    const ret = RenderBVH(ray, target, buffer, range, vals);
    postMessage(ret, {transfer: [ret.canvas]});
  }

}
let setup: Promise<{bvh: number, out: Float32Array, out_ref: number}>|undefined;

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
  const {tri_count, buffer, render} = e.data as {tri_count: number, buffer: Float32Array, render: { p0: number[], p1: number[], p2: number[], origin: number[]}};
  if(tri_count != undefined) {
    setup = SetupBVH(buffer);
    await setup;
    postMessage(true);
  }
  if(render) {
    const vals = await setup!;
    postMessage({buffer: RenderBVH(render.origin, render.p0, render.p1, render.p2, vals)});
  }

}
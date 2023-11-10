import { BVHNode, IntersectBVH, Ret, VectorMath } from '.';

export { Create, Destroy, BuildBVH } from '.'


export function test_bvh(out: usize, width: u32, height: u32, ret: Ret,
  camX: f32, camY: f32, camZ: f32,
  p0x: f32, p0y: f32, p0z: f32,
  p1x: f32, p1y: f32, p1z: f32,
  p2x: f32, p2y: f32, p2z: f32,
  
  dx: u32, dw: u32,
  dy: u32, dh: u32
  ): void {
  const cam = f32x4(camX, camY, camZ, 0);
  const p0 = f32x4(p0x, p0y, p0z, 0);
  const p1 = f32x4(p1x, p1y, p1z, 0);
  const p2 = f32x4(p2x, p2y, p2z, 0);

  const d10 = v128.sub<f32>(p1, p0);
  const d20 = v128.sub<f32>(p2, p0);
  for (let y: u32 = dy; y < dy+dh; y++) {
    for (let x: u32 = dx; x < dx+dw; x++) {
      const pixPos = v128.add<f32>(p0, v128.add<f32>(
        v128.mul<f32>(
          d10,
          v128.splat<f32>((x as f32) / (width as f32))
        ),
        v128.mul<f32>(
          d20,
          v128.splat<f32>((y as f32) / (height as f32))
        )));

      const rayO = cam;
      const rayD = VectorMath.normalize_128(v128.sub<f32>(pixPos, cam));

      const t = IntersectBVH(rayO, rayD, 1e30, changetype<BVHNode>(ret.bvh), ret);
      const out_idx = (x-dx) + (y-dy) * dw;
      store<f32>(out + out_idx*4, t < 1e30 ? t : 0);
    }
  }
}
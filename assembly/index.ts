class Tri {
  static v0(i: u32): v128 { return v128.load(i); }
  static v1(i: u32): v128 { return v128.load(i, 12); }
  static v2(i: u32): v128 { return v128.load(i, 24); }
  static c(i: u32): v128 { return v128.load(i, 32); }
  static c_p(i: u32, p: u8): f32 { return load<f32>(i + p*4, 32); }
}
export function set_Tri(i: u32,
  v0x: f32, v0y: f32, v0z: f32,
  v1x: f32, v1y: f32, v1z: f32,
  v2x: f32, v2y: f32, v2z: f32): void {
  v128.store(i, f32x4(v0x, v0y, v0z, v1x))
  v128.store(i, f32x4(v1y, v1z, v2x, v2y), 16)
  v128.store(i, f32x4(v2z, (v0x + v1x + v2x) / 3, (v0y + v1y + v2y) / 3, (v0z + v1z + v2z) / 3), 32)
}

const cross_128 = (a: v128, b: v128): v128 => {
  return v128.sub<f32>(
    v128.mul<f32>(
      v128.shuffle<f32>(a, a, 1, 2, 0, 3),
      v128.shuffle<f32>(b, b, 2, 0, 1, 2)),
    v128.mul<f32>(
      v128.shuffle<f32>(a, a, 2, 0, 1, 3),
      v128.shuffle<f32>(b, b, 1, 2, 0, 3))
  );
}
const dot_128 = (a: v128, b: v128): f32 => {
  const m = v128.mul<f32>(a, b);
  let res = v128.extract_lane<f32>(m, 0);
  res += v128.extract_lane<f32>(m, 1);
  res += v128.extract_lane<f32>(m, 2);
  return res;
}
const normalize_128 = (a: v128): v128 => {
  const sq = v128.mul<f32>(a, a);
  let res = v128.extract_lane<f32>(sq, 0);
  res += v128.extract_lane<f32>(sq, 1);
  res += v128.extract_lane<f32>(sq, 2);
  const div: f32 = 1.0 / (sqrt(res) as f32);
  return v128.div<f32>(a, v128.splat<f32>(div))
}

const IntersectTri = (rayO: v128, rayD: v128, rayT: f32, tri: u32): f32 => {
  const edge1 = v128.sub<f32>(Tri.v1(tri), Tri.v0(tri));
  const edge2 = v128.sub<f32>(Tri.v2(tri), Tri.v0(tri));
  const h = cross_128(rayD, edge2);
  const a: f32 = dot_128(edge1, h);
  if (a > -0.0001 && a < 0.0001) return rayT; // ray parallel to triangle
  const f: f32 = 1 / a;
  const s = v128.sub<f32>(rayO, Tri.v0(tri));
  const u = f * dot_128(s, h);
  if (u < 0 || u > 1) return rayT;
  const q = cross_128(s, edge1);
  const v = f * dot_128(rayD, q);
  if (v < 0 || u + v > 1) return rayT;
  const t = f * dot_128(edge2, q);
  if (t > 0.0001) {
    if (t < rayT) {
      return t;
    }
  }
  return rayT;
}

export function test(out: usize, width: i32, height: i32, tris: u32, tri_count: u32,
  camX: f32, camY: f32, camZ: f32,
  p0x: f32, p0y: f32, p0z: f32,
  p1x: f32, p1y: f32, p1z: f32,
  p2x: f32, p2y: f32, p2z: f32): void {
  const cam = f32x4(camX, camY, camZ, 0);
  const p0 = f32x4(p0x, p0y, p0z, 0);
  const p1 = f32x4(p1x, p1y, p1z, 0);
  const p2 = f32x4(p2x, p2y, p2z, 0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixPos = v128.add<f32>(p0, v128.add<f32>(
        v128.mul<f32>(
          v128.sub<f32>(p1, p0),
          v128.splat<f32>((x as f32) / (width as f32))
        ),
        v128.mul<f32>(
          v128.sub<f32>(p2, p0),
          v128.splat<f32>((y as f32) / (height as f32))
        )));

      let t: f32 = 1e30;
      const O = cam;
      const D = normalize_128(v128.sub<f32>(pixPos, O));
      for (let i: u32 = 0; i < tri_count; i++) {
        t = IntersectTri(O, D, t, tris + i * 48);
      }
      const out_idx = x + y * width;
      store<f32>(out + out_idx*4, t < 1e30 ? t : 0);
    }
  }
}
export function test_bvh(out: usize, width: u32, height: u32, bvh: u32,
  p0x: f32, p0y: f32, p0z: f32,
  p1x: f32, p1y: f32, p1z: f32,
  p2x: f32, p2y: f32, p2z: f32): void {
  const cam = f32x4(0, 0, -18, 0);
  const p0 = f32x4(p0x, p0y, p0z, 0);
  const p1 = f32x4(p1x, p1y, p1z, 0);
  const p2 = f32x4(p2x, p2y, p2z, 0);
  for (let y: u32 = 0; y < height; y++) {
    for (let x: u32 = 0; x < width; x++) {
      const pixPos = v128.add<f32>(p0, v128.add<f32>(
        v128.mul<f32>(
          v128.sub<f32>(p1, p0),
          v128.splat<f32>((x as f32) / (width as f32))
        ),
        v128.mul<f32>(
          v128.sub<f32>(p2, p0),
          v128.splat<f32>((y as f32) / (height as f32))
        )));

      let t: f32 = 1e30;
      const O = cam;
      const D = normalize_128(v128.sub<f32>(pixPos, O));
      t = IntersectBVH(O, D, t, bvh);
      const out_idx = x + y * width;
      store<u8>(out + out_idx, t < 1e30 ? 1 : 0);
    }
  }
}

class BVHNode {
  static aabbMin(i: u32): v128 { return v128.load(i) }
  static aabbMin_p(i: u32, p: u8): f32 { return load<f32>(i+p*4) }
  static aabbMax(i: u32): v128 { return v128.load(i, 16) }
  static s_leftNode(i: u32, v: u32): void { return store<u32>(i, v, 32) }
  static g_leftNode(i: u32): u32 { return load<u32>(i, 24) }
  static s_firstTriIdx(i: u32, v: u32): void { return store<u32>(i, v, 36) }
  static g_firstTriIdx(i: u32): u32 { return load<u32>(i, 28) }
  static s_triCount(i: u32, v: u32): void { return store<u32>(i, 40) }
  static g_triCount(i: u32): u32 { return load<u32>(i, 40) }
}

const MIN = (a: v128,b: v128): v128 => v128.min<f32>(a,b);
const MIN4 = (a: v128, b: v128, c: v128, d: v128): v128 => MIN(a, MIN(b, MIN(c, d)));

const MAX = (a: v128,b: v128): v128 => v128.max<f32>(a,b);
const MAX4 = (a: v128, b: v128, c: v128, d: v128): v128 => MAX(a, MAX(b, MAX(c, d)));

const UpdateNodeBounds = (node_ptr: u32): void => {

  let aabbMin = v128.splat<f32>(1e30);
  let aabbMax = v128.splat<f32>(-1e30);

  let triId = BVHNode.g_firstTriIdx(node_ptr);
  let count = BVHNode.g_triCount(node_ptr);
  for (let i: u32 = 0; i < count; i++) {
    const tri = load<u32>(triId); triId += 4;
    aabbMin = MIN4(Tri.v0(tri), Tri.v1(tri), Tri.v2(tri), aabbMin);
    aabbMax = MAX4(Tri.v0(tri), Tri.v1(tri), Tri.v2(tri), aabbMax);
  }
}
const VX = (a: v128): f32 => v128.extract_lane<f32>(a, 0);
const VY = (a: v128): f32 => v128.extract_lane<f32>(a, 1);
const VZ = (a: v128): f32 => v128.extract_lane<f32>(a, 2);

function Subdivide(node: u32, triIdx: u32,nodesUsed: u32): void {
  if (BVHNode.g_triCount(node) <= 2)
    return;

  // determine split axis and position
  const aabbMin = BVHNode.aabbMin(node);
  const extent = v128.sub<f32>(BVHNode.aabbMax(node), aabbMin);
  let axis:u8 = 0;
  let extentY = VY(extent);
  let extentZ = VZ(extent);
  let _extent = VX(extent);

  if (extentY > _extent) { axis = 1; _extent = extentY; }
  if (extentZ > _extent) { axis = 2; _extent = extentZ; }
  const splitPos = BVHNode.aabbMin_p(node, axis) + _extent * 0.5;

  // in-place partition
  let i = BVHNode.g_firstTriIdx(node);
  let j = i + (BVHNode.g_triCount(node) - 1) * 4;
  while (i <= j) {
    const tri_ptr = i;
    const tri = load<u32>(tri_ptr);
    if (Tri.c_p(tri, axis) < splitPos)
      i += 4;
    else {
      const end_tri_ptr = (j * 4);
      const end_tri = load<u32>(end_tri_ptr);
      store<u32>(tri_ptr, end_tri);
      store<u32>(end_tri_ptr, tri);
      j -= 4;
    }
  }
  // abort split if one of the sides is empty
  const firstTriIdx = BVHNode.g_firstTriIdx(node);
  const triCount = BVHNode.g_triCount(node);
  const leftCount = (i - firstTriIdx) / 4;
  if (leftCount == 0 || leftCount == triCount) return;
  // create child nodes
  const leftChildIdx = nodesUsed;nodesUsed += 44;
  const rightChildIdx = nodesUsed;nodesUsed += 44;

  BVHNode.s_firstTriIdx(leftChildIdx, firstTriIdx);
  BVHNode.s_triCount(leftChildIdx, leftCount);
  
  BVHNode.s_firstTriIdx(leftChildIdx, i);
  BVHNode.s_triCount(leftChildIdx, triCount - leftCount);

  BVHNode.s_leftNode(node, leftChildIdx);
  BVHNode.s_triCount(node, 0);

  UpdateNodeBounds(leftChildIdx);
  UpdateNodeBounds(rightChildIdx);

  // recurse
  Subdivide(leftChildIdx, triIdx, nodesUsed);
  Subdivide(rightChildIdx, triIdx, nodesUsed);
}

function IntersectAABB(rayO: v128, rayD: v128, rayT: f32, bmin: v128, bmax: v128 ): boolean {

    const t1 = v128.div<f32>(v128.sub<f32>(bmin, rayO), rayD);
    const t2 = v128.div<f32>(v128.sub<f32>(bmax, rayO), rayD);

    const tmin = v128.min<f32>(t1,t2);
    const tmax = v128.min<f32>(t1,t2);

    let _min = VX(tmin);
    let _max = VX(tmax);

    _min = max( _min, VY(tmin) )
    _max = min( _max, VY(tmax) );

    _min = max( _min, VZ(tmin)),
    _max = min( _max, VZ(tmax) );
    return _max >= _min && _min < rayT && _max > 0;
}

function IntersectBVH(rayO: v128, rayD: v128, rayT: f32, node: u32 ): f32
{

  const aabbMin = BVHNode.aabbMin(node);
  const aabbMax = BVHNode.aabbMax(node);
    if (!IntersectAABB( rayO, rayD, rayT, aabbMin, aabbMax )) return rayT;
    const triCount = BVHNode.g_triCount(node);
    if (triCount > 0)
    {
        const triCount = BVHNode.g_triCount(node);
        let triId = BVHNode.g_firstTriIdx(node);
        for (let i: u32 = 0; i < triCount; i++ ) {
          const tri = load<u32>(triId);
          rayT = IntersectTri( rayO, rayD, rayT, tri );
          triId += 4;
        }
    }
    else
    {
      const leftNode = BVHNode.g_leftNode(node);
      rayT = IntersectBVH( rayO, rayD, rayT, leftNode );
      rayT = IntersectBVH( rayO, rayD, rayT, leftNode + 44 );
    }
    return rayT;
}

export function BuildBVH(bvhNodes: u32, triIdx: u32, count: u32): void {
  BVHNode.s_leftNode(bvhNodes, bvhNodes);
  BVHNode.s_firstTriIdx(bvhNodes, triIdx);
  BVHNode.s_triCount(bvhNodes, count);
  UpdateNodeBounds(bvhNodes);
  Subdivide(bvhNodes, triIdx, bvhNodes + 44);
}
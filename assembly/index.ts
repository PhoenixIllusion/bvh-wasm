class Tri {
  @inline
  static v0(i: u32): v128 { return v128.load(i); }
  @inline
  static v1(i: u32): v128 { return v128.load(i, 12); }
  @inline
  static v2(i: u32): v128 { return v128.load(i, 24); }
  @inline
  static c(i: u32): v128 { return v128.load(i, 36); }
  @inline
  static c_p(i: u32, p: u8): f32 { return load<f32>(i + p*4, 36); }
}

function move_Tri(i: u32, o: u32, div: v128): void {
  const p0 = v128.load(i);
  const p1 = v128.load(i+12);
  const p2 = v128.load(i+24);
  const c = v128.mul<f32>(v128.add<f32>(v128.add<f32>(p0,p1),p2), div);
  v128.store(o, p0);
  v128.store(o+12, p1);
  v128.store(o+24, p2);
  const _tmp = load<f32>(o+48);
  v128.store(o+36, c);
  store<f32>(o+48, _tmp);
}

function VX(a: v128): f32 { return v128.extract_lane<f32>(a, 0); };
function VY(a: v128): f32 { return v128.extract_lane<f32>(a, 1); };
function VZ(a: v128): f32 { return v128.extract_lane<f32>(a, 2); };

class VectorMath {
  @inline
  static cross_128(a: v128, b: v128): v128 {
    return v128.sub<f32>(
      v128.mul<f32>(
        v128.shuffle<f32>(a, a, 1, 2, 0, 3),
        v128.shuffle<f32>(b, b, 2, 0, 1, 2)),
      v128.mul<f32>(
        v128.shuffle<f32>(a, a, 2, 0, 1, 3),
        v128.shuffle<f32>(b, b, 1, 2, 0, 3))
    );
  }
  @inline
  static dot_128(a: v128, b: v128): f32 {
    const m = v128.mul<f32>(a, b);
    let res = VX(m) + VY(m) + VZ(m);
    return res;
  }
  @inline
  static normalize_128(a: v128): v128 {
    const sq = v128.mul<f32>(a, a);
    let res = VX(sq) + VY(sq) + VZ(sq);
    const div: f32 = 1.0 / (sqrt(res) as f32);
    return v128.div<f32>(a, v128.splat<f32>(div))
  }
}

const SIZE_TRI = 48;
const SIZE_BVH = 44;

const STACK_OFFSET = 20;


@unmanaged
class _BVHNode {

}

@unmanaged
class Ret {
  triangles: u32;
  triIndex: u32
  bvh: u32;
  stack: u32;
  centeroid: u32;
  hit: u32;
  count: u32;
}

export function Create(numTriangles: u32): Ret {
  const ret = new Ret();
  ret.triangles = heap.alloc(SIZE_TRI * numTriangles) as u32;
  ret.triIndex = heap.alloc(4 * numTriangles) as u32;
  ret.bvh = heap.alloc(SIZE_BVH * 2 * numTriangles) as u32;
  ret.stack = heap.alloc(4 * 64) as u32;
  ret.centeroid = heap.alloc(32) as u32;
  ret.count = numTriangles;

  for(let i: u32 = 0; i < numTriangles; i++) {
    store<u32>(ret.triIndex + i * 4, ret.triangles + i * SIZE_TRI);
  }

  return ret;
}
export function Destroy(ptr: Ret): void {
  heap.free(ptr.triangles);
  heap.free(ptr.triIndex);
  heap.free(ptr.bvh);
  heap.free(ptr.stack);
  heap.free(u32(ptr));
}



function IntersectTri(rayO: v128, rayD: v128, rayT: f32, tri: u32, ret: Ret): f32 {
  const edge1 = v128.sub<f32>(Tri.v1(tri), Tri.v0(tri));
  const edge2 = v128.sub<f32>(Tri.v2(tri), Tri.v0(tri));
  const h = VectorMath.cross_128(rayD, edge2);
  const a: f32 = VectorMath.dot_128(edge1, h);
  if (a > -0.0001 && a < 0.0001) return rayT; // ray parallel to triangle
  const f: f32 = 1 / a;
  const s = v128.sub<f32>(rayO, Tri.v0(tri));
  const u = f * VectorMath.dot_128(s, h);
  if (u < 0 || u > 1) return rayT;
  const q = VectorMath.cross_128(s, edge1);
  const v = f * VectorMath.dot_128(rayD, q);
  if (v < 0 || u + v > 1) return rayT;
  const t = f * VectorMath.dot_128(edge2, q);
  if (t > 0.0001) {
    if (t < rayT) {
      ret.hit = tri;
      return t;
    }
  }
  return rayT;
}

export function test_bvh(out: usize, width: u32, height: u32, ret: Ret,
  camX: f32, camY: f32, camZ: f32,
  p0x: f32, p0y: f32, p0z: f32,
  p1x: f32, p1y: f32, p1z: f32,
  p2x: f32, p2y: f32, p2z: f32): void {
  const cam = f32x4(camX, camY, camZ, 0);
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
      const D = VectorMath.normalize_128(v128.sub<f32>(pixPos, O));
      t = IntersectBVH_recurse(O, D, t, ret.bvh, ret);
      const out_idx = x + y * width;
      store<f32>(out + out_idx*4, t < 1e30 ? t : 0);
    }
  }
}

class AABB {
  static grow(i: u32, p: v128): void {
    const aabbMin = BVHNode.aabbMin(i);BVHNode.s_aabbMin(i,v128.min<f32>(p, aabbMin));
    const aabbMax = BVHNode.aabbMax(i);BVHNode.s_aabbMax(i,v128.max<f32>(p, aabbMax));
  }
  static grow_aabb(i: u32, j: u32): void {
    if(BVHNode.aabbMin_p(j,0) < 1e30 ) {
      AABB.grow(i, BVHNode.aabbMin(j));
      AABB.grow(i, BVHNode.aabbMax(j));
    }
  }
}

class BVHNode {
  static s_aabbMin(i: u32, v: v128): void { v128.store(i, v) }
  static aabbMin(i: u32): v128 { return v128.load(i) }
  static aabbMin_p(i: u32, p: u8): f32 { return load<f32>(i+p*4) }
  static s_aabbMax(i: u32, v: v128): void { v128.store(i, v, 16) }
  static aabbMax(i: u32): v128 { return v128.load(i, 16) }
  static s_leftNode(i: u32, v: u32): void { return store<u32>(i, v, 32) }
  static g_leftNode(i: u32): u32 { return load<u32>(i, 32) }
  static s_firstTriIdx(i: u32, v: u32): void { return store<u32>(i, v, 36) }
  static g_firstTriIdx(i: u32): u32 { return load<u32>(i, 36) }
  static s_triCount(i: u32, v: u32): void { return store<u32>(i, v, 40) }
  static g_triCount(i: u32): u32 { return load<u32>(i, 40) }

  static NodeCost(i: u32, triCount: u32): f32 {
    const e = v128.sub<f32>(BVHNode.aabbMax(i),BVHNode.aabbMin(i));
    const e2 = v128.mul<f32>(v128.shuffle<f32>(e,e,1,2,0,0),e);
    return (VX(e2)+VY(e2)+VZ(e2)) * triCount;
  }
}

const MIN = (a: v128,b: v128): v128 => v128.min<f32>(a,b);
const MIN4 = (a: v128, b: v128, c: v128, d: v128): v128 => MIN(a, MIN(b, MIN(c, d)));

const MAX = (a: v128,b: v128): v128 => v128.max<f32>(a,b);
const MAX4 = (a: v128, b: v128, c: v128, d: v128): v128 => MAX(a, MAX(b, MAX(c, d)));

function UpdateNodeBounds(node_ptr: u32, centroid: u32): void {

	let min4: v128 = v128.splat<f32>( 1e30 ), max4 = v128.splat<f32>( -1e30 );
	let cmin4: v128 = v128.splat<f32>( 1e30 ), cmax4 = v128.splat<f32>(-1e30 );

  let triId = BVHNode.g_firstTriIdx(node_ptr);
  let count = BVHNode.g_triCount(node_ptr);
  for (let i: u32 = 0; i < count; i++) {
    const tri = load<u32>(triId); triId += 4;
		min4 = v128.min<f32>( min4, Tri.v0(tri) ), max4 = v128.max<f32>( max4, Tri.v0(tri) );
		min4 = v128.min<f32>( min4, Tri.v1(tri) ), max4 = v128.max<f32>( max4, Tri.v1(tri) );
		min4 = v128.min<f32>( min4, Tri.v2(tri) ), max4 = v128.max<f32>( max4, Tri.v2(tri) );
		cmin4 = v128.min<f32>( cmin4, Tri.c(tri) );
		cmax4 = v128.max<f32>( cmax4, Tri.c(tri) );
  }
  BVHNode.s_aabbMin(node_ptr, min4);
  BVHNode.s_aabbMax(node_ptr, max4);
  v128.store(centroid, cmin4);
  v128.store(centroid, cmax4, 16);
}

function Subdivide(node: u32, nodesUsed: u32, centroid: u32): u32 {
  if (BVHNode.g_triCount(node) <= 2)
    return nodesUsed;

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
  const firstTriIdx = BVHNode.g_firstTriIdx(node);
  const triCount = BVHNode.g_triCount(node);
  let i = firstTriIdx;
  let j = i + (triCount - 1) * 4;
  while (i <= j) {
    const tri_ptr = i;
    const tri = load<u32>(tri_ptr);
    if (Tri.c_p(tri, axis) < splitPos)
      i += 4;
    else {
      const end_tri_ptr = j;
      const end_tri = load<u32>(end_tri_ptr);
      store<u32>(tri_ptr, end_tri);
      store<u32>(end_tri_ptr, tri);
      j -= 4;
    }
  }
  // abort split if one of the sides is empty
  const leftCount = (i - firstTriIdx) / 4;
  if (leftCount == 0 || leftCount == triCount) return nodesUsed;
  // create child nodes
  const leftChildIdx = nodesUsed;nodesUsed += 44;
  const rightChildIdx = nodesUsed;nodesUsed += 44;

  BVHNode.s_firstTriIdx(leftChildIdx, firstTriIdx);
  BVHNode.s_triCount(leftChildIdx, leftCount);
  
  BVHNode.s_firstTriIdx(rightChildIdx, i);
  BVHNode.s_triCount(rightChildIdx, triCount - leftCount);

  BVHNode.s_leftNode(node, leftChildIdx);
  BVHNode.s_triCount(node, 0);

  UpdateNodeBounds(leftChildIdx, centroid);
  UpdateNodeBounds(rightChildIdx, centroid);

  // recurse
  nodesUsed = Subdivide(leftChildIdx, nodesUsed, centroid);
  return Subdivide(rightChildIdx, nodesUsed, centroid);
}

function IntersectAABB(rayO: v128, rayD: v128, rayT: f32, bmin: v128, bmax: v128 ): f32 {

    const t1 = v128.div<f32>(v128.sub<f32>(bmin, rayO), rayD);
    const t2 = v128.div<f32>(v128.sub<f32>(bmax, rayO), rayD);

    const tmin = v128.min<f32>(t1,t2);
    const tmax = v128.max<f32>(t1,t2);

    let _min = VX(tmin);
    let _max = VX(tmax);

    _min = max( _min, VY(tmin) )
    _max = min( _max, VY(tmax) );

    _min = max( _min, VZ(tmin)),
    _max = min( _max, VZ(tmax) );
    return (_max >= _min && _min < rayT && _max > 0)? _min: 1e30;
}

function IntersectBVH_recurse(rayO: v128, rayD: v128, rayT: f32, node: u32, ret: Ret): f32
{
  const aabbMin = BVHNode.aabbMin(node);
  const aabbMax = BVHNode.aabbMax(node);
    if (IntersectAABB( rayO, rayD, rayT, aabbMin, aabbMax ) == 1e30) return rayT;
    const triCount = BVHNode.g_triCount(node);
    if (triCount > 0)
    {
        const triCount = BVHNode.g_triCount(node);
        let triId = BVHNode.g_firstTriIdx(node);
        for (let i: u32 = 0; i < triCount; i++ ) {
          const tri = load<u32>(triId);
          rayT = IntersectTri( rayO, rayD, rayT, tri, ret );
          triId += 4;
        }
    }
    else
    {
      const leftNode = BVHNode.g_leftNode(node);
      const rightNode = leftNode + 44;
      rayT = IntersectBVH_recurse( rayO, rayD, rayT, leftNode, ret );
      rayT = IntersectBVH_recurse( rayO, rayD, rayT, rightNode, ret );
    }
    return rayT;
}

function IntersectBVH(rayO: v128, rayD: v128, rayT: f32, node: u32, ret: Ret): f32
{
  const stack = ret.stack;
  let stackPtr = 0;
  while(1) {
    const triCount = BVHNode.g_triCount(node);
    if (triCount > 0) {
      let triId = BVHNode.g_firstTriIdx(node);
      for (let i: u32 = 0; i < triCount; i++ ) {
        const tri = load<u32>(triId);
        rayT = IntersectTri( rayO, rayD, rayT, tri, ret);
        triId += 4;
      }
      if(stackPtr == 0) break; else {
        node = load<u32>(stack + (--stackPtr)*4);
      }
    }
    let child1 = BVHNode.g_leftNode(node);
    let child2 = BVHNode.g_leftNode(node)+44;
    let dist1 = IntersectAABB( rayO, rayD, rayT, BVHNode.aabbMin(child1), BVHNode.aabbMax(child1) );
    let dist2 = IntersectAABB( rayO, rayD, rayT, BVHNode.aabbMin(child2), BVHNode.aabbMax(child2));
    if(dist1 > dist2) { //swap
      let _t1: f32 = dist1; dist1 = dist2; dist2 = _t1;
      let _t2: u32 = child1; child1 = child2; child2 = _t2;
    }
    if (dist1 == 1e30)
		{
      if(stackPtr == 0) break; else {
        node = load<u32>(stack + (--stackPtr)*4);
      }
		}
		else
		{
			node = child1;
			if (dist2 != 1e30) {
        store<u32>(stack + (stackPtr++)*4, child2)
      }
		}
  }
  return rayT;
}

export function BuildBVH(holder: Ret): void {
  const count = holder.count;
  const triangles = holder.triangles;
  const centroid_divider = v128.splat<f32>(1/3);
  for(let i:u32 = holder.count-1; i>0;i--) {
    move_Tri(triangles + i * 4 * 9, triangles + i * SIZE_TRI, centroid_divider);
  }
  move_Tri(triangles, triangles, centroid_divider);

  const bvh = holder.bvh;
  const triIndex = holder.triIndex;
  BVHNode.s_leftNode(bvh, bvh);
  BVHNode.s_firstTriIdx(bvh, triIndex);
  BVHNode.s_triCount(bvh, count);

  const centeroid = holder.centeroid;
  UpdateNodeBounds(bvh, centeroid);
  Subdivide(bvh, bvh + 44, centeroid);
}
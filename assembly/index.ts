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

  BINS_min: u32;
  BINS_max: u32;
  leftCountArea: u32;
  rightCountArea: u32;
  binCount: u32;

  _u8_1: u8;
  _u8_2: u8;
  _nodeUsed: u32;
}

export function Create(numTriangles: u32): Ret {
  const ret = new Ret();
  ret.triangles = heap.alloc(SIZE_TRI * numTriangles) as u32;
  ret.triIndex = heap.alloc(4 * numTriangles) as u32;
  ret.bvh = heap.alloc(SIZE_BVH * 2 * numTriangles) as u32;
  ret.stack = heap.alloc(4 * 64) as u32;
  ret.centeroid = heap.alloc(32) as u32;
  ret.count = numTriangles;
  ret.BINS_min = heap.alloc(16* BINS * 2 + 3 * 4 * BINS) as u32;
  ret.BINS_max = ret.BINS_min + 16 * BINS;
  ret.binCount = ret.BINS_max + 16 * BINS;
  ret.leftCountArea = ret.binCount + 4 * BINS;
  ret.rightCountArea = ret.leftCountArea + 4 * BINS;

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
  heap.free(ptr.BINS_min);
  heap.free(changetype<u32>(ptr));
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
      t = IntersectBVH(O, D, t, changetype<BVHNode>(ret.bvh), ret);
      const out_idx = x + y * width;
      store<f32>(out + out_idx*4, t < 1e30 ? t : 0);
    }
  }
}

/*
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
}*/

@unmanaged
class BVHNode {
  aabbMin: v128;
  aabbMax: v128;
  leftNode: BVHNode;
  firstTriIdx: u32;
  triCount: u32;

  aabbMin_p(i: u8):f32 { return load<f32>( changetype<u32>(this) + i * 4); }

  nodeCost(): f32 {
    const e = v128.sub<f32>(this.aabbMax,this.aabbMin);
    const e2 = v128.mul<f32>(v128.shuffle<f32>(e,e,1,2,0,0),e);
    return (VX(e2)+VY(e2)+VZ(e2)) * f32(this.triCount);
  }
}

const MIN = (a: v128,b: v128): v128 => v128.min<f32>(a,b);
const MIN4 = (a: v128, b: v128, c: v128, d: v128): v128 => MIN(a, MIN(b, MIN(c, d)));

const MAX = (a: v128,b: v128): v128 => v128.max<f32>(a,b);
const MAX4 = (a: v128, b: v128, c: v128, d: v128): v128 => MAX(a, MAX(b, MAX(c, d)));

function UpdateNodeBounds(node: BVHNode, centroid: u32): void {

	let min4: v128 = v128.splat<f32>( 1e30 ), max4 = v128.splat<f32>( -1e30 );
	let cmin4: v128 = v128.splat<f32>( 1e30 ), cmax4 = v128.splat<f32>(-1e30 );

  let triId = node.firstTriIdx;
  let count = node.triCount;
  for (let i: u32 = 0; i < count; i++) {
    const tri = load<u32>(triId); triId += 4;
    min4 = MIN4(Tri.v0(tri), Tri.v1(tri),Tri.v2(tri), min4);
    max4 = MAX4(Tri.v0(tri), Tri.v1(tri),Tri.v2(tri), max4);
		cmin4 = v128.min<f32>( cmin4, Tri.c(tri) );
		cmax4 = v128.max<f32>( cmax4, Tri.c(tri) );
  }
  node.aabbMin = min4;
  node.aabbMax = max4;
  v128.store(centroid, cmin4);
  v128.store(centroid, cmax4, 16);
}

function Subdivide(node: BVHNode, centeroid: u32, ret: Ret): void {

  const splitCost = FindBestSplitPlane(node, centeroid, ret);
  const axis = ret._u8_1;
  const splitPos = ret._u8_2;

  const nosplitCost = node.nodeCost();
	if (splitCost >= nosplitCost) return;


  // in-place partition
  const firstTriIdx = node.firstTriIdx;
  const triCount = node.triCount
  let i = firstTriIdx;
  let j = i + (triCount - 1) * 4;

  const cMinAxis = load<f32>(centeroid + axis*4);
  const cMaxAxis = load<f32>(centeroid + axis*4, 16);
  const scale: f32 = f32(BINS) /(cMaxAxis - cMinAxis);

  while (i <= j) {
    const tri_ptr = i;
    const tri = load<u32>(tri_ptr);
    const binIdx = min(BINS - 1, u32((Tri.c_p(tri,axis)- cMinAxis) * scale))
    if (binIdx < splitPos)
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
  if (leftCount == 0 || leftCount == triCount) return;
  // create child nodes
  let nodesUsed = ret._nodeUsed;
  const leftChild = changetype<BVHNode>(nodesUsed);nodesUsed += 44;
  const rightChild = changetype<BVHNode>(nodesUsed);nodesUsed += 44;
  ret._nodeUsed = nodesUsed;

  leftChild.firstTriIdx = firstTriIdx;
  leftChild.triCount = leftCount;

  rightChild.firstTriIdx = i;
  rightChild.triCount = triCount - leftCount;

  node.leftNode = leftChild;
  node.triCount = 0;

  UpdateNodeBounds(leftChild, centeroid);
  Subdivide(leftChild, centeroid, ret)
  UpdateNodeBounds(rightChild, centeroid);
  Subdivide(rightChild, centeroid, ret)
  // recurse
  return;
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

function IntersectBVH_recurse(rayO: v128, rayD: v128, rayT: f32, node: BVHNode, ret: Ret): f32
{
  const aabbMin = node.aabbMin;
  const aabbMax = node.aabbMax;
    if (IntersectAABB( rayO, rayD, rayT, aabbMin, aabbMax ) == 1e30) return rayT;
    const triCount = node.triCount;
    if (triCount > 0)
    {
        let triId = node.firstTriIdx;
        for (let i: u32 = 0; i < triCount; i++ ) {
          const tri = load<u32>(triId);
          rayT = IntersectTri( rayO, rayD, rayT, tri, ret );
          triId += 4;
        }
    }
    else
    {
      const leftNode = node.leftNode;
      const rightNode = changetype<BVHNode>(changetype<u32>(leftNode) + 44);
      rayT = IntersectBVH_recurse( rayO, rayD, rayT, leftNode, ret );
      rayT = IntersectBVH_recurse( rayO, rayD, rayT, rightNode, ret );
    }
    return rayT;
}

function IntersectBVH(rayO: v128, rayD: v128, rayT: f32, node: BVHNode, ret: Ret): f32
{
  const stack = ret.stack;
  let stackPtr = 0;
  while(1) {
    const triCount = node.triCount;
    if (triCount > 0) {
      let triId = node.firstTriIdx;
      for (let i: u32 = 0; i < triCount; i++ ) {
        const tri = load<u32>(triId);
        rayT = IntersectTri( rayO, rayD, rayT, tri, ret);
        triId += 4;
      }
      if(stackPtr == 0) break; else {
        node = changetype<BVHNode>(load<u32>(stack + (--stackPtr)*4));
      }
    }
    let child1 = node.leftNode;
    let child2 = changetype<BVHNode>(changetype<u32>(node.leftNode) + 44);
    let dist1 = IntersectAABB( rayO, rayD, rayT, child1.aabbMin, child1.aabbMax );
    let dist2 = IntersectAABB( rayO, rayD, rayT, child2.aabbMin, child2.aabbMax);
    if(dist1 > dist2) { //swap
      let _t1: f32 = dist1; dist1 = dist2; dist2 = _t1;
      let _t2: BVHNode = child1; child1 = child2; child2 = _t2;
    }
    if (dist1 == 1e30)
		{
      if(stackPtr == 0) break; else {
        node = changetype<BVHNode>(load<u32>(stack + (--stackPtr)*4));
      }
		}
		else
		{
			node = child1;
			if (dist2 != 1e30) {
        store<u32>(stack + (stackPtr++)*4, changetype<u32>(child2))
      }
		}
  }
  return rayT;
}

const BINS: u32 = 8;

function INC_32(addr: u32): void {
  store<u32>(addr, load<u32>(addr)+1)
}
function V128_ARR(base: u32, offset: u32): v128 {
  return v128.load(base + offset * 16);
}
function V128_ARR_s(base: u32, offset: u32, v: v128): void {
  return v128.store(base + offset * 16, v);
}

function FindBestSplitPlane( node: BVHNode, centeroid: u32, ret: Ret): f32 {
  let bestCost:f32 = 1e30;
  
  const leftCountArea = ret.leftCountArea;
  const rightCountArea = ret.rightCountArea;

  const min4 = ret.BINS_min;
  const max4 = ret.BINS_max;
  const count = ret.binCount;

  let axis: u8 = 0;
  let splitPos: u8 = 0;
  for (let a: u8 = 0; a < 3; a++)
	{
    const boundsMin = load<f32>(centeroid + a*4);
    const boundsMax = load<f32>(centeroid + a*4, 16);
    let scale = f32(BINS) / (boundsMax - boundsMin);
    let leftSum: f32 = 0, rightSum: f32 = 0;

    memory.fill(ret.BINS_min, 0, 16 * BINS * 2 + BINS * 4);

    const triCount = node.triCount;
    let triId = node.firstTriIdx;
    for (let i: u32 = 0; i < triCount; i++ ) {
      const tri = load<u32>(triId);
      const binIdx = min(BINS -1, u32((Tri.c_p(tri, a) - boundsMin) * scale)) as u8;
      INC_32(count + binIdx*4); //count[binIdx]++;
      let _min4 = V128_ARR(min4, binIdx);
      let _max4 = V128_ARR(max4, binIdx);
      _min4 = MIN4(_min4, Tri.v0(tri), Tri.v1(tri), Tri.v2(tri));
      _max4 = MAX4(_max4, Tri.v0(tri), Tri.v1(tri), Tri.v2(tri));
      V128_ARR_s(min4, binIdx, _min4);
      V128_ARR_s(max4, binIdx, _max4);
    }
    let leftMin4: v128 = v128.splat<f32>(1e30), rightMin4 = leftMin4;
		let leftMax4: v128 = v128.splat<f32>(-1e30), rightMax4 = leftMax4;
    for (let i:u32 = 0; i < BINS - 1; i++)
		{
			leftSum += load<u32>(count+ i*4) as f32;
			rightSum += load<u32>(count+ (BINS - 1 - i)*4) as f32;
			leftMin4 = v128.min<f32>( leftMin4, V128_ARR(min4, i));
			rightMin4 = v128.min<f32>( rightMin4, V128_ARR(min4,BINS - 2 - i));
			leftMax4 = v128.max<f32>( leftMax4, V128_ARR(max4, i));
			rightMax4 = v128.max<f32>( rightMax4, V128_ARR(max4, BINS - 2 - i));
			const le = v128.sub<f32>(leftMax4, leftMin4 );
			const re = v128.sub<f32>( rightMax4, rightMin4 );

      const lc = v128.mul<f32>(le, v128.shuffle<f32>(le,le, 1,2,0,0)); 
      const rc = v128.mul<f32>(re, v128.shuffle<f32>(re,re, 1,2,0,0));
			store<f32>(leftCountArea + 4 * i, leftSum * (VX(lc)+VY(lc)+VZ(lc)));
			store<f32>(rightCountArea + 4 * (BINS - 2 - i), rightSum * (VX(rc)+VY(rc)+VZ(rc)));
		}
		// calculate SAH cost for the 7 planes
		scale = (boundsMax - boundsMin) / f32(BINS);
		for (let i: u8 = 0; i < BINS - 1; i++)
		{
			const planeCost = load<f32>(leftCountArea + 4*i) + load<f32>(rightCountArea + i * 4);
			if (planeCost < bestCost) {
				axis = a;
        splitPos = i + 1;
        bestCost = planeCost;
      }
		}
	}
  ret._u8_1 = axis;
  ret._u8_2 = splitPos;
	return bestCost;
}


export function BuildBVH(holder: Ret): void {
  const count = holder.count;
  const triangles = holder.triangles;
  const centroid_divider = v128.splat<f32>(1/3);
  for(let i:u32 = holder.count-1; i>0;i--) {
    move_Tri(triangles + i * 4 * 9, triangles + i * SIZE_TRI, centroid_divider);
  }
  move_Tri(triangles, triangles, centroid_divider);

  const bvh = changetype<BVHNode>(holder.bvh);
  const triIndex = holder.triIndex;
  bvh.leftNode = bvh;
  bvh.firstTriIdx = triIndex;
  bvh.triCount = count;

  const centeroid = holder.centeroid;
  UpdateNodeBounds(bvh, centeroid);
  holder._nodeUsed = holder.bvh + 44;
  Subdivide(bvh, centeroid, holder);
}
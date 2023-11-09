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

@unmanaged
class Ret {
  triangles: u32;
  triIndex: u32
  bvh: u32;
  stack: u32;
  centeroid: u32;
  hit: u32;
  count: u32;

  rayO: v128;
  rayD: v128;
  rayT: f32;
  constructor(){}
}

export function Create(numTriangles: u32): Ret {
  const ret = new Ret();
  ret.triangles = heap.alloc(SIZE_TRI * numTriangles) as u32;
  ret.triIndex = heap.alloc(4 * numTriangles) as u32;
  ret.bvh = heap.alloc(offsetof<BVHNode>() * 2 * numTriangles) as u32;
  ret.stack = heap.alloc(4 * 128) as u32;
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
  heap.free(changetype<u32>(ptr));
}



function IntersectTri( tri: u32, ret: Ret): void {
  const rayD = ret.rayD;
  const edge1 = v128.sub<f32>(Tri.v1(tri), Tri.v0(tri));
  const edge2 = v128.sub<f32>(Tri.v2(tri), Tri.v0(tri));
  const h = VectorMath.cross_128(rayD, edge2);
  const a: f32 = VectorMath.dot_128(edge1, h);
  if (a > -0.0001 && a < 0.0001) return; // ray parallel to triangle

  const rayO = ret.rayO;
  const f: f32 = 1 / a;
  const s = v128.sub<f32>(rayO, Tri.v0(tri));
  const u = f * VectorMath.dot_128(s, h);
  if (u < 0 || u > 1) return;
  const q = VectorMath.cross_128(s, edge1);
  const v = f * VectorMath.dot_128(rayD, q);
  if (v < 0 || u + v > 1) return;
  const t = f * VectorMath.dot_128(edge2, q);
  if (t > 0.0001) {
    if (t < ret.rayT) {
      ret.hit = tri;
      ret.rayT = t;
      return;
    }
  }
  return;
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

  const d10 = v128.sub<f32>(p1, p0);
  const d20 = v128.sub<f32>(p2, p0);
  for (let y: u32 = 0; y < height; y++) {
    for (let x: u32 = 0; x < width; x++) {
      const pixPos = v128.add<f32>(p0, v128.add<f32>(
        v128.mul<f32>(
          d10,
          v128.splat<f32>((x as f32) / (width as f32))
        ),
        v128.mul<f32>(
          d20,
          v128.splat<f32>((y as f32) / (height as f32))
        )));

      ret.rayT = 1e30;
      ret.rayO = cam;
      ret.rayD = VectorMath.normalize_128(v128.sub<f32>(pixPos, cam));

      IntersectBVH(changetype<BVHNode>(ret.bvh), ret);
      const out_idx = x + y * width;
      const t = ret.rayT;
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

  static NodeCost(i: u32, triCount: u32): f32 {
    const node = changetype<BVHNode>(i);
    const e = v128.sub<f32>(node.aabbMax,node.aabbMin);
    const e2 = v128.mul<f32>(v128.shuffle<f32>(e,e,1,2,0,0),e);
    return (VX(e2)+VY(e2)+VZ(e2)) * triCount;
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
    min4 = MIN4(min4, Tri.v0(tri), Tri.v1(tri), Tri.v2(tri));
    max4 = MAX4(max4, Tri.v0(tri), Tri.v1(tri), Tri.v2(tri)); 
		cmin4 = v128.min<f32>( cmin4, Tri.c(tri) );
		cmax4 = v128.max<f32>( cmax4, Tri.c(tri) );
  }
  node.aabbMin = min4;
  node.aabbMax = max4;
  v128.store(centroid, cmin4);
  v128.store(centroid, cmax4, 16);
}

let nodesUsed: u32 = 0;
function Subdivide(node: BVHNode, centroid: u32): void {
  if (node.triCount <= 2)
    return;

  // determine split axis and position
  const aabbMin = node.aabbMin;
  const extent = v128.sub<f32>(node.aabbMax, aabbMin);
  let axis:u8 = 0;
  let extentY = VY(extent);
  let extentZ = VZ(extent);
  let _extent = VX(extent);

  if (extentY > _extent) { axis = 1; _extent = extentY; }
  if (extentZ > _extent) { axis = 2; _extent = extentZ; }
  const splitPos = node.aabbMin_p(axis) + _extent * 0.5;

  // in-place partition
  const firstTriIdx = node.firstTriIdx;
  const triCount = node.triCount
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
  if (leftCount == 0 || leftCount == triCount) return;
  // create child nodes
  const leftChild = changetype<BVHNode>(nodesUsed);nodesUsed += offsetof<BVHNode>();
  const rightChild = changetype<BVHNode>(nodesUsed);nodesUsed += offsetof<BVHNode>();

  leftChild.firstTriIdx = firstTriIdx;
  leftChild.triCount = leftCount;

  rightChild.firstTriIdx = i;
  rightChild.triCount = triCount - leftCount;

  node.leftNode = leftChild;
  node.triCount = 0;

  UpdateNodeBounds(leftChild, centroid);
  UpdateNodeBounds(rightChild, centroid);

  // recurse
  Subdivide(leftChild, centroid);
  return Subdivide(rightChild, centroid);
}

function IntersectAABB_SSE(ret: Ret, bmin: v128, bmax: v128 ): f32 {
    const rayO = ret.rayO;
    const rayD = ret.rayD;
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
    return (_max >= _min && _min < ret.rayT && _max > 0)? _min: 1e30;
}


function IntersectAABB( ret: Ret, bmin: u32, bmax: u32 ): f32 {
  const bmin_x = load<f32>(bmin)
  const bmin_y = load<f32>(bmin+4)
  const bmin_z = load<f32>(bmin+8)
  const bmax_x = load<f32>(bmax)
  const bmax_y = load<f32>(bmax+4)
  const bmax_z = load<f32>(bmax+8)

  const ray_O = changetype<u32>(ret)+offsetof<Ret>('rayO');
  const ray_D = changetype<u32>(ret)+offsetof<Ret>('rayD');

  const ray_O_x = load<f32>(ray_O)
  const ray_O_y = load<f32>(ray_O+4)
  const ray_O_z = load<f32>(ray_O+8)
  const ray_D_x = load<f32>(ray_D)
  const ray_D_y = load<f32>(ray_D+4)
  const ray_D_z = load<f32>(ray_D+8)

    const tx1 = (bmin_x - ray_O_x) / ray_D_x, tx2 = (bmax_x - ray_O_x) / ray_D_x;
    let tmin = min( tx1, tx2 ), tmax = max( tx1, tx2 );
    const ty1 = (bmin_y - ray_O_y) / ray_D_y, ty2 = (bmax_y - ray_O_y) / ray_D_y;
    tmin = max( tmin, min( ty1, ty2 ) ), tmax = min( tmax, max( ty1, ty2 ) );
    const tz1 = (bmin_z - ray_O_z) / ray_D_z, tz2 = (bmax_z - ray_O_z) / ray_D_z;
    tmin = max( tmin, min( tz1, tz2 ) ), tmax = min( tmax, max( tz1, tz2 ) );
    if (tmax >= tmin && tmin < ret.rayT && tmax > 0) return tmin; else return 1e30;
}

function IntersectBVH_recurse( node: BVHNode, ret: Ret): void
{
  const aabbMin = node.aabbMin;
  const aabbMax = node.aabbMax;
    if (IntersectAABB_SSE( ret, aabbMin, aabbMax ) == 1e30) return;
    const triCount = node.triCount;
    if (triCount > 0)
    {
        let triId = node.firstTriIdx;
        for (let i: u32 = 0; i < triCount; i++ ) {
          const tri = load<u32>(triId);
          IntersectTri(tri, ret );
          triId += 4;
        }
    }
    else
    {
      const leftNode = node.leftNode;
      const rightNode = changetype<BVHNode>(changetype<u32>(leftNode) + offsetof<BVHNode>());
      IntersectBVH_recurse( leftNode, ret );
      IntersectBVH_recurse( rightNode, ret );
    }
    return;
}

function IntersectBVH(node: BVHNode, ret: Ret): void
{
  const stack = ret.stack;
  let stackPtr = 0;
  while(1) {
    const triCount = node.triCount;
    if (triCount > 0) {
      let triId = node.firstTriIdx;
      for (let i: u32 = 0; i < triCount; i++ ) {
        const tri = load<u32>(triId);
        IntersectTri(tri, ret);
        triId += sizeof<usize>();
      }
      if(stackPtr == 0) {
        break;
      }  else {
        stackPtr -= 4;
        node = changetype<BVHNode>(load<u32>(stack + stackPtr));
      }
      continue;
    }
    let child1 = node.leftNode;
    let child1_ptr = changetype<u32>(node.leftNode);
    let child2_ptr = child1_ptr + offsetof<BVHNode>()
    let child2 = changetype<BVHNode>(child2_ptr);
    let dist1 = IntersectAABB_SSE( ret, child1.aabbMin, child1.aabbMax );
    let dist2 = IntersectAABB_SSE( ret, child2.aabbMin, child2.aabbMax);

    if(dist1 > dist2) { //swap
      let _t1: f32 = dist1; dist1 = dist2; dist2 = _t1;
      let _t2: BVHNode = child1; child1 = child2; child2 = _t2;
    }
    if (dist1 == 1e30)
		{
      if(stackPtr == 0) {
        break; 
      } else {
        stackPtr -= 4;
        node = changetype<BVHNode>(load<u32>(stack + stackPtr));
      }
		}
		else
		{
			node = child1;
			if (dist2 < 1e30) {
        store<u32>(stack + stackPtr, changetype<u32>(child2));
        stackPtr +=4;
      }
		}
  }
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
  nodesUsed = holder.bvh + offsetof<BVHNode>();
  Subdivide(bvh, centeroid);
}
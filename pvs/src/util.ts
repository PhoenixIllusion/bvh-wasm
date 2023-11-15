import { edge_edge_intersect, vec2_equal, edge_calc_normal, closest_ray_intersection, deg_angle_between, vec2_clone, edge_length, nearest_point_on_line } from "./math/intersect";
import { Edge, vec2 } from "./models/edge";

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const context2D = canvas.getContext('2d')!;


export function line2d(p0: [number,number], p1: [number,number], color: string, width: number = 2) {
  context2D.lineWidth = width;
  context2D.strokeStyle = color;
  context2D.beginPath();
  context2D.moveTo(p0[0], p0[1]);
  context2D.lineTo(p1[0], p1[1]);
  context2D.stroke();
}

export function splitEdgesIfNeeded(edges: Edge[]) {
  const out: vec2 = [0,0];
  for(let i=0;i< edges.length;i++) {
    for(let j=0;j< edges.length; j++) {
      if(i !== j) {
        const e0 = edges[i];
        const e1 = edges[j];
        if(edge_edge_intersect(out, e0, e1)) {
          if(!(vec2_equal(e1.p0, out)||vec2_equal(e1.p1, out))) {
            const new_p = { p0: [out[0],out[1]] as vec2, p1: e1.p1, id: e1.id}
            e1.p1 = [out[0],out[1]];
            edges.push({... new_p,  n: edge_calc_normal(new_p.p0, new_p.p1)});
          }
        }
      }
    }
  }
}


const key = (p:vec2) => `${p[0]},${p[1]}`;

type EdgeHash = [Record<string, Edge[]>,Record<string, Edge[]>];
export function hashEdges(edges: Edge[]): EdgeHash {
  const ret: EdgeHash = [{},{}];
  edges.forEach(e => {
    [e.p0, e.p1].forEach( (p,i) => {
      const k = key(p);
      ret[i][k] = ret[i][k]||[];
      ret[i][k].push(e);
    })
  })
  return ret;
}
export function removeExcessEdges(edges: Edge[], hash: EdgeHash) {
  const toRemove: Edge[] = [];
  edges.forEach(e => {
    const p0_key = key(e.p0);
    const p1_key = key(e.p1);
    const rev_p0 = hash[0][p1_key];
    const rev_p1 = hash[1][p0_key];
    const shared = rev_p0.filter(p => rev_p1.find(x => x === p));
    if(shared[0]) {
      toRemove.push(e, shared[0]);
    }
  });
  toRemove.forEach( e => {
    const idx = edges.indexOf(e);
    if(idx >=0) {
      edges.splice(idx, 1);
    }
  })
}

export function selectColor(number: number) {
  const hue = number * 137.508; // use golden angle approximation
  return `hsl(${hue},50%,75%)`;
}



export function rayFromEdge(edge0: Edge, edge1: Edge, edges: Edge[]): Edge[] {
  const closest: vec2 = [0,0];
  const line_out: Edge[] = [];
  if(deg_angle_between(edge0, edge1) < 0) {
    const ret: Edge[] = [];
    if(closest_ray_intersection(closest, edge0, edges, line_out)) {
      const p0 = vec2_clone(edge0.p1);
      const p1 = vec2_clone(nearest_point_on_line(edge0.p1, line_out[0]));
      const n = edge_calc_normal(p0, p1);
      const e = {p0,p1,n, id: -1};
      ret.push(e);
    }
    {
      //mid Ray
      const p0 = vec2_clone(edge1.p0);
      const dXY = [(edge0.n[0]+edge1.n[0])/2,(edge0.n[1]+edge1.n[1])/2];
      const p1: vec2 = [p0[0]+dXY[0]/100, p0[1]+dXY[1]/100];
      const n = edge_calc_normal(p0, p1);
      const e = {p0, p1, n, id: -1};
      if(closest_ray_intersection(closest, e, edges, line_out)) {
        e.p1 = vec2_clone(nearest_point_on_line(edge0.p1, line_out[0]));
        e.n = edge_calc_normal(e.p0, e.p1);
        ret.push(e);
      }
    }
    if(closest_ray_intersection(closest, {p0: edge1.p1, p1: edge1.p0, n: edge1.n, id: edge1.id}, edges, line_out)) {
      const p0 = vec2_clone(edge1.p0);
      const p1 = vec2_clone(nearest_point_on_line(edge0.p1, line_out[0]));
      const n = edge_calc_normal(p0, p1);
      const e = {p0,p1,n, id: -1};
      ret.push(e);
    }
    const shortest = ret.sort((a,b)=> edge_length(a)-edge_length(b))[0];
    return shortest ? [shortest]:[];
  }
  return [];
}

function is_corner(p: vec2, edgeHash: EdgeHash): boolean {
  const k = key(p);
  return edgeHash[0][k]!=undefined && edgeHash[1][k]!=undefined;
}

function processPortalEdges(portals: Edge[], edgeHash: EdgeHash): void {
  const portal_hash: Record<string,Edge[]> = {};
  const corners: Record<string, boolean> = {};
  portals.forEach(e => {
    const k0 = key(e.p0);
    const k1 = key(e.p1);
    corners[k0] = is_corner(e.p0, edgeHash);
    corners[k1] = is_corner(e.p1, edgeHash);
    portal_hash[k0] = portal_hash[k0]||[];
    portal_hash[k1] = portal_hash[k1]||[];
    portal_hash[k0].push(e);
    portal_hash[k1].push(e);
  });
  const toRemove: Edge[] = [];
  Object.entries(portal_hash).forEach(([k, lines]) => {
    if(corners[k] && lines.length > 0) {
      const non_corner = lines.filter(l => !(corners[key(l.p0)] && corners[key(l.p1)]));
      if(non_corner.length == lines.length) {
        const shortest = lines.sort((a,b)=> edge_length(a)-edge_length(b))[0];
        toRemove.push(... lines.filter(l => l!=shortest));
      } else {
        toRemove.push(... non_corner);
      }
    }
  });
  toRemove.forEach( e => {
    const idx = portals.indexOf(e);
    if(idx >=0) {
      portals.splice(idx, 1);
    }
  })
}

export function generatePotentialPortals(edges: Edge[], hash: EdgeHash): Edge[] {
  const ret: Edge[] = [];
  edges.forEach(e => {
    const edge = hash[0][key(e.p1)].sort((a,b)=> deg_angle_between(e,b)-deg_angle_between(e,a))[0];
    if(edge) {
      ret.push(... rayFromEdge(e, edge, edges));
    }
  });
  processPortalEdges(ret, hash);
  return ret;
}

export { context2D }
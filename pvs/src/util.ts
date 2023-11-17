import { vec2_equal, edge_calc_normal, closest_ray_intersection, deg_angle_between, vec2_clone, edge_length, nearest_point_on_line, dist_vec2_to_Edge } from "./math/intersect";
import { Edge, vec2 } from "./models/edge";
import { PortalEdge, Cell, CellEdge } from "./models/portal-cells";

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const context2D = canvas.getContext('2d')!;

const DRAW_OFF_X = 10;
const DRAW_OFF_Y = 10;

export function line2d(p0: [number,number], p1: [number,number], color: string, width: number = 2) {
  context2D.lineWidth = width;
  context2D.strokeStyle = color;
  context2D.beginPath();
  context2D.moveTo(p0[0]+DRAW_OFF_X, p0[1]+DRAW_OFF_Y);
  context2D.lineTo(p1[0]+DRAW_OFF_X, p1[1]+DRAW_OFF_Y);
  context2D.stroke();
}

export function cell2d(cell: Edge[], color: string) {
  /*
  console.log(cell[0].id, cell_wind_diretion(cell));
  if(cell_wind_diretion(cell)) {
    color = 'red';
  } else {
    color = 'blue';
  }
  */
  context2D.lineWidth = 1;
  context2D.fillStyle = color;
  const region = new Path2D();
  const start = cell[0].p0;
  region.moveTo(start[0]+DRAW_OFF_X, start[1]+DRAW_OFF_Y);
  cell.forEach(line => {
    const xy = line.p1;
    region.lineTo(xy[0]+DRAW_OFF_X,xy[1]+DRAW_OFF_Y);
  });
  region.closePath();
  context2D.fill(region);
}

function splitEdgesIfNeeded(edges: Edge[], additionalEdges: Edge[] = []) {
  for(let i=0;i< edges.length + additionalEdges.length;i++) {
    const e0 = edges[i] || additionalEdges[i-edges.length]
    for(let j=0;j< edges.length; j++) {
      if(i !== j) {
        const e1 = edges[j];
        [e0.p1, e0.p0].forEach( p => {
          const dist = dist_vec2_to_Edge(e1.p0[0], e1.p0[1], e1.p1[0],e1.p1[1], p[0],p[1]);
          if(dist < 0.01) {
            if(!(vec2_equal(e1.p0, p)||vec2_equal(e1.p1, p))) {
              const new_p = { p0: [p[0],p[1]] as vec2, p1: e1.p1, id: e1.id}
              e1.p1 = [p[0],p[1]];
              edges.push({... new_p,  n: edge_calc_normal(new_p.p0, new_p.p1)});
            }
          }
        });
      }
    }
  }
}


const key = (p:vec2) => `${p[0]},${p[1]}`;

type EdgeHash = [Record<string, Edge[]>,Record<string, Edge[]>];
function hashEdges(edges: Edge[]): EdgeHash {
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
function removeExcessEdges(edges: Edge[], hash: EdgeHash) {
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
function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
export function get_random_color() {
  var h = rand(1, 360);
  var s = rand(90, 100);
  var l = rand(50, 100);
  return 'hsl(' + h + ',' + s + '%,' + l + '%)';
}
export function selectColor(number: number) {
  const hue = number * 65; // use golden angle approximation
  const sat = number / 8 + 50;
  return `hsl(${hue},${sat}%,75%)`;
}



function rayFromEdge(edge0: Edge, edge1: Edge, edges: Edge[]): Edge[] {
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

function generatePotentialPortals(edges: Edge[], hash: EdgeHash): PortalEdge[] {
  const portals: Edge[] = [];
  edges.forEach(e => {
    const edge = hash[0][key(e.p1)].sort((a,b)=> deg_angle_between(e,b)-deg_angle_between(e,a))[0];
    if(edge) {
      portals.push(... rayFromEdge(e, edge, edges));
    }
  });
  processPortalEdges(portals, hash);
  const portal_edges: Record<string, boolean> = {};
  const ret: PortalEdge[] = [];
  portals.forEach( e => {
    const k_0_1 = key(e.p0)+"_"+key(e.p1);
    const k_1_0 = key(e.p1)+"_"+key(e.p0);
    if(!portal_edges[k_0_1] && !portal_edges[k_1_0]) {
      const pe = e as PortalEdge;
      const inv: PortalEdge = { p0: vec2_clone(e.p1), p1: vec2_clone(e.p0), id: -1, n: [ -e.n[0], -e.n[1]], pair_edge: pe};
      portal_edges[k_1_0] = true;
      portal_edges[k_0_1] = true;
      pe.pair_edge  = inv;
      ret.push(pe, inv);
    }
  })
  return ret;
}

function generateCells(edges: Edge[]): Cell[] {
  const portalHash = hashEdges(edges);
  const cells: Cell[] = [];
  const edgeFilter = (e: Edge) => {
    return (x: Edge) => {
      return !(vec2_equal(e.p0,x.p1) && vec2_equal(e.p1, x.p0))
    }
  }
  const nextEdge = (e: Edge) => {
    const allEdges = portalHash[0][key(e.p1)];
    const potentialEdges = allEdges.filter(edgeFilter(e));
    const closest = potentialEdges.sort((a,b)=> deg_angle_between(e,b)-deg_angle_between(e,a))[0]
    return closest;
  }
  let cellId = 0;
  edges.forEach(e => e.id = -1);
  edges.forEach(e => {
    if(e.id == -1) {
      const id = cellId++;
      const cell: CellEdge[] = [];
      let nE = nextEdge(e) as CellEdge;
      cell.push(nE);
      while(nE != undefined && (nE = nextEdge(nE) as CellEdge)) {
        cell.push(nE);
        if(nE == e) {
          break;
        }
      }
      cell.forEach( ce => { ce.cell = cell, ce.id = id});
      cells.push(cell);
    }
  });
  return cells;
}

function min_max_edges(edges: Edge[]) {
  const min: vec2 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: vec2 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  
  edges.forEach(e => {
    min[0] = Math.min(min[0], e.p0[0]);
    min[1] = Math.min(min[1], e.p0[1]);
    max[0] = Math.max(max[0], e.p0[0]);
    max[1] = Math.max(max[1], e.p0[1]);
  });
  return { min, max};
}

function find_exterior_cell(cells: Cell[], min_max: {min: vec2, max: vec2}) {
  for(let i=0;i<cells.length;i++) {
    const cell = cells[i];
    for(let j=0;j<cell.length;j++) {
      const edge=cell[j];
      if(edge.p0[0] == min_max.min[0] || edge.p0[0] == min_max.max[0] || edge.p0[1] == min_max.min[1] || edge.p0[1] == min_max.max[1]) {
        cell.forEach(l => l.id = -1);
        return;
      }
    }
  }
}

export function buildPortals(edges: Edge[]): Cell[] {
  splitEdgesIfNeeded(edges);
  const hash = hashEdges(edges);
  removeExcessEdges(edges, hash);
  const portals = generatePotentialPortals(edges, hash);
  splitEdgesIfNeeded(edges, portals);
  const cells = generateCells([... edges, ... portals]);
  const min_max = min_max_edges(edges);
  find_exterior_cell(cells, min_max);
  return cells;
}

export { context2D }
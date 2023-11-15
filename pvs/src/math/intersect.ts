import { Edge, vec2 } from "../models/edge";

export function line_intersects(out: [number, number], p0_x: number, p0_y: number, p1_x: number, p1_y: number,
  p2_x: number, p2_y: number, p3_x: number, p3_y: number, r_out: number[] = []) {

  const ax = p1_x - p0_x;
  const ay = p1_y - p0_y;
  const bx = p3_x - p2_x;
  const by = p3_y - p2_y;

  const dx = p0_x - p2_x;
  const dy = p0_y - p2_y;

  const det = (-bx * ay + ax * by);

  if (det == 0) return false;

  const r = (bx * dy - by * dx) / det;
  const s = (ax * dy - ay * dx) / det;

  if (s >= 0 && s <= 1 && r >= 0 && (r <= 1)) {
    // Collision detected
    out[0] = p0_x + r*ax;
    out[1] = p0_y + r*ay;
    r_out[0] = r;
    return true;
  }

  return false; // No collision
}

function findNearestPointOnLine(px: number, py: number, ax: number, ay: number, bx: number, by: number)
{
    const atob = { x: bx - ax, y: by - ay };
    const atop = { x: px - ax, y: py - ay };
    const len = (atob.x * atob.x) + (atob.y * atob.y);
    let dot = (atop.x * atob.x) + (atop.y * atob.y);
    const t = Math.min(1, Math.max(0, dot / len));

    dot = ((bx - ax) * (py - ay)) - ((by - ay) * (px - ax));

    return { x: ax + (atob.x * t), y: ay + (atob.y * t) };
}

export function edge_edge_intersect(out: [number, number], edge0: Edge, edge1: Edge, r_out: number[] = []): boolean {
  return line_intersects(out, edge0.p0[0], edge0.p0[1],
    edge0.p1[0], edge0.p1[1],
    edge1.p0[0], edge1.p0[1],
    edge1.p1[0], edge1.p1[1], r_out)
}

function angle_between(a: Edge, b: Edge) {
  return Math.atan2(a.n[1],a.n[0])-Math.atan2(b.n[1],b.n[0]);
}
export function deg_angle_between(a: Edge, b: Edge): number {
  const ret = angle_between(a,b) * 180/ Math.PI;
  if(ret > 180) return ret - 360;
  if(ret < -180) return ret + 360;
  return ret;
}


export function vec2_equal(a: vec2, b: vec2): boolean {
  return a[0] == b[0] && a[1] == b[1];
}

export function vec2_average(a: vec2, b: vec2): vec2 {
  return [(a[0]+b[0])/2, (a[1]+b[1])/2];
}

export function edge_length(e: Edge) {
  const dx = e.p1[0] - e.p0[0];
  const dy = e.p1[1] - e.p0[1];
  return Math.sqrt(dx*dx+dy*dy);
}

export function edge_calc_normal(a: vec2, b: vec2): vec2 {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.sqrt(dx*dx+dy*dy);
  return [dy/len, -dx/len]
}

export function vec2_clone(a: vec2): vec2 {
  return [a[0],a[1]];
}

export function nearest_point_on_line(point: vec2, line: Edge): vec2 {
  const res = findNearestPointOnLine(point[0],point[1], line.p0[0], line.p0[1], line.p1[0], line.p1[1])
  return [res.x, res.y]
}

export function closest_ray_intersection(out: [number, number], ray0: Edge, edges: Edge[], line_out: Edge[]=[]) {
  let min = Number.POSITIVE_INFINITY;
  const r = [0];
  const tmp_out: vec2 = [0,0];
  edges.forEach(e => {
    if(e != ray0) {
      const dx = ray0.p1[0] - ray0.p0[0];
      const dy = ray0.p1[1] - ray0.p0[1];
      const ray: Edge = {
        p0: vec2_clone(ray0.p1),
        p1: [ray0.p1[0]+dx*1e30, ray0.p1[1]+dy*1e30],
        n: ray0.n,
        id: -1
      }
      if(edge_edge_intersect(tmp_out, ray, e, r)) {
        if(r[0] > 0 && r[0] < min) {
          min = r[0];
          out[0] = tmp_out[0];
          out[1] = tmp_out[1];
          line_out[0] = e;
        }
      }
    }
  })
  return min < Number.POSITIVE_INFINITY;
}

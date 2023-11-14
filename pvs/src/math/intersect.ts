import { Edge } from "../models/edge";

export function line_intersects(out: [number, number], p0_x: number, p0_y: number, p1_x: number, p1_y: number,
  p2_x: number, p2_y: number, p3_x: number, p3_y: number) {

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

  if (s >= 0 && s <= 1 && r >= 0 && r <= 1) {
    // Collision detected
    out[0] = p0_x + r*ax;
    out[1] = p0_y + r*ay;
    return true;
  }

  return false; // No collision
}
export function edge_edge_intersect(out: [number, number], edge0: Edge, edge1: Edge): boolean {
  return line_intersects(out, edge0.p0[0], edge0.p0[1],
    edge0.p1[0], edge0.p1[1],
    edge1.p0[0], edge1.p0[1],
    edge1.p1[0], edge1.p1[1])
}
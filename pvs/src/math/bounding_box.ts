import { BoundingBox } from "../models/bounding_box";
import { vec2 } from "../models/edge";

function bounding_box_vec2_intersect(a: vec2, b: BoundingBox): boolean {
  return b.min[0] <= a[0] && b.max[0] >= a[0] && b.min[1] <= a[1] && b.max[1] <= a[1];
}

export function bounding_box_intersect(a: BoundingBox, b: BoundingBox): boolean {
  return bounding_box_vec2_intersect(a.min, b) || bounding_box_vec2_intersect(a.max, b) ||
    bounding_box_vec2_intersect(b.min, a) || bounding_box_vec2_intersect(b.max, a);
}
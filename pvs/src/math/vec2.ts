import { vec2 } from "../models/edge";

const EPSILON = 1e-6;

export function vec2_add(a: vec2, b: vec2): vec2 {
  return [a[0]+b[0],a[1]+b[1]];
}
export function vec2_sub(a: vec2, b: vec2): vec2 {
  return [a[0]-b[0],a[1]-b[1]];
}
export function vec2_clone(a: vec2): vec2 {
  return [a[0],a[1]];
}

export function vec2_equal(a: vec2, b: vec2): boolean {
  return Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON;
}

export function vec2_dot(a: vec2, b: vec2): number
{
  return a[0] * b[0] + a[1] * b[1];
}

export function vec2_average(a: vec2, b: vec2): vec2 {
  return [(a[0]+b[0])/2, (a[1]+b[1])/2];
}

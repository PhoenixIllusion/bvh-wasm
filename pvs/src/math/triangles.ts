import { vec2 } from "../models/edge";
import { vec2_dot, vec2_sub } from "./vec2";


type B_Triangle = {
  a: vec2;
  v0: vec2;
  v1: vec2;
  invDenom: number;
  d00: number;
  d01: number;
  d11: number;
  triangle_id: number;
}

export function wind_order(a: vec2, b: vec2, c: vec2): boolean {
  const v0 = vec2_sub(b, a);
  const v1 = vec2_sub(c, a);

  return (-v1[0] * v0[1] + v0[0] * v1[1]) < 0;
}

export function triangle_to_barycenteric(a: vec2, b: vec2, c: vec2, id: number, out: number[]) {
  out.push(a[0]);
  out.push(a[1]);
  const v0 = vec2_sub(b, a);
  out.push(v0[0]);
  out.push(v0[1]);
  const v1 = vec2_sub(c, a);
  out.push(v1[0]);
  out.push(v1[1]);

  const d00 =  vec2_dot(v0, v0);
  const d01 = vec2_dot(v0, v1);
  const d11 = vec2_dot(v1, v1);
  const invDenom = 1.0 / (d00 * d11 - d01 * d01);
  out.push(invDenom);
  out.push(d00);
  out.push(d01);
  out.push(d11);
  out.push(id);
}

export function check_b_triangle( x: number, y: number, buffer: Float32Array, i: number): number {
  const v2_x = x - buffer[i++];
  const v2_y = y - buffer[i++];

  const d20 = v2_x * buffer[i++] + v2_y * buffer[i++];
  const d21 = v2_x * buffer[i++] + v2_y * buffer[i++];
  const invDenom = buffer[i++];
  const d00 = buffer[i++];
  const d01 = buffer[i++];

  const u = (d00*d21 - d01*d20) * invDenom;
  if( u < 0) return -1;

  const d11 = buffer[i++];
  const v = (d11*d20 - d01*d21) * invDenom;

  if( v < 0 || (u+v) > 1) return -1;

  return buffer[i++];
}

export function Barycentric( A: vec2, B: vec2, C: vec2, P: vec2)
{
    const v0 = vec2_sub(B, A);
    const v1 = vec2_sub(C, A);

    const d00 = vec2_dot(v0, v0);
    const d01 = vec2_dot(v0, v1);
    const d11 = vec2_dot(v1, v1);


    const v2 = vec2_sub(P, A);
    const d21 = vec2_dot(v2, v1);
    const d20 = vec2_dot(v2, v0);

    const invDenom = 1/(d11*d00 - d01*d01);
    const u = (d00*d21 - d01*d20) * invDenom
    const v = (d11*d20 - d01*d21) * invDenom
    
    return { u,v };
}

export function BarycentricVals( A: vec2, B: vec2, C: vec2)
{
    const v0 = vec2_sub(B, A);
    const v1 = vec2_sub(C, A);

    const d00 = vec2_dot(v0, v0);
    const d01 = vec2_dot(v0, v1);
    const d11 = vec2_dot(v1, v1);
    const invDenom = 1/(d11*d00 - d01*d01);

    
    return {a: A, v0, v1, d00, d01, d11, invDenom };
}


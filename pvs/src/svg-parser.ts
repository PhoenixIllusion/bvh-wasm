import { Edge } from "./models/edge";

type vec2 = [number, number];

function edgesFromRect(rect: SVGRectElement): Edge[] {
  const v = (v: SVGAnimatedLength) => v.baseVal.value;
  const toEdge = (a: SVGPoint, b: SVGPoint): Edge => ({p0: [a.x, a.y], p1: [b.x, b.y]});
  const svg = rect.ownerSVGElement!;
  const p = (x: number, y: number) => { const p = svg.createSVGPoint(); p.x = x; p.y = y; return p; }
  const x = v(rect.x);
  const y = v(rect.y);
  const w = v(rect.width);
  const h = v(rect.height);
  let p0 = p(x,y);
  let p1 = p(x+w, y);
  let p2 = p(x+w, y+h);
  let p3 = p(x, y+h);
  const transform = rect.transform.baseVal.consolidate();
  if(transform) {
    p0 = p0.matrixTransform(transform.matrix);
    p1 = p1.matrixTransform(transform.matrix);
    p2 = p2.matrixTransform(transform.matrix);
    p3 = p3.matrixTransform(transform.matrix);
  }
  return [
    toEdge(p0, p1),
    toEdge(p1, p2),
    toEdge(p2, p3),
    toEdge(p3, p0)
  ]
}

export async function importSVG(url: string): Promise<Edge[]> {
  const out: Edge[] = [];
  const parser = new DOMParser();
  const svg = parser.parseFromString(await fetch(url).then(res => res.text()), "image/svg+xml");
  Array.from(svg.querySelectorAll('rect')).forEach(rect => {
    out.push(... edgesFromRect(rect));
  });
  return out;
}

import { Edge, vec2 } from './models/edge';
import { importSVG } from './svg-parser';
import { line2d, splitEdgesIfNeeded, hashEdges, removeExcessEdges, generatePotentialPortals } from './util';


function drawNormal(e: Edge) {
  const midX = (e.p0[0]+e.p1[0])/2
  const midY = (e.p0[1]+e.p1[1])/2

  const DELTA = 10;
  const p0: vec2 = [midX, midY];
  const p1: vec2 = [midX+e.n[0]*DELTA, midY+e.n[1]*DELTA];
  line2d(p0, p1, 'green');
}

const edges = await importSVG('simple-002.svg');
splitEdgesIfNeeded(edges);
const hash = hashEdges(edges);
removeExcessEdges(edges, hash);

const portals = generatePotentialPortals(edges, hash);

edges.forEach(e => {
  line2d(e.p0, e.p1, 'black');
  drawNormal(e);
})
portals.forEach(e => {
  line2d(e.p0, e.p1, 'cyan');
  drawNormal(e);
})

console.log(edges);
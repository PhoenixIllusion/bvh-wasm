
import { Edge, vec2 } from './models/edge';
import { importSVG } from './svg-parser';
import { buildPortals, cell2d, context2D, get_random_color, line2d, selectColor } from './util';


function drawNormal(e: Edge) {
  const midX = (e.p0[0]+e.p1[0])/2
  const midY = (e.p0[1]+e.p1[1])/2

  const DELTA = 10;
  const p0: vec2 = [midX, midY];
  const p1: vec2 = [midX+e.n[0]*DELTA, midY+e.n[1]*DELTA];
  line2d(p0, p1, 'green');
}

const { edges, portals, cells } = buildPortals(await importSVG('test-005.svg'));

cells.sort((a,b) => a[0].id - b[0].id).forEach((cell,i) => {
  if(cell[0].id !== -1) {
    cell2d(cell, get_random_color());
  } else {
    cell2d(cell, '#FF00FF');
  }
})
context2D.fillStyle='transparent'
edges.forEach(e => {
  line2d(e.p0, e.p1, 'black');
  drawNormal(e);
})
portals.forEach(e => {
  line2d(e.p0, e.p1, 'cyan');
  drawNormal(e);
})


console.log({edges,portals, cells});
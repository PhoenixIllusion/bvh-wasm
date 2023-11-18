
import { load_cells } from './math/triangle-hash';
import { Edge, vec2 } from './models/edge';
import { PortalCellJson, cellsToJSON } from './models/json';
import { importSVG } from './svg-parser';
import { PortalEdge, buildPortals, cell2d, context2D, get_random_color, line2d } from './util';


function drawNormal(e: Edge) {
  const midX = (e.p0[0]+e.p1[0])/2
  const midY = (e.p0[1]+e.p1[1])/2

  const DELTA = 10;
  const p0: vec2 = [midX, midY];
  const p1: vec2 = [midX+e.n[0]*DELTA, midY+e.n[1]*DELTA];
  line2d(p0, p1, 'green');
}

const cells = buildPortals(await importSVG('test-005.svg'));

cells.sort((a,b) => a[0].id - b[0].id).forEach((cell,i) => {
  if(cell[0].id !== -1) {
    cell2d(cell, get_random_color());
  } else {
    cell2d(cell, '#FF00FF');
  }
})
context2D.fillStyle='transparent';

cells.forEach(cell => {
  cell.forEach( e => {
    const edge: Edge|PortalEdge = e;
    if((edge as PortalEdge)?.pair_edge) {
      line2d(e.p0, e.p1, 'cyan');
    } else {
      line2d(e.p0, e.p1, 'black');
    }
    drawNormal(e);
  })
})

const textArea = document.querySelector('textarea')!;
textArea.value = cellsToJSON(cells);

import { load_cells, test_cells } from './math/triangle-hash';
import { Barycentric, Barycentric2, Barycentric3, wind_order } from './math/triangles';
import { vec2 } from './models/edge';
import { PortalCellJson } from './models/json';
import { context2D, line2d } from './util';

const json = (await fetch('test-005.json').then(res => res.json())) as PortalCellJson.JSON;
const cells = load_cells(json);

const WIDTH = 660;
const HEIGHT = 520;

const img = context2D.createImageData(WIDTH,HEIGHT);

const colors: number[] = [];
for(let i=0;i<64;i++) {
  colors.push(Math.floor(Math.random() * 16777215))
}

const u32 = new Uint32Array(img.data.buffer);

const now = performance.now();
for(let x=0;x<WIDTH;x++) {
  for(let y=0;y<HEIGHT;y++) {
    const offset = x + y*WIDTH;
    const cell = test_cells(x-10, y-10, cells);
    if(cell >= 0) {
      u32[offset] = colors[cell]|0xFF000000;
    }
  }
}
const total = performance.now() - now; 
console.log('Check All Cells', total); 

context2D.putImageData(img, 0, 0);

json.cells.forEach((cell, i) => {
  if(i > 0) {
    const point = cell.points;
    cell.triangles.forEach(tri => {
      const p = (idx: number) => [point[idx*2],point[idx*2+1]] as vec2;
      line2d(p(tri[0]),p(tri[1]),'black');
      line2d(p(tri[1]),p(tri[2]),'black');
      line2d(p(tri[2]),p(tri[0]),'black');
    })
  }
});
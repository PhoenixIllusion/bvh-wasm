import { load_cells, test_cells } from './math/triangle-hash';
import { vec2 } from './models/edge';
import { PortalCellJson } from './models/json';
import { context2D, line2d } from './util';

const json = (await fetch('test-005.json').then(res => res.json())) as PortalCellJson.JSON;
const cells = load_cells(json);



const img = context2D.createImageData(660,520);

const colors = [];
for(let i=0;i<64;i++) {
  colors.push(Math.floor(Math.random() * 16777215))
}

const u32 = new Uint32Array(img.data.buffer);
for(let x=0;x<660;x++) {
  for(let y=0;y<520;y++) {
    const offset = x + y*660;
    const cell = test_cells(x-10, y-10, cells);
    if(cell >= 0) {
      u32[offset] = colors[cell]|0xFF000000;
    }
  }
}

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
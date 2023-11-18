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


for(let x=0;x<WIDTH;x++) {
  for(let y=0;y<HEIGHT;y++) {
    const offset = x + y*WIDTH;
    const cell = test_cells(x-10, y-10, cells);
    if(cell >= 0) {
      u32[offset] = colors[cell]|0xFF000000;
    }
  }
}


/*
for(let x=0;x<660;x++) {
  for(let y=0;y<520;y++) {
    const offset = x + y*660;
    json.cells.forEach((cell, i) => {
      if(i > 0) {
        //if(x >= cell.min[0] && x <=cell.max[0] && y >=cell.min[1] && y <= cell.max[1])
        {
          const point = cell.points;
          for(let j=0;j<cell.triangles.length;j++) {
            const tri = cell.triangles[j];
            const p = (idx: number) => [point[idx*2],point[idx*2+1]] as vec2;
            const p0 = p(tri[0]);
            const p1 = p(tri[1]);
            const p2 = p(tri[2]);
            let bary: {v: number, u: number} = {v: 0, u: 0};
            if(wind_order(p0,p1,p2)) {
              bary = Barycentric(p0,p2,p1, [x-10,y-10]);
            } else {
              bary = Barycentric(p0,p1,p2, [x-10,y-10]);
            }
            if(bary.u >= 0 && bary.v >= 0 &&  (bary.u + bary.v) < 1) {
              u32[offset] = colors[i]|0xFF000000;
              return;
            }
          }
        }
      }
    });
  }
}
//*/

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
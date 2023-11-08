import { memory, __new as alloc, Create, test_bvh, BuildBVH } from '../build/debug.js';
import { OBJ } from 'webgl-obj-loader';

const perf = (label: string, func: ()=>void) => {
  const now = performance.now();
  func();
  console.log(label, performance.now()-now);
}

const run = async () => {

  const objStr = await fetch('bunny.obj').then(res => res.text());
  var mesh = new OBJ.Mesh(objStr);
  const tri_count = mesh.indices.length/3;
  const WIDTH = 1200;
  const HEIGHT = 1200;
  const drawBuffer_ptr = alloc(1200*1200*4, 0);

  const bvh = Create(tri_count);
  const triangles = new Float32Array(memory.buffer, bvh.triangles, 9 * tri_count );
  const drawBuffer = new Float32Array(memory.buffer, drawBuffer_ptr, 1200*1200);
  drawBuffer.fill(0);

  for(let i=0;i<tri_count;i++) {
    const offset = i * 9;
    const idx = i * 3;
    for(let j=0;j<3;j++) {
      const v = mesh.indices[idx+j]*3;
      for(let k=0;k<3;k++) {
        triangles[offset + j*3 + k] = mesh.vertices[v+k];
      }
    }
  }
  perf('build bvh', () => {
    BuildBVH(bvh);
  })


  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  canvas.height = HEIGHT;
  canvas.width = WIDTH;
  canvas.style.width = WIDTH+"px";
  canvas.style.height = HEIGHT+"px";
  const ctx2d = canvas.getContext('2d')!;

  const imgData = ctx2d.createImageData(WIDTH,HEIGHT);
  
  const SCALE = 1.2;
  const offset = [0,.5,0];

  perf('render',() => {
    test_bvh(drawBuffer_ptr, WIDTH, HEIGHT, bvh,
      0, 0, 15,
      -SCALE + offset[0], SCALE + offset[1], -SCALE + offset[2],
      SCALE + offset[0], SCALE + offset[1], -SCALE + offset[2],
      -SCALE+ offset[0], -SCALE + offset[1], -SCALE + offset[2]); //*/
  })
  let outMin = Number.POSITIVE_INFINITY;
  let outMax = Number.NEGATIVE_INFINITY;
  drawBuffer.forEach( v => {
    if(v !== 0) {
      outMin = Math.min(outMin, v);
      outMax = Math.max(outMax, v);
    }
  })
  let outD = outMax-outMin;
  const t = (v: number) => (v-outMin)/outD;
  for(let y=0;y<HEIGHT;y++) {
    for(let x=0;x<WIDTH;x++) {
      const buff_idx = (x + y*WIDTH);
      const idx = 4 * buff_idx;
      if(drawBuffer[buff_idx] > 0) {
        const c = drawBuffer[buff_idx]
        imgData.data[idx] = t(c)*255;
        imgData.data[idx+3] = 255;
      }
    }
  }
  ctx2d.putImageData(imgData, 0, 0);
}

run();

/*
(str) => new Float32Array(new Uint32Array(str.split(' ').slice(1).map(x => parseInt(x,16)).buffer)
*/

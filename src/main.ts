import { test, memory, __new as alloc, Create, test_bvh, BuildBVH } from '../build/debug.js';
import { OBJ } from 'webgl-obj-loader';

const DEBUG = false;

const perf = (label: string, func: ()=>void) => {
  const now = performance.now();
  func();
  console.log(label, performance.now()-now);
}

const run = async () => {

  const objStr = await fetch('lamp.obj').then(res => res.text());
  var mesh = new OBJ.Mesh(objStr);
  const tri_count = Math.min(mesh.indices.length/3, 12000);
  const drawBuffer_ptr = alloc(640*480*4, 0);

  const bvh_ptr = Create(tri_count);
  const bvh = new Uint32Array(memory.buffer, bvh_ptr, 4);
  const triangles = new Float32Array(memory.buffer, bvh[0], 9 * tri_count );
  const drawBuffer = new Float32Array(memory.buffer, drawBuffer_ptr, 640*480);
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
    BuildBVH(bvh_ptr);
  })

  const WIDTH = 600;
  const HEIGHT = 600;
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const debugCanvasX = document.getElementById('debugX') as HTMLCanvasElement;
  const debugCanvasY = document.getElementById('debugY') as HTMLCanvasElement;
  const debugCanvasZ = document.getElementById('debugZ') as HTMLCanvasElement;
  [canvas, debugCanvasX, debugCanvasY, debugCanvasZ].forEach(canvas => {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.width = (WIDTH * 2)+'px'
    canvas.style.height = (HEIGHT * 2)+'px'
    if(!DEBUG && canvas.id !== 'canvas') {
      canvas.style.display = 'none';
    }
  })
  const ctx2d = canvas.getContext('2d')!;

  const imgData = ctx2d.createImageData(WIDTH,HEIGHT);
  
  const SCALE = 12.1;
  const offset = [0,4,0];
  /*test(drawBuffer_ptr, WIDTH, HEIGHT, bvh[0], bvh[3],
    0, 0, 15,
    -SCALE, -SCALE+ offY, -SCALE,
    -SCALE, SCALE+ offY, -SCALE,
    SCALE, -SCALE+ offY, -SCALE ); //*/

  let log_bvh = '';
  if(false){
    const bvh_data = new Uint32Array(memory.buffer, bvh[2], 2*11*tri_count);
    const bvh_fdata = new Float32Array(memory.buffer, bvh[2], 2*11*tri_count);
    const debugCtx2dX = debugCanvasX.getContext('2d')!;
    const debugCtx2dY = debugCanvasY.getContext('2d')!;
    const debugCtx2dZ = debugCanvasZ.getContext('2d')!;
    const d_SCALE = 0.1;
    const f = bvh_fdata;
    const c = bvh_data;
    debugCtx2dX.strokeStyle = "red";
    debugCtx2dY.strokeStyle = "green";
    debugCtx2dZ.strokeStyle = "blue";
    for(let i=0;i<2*tri_count;i++) {
      const idx = i*11;
      const leftNode = c[idx+8];
      const triCount = c[idx+10];
      if(leftNode + triCount > 0) {
        log_bvh += `Node ${i}\n\n`;

        const [aX,aY,aZ] = [f[idx+0],f[idx+1],f[idx+2]];
        const [bX,bY,bZ] = [f[idx+4]-aX,f[idx+5]-aY,f[idx+6]-aZ];
        log_bvh += `MIN: (${aX},${aY},${aZ})\n`
        log_bvh += `MAX: (${bX},${bY},${bZ})\n`
        
        const SIZE = 200;
        {
          const x = aX * SIZE/2 * d_SCALE + SIZE/2;
          const y = aY * SIZE/2 * d_SCALE + SIZE/2;
          const z = aZ * SIZE/2 * d_SCALE + SIZE/2;
          const w = bX * SIZE/2 * d_SCALE;
          const h = bY * SIZE/2 * d_SCALE;
          const d = bZ * SIZE/2 * d_SCALE;

          debugCtx2dX.strokeRect(x,y,w,h);
          debugCtx2dY.strokeRect(x,z,w,d);
          debugCtx2dZ.strokeRect(y,z,h,d);
        }

        if(leftNode) {
          log_bvh += `LeftNode: ${(leftNode-bvh[2])/44}\n`;
        }
        if(triCount > 0) {
          log_bvh += `FirstTri: ${(c[idx+9]-bvh[1])/4}\n`;
          log_bvh += `TriCount: ${triCount}\n`;
        }
        log_bvh += `------------------\n`;
      }
    }
  }
  console.log(log_bvh);
  perf('render',() => {
    test_bvh(drawBuffer_ptr, WIDTH, HEIGHT, bvh[2],
      0, 0, 15,
      -SCALE + offset[0], -SCALE + offset[1], -SCALE + offset[2],
      -SCALE + offset[0], SCALE + offset[1], -SCALE + offset[2],
      SCALE+ offset[0], -SCALE + offset[1], -SCALE + offset[2]); //*/
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
  const t = (v) => (v-outMin)/outD;
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

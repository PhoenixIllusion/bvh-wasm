import { test, memory, __new as alloc } from '../build/debug.js';
import { OBJ } from 'webgl-obj-loader';



const run = async () => {

  const objStr = await fetch('lamp.obj').then(res => res.text());
  var mesh = new OBJ.Mesh(objStr);
  const tri_count = Math.min(mesh.indices.length/3, 12000);
  const tri_size = 4*3*4;
  const triangles_ptr = alloc(tri_count * tri_size + 32, 1);
  const triangles_idx_ptr = alloc(tri_count*4, 2);
  const drawBuffer_ptr = alloc(640*480*4, 0);

  const triangles = new Float32Array(memory.buffer, triangles_ptr, tri_count * 3 * 4);
  const triangles_idx = new Uint32Array(memory.buffer, triangles_idx_ptr, tri_count);
  const drawBuffer = new Float32Array(memory.buffer, drawBuffer_ptr, 640*480);
  drawBuffer.fill(0);

  for(let i=0;i<tri_count;i++) {
    const idx_offset = i * tri_size;
    triangles_idx[i] = triangles_ptr + idx_offset;
    const offset = i * 12;
    const idx = i * 3;
    for(let j=0;j<3;j++) {
      const v = mesh.indices[idx+j]*3;
      for(let k=0;k<3;k++) {
        triangles[offset + j*3 + k] = mesh.vertices[v+k];
      }
    }
  }
  
  const WIDTH = 120;
  const HEIGHT = 200;
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx2d = canvas.getContext('2d')!;

  const imgData = ctx2d.createImageData(WIDTH,HEIGHT);
  
  const SCALE = 3.5;
  const offY = 2;
  test(drawBuffer_ptr, WIDTH, HEIGHT, triangles_ptr, tri_count,
    15, 0, 0,
    -SCALE, -SCALE*2.5+ offY, -SCALE,
    -SCALE, -SCALE*2.5+ offY, SCALE,
    -SCALE,  SCALE*2.5+ offY, -SCALE );
  
  for(let y=0;y<HEIGHT;y++) {
    for(let x=0;x<WIDTH;x++) {
      const buff_idx = (x + y*WIDTH);
      const idx = 4 * buff_idx;
      if(drawBuffer[buff_idx] > 0) {
        imgData.data[idx] = drawBuffer[buff_idx]*1500;
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

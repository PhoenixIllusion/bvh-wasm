
import { encode } from 'fast-png';
import { TILE_SIZE } from './bvh';
import BVHWorker from './worker.ts?worker';
import { OBJ } from 'webgl-obj-loader';

const WIDTH = 1200;
const HEIGHT = 1200;
const THREAD_COUNT = 4;

const loadModel = async () => {
  const objStr = await fetch('bunny.obj').then(res => res.text());
  var mesh = new OBJ.Mesh(objStr);
  const tri_count = mesh.indices.length/3;
  const buffer = new Float32Array(tri_count*3*3);
  for(let i=0;i<tri_count;i++) {
    const offset = i * 9;
    const idx = i * 3;
    for(let j=0;j<3;j++) {
      const v = mesh.indices[idx+j]*3;
      for(let k=0;k<3;k++) {
        buffer[offset + j*3 + k] = mesh.vertices[v+k];
      }
    }
  }
  return {
    tri_count,
    buffer
  }
}


function renderBuffer(drawBuffer: Float32Array, imgData: ImageData, ctx2d: CanvasRenderingContext2D, newData: { x: number, y: number, data: Float32Array}) {
  let outMin = Number.POSITIVE_INFINITY;
  let outMax = Number.NEGATIVE_INFINITY;
  drawBuffer.forEach( v => {
    if(v !== 0) {
      outMin = Math.min(outMin, v);
      outMax = Math.max(outMax, v);
    }
  })
  newData.data.forEach( v => {
    if(v !== 0) {
      outMin = Math.min(outMin, v);
      outMax = Math.max(outMax, v);
    }
  })
  let outD = outMax-outMin;
  const t = (v: number) => (v-outMin)/outD;
  const png_out = new Uint16Array(WIDTH * HEIGHT);
  const C_MAX = 255*255;
  for(let y=0;y<HEIGHT;y++) {
    for(let x=0;x<WIDTH;x++) {
      const buff_idx = (x + y*WIDTH);
      if(x >= newData.x && x < newData.x + TILE_SIZE) {
        if(y >= newData.y && y < newData.y + TILE_SIZE) {
          const n_buff_idx = (x-newData.x)+TILE_SIZE * (y-newData.y);
          drawBuffer[buff_idx] = newData.data[n_buff_idx];
        }
      }
      const idx = 4 * buff_idx;
      if(drawBuffer[buff_idx] > 0) {
        const c = drawBuffer[buff_idx];
        const v = (1.0-t(c));
        imgData.data[idx] = imgData.data[idx+1] = imgData.data[idx+2] = v*255;
        png_out[buff_idx] =  v*C_MAX;
        imgData.data[idx+3] = 255;
      } else {
        imgData.data[idx+3] = 255;
      }
    }
  }
  ctx2d.putImageData(imgData, 0, 0);
}

class WorkerQueue<P,T, M> {
  workers: Worker[] = [];
  awaits: (Promise<T>|undefined)[] = [];
  queue: {payload: P, marker: M}[] = [];
  constructor(count: number, onInit: (worker: Worker)=> void) {
    for(let i=0;i<count;i++) {
      const worker: Worker = new BVHWorker();
      this.workers.push(worker);
      onInit(worker);
    }
  }
  enqueue(payload: P, marker: M): void {
    this.queue.push({payload, marker});
  }
  onData?: (marker: M, response: T)=>void;
  async process() {
    while(this.queue.length > 0) {
      for(let i=0;i<this.workers.length;i++) {
        if(!this.awaits[i] && this.queue.length > 0) {
          const task = this.queue.shift()!;
          this.awaits[i] = new Promise<T>(resolve => {
            this.workers[i].postMessage(task.payload);
            this.workers[i].onmessage = (ev) => {
              this.awaits[i] = undefined;
              Promise.resolve(this.onData && this.onData(task.marker, ev.data));
              resolve(ev.data)
            }
          })
        }
      }
      await Promise.any(this.awaits);
    }
    await Promise.all(this.awaits);
  }
}

async function run() {

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  canvas.height = HEIGHT;
  canvas.width = WIDTH;
  canvas.style.width = WIDTH/2+"px";
  canvas.style.height = HEIGHT/2+"px";
  const ctx2d = canvas.getContext('2d')!;

  interface Request {render: {
    origin: number[],
    p0: number[],
    p1: number[],
    p2: number[]
  }}
  interface Response {
    buffer: Float32Array
  }
  interface Marker {
    x: number,
    y: number
  }

  const modelData = await loadModel();
  const queue = new WorkerQueue<Request, Response, Marker>(THREAD_COUNT, (worker) => {
    worker.postMessage(modelData);
  })

  const drawBuffer = new Float32Array(WIDTH*HEIGHT);
  const imgData = ctx2d.createImageData(WIDTH,HEIGHT);
  

  //setupCanvas(WIDTH,HEIGHT);
  //renderBVH(memory, bvh);
  //logBVH(memory, bvh);

  const SCALE = 0.88;
  const offset = [0.1,.8,0];
  {

    const origin = [0,0,15];
    const p0 = [-SCALE + offset[0], SCALE + offset[1], -SCALE + offset[2]];
  
    const genCoords = (dx: number, dy: number) => {
      return [p0[0]+dx, p0[1]+dy, p0[2]];
    }
    const genTriple = (dx: number, dy: number, deltaX: number, deltaY: number) => {
      return {
        p0: genCoords(dx, dy),
        p1: genCoords(dx+ deltaX, dy),
        p2: genCoords(dx, dy + deltaY)
      }
    }

    const Q_X = (SCALE * 2)/WIDTH;
    const Q_Y = -(SCALE * 2)/HEIGHT;

    for(let x=0; x < WIDTH; x+= TILE_SIZE) {
      for(let y=0; y < HEIGHT; y+= TILE_SIZE) {

          queue.enqueue({render: {origin, ... genTriple(x*Q_X,y*Q_Y, Q_X*TILE_SIZE,Q_Y*TILE_SIZE)}}, {x, y});
      }
    }

    let res: {x: number, y: number, data: Float32Array }[]= [];
    queue.onData = (marker, response) => {
      const { x, y } = marker;
      const { buffer } = response;
      res.push( {x, y, data: buffer});
    }

    const now = performance.now();
    await queue.process();
    console.log('Total Render', performance.now()-now);
    res.forEach(data => {
      renderBuffer(drawBuffer, imgData, ctx2d, data);
    })
    /*
      const blob = new Blob([encode({width: WIDTH, height: HEIGHT, data: png_out, depth: 16, channels: 1},{})]);
      const blobURL = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobURL;
      anchor.download = 'bunny.b16.png';
      anchor.textContent = 'bunny.png';
      document.body.appendChild(anchor);
      */
  }

  /*

  */
}

run();

/*
(str) => new Float32Array(new Uint32Array(str.split(' ').slice(1).map(x => parseInt(x,16)).buffer)
*/

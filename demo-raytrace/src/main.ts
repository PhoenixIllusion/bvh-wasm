
import { encode } from 'fast-png';
import { TILE_SIZE_X, TILE_SIZE_Y } from './bvh';
import BVHWorker from './worker.ts?worker';
import { OBJ } from 'webgl-obj-loader';
import { mat4, vec3 } from 'gl-matrix';
import { WorkerRequest } from './worker';

const WIDTH = 640;
const HEIGHT = 480;
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

let outMin = Number.POSITIVE_INFINITY;
let outMax = Number.NEGATIVE_INFINITY;
function renderBuffer(drawBuffer: Float32Array, imgData: ImageData, ctx2d: CanvasRenderingContext2D, newData: { x: number, y: number, data: Float32Array}[]) {
  newData.forEach(n => n.data.forEach( (v,i) => {
    if(v !== 0) {
      outMin = Math.min(outMin, v);
      outMax = Math.max(outMax, v);
      const px = i % TILE_SIZE_X + n.x;
      const py = 0xFFFF&(i / TILE_SIZE_X) + n.y;
      if(px < WIDTH && py < HEIGHT) {
        const buff_idx = (px + py*WIDTH);
        drawBuffer[buff_idx] = v;
      }
    }
  }));
  let outD = outMax-outMin;
  const t = (v: number) => (v-outMin)/outD;
  const png_out = new Uint16Array(WIDTH * HEIGHT);
  const C_MAX = 255*255;
  for(let y=0;y<HEIGHT;y++) {
    for(let x=0;x<WIDTH;x++) {
      const buff_idx = (x + y*WIDTH);
      if(drawBuffer[buff_idx] > 0) {
        const c = drawBuffer[buff_idx];
        const v = (1.0-t(c));
        const idx = buff_idx* 4;
        imgData.data[idx] = imgData.data[idx+1] = imgData.data[idx+2] = v*255;
        png_out[buff_idx] =  v*C_MAX;
        imgData.data[idx+3] = 255;
      } else {
        const idx = buff_idx* 4;
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
  canvas.style.width = WIDTH+"px";
  canvas.style.height = HEIGHT+"px";
  const ctx2d = canvas.getContext('2d')!;

  interface Response {
    buffer: Float32Array
  }
  interface Marker {
    x: number,
    y: number
  }

  const modelData = await loadModel();
  const ready: Promise<void>[] = [];
  const queue = new WorkerQueue<WorkerRequest, Response, Marker>(THREAD_COUNT, (worker) => {
    worker.postMessage(modelData);
    ready.push(new Promise(resolve => worker.onmessage = () => resolve()));
    
  })

  const drawBuffer = new Float32Array(WIDTH*HEIGHT);
  const imgData = ctx2d.createImageData(WIDTH,HEIGHT);
  

  //setupCanvas(WIDTH,HEIGHT);
  //renderBVH(memory, bvh);
  //logBVH(memory, bvh);
  let count = 0;
  const render = async () => {

    const tM = mat4.create();
    mat4.translate(tM,tM,vec3.fromValues(0,0.7,0));
    mat4.rotateY(tM, tM, count++*4.5*Math.PI/180);
    const origin = vec3.fromValues(0,0,8);
    const ar = WIDTH / HEIGHT;
    const p0 = vec3.fromValues(-1 * ar, 1, 0);
    const p1 = vec3.fromValues(1 * ar, 1, 0);
    const p2 = vec3.fromValues(-1 * ar, -1, 0);
    const p3 = vec3.fromValues(1 * ar, -1, 0);


    vec3.transformMat4(origin,origin, tM);
    vec3.transformMat4(p0,p0, tM);
    vec3.transformMat4(p1,p1, tM);
    vec3.transformMat4(p2,p2, tM);
    //vec3.transformMat4(p0,p0, M);
    //vec3.transformMat4(p1,p1, M);
    //vec3.transformMat4(p2,p2, M);
  
    //queue.enqueue({render: { origin: [... origin], p0: [... p0], p1: [... p1], p2: [... p2]}},{x: 0, y: 0})

    const lerp = (dx: number, dy: number) => {
      const v1 = vec3.create();
      const v2 = vec3.create();
      const v3 = vec3.create();
      return vec3.lerp(v3, vec3.lerp(v1, p0, p1, dx),vec3.lerp(v2, p2, p3, dx), dy);
    }

    for(let x=0; x < WIDTH; x+= TILE_SIZE_X) {
      for(let y=0; y < HEIGHT; y+= TILE_SIZE_Y) {
          queue.enqueue({render: {
            ray: { o: [... origin], p0: [... p0], p1: [... p1], p2: [... p2]} ,
            loc: { x, y, SCREEN_W: WIDTH, SCREEN_H: HEIGHT}}
          },{x, y})
      }
    }

    let res: {x: number, y: number, data: Float32Array }[]= [];
    queue.onData = (marker, response) => {
      const { x, y } = marker;
      const { buffer } = response;
      res.push( {x, y, data: buffer});
      //renderBuffer(drawBuffer, imgData, ctx2d, [{x,y,data: buffer}]);
    }

    drawBuffer.fill(0);
    imgData.data.fill(0);
    let now = performance.now();
    //console.log('Awaiting Ready');
    await Promise.all(ready);
    //console.log('Ready, rendering', performance.now()-now);
    now = performance.now();
    await queue.process();
    //console.log('Total Render', performance.now()-now);
    renderBuffer(drawBuffer, imgData, ctx2d, res);
    /*
      const blob = new Blob([encode({width: WIDTH, height: HEIGHT, data: png_out, depth: 16, channels: 1},{})]);
      const blobURL = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobURL;
      anchor.download = 'bunny.b16.png';
      anchor.textContent = 'bunny.png';
      document.body.appendChild(anchor);
      */
     requestAnimationFrame(render);
  }
render();
  /*

  */
}

run();

/*
(str) => new Float32Array(new Uint32Array(str.split(' ').slice(1).map(x => parseInt(x,16)).buffer)
*/

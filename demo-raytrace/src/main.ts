
import { encode } from 'fast-png';
import BVHWorker from './worker.ts?worker';
import { OBJ } from 'webgl-obj-loader';
import { mat4, vec3 } from 'gl-matrix';
import { WorkerRequest } from './worker';
import { WorkerQueue } from './worker-queue';
import { RenderResponse } from './bvh';

const url = new URL(location.href);
const query = (key: string): number => {
  const val = url.searchParams.get(key);
  if(val) { return parseInt(val);}
  return 0;
}

const TILE_SIZE_X = query('TILE_SIZE_X')||320;
const TILE_SIZE_Y = query('TILE_SIZE_Y')||240;
const WIDTH = query('WIDTH') || 640;
const HEIGHT = query('HEIGHT') || 480;
const THREAD_COUNT = query('THREAD_COUNT') || 4;

const DISABLE_RENDER = query('DISABLE_RENDER') || 0;

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

async function run() {

  interface Marker {
    x: number,
    y: number
  }

  const modelData = await loadModel();
  const ready: Promise<void>[] = [];
  const queue = new WorkerQueue<WorkerRequest, RenderResponse, Marker>(BVHWorker, THREAD_COUNT, (worker) => {
    worker.postMessage(modelData);
    ready.push(new Promise(resolve => worker.onmessage = () => resolve()));
    
  })

  const renderGrid = document.getElementById('renderGrid') as HTMLDivElement;
  renderGrid.style.gridTemplateColumns = `repeat(${Math.floor(WIDTH/TILE_SIZE_X)},1fr)`;
  const canvasGrid: { [key: string]: ImageBitmapRenderingContext|undefined} = {}
  const getCanvas = (x: number, y: number): ImageBitmapRenderingContext => {
    const key = `${x}-${y}`;
    if(!canvasGrid[key]) {
      const canvas = document.createElement('canvas');
      canvas.width = TILE_SIZE_X;
      canvas.height = TILE_SIZE_Y;
      canvasGrid[key] = canvas.getContext('bitmaprenderer')!;
      renderGrid.appendChild(canvas);
    }
    return canvasGrid[key]!;
  }
  const fps = document.getElementById('fps') as HTMLDivElement;

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

    const lerp = (dx: number, dy: number) => {
      const v1 = vec3.create();
      const v2 = vec3.create();
      const v3 = vec3.create();
      return vec3.lerp(v3, vec3.lerp(v1, p0, p1, dx),vec3.lerp(v2, p2, p3, dx), dy);
    }


    for(let y=0; y < HEIGHT; y+= TILE_SIZE_Y) {
      for(let x=0; x < WIDTH; x+= TILE_SIZE_X) {
          getCanvas(x,y); //create in correct order
          queue.enqueue({render: {
            ray: { o: [... origin], p0: [... p0], p1: [... p1], p2: [... p2]} ,
            target: { x, y, SCREEN_W: WIDTH, SCREEN_H: HEIGHT, TILE_SIZE_X, TILE_SIZE_Y},
            range: { min: outMin, max: outMax}
          }
        },{x, y})
      }
    }

    queue.onData = (marker, response) => {
      const { x, y } = marker;
      const { range, canvas } = response;
      outMax = Math.max(range.max, outMax);
      outMin = Math.min(range.min, outMin);
      if(DISABLE_RENDER != 1) {
        const ctx = getCanvas(x,y);
        ctx.transferFromImageBitmap(canvas);
      }
    }
    let now = performance.now();
    //console.log('Awaiting Ready');
    await Promise.all(ready);
    //console.log('Ready, rendering', performance.now()-now);
    now = performance.now();
    await queue.process();
    fps.textContent = 'FPS: '+ 1000/(performance.now()-now)+'fps';
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
const buildLinks = () => {
  const factor_out = (v: number) => {
    let ret={min:v+1,x:v,y:1};
    for(let i=1;i<v;i++){
        if( v % i == 0 && (v/i) % 2 == 0) {
          let d_x = i;
          let d_y = v/i;
          if(d_x + d_y < ret.min) {
              ret.min = d_x + d_y;
              ret.y = d_x;
              ret.x = d_y;
          }
        }
      }
      return ret;
  }

  const RES = [[160,120],[320,240],[640,480],[1280,960],[1600,1200]]
  const out = document.getElementById('render-links')!;
  const THREADS = [1,2,4,6,8];
  THREADS.forEach(t_c => {
    const title = document.createElement('h3');title.textContent='Thread Count: '+t_c;
    out.appendChild(title);
    const tileSizes = factor_out(t_c);
    const d_x = tileSizes.x;
    const d_y = tileSizes.y;
    RES.forEach(([w,h]) => {
      const anchor = document.createElement('a') as HTMLAnchorElement;
      anchor.textContent = `${w}x${h} Resolution, TileSize: ${w/d_x} x ${h/d_y}`;
      anchor.href = `index.html?WIDTH=${w}&HEIGHT=${h}&THREAD_COUNT=${t_c}&TILE_SIZE_X=${w/d_x}&TILE_SIZE_Y=${h/d_y}`
      out.appendChild(anchor);out.appendChild(document.createElement('br'));
    })
  });
}

buildLinks();
run();

/*
(str) => new Float32Array(new Uint32Array(str.split(' ').slice(1).map(x => parseInt(x,16)).buffer)
*/

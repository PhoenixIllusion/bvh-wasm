/// <reference types="vite/client" />
import BVHWorker from './worker?worker';
import { mat4 } from 'gl-matrix';
import { vec3 } from 'gl-matrix';
import { WorkerRequest } from './worker';
import { WorkerQueue } from './worker-queue';
import { RenderResponse } from './bvh';

const url = new URL(location.href);
const query = (key: string): number => {
  const val = url.searchParams.get(key);
  if (val) { return parseInt(val); }
  return 0;
}

const TILE_SIZE_X = query('TILE_SIZE_X') || 320;
const TILE_SIZE_Y = query('TILE_SIZE_Y') || 240;
const WIDTH = query('WIDTH') || 640;
const HEIGHT = query('HEIGHT') || 480;
const THREAD_COUNT = query('THREAD_COUNT') || 4;

const DISABLE_RENDER = query('DISABLE_RENDER') || 0;

class Mesh {
  public readonly vertices: Float32Array;
  constructor(str: string) {
    const v_lookup: number[][] = [];
    const vertices: number[] = [];
    str.split('\n').forEach(line => {
      if (line.startsWith('v ')) v_lookup.push(line.split(/\s+/).slice(1).map(parseFloat))
      if (line.startsWith('f ')) vertices.push(
        ...Array.from(this.triangulate(line.split(/\s+/).slice(1))).map(tri => tri.map(v =>
          v_lookup[parseInt(v.split('/')[0], 10) - 1]
        ).flat()).flat()
      )
    })
    this.vertices = new Float32Array(vertices);
  }
  private *triangulate(elements: string[]) {
    if (elements.length <= 3) {
      yield elements;
    } else if (elements.length === 4) {
      yield [elements[0], elements[1], elements[2]];
      yield [elements[2], elements[3], elements[0]];
    } else {
      for (let i = 1; i < elements.length - 1; i++) {
        yield [elements[0], elements[i], elements[i + 1]];
      }
    }
  }
}


const loadModel = async () => {
  const objStr = await fetch('bunny.obj').then(res => res.text());
  var mesh = new Mesh(objStr);
  return {
    tri_count: mesh.vertices.length / 9,
    buffer: mesh.vertices
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
  renderGrid.style.gridTemplateColumns = `repeat(${Math.floor(WIDTH / TILE_SIZE_X)},1fr)`;

  interface CanvasCache {
    ctx: CanvasRenderingContext2D,
    imgData: ImageData,
    buffer: ArrayBuffer
  }
  const canvasGrid: { [key: string]: CanvasCache | undefined } = {}

  const getCanvas = (x: number, y: number): CanvasCache => {
    const key = `${x}-${y}`;
    if (!canvasGrid[key]) {
      const canvas = document.createElement('canvas');
      canvas.width = TILE_SIZE_X;
      canvas.height = TILE_SIZE_Y;
      canvasGrid[key] = {
        ctx: canvas.getContext('2d')!,
        imgData: new ImageData(TILE_SIZE_X, TILE_SIZE_Y),
        buffer: new ArrayBuffer(TILE_SIZE_X * TILE_SIZE_Y * 4)
      }
      renderGrid.appendChild(canvas);
    }
    return canvasGrid[key]!;
  }
  const fps = document.getElementById('fps') as HTMLDivElement;

  let count = 0;
  const render = async () => {

    const tM = mat4.create();
    mat4.translate(tM, tM, [0, 0.7, 0]);
    mat4.rotateY(tM, tM, count++ * 4.5 * Math.PI / 180);

    const ar = WIDTH / HEIGHT;
    const origin = vec3.transformMat4(vec3.create(), [      0,  0, 8], tM);
    const p0     = vec3.transformMat4(vec3.create(), [-1 * ar,  1, 0], tM);
    const p1     = vec3.transformMat4(vec3.create(), [ 1 * ar,  1, 0], tM);
    const p2     = vec3.transformMat4(vec3.create(), [-1 * ar, -1, 0], tM);

    for (let y = 0; y < HEIGHT; y += TILE_SIZE_Y) {
      for (let x = 0; x < WIDTH; x += TILE_SIZE_X) {
        const data = getCanvas(x, y); //create in correct order
        queue.enqueue({
          render: {
            ray: { o: [ ... origin], p0: [ ... p0], p1: [ ... p1], p2: [ ... p2] },
            target: { x, y, SCREEN_W: WIDTH, SCREEN_H: HEIGHT, TILE_SIZE_X, TILE_SIZE_Y },
            range: { min: outMin, max: outMax },
            buffer: data.buffer
          }
        }, { x, y }, [data.buffer])
      }
    }

    queue.onData = (marker, response) => {
      const { x, y } = marker;
      const { range, canvas } = response;
      outMax = Math.max(range.max, outMax);
      outMin = Math.min(range.min, outMin);
      if (DISABLE_RENDER != 1) {
        const data = getCanvas(x, y);
        data.imgData.data.set(new Uint8ClampedArray(canvas))
        data.buffer = canvas;
        data.ctx.putImageData(data.imgData, 0, 0)
      }
    }
    let now = performance.now();
    await Promise.all(ready);
    now = performance.now();
    await queue.process();
    fps.textContent = 'FPS: ' + 1000 / (performance.now() - now) + 'fps';
    requestAnimationFrame(render);
  }
  render();
}
const buildLinks = () => {
  const factor_out = (v: number) => {
    let ret = { min: v + 1, x: v, y: 1 };
    for (let i = 1; i < v; i++) {
      if (v % i == 0 && (v / i) % 2 == 0) {
        let d_x = i;
        let d_y = v / i;
        if (d_x + d_y < ret.min) {
          ret.min = d_x + d_y;
          ret.y = d_x;
          ret.x = d_y;
        }
      }
    }
    return ret;
  }

  const RES = [[160, 120], [320, 240], [640, 480], [1280, 960], [1600, 1200]]
  const out = document.getElementById('render-links')!;
  const THREADS = [1, 2, 4, 6, 8];
  THREADS.forEach(t_c => {
    const title = document.createElement('h3'); title.textContent = 'Thread Count: ' + t_c;
    out.appendChild(title);
    const tileSizes = factor_out(t_c);
    const d_x = tileSizes.x;
    const d_y = tileSizes.y;
    RES.forEach(([w, h]) => {
      const anchor = document.createElement('a') as HTMLAnchorElement;
      anchor.textContent = `${w}x${h} Resolution, TileSize: ${w / d_x} x ${h / d_y}`;
      anchor.href = `index.html?WIDTH=${w}&HEIGHT=${h}&THREAD_COUNT=${t_c}&TILE_SIZE_X=${w / d_x}&TILE_SIZE_Y=${h / d_y}`
      out.appendChild(anchor); out.appendChild(document.createElement('br'));
    })
  });
}

buildLinks();
run();

/*
(str) => new Float32Array(new Uint32Array(str.split(' ').slice(1).map(x => parseInt(x,16)).buffer)
*/

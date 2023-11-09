let debugCanvas: HTMLCanvasElement[] = [];

export const setupCanvas = (WIDTH: number, HEIGHT: number) => {
  const debugCanvasX = document.getElementById('debugX') as HTMLCanvasElement;
  const debugCanvasY = document.getElementById('debugY') as HTMLCanvasElement;
  const debugCanvasZ = document.getElementById('debugZ') as HTMLCanvasElement;
  debugCanvas = [];
  [ debugCanvasX, debugCanvasY, debugCanvasZ].forEach(canvas => {
    canvas.width = WIDTH*2;
    canvas.height = HEIGHT*2;
    canvas.style.width = WIDTH*2 +'px'
    canvas.style.height = HEIGHT*2 +'px'
    canvas.style.display = 'block';
    debugCanvas.push(canvas);
  })
}

export const renderBVH = (memory: WebAssembly.Memory, bvh: {count: number, bvh: number}) => {
  const [debugCanvasX,debugCanvasY,debugCanvasZ] = debugCanvas;
  const bvh_data = new Uint32Array(memory.buffer, bvh.bvh, 2*11*bvh.count);
  const bvh_fdata = new Float32Array(memory.buffer, bvh.bvh, 2*11*bvh.count);
  const debugCtx2dX = debugCanvasX.getContext('2d')!;
  const debugCtx2dY = debugCanvasY.getContext('2d')!;
  const debugCtx2dZ = debugCanvasZ.getContext('2d')!;
  const d_SCALE = 1.3;
  const f = bvh_fdata;
  const c = bvh_data;
  debugCtx2dX.strokeStyle = "red";
  debugCtx2dY.strokeStyle = "green";
  debugCtx2dZ.strokeStyle = "blue";
  for(let i=0;i<2*bvh.count;i++) {
    const idx = i*11;
    const leftNode = c[idx+8];
    const triCount = c[idx+10];
    if(leftNode + triCount > 0) {

      const [aX,aY,aZ] = [f[idx+0],f[idx+1],f[idx+2]];
      const [bX,bY,bZ] = [f[idx+4]-aX,f[idx+5]-aY,f[idx+6]-aZ];
      
      const SIZE = 1200;
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
    }
  }
}

export const logBVH = (memory: WebAssembly.Memory, bvh: {count: number, bvh: number, triIndex: number}) => {
  let log_bvh = '';
  const bvh_data = new Uint32Array(memory.buffer, bvh.bvh, 2*11*bvh.count);
  const bvh_fdata = new Float32Array(memory.buffer, bvh.bvh, 2*11*bvh.count);
  const f = bvh_fdata;
  const c = bvh_data;
  for(let i=0;i<2*bvh.count;i++) {
    const idx = i*11;
    const leftNode = c[idx+8];
    const triCount = c[idx+10];
    if(leftNode + triCount > 0) {
      log_bvh += `Node ${i}\n\n`;

      const [aX,aY,aZ] = [f[idx+0],f[idx+1],f[idx+2]];
      const [bX,bY,bZ] = [f[idx+4]-aX,f[idx+5]-aY,f[idx+6]-aZ];
      log_bvh += `MIN: (${aX},${aY},${aZ})\n`
      log_bvh += `MAX: (${bX},${bY},${bZ})\n`
            if(leftNode) {
        log_bvh += `LeftNode: ${(leftNode-bvh.bvh)/44}\n`;
      }
      if(triCount > 0) {
        log_bvh += `FirstTri: ${(c[idx+9]-bvh.triIndex)/4}\n`;
        log_bvh += `TriCount: ${triCount}\n`;
      }
      log_bvh += `------------------\n`;
    }
  }
  console.log(log_bvh);
}
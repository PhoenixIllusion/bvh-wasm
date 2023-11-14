const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const context2D = canvas.getContext('2d')!;


function line2d(p0: [number,number], p1: [number,number], color: string, width: number = 2) {
  context2D.lineWidth = width;
  context2D.strokeStyle = color;
  context2D.beginPath();
  context2D.moveTo(p0[0], p0[1]);
  context2D.lineTo(p1[0], p1[1]);
  context2D.stroke();
}

export { context2D, line2d }
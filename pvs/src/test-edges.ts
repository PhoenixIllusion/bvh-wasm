import { edge_edge_intersect, line_intersects } from "./math/intersect";
import { Edge, vec2 } from "./models/edge";
import { context2D, line2d } from "./util";

const WIDTH = 600;
const HEIGHT = 400;


const randomPoint = () => {
  return {
    x: Math.round(Math.random() * WIDTH/10)*10 + 50,
    y: Math.round(Math.random() * HEIGHT/10)*10 + 50
  }
}

function calcNorm(a: {x: number, y: number}, b: {x: number, y: number}): vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx*dx+dy*dy);
  return [dy/len, -dx/len]
}

const randomLine = (): Edge|undefined => {
  for(let i=0;i<100;i++) {
    const p0 = randomPoint()
    const p1 = randomPoint()
    if(p0.x != p1.x && p0.y != p0.x) {
      return {p0: [p0.x,p0.y], p1: [p1.x, p1.y], n: calcNorm(p0, p1),id: -1};
    }
  }
}
const edges: Edge[] = [];
for(let i=0;i< 20;i++) {
  const edge = randomLine();
  edge && edges.push(edge);
}


/*
const edges: Edge[] = [
  {
    p0: [360, 380],
    p1: [430, 240]
  },
  {
    p0: [340, 420],
    p1: [410, 260]
  }];
  */
const mainE: Edge = randomLine()!; //{p0: [370, 430], p1:[130, 210]};


const found: Edge[] = [];
const intersect:[number,number] = [0,0];

line2d(mainE.p0, mainE.p1, 'blue', 5);
edges.forEach(e => {
  let color = 'black';
  let marker = 'none';
  let width = 2;
  if(edge_edge_intersect(intersect, mainE, e)) {
  //if(line_intersects(mainE.p0[0],mainE.p0[1],mainE.p1[0],mainE.p1[1],e.p0[0],e.p0[1],e.p1[0],e.p1[1])) {
    color = 'red';
    marker = 'green';
    width = 5;
    found.push(e);
  }
  line2d(e.p0, e.p1, color, width);
  if(marker != 'none') {
    context2D.fillStyle = marker;
    context2D.fillRect(intersect[0]-4,intersect[1]-4,8,8);
  }
})

console.log('Edge', mainE);
console.log('Found', found);

//
//[370, 430], [130,210]
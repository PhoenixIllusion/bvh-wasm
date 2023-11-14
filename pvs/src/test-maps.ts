
import { importSVG } from './svg-parser';
import { line2d } from './util';


const edges = await importSVG('test-004.svg');

edges.forEach(e => {
  line2d(e.p0, e.p1, 'black');
})

console.log(edges);
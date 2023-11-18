import { vec2_equal } from "../math/vec2";
import { vec2 } from "./edge";
import { Cell, CellEdge, PortalEdge } from "./portal-cells";
import earcut from 'earcut';

export namespace PortalCellJson {
  export interface Portal {
    destination: number;
    p0: vec2;
    p1: vec2;
  }
  export interface Cell {
    id: number;
    portals: Portal[];
    points: number[];
    triangles: [number,number,number][];
    min: [number, number];
    max: [number, number];
  }
  export interface JSON {
    cells: Cell[];
    min: [number, number];
    max: [number, number];
  }
}

export function cellsToJSON(cells: Cell[], spacing?: string): string {
  const json: PortalCellJson.JSON = {
    cells: [],
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  };
  cells.forEach((c,cidx) => {
    const cell: PortalCellJson.Cell = { 
      id: cidx, points: [],
      portals: [],
      triangles: [],
      min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
      max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
    };
    c.forEach((e: CellEdge|PortalEdge, eidx: number) => {
      const p = (e as PortalEdge);
      if(!vec2_equal(e.n, c[(eidx+1) % c.length].n)) {
        cell.points.push(... e.p1);
        cell.min[0] = Math.min(cell.min[0], e.p1[0]);
        cell.min[1] = Math.min(cell.min[1], e.p1[1]);
        cell.max[0] = Math.max(cell.max[0], e.p1[0]);
        cell.max[1] = Math.max(cell.max[1], e.p1[1]);
      }
      if(p.pair_edge) {
        const ce = p.pair_edge as CellEdge;
        const portal: PortalCellJson.Portal = { p0: p.p0, p1: p.p1, destination: cells.indexOf(ce.cell) };
        cell.portals.push(portal);
      }
    })
    const tris = earcut(cell.points);
    for(let i=0;i<tris.length;i+=3) {
      cell.triangles.push([tris[i],tris[i+1],tris[i+2]]);
    }
    json.min[0] = Math.min(json.min[0], cell.min[0]);
    json.min[1] = Math.min(json.min[1], cell.min[1]);
    json.max[0] = Math.max(json.max[0], cell.max[0]);
    json.max[1] = Math.max(json.max[1], cell.max[1]);
    json.cells.push(cell);
  });

  return JSON.stringify(json, undefined, spacing);
}
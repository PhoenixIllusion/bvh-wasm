import { Cell, CellEdge, PortalEdge } from "./portal-cells";

export namespace PortalCellJson {
  export interface Edge {
    id: number;
    p0: { x: number, y: number};
    p1: { x: number, y: number};
  }
  export interface Portal {
    edgeId: number;
    destination: number;
    destinationEdgeId: number;
  }
  export interface Cell {
    id: number;
    edges: Edge[];
    portals: Portal[];
  }
  export interface JSON {
    cells: Cell[];
  }
}

export function cellsToJSON(cells: Cell[], spacing?: string): string {
  const json: PortalCellJson.JSON = { cells: []};
  cells.forEach((c,cidx) => {
    const cell: PortalCellJson.Cell = { id: cidx, edges: [], portals: []};
    c.forEach((e: CellEdge|PortalEdge, eidx: number) => {
      const edge: PortalCellJson.Edge = { id: eidx, p0: { x: e.p0[0], y: e.p0[1]}, p1: { x: e.p1[0], y: e.p1[1]}};
      cell.edges.push(edge);
      const p = (e as PortalEdge);
      if(p.pair_edge) {
        const ce = p.pair_edge as CellEdge;
        const portal: PortalCellJson.Portal = { edgeId: eidx, destination: cells.indexOf(ce.cell), destinationEdgeId: ce.cell.indexOf(ce) };
        cell.portals.push(portal);
      }
    })
    json.cells.push(cell);
  });

  return JSON.stringify(json, undefined, spacing);
}
import { Edge } from "./edge";

export type Cell = CellEdge[];

export interface CellEdge extends Edge {
  cell: Cell;
}

export interface PortalEdge extends Edge {
  pair_edge: Edge;
}
import { vec2 } from "../models/edge";
import { PortalCellJson } from "../models/json";
import { check_b_triangle, triangle_to_barycenteric, wind_order } from "./triangles";

interface CellsDataStruct {
  cells: Float32Array,
  triangles: Float32Array 
}

export function load_cells(json: PortalCellJson.JSON): CellsDataStruct {
  const triangles: number[] = [];
  const cell_table: number[] = [];
  cell_table.push(json.cells.length);
  json.cells.forEach((cell, cell_index) => {
    const points = cell.points;
    cell_table.push(triangles.length);
    cell_table.push(cell.triangles.length);
    cell_table.push(cell.min[0], cell.min[1], cell.max[0],cell.max[1]);
    cell.triangles.forEach(tri => {
      const p = (idx: number) => [points[idx*2],points[idx*2+1]] as vec2;
      const p0 = p(tri[0]);
      const p1 = p(tri[1]);
      const p2 = p(tri[2]);
      if(wind_order(p0,p1,p2)) {
        triangle_to_barycenteric(p0, p2, p1, cell_index, triangles);
      } else {
        triangle_to_barycenteric(p0, p1, p2, cell_index, triangles);
      }
    });
  });
  return {
    cells: new Float32Array(cell_table),
    triangles: new Float32Array(triangles)
  };
}

export function test_cells(x: number, y: number, data: CellsDataStruct): number {
  const cells = data.cells;
  let cell_count = cells[0];
  for(let i=0;i<cell_count;i++) {
    let bbox = i*6+1;
    if(x < cells[bbox+2])continue;
    if(y < cells[bbox+3])continue;
    if(x > cells[bbox+4])continue;
    if(y > cells[bbox+5])continue;
    const byteOffset = cells[bbox];
    const triangle_Count = cells[bbox+1];
    if(i > 0){
      for(let j=0;j<triangle_Count;j++) {
        const tri = check_b_triangle(x, y, data.triangles, (byteOffset + j * 11))
        if(tri >0) {
          return tri;
        }
      }
    }
  }
  return -1;
}
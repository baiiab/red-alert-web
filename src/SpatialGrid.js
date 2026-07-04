import { SPATIAL_CELL } from './constants.js';

export class SpatialGrid {
  constructor(mapW, mapH) {
    this.cols = Math.ceil(mapW / SPATIAL_CELL);
    this.rows = Math.ceil(mapH / SPATIAL_CELL);
    this.cells = [];
    this._rebuild();
  }

  _rebuild() {
    this.cells = [];
    for (let i = 0; i < this.rows * this.cols; i++) this.cells[i] = [];
  }

  update(entities) {
    this._rebuild();
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.dead || !e.built) continue;
      let cx = Math.floor(e.x / SPATIAL_CELL);
      let cy = Math.floor(e.y / SPATIAL_CELL);
      if (cx < 0) cx = 0; if (cx >= this.cols) cx = this.cols - 1;
      if (cy < 0) cy = 0; if (cy >= this.rows) cy = this.rows - 1;
      this.cells[cy * this.cols + cx].push(e);
      if (e.isBuilding && e.size > 1) {
        let cx2 = Math.floor((e.x + e.size - 1) / SPATIAL_CELL);
        let cy2 = Math.floor((e.y + e.size - 1) / SPATIAL_CELL);
        if (cx2 >= this.cols) cx2 = this.cols - 1;
        if (cy2 >= this.rows) cy2 = this.rows - 1;
        for (let by = cy; by <= cy2; by++) for (let bx = cx; bx <= cx2; bx++) {
          if (bx === cx && by === cy) continue;
          this.cells[by * this.cols + bx].push(e);
        }
      }
    }
  }

  queryRange(x, y, range) {
    const results = [];
    const r = Math.ceil(range / SPATIAL_CELL) + 1;
    const cx = Math.floor(x / SPATIAL_CELL);
    const cy = Math.floor(y / SPATIAL_CELL);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const bx = cx + dx, by = cy + dy;
      if (bx < 0 || bx >= this.cols || by < 0 || by >= this.rows) continue;
      const cell = this.cells[by * this.cols + bx];
      for (let i = 0; i < cell.length; i++) results.push(cell[i]);
    }
    return results;
  }
}

import { SPATIAL_CELL } from './constants.js';

/**
 * 均匀网格空间索引。
 * 坐标约定：所有查询参数均使用「格子坐标」（tile），与实体的 x/y 一致。
 * 跨格的大建筑会被插入其覆盖的每一个格子，因此查询结果需要去重。
 */
export class SpatialGrid {
  constructor(mapW, mapH) {
    this.cols = Math.ceil(mapW / SPATIAL_CELL);
    this.rows = Math.ceil(mapH / SPATIAL_CELL);
    this.cells = [];
    this._out = [];
    this._rebuild();
  }

  _rebuild() {
    // 复用已有 cell 数组，避免每次重建产生大量短命数组
    for (let i = 0; i < this.cells.length; i++) this.cells[i].length = 0;
    const total = this.rows * this.cols;
    for (let i = this.cells.length; i < total; i++) this.cells[i] = [];
    this.cells.length = total;
  }

  update(entities) {
    this._rebuild();
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      // 建造中的实体同样入索引，否则点选/框选无法命中未完工的建筑
      if (e.dead) continue;
      let cx = Math.floor(e.x / SPATIAL_CELL);
      let cy = Math.floor(e.y / SPATIAL_CELL);
      if (cx < 0) cx = 0; if (cx >= this.cols) cx = this.cols - 1;
      if (cy < 0) cy = 0; if (cy >= this.rows) cy = this.rows - 1;
      this.cells[cy * this.cols + cx].push(e);
      if (e.isBuilding && e.size > 1) {
        let cx2 = Math.floor((e.x + e.size - 1) / SPATIAL_CELL);
        let cy2 = Math.floor((e.y + e.size - 1) / SPATIAL_CELL);
        if (cx2 < 0) cx2 = 0; if (cx2 >= this.cols) cx2 = this.cols - 1;
        if (cy2 < 0) cy2 = 0; if (cy2 >= this.rows) cy2 = this.rows - 1;
        for (let by = cy; by <= cy2; by++) for (let bx = cx; bx <= cx2; bx++) {
          if (bx === cx && by === cy) continue;
          this.cells[by * this.cols + bx].push(e);
        }
      }
    }
  }

  /**
   * 圆形范围查询，返回新数组（调用方可安全持有）。
   * 低频路径使用；热路径请用 forEachInRange 避免分配。
   */
  queryRange(x, y, range) {
    const out = this._out;
    let n = 0;
    // 按包围盒精确取格子范围（比「中心格 ±ceil(range/CELL)+1」少扫 3~5 倍格子）。
    // 外扩 1 格是必须的：格子按实体左上角 e.x 插入，而命中判定用的是实体中心
    // (e.x + size/2)，两者跨格边界时会错位，不外扩就会漏掉射程内的目标。
    const x0 = Math.max(0, Math.floor((x - range) / SPATIAL_CELL) - 1);
    const x1 = Math.min(this.cols - 1, Math.floor((x + range) / SPATIAL_CELL) + 1);
    const y0 = Math.max(0, Math.floor((y - range) / SPATIAL_CELL) - 1);
    const y1 = Math.min(this.rows - 1, Math.floor((y + range) / SPATIAL_CELL) + 1);
    for (let by = y0; by <= y1; by++) {
      const rowBase = by * this.cols;
      for (let bx = x0; bx <= x1; bx++) {
        const cell = this.cells[rowBase + bx];
        for (let i = 0; i < cell.length; i++) {
          const e = cell[i];
          if (e.isBuilding) {
            let dup = false;
            for (let k = 0; k < n; k++) if (out[k] === e) { dup = true; break; }
            if (dup) continue;
          }
          out[n++] = e;
        }
      }
    }
    return out.slice(0, n);
  }

  /**
   * 圆形范围遍历（零分配）。热路径专用：结果通过回调立即消费，
   * 不会重复投递同一实体。回调返回 true 可提前终止遍历。
   */
  forEachInRange(x, y, range, fn) {
    // 同样外扩 1 格，原因见 queryRange
    const x0 = Math.max(0, Math.floor((x - range) / SPATIAL_CELL) - 1);
    const x1 = Math.min(this.cols - 1, Math.floor((x + range) / SPATIAL_CELL) + 1);
    const y0 = Math.max(0, Math.floor((y - range) / SPATIAL_CELL) - 1);
    const y1 = Math.min(this.rows - 1, Math.floor((y + range) / SPATIAL_CELL) + 1);
    let n = 0;
    const seen = this._out;
    for (let by = y0; by <= y1; by++) {
      const rowBase = by * this.cols;
      for (let bx = x0; bx <= x1; bx++) {
        const cell = this.cells[rowBase + bx];
        for (let i = 0; i < cell.length; i++) {
          const e = cell[i];
          if (e.isBuilding) {
            let dup = false;
            for (let k = 0; k < n; k++) if (seen[k] === e) { dup = true; break; }
            if (dup) continue;
            seen[n++] = e;
          }
          if (fn(e) === true) return;
        }
      }
    }
  }

  /**
   * 矩形范围遍历（格子坐标，零分配）。结果通过回调立即消费，不重复投递同一实体。
   * 覆盖格子数超过总量一半时返回 false，表示「空间索引已无收益」，
   * 调用方应退化回全量遍历；正常遍历完成返回 true。
   */
  forEachInRect(x1, y1, x2, y2, fn) {
    const tx1 = Math.min(x1, x2), tx2 = Math.max(x1, x2);
    const ty1 = Math.min(y1, y2), ty2 = Math.max(y1, y2);
    // 外扩 1 格：格子按实体左上角插入，命中判定用实体中心，跨格边界时会错位
    const cx1 = Math.max(0, Math.floor(tx1 / SPATIAL_CELL) - 1);
    const cx2 = Math.min(this.cols - 1, Math.floor(tx2 / SPATIAL_CELL) + 1);
    const cy1 = Math.max(0, Math.floor(ty1 / SPATIAL_CELL) - 1);
    const cy2 = Math.min(this.rows - 1, Math.floor(ty2 / SPATIAL_CELL) + 1);
    const span = (cx2 - cx1 + 1) * (cy2 - cy1 + 1);
    if (span * 2 > this.cols * this.rows) return false;

    let n = 0;
    const seen = this._out;
    for (let by = cy1; by <= cy2; by++) {
      const rowBase = by * this.cols;
      for (let bx = cx1; bx <= cx2; bx++) {
        const cell = this.cells[rowBase + bx];
        for (let i = 0; i < cell.length; i++) {
          const e = cell[i];
          if (e.isBuilding) {
            let dup = false;
            for (let k = 0; k < n; k++) if (seen[k] === e) { dup = true; break; }
            if (dup) continue;
            seen[n++] = e;
          }
          if (fn(e) === true) return true;
        }
      }
    }
    return true;
  }
}

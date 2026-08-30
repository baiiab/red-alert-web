import { MAP_WIDTH, MAP_HEIGHT, GRASS, WATER, ORE, ROCK, CONCRETE, SAND, TREE } from './constants.js';

// 八方向邻居偏移（模块级常量，避免每次寻路重建数组）
const DIRS = new Int8Array([-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, -1, 1, 1, -1, 1, 1]);
// 单次寻路默认迭代上限
const DEFAULT_MAX_ITER = 3000;
// 预算耗尽时仍然保底执行的迭代数（保证返回可用路径，避免单位卡死）
const MIN_ITER_PER_CALL = 256;
// 静态地形判定为不可达时的迭代上限。不可达目标会让 A* 空跑满 3000 次迭代，
// 实测这部分占全部迭代量的 79%，压缩后只损失「尽量接近目标」的精度
const UNREACHABLE_MAX_ITER = 600;
// 二叉堆初始容量（惰性删除会重复入堆，需大于格子总数）
const HEAP_INIT_CAP = 8192;

export class GameMap {
  constructor() {
    this.terrain = [];
    this.oreAmount = [];
    this.occupancy = [];
    this._orePositions = null; // 矿石位置缓存
    this._oreDirty = true;
    this._region = null;        // 静态地形连通区域（延迟到 generate/recomputeRegions 计算）
    this._regionCount = 0;
    // 寻路每帧预算：0 表示不限。由主循环每帧调用 resetPathBudget() 重置
    this.pathBudgetPaths = 6;
    this.pathBudgetNodes = 9000;
    this._pfPathsUsed = 0;
    this._pfNodesUsed = 0;
  }

  /**
   * 重置本帧寻路预算（主循环每帧调用一次）
   */
  resetPathBudget() {
    this._pfPathsUsed = 0;
    this._pfNodesUsed = 0;
  }

  /**
   * 预计算静态地形连通区域（水/岩石为障碍，4 连通）。
   * 地形不可达则叠加建筑占用后同样不可达，因此该判定不会误杀可达目标；
   * 建筑只会让区域「变小」，不会产生新的连通性。
   * 地形在游戏中只会在可通行类型之间变化（矿石->草地、地面->混凝土），
   * 故只需在生成地图和读档时计算一次。
   */
  _computeRegions() {
    const W = MAP_WIDTH, H = MAP_HEIGHT, N = W * H;
    if (!this._region || this._region.length !== N) this._region = new Int32Array(N);
    this._region.fill(-1);
    const stack = new Int32Array(N);
    let rid = 0;
    for (let s = 0; s < N; s++) {
      const t = this.terrain[(s / W) | 0][s % W];
      if (t === WATER || t === ROCK || this._region[s] !== -1) continue;
      let sp = 0;
      stack[sp++] = s;
      this._region[s] = rid;
      while (sp > 0) {
        const c = stack[--sp];
        const cx = c % W, cy = (c / W) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = cx + DIRS[d * 2], ny = cy + DIRS[d * 2 + 1];
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const ni = ny * W + nx;
          if (this._region[ni] !== -1) continue;
          const nt = this.terrain[ny][nx];
          if (nt === WATER || nt === ROCK) continue;
          this._region[ni] = rid;
          stack[sp++] = ni;
        }
      }
      rid++;
    }
    this._regionCount = rid;
  }

  /** 外部替换 terrain 之后调用（例如读档），重建连通区域 */
  recomputeRegions() {
    this._computeRegions();
  }

  generate() {
    let i, j;
    for (i = 0; i < MAP_HEIGHT; i++) {
      this.terrain[i] = []; this.oreAmount[i] = []; this.occupancy[i] = [];
      for (j = 0; j < MAP_WIDTH; j++) {
        this.terrain[i][j] = GRASS; this.oreAmount[i][j] = 0; this.occupancy[i][j] = null;
      }
    }
    let k, cx, cy, r, nx, ny;
    for (k = 0; k < 5; k++) {
      cx = 14 + Math.floor(Math.random() * (MAP_WIDTH - 28));
      cy = 14 + Math.floor(Math.random() * (MAP_HEIGHT - 28));
      r = 3 + Math.floor(Math.random() * 5);
      for (i = -r; i <= r; i++) for (j = -r; j <= r; j++) {
        if (i * i + j * j <= r * r) { nx = cx + j; ny = cy + i;
          if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) this.terrain[ny][nx] = WATER; }
      }
    }
    for (k = 0; k < 10; k++) {
      cx = Math.floor(Math.random() * MAP_WIDTH); cy = Math.floor(Math.random() * MAP_HEIGHT);
      r = 1 + Math.floor(Math.random() * 3);
      for (i = -r; i <= r; i++) for (j = -r; j <= r; j++) {
        if (i * i + j * j <= r * r) { nx = cx + j; ny = cy + i;
          if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && this.terrain[ny][nx] === GRASS) this.terrain[ny][nx] = ROCK; }
      }
    }
    for (k = 0; k < 8; k++) {
      cx = Math.floor(Math.random() * MAP_WIDTH); cy = Math.floor(Math.random() * MAP_HEIGHT);
      r = 2 + Math.floor(Math.random() * 4);
      for (i = -r; i <= r; i++) for (j = -r; j <= r; j++) {
        if (i * i + j * j <= r * r) { nx = cx + j; ny = cy + i;
          if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && this.terrain[ny][nx] === GRASS) this.terrain[ny][nx] = SAND; }
      }
    }
    for (k = 0; k < 70; k++) {
      const tx = Math.floor(Math.random() * MAP_WIDTH);
      const ty = Math.floor(Math.random() * MAP_HEIGHT);
      if (this.terrain[ty][tx] === GRASS) this.terrain[ty][tx] = TREE;
    }
    for (k = 0; k < 14; k++) {
      cx = 6 + Math.floor(Math.random() * (MAP_WIDTH - 12));
      cy = 6 + Math.floor(Math.random() * (MAP_HEIGHT - 12));
      r = 2 + Math.floor(Math.random() * 3);
      for (i = -r; i <= r; i++) for (j = -r; j <= r; j++) {
        if (i * i + j * j <= r * r) { nx = cx + j; ny = cy + i;
          if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && this.terrain[ny][nx] === GRASS) {
            this.terrain[ny][nx] = ORE; this.oreAmount[ny][nx] = 500 + Math.floor(Math.random() * 500); }
        }
      }
    }
    this._clearArea(0, 0, 14, 14);
    this._setConcrete(3, 3, 3, 3);
    this._placeOreNear(10, 5, 5, 600, 1000);
    this._clearArea(MAP_WIDTH - 14, MAP_HEIGHT - 14, 14, 14);
    this._setConcrete(MAP_WIDTH - 7, MAP_HEIGHT - 7, 3, 3);
    this._placeOreNear(MAP_WIDTH - 12, MAP_HEIGHT - 8, 5, 600, 1000);
    this._oreDirty = true;
    this._computeRegions();
  }

  _clearArea(x, y, w, h) {
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
      const ty = y + i, tx = x + j;
      if (ty >= 0 && ty < MAP_HEIGHT && tx >= 0 && tx < MAP_WIDTH) { this.terrain[ty][tx] = GRASS; this.oreAmount[ty][tx] = 0; }
    }
  }

  _setConcrete(x, y, w, h) {
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
      const ty = y + i, tx = x + j;
      if (ty >= 0 && ty < MAP_HEIGHT && tx >= 0 && tx < MAP_WIDTH) this.terrain[ty][tx] = CONCRETE;
    }
  }

  _placeOreNear(cx, cy, count, minA, maxA) {
    let placed = 0, tries = 0;
    while (placed < count && tries < 100) {
      tries++;
      const dx = Math.floor(Math.random() * 8 - 4);
      const dy = Math.floor(Math.random() * 8 - 4);
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT && this.terrain[y][x] === GRASS) {
        this.terrain[y][x] = ORE;
        this.oreAmount[y][x] = minA + Math.floor(Math.random() * (maxA - minA));
        placed++;
      }
    }
  }

  isPassable(x, y) {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
    const t = this.terrain[y][x];
    if (t === WATER || t === ROCK) return false;
    const occ = this.occupancy[y][x];
    if (occ && occ.isBuilding) return false;
    return true;
  }

  isBuildable(x, y, size) {
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
      const tx = x + j, ty = y + i;
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return false;
      const t = this.terrain[ty][tx];
      if (t === WATER || t === ROCK || t === ORE || t === TREE) return false;
      if (this.occupancy[ty][tx]) return false;
    }
    return true;
  }

  isNearBuilding(x, y, size, team) {
    for (let i = -3; i < size + 3; i++) for (let j = -3; j < size + 3; j++) {
      const tx = x + j, ty = y + i;
      if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
        const occ = this.occupancy[ty][tx];
        if (occ && occ.isBuilding && occ.team === team && occ.built) return true;
      }
    }
    return false;
  }

  setOccupancy(e) {
    for (let i = 0; i < e.size; i++) for (let j = 0; j < e.size; j++) {
      const tx = Math.floor(e.x) + j, ty = Math.floor(e.y) + i;
      if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) this.occupancy[ty][tx] = e;
    }
  }

  clearOccupancy(e) {
    for (let i = 0; i < e.size; i++) for (let j = 0; j < e.size; j++) {
      const tx = Math.floor(e.x) + j, ty = Math.floor(e.y) + i;
      if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT && this.occupancy[ty][tx] === e) this.occupancy[ty][tx] = null;
    }
  }

  _buildOreCache() {
    this._orePositions = [];
    for (var i = 0; i < MAP_HEIGHT; i++) {
      for (var j = 0; j < MAP_WIDTH; j++) {
        if (this.terrain[i][j] === ORE && this.oreAmount[i][j] > 0) {
          this._orePositions.push({ x: j, y: i });
        }
      }
    }
    this._oreDirty = false;
  }

  _removeOreFromCache(x, y) {
    if (!this._orePositions) return;
    for (var i = this._orePositions.length - 1; i >= 0; i--) {
      if (this._orePositions[i].x === x && this._orePositions[i].y === y) {
        this._orePositions.splice(i, 1);
        break;
      }
    }
  }

  findNearestOre(x, y) {
    if (this._oreDirty || !this._orePositions) this._buildOreCache();
    if (this._orePositions.length === 0) return { x: -1, y: -1 };
    var best = this._orePositions[0];
    var bd = (best.x - x) * (best.x - x) + (best.y - y) * (best.y - y);
    for (var i = 1; i < this._orePositions.length; i++) {
      var o = this._orePositions[i];
      var d = (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y);
      if (d < bd) { bd = d; best = o; }
    }
    return { x: best.x, y: best.y };
  }

  findNearestRefinery(x, y, team, entities) {
    let best = null, bd = Infinity;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.team === team && e.built && !e.dead && (e.type === 'refinery' || e.type === 'base')) {
        const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = e; }
      }
    }
    return best;
  }

  findPath(sx, sy, ex, ey, maxIter, requester, exempt) {
    sx = Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor(sx)));
    sy = Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor(sy)));
    ex = Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor(ex)));
    ey = Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor(ey)));
    if (sx === ex && sy === ey) return [];

    // 空军无视地形与占用，直接飞往目标点
    if (requester && requester.isAirUnit) return [{ x: ex, y: ey }];

    const W = MAP_WIDTH;
    const N = W * MAP_HEIGHT;
    const startIdx = sy * W + sx;
    const endIdx = ey * W + ex;

    let limit = maxIter > 0 ? maxIter : DEFAULT_MAX_ITER;
    // 静态连通性预检：分属不同区域必定不可达，压缩迭代上限避免空跑
    if (this._region && this._region[startIdx] !== this._region[endIdx]) {
      limit = Math.min(limit, UNREACHABLE_MAX_ITER);
    }
    // 本帧寻路预算：超额时压缩本次迭代上限，平滑掉帧尖峰。
    // exempt（玩家直接下达的命令）不受预算约束——玩家输入事件发生在两帧之间，
    // 此时的预算余量反映的是上一帧 AI 的消耗，不该反过来挤占玩家的命令
    if (!exempt) {
      this._pfPathsUsed++;
      if (this.pathBudgetNodes > 0) {
        const left = this.pathBudgetNodes - this._pfNodesUsed;
        limit = left > 0 ? Math.min(limit, left) : MIN_ITER_PER_CALL;
      }
      if (this.pathBudgetPaths > 0 && this._pfPathsUsed > this.pathBudgetPaths) {
        limit = MIN_ITER_PER_CALL;
      }
    }

    // A* 工作数组（整数索引 = y*W+x，generation 时间戳免每次寻路重填）
    if (!this._pfG) {
      this._pfG = new Float32Array(N);
      this._pfFrom = new Int32Array(N);
      this._pfGStamp = new Int32Array(N);
      this._pfClosedStamp = new Int32Array(N);
      this._pfGen = 0;
      this._pfHeap = new Int32Array(HEAP_INIT_CAP);
      this._pfHeapF = new Float32Array(HEAP_INIT_CAP);
      this._pfHeapSize = 0;
    }
    const gScore = this._pfG, from = this._pfFrom, gStamp = this._pfGStamp,
          closedStamp = this._pfClosedStamp;
    const gen = ++this._pfGen;

    gScore[startIdx] = 0;
    gStamp[startIdx] = gen;
    const startH = Math.abs(ex - sx) + Math.abs(ey - sy);
    this._pfHeapSize = 0;
    this._pfPush(startIdx, startH);

    let itr = 0;
    let closestIdx = startIdx, closestH = startH;

    while (this._pfHeapSize > 0 && itr < limit) {
      itr++;
      const ci = this._pfPop();
      if (closedStamp[ci] === gen) continue; // 惰性删除：旧副本出堆时跳过
      closedStamp[ci] = gen;
      const cx = ci % W, cy = (ci / W) | 0;
      const ch = Math.abs(ex - cx) + Math.abs(ey - cy);
      if (ch < closestH) { closestH = ch; closestIdx = ci; }
      if (cx === ex && cy === ey) {
        if (!exempt) this._pfNodesUsed += itr;
        return this._reconstructPath(from, gStamp, gen, startIdx, ci);
      }
      const cg = gScore[ci];
      for (let d = 0; d < 8; d++) {
        const dx = DIRS[d * 2], dy = DIRS[d * 2 + 1];
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= MAP_HEIGHT) continue;
        const ni = ny * W + nx;
        if (closedStamp[ni] === gen) continue;

        // 通行性检查（对角移动需两个正交邻格均可通行）
        if (!this.isPassableForUnit(nx, ny, requester)) continue;
        if (d >= 4) {
          if (!this.isPassableForUnit(cx + dx, cy, requester) ||
              !this.isPassableForUnit(cx, cy + dy, requester)) continue;
        }

        // 地形代价
        let moveCost = (d >= 4) ? 1.414 : 1;
        const terrain = this.terrain[ny][nx];
        if (terrain === SAND) moveCost *= 1.3;
        else if (terrain === CONCRETE) moveCost *= 0.9;
        else if (terrain === TREE) moveCost *= 1.5;

        // 避免拥挤
        const occ = this.occupancy[ny][nx];
        if (occ && occ !== requester && !occ.isBuilding) moveCost *= 2;

        const tg = cg + moveCost;
        if (gStamp[ni] !== gen || tg < gScore[ni]) {
          gScore[ni] = tg;
          gStamp[ni] = gen;
          from[ni] = ci;
          const h = Math.abs(ex - nx) + Math.abs(ey - ny);
          this._pfPush(ni, tg + h);
        }
      }
    }
    if (!exempt) this._pfNodesUsed += itr;

    // 不可达：返回到距目标最近点的路径
    if (closestH < startH) {
      return this._reconstructPath(from, gStamp, gen, startIdx, closestIdx);
    }
    return [];
  }

  /**
   * 索引二叉堆入堆：堆中只存节点索引 i 与其 f 值，全程零对象分配
   */
  _pfPush(i, f) {
    if (this._pfHeapSize >= this._pfHeap.length) {
      const oi = this._pfHeap, of = this._pfHeapF;
      this._pfHeap = new Int32Array(oi.length * 2);
      this._pfHeapF = new Float32Array(of.length * 2);
      this._pfHeap.set(oi);
      this._pfHeapF.set(of);
    }
    const H = this._pfHeap, HF = this._pfHeapF;
    let n = this._pfHeapSize++;
    H[n] = i; HF[n] = f;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (HF[p] <= HF[n]) break;
      const ti = H[p], tf = HF[p];
      H[p] = H[n]; HF[p] = HF[n];
      H[n] = ti; HF[n] = tf;
      n = p;
    }
  }

  /**
   * 索引二叉堆出堆：返回 f 最小的节点索引
   */
  _pfPop() {
    const H = this._pfHeap, HF = this._pfHeapF;
    const top = H[0];
    const last = --this._pfHeapSize;
    if (last > 0) {
      H[0] = H[last]; HF[0] = HF[last];
      let n = 0;
      for (;;) {
        const l = n * 2 + 1, r = l + 1;
        let m = n;
        if (l < last && HF[l] < HF[m]) m = l;
        if (r < last && HF[r] < HF[m]) m = r;
        if (m === n) break;
        const ti = H[m], tf = HF[m];
        H[m] = H[n]; HF[m] = HF[n];
        H[n] = ti; HF[n] = tf;
        n = m;
      }
    }
    return top;
  }

  /**
   * 由 from 数组回溯路径（仅回溯本次 generation 写过的节点）
   */
  _reconstructPath(from, gStamp, gen, startIdx, endIdx) {
    const path = [];
    let i = endIdx;
    let guard = 0;
    while (i !== startIdx && gStamp[i] === gen && guard++ < MAP_WIDTH * MAP_HEIGHT) {
      path.push({ x: i % MAP_WIDTH, y: (i / MAP_WIDTH) | 0 });
      i = from[i];
    }
    path.reverse();
    return this.smoothPath(path);
  }

  /**
   * 针对单位的通行性检查
   */
  isPassableForUnit(x, y, requester) {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
    const t = this.terrain[y][x];
    if (t === WATER || t === ROCK) return false;
    const occ = this.occupancy[y][x];
    if (occ && occ.isBuilding) {
      // 己方建筑不阻挡己方单位通行：基地建筑密集时，单位不会被自家厂房围死。
      // 敌方建筑仍然阻挡。requester 为空（如出厂落点搜索）时保持阻挡的保守行为
      return !!(requester && occ.team === requester.team);
    }
    // 允许穿过友方单位（但代价更高）
    if (occ && occ !== requester && !occ.isBuilding) {
      if (requester && occ.team !== requester.team) return false; // 敌方单位阻挡
    }
    return true;
  }

  /**
   * 路径平滑 - 移除不必要的中间点
   */
  smoothPath(path) {
    if (path.length < 3) return path;
    
    const smoothed = [path[0]];
    let i = 0;
    
    while (i < path.length - 1) {
      // 尝试找到可以直接到达的最远点
      let furthest = i + 1;
      for (let j = path.length - 1; j > i + 1; j--) {
        if (this.hasLineOfSight(path[i].x, path[i].y, path[j].x, path[j].y)) {
          furthest = j;
          break;
        }
      }
      smoothed.push(path[furthest]);
      i = furthest;
    }
    
    return smoothed;
  }

  /**
   * 检查两点之间是否有视线（直线可通行）
   */
  hasLineOfSight(x0, y0, x1, y1) {
    // Bresenham直线算法
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    
    let x = x0, y = y0;
    
    while (x !== x1 || y !== y1) {
      if (!this.isPassable(x, y)) return false;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    
    return true;
  }
}

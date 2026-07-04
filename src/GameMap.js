import { MAP_WIDTH, MAP_HEIGHT, GRASS, WATER, ORE, ROCK, CONCRETE, SAND, TREE } from './constants.js';
import { BinaryHeap } from './BinaryHeap.js';

export class GameMap {
  constructor() {
    this.terrain = [];
    this.oreAmount = [];
    this.occupancy = [];
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

  findNearestOre(x, y) {
    const best = { x: -1, y: -1 }; let bd = Infinity;
    for (let i = 0; i < MAP_HEIGHT; i++) for (let j = 0; j < MAP_WIDTH; j++) {
      if (this.terrain[i][j] === ORE && this.oreAmount[i][j] > 0) {
        const dx = j - x, dy = i - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best.x = j; best.y = i; }
      }
    }
    return best;
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

  findPath(sx, sy, ex, ey, maxIter) {
    sx = Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor(sx)));
    sy = Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor(sy)));
    ex = Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor(ex)));
    ey = Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor(ey)));
    if (sx === ex && sy === ey) return [];
    maxIter = maxIter || 3000;
    const open = new BinaryHeap(function (n) { return n.f; });
    const closed = {}, gScore = {}, cameFrom = {}, inOpen = {};
    const sk = sx + ',' + sy;
    gScore[sk] = 0;
    const startNode = { x: sx, y: sy, f: Math.abs(ex - sx) + Math.abs(ey - sy) };
    open.push(startNode);
    inOpen[sk] = startNode;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    let itr = 0, closest = { x: sx, y: sy, d: Math.abs(ex - sx) + Math.abs(ey - sy) };
    while (open.size() > 0 && itr < maxIter) {
      itr++;
      const cur = open.pop();
      const ck = cur.x + ',' + cur.y;
      delete inOpen[ck];
      const ch = Math.abs(ex - cur.x) + Math.abs(ey - cur.y);
      if (ch < closest.d) closest = { x: cur.x, y: cur.y, d: ch };
      if (cur.x === ex && cur.y === ey) {
        const path = []; let k2 = ck;
        while (k2 && k2 !== sk) {
          const p2 = k2.split(',');
          path.unshift({ x: +p2[0], y: +p2[1] });
          k2 = cameFrom[k2];
        }
        return path;
      }
      closed[ck] = true;
      for (let d = 0; d < dirs.length; d++) {
        let nx = cur.x + dirs[d][0], ny = cur.y + dirs[d][1];
        if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
        const nk = nx + ',' + ny;
        if (closed[nk]) continue;
        if (!this.isPassable(nx, ny)) continue;
        if (d >= 4) {
          if (!this.isPassable(cur.x + dirs[d][0], cur.y) || !this.isPassable(cur.x, cur.y + dirs[d][1])) continue;
        }
        const mc = (d >= 4) ? 1.414 : 1;
        const tg = (gScore[ck] || 0) + mc;
        if (gScore[nk] === undefined || tg < gScore[nk]) {
          gScore[nk] = tg;
          const h = Math.abs(ex - nx) + Math.abs(ey - ny);
          cameFrom[nk] = ck;
          if (inOpen[nk]) {
            inOpen[nk].f = tg + h;
            open._bubbleUp(open.content.indexOf(inOpen[nk]));
          } else {
            const nn = { x: nx, y: ny, f: tg + h };
            open.push(nn);
            inOpen[nk] = nn;
          }
        }
      }
    }
    if (closest.d < Math.abs(ex - sx) + Math.abs(ey - sy)) {
      const path2 = []; let kk = closest.x + ',' + closest.y;
      while (kk && kk !== sk) {
        const pp = kk.split(',');
        path2.unshift({ x: +pp[0], y: +pp[1] });
        kk = cameFrom[kk];
      }
      return path2;
    }
    return [];
  }
}

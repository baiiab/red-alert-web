import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, TEAM_PLAYER } from './constants.js';

/**
 * 战争迷雾系统 - 类似原版红警的迷雾机制
 * 0 = 完全未探索（黑色）
 * 1 = 已探索但当前无视野（半暗）
 * 2 = 当前有视野（完全可见）
 *
 * 性能设计：
 * - visibility/revealedOnce 使用 Uint8Array 平铺数组（索引 = y * MAP_WIDTH + x）
 * - 维护"当前可见格列表"，update 时只降级列表内的格子，避免每帧全图扫描
 * - _revealArea 用距离平方比较，不做开方
 * - 迷雾绘制到 1px/格 的离屏 canvas，仅在数据变化时重绘；
 *   渲染时在 world transform 内一次 drawImage 放大（浏览器平滑插值出柔边）
 */
export class FogOfWar {
  constructor() {
    this.visibility = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
    this.revealedOnce = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
    this.visibleTiles = [];   // 当前处于状态2的格子索引
    this.fogCanvas = null;    // 1px/格 离屏迷雾画布
    this.fogCtx = null;
    this.fogImageData = null;
    this._dirty = true;
  }

  _ensureCanvas() {
    if (this.fogCanvas) return;
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = MAP_WIDTH;
    this.fogCanvas.height = MAP_HEIGHT;
    this.fogCtx = this.fogCanvas.getContext('2d');
    this.fogImageData = this.fogCtx.createImageData(MAP_WIDTH, MAP_HEIGHT);
    // 初始全黑
    const px = this.fogImageData.data;
    for (let i = 0; i < MAP_WIDTH * MAP_HEIGHT; i++) {
      px[i * 4 + 3] = 255; // 未探索 = 不透明黑
    }
  }

  /**
   * 更新视野 - 根据所有友方单位和建筑的位置计算视野
   */
  update(entities) {
    // 将上一帧可见的格子降级为"已探索但无视野"
    const list = this.visibleTiles;
    for (let i = 0; i < list.length; i++) {
      const idx = list[i];
      if (this.visibility[idx] === 2) this.visibility[idx] = 1;
    }
    list.length = 0;

    // 计算所有友方单位的视野
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.dead || !e.built || e.team !== TEAM_PLAYER) continue;
      const sightRange = this._getSightRange(e);
      const centerX = e.x + (e.isBuilding ? e.size / 2 : 0.5);
      const centerY = e.y + (e.isBuilding ? e.size / 2 : 0.5);
      this._revealArea(centerX, centerY, sightRange);
    }

    if (this._dirty) {
      this._redrawFogCanvas();
      this._dirty = false;
    }
  }

  /**
   * 获取单位的视野范围
   */
  _getSightRange(entity) {
    if (entity.isBuilding) {
      switch (entity.type) {
        case 'base': return 10;
        case 'radar': return 15;
        case 'turret':
        case 'aaGun':
        case 'tesla': return 8;
        default: return 6;
      }
    } else {
      switch (entity.type) {
        case 'infantry': return 5;
        case 'rocket': return 6;
        case 'engineer': return 4;
        case 'tank': return 7;
        case 'heavyTank': return 7;
        case 'arty': return 8;
        case 'harvester': return 4;
        case 'apc': return 6;
        case 'mlrs': return 7;
        default: return 5;
      }
    }
  }

  /**
   * 揭示一个圆形区域（距离平方比较，无开方）
   */
  _revealArea(centerX, centerY, radius) {
    const cx = Math.floor(centerX);
    const cy = Math.floor(centerY);
    const r = Math.ceil(radius);
    const r2 = radius * radius;
    const x0 = Math.max(0, cx - r), x1 = Math.min(MAP_WIDTH - 1, cx + r);
    const y0 = Math.max(0, cy - r), y1 = Math.min(MAP_HEIGHT - 1, cy + r);

    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      const rowBase = y * MAP_WIDTH;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy > r2) continue;
        const idx = rowBase + x;
        if (this.visibility[idx] !== 2) {
          this.visibility[idx] = 2;
          this.visibleTiles.push(idx);
          this._dirty = true;
        }
        if (!this.revealedOnce[idx]) {
          this.revealedOnce[idx] = 1;
          this._dirty = true;
        }
      }
    }
  }

  /**
   * 将迷雾数据重绘到 1px/格 的离屏画布
   */
  _redrawFogCanvas() {
    this._ensureCanvas();
    const px = this.fogImageData.data;
    const vis = this.visibility, rev = this.revealedOnce;
    for (let i = 0; i < vis.length; i++) {
      const a = vis[i] === 2 ? 0 : (rev[i] ? 128 : 255);
      px[i * 4 + 3] = a;
    }
    this.fogCtx.putImageData(this.fogImageData, 0, 0);
  }

  /**
   * 检查一个格子是否可见（有当前视野）
   */
  isVisible(x, y) {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
    return this.visibility[y * MAP_WIDTH + x] === 2;
  }

  /**
   * 检查一个格子是否被探索过（有地形信息但可能没有当前视野）
   */
  isExplored(x, y) {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
    return this.revealedOnce[y * MAP_WIDTH + x] === 1;
  }

  /**
   * 检查一个世界坐标位置是否可见
   */
  isWorldVisible(worldX, worldY) {
    return this.isVisible(Math.floor(worldX / TILE_SIZE), Math.floor(worldY / TILE_SIZE));
  }

  /**
   * 检查一个实体是否可见
   */
  isEntityVisible(entity) {
    const ex = entity.x + (entity.isBuilding ? entity.size / 2 : 0.5);
    const ey = entity.y + (entity.isBuilding ? entity.size / 2 : 0.5);
    return this.isVisible(Math.floor(ex), Math.floor(ey));
  }

  /**
   * 在 world transform 内渲染迷雾：一次 drawImage 放大整个迷雾画布
   * （调用方保证 ctx 已应用 camera 的 scale/translate，imageSmoothing 开启时有柔边效果）
   * 可传 destW/destH 以其他尺寸绘制（如小地图 1:1 覆盖）
   */
  render(ctx, destW, destH) {
    this._ensureCanvas();
    if (this._dirty) {
      this._redrawFogCanvas();
      this._dirty = false;
    }
    const w = destW || MAP_WIDTH * TILE_SIZE;
    const h = destH || MAP_HEIGHT * TILE_SIZE;
    ctx.drawImage(this.fogCanvas, 0, 0, MAP_WIDTH, MAP_HEIGHT, 0, 0, w, h);
  }

  /**
   * 序列化（供存档）：typed array -> 普通数组
   */
  serialize() {
    return {
      visibility: Array.from(this.visibility),
      revealedOnce: Array.from(this.revealedOnce)
    };
  }

  /**
   * 反序列化（供读档）：兼容 v2 的二维数组与 v3 的平铺数组
   */
  deserialize(data) {
    if (!data) return;
    const readArr = (src, dst) => {
      if (!src) return;
      if (Array.isArray(src[0])) {
        // v2 二维数组
        for (let y = 0; y < MAP_HEIGHT; y++) {
          const row = src[y];
          if (!row) continue;
          for (let x = 0; x < MAP_WIDTH; x++) dst[y * MAP_WIDTH + x] = row[x] ? 1 : 0;
        }
      } else {
        const n = Math.min(src.length, dst.length);
        for (let i = 0; i < n; i++) dst[i] = src[i] ? 1 : 0;
      }
    };
    readArr(data.visibility, this.visibility);
    readArr(data.revealedOnce, this.revealedOnce);
    // 依据存档重建可见格列表
    this.visibleTiles.length = 0;
    for (let i = 0; i < this.visibility.length; i++) {
      if (this.visibility[i] === 2) this.visibleTiles.push(i);
    }
    this._dirty = true;
  }
}

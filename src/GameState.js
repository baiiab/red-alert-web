import { MAP_WIDTH, MAP_HEIGHT, TEAM_PLAYER, TEAM_ENEMY, TILE_SIZE } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS, FACTION_NAMES, FACTION_ALLIED, FACTION_SOVIET } from './definitions.js';
import { Entity } from './Entity.js';
import { GameMap } from './GameMap.js';
import { SpatialGrid } from './SpatialGrid.js';
import { FogOfWar } from './FogOfWar.js';
import { SuperWeaponManager } from './SuperWeapon.js';

export class GameState {
  constructor() {
    this.map = new GameMap();
    this.entities = [];
    this.projectiles = [];
    this.explosions = [];
    this.floatingTexts = [];
    this.smokeParticles = [];
    this.minimapAlerts = [];
    this.playerCredits = 15000;
    this.enemyCredits = 1500;
    this.playerPower = 0;
    this.playerPowerUse = 0;
    this.enemyPower = 0;
    this.enemyPowerUse = 0;
    this.playerUnitCount = 0;
    // 红警2 水平的单位上限。原先写死 30，而开局就占 12 个（6步兵+3坦克+3采矿车），
    // 造十来个人就满了，表现为「一段时间后造不出兵」
    this.playerUnitMax = 60;
    this.playerFaction = null;
    this.enemyFaction = null;
    this.gameOver = false;
    this.winner = -1;
    this.hasRadar = false;
    this.hasTechCenter = false;
    this.controlGroups = {};
    this.stats = { unitsLost: 0, unitsKilled: 0, buildingsLost: 0, buildingsKilled: 0, oreGathered: 0 };
    this.lowPowerAlertCooldown = 0;
    this.underAttackAlertCooldown = 0;
    // 间谍渗透电厂后的断电计时（帧），期间发电量大幅下降
    this.playerPowerBlackout = 0;
    this.enemyPowerBlackout = 0;
    this._playExplosionSound = null;
    this.spatialGrid = new SpatialGrid(MAP_WIDTH, MAP_HEIGHT);
    this.spatialDirty = true;
    this._playerBuildings = null;
    this._enemyBuildings = null;
    this._playerUnits = null;
    this._enemyUnits = null;
    this._listDirty = true;
    this._refineryCache = null;
    this._refineryDirty = true;
    this.fogOfWar = new FogOfWar();
    this.superWeaponManager = new SuperWeaponManager(this);
  }

  getPlayerBuildings() {
    if (this._listDirty || !this._playerBuildings) this._playerBuildings = this.entities.filter(e => e.team === TEAM_PLAYER && e.isBuilding && !e.dead);
    return this._playerBuildings;
  }

  getEnemyBuildings() {
    if (this._listDirty || !this._enemyBuildings) this._enemyBuildings = this.entities.filter(e => e.team === TEAM_ENEMY && e.isBuilding && !e.dead);
    return this._enemyBuildings;
  }

  getPlayerUnits() {
    if (this._listDirty || !this._playerUnits) this._playerUnits = this.entities.filter(e => e.team === TEAM_PLAYER && !e.isBuilding && !e.dead);
    return this._playerUnits;
  }

  getEnemyUnits() {
    if (this._listDirty || !this._enemyUnits) this._enemyUnits = this.entities.filter(e => e.team === TEAM_ENEMY && !e.isBuilding && !e.dead);
    return this._enemyUnits;
  }

  hasBuilding(team, type) {
    return this.entities.some(e => e.team === team && e.type === type && e.built && !e.dead);
  }

  /**
   * 精炼厂/基地缓存 —— 采矿车每帧都要找最近的精炼厂，
   * 原实现遍历全部实体（10 车 × 300 实体 = 3000 次/帧）。
   * 缓存随 _listDirty 失效，候选数量通常 < 10。
   */
  getRefineries(team) {
    // 用独立失效标志而非 _listDirty：后者每帧都会被主循环置 true，
    // 挂靠其上会导致每帧重建缓存，反而比全量遍历更慢
    if (this._refineryDirty || !this._refineryCache) {
      this._refineryCache = [[], []];
      for (let i = 0; i < this.entities.length; i++) {
        const e = this.entities[i];
        if (!e.dead && (e.type === 'refinery' || e.type === 'base')) this._refineryCache[e.team].push(e);
      }
    }
    return this._refineryCache[team];
  }

  /** 确保空间索引是最新的（低频调用点使用） */
  _ensureSpatial() {
    if (this.spatialDirty) { this.spatialGrid.update(this.entities); this.spatialDirty = false; }
  }

  /** 获取某支队伍所属阵营（用于单位/建筑的阵营限制） */
  getFaction(team) {
    return team === TEAM_PLAYER ? this.playerFaction : this.enemyFaction;
  }

  /**
   * 统一的建造前置校验 —— canBuild 与 getBuildReason 共用同一份逻辑，
   * 避免两处各自维护导致漂移。返回 { ok, reason }，ok 为 true 时 reason 为空串。
   */
  checkBuildGate(type, team) {
    const def = BUILDING_DEFS[type] || DEFENSE_DEFS[type] || UNIT_DEFS[type];
    if (!def) return { ok: false, reason: '未知单位' };

    // 阵营限制：def.faction 为 null/undefined 表示双方通用
    const faction = this.getFaction(team);
    if (def.faction && faction && def.faction !== faction) {
      return { ok: false, reason: (FACTION_NAMES[def.faction] || def.faction) + '专属单位' };
    }

    const credits = team === TEAM_PLAYER ? this.playerCredits : this.enemyCredits;
    if (credits < def.cost) return { ok: false, reason: '资金不足 (需要 $' + def.cost + ')' };

    if (def.requires) {
      for (let i = 0; i < def.requires.length; i++) {
        if (!this.hasBuilding(team, def.requires[i])) {
          const reqDef = BUILDING_DEFS[def.requires[i]] || DEFENSE_DEFS[def.requires[i]];
          return { ok: false, reason: '需要 ' + ((reqDef && reqDef.name) || def.requires[i]) };
        }
      }
    }

    if (def.category === 'units' && team === TEAM_PLAYER) {
      if (this.playerUnitCount >= this.playerUnitMax) {
        return { ok: false, reason: '单位上限已满 (' + this.playerUnitCount + '/' + this.playerUnitMax + ')' };
      }
      if (this.playerPower - this.playerPowerUse < 0) return { ok: false, reason: '电力不足' };
    }
    if ((def.category === 'buildings' || def.category === 'defenses') && team === TEAM_PLAYER) {
      if (def.powerUse > 0 && (this.playerPower - this.playerPowerUse) < def.powerUse) {
        return { ok: false, reason: '电力不足 (需要 ' + def.powerUse + '⚡)' };
      }
    }
    return { ok: true, reason: '' };
  }

  /** 可建造返回 null，否则返回不可建造的原因文本 */
  buildBlocker(type, team) {
    const g = this.checkBuildGate(type, team);
    return g.ok ? null : g.reason;
  }

  getBuildReason(type, team) {
    return this.checkBuildGate(type, team).reason;
  }

  canBuild(type, team) {
    return this.checkBuildGate(type, team).ok;
  }

  spawnEntity(type, team, x, y) {
    const e = new Entity(type, team, x, y);
    this.entities.push(e);
    if (e.isBuilding) this.map.setOccupancy(e);
    this.spatialDirty = true;
    this._listDirty = true;
    if (e.type === 'refinery' || e.type === 'base') this._refineryDirty = true;
    return e;
  }

  removeEntity(entity) {
    if (entity.isBuilding) this.map.clearOccupancy(entity);
    entity.dead = true;
    entity.deathTimer = 45;
    this.spatialDirty = true;
    this._listDirty = true;
    if (entity.type === 'refinery' || entity.type === 'base') this._refineryDirty = true;
    if (entity.team === TEAM_PLAYER) {
      if (entity.isBuilding) this.stats.buildingsLost++; else this.stats.unitsLost++;
    } else {
      if (entity.isBuilding) this.stats.buildingsKilled++; else this.stats.unitsKilled++;
    }
  }

  getEntityAt(wx, wy) {
    this._ensureSpatial();
    const tx = wx / TILE_SIZE, ty = wy / TILE_SIZE;
    // 查询半径 3 格即可覆盖最大建筑尺寸与点击容差
    const nearby = this.spatialGrid.queryRange(tx, ty, 3);
    // 原实现为倒序遍历，取视觉最上层（最后创建的）实体，这里按 id 降序保持一致
    let best = null;
    for (let i = 0; i < nearby.length; i++) {
      const e = nearby[i];
      if (e.dead) continue;
      let hit = false;
      if (e.isBuilding) {
        hit = wx >= e.x * TILE_SIZE && wx < (e.x + e.size) * TILE_SIZE &&
              wy >= e.y * TILE_SIZE && wy < (e.y + e.size) * TILE_SIZE;
      } else {
        const dx = wx - e.getCenterX(), dy = wy - e.getCenterY();
        hit = dx * dx + dy * dy < TILE_SIZE * 0.65 * (TILE_SIZE * 0.65);
      }
      if (hit && (!best || e.id > best.id)) best = e;
    }
    return best;
  }

  getEntitiesInRect(x1, y1, x2, y2) {
    this._ensureSpatial();
    const r = [];
    const loX = Math.min(x1, x2), hiX = Math.max(x1, x2);
    const loY = Math.min(y1, y2), hiY = Math.max(y1, y2);
    const hit = function (e) {
      if (e.dead || e.team !== TEAM_PLAYER || e.isBuilding) return;
      const ecx = e.getCenterX(), ecy = e.getCenterY();
      if (ecx >= loX && ecx <= hiX && ecy >= loY && ecy <= hiY) r.push(e);
    };
    // 框选覆盖大半张地图时 forEachInRect 返回 false，退化为全量遍历
    const used = this.spatialGrid.forEachInRect(
      x1 / TILE_SIZE, y1 / TILE_SIZE, x2 / TILE_SIZE, y2 / TILE_SIZE, hit);
    if (!used) for (let i = 0; i < this.entities.length; i++) hit(this.entities[i]);
    return r;
  }

  getEnemiesInRange(entity, range) {
    this._ensureSpatial();
    // 这里刻意保留「每次 new 数组 + push」的写法，不要改成缓冲环复用：
    // 实测（20000 次交错对照）缓冲环反而慢约 7%，而本项总开销仅占单帧预算 0.5%，
    // V8 对短命小数组的分配几乎免费。改复杂了只会引入嵌套调用踩缓冲的风险。
    const r = [];
    const ex = entity.getCenterX(), ey = entity.getCenterY();
    const rp = range * TILE_SIZE;
    const rp2 = rp * rp; // 平方比较，每帧数百次调用里避开 hypot
    // forEachInRange 为零分配遍历，避免每次查询产生中间数组
    // 不过滤 e.built：在建建筑同样占格、同样能挨打（applySplashDamage 就不检查 built），
    // 之前只允许锁定已完工建筑，导致「能炸到却打不到」的判定矛盾
    this.spatialGrid.forEachInRange(ex / TILE_SIZE, ey / TILE_SIZE, range + 2, function (e) {
      if (e.team !== entity.team && !e.dead) {
        const dx = ex - e.getCenterX(), dy = ey - e.getCenterY();
        if (dx * dx + dy * dy <= rp2) r.push(e);
      }
    });
    return r;
  }

  addProjectile(from, to, damage, team, type, splash) {
    const p = {
      x: from.x, y: from.y,
      damage, team, type: type || 'bullet',
      target: to, speed: type === 'shell' ? 5 : (type === 'rocket' ? 5.5 : 8),
      splash: splash || 0
    };
    if (to.getCenterX) { p.targetX = to.getCenterX(); p.targetY = to.getCenterY(); }
    else { p.targetX = to.x; p.targetY = to.y; }
    this.projectiles.push(p);
  }

  addExplosion(x, y, size, type) {
    this.explosions.push({ x, y, size, type: type || 'fire', timer: 28, maxTimer: 28 });
  }

  addFloatingText(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color: color || '#fff', timer: 50, vy: -0.7 });
  }

  addSmoke(x, y) {
    if (this.smokeParticles.length > 200) return;
    this.smokeParticles.push({
      x, y, vx: (Math.random() - 0.5) * 0.3, vy: -0.5 - Math.random() * 0.5,
      size: 3 + Math.random() * 3, timer: 50 + Math.random() * 30, maxTimer: 80
    });
  }

  addMinimapAlert(x, y, color) {
    this.minimapAlerts.push({ x, y, color: color || '#e74c3c', timer: 50, maxTimer: 50 });
  }

  /**
   * 统一伤害入口：扣血、铁幕无敌判定、伤害飘字、击杀归属、死亡清理（爆炸/音效/胜负判定）
   */
  damageEntity(target, dmg, attacker) {
    if (!target || target.dead || dmg <= 0) return;
    if (target.invulnerable) {
      this.addFloatingText(target.getCenterX(), target.getCenterY() - 14, '无敌', '#8e44ad');
      return;
    }
    target.hp -= dmg;
    target.flashTimer = 5;
    if (attacker && !attacker.dead) {
      target.lastDamagedBy = attacker;
      target.lastDamagedTimer = 180;
    }
    this.addFloatingText(target.getCenterX(), target.getCenterY() - 10, '-' + dmg, '#ff6b6b');
    if (target.hp <= 0) {
      target.hp = 0;
      this.addExplosion(target.getCenterX(), target.getCenterY(), target.isBuilding ? 36 : 30, 'big');
      if (this._playExplosionSound) this._playExplosionSound();
      if (target.type === 'base') {
        this.gameOver = true;
        this.winner = target.team === TEAM_PLAYER ? TEAM_ENEMY : TEAM_PLAYER;
      }
      this.awardKill(attacker || target.lastDamagedBy, target);
      this.removeEntity(target);
    }
  }

  /**
   * 击杀归属与老兵升级（3杀1星、8杀2星，建筑不升级）
   */
  awardKill(attacker, victim) {
    if (!attacker || attacker.dead || attacker === victim || attacker.isBuilding) return;
    attacker.kills = (attacker.kills || 0) + 1;
    if (attacker.veterancy < 1 && attacker.kills >= 3) attacker.veterancy = 1;
    if (attacker.veterancy < 2 && attacker.kills >= 8) attacker.veterancy = 2;
  }

  applySplashDamage(x, y, radius, damage, team, attacker) {
    this._ensureSpatial();
    const rp = radius * TILE_SIZE;
    const self = this;
    // 半径外扩 3 格以覆盖大建筑的中心偏移。
    // 结算过程中 removeEntity 只置 dead 标记且不会重建索引，故在回调内直接结算是安全的
    this.spatialGrid.forEachInRange(x / TILE_SIZE, y / TILE_SIZE, radius + 3, function (e) {
      if (e.dead) return;
      if (team >= 0 && e.team === team) return;
      const dx = e.getCenterX() - x, dy = e.getCenterY() - y;
      // falloff 需要真实距离比例，用 sqrt 而非 hypot
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= rp) {
        const falloff = 1 - d / rp * 0.6;
        const dmg = Math.floor(damage * falloff);
        if (dmg > 0) self.damageEntity(e, dmg, attacker);
      }
    });
  }

initPlayer() {
    // 玩家使用盟军阵营 - 给予更多初始优势
    this.playerFaction = FACTION_ALLIED;
    const base = this.spawnEntity('base', TEAM_PLAYER, 3, 3);
    base.faction = 'allied';
    const pp = this.spawnEntity('powerPlant', TEAM_PLAYER, 3, 6); pp.built = true; pp.buildProgress = 100;
    pp.faction = 'allied';
    
    // 额外赠送电厂和矿场
    const pp2 = this.spawnEntity('powerPlant', TEAM_PLAYER, 3, 9); pp2.built = true; pp2.buildProgress = 100;
    pp2.faction = 'allied';
    const ref = this.spawnEntity('refinery', TEAM_PLAYER, 6, 3); ref.built = true; ref.buildProgress = 100;
    ref.faction = 'allied';

    // 更多初始步兵
    const inf1 = this.spawnEntity('infantry', TEAM_PLAYER, 7, 3); inf1.faction = 'allied';
    const inf2 = this.spawnEntity('infantry', TEAM_PLAYER, 7, 4); inf2.faction = 'allied';
    const inf3 = this.spawnEntity('infantry', TEAM_PLAYER, 7, 5); inf3.faction = 'allied';
    const inf4 = this.spawnEntity('infantry', TEAM_PLAYER, 8, 3); inf4.faction = 'allied';
    const inf5 = this.spawnEntity('infantry', TEAM_PLAYER, 8, 4); inf5.faction = 'allied';
    const inf6 = this.spawnEntity('infantry', TEAM_PLAYER, 9, 3); inf6.faction = 'allied';

    // 更多坦克
    const tank1 = this.spawnEntity('grizzly', TEAM_PLAYER, 8, 5); tank1.faction = 'allied';
    const tank2 = this.spawnEntity('grizzly', TEAM_PLAYER, 9, 5); tank2.faction = 'allied';
    const tank3 = this.spawnEntity('grizzly', TEAM_PLAYER, 9, 6); tank3.faction = 'allied';

    // 更多采矿车
    const harv = this.spawnEntity('harvester', TEAM_PLAYER, 7, 6);
    harv.faction = 'allied';
    const ore = this.map.findNearestOre(7, 6);
    if (ore.x >= 0) { harv.harvestTarget = ore; harv.path = this.map.findPath(7, 6, ore.x, ore.y); harv.pathIndex = 0; }

    const harv2 = this.spawnEntity('harvester', TEAM_PLAYER, 8, 6);
    harv2.faction = 'allied';
    const ore2 = this.map.findNearestOre(8, 6);
    if (ore2.x >= 0) { harv2.harvestTarget = ore2; harv2.path = this.map.findPath(8, 6, ore2.x, ore2.y); harv2.pathIndex = 0; }
    
    const harv3 = this.spawnEntity('harvester', TEAM_PLAYER, 9, 7);
    harv3.faction = 'allied';
    const ore3 = this.map.findNearestOre(9, 7);
    if (ore3.x >= 0) { harv3.harvestTarget = ore3; harv3.path = this.map.findPath(9, 7, ore3.x, ore3.y); harv3.pathIndex = 0; }
  }

  initEnemy(difficulty) {
    const bx = MAP_WIDTH - 7, by = MAP_HEIGHT - 7;

    // 敌人使用苏联阵营
    this.enemyFaction = FACTION_SOVIET;
    const eb = this.spawnEntity('base', TEAM_ENEMY, bx, by); eb.built = true;
    eb.faction = 'soviet';
    
    const pp = this.spawnEntity('powerPlant', TEAM_ENEMY, bx - 4, by); pp.built = true; pp.buildProgress = 100;
    pp.faction = 'soviet';
    
    const bar = this.spawnEntity('barracks', TEAM_ENEMY, bx - 4, by + 3); bar.built = true; bar.buildProgress = 100;
    bar.faction = 'soviet';
    
    const ref = this.spawnEntity('refinery', TEAM_ENEMY, bx, by - 4); ref.built = true; ref.buildProgress = 100;
    ref.faction = 'soviet';
    
    const wf = this.spawnEntity('warFactory', TEAM_ENEMY, bx + 3, by - 4); wf.built = true; wf.buildProgress = 100;
    wf.faction = 'soviet';
    
    // 苏联初始单位 - 使用动员兵
    for (let i = 0; i < 3; i++) {
      const con = this.spawnEntity('conscript', TEAM_ENEMY, bx - 2 + i, by - 2);
      con.faction = 'soviet';
    }
    
    // 使用犀牛坦克
    const tank = this.spawnEntity('rhino', TEAM_ENEMY, bx - 2, by + 6);
    tank.faction = 'soviet';
    
    // 苏联武装采矿车
    const eh = this.spawnEntity('warMiner', TEAM_ENEMY, bx + 5, by + 3);
    eh.faction = 'soviet';
    const eore = this.map.findNearestOre(bx + 5, by + 3);
    if (eore.x >= 0) { eh.harvestTarget = eore; eh.path = this.map.findPath(bx + 5, by + 3, eore.x, eore.y); }
    
    let diffMult = 1;
    if (difficulty === 'normal') diffMult = 1.2;
    else if (difficulty === 'hard') diffMult = 2.0;
    this.enemyCredits = Math.floor(2500 * diffMult);
  }
}

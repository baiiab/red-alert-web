import { MAP_WIDTH, MAP_HEIGHT, TEAM_PLAYER, TEAM_ENEMY, TILE_SIZE } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS } from './definitions.js';
import { Entity } from './Entity.js';
import { GameMap } from './GameMap.js';
import { SpatialGrid } from './SpatialGrid.js';

export class GameState {
  constructor() {
    this.map = new GameMap();
    this.entities = [];
    this.projectiles = [];
    this.explosions = [];
    this.floatingTexts = [];
    this.smokeParticles = [];
    this.minimapAlerts = [];
    this.playerCredits = 8000;
    this.enemyCredits = 3000;
    this.playerPower = 0;
    this.playerPowerUse = 0;
    this.enemyPower = 0;
    this.enemyPowerUse = 0;
    this.playerUnitCount = 0;
    this.playerUnitMax = 30;
    this.gameOver = false;
    this.winner = -1;
    this.hasRadar = false;
    this.hasTechCenter = false;
    this.controlGroups = {};
    this.stats = { unitsLost: 0, unitsKilled: 0, buildingsLost: 0, buildingsKilled: 0, oreGathered: 0 };
    this.lowPowerAlertCooldown = 0;
    this.underAttackAlertCooldown = 0;
    this._playExplosionSound = null;
    this.spatialGrid = new SpatialGrid(MAP_WIDTH, MAP_HEIGHT);
    this.spatialDirty = true;
    this._playerBuildings = null;
    this._enemyBuildings = null;
    this._playerUnits = null;
    this._enemyUnits = null;
    this._listDirty = true;
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

  getBuildReason(type, team) {
    const def = BUILDING_DEFS[type] || DEFENSE_DEFS[type] || UNIT_DEFS[type];
    if (!def) return '未知建筑';
    const credits = team === TEAM_PLAYER ? this.playerCredits : this.enemyCredits;
    if (credits < def.cost) return '资金不足 (需要 $' + def.cost + ')';
    if (def.requires) {
      for (let i = 0; i < def.requires.length; i++) {
        if (!this.hasBuilding(team, def.requires[i])) {
          const reqDef = BUILDING_DEFS[def.requires[i]] || DEFENSE_DEFS[def.requires[i]];
          return '需要 ' + ((reqDef && reqDef.name) || def.requires[i]);
        }
      }
    }
    if (def.category === 'units' && team === TEAM_PLAYER) {
      if (this.playerUnitCount >= this.playerUnitMax) return '单位上限已满';
      if (this.playerPower - this.playerPowerUse < 0) return '电力不足';
    }
    if ((def.category === 'buildings' || def.category === 'defenses') && team === TEAM_PLAYER) {
      if (def.powerUse > 0 && (this.playerPower - this.playerPowerUse) < def.powerUse) return '电力不足 (需要 ' + def.powerUse + '⚡)';
    }
    return '';
  }

  canBuild(type, team) {
    const def = BUILDING_DEFS[type] || DEFENSE_DEFS[type] || UNIT_DEFS[type];
    if (!def) return false;
    const credits = team === TEAM_PLAYER ? this.playerCredits : this.enemyCredits;
    if (credits < def.cost) return false;
    if (def.requires) {
      for (let i = 0; i < def.requires.length; i++) if (!this.hasBuilding(team, def.requires[i])) return false;
    }
    if (def.category === 'units' && team === TEAM_PLAYER) {
      if (this.playerUnitCount >= this.playerUnitMax) return false;
      if (this.playerPower - this.playerPowerUse < 0) return false;
    }
    if ((def.category === 'buildings' || def.category === 'defenses') && team === TEAM_PLAYER) {
      if (def.powerUse > 0 && (this.playerPower - this.playerPowerUse) < def.powerUse) return false;
    }
    return true;
  }

  spawnEntity(type, team, x, y) {
    const e = new Entity(type, team, x, y);
    this.entities.push(e);
    if (e.isBuilding) this.map.setOccupancy(e);
    this.spatialDirty = true;
    this._listDirty = true;
    return e;
  }

  removeEntity(entity) {
    if (entity.isBuilding) this.map.clearOccupancy(entity);
    entity.dead = true;
    entity.deathTimer = 45;
    this.spatialDirty = true;
    this._listDirty = true;
    if (entity.team === TEAM_PLAYER) {
      if (entity.isBuilding) this.stats.buildingsLost++; else this.stats.unitsLost++;
    } else {
      if (entity.isBuilding) this.stats.buildingsKilled++; else this.stats.unitsKilled++;
    }
  }

  getEntityAt(wx, wy) {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.dead) continue;
      if (e.isBuilding) {
        if (wx >= e.x * TILE_SIZE && wx < (e.x + e.size) * TILE_SIZE && wy >= e.y * TILE_SIZE && wy < (e.y + e.size) * TILE_SIZE) return e;
      } else {
        const ecx = e.getCenterX(), ecy = e.getCenterY();
        if (Math.hypot(wx - ecx, wy - ecy) < TILE_SIZE * 0.65) return e;
      }
    }
    return null;
  }

  getEntitiesInRect(x1, y1, x2, y2) {
    const r = [];
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.dead || e.team !== TEAM_PLAYER || e.isBuilding) continue;
      const ecx = e.getCenterX(), ecy = e.getCenterY();
      if (ecx >= x1 && ecx <= x2 && ecy >= y1 && ecy <= y2) r.push(e);
    }
    return r;
  }

  getEnemiesInRange(entity, range) {
    if (this.spatialDirty) { this.spatialGrid.update(this.entities); this.spatialDirty = false; }
    const r = [];
    const ex = entity.getCenterX(), ey = entity.getCenterY();
    const rp = range * TILE_SIZE;
    const nearby = this.spatialGrid.queryRange(ex / TILE_SIZE, ey / TILE_SIZE, range + 2);
    for (let i = 0; i < nearby.length; i++) {
      const e = nearby[i];
      if (e.team !== entity.team && !e.dead && e.built) {
        if (Math.hypot(ex - e.getCenterX(), ey - e.getCenterY()) <= rp) r.push(e);
      }
    }
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

  applySplashDamage(x, y, radius, damage, team) {
    const rp = radius * TILE_SIZE;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.team === team || e.dead) continue;
      const dx = e.getCenterX() - x, dy = e.getCenterY() - y;
      const d = Math.hypot(dx, dy);
      if (d <= rp) {
        const falloff = 1 - d / rp * 0.6;
        const dmg = Math.floor(damage * falloff);
        e.hp -= dmg;
        e.flashTimer = 5;
        if (dmg > 0) this.addFloatingText(e.getCenterX(), e.getCenterY() - 10, '-' + dmg, '#ff6b6b');
        if (e.hp <= 0) {
          this.addExplosion(e.getCenterX(), e.getCenterY(), 32, 'big');
          if (this._playExplosionSound) this._playExplosionSound();
          if (e.type === 'base') { this.gameOver = true; this.winner = team; }
          this.removeEntity(e);
        }
      }
    }
  }

  initPlayer() {
    this.spawnEntity('base', TEAM_PLAYER, 3, 3);
    const pp = this.spawnEntity('powerPlant', TEAM_PLAYER, 3, 6); pp.built = true; pp.buildProgress = 100;
    this.spawnEntity('infantry', TEAM_PLAYER, 7, 3);
    this.spawnEntity('infantry', TEAM_PLAYER, 7, 4);
    this.spawnEntity('infantry', TEAM_PLAYER, 7, 5);
    this.spawnEntity('infantry', TEAM_PLAYER, 8, 3);
    this.spawnEntity('tank', TEAM_PLAYER, 8, 5);
    const harv = this.spawnEntity('harvester', TEAM_PLAYER, 7, 6);
    const ore = this.map.findNearestOre(7, 6);
    if (ore.x >= 0) { harv.harvestTarget = ore; harv.path = this.map.findPath(7, 6, ore.x, ore.y); harv.pathIndex = 0; }
    const harv2 = this.spawnEntity('harvester', TEAM_PLAYER, 8, 6);
    const ore2 = this.map.findNearestOre(8, 6);
    if (ore2.x >= 0) { harv2.harvestTarget = ore2; harv2.path = this.map.findPath(8, 6, ore2.x, ore2.y); harv2.pathIndex = 0; }
  }

  initEnemy(difficulty) {
    const bx = MAP_WIDTH - 7, by = MAP_HEIGHT - 7;
    const eb = this.spawnEntity('base', TEAM_ENEMY, bx, by); eb.built = true;
    const pp = this.spawnEntity('powerPlant', TEAM_ENEMY, bx - 4, by); pp.built = true; pp.buildProgress = 100;
    const bar = this.spawnEntity('barracks', TEAM_ENEMY, bx - 4, by + 3); bar.built = true; bar.buildProgress = 100;
    const ref = this.spawnEntity('refinery', TEAM_ENEMY, bx, by - 4); ref.built = true; ref.buildProgress = 100;
    const wf = this.spawnEntity('warFactory', TEAM_ENEMY, bx + 3, by - 4); wf.built = true; wf.buildProgress = 100;
    for (let i = 0; i < 3; i++) this.spawnEntity('infantry', TEAM_ENEMY, bx - 2 + i, by - 2);
    this.spawnEntity('tank', TEAM_ENEMY, bx - 2, by + 6);
    const eh = this.spawnEntity('harvester', TEAM_ENEMY, bx + 5, by + 3);
    const eore = this.map.findNearestOre(bx + 5, by + 3);
    if (eore.x >= 0) { eh.harvestTarget = eore; eh.path = this.map.findPath(bx + 5, by + 3, eore.x, eore.y); }
    let diffMult = 1;
    if (difficulty === 'normal') diffMult = 1.2;
    else if (difficulty === 'hard') diffMult = 2.0;
    this.enemyCredits = Math.floor(2500 * diffMult);
  }
}

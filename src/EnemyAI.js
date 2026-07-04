import { TEAM_PLAYER, TEAM_ENEMY, MAP_WIDTH, MAP_HEIGHT, CONCRETE } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS } from './definitions.js';

export class EnemyAI {
  constructor() {
    this.aiTimer = 0;
    this.buildQueue = [];
    this.attackTimer = 0;
    this.attackWave = 0;
    this.scoutTimer = 0;
    this._callbacks = null;
  }

  init(callbacks) {
    this._callbacks = callbacks;
  }

  update(gameState, difficulty, frameCount) {
    var diffMult = 1, buildInterval = 180, attackInterval = 1200;
    if (difficulty === 'normal') { diffMult = 1.3; buildInterval = 120; attackInterval = 900; }
    else if (difficulty === 'hard') { diffMult = 2.2; buildInterval = 65; attackInterval = 550; }
    if (frameCount % 30 === 0) gameState.enemyCredits += Math.floor((25 + this.attackWave * 8) * diffMult);
    this.aiTimer++;
    if (this.aiTimer >= buildInterval) {
      this.aiTimer = 0;
      this.buildPhase(gameState, difficulty);
      this.productionPhase(gameState, difficulty);
      this.defensePhase(gameState, difficulty);
    }
    this.attackTimer++;
    if (this.attackTimer >= attackInterval) {
      this.attackTimer = 0;
      this.attackWave++;
      this.launchAttack(gameState);
    }
    this.scoutTimer++;
    if (this.scoutTimer >= 1800 && this.attackWave < 3) {
      this.scoutTimer = 0;
      var idleE = gameState.getEnemyUnits().filter(function(u) { return u.type2 !== 'harvester' && !u.attackTarget; });
      if (idleE.length > 2) {
        var scouts = idleE.slice(0, 2);
        var pBs = gameState.getPlayerBuildings();
        if (pBs.length > 0) {
          var tgt = pBs[Math.floor(Math.random() * pBs.length)];
          scouts.forEach(function(u) { u.attackTarget = tgt; });
        }
      }
    }
    if (this._callbacks && this._callbacks.updateUnitAI) {
      var eu = gameState.getEnemyUnits();
      for (var i = 0; i < eu.length; i++) {
        if (!eu[i].dead) this._callbacks.updateUnitAI(eu[i]);
      }
    }
  }

  buildPhase(gameState, difficulty) {
    var self = this;
    if (this.buildQueue.length > 0) {
      var nb = this.buildQueue[0];
      if (gameState.canBuild(nb, TEAM_ENEMY)) {
        var pos = this.findBuildPosition(nb, TEAM_ENEMY, gameState);
        if (pos) {
          this.buildQueue.shift();
          var def2 = BUILDING_DEFS[nb] || DEFENSE_DEFS[nb];
          gameState.enemyCredits -= def2.cost;
          var newB = gameState.spawnEntity(nb, TEAM_ENEMY, pos.x, pos.y);
          for (var ci = 0; ci < newB.size; ci++) for (var cj = 0; cj < newB.size; cj++) {
            if (pos.y + ci < MAP_HEIGHT && pos.x + cj < MAP_WIDTH) gameState.map.terrain[pos.y + ci][pos.x + cj] = CONCRETE;
          }
        }
      }
    }
    var qHas = function(t) { return self.buildQueue.indexOf(t) >= 0; };
    if (!gameState.hasBuilding(TEAM_ENEMY, 'powerPlant') && gameState.enemyCredits >= 300 && !qHas('powerPlant')) this.buildQueue.push('powerPlant');
    if (!gameState.hasBuilding(TEAM_ENEMY, 'refinery') && gameState.enemyCredits >= 500 && !qHas('refinery')) this.buildQueue.push('refinery');
    if (!gameState.hasBuilding(TEAM_ENEMY, 'barracks') && gameState.hasBuilding(TEAM_ENEMY, 'powerPlant') && gameState.enemyCredits >= 400 && !qHas('barracks')) this.buildQueue.push('barracks');
    if (!gameState.hasBuilding(TEAM_ENEMY, 'warFactory') && gameState.hasBuilding(TEAM_ENEMY, 'barracks') && gameState.enemyCredits >= 700 && !qHas('warFactory')) this.buildQueue.push('warFactory');
    if (!gameState.hasBuilding(TEAM_ENEMY, 'radar') && gameState.hasBuilding(TEAM_ENEMY, 'powerPlant') && gameState.enemyCredits >= 600 && !qHas('radar')) this.buildQueue.push('radar');
    if (!gameState.hasBuilding(TEAM_ENEMY, 'techCenter') && gameState.hasBuilding(TEAM_ENEMY, 'radar') && gameState.hasBuilding(TEAM_ENEMY, 'warFactory') && gameState.enemyCredits >= 1200 && !qHas('techCenter')) this.buildQueue.push('techCenter');
    var surplus = gameState.enemyPower - gameState.enemyPowerUse;
    if (surplus < 30 && gameState.enemyCredits >= 300 && !qHas('powerPlant')) this.buildQueue.push('powerPlant');
    if (difficulty === 'hard' && gameState.hasBuilding(TEAM_ENEMY, 'refinery')) {
      var refs = gameState.entities.filter(function(e) { return e.team === TEAM_ENEMY && e.type === 'refinery' && !e.dead; }).length;
      if (refs < 2 && gameState.enemyCredits >= 500 && !qHas('refinery')) this.buildQueue.push('refinery');
    }
  }

  productionPhase(gameState, difficulty) {
    var harvCount = gameState.getEnemyUnits().filter(function(u) { return u.type2 === 'harvester'; }).length;
    var targetHarv = difficulty === 'hard' ? 4 : (difficulty === 'normal' ? 3 : 2);
    if (harvCount < targetHarv && gameState.hasBuilding(TEAM_ENEMY, 'refinery') && gameState.enemyCredits >= 600) {
      var refB = this.findBuilding('refinery', TEAM_ENEMY, gameState.entities);
      if (refB && !refB.producing) { gameState.enemyCredits -= 600; refB.producing = 'harvester'; refB.produceProgress = 0; }
    }
    var iBar = this.findBuilding('barracks', TEAM_ENEMY, gameState.entities);
    if (iBar && !iBar.producing && gameState.enemyCredits >= 100) {
      var roll = Math.random();
      var uc2;
      if (gameState.enemyCredits >= 300 && roll > 0.85) uc2 = 'engineer';
      else if (gameState.enemyCredits >= 200 && roll > 0.55) uc2 = 'rocket';
      else uc2 = 'infantry';
      if (UNIT_DEFS[uc2].cost <= gameState.enemyCredits) { gameState.enemyCredits -= UNIT_DEFS[uc2].cost; iBar.producing = uc2; iBar.produceProgress = 0; }
    }
    var wfB = this.findBuilding('warFactory', TEAM_ENEMY, gameState.entities);
    if (wfB && !wfB.producing && gameState.enemyCredits >= 500) {
      var vc = 'tank', vRoll = Math.random();
      if (gameState.hasBuilding(TEAM_ENEMY, 'techCenter') && gameState.enemyCredits >= 1100 && vRoll > 0.75) vc = 'mlrs';
      else if (gameState.hasBuilding(TEAM_ENEMY, 'techCenter') && gameState.enemyCredits >= 900 && vRoll > 0.45) vc = 'heavyTank';
      else if (gameState.enemyCredits >= 700 && vRoll > 0.6) vc = 'arty';
      else if (gameState.enemyCredits >= 500 && vRoll > 0.4) vc = 'apc';
      if (UNIT_DEFS[vc].cost <= gameState.enemyCredits) { gameState.enemyCredits -= UNIT_DEFS[vc].cost; wfB.producing = vc; wfB.produceProgress = 0; }
    }
  }

  defensePhase(gameState, difficulty) {
    if (Math.random() > 0.5 && gameState.enemyCredits >= 300) {
      var dc = 'pillbox', dRoll = Math.random();
      if (gameState.hasBuilding(TEAM_ENEMY, 'techCenter') && gameState.enemyCredits >= 1500 && dRoll > 0.8) dc = 'tesla';
      else if (gameState.hasBuilding(TEAM_ENEMY, 'warFactory') && gameState.enemyCredits >= 600 && dRoll > 0.4) dc = 'turret';
      var dpos = this.findBuildPosition(dc, TEAM_ENEMY, gameState);
      if (dpos && gameState.canBuild(dc, TEAM_ENEMY)) {
        gameState.enemyCredits -= DEFENSE_DEFS[dc].cost;
        gameState.spawnEntity(dc, TEAM_ENEMY, dpos.x, dpos.y);
        if (dpos.y < MAP_HEIGHT && dpos.x < MAP_WIDTH) gameState.map.terrain[dpos.y][dpos.x] = CONCRETE;
      }
    }
  }

  launchAttack(gameState) {
    var idle = gameState.getEnemyUnits().filter(function(u) { return u.type2 !== 'harvester' && !u.attackTarget && !u.attackMoveTarget; });
    if (idle.length < 3) return;
    var force = Math.min(idle.length, Math.floor(3 + this.attackWave * 1.5));
    var atk = idle.slice(0, force);
    var pBs = gameState.getPlayerBuildings();
    if (pBs.length === 0) return;
    var pri = pBs.filter(function(b) { return b.type === 'powerPlant' || b.type === 'refinery' || b.type === 'base'; });
    var target = pri.length > 0 ? pri[Math.floor(Math.random() * pri.length)] : pBs[Math.floor(Math.random() * pBs.length)];
    atk.forEach(function(u) {
      u.attackTarget = target;
      u.attackMoveTarget = { x: Math.floor(target.x), y: Math.floor(target.y) };
    });
    if (force >= 6) {
      if (this._callbacks && this._callbacks.notify) this._callbacks.notify('\u8b66\u544a: \u654c\u519b\u5927\u89c4\u6a21\u8fdb\u653b\uff01', 'danger');
      if (this._callbacks && this._callbacks.playAlertSound) this._callbacks.playAlertSound();
      gameState.addMinimapAlert(atk[0].x, atk[0].y, '#e74c3c');
    } else if (force >= 3 && gameState.underAttackAlertCooldown === 0) {
      if (this._callbacks && this._callbacks.notify) this._callbacks.notify('\u8b66\u544a: \u654c\u519b\u6765\u88ad\uff01', 'warn');
      if (this._callbacks && this._callbacks.playAlertSound) this._callbacks.playAlertSound();
      gameState.underAttackAlertCooldown = 300;
    }
  }

  findBuilding(type, team, entities) {
    for (var i = 0; i < entities.length; i++) {
      var e = entities[i];
      if (e.team === team && e.type === type && e.built && !e.dead) return e;
    }
    return null;
  }

  findBuildPosition(type, team, gameState) {
    var def = BUILDING_DEFS[type] || DEFENSE_DEFS[type];
    if (!def) return null;
    var bases = gameState.entities.filter(function(e) { return e.team === team && e.isBuilding && e.built && !e.dead; });
    if (bases.length === 0) return null;
    var center = bases[Math.floor(Math.random() * Math.min(3, bases.length))];
    for (var a = 0; a < 100; a++) {
      var ox = Math.floor(Math.random() * 22) - 11;
      var oy = Math.floor(Math.random() * 22) - 11;
      var px = Math.floor(center.x) + ox, py = Math.floor(center.y) + oy;
      if (px < 1 || py < 1 || px + def.size > MAP_WIDTH - 1 || py + def.size > MAP_HEIGHT - 1) continue;
      if (gameState.map.isBuildable(px, py, def.size) && gameState.map.isNearBuilding(px, py, def.size, team)) return { x: px, y: py };
    }
    return null;
  }
}

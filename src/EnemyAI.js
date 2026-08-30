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
    // 极度降低难度：AI几乎不发展，攻击极弱
    var diffMult = 0.15, buildInterval = 800, attackInterval = 5000;
    if (difficulty === 'normal') { diffMult = 0.3; buildInterval = 600; attackInterval = 4000; }
    else if (difficulty === 'hard') { diffMult = 0.8; buildInterval = 300; attackInterval = 2000; }
    // AI资源获取极慢
    if (frameCount % 60 === 0) gameState.enemyCredits += Math.floor((5 + this.attackWave) * diffMult);
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
    if (frameCount % 300 === 0) this.superWeaponPhase(gameState);
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
    // 苏联科技中心
    if (!gameState.hasBuilding(TEAM_ENEMY, 'sovietTech') && gameState.hasBuilding(TEAM_ENEMY, 'radar') && gameState.hasBuilding(TEAM_ENEMY, 'warFactory') && gameState.enemyCredits >= 1200 && !qHas('sovietTech')) this.buildQueue.push('sovietTech');
    // 超级武器（简单难度不造）
    if (difficulty !== 'easy' && gameState.hasBuilding(TEAM_ENEMY, 'sovietTech') && !gameState.hasBuilding(TEAM_ENEMY, 'nukeSilo') && gameState.enemyCredits >= 3000 && !qHas('nukeSilo')) this.buildQueue.push('nukeSilo');
    if (difficulty === 'hard' && gameState.hasBuilding(TEAM_ENEMY, 'sovietTech') && !gameState.hasBuilding(TEAM_ENEMY, 'ironCurtain') && gameState.enemyCredits >= 2500 && !qHas('ironCurtain')) this.buildQueue.push('ironCurtain');
    var surplus = gameState.enemyPower - gameState.enemyPowerUse;
    if (surplus < 30 && gameState.enemyCredits >= 300 && !qHas('powerPlant')) this.buildQueue.push('powerPlant');
    if (difficulty === 'hard' && gameState.hasBuilding(TEAM_ENEMY, 'refinery')) {
      var refs = gameState.entities.filter(function(e) { return e.team === TEAM_ENEMY && e.type === 'refinery' && !e.dead; }).length;
      if (refs < 2 && gameState.enemyCredits >= 500 && !qHas('refinery')) this.buildQueue.push('refinery');
    }
  }

  productionPhase(gameState, difficulty) {
    // 降低难度：减少采矿车数量
    var harvCount = gameState.getEnemyUnits().filter(function(u) { return u.type2 === 'harvester'; }).length;
    var targetHarv = difficulty === 'hard' ? 3 : (difficulty === 'normal' ? 2 : 1);
    // 苏联用武装采矿车（warMiner），原先造的是盟军的超时空采矿车，且扣费写死 600 与造价 1400 不符
    var harvType = 'warMiner';
    var harvDef = UNIT_DEFS[harvType];
    if (harvCount < targetHarv && gameState.hasBuilding(TEAM_ENEMY, 'refinery') && gameState.enemyCredits >= harvDef.cost) {
      var refB = this.findBuilding('refinery', TEAM_ENEMY, gameState.entities);
      if (refB && !refB.producing) { gameState.enemyCredits -= harvDef.cost; refB.producing = harvType; refB.produceProgress = 0; }
    }
    
    // 降低难度：减少步兵生产频率
    var iBar = this.findBuilding('barracks', TEAM_ENEMY, gameState.entities);
    if (iBar && !iBar.producing && gameState.enemyCredits >= 80 && Math.random() > 0.4) {
      var roll = Math.random();
      var uc2;
      // 苏联步兵选择 - 更多动员兵，更少高级单位
      if (gameState.enemyCredits >= 300 && roll > 0.92) uc2 = 'engineer';
      else if (gameState.enemyCredits >= 200 && roll > 0.75) uc2 = 'flakTrooper'; // 防空步兵
      else uc2 = 'conscript'; // 动员兵
      
      if (UNIT_DEFS[uc2] && UNIT_DEFS[uc2].cost <= gameState.enemyCredits) { 
        gameState.enemyCredits -= UNIT_DEFS[uc2].cost; 
        iBar.producing = uc2; 
        iBar.produceProgress = 0; 
      }
    }
    
    // 降低难度：减少坦克生产频率和高级单位概率
    var wfB = this.findBuilding('warFactory', TEAM_ENEMY, gameState.entities);
    if (wfB && !wfB.producing && gameState.enemyCredits >= 500 && Math.random() > 0.3) {
      // 苏联阵营单位选择 - 降低高级单位概率
      var vc = 'rhino', vRoll = Math.random(); // 默认犀牛坦克
      if (gameState.hasBuilding(TEAM_ENEMY, 'sovietTech') && gameState.enemyCredits >= 1750 && vRoll > 0.92) vc = 'apocalypse'; // 天启
      else if (gameState.hasBuilding(TEAM_ENEMY, 'sovietTech') && gameState.enemyCredits >= 800 && vRoll > 0.75) vc = 'v3'; // V3火箭
      else if (gameState.enemyCredits >= 600 && vRoll > 0.65) vc = 'flakTrack'; // 防空履带车
      
      // 检查单位定义是否存在
      if (UNIT_DEFS[vc] && UNIT_DEFS[vc].cost <= gameState.enemyCredits) { 
        gameState.enemyCredits -= UNIT_DEFS[vc].cost; 
        wfB.producing = vc; 
        wfB.produceProgress = 0; 
      }
    }
  }

  defensePhase(gameState, difficulty) {
    // 降低难度：减少防御建筑建造频率
    if (Math.random() > 0.7 && gameState.enemyCredits >= 300) {
      var dc = 'pillbox', dRoll = Math.random();
      if (gameState.hasBuilding(TEAM_ENEMY, 'sovietTech') && gameState.enemyCredits >= 1200 && dRoll > 0.9) dc = 'tesla';
      else if (gameState.hasBuilding(TEAM_ENEMY, 'warFactory') && gameState.enemyCredits >= 600 && dRoll > 0.6) dc = 'turret';
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
    // 极度降低难度：需要极多单位才会攻击，攻击规模极小
    if (idle.length < 12) return;
    // 攻击规模极小，几乎不增长
    var force = Math.min(idle.length, Math.floor(1 + this.attackWave * 0.3));
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

  superWeaponPhase(gameState) {
    var swm = gameState.superWeaponManager;
    if (!swm || swm.enemySuperWeapons.size === 0) return;
    swm.enemySuperWeapons.forEach(function(weapon, type) {
      if (!weapon.ready) return;
      if (type === 'nuke' || type === 'lightningStorm') {
        var pBs = gameState.getPlayerBuildings();
        if (pBs.length === 0) return;
        var tgt = pBs[Math.floor(Math.random() * pBs.length)];
        swm.useSuperWeapon(type, TEAM_ENEMY, Math.floor(tgt.x), Math.floor(tgt.y));
      } else if (type === 'ironCurtain') {
        var units = gameState.getEnemyUnits().filter(function(u) { return u.type2 !== 'harvester'; });
        if (units.length < 3) return;
        var cx = 0, cy = 0;
        for (var i = 0; i < units.length; i++) { cx += units[i].x; cy += units[i].y; }
        swm.useSuperWeapon(type, TEAM_ENEMY, Math.floor(cx / units.length), Math.floor(cy / units.length));
      } else if (type === 'chrono') {
        var movers = gameState.getEnemyUnits().filter(function(u) { return u.type2 !== 'harvester' && !u.attackTarget; });
        var pBs2 = gameState.getPlayerBuildings();
        if (movers.length < 4 || pBs2.length === 0) return;
        var cx2 = 0, cy2 = 0;
        for (var j = 0; j < movers.length; j++) { cx2 += movers[j].x; cy2 += movers[j].y; }
        if (swm.useSuperWeapon(type, TEAM_ENEMY, Math.floor(cx2 / movers.length), Math.floor(cy2 / movers.length))) {
          var pending = swm.getPendingChrono(TEAM_ENEMY);
          var dest = pBs2[Math.floor(Math.random() * pBs2.length)];
          if (pending) swm.completeChronoShift(pending, Math.floor(dest.x), Math.floor(dest.y));
        }
      }
    });
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

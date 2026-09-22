// 建筑与生产：建造进度、出兵落点、维修站、生产者查找
//
// 从 main.js 拆出。

import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, TEAM_PLAYER, TEAM_ENEMY,
         GRASS, WATER, ORE, ROCK, CONCRETE, SAND, TREE, FPS } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS } from './definitions.js';
import { notify } from './Notifications.js';
import { audioManager } from './AudioManager.js';
import { REPAIR_BAY_RANGE, REPAIR_BAY_HEAL, PRODUCER_BUILDINGS } from './GameTuning.js';
import { pickAttackTarget, performAttack } from './Combat.js';

export function updateBuildingAI(gameState, e, frameCount) {
  if (!e.built) {
    e.buildProgress += 100 / (e.buildTime * 60);
    if (e.buildProgress >= 100) {
      e.buildProgress = 100;
      e.built = true;
      // 幂等补占用：保证「存在的建筑必占格」这个不变量，任何新增的建造路径都不会漏
      gameState.map.setOccupancy(e);
      if (e.team === TEAM_PLAYER) { notify(e.name + ' \u5efa\u9020\u5b8c\u6210', 'info'); audioManager.playBuild(); }
    }
    return;
  }
  if (DEFENSE_DEFS[e.type] && e.damage > 0) {
    if (e.fireCooldown > 0) e.fireCooldown--;
    // 瞄准与开火共用一次邻域查询；按 canAttack 过滤（对空/弹药等）
    if (e.fireCooldown <= 0 || frameCount % 6 === 0) {
      var dd = DEFENSE_DEFS[e.type];
      var enemies = gameState.getEnemiesInRange(e, e.range);
      var tgt = null, bd = Infinity;
      for (var ei = 0; ei < enemies.length; ei++) {
        var cand = enemies[ei];
        if (!e.canAttack(cand)) continue;
        // 防空专用建筑只打空中目标
        if (dd.antiAir && !cand.isAirUnit) continue;
        var cdx = cand.x - e.x, cdy = cand.y - e.y;
        var d = cdx * cdx + cdy * cdy; // 只比远近，平方即可
        if (d < bd) { bd = d; tgt = cand; }
      }
      if (tgt) {
        // 磁暴线圈耗电极大：基地电力不足时无法开火（红警2 设定）
        var powered = true;
        if (e.type === 'tesla') {
          powered = e.team === TEAM_PLAYER
            ? (gameState.playerPower >= gameState.playerPowerUse)
            : (gameState.enemyPower >= gameState.enemyPowerUse);
        }
        if (powered) {
          e.renderTurretAngle = Math.atan2(tgt.getCenterY() / TILE_SIZE - e.y - e.size / 2,
                                           tgt.getCenterX() / TILE_SIZE - e.x - e.size / 2);
          if (e.fireCooldown <= 0) performAttack(gameState, e, tgt);
        }
      }
    }
  }
  if (e.producing) {
    var pd = UNIT_DEFS[e.producing];
    if (pd) {
      // 人口已满时暂停生产而不是硬造出来撑爆上限（红警2 行为）
      if (e.team === TEAM_PLAYER && gameState.playerUnitCount >= gameState.playerUnitMax) {
        if (frameCount % 300 === 0) notify('\u4eba\u53e3\u5df2\u6ee1\uff0c\u751f\u4ea7\u6682\u505c\u4e2d', 'warn');
      } else {
        e.produceProgress += 100 / (pd.buildTime * 60);
        if (e.produceProgress >= 100) {
          spawnProducedUnit(gameState, e);
          if (e.team === TEAM_PLAYER) { notify(pd.name + ' \u8bad\u7ec3\u5b8c\u6210', 'info'); audioManager.playReady(); }
          e.producing = null;
          e.produceProgress = 0;
          if (e.productionQueue.length > 0) {
            var next = e.productionQueue.shift();
            var nextDef = UNIT_DEFS[next];
            if (nextDef) { e.producing = next; e.produceProgress = 0; }
          }
        }
      }
    }
  }
}

export function updateRepairBays(gameState, frameCount) {
  if (frameCount % 6 !== 0) return;
  var bays = gameState.entities.filter(function(e) { return e.type === 'repairBay' && e.built && !e.dead; });
  if (bays.length === 0) return;
  for (var b = 0; b < bays.length; b++) {
    var bay = bays[b];
    for (var i = 0; i < gameState.entities.length; i++) {
      var e = gameState.entities[i];
      if (e.team !== bay.team || e.isBuilding || e.dead) continue;
      // 红警2 的维修站只修地面车辆，步兵与飞机不在服务范围内
      if (e.type2 !== 'vehicle' || e.hp >= e.maxHp) continue;
      var bdx = e.x - bay.x - bay.size / 2, bdy = e.y - bay.y - bay.size / 2;
      if (bdx * bdx + bdy * bdy > REPAIR_BAY_RANGE * REPAIR_BAY_RANGE) continue;
      e.hp = Math.min(e.maxHp, e.hp + REPAIR_BAY_HEAL);
      if (frameCount % 24 === 0) {
        gameState.addFloatingText(e.getCenterX(), e.getCenterY() - 12, '+' + REPAIR_BAY_HEAL, '#2ecc71');
      }
    }
  }
}

export function spawnProducedUnit(gameState, building) {
  var type = building.producing;
  var bx = Math.floor(building.x), by = Math.floor(building.y), size = building.size;
  var cx = bx + size / 2, cy = by + size / 2;

  // 在建筑外圈 2 格内找最近的可通行落点。原先只扫紧贴的一圈，找不到时回退到
  // 建筑自身的格子，工厂被围死时新单位会卡死在建筑里，表现为「造不出兵」
  var best = null, bestD = Infinity;
  for (var dy = -2; dy < size + 2; dy++) {
    for (var dx = -2; dx < size + 2; dx++) {
      if (dx >= 0 && dx < size && dy >= 0 && dy < size) continue; // 跳过建筑自身占地
      var px = bx + dx, py = by + dy;
      if (px < 0 || px >= MAP_WIDTH || py < 0 || py >= MAP_HEIGHT) continue;
      if (!gameState.map.isPassable(px, py)) continue;
      var d = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      if (d < bestD) { bestD = d; best = { x: px, y: py }; }
    }
  }
  var sx = best ? best.x : Math.max(0, Math.min(MAP_WIDTH - 1, bx + size));
  var sy = best ? best.y : Math.max(0, Math.min(MAP_HEIGHT - 1, by));

  var nu = gameState.spawnEntity(type, building.team, sx, sy);

  // 继承建筑的阵营
  nu.faction = building.faction;

  if (type === 'harvester' || type === 'warMiner') {
    var ore = gameState.map.findNearestOre(sx, sy);
    if (ore.x >= 0) { nu.harvestTarget = ore; nu.path = gameState.map.findPath(sx, sy, ore.x, ore.y); nu.pathIndex = 0; }
    return;
  }

  // 战斗单位：前往集结点，抵达后自动转入守卫（红警2 行为）。
  // 没有集结点时直接在出厂位置守卫，避免新兵站着挨打
  if (building.rallyPoint) {
    nu.path = gameState.map.findPath(sx, sy, building.rallyPoint.x, building.rallyPoint.y);
    nu.pathIndex = 0;
    nu.autoGuard = true;
  } else {
    nu.guardPos = { x: sx, y: sy };
  }
}

export function findProducingBuilding(gameState, type, team) {
  var def = UNIT_DEFS[type];
  if (!def) return null;
  var fallback = null;
  for (var i = 0; i < gameState.entities.length; i++) {
    var e = gameState.entities[i];
    if (e.team === team && e.built && !e.dead && e.isBuilding) {
      if (PRODUCER_BUILDINGS.indexOf(e.type) < 0) continue;
      // 采矿车（含苏联武装采矿车）由矿厂产出，其余按 requires 中的生产建筑匹配
      var match = (def.type === 'harvester' && e.type === 'refinery') ||
                  (def.requires && def.requires.indexOf(e.type) >= 0);
      if (match) {
        if (!e.producing) return e;
        if (!fallback) fallback = e;
      }
    }
  }
  return fallback;
}

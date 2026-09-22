// 单位 AI：寻路移动、采矿车行为、间谍渗透、守卫与自动交战
//
// 从 main.js 拆出。updateUnitAI 是全局最大的函数（约 200 行），
// 本次只做搬迁、逻辑未改，便于后续单独迭代。

import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, TEAM_PLAYER, TEAM_ENEMY,
         GRASS, WATER, ORE, ROCK, CONCRETE, SAND, TREE, FPS } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS } from './definitions.js';
import { notify } from './Notifications.js';
import { audioManager } from './AudioManager.js';
import { GUARD_CHASE_RANGE, SPY_INFILTRATE_DIST, SPY_BLACKOUT_FRAMES } from './GameTuning.js';
import { pickAttackTarget, performAttack, performBurstShot } from './Combat.js';

export function updateUnitAI(gameState, unit, frameCount) {
  if (unit.chronoStun > 0) return; // 超时空传送后的短暂眩晕
  if (updateSpyInfiltration(gameState, unit)) return; // 间谍：触碰到敌方建筑即渗透并消失
  if (unit.type2 === 'harvester') { updateHarvesterAI(gameState, unit); return; }
  // 空军：弹药耗尽自动返场（最近基地/矿厂）补充
  if (unit.isAirUnit) {
    if (unit.ammo !== null && unit.ammo <= 0) unit.returningToBase = true;
    if (unit.returningToBase) {
      var hq = gameState.map.findNearestRefinery(unit.x, unit.y, unit.team, gameState.getRefineries(unit.team));
      if (!hq) { unit.returningToBase = false; return; }
      var hqX = Math.floor(hq.x) + Math.floor(hq.size / 2);
      var hqY = Math.floor(hq.y) + Math.floor(hq.size / 2);
      var hdx = unit.x - hqX, hdy = unit.y - hqY;
      if (hdx * hdx + hdy * hdy < 1.5 * 1.5) {
        unit.reload();
        unit.path = []; unit.pathIndex = 0;
        return;
      }
      unit.path = [{ x: hqX, y: hqY }];
      unit.pathIndex = 0;
      moveUnit(gameState, unit);
      return;
    }
  }
  if (unit.canRepair && unit.attackTarget && unit.attackTarget.isBuilding) {
    var tgt = unit.attackTarget;
    if (tgt.dead) { unit.attackTarget = null; unit.path = []; unit.pathIndex = 0; return; }
    var rdx = unit.x - (tgt.x + tgt.size / 2), rdy = unit.y - (tgt.y + tgt.size / 2);
    var rd2 = rdx * rdx + rdy * rdy;
    // 尺寸 3 的建筑（建造厂/矿厂/战车工厂）中心距相邻格恰好 2.0，固定 <2 永远差一步够不着
    var reach = tgt.size / 2 + 1.5;
    if (rd2 < reach * reach) {
      if (tgt.team === unit.team && tgt.hp < tgt.maxHp) {
        tgt.hp = Math.min(tgt.maxHp, tgt.hp + 5);
        if (frameCount % 18 === 0) gameState.addFloatingText(tgt.getCenterX(), tgt.getCenterY() - 10, '+5', '#2ecc71');
        if (tgt.hp >= tgt.maxHp) unit.attackTarget = null;
      } else if (tgt.team === unit.team) {
        // 己方且已满血：必须解除目标，否则工程师会永远守在这座建筑旁，
        // 既不修别的建筑也不响应新指令（下方「自动找受损建筑」要求 attackTarget 为空）
        unit.attackTarget = null;
        unit.path = [];
        unit.pathIndex = 0;
      } else {
        if (unit.team === TEAM_PLAYER) notify('\u5360\u9886\u4e86 ' + tgt.name + '\uff01', 'info');
        gameState.map.clearOccupancy(tgt);
        tgt.team = unit.team;
        // 占领会改变建筑归属，精炼厂缓存需失效并重算
        if (tgt.type === 'refinery' || tgt.type === 'base') gameState._refineryDirty = true;
        tgt.hp = Math.max(tgt.hp, tgt.maxHp * 0.5);
        gameState.map.setOccupancy(tgt);
        unit.dead = true;
        unit.deathTimer = 1;
        unit.attackTarget = null;
      }
      return;
    } else {
      if (unit.path.length === 0 || unit.pathIndex >= unit.path.length || unit.pathRecalcTimer <= 0) {
        unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), Math.floor(tgt.x + tgt.size / 2), Math.floor(tgt.y + tgt.size / 2));
        unit.pathIndex = 0;
        unit.pathRecalcTimer = 60;
        // 寻路返回空 ⇒ 目标不可达（findPath 不可达时会退回「最近点路径」，
        // 返回空说明连一步都走不了）。此时 moveUnit 会空转，工程师永远卡住。
        // 连续两次失败就放弃该目标，让下一条指令或自动搜寻能接手。
        if (unit.path.length === 0) {
          unit._repairFails = (unit._repairFails || 0) + 1;
          if (unit._repairFails >= 2) {
            unit._repairFails = 0;
            unit.attackTarget = null;
            unit.pathRecalcTimer = 0;
            return;
          }
        } else {
          unit._repairFails = 0;
        }
      } else {
        unit._repairFails = 0;
      }
      moveUnit(gameState, unit);
      return;
    }
  }
  if (unit.burstRemaining > 0 && unit.burstTarget && !unit.burstTarget.dead && unit.fireCooldown <= 0) {
    var bt = unit.burstTarget;
    var bdx = unit.x + 0.5 - bt.getCenterX() / TILE_SIZE, bdy = unit.y + 0.5 - bt.getCenterY() / TILE_SIZE;
    if (bdx * bdx + bdy * bdy <= unit.range * unit.range) {
      performBurstShot(gameState, unit, bt);
      unit.burstRemaining--;
      if (unit.burstRemaining === 0) unit.burstTarget = null;
    } else { unit.burstRemaining = 0; unit.burstTarget = null; }
  }

  if (unit.attackTarget) {
    if (unit.attackTarget.dead) {
      if (unit.attackMoveTarget) {
        var newT = pickAttackTarget(unit, gameState.getEnemiesInRange(unit, unit.range + 2));
        if (newT) unit.attackTarget = newT;
        else { unit.attackTarget = null; unit.path = []; unit.pathIndex = 0; }
      } else { unit.attackTarget = null; unit.path = []; unit.pathIndex = 0; }
      return;
    }
    var atX = unit.attackTarget.x + (unit.attackTarget.isBuilding ? unit.attackTarget.size / 2 : 0.5);
    var atY = unit.attackTarget.y + (unit.attackTarget.isBuilding ? unit.attackTarget.size / 2 : 0.5);
    var adx = unit.x + 0.5 - atX, ady = unit.y + 0.5 - atY;
    if (adx * adx + ady * ady <= unit.range * unit.range && unit.damage > 0) {
      unit.path = [];
      unit.pathIndex = 0;
      unit.turretDir = Math.atan2(atY - unit.y - 0.5, atX - unit.x - 0.5);
      if (unit.fireCooldown <= 0 && unit.canAttack(unit.attackTarget)) performAttack(gameState, unit, unit.attackTarget);
    } else {
      // 追击途中若有别的敌人进入射程，边追边打，不必等原目标进入射程
      if (unit.damage > 0 && unit.fireCooldown <= 0) {
        var opp = pickAttackTarget(unit, gameState.getEnemiesInRange(unit, unit.range));
        if (opp) {
          unit.turretDir = Math.atan2(opp.getCenterY() - unit.getCenterY(), opp.getCenterX() - unit.getCenterX());
          performAttack(gameState, unit, opp);
        }
      }
      if (unit.path.length === 0 || unit.pathIndex >= unit.path.length || unit.pathRecalcTimer <= 0) {
        unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), Math.floor(atX), Math.floor(atY), 0, unit);
        unit.pathIndex = 0;
        unit.pathRecalcTimer = 45;
      }
      moveUnit(gameState, unit);
    }
    return;
  }
  if (unit.attackMoveTarget && unit.damage > 0) {
    var nbAM = pickAttackTarget(unit, gameState.getEnemiesInRange(unit, unit.range + 2));
    if (nbAM) {
      unit.attackTarget = nbAM;
      return;
    }
    var amdx = unit.x - unit.attackMoveTarget.x, amdy = unit.y - unit.attackMoveTarget.y;
    if (amdx * amdx + amdy * amdy < 4) unit.attackMoveTarget = null;
  }
  // 出厂单位走完到集结点的路径后，就地转入守卫（红警2 行为）。
  // 注意要同时覆盖「路径为空」：读档时 path 会被清空（path 是瞬时状态不入档），
  // 若只认 pathIndex >= path.length，读档后的出厂单位会永远停在原地不转守卫。
  if (unit.autoGuard && (unit.path.length === 0 || unit.pathIndex >= unit.path.length)) {
    unit.guardPos = { x: Math.floor(unit.x), y: Math.floor(unit.y) };
    unit.autoGuard = false;
    unit.path = [];
  }

  if (unit.guardPos && unit.damage > 0) {
    // 1) 射程内目标：原地开火，不移动
    var gInRange = pickAttackTarget(unit, gameState.getEnemiesInRange(unit, unit.range));
    if (gInRange) {
      if (unit.fireCooldown <= 0 && unit.canAttack(gInRange)) {
        unit.turretDir = Math.atan2(gInRange.getCenterY() - unit.getCenterY(),
                                    gInRange.getCenterX() - unit.getCenterX());
        performAttack(gameState, unit, gInRange);
      }
      return;
    }
    var gdx = unit.x - unit.guardPos.x, gdy = unit.y - unit.guardPos.y;
    var gd2 = gdx * gdx + gdy * gdy;
    // 2) 射程外但在警戒范围内：有限追击，追出太远就放弃
    var gNear = pickAttackTarget(unit, gameState.getEnemiesInRange(unit, unit.range + 3));
    if (gNear && gd2 < GUARD_CHASE_RANGE * GUARD_CHASE_RANGE) {
      unit.attackTarget = gNear;
      return;
    }
    // 3) 脱离警戒或离位过远：回到守卫点
    if (gd2 > 4) {
      if ((unit.path.length === 0 || unit.pathIndex >= unit.path.length) && unit.pathRecalcTimer <= 0) {
        unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), unit.guardPos.x, unit.guardPos.y);
        unit.pathIndex = 0;
        unit.pathRecalcTimer = 30; // 节流，避免回到守卫点后每帧重复寻路
      }
      moveUnit(gameState, unit);
      return;
    }
  }
  // 工程师等维修单位：空闲时自动寻找最近的受损己方建筑前往修复
  if (unit.canRepair && !unit.attackTarget && !unit.attackMoveTarget &&
      (unit.path.length === 0 || unit.pathIndex >= unit.path.length) &&
      (frameCount + unit.id) % 30 === 0) {
    var rb = null, rbd = Infinity;
    for (var ri = 0; ri < gameState.entities.length; ri++) {
      var rbe = gameState.entities[ri];
      if (rbe.dead || !rbe.isBuilding || !rbe.built || rbe.team !== unit.team) continue;
      if (rbe.hp >= rbe.maxHp) continue;
      var rrdx = rbe.x - unit.x, rrdy = rbe.y - unit.y;
      var rd = rrdx * rrdx + rrdy * rrdy; // 只比远近，平方即可
      if (rd < rbd) { rbd = rd; rb = rbe; }
    }
    if (rb) {
      unit.attackTarget = rb;
      unit.guardPos = null;
      unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), Math.floor(rb.x + rb.size / 2), Math.floor(rb.y + rb.size / 2));
      unit.pathIndex = 0;
    }
  }
  // 红警2 行为：射程内自动开火，无需下达任何攻击命令。
  // 原先玩家单位被限制成「只有停下（path 为空）才开火」，移动途中一路挨打却不还手
  if (!unit.attackTarget && unit.damage > 0 && unit.fireCooldown <= 0) {
    var cl2 = pickAttackTarget(unit, gameState.getEnemiesInRange(unit, unit.range + 1));
    if (cl2) {
      var cdx = (cl2.x + (cl2.isBuilding ? cl2.size / 2 : 0.5)) - (unit.x + 0.5),
          cdy = (cl2.y + (cl2.isBuilding ? cl2.size / 2 : 0.5)) - (unit.y + 0.5);
      if (cdx * cdx + cdy * cdy <= unit.range * unit.range) performAttack(gameState, unit, cl2);
      // 只有 AI 会自动追出射程；玩家单位不擅自脱离玩家下达的移动命令
      else if (unit.team === TEAM_ENEMY) unit.attackTarget = cl2;
    }
  }
  if (unit.team === TEAM_ENEMY && unit.lastDamagedBy && !unit.lastDamagedBy.dead && unit.lastDamagedTimer > 0 && !unit.attackTarget) {
    unit.attackTarget = unit.lastDamagedBy;
  }
  moveUnit(gameState, unit);
}

export function updateHarvesterAI(gameState, unit) {
  if (unit.ore >= unit.capacity) unit.returningToRefinery = true;
  if (unit.returningToRefinery) {
    var ref = gameState.map.findNearestRefinery(unit.x, unit.y, unit.team, gameState.getRefineries(unit.team));
    if (!ref) { unit.returningToRefinery = false; return; }
    var refX = Math.floor(ref.x) + Math.floor(ref.size / 2);
    var refY = Math.floor(ref.y) + Math.floor(ref.size / 2);
    var refdx = unit.x - refX, refdy = unit.y - refY;
    if (refdx * refdx + refdy * refdy < 9) {
      if (unit.team === TEAM_PLAYER) { gameState.playerCredits += unit.ore; gameState.stats.oreGathered += unit.ore; }
      else gameState.enemyCredits += unit.ore;
      gameState.addFloatingText(ref.getCenterX(), ref.getCenterY() - 12, '+' + unit.ore, '#f1c40f');
      unit.ore = 0;
      unit.returningToRefinery = false;
      unit.path = [];
      unit.pathIndex = 0;
      var ore = gameState.map.findNearestOre(Math.floor(unit.x), Math.floor(unit.y));
      if (ore.x >= 0) {
        unit.harvestTarget = ore;
        unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), ore.x, ore.y);
        unit.pathIndex = 0;
      }
    } else {
      if (unit.path.length === 0 || unit.pathIndex >= unit.path.length || unit.pathRecalcTimer <= 0) {
        unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), refX, refY);
        unit.pathIndex = 0;
        unit.pathRecalcTimer = 90;
      }
      moveUnit(gameState, unit);
    }
    return;
  }
  if (!unit.harvestTarget || !gameState.map.oreAmount[unit.harvestTarget.y] || gameState.map.oreAmount[unit.harvestTarget.y][unit.harvestTarget.x] <= 0) {
    var ore2 = gameState.map.findNearestOre(Math.floor(unit.x), Math.floor(unit.y));
    if (ore2.x >= 0) { unit.harvestTarget = ore2; unit.path = []; unit.pathIndex = 0; }
    else return;
  }
  var odx = unit.x - unit.harvestTarget.x - 0.5, ody = unit.y - unit.harvestTarget.y - 0.5;
  if (odx * odx + ody * ody < 1.8 * 1.8) {
    unit.harvestTimer++;
    if (unit.harvestTimer >= 10) {
      unit.harvestTimer = 0;
      if (gameState.map.terrain[unit.harvestTarget.y] && gameState.map.terrain[unit.harvestTarget.y][unit.harvestTarget.x] === ORE && gameState.map.oreAmount[unit.harvestTarget.y][unit.harvestTarget.x] > 0) {
        var amt = Math.min(30, unit.capacity - unit.ore, gameState.map.oreAmount[unit.harvestTarget.y][unit.harvestTarget.x]);
        unit.ore += amt;
        gameState.map.oreAmount[unit.harvestTarget.y][unit.harvestTarget.x] -= amt;
        if (gameState.map.oreAmount[unit.harvestTarget.y][unit.harvestTarget.x] <= 0) {
          gameState.map.terrain[unit.harvestTarget.y][unit.harvestTarget.x] = GRASS;
          gameState.map._removeOreFromCache(unit.harvestTarget.x, unit.harvestTarget.y);
          unit.harvestTarget = null;
          unit.path = [];
          unit.pathIndex = 0;
        }
      } else { unit.harvestTarget = null; unit.path = []; unit.pathIndex = 0; }
    }
  } else {
    if (unit.path.length === 0 || unit.pathIndex >= unit.path.length || unit.pathRecalcTimer <= 0) {
      unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), unit.harvestTarget.x, unit.harvestTarget.y, 3000, unit);
      unit.pathIndex = 0;
      unit.pathRecalcTimer = 90;
    }
    moveUnit(gameState, unit);
  }
}

export function moveUnit(gameState, unit) {
  if (unit.path.length > 0 && unit.pathIndex < unit.path.length) {
    var wp = unit.path[unit.pathIndex];
    var occ = gameState.map.occupancy[wp.y] && gameState.map.occupancy[wp.y][wp.x];

    // 改进的单位避障（空军无视地面占用）
    if (!unit.isAirUnit && occ && occ !== unit && !occ.isBuilding) {
      if (occ.team === unit.team) {
        // 友方单位 - 等待或绕行
        unit.pathRecalcTimer--;
        if (unit.pathRecalcTimer < -20) {
          // 重新寻路，尝试绕过
          unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), unit.path[unit.path.length - 1].x, unit.path[unit.path.length - 1].y, 3000, unit);
          unit.pathIndex = 0;
          unit.pathRecalcTimer = 30;
        }
        return;
      } else {
        // 敌方单位 - 继续移动（可以穿过以进行攻击）
      }
    }

    var tx = wp.x + 0.5, ty = wp.y + 0.5;
    var dx = tx - unit.x, dy = ty - unit.y;
    // 归一化需要真实距离，sqrt 即可（hypot 的防溢出在游戏坐标量级下是纯浪费）
    var dist = Math.sqrt(dx * dx + dy * dy);
    var tMod = 1;
    if (!unit.isAirUnit) {
      var terrain = gameState.map.terrain[Math.floor(unit.y)] && gameState.map.terrain[Math.floor(unit.y)][Math.floor(unit.x)];
      if (terrain === SAND) tMod = 0.85;
      else if (terrain === CONCRETE) tMod = 1.15;
      else if (terrain === TREE) tMod = 0.7; // 树林减速
    }
    var ms = unit.speed * 0.075 * tMod;
    if (dist < ms) { unit.x = tx; unit.y = ty; unit.pathIndex++; }
    else { unit.x += dx / dist * ms; unit.y += dy / dist * ms; unit.direction = Math.atan2(dy, dx); unit.turretDir = unit.direction; }
    unit.animTimer++;
    if (unit.animTimer > 6) { unit.animTimer = 0; unit.animFrame = (unit.animFrame + 1) % 4; }
  }
}

/**
 * 间谍渗透：潜入敌方建筑触发效果后消失（红警2 核心玩法）。
 * 返回 true 表示已渗透，调用方应结束该单位本帧的后续处理。
 */
export function updateSpyInfiltration(gameState, unit) {
  if (unit.type !== 'spy' || unit.dead) return false;
  var infiltrated = false;
  var dist2 = SPY_INFILTRATE_DIST * SPY_INFILTRATE_DIST;
  gameState._ensureSpatial();
  // 空间索引 + 回调内提前终止，代替原先的每帧全实体扫描（每个间谍 O(n)/帧）。
  // 半径 +3 覆盖大建筑中心相对其插入格的偏移（最大 size 3，中心偏移 1.5 格）
  gameState.spatialGrid.forEachInRange(unit.x, unit.y, SPY_INFILTRATE_DIST + 3, function(t) {
    if (t.dead || !t.isBuilding || t.team === unit.team) return;
    var sdx = unit.x - (t.x + t.size / 2), sdy = unit.y - (t.y + t.size / 2);
    if (sdx * sdx + sdy * sdy > dist2) return;

    var enemyIsPlayer = (t.team === TEAM_PLAYER);
    var pool = enemyIsPlayer ? gameState.playerCredits : gameState.enemyCredits;
    var msg = '';

    if (t.type === 'powerPlant') {
      if (enemyIsPlayer) gameState.playerPowerBlackout = SPY_BLACKOUT_FRAMES;
      else gameState.enemyPowerBlackout = SPY_BLACKOUT_FRAMES;
      msg = '\u7535\u5382\u88ab\u6e17\u900f\uff0c\u7535\u529b\u4e2d\u65ad 15 \u79d2';
    } else if (t.type === 'barracks' || t.type === 'warFactory') {
      // 渗透生产建筑：己方现有部队全部晋升为老兵
      var promoted = 0;
      for (var k = 0; k < gameState.entities.length; k++) {
        var u = gameState.entities[k];
        if (u.dead || u.isBuilding || u.team !== unit.team) continue;
        if (u.veterancy < 1) { u.veterancy = 1; promoted++; }
      }
      msg = '\u90e8\u961f\u664b\u5347\uff1a' + promoted + ' \u4e2a\u5355\u4f4d\u6210\u4e3a\u8001\u5175';
    } else {
      // 矿厂 / 雷达 / 其他：按建筑类型窃取资金或情报
      var ratio = (t.type === 'refinery') ? 0.25 : 0.1;
      var stolen = Math.floor(pool * ratio);
      if (enemyIsPlayer) { gameState.playerCredits -= stolen; gameState.enemyCredits += stolen; }
      else { gameState.enemyCredits -= stolen; gameState.playerCredits += stolen; }
      msg = (t.type === 'refinery' ? '\u5077\u53d6\u8d44\u91d1 ' : '\u83b7\u53d6\u60c5\u62a5\uff0c\u7b79\u6b3e ') + '$' + stolen;
    }

    notify((unit.team === TEAM_PLAYER ? '\u6e17\u900f\u6210\u529f\uff1a' : '\u8b66\u544a\uff1a') + msg,
           unit.team === TEAM_PLAYER ? 'info' : 'danger');
    gameState.addFloatingText(t.getCenterX(), t.getCenterY() - 16, '\u6e17\u900f!', '#95a5a6');
    unit.dead = true;
    unit.deathTimer = 1;
    infiltrated = true;
    return true; // 已渗透，提前终止遍历
  });
  return infiltrated;
}

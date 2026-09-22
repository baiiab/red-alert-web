// 战斗结算：目标选择、开火、抛射物与视觉效果的推进
//
// 从 main.js 拆出。这些函数原先只依赖模块级变量 gameState，现改为显式形参
// （形参名与原名一致，因此函数体无需改写）。

import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, TEAM_PLAYER, TEAM_ENEMY,
         GRASS, WATER, ORE, ROCK, CONCRETE, SAND, TREE, FPS } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS } from './definitions.js';
import { notify } from './Notifications.js';
import { audioManager } from './AudioManager.js';
import { PRISM_LINK_RANGE } from './GameTuning.js';

export function pickAttackTarget(unit, candidates) {
  var best = null, bd = Infinity;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!unit.canAttack(c)) continue;
    // 只比较远近不需要真实距离：平方比较，避开 Math.hypot（其为防溢出实现，慢 sqrt 约 7 倍）
    var dx = c.x - unit.x, dy = c.y - unit.y;
    var d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/**
 * 统计能参与光棱塔链式聚焦的友方光棱塔数量（不含自身）。
 * 红警2 中相邻光棱塔会把光束汇聚到同一目标，逐座叠加伤害。
 */
export function countLinkedPrisms(gameState, tower, target) {
  var linked = 0;
  var list = gameState.entities;
  var linkR2 = PRISM_LINK_RANGE * PRISM_LINK_RANGE;
  var tcx = target.getCenterX(), tcy = target.getCenterY();
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (e === tower || e.dead || !e.built || e.type !== 'prismTower') continue;
    if (e.team !== tower.team) continue;
    var ldx = e.x - tower.x, ldy = e.y - tower.y;
    if (ldx * ldx + ldy * ldy > linkR2) continue;
    // 只有自身射程也覆盖得了目标，才算真正参与聚焦
    var ddx = e.getCenterX() - tcx, ddy = e.getCenterY() - tcy;
    var rp = e.range * TILE_SIZE;
    if (ddx * ddx + ddy * ddy <= rp * rp) linked++;
  }
  return linked;
}

export function performAttack(gameState, attacker, target) {
  attacker.fireCooldown = attacker.fireRate;
  attacker.muzzleFlash = 6;
  attacker.turretDir = Math.atan2(target.getCenterY() / TILE_SIZE - attacker.y - 0.5, target.getCenterX() / TILE_SIZE - attacker.x - 0.5);
  
  // 使用新的伤害计算系统
  var dmg = attacker.calculateDamage ? attacker.calculateDamage(target) : attacker.damage;

  // ===== 红警2 单位特性（definitions 里已定义，此前逻辑未实装）=====
  var atkDef = UNIT_DEFS[attacker.type];
  // 军犬：扑咬步兵一击必杀
  if (attacker.type === 'attackDog' && target.type2 === 'infantry') {
    dmg = Math.max(dmg, target.hp + 10);
  }
  // 谭雅的 C4：对建筑是毁灭性的，原版可单兵拆家
  if (attacker.c4 && target.isBuilding) {
    dmg = Math.floor(dmg * 8);
  }
  // 光棱塔链式聚焦：射程内其他光棱塔把光束汇聚到同一目标，逐座叠加伤害
  if (atkDef && atkDef.canLink) {
    var linked = countLinkedPrisms(gameState, attacker, target);
    if (linked > 0) dmg = Math.floor(dmg * (1 + linked * 0.5));
  }

  // 空军单位消耗弹药
  if (attacker.isAirUnit && attacker.ammo !== null) {
    attacker.consumeAmmo();
  }
  
  target.lastDamagedBy = attacker;
  target.lastDamagedTimer = 180;
  if (target.team === TEAM_PLAYER && target.isBuilding && gameState.underAttackAlertCooldown === 0) {
    notify('\u8b66\u544a: \u57fa\u5730\u906d\u5230\u653b\u51fb\uff01', 'danger');
    audioManager.playAlert();
    gameState.addMinimapAlert(target.x, target.y, '#e74c3c');
    gameState.underAttackAlertCooldown = 300;
  }
  if (attacker.burstCount > 0) {
    attacker.burstRemaining = attacker.burstCount - 1;
    attacker.burstTarget = target;
    performBurstShot(gameState, attacker, target);
    return;
  }
  
  // 确定投射物类型
  var projType = 'bullet';
  if (attacker.damageType === 'cannon' || attacker.type === 'turret') projType = 'shell';
  else if (attacker.damageType === 'rocket' || attacker.damageType === 'missile') projType = 'rocket';
  else if (attacker.damageType === 'laser') projType = 'laser';
  else if (attacker.damageType === 'electric' || attacker.type === 'tesla') projType = 'tesla';
  else if (attacker.type === 'arty') projType = 'shell';
  
  var from = { x: attacker.getCenterX(), y: attacker.getCenterY() };
  gameState.addProjectile(from, target, dmg, attacker.team, projType, attacker.splashRadius);

  // 天启坦克双炮管：并排两发齐射
  if (atkDef && atkDef.dualGun) {
    var from2 = { x: attacker.getCenterX() - 7, y: attacker.getCenterY() };
    gameState.addProjectile(from2, target, dmg, attacker.team, projType, attacker.splashRadius);
  }

  // 播放音效
  if (projType === 'bullet') audioManager.playShoot();
  else if (projType === 'laser') audioManager.playSound(800, 'sine', 0.1, 0.1);
  else if (projType === 'shell' || projType === 'rocket') { 
    try { setTimeout(function() { audioManager.playSound(180, 'sawtooth', 0.12, 0.06); }, 80); } catch (e) {} 
  }
}

export function performBurstShot(gameState, attacker, target) {
  attacker.fireCooldown = 8;
  attacker.muzzleFlash = 4;
  var dmg = attacker.damage;
  if (attacker.veterancy >= 1) dmg = Math.floor(dmg * 1.25);
  var from = { x: attacker.getCenterX() + (Math.random() - 0.5) * 8, y: attacker.getCenterY() + (Math.random() - 0.5) * 8 };
  gameState.addProjectile(from, target, dmg, attacker.team, 'rocket', 0);
  audioManager.playShoot();
}

export function updateProjectiles(gameState) {
  for (var i = gameState.projectiles.length - 1; i >= 0; i--) {
    var p = gameState.projectiles[i];
    if (p.target && !p.target.dead && p.target.getCenterX) {
      p.targetX = p.target.getCenterX();
      p.targetY = p.target.getCenterY();
    }
    var dx = p.targetX - p.x, dy = p.targetY - p.y;
    // 需要真实距离做归一化，用 sqrt 而非 hypot（游戏坐标量级下防溢出是纯浪费）
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < p.speed * 2) {
    if (p.target && !p.target.dead) {
      if (p.type === 'shell' || p.type === 'tesla') gameState.addExplosion(p.targetX, p.targetY, 20, p.type === 'tesla' ? 'electric' : 'fire');
      else if (p.type === 'rocket') gameState.addExplosion(p.targetX, p.targetY, 16, 'fire');
      if (p.splash > 0) {
        gameState.applySplashDamage(p.targetX, p.targetY, p.splash, Math.floor(p.damage * 0.6), p.team);
        gameState.addExplosion(p.targetX, p.targetY, p.splash * TILE_SIZE * 0.6, 'big');
      }
      // 统一伤害入口：扣血/无敌判定/击杀归属/死亡清理
      gameState.damageEntity(p.target, p.damage);
    } else if (p.splash > 0) {
        gameState.addExplosion(p.targetX, p.targetY, 24, 'fire');
        gameState.applySplashDamage(p.targetX, p.targetY, p.splash, Math.floor(p.damage * 0.5), p.team);
      }
      gameState.projectiles.splice(i, 1);
    } else {
      p.x += dx / dist * p.speed;
      p.y += dy / dist * p.speed;
    }
  }
}

export function updateExplosions(gameState) {
  for (var i = gameState.explosions.length - 1; i >= 0; i--) {
    gameState.explosions[i].timer--;
    if (gameState.explosions[i].timer <= 0) gameState.explosions.splice(i, 1);
  }
}

export function updateFloatingTexts(gameState) {
  for (var i = gameState.floatingTexts.length - 1; i >= 0; i--) {
    var ft = gameState.floatingTexts[i];
    ft.y += ft.vy;
    ft.timer--;
    if (ft.timer <= 0) gameState.floatingTexts.splice(i, 1);
  }
}

export function updateSmoke(gameState) {
  for (var i = gameState.smokeParticles.length - 1; i >= 0; i--) {
    var sm = gameState.smokeParticles[i];
    sm.x += sm.vx;
    sm.y += sm.vy;
    sm.vy *= 0.98;
    sm.size += 0.1;
    sm.timer--;
    if (sm.timer <= 0) gameState.smokeParticles.splice(i, 1);
  }
}

import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, TEAM_PLAYER, TEAM_ENEMY, GRASS, WATER, ORE, SAND, CONCRETE, TREE } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS } from './definitions.js';
import { Entity } from './Entity.js';
import { GameState } from './GameState.js';
import { Renderer } from './Renderer.js';
import { UIManager } from './UI.js';
import { InputHandler } from './InputHandler.js';
import { EnemyAI } from './EnemyAI.js';
import { AudioManager, audioManager } from './AudioManager.js';
import { SaveManager } from './SaveManager.js';

let canvas, minimapCanvas, ctx, minimapCtx;
let gameState, renderer, ui, input, enemyAI, saveManager;
let camera = { x: 0, y: 0, zoom: 1 };
let selectedUnits = [], selectedBuilding = null;
let placingBuilding = false, placingType = null;
let gameStartTime = 0, difficulty = 'normal';
let frameCount = 0;
let gameRunning = false, gamePaused = false, gameSpeed = 1;
let activeAction = null;
let notifTimer = 0;

function startGame(diff) {
  difficulty = diff;
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  minimapCanvas = document.getElementById('minimapCanvas');
  minimapCtx = minimapCanvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  minimapCanvas.width = 300;
  minimapCanvas.height = 200;
  Entity.counter = 0;
  gameState = new GameState();
  gameState._playExplosionSound = function() { audioManager.playExplosion(); };
  gameState.map.generate();
  gameState.initPlayer();
  gameState.initEnemy(difficulty);
  camera.x = 3 * TILE_SIZE * camera.zoom - (canvas.width - 300) / 2;
  camera.y = 3 * TILE_SIZE * camera.zoom - canvas.height / 2;
  camera.x = Math.max(0, camera.x);
  camera.y = Math.max(0, camera.y);
  selectedUnits = [];
  selectedBuilding = null;
  placingBuilding = false;
  placingType = null;
  gameStartTime = Date.now();
  frameCount = 0;
  gameRunning = true;
  gamePaused = false;
  gameSpeed = 1;
  activeAction = null;
  notifTimer = 0;
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('gameOver').style.display = 'none';
  renderer = new Renderer(canvas, minimapCanvas);
  ui = new UIManager();
  ui.init({
    gameState: gameState,
    findProducingBuilding: findProducingBuilding,
    startBuild: startBuild,
    playSelectSound: function() { audioManager.playSelect(); },
    playCancelSound: function() { audioManager.playCancel(); },
    findEntityById: findEntityById,
    onSelectGroup: selectGroup,
    onNotify: notify,
    onSuperWeaponClick: function(type) {
      if (!input) return;
      input._callbacks.superWeaponTargeting = type;
      notify('点击地图选择目标位置，右键取消', 'info');
      audioManager.playSelect();
    }
  });
  input = new InputHandler(canvas, minimapCanvas);
  input.setup(gameState, camera, {
    selectedUnits: selectedUnits,
    selectedBuilding: selectedBuilding,
    placingBuilding: placingBuilding,
    placingType: placingType,
    activeAction: activeAction,
    onRepair: repairBuilding,
    onSell: sellBuilding,
    onNotify: notify,
    onPlayBuildSound: function() { audioManager.playBuild(); },
    onPlayCancelSound: function() { audioManager.playCancel(); },
    onPlaySelectSound: function() { audioManager.playSelect(); },
    onHideHelp: function() { ui.hideHelp(); },
    onShowHelp: function() { ui.showHelp(); },
    onTogglePause: togglePause,
    onCommandStop: commandStop,
    onSetGroup: setGroup,
    onSelectGroup: selectGroup,
    onCycleTab: function() {
      var tabs = ['buildings', 'units', 'defenses'];
      var idx = tabs.indexOf(ui.currentTab);
      ui.switchTab(tabs[(idx + 1) % tabs.length]);
    },
    onSaveGame: saveGame,
    onLoadGame: loadGame,
    superWeaponTargeting: null,
    onSuperWeaponFire: fireSuperWeapon
  });
  enemyAI = new EnemyAI();
  enemyAI.init({
    updateUnitAI: updateUnitAI,
    notify: notify,
    playAlertSound: function() { audioManager.playAlert(); }
  });
  saveManager = new SaveManager();
  wireSuperWeaponCallbacks(gameState.superWeaponManager);
  // 调试/测试钩子
  window.__game = gameState;
  window.__input = input;
  ui.renderGroupBar(gameState);
  ui.updateBuildList(gameState);
  gameLoop();
}

function wireSuperWeaponCallbacks(swm) {
  swm.onLaunch = function(type, team) {
    if (type === 'nuke') audioManager.playNukeSiren();
    else if (type === 'chrono') audioManager.playChrono();
    else if (type === 'ironCurtain') audioManager.playIronCurtain();
    else if (type === 'lightningStorm') audioManager.playAlert();
    if (team === TEAM_ENEMY) {
      var swNames = { nuke: '核弹攻击', lightningStorm: '闪电风暴', ironCurtain: '铁幕装置', chrono: '超时空传送' };
      notify('警报: 敌方使用了 ' + (swNames[type] || '超级武器') + '！', 'danger');
      audioManager.playAlert();
    }
  };
  swm.onChronoPending = function(team) {
    if (team === TEAM_PLAYER && input) {
      input._callbacks.superWeaponTargeting = '__chronoDest';
      notify('选择传送目的地', 'info');
    }
  };
  swm.onChronoExpired = function(team) {
    if (team === TEAM_PLAYER && input && input._callbacks.superWeaponTargeting === '__chronoDest') {
      input._callbacks.superWeaponTargeting = null;
      notify('传送超时取消', 'warn');
    }
  };
}

function gameLoop() {
  if (!gameRunning) return;
  if (!gamePaused) {
    for (var s = 0; s < gameSpeed; s++) {
      frameCount++;
      updateCamera();
      updateEntities();
      updateProjectiles();
      updateExplosions();
      updateFloatingTexts();
      updateSmoke();
      updateMinimapAlerts();
      updateResources();
      updateEnemyAI();
      ui.updateNotification();
      checkGameOver();
      if (gameState.gameOver) break;
    }
  } else {
    updateCamera();
  }
  ui.updateUI(gameState, gameStartTime, input ? input._callbacks.selectedUnits : selectedUnits,
    input ? input._callbacks.selectedBuilding : selectedBuilding, frameCount);
  ui.updateSuperWeapons(gameState, input ? input._callbacks.superWeaponTargeting : null, frameCount);
  renderer.render(gameState, camera, frameCount,
    input ? input._callbacks.selectedUnits : selectedUnits,
    input ? input._callbacks.selectedBuilding : selectedBuilding,
    input ? input._callbacks.placingBuilding : placingBuilding,
    input ? input._callbacks.placingType : placingType,
    input ? input.mouse : { x: 0, y: 0, worldX: 0, worldY: 0, mapX: 0, mapY: 0, inCanvas: false },
    input ? input.dragSelect : { active: false, startX: 0, startY: 0, endX: 0, endY: 0 },
    input ? input._callbacks.activeAction : activeAction,
    input ? input._callbacks.superWeaponTargeting : null,
    gamePaused, canvas.width - 300, canvas.height);
  requestAnimationFrame(gameLoop);
}

function updateCamera() {
  var speed = 12;
  var keys = input ? input.keys : {};
  if (keys['ArrowLeft']) camera.x -= speed;
  if (keys['ArrowRight']) camera.x += speed;
  if (keys['ArrowUp']) camera.y -= speed;
  if (keys['ArrowDown']) camera.y += speed;
  var edge = 14;
  var viewW = canvas.width - 300;
  var viewH = canvas.height;
  var mouse = input ? input.mouse : { inCanvas: false, x: 0, y: 0 };
  if (mouse.inCanvas) {
    if (mouse.x > 0 && mouse.x < edge && mouse.y > 44 && mouse.y < viewH) camera.x -= 10;
    if (mouse.x > viewW - edge && mouse.x < viewW && mouse.y > 44 && mouse.y < viewH) camera.x += 10;
    if (mouse.y > 44 && mouse.y < 44 + edge && mouse.x > 0 && mouse.x < viewW) camera.y -= 10;
    if (mouse.y > viewH - edge && mouse.y < viewH && mouse.x > 0 && mouse.x < viewW) camera.y += 10;
  }
  var maxX = MAP_WIDTH * TILE_SIZE * camera.zoom - (canvas.width - 300);
  var maxY = MAP_HEIGHT * TILE_SIZE * camera.zoom - canvas.height;
  camera.x = Math.max(0, Math.min(maxX, camera.x));
  camera.y = Math.max(0, Math.min(maxY, camera.y));
}

function updateEntities() {
  // 空间网格每3帧重建一次即可，范围查询不需要每帧精确
  if (frameCount % 3 === 0) gameState.spatialDirty = true;
  gameState._listDirty = false;
  // 重置本帧寻路预算：大量单位同帧重算路径时压缩单次迭代上限，平滑掉帧尖峰
  gameState.map.resetPathBudget();
  
  // 更新战争迷雾
  if (gameState.fogOfWar && frameCount % 5 === 0) {
    gameState.fogOfWar.update(gameState.entities);
  }
  
  // 更新超级武器
  if (gameState.superWeaponManager) {
    gameState.superWeaponManager.update();
  }
  for (var i = gameState.entities.length - 1; i >= 0; i--) {
    var e = gameState.entities[i];
    if (e.dead) {
      e.deathTimer--;
      if (e.deathTimer % 3 === 0 && e.deathTimer > 10) gameState.addSmoke(e.getCenterX(), e.getCenterY());
      if (e.deathTimer <= 0) gameState.entities.splice(i, 1);
      continue;
    }
    if (e.muzzleFlash > 0) e.muzzleFlash--;
    if (e.flashTimer > 0) e.flashTimer--;
    if (e.lastDamagedTimer > 0) e.lastDamagedTimer--;
    if (e.pathRecalcTimer > 0) e.pathRecalcTimer--;
    if (!e.dead && e.hp < e.maxHp * 0.4 && frameCount % 18 === 0) {
      gameState.addSmoke(e.getCenterX() + (Math.random() - 0.5) * 8, e.getCenterY() + (Math.random() - 0.5) * 8);
    }
    if (e.isBuilding) {
      updateBuildingAI(e);
    } else {
      if (e.fireCooldown > 0) e.fireCooldown--;
      if (e.team !== TEAM_ENEMY) updateUnitAI(e);
    }
  }
  updateRepairBays();
}

function updateRepairBays() {
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
      var d = Math.hypot(e.x - bay.x - bay.size / 2, e.y - bay.y - bay.size / 2);
      if (d > REPAIR_BAY_RANGE) continue;
      e.hp = Math.min(e.maxHp, e.hp + REPAIR_BAY_HEAL);
      if (frameCount % 24 === 0) {
        gameState.addFloatingText(e.getCenterX(), e.getCenterY() - 12, '+' + REPAIR_BAY_HEAL, '#2ecc71');
      }
    }
  }
}

function updateBuildingAI(e) {
  if (!e.built) {
    e.buildProgress += 100 / (e.buildTime * 60);
    if (e.buildProgress >= 100) {
      e.buildProgress = 100;
      e.built = true;
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
        var d = Math.hypot(cand.x - e.x, cand.y - e.y);
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
          if (e.fireCooldown <= 0) performAttack(e, tgt);
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
          spawnProducedUnit(e);
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

function spawnProducedUnit(building) {
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

function pickAttackTarget(unit, candidates) {
  var best = null, bd = Infinity;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!unit.canAttack(c)) continue;
    var d = Math.hypot(c.x - unit.x, c.y - unit.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function updateUnitAI(unit) {
  if (unit.chronoStun > 0) return; // 超时空传送后的短暂眩晕
  if (updateSpyInfiltration(unit)) return; // 间谍：触碰到敌方建筑即渗透并消失
  if (unit.type2 === 'harvester') { updateHarvesterAI(unit); return; }
  // 空军：弹药耗尽自动返场（最近基地/矿厂）补充
  if (unit.isAirUnit) {
    if (unit.ammo !== null && unit.ammo <= 0) unit.returningToBase = true;
    if (unit.returningToBase) {
      var hq = gameState.map.findNearestRefinery(unit.x, unit.y, unit.team, gameState.getRefineries(unit.team));
      if (!hq) { unit.returningToBase = false; return; }
      var hqX = Math.floor(hq.x) + Math.floor(hq.size / 2);
      var hqY = Math.floor(hq.y) + Math.floor(hq.size / 2);
      if (Math.hypot(unit.x - hqX, unit.y - hqY) < 1.5) {
        unit.reload();
        unit.path = []; unit.pathIndex = 0;
        return;
      }
      unit.path = [{ x: hqX, y: hqY }];
      unit.pathIndex = 0;
      moveUnit(unit);
      return;
    }
  }
  if (unit.canRepair && unit.attackTarget && unit.attackTarget.isBuilding) {
    var tgt = unit.attackTarget;
    var d = Math.hypot(unit.x - (tgt.x + tgt.size / 2), unit.y - (tgt.y + tgt.size / 2));
    if (d < 2) {
      if (tgt.team === unit.team && tgt.hp < tgt.maxHp) {
        tgt.hp = Math.min(tgt.maxHp, tgt.hp + 5);
        if (frameCount % 18 === 0) gameState.addFloatingText(tgt.getCenterX(), tgt.getCenterY() - 10, '+5', '#2ecc71');
        if (tgt.hp >= tgt.maxHp) unit.attackTarget = null;
      } else if (tgt.team !== unit.team) {
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
      }
      moveUnit(unit);
      return;
    }
  }
  if (unit.burstRemaining > 0 && unit.burstTarget && !unit.burstTarget.dead && unit.fireCooldown <= 0) {
    var bt = unit.burstTarget;
    var btDist = Math.hypot(unit.x + 0.5 - bt.getCenterX() / TILE_SIZE, unit.y + 0.5 - bt.getCenterY() / TILE_SIZE);
    if (btDist <= unit.range) {
      performBurstShot(unit, bt);
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
    var atDist = Math.hypot(unit.x + 0.5 - atX, unit.y + 0.5 - atY);
    if (atDist <= unit.range && unit.damage > 0) {
      unit.path = [];
      unit.pathIndex = 0;
      unit.turretDir = Math.atan2(atY - unit.y - 0.5, atX - unit.x - 0.5);
      if (unit.fireCooldown <= 0 && unit.canAttack(unit.attackTarget)) performAttack(unit, unit.attackTarget);
    } else {
      // 追击途中若有别的敌人进入射程，边追边打，不必等原目标进入射程
      if (unit.damage > 0 && unit.fireCooldown <= 0) {
        var opp = pickAttackTarget(unit, gameState.getEnemiesInRange(unit, unit.range));
        if (opp) {
          unit.turretDir = Math.atan2(opp.getCenterY() - unit.getCenterY(), opp.getCenterX() - unit.getCenterX());
          performAttack(unit, opp);
        }
      }
      if (unit.path.length === 0 || unit.pathIndex >= unit.path.length || unit.pathRecalcTimer <= 0) {
        unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), Math.floor(atX), Math.floor(atY), 0, unit);
        unit.pathIndex = 0;
        unit.pathRecalcTimer = 45;
      }
      moveUnit(unit);
    }
    return;
  }
  if (unit.attackMoveTarget && unit.damage > 0) {
    var nbAM = pickAttackTarget(unit, gameState.getEnemiesInRange(unit, unit.range + 2));
    if (nbAM) {
      unit.attackTarget = nbAM;
      return;
    }
    if (Math.hypot(unit.x - unit.attackMoveTarget.x, unit.y - unit.attackMoveTarget.y) < 2) unit.attackMoveTarget = null;
  }
  // 出厂单位走完到集结点的路径后，就地转入守卫（红警2 行为）
  if (unit.autoGuard && unit.path.length > 0 && unit.pathIndex >= unit.path.length) {
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
        performAttack(unit, gInRange);
      }
      return;
    }
    var gd = Math.hypot(unit.x - unit.guardPos.x, unit.y - unit.guardPos.y);
    // 2) 射程外但在警戒范围内：有限追击，追出太远就放弃
    var gNear = pickAttackTarget(unit, gameState.getEnemiesInRange(unit, unit.range + 3));
    if (gNear && gd < GUARD_CHASE_RANGE) {
      unit.attackTarget = gNear;
      return;
    }
    // 3) 脱离警戒或离位过远：回到守卫点
    if (gd > 2) {
      if ((unit.path.length === 0 || unit.pathIndex >= unit.path.length) && unit.pathRecalcTimer <= 0) {
        unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), unit.guardPos.x, unit.guardPos.y);
        unit.pathIndex = 0;
        unit.pathRecalcTimer = 30; // 节流，避免回到守卫点后每帧重复寻路
      }
      moveUnit(unit);
      return;
    }
  }
  // 红警2 行为：射程内自动开火，无需下达任何攻击命令。
  // 原先玩家单位被限制成「只有停下（path 为空）才开火」，移动途中一路挨打却不还手
  if (!unit.attackTarget && unit.damage > 0 && unit.fireCooldown <= 0) {
    var cl2 = pickAttackTarget(unit, gameState.getEnemiesInRange(unit, unit.range + 1));
    if (cl2) {
      var dist = Math.hypot(
        (cl2.x + (cl2.isBuilding ? cl2.size / 2 : 0.5)) - (unit.x + 0.5),
        (cl2.y + (cl2.isBuilding ? cl2.size / 2 : 0.5)) - (unit.y + 0.5));
      if (dist <= unit.range) performAttack(unit, cl2);
      // 只有 AI 会自动追出射程；玩家单位不擅自脱离玩家下达的移动命令
      else if (unit.team === TEAM_ENEMY) unit.attackTarget = cl2;
    }
  }
  if (unit.team === TEAM_ENEMY && unit.lastDamagedBy && !unit.lastDamagedBy.dead && unit.lastDamagedTimer > 0 && !unit.attackTarget) {
    unit.attackTarget = unit.lastDamagedBy;
  }
  moveUnit(unit);
}

function updateHarvesterAI(unit) {
  if (unit.ore >= unit.capacity) unit.returningToRefinery = true;
  if (unit.returningToRefinery) {
    var ref = gameState.map.findNearestRefinery(unit.x, unit.y, unit.team, gameState.getRefineries(unit.team));
    if (!ref) { unit.returningToRefinery = false; return; }
    var refX = Math.floor(ref.x) + Math.floor(ref.size / 2);
    var refY = Math.floor(ref.y) + Math.floor(ref.size / 2);
    var distToRef = Math.hypot(unit.x - refX, unit.y - refY);
    if (distToRef < 3) {
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
      moveUnit(unit);
    }
    return;
  }
  if (!unit.harvestTarget || !gameState.map.oreAmount[unit.harvestTarget.y] || gameState.map.oreAmount[unit.harvestTarget.y][unit.harvestTarget.x] <= 0) {
    var ore2 = gameState.map.findNearestOre(Math.floor(unit.x), Math.floor(unit.y));
    if (ore2.x >= 0) { unit.harvestTarget = ore2; unit.path = []; unit.pathIndex = 0; }
    else return;
  }
  var distToOre = Math.hypot(unit.x - unit.harvestTarget.x - 0.5, unit.y - unit.harvestTarget.y - 0.5);
  if (distToOre < 1.8) {
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
    moveUnit(unit);
  }
}

function moveUnit(unit) {
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
    var dist = Math.hypot(dx, dy);
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

// 光棱塔链式聚焦的最大链接距离（格）
var PRISM_LINK_RANGE = 8;

/**
 * 统计能参与光棱塔链式聚焦的友方光棱塔数量（不含自身）。
 * 红警2 中相邻光棱塔会把光束汇聚到同一目标，逐座叠加伤害。
 */
function countLinkedPrisms(tower, target) {
  var linked = 0;
  var list = gameState.entities;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (e === tower || e.dead || !e.built || e.type !== 'prismTower') continue;
    if (e.team !== tower.team) continue;
    if (Math.hypot(e.x - tower.x, e.y - tower.y) > PRISM_LINK_RANGE) continue;
    // 只有自身射程也覆盖得了目标，才算真正参与聚焦
    var dt = Math.hypot(e.getCenterX() - target.getCenterX(), e.getCenterY() - target.getCenterY());
    if (dt <= e.range * TILE_SIZE) linked++;
  }
  return linked;
}

function performAttack(attacker, target) {
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
    var linked = countLinkedPrisms(attacker, target);
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
    performBurstShot(attacker, target);
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

function performBurstShot(attacker, target) {
  attacker.fireCooldown = 8;
  attacker.muzzleFlash = 4;
  var dmg = attacker.damage;
  if (attacker.veterancy >= 1) dmg = Math.floor(dmg * 1.25);
  var from = { x: attacker.getCenterX() + (Math.random() - 0.5) * 8, y: attacker.getCenterY() + (Math.random() - 0.5) * 8 };
  gameState.addProjectile(from, target, dmg, attacker.team, 'rocket', 0);
  audioManager.playShoot();
}

function updateProjectiles() {
  for (var i = gameState.projectiles.length - 1; i >= 0; i--) {
    var p = gameState.projectiles[i];
    if (p.target && !p.target.dead && p.target.getCenterX) {
      p.targetX = p.target.getCenterX();
      p.targetY = p.target.getCenterY();
    }
    var dx = p.targetX - p.x, dy = p.targetY - p.y;
    var dist = Math.hypot(dx, dy);
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

function updateExplosions() {
  for (var i = gameState.explosions.length - 1; i >= 0; i--) {
    gameState.explosions[i].timer--;
    if (gameState.explosions[i].timer <= 0) gameState.explosions.splice(i, 1);
  }
}

function updateFloatingTexts() {
  for (var i = gameState.floatingTexts.length - 1; i >= 0; i--) {
    var ft = gameState.floatingTexts[i];
    ft.y += ft.vy;
    ft.timer--;
    if (ft.timer <= 0) gameState.floatingTexts.splice(i, 1);
  }
}

function updateSmoke() {
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

function updateMinimapAlerts() {
  for (var i = gameState.minimapAlerts.length - 1; i >= 0; i--) {
    gameState.minimapAlerts[i].timer--;
    if (gameState.minimapAlerts[i].timer <= 0) gameState.minimapAlerts.splice(i, 1);
  }
}

function updateResources() {
  if (gameState.lowPowerAlertCooldown > 0) gameState.lowPowerAlertCooldown--;
  if (gameState.underAttackAlertCooldown > 0) gameState.underAttackAlertCooldown--;
  // 间谍渗透电厂造成的断电倒计时
  if (gameState.playerPowerBlackout > 0) gameState.playerPowerBlackout--;
  if (gameState.enemyPowerBlackout > 0) gameState.enemyPowerBlackout--;
  // 电力/单位数等统计无需每帧精确，降频扫描
  if (frameCount % 15 !== 0) return;
  var pp = 0, ppU = 0, ep = 0, epU = 0, uc = 0;
  for (var i = 0; i < gameState.entities.length; i++) {
    var e = gameState.entities[i];
    if (e.dead || !e.built) continue;
    if (e.isBuilding) {
      if (e.team === TEAM_PLAYER) { pp += e.power || 0; ppU += e.powerUse || 0; }
      else { ep += e.power || 0; epU += e.powerUse || 0; }
      // 注册超级武器（建成即计时，覆盖建造/读档/占领三种来源）
      var bdef = BUILDING_DEFS[e.type];
      if (bdef && bdef.superWeapon) gameState.superWeaponManager.addSuperWeapon(bdef.superWeapon, e.team);
    } else if (e.team === TEAM_PLAYER) uc++;
  }
  // 间谍渗透电厂：发电量骤降至 20%，磁暴线圈这类耗电建筑会直接停摆
  if (gameState.playerPowerBlackout > 0) pp = Math.floor(pp * 0.2);
  if (gameState.enemyPowerBlackout > 0) ep = Math.floor(ep * 0.2);
  gameState.playerPower = pp;
  gameState.playerPowerUse = ppU;
  gameState.enemyPower = ep;
  gameState.enemyPowerUse = epU;
  gameState.playerUnitCount = uc;
  gameState.hasRadar = gameState.hasBuilding(TEAM_PLAYER, 'radar');
  gameState.hasTechCenter = gameState.hasBuilding(TEAM_PLAYER, 'alliedTech') || gameState.hasBuilding(TEAM_PLAYER, 'sovietTech');
  if (gameState.playerPower < gameState.playerPowerUse && gameState.lowPowerAlertCooldown === 0) {
    notify('\u8b66\u544a: \u7535\u529b\u4e0d\u8db3\uff01', 'warn');
    audioManager.playAlert();
    gameState.lowPowerAlertCooldown = 600;
  }
}

function updateEnemyAI() {
  enemyAI.update(gameState, difficulty, frameCount);
}

function startBuild(type, team) {
  var def = BUILDING_DEFS[type] || DEFENSE_DEFS[type] || UNIT_DEFS[type];
  if (!def) return;
  if (team === TEAM_PLAYER && !gameState.canBuild(type, team)) {
    var reason = gameState.getBuildReason(type, team);
    notify(reason, 'warn');
    audioManager.playCancel();
    return;
  }
  if (!gameState.canBuild(type, team)) return;
  if (def.category === 'units') {
    var pb = findProducingBuilding(type, team);
    if (!pb) { notify('\u6ca1\u6709\u53ef\u7528\u7684\u751f\u4ea7\u5efa\u7b51', 'warn'); return; }
    if (pb.producing) {
      if (pb.productionQueue.length < 5) {
        if (team === TEAM_PLAYER) gameState.playerCredits -= def.cost;
        else gameState.enemyCredits -= def.cost;
        pb.productionQueue.push(type);
        if (team === TEAM_PLAYER) notify(def.name + ' \u5df2\u52a0\u5165\u961f\u5217 (' + pb.productionQueue.length + ')', 'info');
      } else if (team === TEAM_PLAYER) notify('\u751f\u4ea7\u961f\u5217\u5df2\u6ee1', 'warn');
      return;
    }
    if (team === TEAM_PLAYER) { gameState.playerCredits -= def.cost; pb.producing = type; pb.produceProgress = 0; notify('\u5f00\u59cb\u8bad\u7ec3 ' + def.name, 'info'); }
  } else if (team === TEAM_PLAYER) {
    if (input) {
      input._callbacks.placingBuilding = true;
      input._callbacks.placingType = type;
    }
    placingBuilding = true;
    placingType = type;
    notify('\u70b9\u51fb\u5730\u56fe\u653e\u7f6e ' + def.name + '\uff0cESC \u53d6\u6d88', 'info');
  }
}

// 守卫模式下允许的追击距离（离守卫点的最大距离），超出则返回守卫点
var GUARD_CHASE_RANGE = 5;
// 维修站：有效范围（格）与每次修复量。原先 4 格、每 12 帧 +3（约 15HP/s），
// 灰熊要 20 秒才修满，慢到玩家根本感知不到
var REPAIR_BAY_RANGE = 5;
var REPAIR_BAY_HEAL = 6;
// 间谍：渗透判定距离（格）、渗透电厂造成的断电时长（帧）
var SPY_INFILTRATE_DIST = 1.5;
var SPY_BLACKOUT_FRAMES = 900;

/**
 * 间谍渗透：潜入敌方建筑触发效果后消失（红警2 核心玩法）。
 * 返回 true 表示已渗透，调用方应结束该单位本帧的后续处理。
 */
function updateSpyInfiltration(unit) {
  if (unit.type !== 'spy' || unit.dead) return false;
  for (var i = 0; i < gameState.entities.length; i++) {
    var t = gameState.entities[i];
    if (t.dead || !t.isBuilding || t.team === unit.team) continue;
    var d = Math.hypot(unit.x - (t.x + t.size / 2), unit.y - (t.y + t.size / 2));
    if (d > SPY_INFILTRATE_DIST) continue;

    var enemyIsPlayer = (t.team === TEAM_PLAYER);
    var pool = enemyIsPlayer ? gameState.playerCredits : gameState.enemyCredits;
    var gain = enemyIsPlayer ? gameState.enemyCredits : gameState.playerCredits;
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
    return true;
  }
  return false;
}

// 能产出单位的建筑。此前直接用 def.requires 匹配，导致「谭雅」这类
// requires 为 ['barracks','alliedTech'] 的单位可能拿科技中心当生产建筑用
var PRODUCER_BUILDINGS = ['barracks', 'warFactory', 'refinery'];

function findProducingBuilding(type, team) {
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

function toggleAction(action) {
  if (activeAction === action) { activeAction = null; }
  else activeAction = action;
  placingBuilding = false;
  placingType = null;
  if (input) {
    input._callbacks.activeAction = activeAction;
    input._callbacks.placingBuilding = false;
    input._callbacks.placingType = null;
  }
  document.getElementById('btnRepair').classList.toggle('active', activeAction === 'repair');
  document.getElementById('btnSell').classList.toggle('active', activeAction === 'sell');
}

function commandStop() {
  var sel = input ? input._callbacks.selectedUnits : selectedUnits;
  if (sel.length > 0) {
    sel.forEach(function(u) {
      u.path = [];
      u.pathIndex = 0;
      u.attackTarget = null;
      u.attackMoveTarget = null;
      u.guardPos = null;
      u.burstRemaining = 0;
      u.burstTarget = null;
    });
    notify('\u505c\u6b62\u547d\u4ee4', 'info');
  }
}

function fireSuperWeapon(type, mapX, mapY) {
  var swm = gameState.superWeaponManager;
  if (input) input._callbacks.superWeaponTargeting = null;
  if (type === '__chronoDest') {
    var pending = swm.getPendingChrono(TEAM_PLAYER);
    if (pending) {
      swm.completeChronoShift(pending, mapX, mapY);
      notify('\u8d85\u65f6\u7a7a\u4f20\u9001\u5b8c\u6210', 'info');
    }
    return;
  }
  if (swm.useSuperWeapon(type, TEAM_PLAYER, mapX, mapY)) {
    notify('\u8d85\u7ea7\u6b66\u5668\u5df2\u53d1\u52a8', 'info');
  } else {
    notify('\u76ee\u6807\u65e0\u6548\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9', 'warn');
    audioManager.playCancel();
  }
}

function sellBuilding(b) {
  var def = BUILDING_DEFS[b.type] || DEFENSE_DEFS[b.type];
  if (!def || b.type === 'base') { notify('\u8be5\u5efa\u7b51\u65e0\u6cd5\u51fa\u552e', 'warn'); return; }
  var refund = Math.floor(def.cost * 0.5 * (b.hp / b.maxHp));
  gameState.playerCredits += refund;
  notify('\u51fa\u552e ' + b.name + ' \u56de\u6536 $' + refund, 'info');
  gameState.addFloatingText(b.getCenterX(), b.getCenterY() - 10, '+$' + refund, '#f1c40f');
  gameState.addExplosion(b.getCenterX(), b.getCenterY(), 30, 'big');
  gameState.removeEntity(b);
  audioManager.playBuild();
}

function repairBuilding(b) {
  if (b.hp >= b.maxHp) { notify('\u8be5\u5efa\u7b51\u65e0\u9700\u4fee\u7406', 'info'); return; }
  var def = BUILDING_DEFS[b.type] || DEFENSE_DEFS[b.type];
  if (!def) return;
  var damage = b.maxHp - b.hp;
  var cost = Math.ceil(def.cost * damage / b.maxHp * 0.6);
  if (gameState.playerCredits < cost) { notify('\u8d44\u91d1\u4e0d\u8db3\uff0c\u9700\u8981 $' + cost, 'warn'); return; }
  gameState.playerCredits -= cost;
  b.hp = b.maxHp;
  gameState.addFloatingText(b.getCenterX(), b.getCenterY() - 10, '\u4fee\u590d\uff01', '#2ecc71');
  notify(b.name + ' \u5df2\u4fee\u590d (\u82b1\u8d39 $' + cost + ')', 'info');
  audioManager.playBuild();
}

function togglePause() {
  gamePaused = !gamePaused;
  var btn = document.getElementById('pauseBtn');
  btn.textContent = gamePaused ? '\u7ee7\u7eed' : '\u6682\u505c';
  btn.classList.toggle('paused', gamePaused);
  if (gamePaused) notify('\u6e38\u620f\u5df2\u6682\u505c', 'info');
}

function cycleSpeed() {
  gameSpeed = gameSpeed === 1 ? 2 : (gameSpeed === 2 ? 4 : 1);
  document.getElementById('speedBtn').textContent = gameSpeed + '\u00d7';
  notify('\u6e38\u620f\u901f\u5ea6: ' + gameSpeed + '\u00d7', 'info');
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(function(err) {
      notify('\u5168\u5c4f\u5931\u8d25: ' + err.message, 'warn');
    });
  } else {
    document.exitFullscreen();
  }
}

function showHelp() { ui.showHelp(); }
function hideHelp() { ui.hideHelp(); }

function notify(text, kind) {
  ui.notify(text, kind);
}

function checkGameOver() {
  var stillRunning = ui.checkGameOver(gameState, gameStartTime, difficulty, gameRunning);
  if (!stillRunning) gameRunning = false;
}

function findEntityById(id) {
  for (var i = 0; i < gameState.entities.length; i++) if (gameState.entities[i].id === id) return gameState.entities[i];
  return null;
}

function setGroup(n) {
  var sel = input ? input._callbacks.selectedUnits : selectedUnits;
  if (sel.length === 0) return;
  gameState.controlGroups[n] = sel.map(function(u) { return u.id; });
  notify('\u7f16\u961f ' + n + ' \u5df2\u8bbe\u7f6e (' + sel.length + '\u4e2a\u5355\u4f4d)', 'info');
  ui.renderGroupBar(gameState);
}

function selectGroup(n) {
  var ids = gameState.controlGroups[n];
  if (!ids || ids.length === 0) return;
  var sel = input ? input._callbacks.selectedUnits : selectedUnits;
  sel.forEach(function(u) { u.selected = false; });
  sel.length = 0;
  var sb = input ? input._callbacks.selectedBuilding : selectedBuilding;
  if (sb) { sb.selected = false; if (input) input._callbacks.selectedBuilding = null; else selectedBuilding = null; }
  ids.forEach(function(id) {
    var e = findEntityById(id);
    if (e && !e.dead && !e.isBuilding) { e.selected = true; sel.push(e); }
  });
  var now = Date.now();
  var lastNumberKey = input ? input.lastNumberKey : 0;
  var lastNumberTime = input ? input.lastNumberTime : 0;
  if (lastNumberKey === n && now - lastNumberTime < 400) {
    if (sel.length > 0) {
      var cx = sel.reduce(function(s, u) { return s + u.x; }, 0) / sel.length;
      var cy = sel.reduce(function(s, u) { return s + u.y; }, 0) / sel.length;
      camera.x = cx * TILE_SIZE * camera.zoom - (canvas.width - 300) / 2;
      camera.y = cy * TILE_SIZE * camera.zoom - canvas.height / 2;
      camera.x = Math.max(0, Math.min(MAP_WIDTH * TILE_SIZE * camera.zoom - (canvas.width - 300), camera.x));
      camera.y = Math.max(0, Math.min(MAP_HEIGHT * TILE_SIZE * camera.zoom - canvas.height, camera.y));
    }
  }
  if (input) { input.lastNumberKey = n; input.lastNumberTime = now; }
  audioManager.playSelect();
}

function saveGame() {
  if (!gameState || !gameRunning) { notify('\u65e0\u6cd5\u5b58\u6863\uff1a\u6e38\u620f\u672a\u8fd0\u884c', 'warn'); return; }
  var ok = saveManager.save(gameState, camera, difficulty, frameCount, enemyAI);
  if (ok) { notify('\u6e38\u620f\u5df2\u5b58\u6863', 'info'); audioManager.playBuild(); }
  else notify('\u5b58\u6863\u5931\u8d25', 'danger');
}

function loadGame() {
  var result = saveManager.load(null, canvas, minimapCanvas);
  if (!result) { notify('\u6ca1\u6709\u5b58\u6863\u6216\u5b58\u6863\u635f\u574f', 'warn'); return; }
  gameState = result.gameState;
  gameState._playExplosionSound = function() { audioManager.playExplosion(); };
  wireSuperWeaponCallbacks(gameState.superWeaponManager);
  gameState.superWeaponManager._statusCount = 0;
  for (var ssi = 0; ssi < gameState.entities.length; ssi++) {
    var sse = gameState.entities[ssi];
    if (sse.ironCurtain > 0 || sse.chronoStun > 0) gameState.superWeaponManager._statusCount++;
  }
  window.__game = gameState;
  if (ui._callbacks) ui._callbacks.gameState = gameState;
  ui._lastUI = {}; // 重置 DOM 缓存，确保读档后全量刷新一次
  camera = result.camera;
  // 关键：读档构造了全新的 GameState / camera，必须让输入层重新绑定，
  // 否则所有鼠标操作仍作用在读档前的旧世界上
  if (input) input.rebind(gameState, camera);
  difficulty = result.difficulty;
  frameCount = result.frameCount;
  var aiState = result.enemyAIState;
  if (aiState) {
    enemyAI.attackWave = aiState.attackWave || 0;
    enemyAI.aiTimer = aiState.aiTimer || 0;
    enemyAI.buildQueue = aiState.buildQueue || [];
    enemyAI.attackTimer = aiState.attackTimer || 0;
    enemyAI.scoutTimer = aiState.scoutTimer || 0;
  }
  gameStartTime = result.gameStartTime;
  selectedUnits.length = 0;
  selectedBuilding = null;
  // 存档会还原 selected 标记，但选中列表已被清空，需同步清理，否则残留绿色选中框
  for (var cli = 0; cli < gameState.entities.length; cli++) gameState.entities[cli].selected = false;
  placingBuilding = false;
  placingType = null;
  gameRunning = true;
  gamePaused = false;
  gameSpeed = 1;
  activeAction = null;
  if (input) {
    input.pendingAttackMove = false;
    input._callbacks.selectedUnits = selectedUnits;
    input._callbacks.selectedBuilding = selectedBuilding;
    input._callbacks.placingBuilding = placingBuilding;
    input._callbacks.placingType = placingType;
    input._callbacks.activeAction = activeAction;
    input._callbacks.superWeaponTargeting = null;
  }
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('gameOver').style.display = 'none';
  ui.renderGroupBar(gameState);
  ui.updateBuildList(gameState);
  notify('\u6e38\u620f\u5df2\u8bfb\u6863', 'info');
  audioManager.playBuild();
}

window.startGame = startGame;
window.togglePause = togglePause;
window.cycleSpeed = cycleSpeed;
window.toggleFullscreen = toggleFullscreen;
window.showHelp = showHelp;
window.hideHelp = hideHelp;
window.toggleAction = toggleAction;
window.commandStop = commandStop;
window.switchTab = function(tab) { ui.switchTab(tab); };
window.saveGame = saveGame;
window.loadGame = loadGame;

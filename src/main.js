import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, TEAM_PLAYER, TEAM_ENEMY, GRASS, WATER, ORE, SAND, CONCRETE } from './constants.js';
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
    findEntityById: findEntityById,
    onSelectGroup: selectGroup,
    onNotify: notify
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
    onLoadGame: loadGame
  });
  enemyAI = new EnemyAI();
  enemyAI.init({
    updateUnitAI: updateUnitAI,
    notify: notify,
    playAlertSound: function() { audioManager.playAlert(); }
  });
  saveManager = new SaveManager();
  ui.renderGroupBar(gameState);
  ui.updateBuildList(gameState);
  gameLoop();
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
  renderer.render(gameState, camera, frameCount,
    input ? input._callbacks.selectedUnits : selectedUnits,
    input ? input._callbacks.selectedBuilding : selectedBuilding,
    input ? input._callbacks.placingBuilding : placingBuilding,
    input ? input._callbacks.placingType : placingType,
    input ? input.mouse : { x: 0, y: 0, worldX: 0, worldY: 0, mapX: 0, mapY: 0, inCanvas: false },
    input ? input.dragSelect : { active: false, startX: 0, startY: 0, endX: 0, endY: 0 },
    input ? input._callbacks.activeAction : activeAction,
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
  gameState.spatialDirty = true;
  gameState._listDirty = false;
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
  if (frameCount % 12 !== 0) return;
  var bays = gameState.entities.filter(function(e) { return e.type === 'repairBay' && e.built && !e.dead; });
  for (var b = 0; b < bays.length; b++) {
    var bay = bays[b];
    for (var i = 0; i < gameState.entities.length; i++) {
      var e = gameState.entities[i];
      if (e.team === bay.team && !e.isBuilding && !e.dead && e.type2 === 'vehicle' && e.hp < e.maxHp) {
        var d = Math.hypot(e.x - bay.x - bay.size / 2, e.y - bay.y - bay.size / 2);
        if (d < 4) {
          e.hp = Math.min(e.maxHp, e.hp + 3);
          if (frameCount % 60 === 0) gameState.addFloatingText(e.getCenterX(), e.getCenterY() - 12, '+', '#2ecc71');
        }
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
    if (e.fireCooldown <= 0) {
      var enemies = gameState.getEnemiesInRange(e, e.range);
      if (enemies.length > 0) {
        var tgt = enemies[0], bd = Infinity;
        for (var ei = 0; ei < enemies.length; ei++) {
          var d = Math.hypot(enemies[ei].x - e.x, enemies[ei].y - e.y);
          if (d < bd) { bd = d; tgt = enemies[ei]; }
        }
        performAttack(e, tgt);
      }
    }
  }
  if (e.producing) {
    var pd = UNIT_DEFS[e.producing];
    if (pd) {
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

function spawnProducedUnit(building) {
  var type = building.producing;
  var tries = [];
  for (var dy = -1; dy <= building.size; dy++) for (var dx = -1; dx <= building.size; dx++) {
    if (dx === -1 || dx === building.size || dy === -1 || dy === building.size)
      tries.push({ x: Math.floor(building.x) + dx, y: Math.floor(building.y) + dy });
  }
  var sx = Math.floor(building.x) + building.size, sy = Math.floor(building.y);
  for (var t = 0; t < tries.length; t++) {
    if (gameState.map.isPassable(tries[t].x, tries[t].y)) { sx = tries[t].x; sy = tries[t].y; break; }
  }
  sx = Math.max(0, Math.min(MAP_WIDTH - 1, sx));
  sy = Math.max(0, Math.min(MAP_HEIGHT - 1, sy));
  var nu = gameState.spawnEntity(type, building.team, sx, sy);
  if (building.rallyPoint) {
    nu.path = gameState.map.findPath(sx, sy, building.rallyPoint.x, building.rallyPoint.y);
    nu.pathIndex = 0;
  }
  if (type === 'harvester') {
    var ore = gameState.map.findNearestOre(sx, sy);
    if (ore.x >= 0) { nu.harvestTarget = ore; nu.path = gameState.map.findPath(sx, sy, ore.x, ore.y); nu.pathIndex = 0; }
  }
}

function updateUnitAI(unit) {
  if (unit.type2 === 'harvester') { updateHarvesterAI(unit); return; }
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
        var newT = gameState.getEnemiesInRange(unit, unit.range + 2);
        if (newT.length > 0) unit.attackTarget = newT[0];
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
      if (unit.fireCooldown <= 0) performAttack(unit, unit.attackTarget);
    } else {
      if (unit.path.length === 0 || unit.pathIndex >= unit.path.length || unit.pathRecalcTimer <= 0) {
        unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), Math.floor(atX), Math.floor(atY));
        unit.pathIndex = 0;
        unit.pathRecalcTimer = 45;
      }
      moveUnit(unit);
    }
    return;
  }
  if (unit.attackMoveTarget && unit.damage > 0) {
    var nbAM = gameState.getEnemiesInRange(unit, unit.range + 2);
    if (nbAM.length > 0) {
      var cl = nbAM[0], cd = Infinity;
      for (var n = 0; n < nbAM.length; n++) {
        var nd = Math.hypot(nbAM[n].x - unit.x, nbAM[n].y - unit.y);
        if (nd < cd) { cd = nd; cl = nbAM[n]; }
      }
      unit.attackTarget = cl;
      return;
    }
    if (Math.hypot(unit.x - unit.attackMoveTarget.x, unit.y - unit.attackMoveTarget.y) < 2) unit.attackMoveTarget = null;
  }
  if (unit.guardPos && unit.damage > 0) {
    var nbG = gameState.getEnemiesInRange(unit, unit.range + 2);
    if (nbG.length > 0) { unit.attackTarget = nbG[0]; return; }
    var gd = Math.hypot(unit.x - unit.guardPos.x, unit.y - unit.guardPos.y);
    if (gd > 4) {
      if (unit.path.length === 0 || unit.pathIndex >= unit.path.length) {
        unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), unit.guardPos.x, unit.guardPos.y);
        unit.pathIndex = 0;
      }
      moveUnit(unit);
      return;
    }
  }
  if (!unit.attackTarget && unit.damage > 0) {
    if (unit.team === TEAM_ENEMY || (unit.team === TEAM_PLAYER && unit.path.length === 0)) {
      var nb = gameState.getEnemiesInRange(unit, unit.range + 1);
      if (nb.length > 0 && unit.fireCooldown <= 0) {
        var cl2 = nb[0], cd2 = Infinity;
        for (var ni = 0; ni < nb.length; ni++) {
          var nd2 = Math.hypot(nb[ni].x - unit.x, nb[ni].y - unit.y);
          if (nd2 < cd2) { cd2 = nd2; cl2 = nb[ni]; }
        }
        var dist = Math.hypot((cl2.x + (cl2.isBuilding ? cl2.size / 2 : 0.5)) - (unit.x + 0.5), (cl2.y + (cl2.isBuilding ? cl2.size / 2 : 0.5)) - (unit.y + 0.5));
        if (dist <= unit.range) performAttack(unit, cl2);
        else if (unit.team === TEAM_ENEMY) unit.attackTarget = cl2;
      }
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
    var ref = gameState.map.findNearestRefinery(unit.x, unit.y, unit.team, gameState.entities);
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
          unit.harvestTarget = null;
          unit.path = [];
          unit.pathIndex = 0;
        }
      } else { unit.harvestTarget = null; unit.path = []; unit.pathIndex = 0; }
    }
  } else {
    if (unit.path.length === 0 || unit.pathIndex >= unit.path.length || unit.pathRecalcTimer <= 0) {
      unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), unit.harvestTarget.x, unit.harvestTarget.y);
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
    if (occ && occ !== unit && !occ.isBuilding && occ.team === unit.team) {
      unit.pathRecalcTimer--;
      if (unit.pathRecalcTimer < -20) {
        unit.path = gameState.map.findPath(Math.floor(unit.x), Math.floor(unit.y), unit.path[unit.path.length - 1].x, unit.path[unit.path.length - 1].y);
        unit.pathIndex = 0;
        unit.pathRecalcTimer = 30;
      }
      return;
    }
    var tx = wp.x + 0.5, ty = wp.y + 0.5;
    var dx = tx - unit.x, dy = ty - unit.y;
    var dist = Math.hypot(dx, dy);
    var terrain = gameState.map.terrain[Math.floor(unit.y)] && gameState.map.terrain[Math.floor(unit.y)][Math.floor(unit.x)];
    var tMod = 1;
    if (terrain === SAND) tMod = 0.85;
    else if (terrain === CONCRETE) tMod = 1.15;
    var ms = unit.speed * 0.075 * tMod;
    if (dist < ms) { unit.x = tx; unit.y = ty; unit.pathIndex++; }
    else { unit.x += dx / dist * ms; unit.y += dy / dist * ms; unit.direction = Math.atan2(dy, dx); unit.turretDir = unit.direction; }
    unit.animTimer++;
    if (unit.animTimer > 6) { unit.animTimer = 0; unit.animFrame = (unit.animFrame + 1) % 4; }
  }
}

function performAttack(attacker, target) {
  attacker.fireCooldown = attacker.fireRate;
  attacker.muzzleFlash = 6;
  attacker.turretDir = Math.atan2(target.getCenterY() / TILE_SIZE - attacker.y - 0.5, target.getCenterX() / TILE_SIZE - attacker.x - 0.5);
  var dmg = attacker.damage;
  if (attacker.antiArmor && target.type2 === 'vehicle') dmg = Math.floor(dmg * 2.2);
  if (attacker.type2 === 'vehicle' && target.type2 === 'infantry') dmg = Math.floor(dmg * 0.5);
  if (attacker.veterancy >= 1) dmg = Math.floor(dmg * 1.25);
  if (attacker.veterancy >= 2) dmg = Math.floor(dmg * 1.5);
  var scatter = 0.85 + Math.random() * 0.3;
  dmg = Math.floor(dmg * scatter);
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
  var projType = (attacker.type2 === 'vehicle' || attacker.type === 'turret' || attacker.type === 'aaGun') ? 'shell' : 'bullet';
  if (attacker.type === 'tesla') projType = 'tesla';
  else if (attacker.type === 'arty') projType = 'shell';
  else if (attacker.type === 'rocket' || attacker.type === 'mlrs') projType = 'rocket';
  var from = { x: attacker.getCenterX(), y: attacker.getCenterY() };
  gameState.addProjectile(from, target, dmg, attacker.team, projType, attacker.splashRadius);
  if (projType === 'bullet') audioManager.playShoot();
  else if (projType === 'shell' || projType === 'rocket') { try { setTimeout(function() { audioManager.playSound(180, 'sawtooth', 0.12, 0.06); }, 80); } catch (e) {} }
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
        p.target.hp -= p.damage;
        p.target.flashTimer = 5;
        if (p.type === 'shell' || p.type === 'tesla') gameState.addExplosion(p.targetX, p.targetY, 20, p.type === 'tesla' ? 'electric' : 'fire');
        else if (p.type === 'rocket') gameState.addExplosion(p.targetX, p.targetY, 16, 'fire');
        if (p.splash > 0) {
          gameState.applySplashDamage(p.targetX, p.targetY, p.splash, Math.floor(p.damage * 0.6), p.team);
          gameState.addExplosion(p.targetX, p.targetY, p.splash * TILE_SIZE * 0.6, 'big');
        }
        if (p.target.hp <= 0) {
          p.target.hp = 0;
          gameState.addExplosion(p.targetX, p.targetY, 36, 'big');
          audioManager.playExplosion();
          if (p.target.type === 'base') { gameState.gameOver = true; gameState.winner = p.target.team === TEAM_PLAYER ? TEAM_ENEMY : TEAM_PLAYER; }
          gameState.removeEntity(p.target);
        } else {
          gameState.addFloatingText(p.targetX, p.targetY - 10, '-' + p.damage, '#ff6b6b');
        }
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
  var pp = 0, ppU = 0, ep = 0, epU = 0, uc = 0;
  for (var i = 0; i < gameState.entities.length; i++) {
    var e = gameState.entities[i];
    if (e.dead || !e.built) continue;
    if (e.isBuilding) {
      if (e.team === TEAM_PLAYER) { pp += e.power || 0; ppU += e.powerUse || 0; }
      else { ep += e.power || 0; epU += e.powerUse || 0; }
    } else if (e.team === TEAM_PLAYER) uc++;
  }
  gameState.playerPower = pp;
  gameState.playerPowerUse = ppU;
  gameState.enemyPower = ep;
  gameState.enemyPowerUse = epU;
  gameState.playerUnitCount = uc;
  gameState.hasRadar = gameState.hasBuilding(TEAM_PLAYER, 'radar');
  gameState.hasTechCenter = gameState.hasBuilding(TEAM_PLAYER, 'techCenter');
  if (gameState.lowPowerAlertCooldown > 0) gameState.lowPowerAlertCooldown--;
  if (gameState.playerPower < gameState.playerPowerUse && gameState.lowPowerAlertCooldown === 0) {
    notify('\u8b66\u544a: \u7535\u529b\u4e0d\u8db3\uff01', 'warn');
    audioManager.playAlert();
    gameState.lowPowerAlertCooldown = 600;
  }
  if (gameState.underAttackAlertCooldown > 0) gameState.underAttackAlertCooldown--;
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

function findProducingBuilding(type, team) {
  var def = UNIT_DEFS[type];
  if (!def) return null;
  var fallback = null;
  for (var i = 0; i < gameState.entities.length; i++) {
    var e = gameState.entities[i];
    if (e.team === team && e.built && !e.dead && e.isBuilding) {
      var match = (type === 'harvester' && e.type === 'refinery') || (def.requires && def.requires.indexOf(e.type) >= 0);
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
  var ok = saveManager.save(gameState, camera, difficulty, frameCount, enemyAI.attackWave);
  if (ok) { notify('\u6e38\u620f\u5df2\u5b58\u6863', 'info'); audioManager.playBuild(); }
  else notify('\u5b58\u6863\u5931\u8d25', 'danger');
}

function loadGame() {
  var result = saveManager.load(null, canvas, minimapCanvas);
  if (!result) { notify('\u6ca1\u6709\u5b58\u6863\u6216\u5b58\u6863\u635f\u574f', 'warn'); return; }
  gameState = result.gameState;
  gameState._playExplosionSound = function() { audioManager.playExplosion(); };
  camera = result.camera;
  difficulty = result.difficulty;
  frameCount = result.frameCount;
  enemyAI.attackWave = result.enemyAttackWave;
  gameStartTime = result.gameStartTime;
  selectedUnits.length = 0;
  selectedBuilding = null;
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
window.showHelp = showHelp;
window.hideHelp = hideHelp;
window.toggleAction = toggleAction;
window.commandStop = commandStop;
window.switchTab = function(tab) { ui.switchTab(tab); };
window.saveGame = saveGame;
window.loadGame = loadGame;

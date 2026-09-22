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
import { setNotifier } from './Notifications.js';
import { PRISM_LINK_RANGE, GUARD_CHASE_RANGE, REPAIR_BAY_RANGE, REPAIR_BAY_HEAL,
         SPY_INFILTRATE_DIST, SPY_BLACKOUT_FRAMES, PRODUCER_BUILDINGS } from './GameTuning.js';
import { pickAttackTarget, countLinkedPrisms, performAttack, performBurstShot,
         updateProjectiles, updateExplosions, updateFloatingTexts, updateSmoke } from './Combat.js';
import { updateUnitAI, updateHarvesterAI, moveUnit, updateSpyInfiltration } from './UnitAI.js';
import { updateBuildingAI, updateRepairBays, spawnProducedUnit, findProducingBuilding } from './Buildings.js';

// 拆分出去的模块通过该出口弹提示（见 Notifications.js）
setNotifier(notify);

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

// 超武存活集合：每次建筑扫描前 clear 后复用，避免创建新对象。
// 用途是反向注销——建筑被拆后对应超武必须从管理器里移除。
const SW_ACTIVE_PLAYER = new Set();
const SW_ACTIVE_ENEMY = new Set();

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
    // 适配器：UI 侧按 (type, team) 调用，这里补上 gameState
    findProducingBuilding: function(type, team) { return findProducingBuilding(gameState, type, team); },
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
    // 适配器：EnemyAI 按 (unit) 调用，这里补上 gameState 与当前帧号
    updateUnitAI: function(unit) { return updateUnitAI(gameState, unit, frameCount); },
    notify: notify,
    playAlertSound: function() { audioManager.playAlert(); }
  });
  saveManager = new SaveManager();
  wireSuperWeaponCallbacks(gameState.superWeaponManager);
  // 调试/测试钩子
  window.__game = gameState;
  window.__input = input;
  window.__ui = ui;
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
      updateProjectiles(gameState);
      updateExplosions(gameState);
      updateFloatingTexts(gameState);
      updateSmoke(gameState);
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
      updateBuildingAI(gameState, e);
    } else {
      if (e.fireCooldown > 0) e.fireCooldown--;
      if (e.team !== TEAM_ENEMY) updateUnitAI(gameState, e);
    }
  }
  updateRepairBays(gameState, frameCount);
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
  // 复用的超武类型集合，避免每 15 帧新建对象
  SW_ACTIVE_PLAYER.clear();
  SW_ACTIVE_ENEMY.clear();
  for (var i = 0; i < gameState.entities.length; i++) {
    var e = gameState.entities[i];
    if (e.dead || !e.built) continue;
    if (e.isBuilding) {
      if (e.team === TEAM_PLAYER) { pp += e.power || 0; ppU += e.powerUse || 0; }
      else { ep += e.power || 0; epU += e.powerUse || 0; }
      // 注册超级武器（建成即计时，覆盖建造/读档/占领三种来源）
      var bdef = BUILDING_DEFS[e.type];
      if (bdef && bdef.superWeapon) {
        gameState.superWeaponManager.addSuperWeapon(bdef.superWeapon, e.team);
        if (e.team === TEAM_PLAYER) SW_ACTIVE_PLAYER.add(bdef.superWeapon);
        else SW_ACTIVE_ENEMY.add(bdef.superWeapon);
      }
    } else if (e.team === TEAM_PLAYER) uc++;
  }
  // 以存活建筑为准反向注销：发射井被拆后核弹不能继续充能
  gameState.superWeaponManager.syncActive(SW_ACTIVE_PLAYER, SW_ACTIVE_ENEMY);
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
    var pb = findProducingBuilding(gameState, type, team);
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

import { MAP_WIDTH, MAP_HEIGHT } from './constants.js';
import { Entity } from './Entity.js';
import { GameState } from './GameState.js';

export class SaveManager {
  save(gameState, camera, difficulty, frameCount, enemyAttackWave) {
    try {
      var entityData = gameState.entities.filter(function(e) { return !e.dead; }).map(function(e) {
        var obj = {};
        var keys = ['id', 'type', 'team', 'x', 'y', 'hp', 'maxHp', 'size', 'name', 'isBuilding', 'category',
          'damage', 'range', 'fireRate', 'fireCooldown', 'speed', 'type2', 'antiArmor', 'canRepair',
          'canCapture', 'splashRadius', 'burstCount', 'burstRemaining', 'direction', 'turretDir',
          'animFrame', 'built', 'buildProgress', 'buildTime', 'producing', 'produceProgress',
          'ore', 'capacity', 'harvestTarget', 'returningToRefinery', 'rallyPoint', 'selected',
          'attackMoveTarget', 'guardPos', 'power', 'powerUse', 'requires', 'cost', 'icon', 'desc',
          'veterancy', 'kills', 'productionQueue'];
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (e[k] !== undefined) {
            if (k === 'harvestTarget' && e[k]) obj[k] = { x: e[k].x, y: e[k].y };
            else if (k === 'rallyPoint' && e[k]) obj[k] = { x: e[k].x, y: e[k].y };
            else if (k === 'attackMoveTarget' && e[k]) obj[k] = { x: e[k].x, y: e[k].y };
            else if (k === 'guardPos' && e[k]) obj[k] = { x: e[k].x, y: e[k].y };
            else if (k === 'requires') obj[k] = e[k].slice();
            else if (k === 'productionQueue') obj[k] = e[k].slice();
            else if (k === 'attackTarget' && e[k]) obj[k] = e[k].id;
            else if (k === 'burstTarget' && e[k]) obj[k] = e[k].id;
            else obj[k] = e[k];
          }
        }
        return obj;
      });
      var mapData = {
        terrain: gameState.map.terrain,
        oreAmount: gameState.map.oreAmount
      };
      var saveObj = {
        entities: entityData,
        map: mapData,
        playerCredits: gameState.playerCredits,
        enemyCredits: gameState.enemyCredits,
        playerPower: gameState.playerPower,
        playerPowerUse: gameState.playerPowerUse,
        enemyPower: gameState.enemyPower,
        enemyPowerUse: gameState.enemyPowerUse,
        playerUnitCount: gameState.playerUnitCount,
        playerUnitMax: gameState.playerUnitMax,
        hasRadar: gameState.hasRadar,
        hasTechCenter: gameState.hasTechCenter,
        controlGroups: gameState.controlGroups,
        stats: gameState.stats,
        camera: { x: camera.x, y: camera.y, zoom: camera.zoom },
        difficulty: difficulty,
        frameCount: frameCount,
        enemyAttackWave: enemyAttackWave,
        version: 1
      };
      localStorage.setItem('redAlertSave', JSON.stringify(saveObj));
      return true;
    } catch (e) {
      return false;
    }
  }

  load(saveData, canvas, minimapCanvas) {
    try {
      var data = saveData || localStorage.getItem('redAlertSave');
      if (!data) return null;
      var save = typeof data === 'string' ? JSON.parse(data) : data;
      if (!save || !save.entities || !save.map) return null;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      minimapCanvas.width = 300;
      minimapCanvas.height = 200;

      Entity.counter = 0;
      var gameState = new GameState();
      gameState.map.terrain = save.map.terrain;
      gameState.map.oreAmount = save.map.oreAmount;
      gameState.map.occupancy = [];
      for (var i = 0; i < MAP_HEIGHT; i++) {
        gameState.map.occupancy[i] = [];
        for (var j = 0; j < MAP_WIDTH; j++) gameState.map.occupancy[i][j] = null;
      }

      gameState.playerCredits = save.playerCredits;
      gameState.enemyCredits = save.enemyCredits;
      gameState.playerPower = save.playerPower;
      gameState.playerPowerUse = save.playerPowerUse;
      gameState.enemyPower = save.enemyPower;
      gameState.enemyPowerUse = save.enemyPowerUse;
      gameState.playerUnitCount = save.playerUnitCount;
      gameState.playerUnitMax = save.playerUnitMax;
      gameState.hasRadar = save.hasRadar;
      gameState.hasTechCenter = save.hasTechCenter;
      gameState.controlGroups = save.controlGroups || {};
      gameState.stats = save.stats || gameState.stats;

      var entityMap = {};
      gameState.entities = [];
      for (var ei = 0; ei < save.entities.length; ei++) {
        var ed = save.entities[ei];
        var e = new Entity(ed.type, ed.team, ed.x, ed.y);
        var ekeys = ['hp', 'maxHp', 'size', 'name', 'isBuilding', 'category', 'damage', 'range',
          'fireRate', 'fireCooldown', 'speed', 'type2', 'antiArmor', 'canRepair', 'canCapture',
          'splashRadius', 'burstCount', 'burstRemaining', 'direction', 'turretDir', 'animFrame',
          'built', 'buildProgress', 'buildTime', 'producing', 'produceProgress', 'ore', 'capacity',
          'returningToRefinery', 'selected', 'power', 'powerUse', 'cost', 'icon', 'desc',
          'veterancy', 'kills'];
        for (var ki = 0; ki < ekeys.length; ki++) {
          if (ed[ekeys[ki]] !== undefined) e[ekeys[ki]] = ed[ekeys[ki]];
        }
        e.id = ed.id;
        if (ed.harvestTarget) e.harvestTarget = ed.harvestTarget;
        if (ed.rallyPoint) e.rallyPoint = ed.rallyPoint;
        if (ed.attackMoveTarget) e.attackMoveTarget = ed.attackMoveTarget;
        if (ed.guardPos) e.guardPos = ed.guardPos;
        if (ed.requires) e.requires = ed.requires;
        if (ed.productionQueue) e.productionQueue = ed.productionQueue;
        e.path = []; e.pathIndex = 0; e.pathRecalcTimer = 0;
        e.dead = false; e.deathTimer = 45;
        e.flashTimer = 0; e.lastDamagedBy = null; e.lastDamagedTimer = 0;
        e.muzzleFlash = 0; e.burstTarget = null;
        if (ed.id > Entity.counter) Entity.counter = ed.id;
        entityMap[ed.id] = e;
        gameState.entities.push(e);
        if (e.isBuilding && e.built) gameState.map.setOccupancy(e);
      }
      for (var ai = 0; ai < gameState.entities.length; ai++) {
        var ae = gameState.entities[ai];
        var aed = save.entities[ai];
        if (aed.attackTarget && entityMap[aed.attackTarget]) ae.attackTarget = entityMap[aed.attackTarget];
        if (aed.burstTarget && entityMap[aed.burstTarget]) ae.burstTarget = entityMap[aed.burstTarget];
      }

      var camera = { x: save.camera.x, y: save.camera.y, zoom: save.camera.zoom || 1 };
      var difficulty = save.difficulty;
      var frameCount = save.frameCount;
      var enemyAttackWave = save.enemyAttackWave || 0;
      var gameStartTime = Date.now() - frameCount * (1000 / 60);

      return { gameState, camera, difficulty, frameCount, enemyAttackWave, gameStartTime };
    } catch (e) {
      return null;
    }
  }

  hasSave() {
    return !!localStorage.getItem('redAlertSave');
  }
}

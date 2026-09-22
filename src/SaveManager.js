import { MAP_WIDTH, MAP_HEIGHT } from './constants.js';
import { Entity } from './Entity.js';
import { GameState } from './GameState.js';

// 存/读共用同一份字段清单，避免两份白名单各自维护导致漂移
// 标量字段（含阵营、空军弹药、采矿进度、铁幕/超时空状态）
const PERSISTED_FIELDS = [
  'hp', 'maxHp', 'size', 'name', 'isBuilding', 'category', 'damage', 'range',
  'fireRate', 'fireCooldown', 'speed', 'type2', 'antiArmor', 'canRepair', 'canCapture',
  'splashRadius', 'burstCount', 'burstRemaining', 'direction', 'turretDir',
  'animFrame', 'built', 'buildProgress', 'buildTime', 'producing', 'produceProgress',
  'ore', 'capacity', 'returningToRefinery', 'power', 'powerUse', 'cost', 'icon', 'desc',
  'veterancy', 'kills', 'ironCurtain', 'chronoStun', 'invulnerable',
  'faction', 'z', 'ammo', 'maxAmmo', 'returningToBase', 'harvestTimer', 'selected',
  // 出厂单位赴集结点标记：漏掉会让读档后单位停在原地不再转守卫
  'autoGuard'
];
// {x, y} 坐标点字段
const POINT_FIELDS = ['harvestTarget', 'rallyPoint', 'attackMoveTarget', 'guardPos'];
// 需要复制的数组字段
const ARRAY_FIELDS = ['requires', 'productionQueue'];
// 实体引用字段：存 id，读档时按 id 回填
const REF_FIELDS = ['attackTarget', 'burstTarget'];

export class SaveManager {
  save(gameState, camera, difficulty, frameCount, enemyAI) {
    try {
      var entityData = gameState.entities.filter(function(e) { return !e.dead; }).map(function(e) {
        var obj = { id: e.id, type: e.type, team: e.team, x: e.x, y: e.y };
        var i, k;
        for (i = 0; i < PERSISTED_FIELDS.length; i++) {
          k = PERSISTED_FIELDS[i];
          if (e[k] !== undefined) obj[k] = e[k];
        }
        for (i = 0; i < POINT_FIELDS.length; i++) {
          k = POINT_FIELDS[i];
          if (e[k]) obj[k] = { x: e[k].x, y: e[k].y };
        }
        for (i = 0; i < ARRAY_FIELDS.length; i++) {
          k = ARRAY_FIELDS[i];
          if (e[k]) obj[k] = e[k].slice();
        }
        for (i = 0; i < REF_FIELDS.length; i++) {
          k = REF_FIELDS[i];
          if (e[k]) obj[k] = e[k].id;
        }
        return obj;
      });
      // 敌方 AI 完整状态：只存 attackWave 会导致读档后 AI 节奏（建造/进攻计时）全部重置
      var aiState = (enemyAI && typeof enemyAI === 'object')
        ? {
            aiTimer: enemyAI.aiTimer || 0,
            buildQueue: enemyAI.buildQueue ? enemyAI.buildQueue.slice() : [],
            attackTimer: enemyAI.attackTimer || 0,
            attackWave: enemyAI.attackWave || 0,
            scoutTimer: enemyAI.scoutTimer || 0
          }
        : { attackWave: enemyAI || 0 };
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
        playerFaction: gameState.playerFaction,
        enemyFaction: gameState.enemyFaction,
        playerPowerBlackout: gameState.playerPowerBlackout,
        enemyPowerBlackout: gameState.enemyPowerBlackout,
        hasRadar: gameState.hasRadar,
        hasTechCenter: gameState.hasTechCenter,
        controlGroups: gameState.controlGroups,
        stats: gameState.stats,
        camera: { x: camera.x, y: camera.y, zoom: camera.zoom },
        difficulty: difficulty,
        frameCount: frameCount,
        enemyAttackWave: aiState.attackWave,
        enemyAI: aiState,
        fogOfWar: gameState.fogOfWar.serialize(),
        superWeapons: gameState.superWeaponManager ? gameState.superWeaponManager.serialize() : null,
        version: 4
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
      gameState.map._oreDirty = true;
      // 地形来自存档，需重建连通区域，否则寻路的不可达预检会失效
      gameState.map.recomputeRegions();
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
      // 旧档存的是 30，读档后会被打回旧上限；取较大值让旧档自动升级
      gameState.playerUnitMax = Math.max(save.playerUnitMax || 0, gameState.playerUnitMax);
      // 阵营：缺失时按基地所属阵营回填，避免读档后阵营限制失效
      gameState.playerFaction = save.playerFaction || null;
      gameState.enemyFaction = save.enemyFaction || null;
      gameState.playerPowerBlackout = save.playerPowerBlackout || 0;
      gameState.enemyPowerBlackout = save.enemyPowerBlackout || 0;
      gameState.hasRadar = save.hasRadar;
      gameState.hasTechCenter = save.hasTechCenter;
      gameState.controlGroups = save.controlGroups || {};
      gameState.stats = save.stats || gameState.stats;

      // 加载战争迷雾数据（deserialize 兼容 v2 二维数组与 v3 平铺数组）
      gameState.fogOfWar.deserialize(save.fogOfWar);
      // 加载超级武器冷却状态
      if (gameState.superWeaponManager && save.superWeapons) gameState.superWeaponManager.deserialize(save.superWeapons);

      var entityMap = {};
      gameState.entities = [];
      for (var ei = 0; ei < save.entities.length; ei++) {
        var ed = save.entities[ei];
        var e = new Entity(ed.type, ed.team, ed.x, ed.y);
        var ki, kk;
        for (ki = 0; ki < PERSISTED_FIELDS.length; ki++) {
          kk = PERSISTED_FIELDS[ki];
          if (ed[kk] !== undefined) e[kk] = ed[kk];
        }
        e.id = ed.id;
        for (ki = 0; ki < POINT_FIELDS.length; ki++) {
          kk = POINT_FIELDS[ki];
          if (ed[kk]) e[kk] = { x: ed[kk].x, y: ed[kk].y };
        }
        for (ki = 0; ki < ARRAY_FIELDS.length; ki++) {
          kk = ARRAY_FIELDS[ki];
          if (ed[kk]) e[kk] = ed[kk].slice();
        }
        e.path = []; e.pathIndex = 0; e.pathRecalcTimer = 0;
        e.dead = false; e.deathTimer = 45;
        e.flashTimer = 0; e.lastDamagedBy = null; e.lastDamagedTimer = 0;
        e.muzzleFlash = 0; e.burstTarget = null;
        if (ed.id > Entity.counter) Entity.counter = ed.id;
        entityMap[ed.id] = e;
        gameState.entities.push(e);
        // 占用必须对所有建筑恢复，不能只恢复已完工的：
        // 在建建筑同样占格（spawnEntity 无条件 setOccupancy），漏掉会让读档后
        // 该建筑可被单位穿过、也能在上面叠建，且完工分支也不会补上
        if (e.isBuilding) gameState.map.setOccupancy(e);
      }
      for (var ai = 0; ai < gameState.entities.length; ai++) {
        var ae = gameState.entities[ai];
        var aed = save.entities[ai];
        if (aed.attackTarget && entityMap[aed.attackTarget]) ae.attackTarget = entityMap[aed.attackTarget];
        if (aed.burstTarget && entityMap[aed.burstTarget]) ae.burstTarget = entityMap[aed.burstTarget];
      }

      // 阵营回填：v5 之前的存档没有 playerFaction/enemyFaction，
      // 此时从双方基地的 faction 推断，否则读档后阵营限制会失效
      if (!gameState.playerFaction || !gameState.enemyFaction) {
        for (var fi = 0; fi < gameState.entities.length; fi++) {
          var fe = gameState.entities[fi];
          if (fe.type !== 'base' || !fe.faction) continue;
          if (fe.team === 0 && !gameState.playerFaction) gameState.playerFaction = fe.faction;
          if (fe.team === 1 && !gameState.enemyFaction) gameState.enemyFaction = fe.faction;
        }
      }

      var camera = { x: save.camera.x, y: save.camera.y, zoom: save.camera.zoom || 1 };
      var difficulty = save.difficulty;
      var frameCount = save.frameCount;
      var enemyAttackWave = save.enemyAttackWave || 0;
      // 兼容 v4（完整 AI 状态）与 v3 旧档（只有 attackWave）
      var enemyAIState = save.enemyAI || { aiTimer: 0, buildQueue: [], attackTimer: 0, attackWave: enemyAttackWave, scoutTimer: 0 };
      var gameStartTime = Date.now() - frameCount * (1000 / 60);

      return { gameState, camera, difficulty, frameCount, enemyAttackWave, enemyAIState, gameStartTime };
    } catch (e) {
      return null;
    }
  }

  hasSave() {
    return !!localStorage.getItem('redAlertSave');
  }
}

import { SUPER_WEAPONS } from './definitions.js';
import { TILE_SIZE, TEAM_PLAYER, FPS } from './constants.js';

/** 定义里的冷却是秒，管理器内部按帧计时，这里统一换算 */
function cooldownFrames(def) {
  const sec = def.cooldownSec !== undefined ? def.cooldownSec : 90;
  return sec * FPS;
}

/**
 * 超级武器管理器
 */
export class SuperWeaponManager {
  constructor(gameState) {
    this.gameState = gameState;
    this.playerSuperWeapons = new Map(); // type -> { ready, cooldown, timer }
    this.enemySuperWeapons = new Map();
    this.activeEffects = []; // 正在进行的超级武器效果
    this.onLaunch = null;    // (type, team) => void，由 main.js 接线音效/警报
    this.onChronoPending = null; // (team) => void，有待选目的地的传送时触发
    this.onChronoExpired = null; // (team) => void，传送选择超时取消时触发
    this._statusCount = 0;   // 带计时状态（铁幕/传送眩晕）的单位数，0 时跳过全实体遍历
  }

  /**
   * 添加超级武器
   */
  addSuperWeapon(type, team) {
    const def = SUPER_WEAPONS[type];
    if (!def) return false;

    // 已注册则保留现有计时，避免重复调用（如每帧的建筑扫描）重置冷却
    const existing = team === TEAM_PLAYER ? this.playerSuperWeapons : this.enemySuperWeapons;
    if (existing.has(type)) return false;

    const weapon = {
      type: type,
      ready: false,
      cooldown: cooldownFrames(def),
      timer: 0,
      target: null
    };
    
    if (team === TEAM_PLAYER) {
      this.playerSuperWeapons.set(type, weapon);
    } else {
      this.enemySuperWeapons.set(type, weapon);
    }
    return true;
  }

  /**
   * 注销超级武器。建筑被摧毁/变卖后必须调用，否则超武会继续充能并可用。
   */
  removeSuperWeapon(type, team) {
    const map = team === TEAM_PLAYER ? this.playerSuperWeapons : this.enemySuperWeapons;
    const removed = map.delete(type);
    // 超时空传送：若正处于「选择目的地」状态，传送仪被拆时必须一并取消，
    // 否则玩家会卡在瞄准模式里无法操作
    if (type === 'chrono') {
      for (let i = this.activeEffects.length - 1; i >= 0; i--) {
        const ef = this.activeEffects[i];
        if (ef.type === 'chronoPending' && ef.team === team) {
          this.activeEffects.splice(i, 1);
          if (this.onChronoExpired) this.onChronoExpired(team);
        }
      }
    }
    return removed;
  }

  /**
   * 以「当前存活的发射建筑」为准同步超武集合：
   * 缺的补上、多的（建筑已被拆）注销。由主循环的建筑扫描定期调用。
   * @param {Set<string>} activePlayer 玩家侧仍存活的超武类型
   * @param {Set<string>} activeEnemy  敌方侧仍存活的超武类型
   */
  syncActive(activePlayer, activeEnemy) {
    // Map.keys() 的迭代器在迭代中删除当前项是安全的，无需先 Array.from 拷一份
    for (const type of this.playerSuperWeapons.keys()) {
      if (!activePlayer.has(type)) this.removeSuperWeapon(type, TEAM_PLAYER);
    }
    for (const type of this.enemySuperWeapons.keys()) {
      if (!activeEnemy.has(type)) this.removeSuperWeapon(type, 1);
    }
  }

  /**
   * 更新超级武器冷却
   */
  update() {
    // 更新玩家超级武器
    for (const weapon of this.playerSuperWeapons.values()) {
      if (!weapon.ready) {
        weapon.timer++;
        if (weapon.timer >= weapon.cooldown) {
          weapon.ready = true;
          weapon.timer = 0;
        }
      }
    }
    
    // 更新敌人超级武器
    for (const weapon of this.enemySuperWeapons.values()) {
      if (!weapon.ready) {
        weapon.timer++;
        if (weapon.timer >= weapon.cooldown) {
          weapon.ready = true;
          weapon.timer = 0;
        }
      }
    }
    
    // 更新活跃效果
    this.updateActiveEffects();
  }

  /**
   * 使用超级武器。目标无效（如超时空范围内没有己方单位）时返回 false 且不消耗冷却。
   */
  useSuperWeapon(type, team, targetX, targetY) {
    const weapons = team === TEAM_PLAYER ? this.playerSuperWeapons : this.enemySuperWeapons;
    const weapon = weapons.get(type);

    if (!weapon || !weapon.ready) return false;

    let ok = false;
    switch (type) {
      case 'nuke':
        this.launchNuke(targetX, targetY, team);
        ok = true;
        break;
      case 'lightningStorm':
        this.startLightningStorm(targetX, targetY, team);
        ok = true;
        break;
      case 'ironCurtain':
        ok = this.activateIronCurtain(targetX, targetY, team);
        break;
      case 'chrono':
        ok = this.chronoShift(targetX, targetY, team);
        break;
    }

    if (!ok) return false;

    if (this.onLaunch) this.onLaunch(type, team, targetX, targetY);

    weapon.ready = false;
    weapon.timer = 0;
    return true;
  }

  /**
   * 核弹攻击
   */
  launchNuke(targetX, targetY, team) {
    // 添加核弹飞行效果（音效与警报由 onLaunch 回调统一处理）
    this.activeEffects.push({
      type: 'nuke',
      team: team,
      x: targetX,
      y: targetY,
      timer: 120, // 2秒预警时间
      maxTimer: 120,
      stage: 'incoming' // incoming -> explode
    });
  }

  /**
   * 闪电风暴
   */
  startLightningStorm(targetX, targetY, team) {
    const def = SUPER_WEAPONS.lightningStorm;
    
    this.activeEffects.push({
      type: 'lightningStorm',
      team: team,
      x: targetX,
      y: targetY,
      timer: def.duration,
      maxTimer: def.duration,
      damage: def.damage,
      radius: def.radius
    });
  }

  /**
   * 铁幕装置。范围内没有己方单位时返回 false。
   */
  activateIronCurtain(targetX, targetY, team) {
    const def = SUPER_WEAPONS.ironCurtain;

    // 找到范围内的友方单位
    const range = 3; // 3格范围
    const range2 = range * range;
    let affected = 0;
    for (const entity of this.gameState.entities) {
      if (entity.team === team && !entity.dead && !entity.isBuilding) {
        const dx = entity.x - targetX;
        const dy = entity.y - targetY;
        if (dx * dx + dy * dy <= range2) {
          // 给予无敌效果
          if (!entity.ironCurtain) this._statusCount++;
          entity.ironCurtain = def.duration;
          entity.invulnerable = true;
          affected++;
        }
      }
    }
    if (affected === 0) return false;

    // 添加视觉效果
    this.activeEffects.push({
      type: 'ironCurtain',
      team: team,
      x: targetX,
      y: targetY,
      timer: 60, // 1秒视觉效果
      radius: range
    });
    return true;
  }

  /**
   * 超时空传送。范围内没有己方单位时返回 false。
   */
  chronoShift(targetX, targetY, team) {
    // 选择范围内的单位进行传送
    const range = 2;
    const range2 = range * range;
    const targets = [];

    for (const entity of this.gameState.entities) {
      if (entity.team === team && !entity.dead && !entity.isBuilding) {
        const dx = entity.x - targetX;
        const dy = entity.y - targetY;
        if (dx * dx + dy * dy <= range2) {
          targets.push(entity);
        }
      }
    }

    if (targets.length === 0) return false;

    // 最多传送5个单位
    const toTeleport = targets.slice(0, 5);

    // 标记为待传送状态（需要玩家选择目的地）
    this.activeEffects.push({
      type: 'chronoPending',
      team: team,
      units: toTeleport,
      sourceX: targetX,
      sourceY: targetY,
      timer: 300 // 5秒选择时间
    });
    if (this.onChronoPending) this.onChronoPending(team);
    return true;
  }

  /**
   * 完成超时空传送
   */
  completeChronoShift(effect, destX, destY) {
    for (const unit of effect.units) {
      if (!unit.dead) {
        // 传送效果
        this.gameState.addExplosion(unit.getCenterX(), unit.getCenterY(), 20, 'chrono');

        // 移动单位
        unit.x = destX;
        unit.y = destY;
        unit.path = [];
        unit.pathIndex = 0;

        // 到达效果
        this.gameState.addExplosion(unit.getCenterX(), unit.getCenterY(), 20, 'chrono');

        // 传送后短暂眩晕
        if (!unit.chronoStun) this._statusCount++;
        unit.chronoStun = 60; // 1秒
      }
    }
  }

  /**
   * 更新活跃效果
   */
  updateActiveEffects() {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      effect.timer--;
      
      switch (effect.type) {
        case 'nuke':
          if (effect.stage === 'incoming' && effect.timer <= 0) {
            // 核弹爆炸
            this.executeNukeExplosion(effect);
            effect.stage = 'explode';
            effect.timer = 60; // 爆炸效果持续1秒
          } else if (effect.stage === 'explode' && effect.timer <= 0) {
            this.activeEffects.splice(i, 1);
          }
          break;
          
        case 'lightningStorm':
          // 随机产生闪电
          if (effect.timer % 10 === 0) { // 每10帧一次闪电
            const lx = effect.x + (Math.random() - 0.5) * effect.radius * 2;
            const ly = effect.y + (Math.random() - 0.5) * effect.radius * 2;
            this.spawnLightning(lx, ly, effect.damage, effect.team);
          }
          if (effect.timer <= 0) {
            this.activeEffects.splice(i, 1);
          }
          break;
          
        case 'ironCurtain':
          if (effect.timer <= 0) {
            this.activeEffects.splice(i, 1);
          }
          break;

        case 'radiation':
          // 每60帧（1秒）对范围内所有单位造成无差别伤害
          if (effect.timer % 60 === 0) {
            this.gameState.applySplashDamage(
              effect.x * TILE_SIZE + TILE_SIZE / 2,
              effect.y * TILE_SIZE + TILE_SIZE / 2,
              effect.radius,
              effect.damage,
              -1 // 无效队伍 => 命中所有队伍
            );
          }
          if (effect.timer <= 0) {
            this.activeEffects.splice(i, 1);
          }
          break;

        case 'chronoPending':
          if (effect.timer <= 0) {
            // 超时取消传送
            this.activeEffects.splice(i, 1);
            if (this.onChronoExpired) this.onChronoExpired(effect.team);
          }
          break;
      }
    }

    // 更新单位的铁幕/眩晕状态（无此类单位时跳过遍历）
    if (this._statusCount > 0) {
      const entities = this.gameState.entities;
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (entity.ironCurtain > 0) {
          entity.ironCurtain--;
          if (entity.ironCurtain <= 0) {
            entity.invulnerable = false;
            this._statusCount--;
          }
        }
        if (entity.chronoStun > 0) {
          entity.chronoStun--;
          if (entity.chronoStun <= 0) this._statusCount--;
        }
      }
    }
  }

  /**
   * 执行核弹爆炸
   */
  executeNukeExplosion(effect) {
    const def = SUPER_WEAPONS.nuke;
    
    // 大范围爆炸效果
    this.gameState.addExplosion(
      effect.x * TILE_SIZE + TILE_SIZE / 2,
      effect.y * TILE_SIZE + TILE_SIZE / 2,
      80, 'nuke'
    );
    
    // 范围伤害
    this.gameState.applySplashDamage(
      effect.x * TILE_SIZE + TILE_SIZE / 2,
      effect.y * TILE_SIZE + TILE_SIZE / 2,
      def.radius,
      def.damage,
      effect.team
    );
    
    // 留下辐射区域
    this.activeEffects.push({
      type: 'radiation',
      x: effect.x,
      y: effect.y,
      timer: 600, // 10秒辐射
      damage: 20, // 每秒伤害
      radius: def.radius
    });
  }

  /**
   * 产生闪电
   */
  spawnLightning(x, y, damage, team) {
    // 找到最近的目标
    let target = null;
    let minDist = Infinity;
    
    for (const entity of this.gameState.entities) {
      if (entity.team !== team && !entity.dead) {
        const dx = entity.x - x;
        const dy = entity.y - y;
        const dist = dx * dx + dy * dy; // 只比远近与阈值，平方即可
        if (dist < minDist && dist <= 9) {
          minDist = dist;
          target = entity;
        }
      }
    }
    
    if (target) {
      // 造成伤害（击杀归属走 lastDamagedBy / 统一伤害入口）
      const actualDamage = Math.floor(damage * (0.8 + Math.random() * 0.4));
      this.gameState.damageEntity(target, actualDamage);

      // 闪电视觉效果
      this.gameState.addExplosion(
        target.getCenterX(),
        target.getCenterY(),
        30, 'lightning'
      );
    }
  }

  /**
   * 检查是否有待处理的超时空传送
   */
  getPendingChrono(team) {
    return this.activeEffects.find(e => e.type === 'chronoPending' && e.team === team);
  }

  /**
   * 获取超级武器状态
   */
  getSuperWeaponStatus(type, team) {
    const weapons = team === TEAM_PLAYER ? this.playerSuperWeapons : this.enemySuperWeapons;
    return weapons.get(type);
  }

  /**
   * 获取所有超级武器状态
   */
  getAllSuperWeapons(team) {
    const weapons = team === TEAM_PLAYER ? this.playerSuperWeapons : this.enemySuperWeapons;
    return Array.from(weapons.entries()).map(([type, data]) => ({
      type,
      ...data,
      def: SUPER_WEAPONS[type]
    }));
  }

  /**
   * 渲染超级武器效果（世界坐标系，由 Renderer 在 camera transform 内调用）
   */
  render(ctx, frameCount) {
    for (const effect of this.activeEffects) {
      switch (effect.type) {
        case 'nuke':
          if (effect.stage === 'incoming') {
            // 绘制核弹预警标记
            const x = effect.x * TILE_SIZE;
            const y = effect.y * TILE_SIZE;
            const progress = 1 - effect.timer / effect.maxTimer;

            ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + progress * 0.5})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 20 + progress * 30, 0, Math.PI * 2);
            ctx.stroke();

            // 倒计时
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(effect.timer / 60), x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 7);
          }
          break;

        case 'lightningStorm': {
          // 绘制风暴范围
          const sx = effect.x * TILE_SIZE;
          const sy = effect.y * TILE_SIZE;
          ctx.fillStyle = 'rgba(100, 0, 200, 0.2)';
          ctx.beginPath();
          ctx.arc(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2, effect.radius * TILE_SIZE, 0, Math.PI * 2);
          ctx.fill();
          // 随机闪电视觉
          ctx.strokeStyle = `rgba(200,180,255,${0.4 + Math.random() * 0.4})`;
          ctx.lineWidth = 2;
          const lx1 = sx + (Math.random() - 0.5) * effect.radius * TILE_SIZE;
          const ly1 = sy + (Math.random() - 0.5) * effect.radius * TILE_SIZE;
          ctx.beginPath();
          ctx.moveTo(lx1, ly1 - 30);
          ctx.lineTo(lx1 + (Math.random() - 0.5) * 10, ly1);
          ctx.stroke();
          break;
        }

        case 'ironCurtain': {
          // 绘制铁幕效果
          const ix = effect.x * TILE_SIZE;
          const iy = effect.y * TILE_SIZE;
          ctx.strokeStyle = 'rgba(142, 68, 173, 0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ix + TILE_SIZE / 2, iy + TILE_SIZE / 2, effect.radius * TILE_SIZE, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }

        case 'radiation': {
          // 绘制辐射区域
          const rx = effect.x * TILE_SIZE;
          const ry = effect.y * TILE_SIZE;
          const radAlpha = (effect.timer / 600) * 0.3;
          ctx.fillStyle = `rgba(0, 255, 0, ${radAlpha})`;
          ctx.beginPath();
          ctx.arc(rx + TILE_SIZE / 2, ry + TILE_SIZE / 2, effect.radius * TILE_SIZE, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }
  }

  /**
   * 序列化（供存档）
   */
  serialize() {
    const dump = map => Array.from(map.entries()).map(([type, w]) => ({ type, ready: w.ready, timer: w.timer }));
    return { player: dump(this.playerSuperWeapons), enemy: dump(this.enemySuperWeapons) };
  }

  /**
   * 反序列化（供读档）
   */
  deserialize(data) {
    if (!data) return;
    const restore = (arr, map) => {
      if (!arr) return;
      for (const item of arr) {
        const def = SUPER_WEAPONS[item.type];
        if (!def) continue;
        map.set(item.type, {
          type: item.type,
          ready: !!item.ready,
          cooldown: cooldownFrames(def),
          timer: item.timer || 0,
          target: null
        });
      }
    };
    restore(data.player, this.playerSuperWeapons);
    restore(data.enemy, this.enemySuperWeapons);
  }
}

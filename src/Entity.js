import { TILE_SIZE, TYPE_AIRCRAFT, TYPE_HELICOPTER, TYPE_AIRSHIP } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS, DAMAGE_TYPES } from './definitions.js';

let entityCounter = 0;

export class Entity {
  constructor(type, team, x, y) {
    const def = BUILDING_DEFS[type] || DEFENSE_DEFS[type] || UNIT_DEFS[type];
    this.id = ++entityCounter;
    this.type = type;
    this.team = team;
    this.x = x;
    this.y = y;
    this.z = 0; // 高度（用于空军）
    this.hp = def ? def.hp : 100;
    this.maxHp = def ? def.hp : 100;
    this.size = def ? (def.size || 1) : 1;
    this.name = def ? def.name : type;
    this.isBuilding = !!(BUILDING_DEFS[type] || DEFENSE_DEFS[type]);
    this.category = def ? def.category : 'units';
    this.damage = (def && def.damage) || 0;
    this.range = (def && def.range) || 0;
    this.fireRate = (def && def.fireRate) || 0;
    this.fireCooldown = Math.floor(Math.random() * 20);
    this.speed = (def && def.speed) || 0;
    this.type2 = (def && def.type) || '';
    this.antiArmor = (def && def.antiArmor) || false;
    this.antiAir = (def && def.antiAir) || false;
    this.canRepair = (def && def.canRepair) || false;
    this.canCapture = (def && def.canCapture) || false;
    this.splashRadius = (def && def.splashRadius) || 0;
    this.burstCount = (def && def.burstCount) || 0;
    this.burstRemaining = 0;
    this.burstTarget = null;
    this.path = [];
    this.pathIndex = 0;
    this.pathRecalcTimer = 0;
    this.direction = 0;
    this.turretDir = 0;
    this.animFrame = 0;
    this.animTimer = 0;
    this.built = this.isBuilding ? (def && def.buildTime === 0) : true;
    this.buildProgress = this.built ? 100 : 0;
    this.buildTime = (def && def.buildTime) || 0;
    this.producing = null;
    this.produceProgress = 0;
    this.productionQueue = [];
    this.ore = 0;
    this.capacity = (def && def.capacity) || 0;
    this.harvestTarget = null;
    this.harvestTimer = 0;
    this.returningToRefinery = false;
    this.rallyPoint = null;
    this.dead = false;
    this.deathTimer = 45;
    this.muzzleFlash = 0;
    this.selected = false;
    this.attackTarget = null;
    this.attackMoveTarget = null;
    this.guardPos = null;
    this.autoGuard = false;   // 出厂单位：抵达集结点后自动转入守卫状态
    this.power = (def && def.power) || 0;
    this.powerUse = (def && def.powerUse) || 0;
    this.requires = (def && def.requires) ? def.requires.slice() : [];
    this.cost = (def && def.cost) || 0;
    this.icon = (def && def.icon) || '#888';
    this.desc = (def && def.desc) || '';
    this.flashTimer = 0;
    this.lastDamagedBy = null;
    this.lastDamagedTimer = 0;
    this.veterancy = 0;
    this.kills = 0;
    
    // 阵营
    this.faction = (def && def.faction) || null;
    
    // 装甲类型
    this.armorType = (def && def.armorType) || 'light';
    
    // 伤害类型
    this.damageType = (def && def.damageType) || 'cannon';
    if (def && def.laser) this.damageType = 'laser';
    if (def && def.missile) this.damageType = 'missile';
    if (def && def.torpedo) this.damageType = 'torpedo';
    if (def && def.bomb) this.damageType = 'bomb';
    
    // 空军相关
    this.isAirUnit = this.type2 === TYPE_AIRCRAFT || this.type2 === TYPE_HELICOPTER || this.type2 === TYPE_AIRSHIP;
    this.ammo = (def && def.ammo) || null;
    this.maxAmmo = this.ammo;
    this.returningToBase = false;
    this.homeBase = null; // 所属机场/基地
    
    // 特殊能力
    this.stealth = (def && def.stealth) || false;
    this.stealthActive = this.stealth;
    this.canDeploy = (def && def.canDeploy) || false;
    this.deployed = false;
    this.transport = (def && def.transport) || 0;
    this.cargo = [];
    this.hero = (def && def.hero) || false;
    this.c4 = (def && def.c4) || false;
    this.canBomb = (def && def.canBomb) || false;
    
    // 渲染相关
    this.renderTurretAngle = 0;
    this.renderAngle = 0;
  }

  getCenterX() {
    return (this.x + (this.isBuilding ? this.size / 2 : 0.5)) * TILE_SIZE;
  }

  getCenterY() {
    return (this.y + (this.isBuilding ? this.size / 2 : 0.5)) * TILE_SIZE;
  }

  /**
   * 计算对目标的伤害
   */
  calculateDamage(target) {
    const damageType = DAMAGE_TYPES[this.damageType] || DAMAGE_TYPES.cannon;

    // 伤害类型 × 目标装甲类型 倍率表
    let multiplier;
    if (target.type2 === 'naval' && damageType.naval !== undefined) {
      multiplier = damageType.naval;
    } else {
      multiplier = damageType[target.armorType] !== undefined ? damageType[target.armorType] : 1.0;
    }
    
    // 反装甲加成
    if (this.antiArmor && (target.type2 === 'vehicle' || target.type2 === 'harvester')) {
      multiplier *= 1.5;
    }
    
    // 精英单位加成
    if (this.veterancy >= 1) multiplier *= 1.25;
    if (this.veterancy >= 2) multiplier *= 1.5;
    
    // 随机波动
    const scatter = 0.85 + Math.random() * 0.3;
    
    return Math.floor(this.damage * multiplier * scatter);
  }

  /**
   * 检查是否可以攻击目标
   */
  canAttack(target) {
    if (this.damage <= 0) return false;
    if (target.dead) return false;
    if (target.team === this.team) return false;
    
    // 对空检查
    if (target.isAirUnit && !this.antiAir) return false;
    
    // 空军弹药检查
    if (this.isAirUnit && this.ammo !== null && this.ammo <= 0) return false;
    
    return true;
  }

  /**
   * 消耗弹药
   */
  consumeAmmo() {
    if (this.ammo !== null) {
      this.ammo--;
      if (this.ammo <= 0) {
        this.returningToBase = true;
      }
    }
  }

  /**
   * 补充弹药
   */
  reload() {
    if (this.ammo !== null) {
      this.ammo = this.maxAmmo;
      this.returningToBase = false;
    }
  }

  static resetCounter() {
    entityCounter = 0;
  }

  static get counter() {
    return entityCounter;
  }

  static set counter(v) {
    entityCounter = v;
  }
}

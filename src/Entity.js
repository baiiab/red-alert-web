import { TILE_SIZE } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS } from './definitions.js';

let entityCounter = 0;

export class Entity {
  constructor(type, team, x, y) {
    const def = BUILDING_DEFS[type] || DEFENSE_DEFS[type] || UNIT_DEFS[type];
    this.id = ++entityCounter;
    this.type = type;
    this.team = team;
    this.x = x;
    this.y = y;
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
  }

  getCenterX() {
    return (this.x + (this.isBuilding ? this.size / 2 : 0.5)) * TILE_SIZE;
  }

  getCenterY() {
    return (this.y + (this.isBuilding ? this.size / 2 : 0.5)) * TILE_SIZE;
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

// 阵营定义
export const FACTION_ALLIED = 'allied';
export const FACTION_SOVIET = 'soviet';
// 阵营显示名（用于「XX专属单位」这类提示）
export const FACTION_NAMES = { [FACTION_ALLIED]: '盟军', [FACTION_SOVIET]: '苏联' };

// 原版红警经典单位和建筑定义

// ==================== 建筑定义 ====================
export const BUILDING_DEFS = {
  // 基础建筑（双方共有）
  base:        { name:'建造厂',   cost:0,    hp:2200, size:3, power:50, powerUse:0,  buildTime:0, requires:[], category:'buildings', icon:'#7f8c8d', desc:'基地核心，提供50电力', faction: null },
  powerPlant:  { name:'发电厂',   cost:300,  hp:500,  size:2, power:200,powerUse:0,  buildTime:4, requires:['base'], category:'buildings', icon:'#f1c40f', desc:'提供200电力', faction: null },
  refinery:    { name:'矿厂',     cost:500,  hp:700,  size:3, powerUse:30, buildTime:6, requires:['base'], category:'buildings', icon:'#e67e22', desc:'精炼矿石，附赠采矿车', faction: null },
  barracks:    { name:'兵营',     cost:400,  hp:600,  size:2, powerUse:20, buildTime:5, requires:['powerPlant'], category:'buildings', icon:'#27ae60', desc:'训练步兵单位', faction: null },
  warFactory:  { name:'战车工厂', cost:700,  hp:800,  size:3, powerUse:40, buildTime:7, requires:['barracks'], category:'buildings', icon:'#6c3483', desc:'制造车辆单位', faction: null },
  radar:       { name:'雷达站',   cost:600,  hp:400,  size:2, powerUse:25, buildTime:5, requires:['powerPlant'], category:'buildings', icon:'#2c3e50', desc:'解锁小地图视图', faction: null },
  repairBay:   { name:'维修站',   cost:600,  hp:600,  size:2, powerUse:30, buildTime:6, requires:['warFactory'], category:'buildings', icon:'#34495e', desc:'附近车辆自动维修', faction: null },
  
  // 盟军专属建筑
  alliedTech:  { name:'盟军科技中心', cost:1200, hp:550, size:2, powerUse:50, buildTime:9, requires:['radar','warFactory'], category:'buildings', icon:'#3498db', desc:'解锁盟军高级科技', faction: FACTION_ALLIED },
  orePurifier: { name:'矿石精炼器', cost:1500, hp:400, size:2, powerUse:40, buildTime:8, requires:['alliedTech'], category:'buildings', icon:'#f1c40f', desc:'提高矿石价值25%', faction: FACTION_ALLIED },
  
  // 苏联专属建筑
  sovietTech:  { name:'苏联科技中心', cost:1200, hp:600, size:2, powerUse:50, buildTime:9, requires:['radar','warFactory'], category:'buildings', icon:'#c0392b', desc:'解锁苏联高级科技', faction: FACTION_SOVIET },
  ironCurtain: { name:'铁幕装置', cost:2500, hp:800, size:2, powerUse:100, buildTime:12, requires:['sovietTech'], category:'buildings', icon:'#8e44ad', desc:'超级武器：无敌护盾', faction: FACTION_SOVIET, superWeapon: 'ironCurtain' },
  nukeSilo:    { name:'核弹发射井', cost:3000, hp:1000, size:2, powerUse:150, buildTime:15, requires:['sovietTech'], category:'buildings', icon:'#e74c3c', desc:'超级武器：核弹攻击', faction: FACTION_SOVIET, superWeapon: 'nuke' },
  
  // 超级武器建筑（盟军）
  weatherControl: { name:'天气控制机', cost:3000, hp:1000, size:2, powerUse:150, buildTime:15, requires:['alliedTech'], category:'buildings', icon:'#9b59b6', desc:'超级武器：闪电风暴', faction: FACTION_ALLIED, superWeapon: 'lightningStorm' },
  chronosphere: { name:'超时空传送仪', cost:2500, hp:800, size:2, powerUse:100, buildTime:12, requires:['alliedTech'], category:'buildings', icon:'#00bfff', desc:'超级武器：瞬间传送', faction: FACTION_ALLIED, superWeapon: 'chrono' },
};

// ==================== 防御建筑定义 ====================
export const DEFENSE_DEFS = {
  // 基础防御（双方共有）
  wall:    { name:'城墙',       cost:50,   hp:400, size:1, powerUse:0,  buildTime:1, requires:['base'],       range:0, damage:0,   fireRate:0,  category:'defenses', icon:'#7f8c8d', desc:'廉价障碍物', faction: null },
  pillbox: { name:'碉堡',       cost:300,  hp:550, size:1, powerUse:10, buildTime:4, requires:['barracks'],   range:5, damage:20,  fireRate:25, category:'defenses', icon:'#d35400', desc:'快速射击步兵防御', faction: null },
  
  // 盟军专属防御
  prismTower: { name:'光棱塔',    cost:1200, hp:500, size:1, powerUse:60, buildTime:6, requires:['alliedTech'], range:10, damage:120, fireRate:60, category:'defenses', icon:'#9b59b6', desc:'高能激光防御，可连线增强', faction: FACTION_ALLIED, canLink: true },
  patriot:    { name:'爱国者导弹', cost:800, hp:450, size:1, powerUse:30, buildTime:5, requires:['warFactory'], range:12, damage:40, fireRate:20, category:'defenses', icon:'#3498db', desc:'防空导弹，对空专用', faction: FACTION_ALLIED, antiAir: true },
  
  // 苏联专属防御
  tesla:   { name:'磁暴线圈',   cost:1200, hp:500, size:1, powerUse:60, buildTime:6, requires:['sovietTech'], range:8, damage:110, fireRate:50, category:'defenses', icon:'#00bfff', desc:'强力电磁攻击', faction: FACTION_SOVIET },
  flakCannon: { name:'高射炮',   cost:800, hp:500, size:1, powerUse:30, buildTime:5, requires:['warFactory'], range:10, damage:35, fireRate:15, category:'defenses', icon:'#c0392b', desc:'苏联防空炮，对空专用', faction: FACTION_SOVIET, antiAir: true, splashRadius: 1 },
  
  // 通用防御
  turret:  { name:'重炮塔',     cost:600,  hp:700, size:1, powerUse:20, buildTime:5, requires:['warFactory'], range:7, damage:40,  fireRate:48, category:'defenses', icon:'#8e44ad', desc:'反装甲重炮', faction: null },
};

// ==================== 单位定义 ====================
export const UNIT_DEFS = {
  // ==================== 步兵单位 ====================
  // 基础步兵（双方共有）
  infantry:   { name:'美国大兵',   cost:100, hp:60,  speed:1.5, damage:12,  range:4, fireRate:25, requires:['barracks'],  buildTime:3, type:'infantry', category:'units', icon:'#2ecc71', desc:'基础步兵，可部署', faction: FACTION_ALLIED, canDeploy: true },
  conscript:  { name:'动员兵',     cost:80,  hp:70,  speed:1.4, damage:10,  range:4, fireRate:28, requires:['barracks'],  buildTime:3, type:'infantry', category:'units', icon:'#c0392b', desc:'苏联基础步兵', faction: FACTION_SOVIET },
  
  // 反装甲步兵
  rocket:     { name:'重装大兵',   cost:200, hp:55,  speed:1.2, damage:30,  range:6, fireRate:42, requires:['barracks'],  buildTime:4, type:'infantry', antiArmor:true, category:'units', icon:'#e74c3c', desc:'反装甲/防空步兵', faction: FACTION_ALLIED },
  flakTrooper:{ name:'防空步兵',   cost:180, hp:60,  speed:1.2, damage:25,  range:5, fireRate:35, requires:['barracks'],  buildTime:4, type:'infantry', antiArmor:true, antiAir:true, category:'units', icon:'#8e44ad', desc:'苏联反装甲防空兵', faction: FACTION_SOVIET },
  
  // 工程师
  engineer:   { name:'工程师',     cost:300, hp:35,  speed:1.8, damage:0,   range:0, fireRate:0,  requires:['barracks'],  buildTime:4, type:'infantry', canRepair:true, canCapture:true, category:'units', icon:'#f39c12', desc:'占领建筑/修复', faction: null },
  
  // 特殊步兵
  spy:        { name:'间谍',       cost:500, hp:30,  speed:2.0, damage:0,   range:0, fireRate:0,  requires:['barracks','radar'], buildTime:5, type:'infantry', category:'units', icon:'#95a5a6', desc:'渗透敌方建筑获取科技', faction: FACTION_ALLIED, stealth: true },
  tanya:      { name:'谭雅',       cost:1000,hp:120, speed:2.2, damage:50,  range:3, fireRate:10, requires:['barracks','alliedTech'], buildTime:8, type:'infantry', category:'units', icon:'#e91e63', desc:'精英特工，可炸建筑', faction: FACTION_ALLIED, hero: true, c4: true },
  
  // 苏联特殊步兵
  attackDog:  { name:'军犬',       cost:150, hp:40,  speed:2.5, damage:30,  range:1, fireRate:15, requires:['barracks'], buildTime:2, type:'infantry', category:'units', icon:'#795548', desc:'快速侦察，秒杀步兵', faction: FACTION_SOVIET },
  crazyIvan:  { name:'疯狂伊文',   cost:400, hp:50,  speed:1.6, damage:0,   range:0, fireRate:0,  requires:['barracks','sovietTech'], buildTime:5, type:'infantry', category:'units', icon:'#ff5722', desc:'炸弹专家，可安放炸弹', faction: FACTION_SOVIET, canBomb: true },
  
  // ==================== 车辆单位 ====================
  // 采矿车
  harvester:  { name:'超时空采矿车', cost:1400, hp:600, speed:1.2, damage:0,   range:0, fireRate:0,  requires:['refinery'], buildTime:8, type:'harvester', capacity:2000, category:'units', icon:'#f1c40f', desc:'盟军采矿车，可瞬移回矿厂', faction: FACTION_ALLIED, teleport: true },
  warMiner:   { name:'武装采矿车', cost:1400, hp:800, speed:1.0, damage:20,  range:4, fireRate:30, requires:['refinery'], buildTime:8, type:'harvester', capacity:2000, category:'units', icon:'#e67e22', desc:'苏联采矿车，装备机枪', faction: FACTION_SOVIET },
  
  // 基础坦克
  grizzly:    { name:'灰熊坦克',   cost:700, hp:300, speed:2.2, damage:35,  range:5, fireRate:35, requires:['warFactory'],buildTime:5, type:'vehicle', category:'units', icon:'#3498db', desc:'盟军主战坦克，速度快', faction: FACTION_ALLIED, armorType: 'medium' },
  rhino:      { name:'犀牛坦克',   cost:700, hp:400, speed:1.8, damage:40,  range:5, fireRate:40, requires:['warFactory'],buildTime:5, type:'vehicle', category:'units', icon:'#c0392b', desc:'苏联主战坦克，装甲厚', faction: FACTION_SOVIET, armorType: 'heavy' },
  
  // 重型坦克
  apocalypse: { name:'天启坦克',   cost:1750,hp:800, speed:1.2, damage:70,  range:6, fireRate:50, requires:['warFactory','sovietTech'], buildTime:10, type:'vehicle', category:'units', icon:'#8e44ad', desc:'苏联终极坦克，双炮管', faction: FACTION_SOVIET, armorType: 'heavy', dualGun: true, canCrush: true },
  mirage:     { name:'幻影坦克',   cost:1000,hp:250, speed:1.8, damage:60,  range:6, fireRate:45, requires:['warFactory','alliedTech'], buildTime:7, type:'vehicle', category:'units', icon:'#27ae60', desc:'盟军隐形坦克，伪装成树', faction: FACTION_ALLIED, armorType: 'light', stealth: true },
  
  // 特殊车辆
  prism:      { name:'光棱坦克',   cost:1200,hp:200, speed:1.4, damage:80,  range:10,fireRate:60, requires:['warFactory','alliedTech'], buildTime:8, type:'vehicle', category:'units', icon:'#9b59b6', desc:'高能激光，可散射', faction: FACTION_ALLIED, armorType: 'light', laser: true },
  v3:         { name:'V3火箭车',   cost:800, hp:180, speed:1.2, damage:120, range:15,fireRate:80, requires:['warFactory','sovietTech'], buildTime:7, type:'vehicle', category:'units', icon:'#e74c3c', desc:'远程火箭打击', faction: FACTION_SOVIET, armorType: 'light', missile: true },
  
  // 支援车辆
  ifv:        { name:'多功能步兵车', cost:600, hp:200, speed:2.5, damage:15,  range:5, fireRate:25, requires:['warFactory'],buildTime:4, type:'vehicle', category:'units', icon:'#1abc9c', desc:'可搭载步兵，武器可变', faction: FACTION_ALLIED, transport: 1 },
  flakTrack:  { name:'防空履带车', cost:600, hp:250, speed:2.2, damage:20,  range:6, fireRate:20, requires:['warFactory'],buildTime:4, type:'vehicle', category:'units', icon:'#ff9800', desc:'苏联防空车，可运输', faction: FACTION_SOVIET, antiAir: true, transport: 2 },
  
  // 攻城单位
  arty:       { name:'自行火炮',   cost:800, hp:180, speed:1.0, damage:90,  range:12,fireRate:75, requires:['warFactory'],buildTime:6, type:'vehicle', category:'units', icon:'#e67e22', desc:'超远程范围炮击', faction: null, splashRadius:1.5 },
  
  // ==================== 空军单位 ====================
  harrier:    { name:'入侵者战机', cost:1200, hp:150, speed:4.0, damage:100, range:0, fireRate:0,  requires:['warFactory','alliedTech'], buildTime:8, type:'aircraft', category:'units', icon:'#3498db', desc:'盟军战机，对地轰炸', faction: FACTION_ALLIED, ammo: 1, returnToBase: true },
  blackEagle: { name:'黑鹰战机',   cost:1500, hp:180, speed:4.2, damage:120, range:0, fireRate:0,  requires:['warFactory','alliedTech'], buildTime:9, type:'aircraft', category:'units', icon:'#2c3e50', desc:'韩国特色战机', faction: FACTION_ALLIED, ammo: 1, returnToBase: true, subFaction: 'korea' },
  mig:        { name:'米格战机',   cost:1200, hp:180, speed:4.0, damage:90,  range:0, fireRate:0,  requires:['warFactory','sovietTech'], buildTime:8, type:'aircraft', category:'units', icon:'#c0392b', desc:'苏联战机，对地攻击', faction: FACTION_SOVIET, ammo: 1, returnToBase: true },
  
  // 直升机
  longbow:    { name:'长弓直升机', cost:1000, hp:250, speed:2.5, damage:35,  range:6, fireRate:20, requires:['warFactory','radar'], buildTime:7, type:'helicopter', category:'units', icon:'#9b59b6', desc:'盟军武装直升机', faction: FACTION_ALLIED, antiAir: true },
  hind:       { name:'雌鹿直升机', cost:1000, hp:280, speed:2.3, damage:40,  range:5, fireRate:25, requires:['warFactory','radar'], buildTime:7, type:'helicopter', category:'units', icon:'#8e44ad', desc:'苏联武装直升机', faction: FACTION_SOVIET, transport: 5 },
  
  // 特殊空军
  kirov:      { name:'基洛夫空艇', cost:2000, hp:2000,speed:0.8, damage:300, range:2, fireRate:120,requires:['warFactory','sovietTech'], buildTime:15, type:'airship', category:'units', icon:'#e91e63', desc:'苏联重型轰炸飞艇', faction: FACTION_SOVIET, armorType: 'heavy', bomb: true, slow: true },
  
  // ==================== 海军单位 ====================
  destroyer:  { name:'驱逐舰',     cost:1000, hp:400, speed:2.0, damage:45,  range:7, fireRate:35, requires:['warFactory','radar'], buildTime:7, type:'naval', category:'units', icon:'#3498db', desc:'盟军主力战舰', faction: FACTION_ALLIED },
  aegis:      { name:'神盾巡洋舰', cost:1200, hp:350, speed:1.8, damage:30,  range:10,fireRate:15, requires:['warFactory','alliedTech'], buildTime:8, type:'naval', category:'units', icon:'#9b59b6', desc:'防空专用', faction: FACTION_ALLIED, antiAir: true },
  submarine:  { name:'潜艇',       cost:1000, hp:350, speed:1.8, damage:80,  range:6, fireRate:60, requires:['warFactory','sovietTech'], buildTime:7, type:'naval', category:'units', icon:'#2c3e50', desc:'苏联隐形潜艇', faction: FACTION_SOVIET, stealth: true, torpedo: true },
  dreadnought:{ name:'无畏级战舰', cost:2000, hp:600, speed:1.2, damage:150, range:16,fireRate:100,requires:['warFactory','sovietTech'], buildTime:12, type:'naval', category:'units', icon:'#c0392b', desc:'苏联重型导弹舰', faction: FACTION_SOVIET, missile: true },
};

// ==================== 装甲类型定义 ====================
// 键为装甲类型，值为「该装甲对各类攻击者的抗性」——仅用于 UI 展示与调参参考；
// 实际伤害倍率取的是 DAMAGE_TYPES[攻击方伤害类型][目标装甲类型]（见 Entity.calculateDamage）
export const ARMOR_TYPES = {
  none:     { name: '无装甲',   desc: '步兵等无装甲目标' },
  light:    { name: '轻甲',     desc: '轻型车辆、飞机' },
  medium:   { name: '中甲',     desc: '主战坦克、舰船' },
  heavy:    { name: '重甲',     desc: '重型坦克、重型舰船' },
  concrete: { name: '混凝土',   desc: '普通建筑' },
  steel:    { name: '钢铁',     desc: '加固建筑、城墙' },
};

// ==================== 伤害类型定义 ====================
// 行 = 攻击方伤害类型，列 = 目标装甲类型。none 列不可省：
// 缺了会走 calculateDamage 的 1.0 兜底，相当于「对着步兵和对着空气一样」，
// 子弹能秒步兵、炮弹砸不动步兵这些差异就全没了。
export const DAMAGE_TYPES = {
  bullet:   { name: '子弹',   none: 1.0, light: 1.0, medium: 0.7, heavy: 0.4, concrete: 0.2, steel: 0.1 },
  cannon:   { name: '炮弹',   none: 1.0, light: 1.2, medium: 1.0, heavy: 0.8, concrete: 0.6, steel: 0.4 },
  rocket:   { name: '火箭',   none: 0.8, light: 0.8, medium: 1.0, heavy: 1.0, concrete: 0.8, steel: 0.6 },
  missile:  { name: '导弹',   none: 1.0, light: 1.0, medium: 1.0, heavy: 1.0, concrete: 1.0, steel: 0.8 },
  laser:    { name: '激光',   none: 1.0, light: 1.0, medium: 1.0, heavy: 0.8, concrete: 0.6, steel: 0.5 },
  electric: { name: '电击',   none: 1.0, light: 1.0, medium: 0.9, heavy: 0.9, concrete: 0.5, steel: 0.3 },
  bomb:     { name: '炸弹',   none: 1.0, light: 1.0, medium: 1.0, heavy: 1.0, concrete: 1.2, steel: 1.0 },
  torpedo:  { name: '鱼雷',   none: 0.0, light: 0.0, medium: 0.0, heavy: 0.0, concrete: 0.0, steel: 0.0, naval: 1.5 },
};

// ==================== 装甲 / 伤害类型分配表 ====================
// 逐个条目标注，比往每行定义里塞字段更好读，也便于一眼看出相克关系是否合理。
// Entity 里仍有按兵种兜底（见 DEFAULT_ARMOR_BY_CATEGORY），但那是保险，不是常规路径。
//
// 设计要点（对应红警2 手感）：
//   建筑 = concrete/steel，步枪几乎打不动，炮兵/炸弹才有效
//   步兵 = none，炮弹的 1.0 倍率不再被 0.6 之类削弱，但子弹专杀步兵
//   坦克 = medium/heavy，子弹倍率 0.7/0.4 —— 步枪打坦克挠痒痒
export const ARMOR_BY_TYPE = {
  // --- 建筑 ---
  base: 'steel', powerPlant: 'concrete', refinery: 'concrete', barracks: 'concrete',
  warFactory: 'concrete', radar: 'concrete', repairBay: 'concrete',
  alliedTech: 'concrete', orePurifier: 'concrete', sovietTech: 'concrete',
  ironCurtain: 'steel', nukeSilo: 'steel', weatherControl: 'steel', chronosphere: 'steel',
  // --- 防御建筑 ---
  wall: 'steel', pillbox: 'concrete', prismTower: 'concrete', patriot: 'concrete',
  tesla: 'concrete', flakCannon: 'concrete', turret: 'steel',
  // --- 步兵（一律无装甲，靠血量和机动存活）---
  infantry: 'none', conscript: 'none', rocket: 'none', flakTrooper: 'none',
  engineer: 'none', spy: 'none', tanya: 'none', attackDog: 'none', crazyIvan: 'none',
  // --- 车辆 ---
  harvester: 'light', warMiner: 'medium', grizzly: 'medium', rhino: 'heavy',
  apocalypse: 'heavy', mirage: 'light', prism: 'light', v3: 'light',
  ifv: 'light', flakTrack: 'medium', arty: 'light',
  // --- 空军 ---
  harrier: 'light', blackEagle: 'light', mig: 'light',
  longbow: 'light', hind: 'light', kirov: 'heavy',
  // --- 海军 ---
  destroyer: 'medium', aegis: 'medium', submarine: 'light', dreadnought: 'heavy',
};

export const DAMAGE_BY_TYPE = {
  // --- 步兵 ---
  infantry: 'bullet', conscript: 'bullet', attackDog: 'bullet', tanya: 'bullet',
  rocket: 'rocket', flakTrooper: 'rocket',
  // --- 车辆 ---
  grizzly: 'cannon', rhino: 'cannon', apocalypse: 'cannon', mirage: 'cannon', arty: 'cannon',
  warMiner: 'bullet', ifv: 'bullet', flakTrack: 'bullet',
  prism: 'laser', v3: 'missile',
  // --- 空军 ---
  harrier: 'missile', blackEagle: 'missile', mig: 'missile', longbow: 'missile',
  hind: 'bullet', kirov: 'bomb',
  // --- 海军 ---
  destroyer: 'cannon', aegis: 'missile', submarine: 'torpedo', dreadnought: 'missile',
  // --- 防御建筑 ---
  pillbox: 'bullet', flakCannon: 'bullet', prismTower: 'laser',
  patriot: 'missile', tesla: 'electric', turret: 'cannon',
};

// 兜底：定义表里漏标时按兵种给合理默认，避免又退回「建筑算轻甲、步枪算炮弹」
export const DEFAULT_ARMOR_BY_CATEGORY = {
  infantry: 'none', vehicle: 'medium', harvester: 'medium',
  aircraft: 'light', helicopter: 'light', airship: 'light', naval: 'medium',
  building: 'concrete', defense: 'concrete',
};
export const DEFAULT_DAMAGE_BY_CATEGORY = {
  infantry: 'bullet', vehicle: 'cannon', harvester: 'bullet',
  aircraft: 'missile', helicopter: 'missile', airship: 'bomb', naval: 'cannon',
  building: 'cannon', defense: 'cannon',
};

// ==================== 超级武器定义 ====================
// 冷却是「秒」，不是帧！管理器会乘 FPS 换算。
// 曾经这里写成 cooldown: 600 并注释「10分钟（以帧计）」，但实际按帧递减，
// 600 帧 = 10 秒 —— 敌方发射井建成后每 10 秒一颗核弹，等于核弹雨。
// 字段名带 Sec 就是为了让单位无法被误读。
export const SUPER_WEAPONS = {
  nuke: {
    name: '核弹攻击',
    cooldownSec: 90,
    damage: 1000,
    radius: 5,
    description: '发射核弹摧毁目标区域',
    faction: FACTION_SOVIET
  },
  lightningStorm: {
    name: '闪电风暴',
    cooldownSec: 90,
    damage: 150,
    radius: 6,
    duration: 180, // 3秒
    description: '召唤闪电风暴攻击区域',
    faction: FACTION_ALLIED
  },
  ironCurtain: {
    name: '铁幕',
    cooldownSec: 90,
    duration: 300, // 5秒无敌
    description: '使单位无敌',
    faction: FACTION_SOVIET
  },
  chrono: {
    name: '超时空传送',
    cooldownSec: 90,
    description: '瞬间传送单位',
    faction: FACTION_ALLIED
  }
};

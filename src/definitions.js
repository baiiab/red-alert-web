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
export const ARMOR_TYPES = {
  none:     { name: '无装甲',   infantry: 1.0, vehicle: 1.0, aircraft: 1.0, naval: 1.0 },
  light:    { name: '轻甲',     infantry: 0.8, vehicle: 1.2, aircraft: 1.0, naval: 1.0 },
  medium:   { name: '中甲',     infantry: 0.6, vehicle: 1.0, aircraft: 0.8, naval: 0.8 },
  heavy:    { name: '重甲',     infantry: 0.4, vehicle: 0.8, aircraft: 0.6, naval: 0.6 },
  concrete: { name: '混凝土',   infantry: 0.2, vehicle: 0.5, aircraft: 0.4, naval: 0.4 },
  steel:    { name: '钢铁',     infantry: 0.1, vehicle: 0.3, aircraft: 0.3, naval: 0.3 },
};

// ==================== 伤害类型定义 ====================
export const DAMAGE_TYPES = {
  bullet:   { name: '子弹',     light: 1.0, medium: 0.7, heavy: 0.4, concrete: 0.2, steel: 0.1 },
  cannon:   { name: '炮弹',     light: 1.2, medium: 1.0, heavy: 0.8, concrete: 0.6, steel: 0.4 },
  rocket:   { name: '火箭',     light: 0.8, medium: 1.0, heavy: 1.0, concrete: 0.8, steel: 0.6 },
  missile:  { name: '导弹',     light: 1.0, medium: 1.0, heavy: 1.0, concrete: 1.0, steel: 0.8 },
  laser:    { name: '激光',     light: 1.0, medium: 1.0, heavy: 0.8, concrete: 0.6, steel: 0.5 },
  electric: { name: '电击',     light: 1.0, medium: 0.9, heavy: 0.9, concrete: 0.5, steel: 0.3 },
  bomb:     { name: '炸弹',     light: 1.0, medium: 1.0, heavy: 1.0, concrete: 1.2, steel: 1.0 },
  torpedo:  { name: '鱼雷',     light: 0.0, medium: 0.0, heavy: 0.0, concrete: 0.0, steel: 0.0, naval: 1.5 },
};

// ==================== 超级武器定义 ====================
export const SUPER_WEAPONS = {
  nuke: {
    name: '核弹攻击',
    cooldown: 600, // 10分钟（以帧计，假设60fps）
    damage: 1000,
    radius: 5,
    description: '发射核弹摧毁目标区域',
    faction: FACTION_SOVIET
  },
  lightningStorm: {
    name: '闪电风暴',
    cooldown: 600,
    damage: 150,
    radius: 6,
    duration: 180, // 3秒
    description: '召唤闪电风暴攻击区域',
    faction: FACTION_ALLIED
  },
  ironCurtain: {
    name: '铁幕',
    cooldown: 480, // 8分钟
    duration: 300, // 5秒无敌
    description: '使单位无敌',
    faction: FACTION_SOVIET
  },
  chrono: {
    name: '超时空传送',
    cooldown: 300, // 5分钟
    description: '瞬间传送单位',
    faction: FACTION_ALLIED
  }
};

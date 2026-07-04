export const BUILDING_DEFS = {
  base:        { name:'建造厂',   cost:0,    hp:2200, size:3, power:50, powerUse:0,  buildTime:0, requires:[], category:'buildings', icon:'#7f8c8d', desc:'基地核心，提供50电力' },
  powerPlant:  { name:'发电厂',   cost:300,  hp:500,  size:2, power:200,powerUse:0,  buildTime:4, requires:['base'], category:'buildings', icon:'#f1c40f', desc:'提供200电力' },
  refinery:    { name:'矿厂',     cost:500,  hp:700,  size:3, powerUse:30, buildTime:6, requires:['base'], category:'buildings', icon:'#e67e22', desc:'精炼矿石，附赠采矿车' },
  barracks:    { name:'兵营',     cost:400,  hp:600,  size:2, powerUse:20, buildTime:5, requires:['powerPlant'], category:'buildings', icon:'#27ae60', desc:'训练步兵单位' },
  warFactory:  { name:'战车工厂', cost:700,  hp:800,  size:3, powerUse:40, buildTime:7, requires:['barracks'], category:'buildings', icon:'#6c3483', desc:'制造车辆单位' },
  radar:       { name:'雷达站',   cost:600,  hp:400,  size:2, powerUse:25, buildTime:5, requires:['powerPlant'], category:'buildings', icon:'#2c3e50', desc:'解锁小地图视图' },
  techCenter:  { name:'科技中心', cost:1200, hp:550,  size:2, powerUse:50, buildTime:9, requires:['radar','warFactory'], category:'buildings', icon:'#1abc9c', desc:'解锁高级科技单位' },
  repairBay:   { name:'维修站',   cost:600,  hp:600,  size:2, powerUse:30, buildTime:6, requires:['warFactory'], category:'buildings', icon:'#34495e', desc:'附近车辆自动维修' }
};

export const DEFENSE_DEFS = {
  wall:    { name:'城墙',       cost:50,   hp:400, size:1, powerUse:0,  buildTime:1, requires:['base'],       range:0, damage:0,   fireRate:0,  category:'defenses', icon:'#7f8c8d', desc:'廉价障碍物' },
  pillbox: { name:'碉堡',       cost:300,  hp:550, size:1, powerUse:10, buildTime:4, requires:['barracks'],   range:5, damage:20,  fireRate:25, category:'defenses', icon:'#d35400', desc:'快速射击步兵防御' },
  turret:  { name:'重炮塔',     cost:600,  hp:700, size:1, powerUse:20, buildTime:5, requires:['warFactory'], range:7, damage:40,  fireRate:48, category:'defenses', icon:'#8e44ad', desc:'反装甲重炮' },
  aaGun:   { name:'防空炮',     cost:500,  hp:500, size:1, powerUse:15, buildTime:4, requires:['warFactory'], range:8, damage:30,  fireRate:18, category:'defenses', icon:'#16a085', desc:'快速射击火力' },
  tesla:   { name:'特斯拉线圈', cost:1500, hp:500, size:1, powerUse:90, buildTime:7, requires:['techCenter'], range:8, damage:110, fireRate:50, category:'defenses', icon:'#00bfff', desc:'强力电磁攻击' }
};

export const UNIT_DEFS = {
  infantry:   { name:'步兵',     cost:100, hp:60,  speed:1.5, damage:10,  range:4, fireRate:25, requires:['barracks'],  buildTime:3, type:'infantry', category:'units', icon:'#2ecc71', desc:'基础步兵' },
  rocket:     { name:'火箭兵',   cost:200, hp:55,  speed:1.2, damage:25,  range:6, fireRate:42, requires:['barracks'],  buildTime:4, type:'infantry', antiArmor:true, category:'units', icon:'#e74c3c', desc:'反装甲步兵' },
  engineer:   { name:'工程师',   cost:300, hp:35,  speed:1.8, damage:0,   range:0, fireRate:0,  requires:['barracks'],  buildTime:4, type:'infantry', canRepair:true, canCapture:true, category:'units', icon:'#f39c12', desc:'修建筑/占领敌方' },
  tank:       { name:'坦克',     cost:500, hp:280, speed:2.0, damage:30,  range:5, fireRate:38, requires:['warFactory'],buildTime:5, type:'vehicle', category:'units', icon:'#3498db', desc:'主战坦克' },
  heavyTank:  { name:'重型坦克', cost:900, hp:500, speed:1.4, damage:55,  range:6, fireRate:50, requires:['warFactory','techCenter'], buildTime:7, type:'vehicle', category:'units', icon:'#2c3e50', desc:'重型装甲单位' },
  arty:       { name:'自行火炮', cost:700, hp:180, speed:1.0, damage:90,  range:11,fireRate:75, requires:['warFactory'],buildTime:6, type:'vehicle', splashRadius:1.5, category:'units', icon:'#e67e22', desc:'超远程范围炮击' },
  harvester:  { name:'采矿车',   cost:600, hp:400, speed:1.5, damage:0,   range:0, fireRate:0,  requires:['refinery'], buildTime:6, type:'harvester', capacity:1500, category:'units', icon:'#f1c40f', desc:'自动采集矿石' },
  apc:        { name:'运兵车',   cost:500, hp:320, speed:2.8, damage:14,  range:4, fireRate:28, requires:['warFactory'],buildTime:5, type:'vehicle', category:'units', icon:'#1abc9c', desc:'快速突击车' },
  mlrs:       { name:'多管火箭', cost:1100,hp:220, speed:1.6, damage:30,  range:8, fireRate:8,  requires:['warFactory','techCenter'], buildTime:7, type:'vehicle', burstCount:5, category:'units', icon:'#9b59b6', desc:'连射火箭车' }
};

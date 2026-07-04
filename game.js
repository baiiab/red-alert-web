// ===================== CONSTANTS =====================
var TILE_SIZE = 32;
var MAP_WIDTH = 72;
var MAP_HEIGHT = 72;
var GRASS = 0, WATER = 1, ORE = 2, ROCK = 3, CONCRETE = 4, SAND = 5, TREE = 6;
var TEAM_PLAYER = 0, TEAM_ENEMY = 1;
var COLOR_PLAYER = '#4a9fd4', COLOR_PLAYER_DARK = '#1a5276';
var COLOR_ENEMY = '#e74c3c', COLOR_ENEMY_DARK = '#922b21';

// ===================== DEFINITIONS =====================
var BUILDING_DEFS = {
  base:        { name:'建造厂',   cost:0,    hp:2200, size:3, power:50, powerUse:0,  buildTime:0, requires:[], category:'buildings', icon:'#7f8c8d', desc:'基地核心，提供50电力' },
  powerPlant:  { name:'发电厂',   cost:300,  hp:500,  size:2, power:200,powerUse:0,  buildTime:4, requires:['base'], category:'buildings', icon:'#f1c40f', desc:'提供200电力' },
  refinery:    { name:'矿厂',     cost:500,  hp:700,  size:3, powerUse:30, buildTime:6, requires:['base'], category:'buildings', icon:'#e67e22', desc:'精炼矿石，附赠采矿车' },
  barracks:    { name:'兵营',     cost:400,  hp:600,  size:2, powerUse:20, buildTime:5, requires:['powerPlant'], category:'buildings', icon:'#27ae60', desc:'训练步兵单位' },
  warFactory:  { name:'战车工厂', cost:700,  hp:800,  size:3, powerUse:40, buildTime:7, requires:['barracks'], category:'buildings', icon:'#6c3483', desc:'制造车辆单位' },
  radar:       { name:'雷达站',   cost:600,  hp:400,  size:2, powerUse:25, buildTime:5, requires:['powerPlant'], category:'buildings', icon:'#2c3e50', desc:'解锁小地图视图' },
  techCenter:  { name:'科技中心', cost:1200, hp:550,  size:2, powerUse:50, buildTime:9, requires:['radar','warFactory'], category:'buildings', icon:'#1abc9c', desc:'解锁高级科技单位' },
  repairBay:   { name:'维修站',   cost:600,  hp:600,  size:2, powerUse:30, buildTime:6, requires:['warFactory'], category:'buildings', icon:'#34495e', desc:'附近车辆自动维修' }
};

var DEFENSE_DEFS = {
  wall:    { name:'城墙',       cost:50,   hp:400, size:1, powerUse:0,  buildTime:1, requires:['base'],       range:0, damage:0,   fireRate:0,  category:'defenses', icon:'#7f8c8d', desc:'廉价障碍物' },
  pillbox: { name:'碉堡',       cost:300,  hp:550, size:1, powerUse:10, buildTime:4, requires:['barracks'],   range:5, damage:20,  fireRate:25, category:'defenses', icon:'#d35400', desc:'快速射击步兵防御' },
  turret:  { name:'重炮塔',     cost:600,  hp:700, size:1, powerUse:20, buildTime:5, requires:['warFactory'], range:7, damage:40,  fireRate:48, category:'defenses', icon:'#8e44ad', desc:'反装甲重炮' },
  aaGun:   { name:'防空炮',     cost:500,  hp:500, size:1, powerUse:15, buildTime:4, requires:['warFactory'], range:8, damage:30,  fireRate:18, category:'defenses', icon:'#16a085', desc:'快速射击火力' },
  tesla:   { name:'特斯拉线圈', cost:1500, hp:500, size:1, powerUse:90, buildTime:7, requires:['techCenter'], range:8, damage:110, fireRate:50, category:'defenses', icon:'#00bfff', desc:'强力电磁攻击' }
};

var UNIT_DEFS = {
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

// ===================== ENTITY =====================
function Entity(type, team, x, y) {
  var def = BUILDING_DEFS[type] || DEFENSE_DEFS[type] || UNIT_DEFS[type];
  this.id = ++Entity.counter;
  this.type = type; this.team = team;
  this.x = x; this.y = y;
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
  this.path = []; this.pathIndex = 0;
  this.pathRecalcTimer = 0;
  this.direction = 0;
  this.turretDir = 0;
  this.animFrame = 0; this.animTimer = 0;
  this.built = this.isBuilding ? (def && def.buildTime === 0) : true;
  this.buildProgress = this.built ? 100 : 0;
  this.buildTime = (def && def.buildTime) || 0;
  this.producing = null; this.produceProgress = 0;
  this.productionQueue = [];
  this.ore = 0;
  this.capacity = (def && def.capacity) || 0;
  this.harvestTarget = null;
  this.harvestTimer = 0;
  this.returningToRefinery = false;
  this.rallyPoint = null;
  this.dead = false; this.deathTimer = 45;
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
Entity.counter = 0;
Entity.prototype.getCenterX = function(){return (this.x+(this.isBuilding?this.size/2:0.5))*TILE_SIZE;};
Entity.prototype.getCenterY = function(){return (this.y+(this.isBuilding?this.size/2:0.5))*TILE_SIZE;};

// ===================== MAP =====================
function GameMap() {
  this.terrain = []; this.oreAmount = []; this.occupancy = [];

  this.generate = function() {
    var i, j;
    for (i = 0; i < MAP_HEIGHT; i++) {
      this.terrain[i] = []; this.oreAmount[i] = []; this.occupancy[i] = [];
      for (j = 0; j < MAP_WIDTH; j++) {
        this.terrain[i][j] = GRASS; this.oreAmount[i][j] = 0; this.occupancy[i][j] = null;
      }
    }
    var k, cx, cy, r, nx, ny;
    for (k = 0; k < 5; k++) {
      cx = 14+Math.floor(Math.random()*(MAP_WIDTH-28));
      cy = 14+Math.floor(Math.random()*(MAP_HEIGHT-28));
      r = 3+Math.floor(Math.random()*5);
      for (i=-r;i<=r;i++) for (j=-r;j<=r;j++) {
        if (i*i+j*j <= r*r) { nx=cx+j; ny=cy+i;
          if (nx>=0&&nx<MAP_WIDTH&&ny>=0&&ny<MAP_HEIGHT) this.terrain[ny][nx]=WATER; }
      }
    }
    for (k = 0; k < 10; k++) {
      cx = Math.floor(Math.random()*MAP_WIDTH); cy = Math.floor(Math.random()*MAP_HEIGHT);
      r = 1+Math.floor(Math.random()*3);
      for (i=-r;i<=r;i++) for (j=-r;j<=r;j++) {
        if (i*i+j*j <= r*r) { nx=cx+j; ny=cy+i;
          if (nx>=0&&nx<MAP_WIDTH&&ny>=0&&ny<MAP_HEIGHT&&this.terrain[ny][nx]===GRASS) this.terrain[ny][nx]=ROCK; }
      }
    }
    for (k = 0; k < 8; k++) {
      cx = Math.floor(Math.random()*MAP_WIDTH); cy = Math.floor(Math.random()*MAP_HEIGHT);
      r = 2+Math.floor(Math.random()*4);
      for (i=-r;i<=r;i++) for (j=-r;j<=r;j++) {
        if (i*i+j*j <= r*r) { nx=cx+j; ny=cy+i;
          if (nx>=0&&nx<MAP_WIDTH&&ny>=0&&ny<MAP_HEIGHT&&this.terrain[ny][nx]===GRASS) this.terrain[ny][nx]=SAND; }
      }
    }
    for (k = 0; k < 70; k++) {
      var tx = Math.floor(Math.random()*MAP_WIDTH);
      var ty = Math.floor(Math.random()*MAP_HEIGHT);
      if (this.terrain[ty][tx]===GRASS) this.terrain[ty][tx]=TREE;
    }
    for (k = 0; k < 14; k++) {
      cx = 6+Math.floor(Math.random()*(MAP_WIDTH-12));
      cy = 6+Math.floor(Math.random()*(MAP_HEIGHT-12));
      r = 2+Math.floor(Math.random()*3);
      for (i=-r;i<=r;i++) for (j=-r;j<=r;j++) {
        if (i*i+j*j <= r*r) { nx=cx+j; ny=cy+i;
          if (nx>=0&&nx<MAP_WIDTH&&ny>=0&&ny<MAP_HEIGHT&&this.terrain[ny][nx]===GRASS) {
            this.terrain[ny][nx]=ORE; this.oreAmount[ny][nx]=500+Math.floor(Math.random()*500); }
        }
      }
    }
    this._clearArea(0,0,14,14);
    this._setConcrete(3,3,3,3);
    this._placeOreNear(10,5,5,600,1000);
    this._clearArea(MAP_WIDTH-14, MAP_HEIGHT-14, 14, 14);
    this._setConcrete(MAP_WIDTH-7, MAP_HEIGHT-7, 3, 3);
    this._placeOreNear(MAP_WIDTH-12, MAP_HEIGHT-8, 5, 600, 1000);
  };

  this._clearArea = function(x,y,w,h){
    for (var i=0;i<h;i++) for (var j=0;j<w;j++) {
      var ty=y+i, tx=x+j;
      if (ty>=0&&ty<MAP_HEIGHT&&tx>=0&&tx<MAP_WIDTH) { this.terrain[ty][tx]=GRASS; this.oreAmount[ty][tx]=0; }
    }
  };
  this._setConcrete = function(x,y,w,h){
    for (var i=0;i<h;i++) for (var j=0;j<w;j++) {
      var ty=y+i, tx=x+j;
      if (ty>=0&&ty<MAP_HEIGHT&&tx>=0&&tx<MAP_WIDTH) this.terrain[ty][tx]=CONCRETE;
    }
  };
  this._placeOreNear = function(cx,cy,count,minA,maxA){
    var placed=0, tries=0;
    while (placed<count && tries<100) {
      tries++;
      var dx = Math.floor(Math.random()*8-4);
      var dy = Math.floor(Math.random()*8-4);
      var x = cx+dx, y = cy+dy;
      if (x>=0&&x<MAP_WIDTH&&y>=0&&y<MAP_HEIGHT&&this.terrain[y][x]===GRASS) {
        this.terrain[y][x]=ORE;
        this.oreAmount[y][x]=minA+Math.floor(Math.random()*(maxA-minA));
        placed++;
      }
    }
  };

  this.isPassable = function(x,y){
    if (x<0||x>=MAP_WIDTH||y<0||y>=MAP_HEIGHT) return false;
    var t = this.terrain[y][x];
    if (t===WATER||t===ROCK) return false;
    var occ = this.occupancy[y][x];
    if (occ && occ.isBuilding) return false;
    return true;
  };

  this.isBuildable = function(x,y,size){
    for (var i=0;i<size;i++) for (var j=0;j<size;j++) {
      var tx=x+j, ty=y+i;
      if (tx<0||tx>=MAP_WIDTH||ty<0||ty>=MAP_HEIGHT) return false;
      var t = this.terrain[ty][tx];
      if (t===WATER||t===ROCK||t===ORE||t===TREE) return false;
      if (this.occupancy[ty][tx]) return false;
    }
    return true;
  };

  this.isNearBuilding = function(x,y,size,team){
    for (var i=-3;i<size+3;i++) for (var j=-3;j<size+3;j++) {
      var tx=x+j, ty=y+i;
      if (tx>=0&&tx<MAP_WIDTH&&ty>=0&&ty<MAP_HEIGHT) {
        var occ = this.occupancy[ty][tx];
        if (occ && occ.isBuilding && occ.team===team && occ.built) return true;
      }
    }
    return false;
  };

  this.setOccupancy = function(e){
    for (var i=0;i<e.size;i++) for (var j=0;j<e.size;j++) {
      var tx=Math.floor(e.x)+j, ty=Math.floor(e.y)+i;
      if (tx>=0&&tx<MAP_WIDTH&&ty>=0&&ty<MAP_HEIGHT) this.occupancy[ty][tx]=e;
    }
  };

  this.clearOccupancy = function(e){
    for (var i=0;i<e.size;i++) for (var j=0;j<e.size;j++) {
      var tx=Math.floor(e.x)+j, ty=Math.floor(e.y)+i;
      if (tx>=0&&tx<MAP_WIDTH&&ty>=0&&ty<MAP_HEIGHT&&this.occupancy[ty][tx]===e) this.occupancy[ty][tx]=null;
    }
  };

  this.findNearestOre = function(x,y){
    var best={x:-1,y:-1}, bd=Infinity;
    for (var i=0;i<MAP_HEIGHT;i++) for (var j=0;j<MAP_WIDTH;j++) {
      if (this.terrain[i][j]===ORE && this.oreAmount[i][j]>0) {
        var dx=j-x, dy=i-y, d=dx*dx+dy*dy;
        if (d<bd) { bd=d; best.x=j; best.y=i; }
      }
    }
    return best;
  };

  this.findNearestRefinery = function(x,y,team,entities){
    var best=null, bd=Infinity;
    for (var i=0;i<entities.length;i++) {
      var e = entities[i];
      if (e.team===team && e.built && !e.dead && (e.type==='refinery'||e.type==='base')) {
        var dx=e.x-x, dy=e.y-y, d=dx*dx+dy*dy;
        if (d<bd) { bd=d; best=e; }
      }
    }
    return best;
  };

  this.findPath = function(sx,sy,ex,ey,maxIter){
    sx=Math.max(0,Math.min(MAP_WIDTH-1,Math.floor(sx)));
    sy=Math.max(0,Math.min(MAP_HEIGHT-1,Math.floor(sy)));
    ex=Math.max(0,Math.min(MAP_WIDTH-1,Math.floor(ex)));
    ey=Math.max(0,Math.min(MAP_HEIGHT-1,Math.floor(ey)));
    if (sx===ex&&sy===ey) return [];
    maxIter = maxIter || 2500;
    var open=[], closed={}, gScore={}, cameFrom={};
    var sk = sx+','+sy;
    gScore[sk] = 0;
    open.push({x:sx,y:sy,f:Math.abs(ex-sx)+Math.abs(ey-sy)});
    var dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    var itr=0, closest={x:sx,y:sy,d:Math.abs(ex-sx)+Math.abs(ey-sy)};
    while (open.length>0 && itr<maxIter) {
      itr++;
      open.sort(function(a,b){return a.f-b.f;});
      var cur = open.shift();
      var ck = cur.x+','+cur.y;
      var ch = Math.abs(ex-cur.x)+Math.abs(ey-cur.y);
      if (ch < closest.d) closest = {x:cur.x,y:cur.y,d:ch};
      if (cur.x===ex&&cur.y===ey) {
        var path=[], k2=ck;
        while (k2 && k2!==sk) {
          var p2 = k2.split(',');
          path.unshift({x:+p2[0], y:+p2[1]});
          k2 = cameFrom[k2];
        }
        return path;
      }
      closed[ck] = true;
      for (var d=0;d<dirs.length;d++) {
        var nx = cur.x+dirs[d][0], ny = cur.y+dirs[d][1];
        if (nx<0||nx>=MAP_WIDTH||ny<0||ny>=MAP_HEIGHT) continue;
        var nk = nx+','+ny;
        if (closed[nk]) continue;
        if (!this.isPassable(nx,ny)) continue;
        if (d>=4) {
          if (!this.isPassable(cur.x+dirs[d][0],cur.y) || !this.isPassable(cur.x,cur.y+dirs[d][1])) continue;
        }
        var mc = (d>=4) ? 1.414 : 1;
        var tg = (gScore[ck]||0) + mc;
        if (gScore[nk]===undefined||tg<gScore[nk]) {
          gScore[nk] = tg;
          var h = Math.abs(ex-nx)+Math.abs(ey-ny);
          cameFrom[nk] = ck;
          var inO = false;
          for (var oi=0;oi<open.length;oi++) {
            if (open[oi].x===nx&&open[oi].y===ny) { open[oi].f=tg+h; inO=true; break; }
          }
          if (!inO) open.push({x:nx,y:ny,f:tg+h});
        }
      }
    }
    if (closest.d < Math.abs(ex-sx)+Math.abs(ey-sy)) {
      var path2=[], kk=closest.x+','+closest.y;
      while (kk&&kk!==sk) {
        var pp = kk.split(',');
        path2.unshift({x:+pp[0],y:+pp[1]});
        kk = cameFrom[kk];
      }
      return path2;
    }
    return [];
  };
}

// ===================== GAME STATE =====================
function GameState() {
  this.map = new GameMap();
  this.entities = [];
  this.projectiles = [];
  this.explosions = [];
  this.floatingTexts = [];
  this.smokeParticles = [];
  this.minimapAlerts = [];
  this.playerCredits = 8000;
  this.enemyCredits = 3000;
  this.playerPower = 0; this.playerPowerUse = 0;
  this.enemyPower = 0; this.enemyPowerUse = 0;
  this.playerUnitCount = 0; this.playerUnitMax = 30;
  this.gameOver = false; this.winner = -1;
  this.hasRadar = false; this.hasTechCenter = false;
  this.controlGroups = {};
  this.stats = { unitsLost:0, unitsKilled:0, buildingsLost:0, buildingsKilled:0, oreGathered:0 };
  this.lowPowerAlertCooldown = 0;
  this.underAttackAlertCooldown = 0;

  this.getPlayerBuildings = function(){return this.entities.filter(function(e){return e.team===TEAM_PLAYER&&e.isBuilding&&!e.dead;});};
  this.getEnemyBuildings = function(){return this.entities.filter(function(e){return e.team===TEAM_ENEMY&&e.isBuilding&&!e.dead;});};
  this.getPlayerUnits = function(){return this.entities.filter(function(e){return e.team===TEAM_PLAYER&&!e.isBuilding&&!e.dead;});};
  this.getEnemyUnits = function(){return this.entities.filter(function(e){return e.team===TEAM_ENEMY&&!e.isBuilding&&!e.dead;});};

  this.hasBuilding = function(team,type){
    return this.entities.some(function(e){return e.team===team&&e.type===type&&e.built&&!e.dead;});
  };

  this.getBuildReason = function(type,team){
    var def = BUILDING_DEFS[type]||DEFENSE_DEFS[type]||UNIT_DEFS[type];
    if (!def) return '未知建筑';
    var credits = team===TEAM_PLAYER ? this.playerCredits : this.enemyCredits;
    if (credits < def.cost) return '资金不足 (需要 $'+def.cost+')';
    if (def.requires) {
      for (var i=0;i<def.requires.length;i++) {
        if (!this.hasBuilding(team,def.requires[i])) {
          var reqDef = BUILDING_DEFS[def.requires[i]]||DEFENSE_DEFS[def.requires[i]];
          return '需要 '+((reqDef&&reqDef.name)||def.requires[i]);
        }
      }
    }
    if (def.category==='units' && team===TEAM_PLAYER) {
      if (this.playerUnitCount >= this.playerUnitMax) return '单位上限已满';
      if (this.playerPower-this.playerPowerUse < 0) return '电力不足';
    }
    if ((def.category==='buildings'||def.category==='defenses') && team===TEAM_PLAYER) {
      if (def.powerUse>0 && (this.playerPower-this.playerPowerUse)<def.powerUse) return '电力不足 (需要 '+def.powerUse+'⚡)';
    }
    return '';
  };

  this.canBuild = function(type,team){
    var def = BUILDING_DEFS[type]||DEFENSE_DEFS[type]||UNIT_DEFS[type];
    if (!def) return false;
    var credits = team===TEAM_PLAYER ? this.playerCredits : this.enemyCredits;
    if (credits < def.cost) return false;
    if (def.requires) {
      for (var i=0;i<def.requires.length;i++) if (!this.hasBuilding(team,def.requires[i])) return false;
    }
    if (def.category==='units' && team===TEAM_PLAYER) {
      if (this.playerUnitCount >= this.playerUnitMax) return false;
      if (this.playerPower-this.playerPowerUse < 0) return false;
    }
    if ((def.category==='buildings'||def.category==='defenses') && team===TEAM_PLAYER) {
      if (def.powerUse>0 && (this.playerPower-this.playerPowerUse)<def.powerUse) return false;
    }
    return true;
  };

  this.spawnEntity = function(type,team,x,y){
    var e = new Entity(type,team,x,y);
    this.entities.push(e);
    if (e.isBuilding) this.map.setOccupancy(e);
    return e;
  };

  this.removeEntity = function(entity){
    if (entity.isBuilding) this.map.clearOccupancy(entity);
    entity.dead = true;
    entity.deathTimer = 45;
    if (entity.team===TEAM_PLAYER) {
      if (entity.isBuilding) this.stats.buildingsLost++; else this.stats.unitsLost++;
    } else {
      if (entity.isBuilding) this.stats.buildingsKilled++; else this.stats.unitsKilled++;
    }
  };

  this.getEntityAt = function(wx,wy){
    for (var i=this.entities.length-1;i>=0;i--) {
      var e = this.entities[i];
      if (e.dead) continue;
      if (e.isBuilding) {
        if (wx>=e.x*TILE_SIZE&&wx<(e.x+e.size)*TILE_SIZE&&wy>=e.y*TILE_SIZE&&wy<(e.y+e.size)*TILE_SIZE) return e;
      } else {
        var ecx = e.getCenterX(), ecy = e.getCenterY();
        if (Math.hypot(wx-ecx,wy-ecy)<TILE_SIZE*0.65) return e;
      }
    }
    return null;
  };

  this.getEntitiesInRect = function(x1,y1,x2,y2){
    var r = [];
    for (var i=0;i<this.entities.length;i++) {
      var e = this.entities[i];
      if (e.dead||e.team!==TEAM_PLAYER||e.isBuilding) continue;
      var ecx = e.getCenterX(), ecy = e.getCenterY();
      if (ecx>=x1&&ecx<=x2&&ecy>=y1&&ecy<=y2) r.push(e);
    }
    return r;
  };

  this.getEnemiesInRange = function(entity,range){
    var r = [];
    var ex = entity.getCenterX(), ey = entity.getCenterY();
    var rp = range*TILE_SIZE;
    for (var i=0;i<this.entities.length;i++) {
      var e = this.entities[i];
      if (e.team!==entity.team&&!e.dead&&e.built) {
        if (Math.hypot(ex-e.getCenterX(),ey-e.getCenterY())<=rp) r.push(e);
      }
    }
    return r;
  };

  this.addProjectile = function(from,to,damage,team,type,splash){
    var p = {
      x:from.x, y:from.y,
      damage:damage, team:team, type:type||'bullet',
      target:to, speed:type==='shell'?5:(type==='rocket'?5.5:8),
      splash:splash||0
    };
    if (to.getCenterX) { p.targetX = to.getCenterX(); p.targetY = to.getCenterY(); }
    else { p.targetX = to.x; p.targetY = to.y; }
    this.projectiles.push(p);
  };

  this.addExplosion = function(x,y,size,type){
    this.explosions.push({x:x,y:y,size:size,type:type||'fire',timer:28,maxTimer:28});
  };

  this.addFloatingText = function(x,y,text,color){
    this.floatingTexts.push({x:x,y:y,text:text,color:color||'#fff',timer:50,vy:-0.7});
  };

  this.addSmoke = function(x,y){
    if (this.smokeParticles.length>200) return;
    this.smokeParticles.push({
      x:x,y:y,vx:(Math.random()-0.5)*0.3,vy:-0.5-Math.random()*0.5,
      size:3+Math.random()*3,timer:50+Math.random()*30,maxTimer:80
    });
  };

  this.addMinimapAlert = function(x,y,color){
    this.minimapAlerts.push({x:x,y:y,color:color||'#e74c3c',timer:50,maxTimer:50});
  };

  this.applySplashDamage = function(x,y,radius,damage,team){
    var rp = radius*TILE_SIZE;
    for (var i=0;i<this.entities.length;i++) {
      var e = this.entities[i];
      if (e.team===team||e.dead) continue;
      var dx = e.getCenterX()-x, dy = e.getCenterY()-y;
      var d = Math.hypot(dx,dy);
      if (d<=rp) {
        var falloff = 1-d/rp*0.6;
        var dmg = Math.floor(damage*falloff);
        e.hp -= dmg;
        e.flashTimer = 5;
        if (dmg>0) this.addFloatingText(e.getCenterX(),e.getCenterY()-10,'-'+dmg,'#ff6b6b');
        if (e.hp<=0) {
          this.addExplosion(e.getCenterX(),e.getCenterY(),32,'big');
          playExplosionSound();
          if (e.type==='base') { this.gameOver = true; this.winner = team; }
          this.removeEntity(e);
        }
      }
    }
  };

  this.initPlayer = function(){
    this.spawnEntity('base',TEAM_PLAYER,3,3);
    var pp = this.spawnEntity('powerPlant',TEAM_PLAYER,3,6); pp.built=true; pp.buildProgress=100;
    this.spawnEntity('infantry',TEAM_PLAYER,7,3);
    this.spawnEntity('infantry',TEAM_PLAYER,7,4);
    this.spawnEntity('infantry',TEAM_PLAYER,7,5);
    this.spawnEntity('infantry',TEAM_PLAYER,8,3);
    this.spawnEntity('tank',TEAM_PLAYER,8,5);
    var harv = this.spawnEntity('harvester',TEAM_PLAYER,7,6);
    var ore = this.map.findNearestOre(7,6);
    if (ore.x>=0) { harv.harvestTarget=ore; harv.path=this.map.findPath(7,6,ore.x,ore.y); harv.pathIndex=0; }
    var harv2 = this.spawnEntity('harvester',TEAM_PLAYER,8,6);
    var ore2 = this.map.findNearestOre(8,6);
    if (ore2.x>=0) { harv2.harvestTarget=ore2; harv2.path=this.map.findPath(8,6,ore2.x,ore2.y); harv2.pathIndex=0; }
  };

  this.initEnemy = function(){
    var bx = MAP_WIDTH-7, by = MAP_HEIGHT-7;
    var eb = this.spawnEntity('base',TEAM_ENEMY,bx,by); eb.built=true;
    var pp = this.spawnEntity('powerPlant',TEAM_ENEMY,bx-4,by); pp.built=true; pp.buildProgress=100;
    var bar = this.spawnEntity('barracks',TEAM_ENEMY,bx-4,by+3); bar.built=true; bar.buildProgress=100;
    var ref = this.spawnEntity('refinery',TEAM_ENEMY,bx,by-4); ref.built=true; ref.buildProgress=100;
    var wf = this.spawnEntity('warFactory',TEAM_ENEMY,bx+3,by-4); wf.built=true; wf.buildProgress=100;
    for (var i=0;i<3;i++) this.spawnEntity('infantry',TEAM_ENEMY,bx-2+i,by-2);
    this.spawnEntity('tank',TEAM_ENEMY,bx-2,by+6);
    var eh = this.spawnEntity('harvester',TEAM_ENEMY,bx+5,by+3);
    var eore = this.map.findNearestOre(bx+5,by+3);
    if (eore.x>=0) { eh.harvestTarget=eore; eh.path=this.map.findPath(bx+5,by+3,eore.x,eore.y); }
    var diffMult = 1;
    if (difficulty==='normal') diffMult = 1.2;
    else if (difficulty==='hard') diffMult = 2.0;
    this.enemyCredits = Math.floor(2500*diffMult);
  };
}

// ===================== GLOBALS =====================
var canvas, ctx, minimapCanvas, minimapCtx;
var gameState;
var camera = {x:0,y:0,zoom:1};
var mouse = {x:0,y:0,worldX:0,worldY:0,mapX:0,mapY:0,down:false,inCanvas:false};
var selectedUnits = [];
var selectedBuilding = null;
var placingBuilding = false, placingType = null;
var gameStartTime = 0, difficulty = 'normal';
var keys = {};
var frameCount = 0;
var enemyAITimer = 0, enemyBuildQueue = [], enemyAttackTimer = 0, enemyAttackWave = 0;
var enemyScoutTimer = 0;
var notifTimer = 0;
var currentTab = 'buildings';
var gameRunning = false;
var gamePaused = false;
var gameSpeed = 1;
var dragSelect = {active:false,startX:0,startY:0,endX:0,endY:0};
var activeAction = null;
var lastNumberKey = 0, lastNumberTime = 0;

// ===================== AUDIO =====================
var audioCtx = null;
function getAudioCtx(){
  if (!audioCtx) try { audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){}
  return audioCtx;
}
function playSound(freq,type,dur,vol,slide){
  try {
    var ac = getAudioCtx(); if (!ac||gamePaused) return;
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = type||'square';
    osc.frequency.setValueAtTime(freq,ac.currentTime);
    if (slide!==false) osc.frequency.exponentialRampToValueAtTime(Math.max(50,freq*0.3),ac.currentTime+dur);
    gain.gain.setValueAtTime(vol||0.1,ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+dur);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime+dur);
  } catch(e){}
}
function playExplosionSound(){ playSound(120,'sawtooth',0.35,0.15); }
function playShootSound(){ playSound(900,'square',0.06,0.04); }
function playBuildSound(){ playSound(440,'sine',0.18,0.08,false); setTimeout(function(){playSound(660,'sine',0.18,0.08,false);},120); }
function playSelectSound(){ playSound(700,'sine',0.08,0.04,false); }
function playReadySound(){ playSound(523,'sine',0.12,0.08,false); setTimeout(function(){playSound(784,'sine',0.15,0.08,false);},100); }
function playAlertSound(){ playSound(880,'square',0.15,0.1); setTimeout(function(){playSound(660,'square',0.15,0.1);},150); }
function playCancelSound(){ playSound(330,'square',0.1,0.05); }

// ===================== START GAME =====================
function startGame(diff) {
  difficulty = diff;
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  minimapCanvas = document.getElementById('minimapCanvas');
  minimapCtx = minimapCanvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  minimapCanvas.width = 300; minimapCanvas.height = 200;
  Entity.counter = 0;
  gameState = new GameState();
  gameState.map.generate();
  gameState.initPlayer();
  gameState.initEnemy();
  camera.x = 3*TILE_SIZE*camera.zoom-(canvas.width-300)/2;
  camera.y = 3*TILE_SIZE*camera.zoom-canvas.height/2;
  camera.x = Math.max(0,camera.x); camera.y = Math.max(0,camera.y);
  selectedUnits = []; selectedBuilding = null;
  placingBuilding = false; placingType = null;
  gameStartTime = Date.now(); frameCount = 0;
  enemyAITimer = 0; enemyBuildQueue = []; enemyAttackTimer = 0; enemyAttackWave = 0;
  enemyScoutTimer = 0;
  notifTimer = 0; currentTab = 'buildings'; gameRunning = true;
  dragSelect = {active:false,startX:0,startY:0,endX:0,endY:0};
  activeAction = null; gamePaused = false; gameSpeed = 1;
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('gameOver').style.display = 'none';
  renderGroupBar();
  setupInput();
  updateBuildList();
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
      updateNotification();
      checkGameOver();
      if (gameState.gameOver) break;
    }
  } else {
    updateCamera();
  }
  updateUI();
  render();
  requestAnimationFrame(gameLoop);
}

function updateCamera() {
  var speed = 12;
  if (keys['ArrowLeft']) camera.x -= speed;
  if (keys['ArrowRight']) camera.x += speed;
  if (keys['ArrowUp']) camera.y -= speed;
  if (keys['ArrowDown']) camera.y += speed;
  var edge = 14;
  var viewW = canvas.width - 300;
  var viewH = canvas.height;
  if (mouse.inCanvas) {
    if (mouse.x > 0 && mouse.x < edge && mouse.y > 44 && mouse.y < viewH) camera.x -= 10;
    if (mouse.x > viewW - edge && mouse.x < viewW && mouse.y > 44 && mouse.y < viewH) camera.x += 10;
    if (mouse.y > 44 && mouse.y < 44 + edge && mouse.x > 0 && mouse.x < viewW) camera.y -= 10;
    if (mouse.y > viewH - edge && mouse.y < viewH && mouse.x > 0 && mouse.x < viewW) camera.y += 10;
  }
  var maxX = MAP_WIDTH*TILE_SIZE*camera.zoom-(canvas.width-300);
  var maxY = MAP_HEIGHT*TILE_SIZE*camera.zoom-canvas.height;
  camera.x = Math.max(0,Math.min(maxX,camera.x));
  camera.y = Math.max(0,Math.min(maxY,camera.y));
}

// ===================== UPDATE ENTITIES =====================
function updateEntities() {
  for (var i = gameState.entities.length-1; i >= 0; i--) {
    var e = gameState.entities[i];
    if (e.dead) {
      e.deathTimer--;
      if (e.deathTimer%3===0&&e.deathTimer>10) gameState.addSmoke(e.getCenterX(),e.getCenterY());
      if (e.deathTimer<=0) gameState.entities.splice(i,1);
      continue;
    }
    if (e.muzzleFlash>0) e.muzzleFlash--;
    if (e.flashTimer>0) e.flashTimer--;
    if (e.lastDamagedTimer>0) e.lastDamagedTimer--;
    if (e.pathRecalcTimer>0) e.pathRecalcTimer--;
    if (!e.dead&&e.hp<e.maxHp*0.4&&frameCount%18===0) {
      gameState.addSmoke(e.getCenterX()+(Math.random()-0.5)*8, e.getCenterY()+(Math.random()-0.5)*8);
    }
    if (e.isBuilding) {
      updateBuildingAI(e);
    } else {
      if (e.fireCooldown>0) e.fireCooldown--;
      if (e.team !== TEAM_ENEMY) updateUnitAI(e);
    }
  }
  updateRepairBays();
}

function updateRepairBays() {
  if (frameCount%12!==0) return;
  var bays = gameState.entities.filter(function(e){return e.type==='repairBay'&&e.built&&!e.dead;});
  for (var b=0;b<bays.length;b++) {
    var bay = bays[b];
    for (var i=0;i<gameState.entities.length;i++) {
      var e = gameState.entities[i];
      if (e.team===bay.team&&!e.isBuilding&&!e.dead&&e.type2==='vehicle'&&e.hp<e.maxHp) {
        var d = Math.hypot(e.x-bay.x-bay.size/2, e.y-bay.y-bay.size/2);
        if (d<4) {
          e.hp = Math.min(e.maxHp, e.hp+3);
          if (frameCount%60===0) gameState.addFloatingText(e.getCenterX(),e.getCenterY()-12,'+','#2ecc71');
        }
      }
    }
  }
}

function updateBuildingAI(e) {
  if (!e.built) {
    e.buildProgress += 100/(e.buildTime*60);
    if (e.buildProgress>=100) {
      e.buildProgress=100; e.built=true;
      if (e.team===TEAM_PLAYER) { notify(e.name+' 建造完成','info'); playBuildSound(); }
    }
    return;
  }
  if (DEFENSE_DEFS[e.type]&&e.damage>0) {
    if (e.fireCooldown>0) e.fireCooldown--;
    if (e.fireCooldown<=0) {
      var enemies = gameState.getEnemiesInRange(e,e.range);
      if (enemies.length>0) {
        var tgt = enemies[0], bd = Infinity;
        for (var ei=0;ei<enemies.length;ei++) {
          var d = Math.hypot(enemies[ei].x-e.x,enemies[ei].y-e.y);
          if (d<bd) { bd=d; tgt=enemies[ei]; }
        }
        performAttack(e,tgt);
      }
    }
  }
  if (e.producing) {
    var pd = UNIT_DEFS[e.producing];
    if (pd) {
      e.produceProgress += 100/(pd.buildTime*60);
      if (e.produceProgress>=100) {
        spawnProducedUnit(e);
        if (e.team===TEAM_PLAYER) { notify(pd.name+' 训练完成','info'); playReadySound(); }
        e.producing=null; e.produceProgress=0;
        if (e.productionQueue.length>0) {
          var next = e.productionQueue.shift();
          var nextDef = UNIT_DEFS[next];
          if (nextDef) { e.producing=next; e.produceProgress=0; }
        }
      }
    }
  }
}

function spawnProducedUnit(building) {
  var type = building.producing;
  var tries = [];
  for (var dy=-1;dy<=building.size;dy++) for (var dx=-1;dx<=building.size;dx++) {
    if (dx===-1||dx===building.size||dy===-1||dy===building.size)
      tries.push({x:Math.floor(building.x)+dx,y:Math.floor(building.y)+dy});
  }
  var sx = Math.floor(building.x)+building.size, sy = Math.floor(building.y);
  for (var t=0;t<tries.length;t++) {
    if (gameState.map.isPassable(tries[t].x,tries[t].y)) { sx=tries[t].x; sy=tries[t].y; break; }
  }
  sx = Math.max(0,Math.min(MAP_WIDTH-1,sx));
  sy = Math.max(0,Math.min(MAP_HEIGHT-1,sy));
  var nu = gameState.spawnEntity(type,building.team,sx,sy);
  if (building.rallyPoint) {
    nu.path = gameState.map.findPath(sx,sy,building.rallyPoint.x,building.rallyPoint.y);
    nu.pathIndex = 0;
  }
  if (type==='harvester') {
    var ore = gameState.map.findNearestOre(sx,sy);
    if (ore.x>=0) { nu.harvestTarget=ore; nu.path=gameState.map.findPath(sx,sy,ore.x,ore.y); nu.pathIndex=0; }
  }
}

function updateUnitAI(unit) {
  if (unit.type2==='harvester') { updateHarvesterAI(unit); return; }
  // Engineer
  if (unit.canRepair&&unit.attackTarget&&unit.attackTarget.isBuilding) {
    var tgt = unit.attackTarget;
    var d = Math.hypot(unit.x-(tgt.x+tgt.size/2),unit.y-(tgt.y+tgt.size/2));
    if (d<2) {
      if (tgt.team===unit.team&&tgt.hp<tgt.maxHp) {
        tgt.hp = Math.min(tgt.maxHp,tgt.hp+5);
        if (frameCount%18===0) gameState.addFloatingText(tgt.getCenterX(),tgt.getCenterY()-10,'+5','#2ecc71');
        if (tgt.hp>=tgt.maxHp) unit.attackTarget = null;
      } else if (tgt.team!==unit.team) {
        if (unit.team===TEAM_PLAYER) notify('占领了 '+tgt.name+'！','info');
        gameState.map.clearOccupancy(tgt);
        tgt.team = unit.team;
        tgt.hp = Math.max(tgt.hp,tgt.maxHp*0.5);
        gameState.map.setOccupancy(tgt);
        unit.dead = true; unit.deathTimer = 1;
        unit.attackTarget = null;
      }
      return;
    } else {
      if (unit.path.length===0||unit.pathIndex>=unit.path.length||unit.pathRecalcTimer<=0) {
        unit.path = gameState.map.findPath(Math.floor(unit.x),Math.floor(unit.y),Math.floor(tgt.x+tgt.size/2),Math.floor(tgt.y+tgt.size/2));
        unit.pathIndex = 0; unit.pathRecalcTimer = 60;
      }
      moveUnit(unit);
      return;
    }
  }
  // Burst fire
  if (unit.burstRemaining>0&&unit.burstTarget&&!unit.burstTarget.dead&&unit.fireCooldown<=0) {
    var bt = unit.burstTarget;
    var btDist = Math.hypot(unit.x+0.5-bt.getCenterX()/TILE_SIZE,unit.y+0.5-bt.getCenterY()/TILE_SIZE);
    if (btDist<=unit.range) {
      performBurstShot(unit,bt);
      unit.burstRemaining--;
      if (unit.burstRemaining===0) unit.burstTarget = null;
    } else { unit.burstRemaining=0; unit.burstTarget=null; }
  }

  if (unit.attackTarget) {
    if (unit.attackTarget.dead) {
      if (unit.attackMoveTarget) {
        var newT = gameState.getEnemiesInRange(unit,unit.range+2);
        if (newT.length>0) unit.attackTarget = newT[0];
        else { unit.attackTarget=null; unit.path=[]; unit.pathIndex=0; }
      } else { unit.attackTarget=null; unit.path=[]; unit.pathIndex=0; }
      return;
    }
    var atX = unit.attackTarget.x+(unit.attackTarget.isBuilding?unit.attackTarget.size/2:0.5);
    var atY = unit.attackTarget.y+(unit.attackTarget.isBuilding?unit.attackTarget.size/2:0.5);
    var atDist = Math.hypot(unit.x+0.5-atX,unit.y+0.5-atY);
    if (atDist<=unit.range&&unit.damage>0) {
      unit.path = []; unit.pathIndex = 0;
      unit.turretDir = Math.atan2(atY-unit.y-0.5,atX-unit.x-0.5);
      if (unit.fireCooldown<=0) performAttack(unit,unit.attackTarget);
    } else {
      if (unit.path.length===0||unit.pathIndex>=unit.path.length||unit.pathRecalcTimer<=0) {
        unit.path = gameState.map.findPath(Math.floor(unit.x),Math.floor(unit.y),Math.floor(atX),Math.floor(atY));
        unit.pathIndex = 0; unit.pathRecalcTimer = 45;
      }
      moveUnit(unit);
    }
    return;
  }
  // Attack-move
  if (unit.attackMoveTarget&&unit.damage>0) {
    var nbAM = gameState.getEnemiesInRange(unit,unit.range+2);
    if (nbAM.length>0) {
      var cl = nbAM[0], cd = Infinity;
      for (var n=0;n<nbAM.length;n++) {
        var nd = Math.hypot(nbAM[n].x-unit.x,nbAM[n].y-unit.y);
        if (nd<cd) { cd=nd; cl=nbAM[n]; }
      }
      unit.attackTarget = cl;
      return;
    }
    if (Math.hypot(unit.x-unit.attackMoveTarget.x,unit.y-unit.attackMoveTarget.y)<2) unit.attackMoveTarget = null;
  }
  // Guard
  if (unit.guardPos&&unit.damage>0) {
    var nbG = gameState.getEnemiesInRange(unit,unit.range+2);
    if (nbG.length>0) { unit.attackTarget=nbG[0]; return; }
    var gd = Math.hypot(unit.x-unit.guardPos.x,unit.y-unit.guardPos.y);
    if (gd>4) {
      if (unit.path.length===0||unit.pathIndex>=unit.path.length) {
        unit.path = gameState.map.findPath(Math.floor(unit.x),Math.floor(unit.y),unit.guardPos.x,unit.guardPos.y);
        unit.pathIndex = 0;
      }
      moveUnit(unit); return;
    }
  }
  // Idle defensive
  if (!unit.attackTarget&&unit.damage>0) {
    if (unit.team===TEAM_ENEMY||(unit.team===TEAM_PLAYER&&unit.path.length===0)) {
      var nb = gameState.getEnemiesInRange(unit,unit.range+1);
      if (nb.length>0&&unit.fireCooldown<=0) {
        var cl2 = nb[0], cd2 = Infinity;
        for (var ni=0;ni<nb.length;ni++) {
          var nd2 = Math.hypot(nb[ni].x-unit.x,nb[ni].y-unit.y);
          if (nd2<cd2) { cd2=nd2; cl2=nb[ni]; }
        }
        var dist = Math.hypot((cl2.x+(cl2.isBuilding?cl2.size/2:0.5))-(unit.x+0.5),(cl2.y+(cl2.isBuilding?cl2.size/2:0.5))-(unit.y+0.5));
        if (dist<=unit.range) performAttack(unit,cl2);
        else if (unit.team===TEAM_ENEMY) unit.attackTarget = cl2;
      }
    }
  }
  // Counter-attack
  if (unit.team===TEAM_ENEMY&&unit.lastDamagedBy&&!unit.lastDamagedBy.dead&&unit.lastDamagedTimer>0&&!unit.attackTarget) {
    unit.attackTarget = unit.lastDamagedBy;
  }
  moveUnit(unit);
}

function updateHarvesterAI(unit) {
  if (unit.ore>=unit.capacity) unit.returningToRefinery = true;
  if (unit.returningToRefinery) {
    var ref = gameState.map.findNearestRefinery(unit.x,unit.y,unit.team,gameState.entities);
    if (!ref) { unit.returningToRefinery=false; return; }
    var refX = Math.floor(ref.x)+Math.floor(ref.size/2);
    var refY = Math.floor(ref.y)+Math.floor(ref.size/2);
    var distToRef = Math.hypot(unit.x-refX,unit.y-refY);
    if (distToRef<3) {
      if (unit.team===TEAM_PLAYER) { gameState.playerCredits+=unit.ore; gameState.stats.oreGathered+=unit.ore; }
      else gameState.enemyCredits+=unit.ore;
      gameState.addFloatingText(ref.getCenterX(),ref.getCenterY()-12,'+'+unit.ore,'#f1c40f');
      unit.ore = 0; unit.returningToRefinery = false;
      unit.path = []; unit.pathIndex = 0;
      var ore = gameState.map.findNearestOre(Math.floor(unit.x),Math.floor(unit.y));
      if (ore.x>=0) {
        unit.harvestTarget = ore;
        unit.path = gameState.map.findPath(Math.floor(unit.x),Math.floor(unit.y),ore.x,ore.y);
        unit.pathIndex = 0;
      }
    } else {
      if (unit.path.length===0||unit.pathIndex>=unit.path.length||unit.pathRecalcTimer<=0) {
        unit.path = gameState.map.findPath(Math.floor(unit.x),Math.floor(unit.y),refX,refY);
        unit.pathIndex = 0; unit.pathRecalcTimer = 90;
      }
      moveUnit(unit);
    }
    return;
  }
  if (!unit.harvestTarget||!gameState.map.oreAmount[unit.harvestTarget.y]||gameState.map.oreAmount[unit.harvestTarget.y][unit.harvestTarget.x]<=0) {
    var ore2 = gameState.map.findNearestOre(Math.floor(unit.x),Math.floor(unit.y));
    if (ore2.x>=0) { unit.harvestTarget=ore2; unit.path=[]; unit.pathIndex=0; }
    else return;
  }
  var distToOre = Math.hypot(unit.x-unit.harvestTarget.x-0.5,unit.y-unit.harvestTarget.y-0.5);
  if (distToOre<1.8) {
    unit.harvestTimer++;
    if (unit.harvestTimer>=10) {
      unit.harvestTimer = 0;
      if (gameState.map.terrain[unit.harvestTarget.y]&&gameState.map.terrain[unit.harvestTarget.y][unit.harvestTarget.x]===ORE&&gameState.map.oreAmount[unit.harvestTarget.y][unit.harvestTarget.x]>0) {
        var amt = Math.min(30,unit.capacity-unit.ore,gameState.map.oreAmount[unit.harvestTarget.y][unit.harvestTarget.x]);
        unit.ore += amt;
        gameState.map.oreAmount[unit.harvestTarget.y][unit.harvestTarget.x] -= amt;
        if (gameState.map.oreAmount[unit.harvestTarget.y][unit.harvestTarget.x]<=0) {
          gameState.map.terrain[unit.harvestTarget.y][unit.harvestTarget.x] = GRASS;
          unit.harvestTarget = null; unit.path = []; unit.pathIndex = 0;
        }
      } else { unit.harvestTarget=null; unit.path=[]; unit.pathIndex=0; }
    }
  } else {
    if (unit.path.length===0||unit.pathIndex>=unit.path.length||unit.pathRecalcTimer<=0) {
      unit.path = gameState.map.findPath(Math.floor(unit.x),Math.floor(unit.y),unit.harvestTarget.x,unit.harvestTarget.y);
      unit.pathIndex = 0; unit.pathRecalcTimer = 90;
    }
    moveUnit(unit);
  }
}

function moveUnit(unit) {
  if (unit.path.length>0&&unit.pathIndex<unit.path.length) {
    var wp = unit.path[unit.pathIndex];
    var occ = gameState.map.occupancy[wp.y]&&gameState.map.occupancy[wp.y][wp.x];
    if (occ&&occ!==unit&&!occ.isBuilding&&occ.team===unit.team) {
      unit.pathRecalcTimer--;
      if (unit.pathRecalcTimer<-20) {
        unit.path = gameState.map.findPath(Math.floor(unit.x),Math.floor(unit.y),unit.path[unit.path.length-1].x,unit.path[unit.path.length-1].y);
        unit.pathIndex = 0; unit.pathRecalcTimer = 30;
      }
      return;
    }
    var tx = wp.x+0.5, ty = wp.y+0.5;
    var dx = tx-unit.x, dy = ty-unit.y;
    var dist = Math.hypot(dx,dy);
    var terrain = gameState.map.terrain[Math.floor(unit.y)]&&gameState.map.terrain[Math.floor(unit.y)][Math.floor(unit.x)];
    var tMod = 1;
    if (terrain===SAND) tMod = 0.85;
    else if (terrain===CONCRETE) tMod = 1.15;
    var ms = unit.speed*0.075*tMod;
    if (dist<ms) { unit.x=tx; unit.y=ty; unit.pathIndex++; }
    else { unit.x+=dx/dist*ms; unit.y+=dy/dist*ms; unit.direction=Math.atan2(dy,dx); unit.turretDir=unit.direction; }
    unit.animTimer++;
    if (unit.animTimer>6) { unit.animTimer=0; unit.animFrame=(unit.animFrame+1)%4; }
  }
}

function performAttack(attacker,target) {
  attacker.fireCooldown = attacker.fireRate;
  attacker.muzzleFlash = 6;
  attacker.turretDir = Math.atan2(target.getCenterY()/TILE_SIZE-attacker.y-0.5,target.getCenterX()/TILE_SIZE-attacker.x-0.5);
  var dmg = attacker.damage;
  if (attacker.antiArmor&&target.type2==='vehicle') dmg = Math.floor(dmg*2.2);
  if (attacker.type2==='vehicle'&&target.type2==='infantry') dmg = Math.floor(dmg*0.5);
  if (attacker.veterancy>=1) dmg = Math.floor(dmg*1.25);
  if (attacker.veterancy>=2) dmg = Math.floor(dmg*1.5);
  var scatter = 0.85+Math.random()*0.3;
  dmg = Math.floor(dmg*scatter);
  target.lastDamagedBy = attacker;
  target.lastDamagedTimer = 180;
  // Player buildings: alert
  if (target.team===TEAM_PLAYER&&target.isBuilding&&gameState.underAttackAlertCooldown===0) {
    notify('警告: 基地遭到攻击！','danger');
    playAlertSound();
    gameState.addMinimapAlert(target.x,target.y,'#e74c3c');
    gameState.underAttackAlertCooldown = 300;
  }
  if (attacker.burstCount>0) {
    attacker.burstRemaining = attacker.burstCount-1;
    attacker.burstTarget = target;
    performBurstShot(attacker,target);
    return;
  }
  var projType = (attacker.type2==='vehicle'||attacker.type==='turret'||attacker.type==='aaGun') ? 'shell' : 'bullet';
  if (attacker.type==='tesla') projType = 'tesla';
  else if (attacker.type==='arty') projType = 'shell';
  else if (attacker.type==='rocket'||attacker.type==='mlrs') projType = 'rocket';
  var from = {x:attacker.getCenterX(),y:attacker.getCenterY()};
  gameState.addProjectile(from,target,dmg,attacker.team,projType,attacker.splashRadius);
  if (projType==='bullet') playShootSound();
  else if (projType==='shell'||projType==='rocket') { try { setTimeout(function(){playSound(180,'sawtooth',0.12,0.06);},80); } catch(e){} }
}

function performBurstShot(attacker,target) {
  attacker.fireCooldown = 8;
  attacker.muzzleFlash = 4;
  var dmg = attacker.damage;
  if (attacker.veterancy>=1) dmg = Math.floor(dmg*1.25);
  var from = {x:attacker.getCenterX()+(Math.random()-0.5)*8,y:attacker.getCenterY()+(Math.random()-0.5)*8};
  gameState.addProjectile(from,target,dmg,attacker.team,'rocket',0);
  playShootSound();
}

function updateProjectiles() {
  for (var i = gameState.projectiles.length-1; i >= 0; i--) {
    var p = gameState.projectiles[i];
    if (p.target&&!p.target.dead&&p.target.getCenterX) {
      p.targetX = p.target.getCenterX();
      p.targetY = p.target.getCenterY();
    }
    var dx = p.targetX-p.x, dy = p.targetY-p.y;
    var dist = Math.hypot(dx,dy);
    if (dist<p.speed*2) {
      if (p.target&&!p.target.dead) {
        p.target.hp -= p.damage;
        p.target.flashTimer = 5;
        if (p.type==='shell'||p.type==='tesla') gameState.addExplosion(p.targetX,p.targetY,20,p.type==='tesla'?'electric':'fire');
        else if (p.type==='rocket') gameState.addExplosion(p.targetX,p.targetY,16,'fire');
        if (p.splash>0) {
          gameState.applySplashDamage(p.targetX,p.targetY,p.splash,Math.floor(p.damage*0.6),p.team);
          gameState.addExplosion(p.targetX,p.targetY,p.splash*TILE_SIZE*0.6,'big');
        }
        if (p.target.hp<=0) {
          p.target.hp = 0;
          gameState.addExplosion(p.targetX,p.targetY,36,'big');
          playExplosionSound();
          if (p.target.type==='base') { gameState.gameOver=true; gameState.winner=p.target.team===TEAM_PLAYER?TEAM_ENEMY:TEAM_PLAYER; }
          gameState.removeEntity(p.target);
        } else {
          gameState.addFloatingText(p.targetX,p.targetY-10,'-'+p.damage,'#ff6b6b');
        }
      } else if (p.splash>0) {
        gameState.addExplosion(p.targetX,p.targetY,24,'fire');
        gameState.applySplashDamage(p.targetX,p.targetY,p.splash,Math.floor(p.damage*0.5),p.team);
      }
      gameState.projectiles.splice(i,1);
    } else {
      p.x += dx/dist*p.speed;
      p.y += dy/dist*p.speed;
    }
  }
}

function updateExplosions() {
  for (var i=gameState.explosions.length-1;i>=0;i--) {
    gameState.explosions[i].timer--;
    if (gameState.explosions[i].timer<=0) gameState.explosions.splice(i,1);
  }
}

function updateFloatingTexts() {
  for (var i=gameState.floatingTexts.length-1;i>=0;i--) {
    var ft = gameState.floatingTexts[i];
    ft.y += ft.vy; ft.timer--;
    if (ft.timer<=0) gameState.floatingTexts.splice(i,1);
  }
}

function updateSmoke() {
  for (var i=gameState.smokeParticles.length-1;i>=0;i--) {
    var sm = gameState.smokeParticles[i];
    sm.x += sm.vx; sm.y += sm.vy;
    sm.vy *= 0.98; sm.size += 0.1; sm.timer--;
    if (sm.timer<=0) gameState.smokeParticles.splice(i,1);
  }
}

function updateMinimapAlerts() {
  for (var i=gameState.minimapAlerts.length-1;i>=0;i--) {
    gameState.minimapAlerts[i].timer--;
    if (gameState.minimapAlerts[i].timer<=0) gameState.minimapAlerts.splice(i,1);
  }
}

function updateResources() {
  var pp=0,ppU=0,ep=0,epU=0,uc=0;
  for (var i=0;i<gameState.entities.length;i++) {
    var e = gameState.entities[i];
    if (e.dead||!e.built) continue;
    if (e.isBuilding) {
      if (e.team===TEAM_PLAYER) { pp+=e.power||0; ppU+=e.powerUse||0; }
      else { ep+=e.power||0; epU+=e.powerUse||0; }
    } else if (e.team===TEAM_PLAYER) uc++;
  }
  gameState.playerPower=pp; gameState.playerPowerUse=ppU;
  gameState.enemyPower=ep; gameState.enemyPowerUse=epU;
  gameState.playerUnitCount=uc;
  gameState.hasRadar = gameState.hasBuilding(TEAM_PLAYER,'radar');
  gameState.hasTechCenter = gameState.hasBuilding(TEAM_PLAYER,'techCenter');
  if (gameState.lowPowerAlertCooldown>0) gameState.lowPowerAlertCooldown--;
  if (gameState.playerPower<gameState.playerPowerUse&&gameState.lowPowerAlertCooldown===0) {
    notify('警告: 电力不足！','warn');
    playAlertSound();
    gameState.lowPowerAlertCooldown = 600;
  }
  if (gameState.underAttackAlertCooldown>0) gameState.underAttackAlertCooldown--;
}

// ===================== ENEMY AI =====================
function updateEnemyAI() {
  var diffMult=1, buildInterval=180, attackInterval=1200;
  if (difficulty==='normal') { diffMult=1.3; buildInterval=120; attackInterval=900; }
  else if (difficulty==='hard') { diffMult=2.2; buildInterval=65; attackInterval=550; }
  if (frameCount%30===0) gameState.enemyCredits += Math.floor((25+enemyAttackWave*8)*diffMult);
  enemyAITimer++;
  if (enemyAITimer>=buildInterval) {
    enemyAITimer = 0;
    enemyAIBuildPhase();
    enemyAIProductionPhase();
    enemyAIDefensePhase();
  }
  enemyAttackTimer++;
  if (enemyAttackTimer>=attackInterval) {
    enemyAttackTimer = 0; enemyAttackWave++;
    launchEnemyAttack();
  }
  enemyScoutTimer++;
  if (enemyScoutTimer>=1800&&enemyAttackWave<3) {
    enemyScoutTimer = 0;
    var idleE = gameState.getEnemyUnits().filter(function(u){return u.type2!=='harvester'&&!u.attackTarget;});
    if (idleE.length>2) {
      var scouts = idleE.slice(0,2);
      var pBs = gameState.getPlayerBuildings();
      if (pBs.length>0) {
        var tgt = pBs[Math.floor(Math.random()*pBs.length)];
        scouts.forEach(function(u){u.attackTarget=tgt;});
      }
    }
  }
  var eu = gameState.getEnemyUnits();
  for (var i=0;i<eu.length;i++) if (!eu[i].dead) updateUnitAI(eu[i]);
}

function enemyAIBuildPhase() {
  if (enemyBuildQueue.length>0) {
    var nb = enemyBuildQueue[0];
    if (gameState.canBuild(nb,TEAM_ENEMY)) {
      var pos = findBuildPosition(nb,TEAM_ENEMY);
      if (pos) {
        enemyBuildQueue.shift();
        var def2 = BUILDING_DEFS[nb]||DEFENSE_DEFS[nb];
        gameState.enemyCredits -= def2.cost;
        var newB = gameState.spawnEntity(nb,TEAM_ENEMY,pos.x,pos.y);
        for (var ci=0;ci<newB.size;ci++) for (var cj=0;cj<newB.size;cj++) {
          if (pos.y+ci<MAP_HEIGHT&&pos.x+cj<MAP_WIDTH) gameState.map.terrain[pos.y+ci][pos.x+cj]=CONCRETE;
        }
      }
    }
  }
  var qHas = function(t){return enemyBuildQueue.indexOf(t)>=0;};
  if (!gameState.hasBuilding(TEAM_ENEMY,'powerPlant')&&gameState.enemyCredits>=300&&!qHas('powerPlant')) enemyBuildQueue.push('powerPlant');
  if (!gameState.hasBuilding(TEAM_ENEMY,'refinery')&&gameState.enemyCredits>=500&&!qHas('refinery')) enemyBuildQueue.push('refinery');
  if (!gameState.hasBuilding(TEAM_ENEMY,'barracks')&&gameState.hasBuilding(TEAM_ENEMY,'powerPlant')&&gameState.enemyCredits>=400&&!qHas('barracks')) enemyBuildQueue.push('barracks');
  if (!gameState.hasBuilding(TEAM_ENEMY,'warFactory')&&gameState.hasBuilding(TEAM_ENEMY,'barracks')&&gameState.enemyCredits>=700&&!qHas('warFactory')) enemyBuildQueue.push('warFactory');
  if (!gameState.hasBuilding(TEAM_ENEMY,'radar')&&gameState.hasBuilding(TEAM_ENEMY,'powerPlant')&&gameState.enemyCredits>=600&&!qHas('radar')) enemyBuildQueue.push('radar');
  if (!gameState.hasBuilding(TEAM_ENEMY,'techCenter')&&gameState.hasBuilding(TEAM_ENEMY,'radar')&&gameState.hasBuilding(TEAM_ENEMY,'warFactory')&&gameState.enemyCredits>=1200&&!qHas('techCenter')) enemyBuildQueue.push('techCenter');
  var surplus = gameState.enemyPower-gameState.enemyPowerUse;
  if (surplus<30&&gameState.enemyCredits>=300&&!qHas('powerPlant')) enemyBuildQueue.push('powerPlant');
  if (difficulty==='hard'&&gameState.hasBuilding(TEAM_ENEMY,'refinery')) {
    var refs = gameState.entities.filter(function(e){return e.team===TEAM_ENEMY&&e.type==='refinery'&&!e.dead;}).length;
    if (refs<2&&gameState.enemyCredits>=500&&!qHas('refinery')) enemyBuildQueue.push('refinery');
  }
}

function enemyAIProductionPhase() {
  var harvCount = gameState.getEnemyUnits().filter(function(u){return u.type2==='harvester';}).length;
  var targetHarv = difficulty==='hard'?4:(difficulty==='normal'?3:2);
  if (harvCount<targetHarv&&gameState.hasBuilding(TEAM_ENEMY,'refinery')&&gameState.enemyCredits>=600) {
    var refB = findBuilding('refinery',TEAM_ENEMY);
    if (refB&&!refB.producing) { gameState.enemyCredits-=600; refB.producing='harvester'; refB.produceProgress=0; }
  }
  var iBar = findBuilding('barracks',TEAM_ENEMY);
  if (iBar&&!iBar.producing&&gameState.enemyCredits>=100) {
    var roll = Math.random(); var uc2;
    if (gameState.enemyCredits>=300&&roll>0.85) uc2 = 'engineer';
    else if (gameState.enemyCredits>=200&&roll>0.55) uc2 = 'rocket';
    else uc2 = 'infantry';
    if (UNIT_DEFS[uc2].cost<=gameState.enemyCredits) { gameState.enemyCredits-=UNIT_DEFS[uc2].cost; iBar.producing=uc2; iBar.produceProgress=0; }
  }
  var wfB = findBuilding('warFactory',TEAM_ENEMY);
  if (wfB&&!wfB.producing&&gameState.enemyCredits>=500) {
    var vc = 'tank', vRoll = Math.random();
    if (gameState.hasBuilding(TEAM_ENEMY,'techCenter')&&gameState.enemyCredits>=1100&&vRoll>0.75) vc='mlrs';
    else if (gameState.hasBuilding(TEAM_ENEMY,'techCenter')&&gameState.enemyCredits>=900&&vRoll>0.45) vc='heavyTank';
    else if (gameState.enemyCredits>=700&&vRoll>0.6) vc='arty';
    else if (gameState.enemyCredits>=500&&vRoll>0.4) vc='apc';
    if (UNIT_DEFS[vc].cost<=gameState.enemyCredits) { gameState.enemyCredits-=UNIT_DEFS[vc].cost; wfB.producing=vc; wfB.produceProgress=0; }
  }
}

function enemyAIDefensePhase() {
  if (Math.random()>0.5&&gameState.enemyCredits>=300) {
    var dc='pillbox', dRoll=Math.random();
    if (gameState.hasBuilding(TEAM_ENEMY,'techCenter')&&gameState.enemyCredits>=1500&&dRoll>0.8) dc='tesla';
    else if (gameState.hasBuilding(TEAM_ENEMY,'warFactory')&&gameState.enemyCredits>=600&&dRoll>0.4) dc='turret';
    var dpos = findBuildPosition(dc,TEAM_ENEMY);
    if (dpos&&gameState.canBuild(dc,TEAM_ENEMY)) {
      gameState.enemyCredits -= DEFENSE_DEFS[dc].cost;
      var nd = gameState.spawnEntity(dc,TEAM_ENEMY,dpos.x,dpos.y);
      if (dpos.y<MAP_HEIGHT&&dpos.x<MAP_WIDTH) gameState.map.terrain[dpos.y][dpos.x]=CONCRETE;
    }
  }
}

function launchEnemyAttack() {
  var idle = gameState.getEnemyUnits().filter(function(u){return u.type2!=='harvester'&&!u.attackTarget&&!u.attackMoveTarget;});
  if (idle.length<3) return;
  var force = Math.min(idle.length,Math.floor(3+enemyAttackWave*1.5));
  var atk = idle.slice(0,force);
  var pBs = gameState.getPlayerBuildings();
  if (pBs.length===0) return;
  var pri = pBs.filter(function(b){return b.type==='powerPlant'||b.type==='refinery'||b.type==='base';});
  var target = pri.length>0?pri[Math.floor(Math.random()*pri.length)]:pBs[Math.floor(Math.random()*pBs.length)];
  atk.forEach(function(u){
    u.attackTarget = target;
    u.attackMoveTarget = {x:Math.floor(target.x),y:Math.floor(target.y)};
  });
  if (force>=6) {
    notify('警告: 敌军大规模进攻！','danger');
    playAlertSound();
    gameState.addMinimapAlert(atk[0].x,atk[0].y,'#e74c3c');
  } else if (force>=3&&gameState.underAttackAlertCooldown===0) {
    notify('警告: 敌军来袭！','warn');
    playAlertSound();
    gameState.underAttackAlertCooldown = 300;
  }
}

function findBuilding(type,team) {
  for (var i=0;i<gameState.entities.length;i++) {
    var e = gameState.entities[i];
    if (e.team===team&&e.type===type&&e.built&&!e.dead) return e;
  }
  return null;
}

function findBuildPosition(type,team) {
  var def = BUILDING_DEFS[type]||DEFENSE_DEFS[type];
  if (!def) return null;
  var bases = gameState.entities.filter(function(e){return e.team===team&&e.isBuilding&&e.built&&!e.dead;});
  if (bases.length===0) return null;
  var center = bases[Math.floor(Math.random()*Math.min(3,bases.length))];
  for (var a=0;a<100;a++) {
    var ox = Math.floor(Math.random()*22)-11;
    var oy = Math.floor(Math.random()*22)-11;
    var px = Math.floor(center.x)+ox, py = Math.floor(center.y)+oy;
    if (px<1||py<1||px+def.size>MAP_WIDTH-1||py+def.size>MAP_HEIGHT-1) continue;
    if (gameState.map.isBuildable(px,py,def.size)&&gameState.map.isNearBuilding(px,py,def.size,team)) return {x:px,y:py};
  }
  return null;
}

function startBuild(type,team) {
  var def = BUILDING_DEFS[type]||DEFENSE_DEFS[type]||UNIT_DEFS[type];
  if (!def) return;
  if (team===TEAM_PLAYER&&!gameState.canBuild(type,team)) {
    var reason = gameState.getBuildReason(type,team);
    notify(reason,'warn');
    playCancelSound();
    return;
  }
  if (!gameState.canBuild(type,team)) return;
  if (def.category==='units') {
    var pb = findProducingBuilding(type,team);
    if (!pb) { notify('没有可用的生产建筑','warn'); return; }
    if (pb.producing) {
      if (pb.productionQueue.length<5) {
        if (team===TEAM_PLAYER) gameState.playerCredits -= def.cost;
        else gameState.enemyCredits -= def.cost;
        pb.productionQueue.push(type);
        if (team===TEAM_PLAYER) notify(def.name+' 已加入队列 ('+pb.productionQueue.length+')','info');
      } else if (team===TEAM_PLAYER) notify('生产队列已满','warn');
      return;
    }
    if (team===TEAM_PLAYER) { gameState.playerCredits-=def.cost; pb.producing=type; pb.produceProgress=0; notify('开始训练 '+def.name,'info'); }
  } else if (team===TEAM_PLAYER) {
    placingType = type; placingBuilding = true;
    notify('点击地图放置 '+def.name+'，ESC 取消','info');
  }
}

function findProducingBuilding(type,team) {
  var def = UNIT_DEFS[type]; if (!def) return null;
  var fallback = null;
  for (var i=0;i<gameState.entities.length;i++) {
    var e = gameState.entities[i];
    if (e.team===team&&e.built&&!e.dead&&e.isBuilding) {
      var match = (type==='harvester'&&e.type==='refinery')||(def.requires&&def.requires.indexOf(e.type)>=0);
      if (match) {
        if (!e.producing) return e;
        if (!fallback) fallback = e;
      }
    }
  }
  return fallback;
}

// ===================== ACTIONS =====================
function toggleAction(action) {
  if (activeAction===action) { activeAction=null; }
  else activeAction = action;
  placingBuilding = false; placingType = null;
  document.getElementById('btnRepair').classList.toggle('active',activeAction==='repair');
  document.getElementById('btnSell').classList.toggle('active',activeAction==='sell');
}

function commandStop() {
  if (selectedUnits.length>0) {
    selectedUnits.forEach(function(u){
      u.path=[]; u.pathIndex=0;
      u.attackTarget=null; u.attackMoveTarget=null; u.guardPos=null;
      u.burstRemaining=0; u.burstTarget=null;
    });
    notify('停止命令','info');
  }
}

function sellBuilding(b) {
  var def = BUILDING_DEFS[b.type]||DEFENSE_DEFS[b.type];
  if (!def||b.type==='base') { notify('该建筑无法出售','warn'); return; }
  var refund = Math.floor(def.cost*0.5*(b.hp/b.maxHp));
  gameState.playerCredits += refund;
  notify('出售 '+b.name+' 回收 $'+refund,'info');
  gameState.addFloatingText(b.getCenterX(),b.getCenterY()-10,'+$'+refund,'#f1c40f');
  gameState.addExplosion(b.getCenterX(),b.getCenterY(),30,'big');
  gameState.removeEntity(b);
  playBuildSound();
}

function repairBuilding(b) {
  if (b.hp>=b.maxHp) { notify('该建筑无需修理','info'); return; }
  var def = BUILDING_DEFS[b.type]||DEFENSE_DEFS[b.type];
  if (!def) return;
  var damage = b.maxHp-b.hp;
  var cost = Math.ceil(def.cost*damage/b.maxHp*0.6);
  if (gameState.playerCredits<cost) { notify('资金不足，需要 $'+cost,'warn'); return; }
  gameState.playerCredits -= cost;
  b.hp = b.maxHp;
  gameState.addFloatingText(b.getCenterX(),b.getCenterY()-10,'修复！','#2ecc71');
  notify(b.name+' 已修复 (花费 $'+cost+')','info');
  playBuildSound();
}

function togglePause() {
  gamePaused = !gamePaused;
  var btn = document.getElementById('pauseBtn');
  btn.textContent = gamePaused?'继续':'暂停';
  btn.classList.toggle('paused',gamePaused);
  if (gamePaused) notify('游戏已暂停','info');
}

function cycleSpeed() {
  gameSpeed = gameSpeed===1?2:(gameSpeed===2?4:1);
  document.getElementById('speedBtn').textContent = gameSpeed+'×';
  notify('游戏速度: '+gameSpeed+'×','info');
}

function showHelp() { document.getElementById('helpOverlay').style.display='flex'; }
function hideHelp() { document.getElementById('helpOverlay').style.display='none'; }

// ===================== TILE CACHE =====================
var tileCache = {};
function getTileCanvas(type,tx,ty) {
  var variant = (tx*7+ty*13)%4;
  var key = type+'_'+variant;
  if (tileCache[key]) return tileCache[key];
  var tc = document.createElement('canvas');
  tc.width = TILE_SIZE; tc.height = TILE_SIZE;
  drawTileToCtx(tc.getContext('2d'),type,variant);
  tileCache[key] = tc;
  return tc;
}

function drawTileToCtx(tctx,type,variant) {
  var s = TILE_SIZE;
  if (type===GRASS) {
    var bc = ['#2d5a1e','#3a6b2a','#2a5520','#326020'];
    tctx.fillStyle = bc[variant]; tctx.fillRect(0,0,s,s);
    tctx.fillStyle = 'rgba(60,120,40,0.35)';
    if (variant%3===0) { tctx.fillRect(14,8,2,5); tctx.fillRect(15,6,2,4); }
    if (variant%2===0) {
      tctx.fillStyle = 'rgba(30,80,15,0.3)';
      tctx.beginPath(); tctx.arc(s-14,s-14,3,0,Math.PI*2); tctx.fill();
    }
    tctx.fillStyle = 'rgba(0,0,0,0.05)';
    tctx.fillRect(0,s-1,s,1);
  } else if (type===SAND) {
    var sc = ['#b8960c','#c9a21a','#b5911a','#c2a015'];
    tctx.fillStyle = sc[variant]; tctx.fillRect(0,0,s,s);
    tctx.fillStyle = 'rgba(200,170,40,0.4)';
    for (var si=0;si<4;si++) tctx.fillRect(si*7+2,si*6+4,3,2);
  } else if (type===ROCK) {
    tctx.fillStyle = '#4a5568'; tctx.fillRect(0,0,s,s);
    tctx.fillStyle = '#6b7a8d'; tctx.fillRect(3,3,s-6,s-6);
    tctx.fillStyle = '#8a9ab0'; tctx.fillRect(7,5,8,5); tctx.fillRect(17,14,9,4);
    tctx.fillStyle = 'rgba(0,0,0,0.25)'; tctx.fillRect(s-5,3,5,s-3); tctx.fillRect(3,s-5,s-8,5);
  } else if (type===CONCRETE) {
    tctx.fillStyle = '#3d3d3d'; tctx.fillRect(0,0,s,s);
    tctx.fillStyle = '#484848'; tctx.fillRect(1,1,s-2,s-2);
    tctx.strokeStyle = '#2a2a2a'; tctx.lineWidth = 0.5;
    tctx.strokeRect(0.5,0.5,s-1,s-1);
    tctx.fillStyle = 'rgba(255,255,255,0.04)'; tctx.fillRect(1,1,s/2-1,s/2-1);
  } else if (type===TREE) {
    // Grass background
    tctx.fillStyle = '#2d5a1e'; tctx.fillRect(0,0,s,s);
    // Tree trunk
    tctx.fillStyle = '#5d4037';
    tctx.fillRect(s/2-2,s-12,4,8);
    // Tree foliage
    tctx.fillStyle = '#1e4a10';
    tctx.beginPath(); tctx.arc(s/2,s/2-2,9,0,Math.PI*2); tctx.fill();
    tctx.fillStyle = '#2d5e1e';
    tctx.beginPath(); tctx.arc(s/2-3,s/2-4,6,0,Math.PI*2); tctx.fill();
    tctx.fillStyle = '#3d6e2e';
    tctx.beginPath(); tctx.arc(s/2+3,s/2-5,5,0,Math.PI*2); tctx.fill();
  }
}

// ===================== RENDER =====================
function render() {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  var viewWidth = canvas.width-300;
  var viewHeight = canvas.height;
  var zoom = camera.zoom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0,0,viewWidth,viewHeight);
  ctx.clip();
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x/zoom, -camera.y/zoom);
  var startTX = Math.max(0,Math.floor(camera.x/zoom/TILE_SIZE));
  var startTY = Math.max(0,Math.floor(camera.y/zoom/TILE_SIZE));
  var endTX = Math.min(MAP_WIDTH,Math.ceil((camera.x/zoom+viewWidth/zoom)/TILE_SIZE)+1);
  var endTY = Math.min(MAP_HEIGHT,Math.ceil((camera.y/zoom+viewHeight/zoom)/TILE_SIZE)+1);

  // Terrain
  for (var ty=startTY;ty<endTY;ty++) {
    for (var tx=startTX;tx<endTX;tx++) {
      var sx = tx*TILE_SIZE;
      var sy = ty*TILE_SIZE;
      var terrain = gameState.map.terrain[ty][tx];
      if (terrain===ORE) {
        ctx.fillStyle = '#2d5a1e'; ctx.fillRect(sx,sy,TILE_SIZE,TILE_SIZE);
        var oreAmt = gameState.map.oreAmount[ty][tx];
        var crystals = Math.min(6,Math.floor(oreAmt/100)+1);
        var pulse = 0.85+Math.sin(frameCount*0.08+tx+ty)*0.15;
        for (var ci=0;ci<crystals;ci++) {
          var crx = sx+4+((ci*7+tx*3)%22);
          var cry = sy+4+((ci*11+ty*5)%22);
          ctx.fillStyle = 'rgba(241,196,15,'+pulse+')';
          ctx.beginPath();
          ctx.moveTo(crx,cry-5); ctx.lineTo(crx+4,cry); ctx.lineTo(crx,cry+5); ctx.lineTo(crx-4,cry);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,220,50,0.65)';
          ctx.beginPath();
          ctx.moveTo(crx,cry-2); ctx.lineTo(crx+2,cry); ctx.lineTo(crx,cry+2); ctx.lineTo(crx-2,cry);
          ctx.closePath(); ctx.fill();
        }
      } else if (terrain===WATER) {
        ctx.fillStyle = '#1a5276'; ctx.fillRect(sx,sy,TILE_SIZE,TILE_SIZE);
        var woff = Math.sin(frameCount*0.04+tx*0.7+ty*0.5)*2;
        ctx.fillStyle = 'rgba(52,152,219,0.3)';
        ctx.fillRect(sx,sy+10+woff,TILE_SIZE,3);
        ctx.fillRect(sx+5,sy+22-woff,TILE_SIZE-10,3);
        ctx.fillStyle = 'rgba(120,200,255,0.18)';
        ctx.fillRect(sx+Math.sin(frameCount*0.03+tx)*3,sy+2,TILE_SIZE-8,2);
      } else {
        ctx.drawImage(getTileCanvas(terrain,tx,ty),sx,sy);
      }
    }
  }

  // Entities sorted by y for proper overlap
  var sortedE = gameState.entities.slice().sort(function(a,b){
    return (a.y+(a.isBuilding?a.size:1))-(b.y+(b.isBuilding?b.size:1));
  });
  for (var ei=0;ei<sortedE.length;ei++) {
    var e = sortedE[ei];
    var ex = e.x*TILE_SIZE;
    var ey2 = e.y*TILE_SIZE;
    var eS = e.size*TILE_SIZE;
    if (ex+eS<camera.x/zoom||ey2+eS<camera.y/zoom||ex>camera.x/zoom+viewWidth/zoom||ey2>camera.y/zoom+viewHeight/zoom) continue;
    if (e.dead) {
      ctx.globalAlpha = e.deathTimer/45;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(ex,ey2,eS,eS);
      ctx.globalAlpha = 1;
      continue;
    }
    var tc = e.team===TEAM_PLAYER?COLOR_PLAYER:COLOR_ENEMY;
    var td = e.team===TEAM_PLAYER?COLOR_PLAYER_DARK:COLOR_ENEMY_DARK;
    if (e.flashTimer>0) ctx.globalAlpha = 0.5+Math.sin(e.flashTimer*2)*0.5;
    if (e.isBuilding) drawBuilding(e,ex,ey2,eS,tc,td);
    else drawUnit(e,ex,ey2,tc,td);
    ctx.globalAlpha = 1;

    // Selection highlight
    if (e.selected) {
      ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2;
      ctx.setLineDash([5,3]);
      ctx.strokeRect(ex-2,ey2-2,eS+4,eS+4);
      ctx.setLineDash([]);
      // Corner brackets
      var brSize = 5;
      ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ex-2,ey2-2+brSize); ctx.lineTo(ex-2,ey2-2); ctx.lineTo(ex-2+brSize,ey2-2);
      ctx.moveTo(ex+eS+2-brSize,ey2-2); ctx.lineTo(ex+eS+2,ey2-2); ctx.lineTo(ex+eS+2,ey2-2+brSize);
      ctx.moveTo(ex-2,ey2+eS+2-brSize); ctx.lineTo(ex-2,ey2+eS+2); ctx.lineTo(ex-2+brSize,ey2+eS+2);
      ctx.moveTo(ex+eS+2-brSize,ey2+eS+2); ctx.lineTo(ex+eS+2,ey2+eS+2); ctx.lineTo(ex+eS+2,ey2+eS+2-brSize);
      ctx.stroke();
    }
    // HP bar
    if (e.hp<e.maxHp&&!e.dead) {
      var bw = eS, bh = 4, bx2 = ex, by2 = ey2-7;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx2,by2,bw,bh);
      var r = e.hp/e.maxHp;
      ctx.fillStyle = r>0.6?'#2ecc71':(r>0.3?'#f39c12':'#e74c3c');
      ctx.fillRect(bx2,by2,bw*r,bh);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx2,by2,bw,bh);
    }
    // Veterancy chevrons
    if (e.veterancy>0) {
      ctx.fillStyle = e.veterancy>=2?'#f1c40f':'#bdc3c7';
      for (var v=0;v<e.veterancy;v++) {
        ctx.beginPath();
        ctx.moveTo(ex+v*5+2,ey2+eS-2);
        ctx.lineTo(ex+v*5+5,ey2+eS-6);
        ctx.lineTo(ex+v*5+8,ey2+eS-2);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  // Smoke particles
  for (var smi=0;smi<gameState.smokeParticles.length;smi++) {
    var sm = gameState.smokeParticles[smi];
    var smx = sm.x, smy = sm.y;
    if (smx<camera.x/zoom-20||smy<camera.y/zoom-20||smx>camera.x/zoom+viewWidth/zoom+20||smy>camera.y/zoom+viewHeight/zoom+20) continue;
    var alpha = sm.timer/sm.maxTimer*0.4;
    ctx.fillStyle = 'rgba(80,80,80,'+alpha+')';
    ctx.beginPath();
    ctx.arc(smx,smy,sm.size,0,Math.PI*2);
    ctx.fill();
  }

  // Projectiles
  for (var pi=0;pi<gameState.projectiles.length;pi++) {
    var p = gameState.projectiles[pi];
    var px = p.x, py = p.y;
    if (p.type==='bullet') {
      ctx.fillStyle = '#ffe234';
      ctx.beginPath(); ctx.arc(px,py,2.5,0,Math.PI*2); ctx.fill();
      // Tracer trail
      ctx.strokeStyle = 'rgba(255,226,52,0.4)';
      ctx.lineWidth = 1.5;
      var dxT = p.targetX-p.x, dyT = p.targetY-p.y;
      var lT = Math.hypot(dxT,dyT);
      if (lT>0) {
        ctx.beginPath();
        ctx.moveTo(px,py);
        ctx.lineTo(px-dxT/lT*6,py-dyT/lT*6);
        ctx.stroke();
      }
    } else if (p.type==='shell') {
      ctx.fillStyle = '#e67e22';
      ctx.beginPath(); ctx.arc(px,py,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f39c12';
      ctx.beginPath(); ctx.arc(px-1,py-1,2,0,Math.PI*2); ctx.fill();
    } else if (p.type==='rocket') {
      ctx.save();
      var rocketAngle = Math.atan2(p.targetY-p.y,p.targetX-p.x);
      ctx.translate(px,py); ctx.rotate(rocketAngle);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-5,-2,10,4);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-8,-1,4,2);
      ctx.fillStyle = 'rgba(255,180,0,0.7)';
      ctx.beginPath(); ctx.arc(-7,0,3,0,Math.PI*2); ctx.fill();
      ctx.restore();
    } else if (p.type==='tesla') {
      ctx.strokeStyle = 'rgba(0,191,255,0.9)';
      ctx.lineWidth = 3;
      var segs = 5;
      ctx.beginPath();
      ctx.moveTo(px,py);
      var dxL = p.targetX-p.x, dyL = p.targetY-p.y;
      for (var li=1;li<=segs;li++) {
        var lt = li/segs;
        var lx = p.x+dxL*lt+(Math.random()-0.5)*12;
        var ly = p.y+dyL*lt+(Math.random()-0.5)*12;
        ctx.lineTo(lx,ly);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(100,220,255,0.85)';
      ctx.beginPath(); ctx.arc(px,py,4,0,Math.PI*2); ctx.fill();
    }
  }

  // Explosions
  for (var xi=0;xi<gameState.explosions.length;xi++) {
    var exp = gameState.explosions[xi];
    var expX = exp.x, expY = exp.y;
    var prog = 1-exp.timer/exp.maxTimer;
    var es2 = exp.size*(0.4+prog*0.8);
    if (exp.type==='fire'||exp.type==='big') {
      ctx.fillStyle = 'rgba(255,80,0,'+(1-prog)+')';
      ctx.beginPath(); ctx.arc(expX,expY,es2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,0,'+(0.85-prog*0.85)+')';
      ctx.beginPath(); ctx.arc(expX,expY,es2*0.65,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,200,'+(0.6-prog*0.6)+')';
      ctx.beginPath(); ctx.arc(expX,expY,es2*0.3,0,Math.PI*2); ctx.fill();
      if (exp.type==='big') {
        for (var si2=0;si2<6;si2++) {
          var angle = si2*Math.PI/3+prog*2;
          var dist = es2*(0.6+prog*0.4);
          var sx3 = expX+Math.cos(angle)*dist;
          var sy3 = expY+Math.sin(angle)*dist;
          ctx.fillStyle = 'rgba(120,70,30,'+(0.6-prog*0.6)+')';
          ctx.beginPath(); ctx.arc(sx3,sy3,4+prog*5,0,Math.PI*2); ctx.fill();
        }
      }
    } else if (exp.type==='electric') {
      ctx.strokeStyle = 'rgba(0,191,255,'+(1-prog)+')';
      ctx.lineWidth = 3+prog*2;
      ctx.beginPath(); ctx.arc(expX,expY,es2,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle = 'rgba(93,173,226,'+(0.45-prog*0.45)+')';
      ctx.beginPath(); ctx.arc(expX,expY,es2*0.5,0,Math.PI*2); ctx.fill();
      // Tesla branches
      ctx.strokeStyle = 'rgba(150,220,255,'+(0.8-prog*0.8)+')';
      ctx.lineWidth = 2;
      for (var br=0;br<4;br++) {
        ctx.beginPath();
        ctx.moveTo(expX,expY);
        var ang = br*Math.PI/2+frameCount*0.1;
        ctx.lineTo(expX+Math.cos(ang)*es2,expY+Math.sin(ang)*es2);
        ctx.stroke();
      }
    }
  }

  // Floating texts
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px Arial';
  for (var fi=0;fi<gameState.floatingTexts.length;fi++) {
    var ft = gameState.floatingTexts[fi];
    var ftx = ft.x, fty = ft.y;
    ctx.globalAlpha = ft.timer/50;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(ft.text,ftx+1,fty+1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text,ftx,fty);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';

  // Building placement ghost
  if (placingBuilding&&placingType&&mouse.inCanvas) {
    var pd2 = BUILDING_DEFS[placingType]||DEFENSE_DEFS[placingType];
    if (pd2) {
      var pS = pd2.size*TILE_SIZE;
      var pgx = mouse.mapX*TILE_SIZE;
      var pgy = mouse.mapY*TILE_SIZE;
      var canPlace = gameState.map.isBuildable(mouse.mapX,mouse.mapY,pd2.size)&&
                     gameState.map.isNearBuilding(mouse.mapX,mouse.mapY,pd2.size,TEAM_PLAYER);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = canPlace?'#2ecc71':'#e74c3c';
      ctx.fillRect(pgx,pgy,pS,pS);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = canPlace?'#2ecc71':'#e74c3c';
      ctx.lineWidth = 2;
      ctx.strokeRect(pgx,pgy,pS,pS);
      // Show range for defenses
      if (DEFENSE_DEFS[placingType]&&pd2.range>0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4,4]);
        ctx.beginPath();
        ctx.arc(pgx+pS/2,pgy+pS/2,pd2.range*TILE_SIZE,0,Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  ctx.restore();

  // === Screen-space overlays (not affected by zoom) ===

  // Drag select rectangle
  if (dragSelect.active) {
    var drx = Math.min(dragSelect.startX,dragSelect.endX);
    var dry = Math.min(dragSelect.startY,dragSelect.endY);
    var drw = Math.abs(dragSelect.endX-dragSelect.startX);
    var drh = Math.abs(dragSelect.endY-dragSelect.startY);
    ctx.fillStyle = 'rgba(46,204,113,0.12)';
    ctx.fillRect(drx,dry,drw,drh);
    ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 1.5;
    ctx.setLineDash([5,3]);
    ctx.strokeRect(drx,dry,drw,drh);
    ctx.setLineDash([]);
  }

  // Action-mode cursor overlay
  if (activeAction) {
    ctx.fillStyle = activeAction==='repair'?'rgba(46,204,113,0.2)':'rgba(241,196,15,0.2)';
    ctx.fillRect(mouse.x-12,mouse.y-12,24,24);
    ctx.strokeStyle = activeAction==='repair'?'#2ecc71':'#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(mouse.x-12,mouse.y-12,24,24);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(activeAction==='repair'?'🔧':'$',mouse.x-5,mouse.y+4);
  }

  // Game paused overlay
  if (gamePaused) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0,0,viewWidth,canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('暂停',viewWidth/2,canvas.height/2);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText('按 Space 继续',viewWidth/2,canvas.height/2+30);
    ctx.textAlign = 'left';
  }

  renderMinimap();
}

// ===================== BUILDING DRAW =====================
function drawBuilding(e,ex,ey2,eS,tc,td) {
  if (!e.built) ctx.globalAlpha = (ctx.globalAlpha||1)*(0.35+e.buildProgress/100*0.65);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(ex+3,ey2+3,eS,eS);
  ctx.fillStyle = td; ctx.fillRect(ex,ey2,eS,eS);
  ctx.fillStyle = tc; ctx.fillRect(ex+2,ey2+2,eS-4,eS-4);

  switch (e.type) {
    case 'base':
      ctx.fillStyle = '#5d6d7e';
      ctx.fillRect(ex+eS*0.12,ey2+eS*0.12,eS*0.76,eS*0.76);
      ctx.fillStyle = tc;
      ctx.fillRect(ex+eS*0.22,ey2+eS*0.22,eS*0.56,eS*0.56);
      ctx.fillStyle = '#aaa'; ctx.fillRect(ex+eS*0.15,ey2+8,2,eS*0.45);
      ctx.fillStyle = '#ccc'; ctx.fillRect(ex+eS*0.13,ey2+8,6,2);
      var fy = ey2+10+Math.sin(frameCount*0.08)*3;
      ctx.fillStyle = tc; ctx.fillRect(ex+eS-14,fy,12,8);
      ctx.fillStyle = '#fff'; ctx.fillRect(ex+eS-14,fy,12,2);
      ctx.fillStyle = '#888'; ctx.fillRect(ex+eS-15,ey2+5,2,eS*0.55);
      // Door
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(ex+eS*0.4,ey2+eS*0.6,eS*0.2,eS*0.25);
      break;
    case 'powerPlant':
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(ex+eS*0.18,ey2+eS*0.35,eS*0.64,eS*0.52);
      ctx.fillStyle = '#555';
      ctx.fillRect(ex+eS*0.28,ey2+5,7,eS*0.38);
      ctx.fillRect(ex+eS*0.6,ey2+5,7,eS*0.38);
      if (e.built) {
        var sr = 5+Math.sin(frameCount*0.07)*2;
        ctx.fillStyle = 'rgba(241,196,15,0.4)';
        ctx.beginPath(); ctx.arc(ex+eS*0.315,ey2+4,sr,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex+eS*0.635,ey2+4,sr,0,Math.PI*2); ctx.fill();
      }
      break;
    case 'refinery':
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(ex+4,ey2+4,eS-8,eS-8);
      ctx.fillStyle = '#d35400';
      ctx.fillRect(ex+eS*0.55,ey2+eS*0.08,eS*0.35,eS*0.45);
      ctx.fillStyle = '#f39c12';
      ctx.beginPath(); ctx.arc(ex+eS*0.33,ey2+eS*0.55,9,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#555';
      ctx.fillRect(ex+eS*0.1,ey2+eS*0.7,eS*0.8,5);
      break;
    case 'barracks':
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(ex+3,ey2+3,eS-6,eS-6);
      ctx.fillStyle = '#145a32';
      ctx.fillRect(ex+eS*0.08,ey2+eS*0.08,eS*0.84,eS*0.25);
      ctx.fillStyle = '#1e8449';
      ctx.fillRect(ex+eS*0.08,ey2+eS*0.55,eS*0.22,eS*0.35);
      ctx.fillRect(ex+eS*0.38,ey2+eS*0.55,eS*0.22,eS*0.35);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(ex+eS*0.25,ey2+eS*0.55,eS*0.12,eS*0.3);
      break;
    case 'warFactory':
      ctx.fillStyle = '#5b2c6f';
      ctx.fillRect(ex+3,ey2+3,eS-6,eS-6);
      ctx.fillStyle = '#6c3483';
      ctx.fillRect(ex+eS*0.04,ey2+eS*0.5,eS*0.92,eS*0.44);
      ctx.fillStyle = '#333';
      ctx.fillRect(ex+eS*0.08,ey2+eS*0.55,eS*0.35,eS*0.38);
      ctx.fillStyle = '#999';
      ctx.fillRect(ex+eS*0.65,ey2+eS*0.08,5,eS*0.45);
      ctx.fillRect(ex+eS*0.5,ey2+eS*0.08,eS*0.3,4);
      ctx.fillStyle = '#555';
      ctx.fillRect(ex+eS*0.1,ey2+8,6,18);
      ctx.fillRect(ex+eS*0.22,ey2+5,6,22);
      break;
    case 'radar':
      ctx.fillStyle = '#1a252f';
      ctx.fillRect(ex+4,ey2+4,eS-8,eS-8);
      ctx.fillStyle = tc;
      ctx.fillRect(ex+eS*0.18,ey2+eS*0.35,eS*0.64,eS*0.45);
      if (e.built) {
        ctx.save();
        ctx.translate(ex+eS*0.5,ey2+eS*0.4);
        ctx.rotate(frameCount*0.04);
        ctx.fillStyle = '#5dade2';
        ctx.fillRect(-14,-2,28,4);
        ctx.fillRect(-2,-14,4,28);
        ctx.fillStyle = 'rgba(93,173,226,0.4)';
        ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*0.5); ctx.lineTo(0,0); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(ex+eS*0.5,ey2+eS*0.4,4,0,Math.PI*2); ctx.fill();
      }
      break;
    case 'techCenter':
      ctx.fillStyle = '#0e6655';
      ctx.fillRect(ex+4,ey2+4,eS-8,eS-8);
      ctx.fillStyle = '#1abc9c';
      ctx.fillRect(ex+eS*0.12,ey2+eS*0.12,eS*0.76,eS*0.28);
      for (var di=0;di<3;di++) {
        ctx.fillStyle = 'rgba(26,188,156,0.7)';
        ctx.beginPath();
        ctx.arc(ex+eS*(0.25+di*0.25),ey2+eS*0.65,6+Math.sin(frameCount*0.08+di)*2,0,Math.PI*2);
        ctx.fill();
      }
      if (e.built&&frameCount%15<7) {
        ctx.fillStyle = 'rgba(26,188,156,0.2)';
        ctx.beginPath(); ctx.arc(ex+eS*0.5,ey2+eS*0.5,eS*0.55,0,Math.PI*2); ctx.fill();
      }
      break;
    case 'repairBay':
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(ex+4,ey2+4,eS-8,eS-8);
      ctx.fillStyle = '#566573';
      ctx.fillRect(ex+eS*0.15,ey2+eS*0.15,eS*0.7,eS*0.7);
      // Wrench icon
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(ex+eS*0.4,ey2+eS*0.3,eS*0.2,eS*0.4);
      ctx.fillRect(ex+eS*0.3,ey2+eS*0.32,eS*0.4,eS*0.08);
      ctx.fillStyle = '#888';
      // Floor markings
      ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1;
      ctx.setLineDash([3,3]);
      ctx.strokeRect(ex+eS*0.1,ey2+eS*0.7,eS*0.8,eS*0.18);
      ctx.setLineDash([]);
      break;
    case 'wall':
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(ex+1,ey2+1,eS-2,eS-2);
      ctx.fillStyle = '#566573';
      ctx.fillRect(ex+3,ey2+3,eS-6,eS-6);
      // Stones
      ctx.fillStyle = '#95a5a6';
      ctx.fillRect(ex+4,ey2+4,eS/2-5,eS/2-5);
      ctx.fillRect(ex+eS/2+1,ey2+4,eS/2-5,eS/2-5);
      ctx.fillRect(ex+4,ey2+eS/2+1,eS/2-5,eS/2-5);
      ctx.fillRect(ex+eS/2+1,ey2+eS/2+1,eS/2-5,eS/2-5);
      break;
    case 'pillbox':
      ctx.fillStyle = td;
      ctx.fillRect(ex+3,ey2+3,eS-6,eS-6);
      ctx.fillStyle = tc;
      ctx.fillRect(ex+7,ey2+7,eS-14,eS-14);
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(ex+eS/2,ey2+eS/2,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(ex+eS/2-1,ey2+5,3,eS/2-5);
      break;
    case 'turret':
      ctx.fillStyle = td;
      ctx.fillRect(ex+3,ey2+3,eS-6,eS-6);
      ctx.fillStyle = tc;
      ctx.beginPath(); ctx.arc(ex+eS/2,ey2+eS/2,13,0,Math.PI*2); ctx.fill();
      // Turret rotates toward enemies
      var turretAngle = 0;
      var nrTar = gameState.getEnemiesInRange(e,e.range);
      if (nrTar.length>0) {
        turretAngle = Math.atan2(nrTar[0].getCenterY()/TILE_SIZE-e.y-e.size/2,
                                 nrTar[0].getCenterX()/TILE_SIZE-e.x-e.size/2);
      }
      ctx.save();
      ctx.translate(ex+eS/2,ey2+eS/2);
      ctx.rotate(turretAngle);
      ctx.fillStyle = '#222';
      ctx.fillRect(0,-3,18,6);
      ctx.restore();
      ctx.fillStyle = '#555';
      ctx.beginPath(); ctx.arc(ex+eS/2,ey2+eS/2,6,0,Math.PI*2); ctx.fill();
      break;
    case 'aaGun':
      ctx.fillStyle = td;
      ctx.fillRect(ex+3,ey2+3,eS-6,eS-6);
      ctx.fillStyle = '#16a085';
      ctx.beginPath(); ctx.arc(ex+eS/2,ey2+eS/2,11,0,Math.PI*2); ctx.fill();
      // Twin barrels
      var aaAngle = 0;
      var aaTar = gameState.getEnemiesInRange(e,e.range);
      if (aaTar.length>0) {
        aaAngle = Math.atan2(aaTar[0].getCenterY()/TILE_SIZE-e.y-e.size/2,
                             aaTar[0].getCenterX()/TILE_SIZE-e.x-e.size/2);
      }
      ctx.save();
      ctx.translate(ex+eS/2,ey2+eS/2);
      ctx.rotate(aaAngle);
      ctx.fillStyle = '#222';
      ctx.fillRect(0,-5,15,3);
      ctx.fillRect(0,2,15,3);
      ctx.restore();
      break;
    case 'tesla':
      ctx.fillStyle = td;
      ctx.fillRect(ex+3,ey2+3,eS-6,eS-6);
      ctx.fillStyle = '#5dade2';
      ctx.fillRect(ex+eS/2-4,ey2+4,8,eS/2-3);
      ctx.fillStyle = '#00bfff';
      ctx.beginPath(); ctx.arc(ex+eS/2,ey2+8,8,0,Math.PI*2); ctx.fill();
      if (e.built&&e.fireCooldown>e.fireRate-8) {
        ctx.strokeStyle = 'rgba(0,191,255,0.9)';
        ctx.lineWidth = 2;
        for (var li=0;li<4;li++) {
          ctx.beginPath(); ctx.moveTo(ex+eS/2,ey2+6);
          var lx2 = ex+eS/2+(Math.random()-0.5)*25;
          var ly2 = ey2+6-Math.random()*20;
          ctx.lineTo(lx2,ly2); ctx.stroke();
        }
      }
      break;
  }

  // Build progress
  if (!e.built) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(ex,ey2,eS,eS);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(ex+2,ey2+eS-7,(eS-4)*(e.buildProgress/100),5);
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
    ctx.strokeRect(ex+2,ey2+eS-7,eS-4,5);
    ctx.font = '10px Arial'; ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(e.buildProgress)+'%',ex+eS/2,ey2+eS/2+4);
    ctx.textAlign = 'left';
  }

  // Production progress
  if (e.producing) {
    var pb = e.produceProgress/100;
    ctx.fillStyle = 'rgba(46,204,113,0.9)';
    ctx.fillRect(ex+2,ey2-7,(eS-4)*pb,5);
    ctx.strokeStyle = 'rgba(46,204,113,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ex+2,ey2-7,eS-4,5);
    // Queue indicator
    if (e.productionQueue.length>0) {
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 10px Arial';
      ctx.fillText('+'+e.productionQueue.length,ex+eS-12,ey2-9);
    }
  }
}

// ===================== UNIT DRAW =====================
function drawUnit(e,ex,ey2,tc,td) {
  var ux = ex+TILE_SIZE/2, uy = ey2+TILE_SIZE/2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(ux,uy+8,10,4,0,0,Math.PI*2); ctx.fill();

  if (e.type2==='infantry') {
    var lo = Math.sin(e.animFrame*Math.PI/2)*3;
    ctx.fillStyle = tc;
    ctx.fillRect(ux-4,uy-7,8,10);
    ctx.fillStyle = '#c8a87a';
    ctx.beginPath(); ctx.arc(ux,uy-11,4.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = td;
    ctx.beginPath(); ctx.arc(ux,uy-12,5,Math.PI,0); ctx.fill();
    ctx.fillStyle = td;
    ctx.fillRect(ux-3,uy+3,3,6+lo);
    ctx.fillRect(ux,uy+3,3,6-lo);
    if (e.type==='rocket') {
      ctx.fillStyle = '#888'; ctx.fillRect(ux+4,uy-5,9,3);
      ctx.fillStyle = '#c0392b'; ctx.fillRect(ux+11,uy-7,3,7);
    } else if (e.type==='engineer') {
      ctx.fillStyle = '#f39c12'; ctx.fillRect(ux+4,uy-2,9,5);
      ctx.fillStyle = '#ccc'; ctx.fillRect(ux+11,uy-4,3,3);
      // Hard hat
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(ux,uy-13,4,Math.PI,0); ctx.fill();
    } else {
      ctx.fillStyle = '#333'; ctx.fillRect(ux+4,uy-3,9,2.5);
    }
  } else if (e.type2==='vehicle'||e.type2==='harvester') {
    var treadAnim = Math.sin(e.animFrame*Math.PI/2)*2;
    if (e.type==='tank'||e.type==='heavyTank') {
      var ts = e.type==='heavyTank'?14:11;
      ctx.fillStyle = '#222';
      ctx.fillRect(ux-ts,uy+1,ts*2,7);
      for (var ti=0;ti<6;ti++) {
        ctx.fillStyle = (ti%2===0)?'#3a3a3a':'#2a2a2a';
        ctx.fillRect(ux-ts+ti*(ts*2/6)+treadAnim,uy+2,ts*2/6-1,5);
      }
      ctx.fillStyle = td;
      ctx.fillRect(ux-ts+2,uy-4,ts*2-4,7);
      ctx.fillStyle = tc;
      ctx.beginPath(); ctx.arc(ux,uy-1,8,0,Math.PI*2); ctx.fill();
      ctx.save();
      ctx.translate(ux,uy-1);
      ctx.rotate(e.turretDir);
      ctx.fillStyle = '#222';
      ctx.fillRect(-1,-2,ts+4,4);
      ctx.restore();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(ux,uy-1,3.5,0,Math.PI*2); ctx.fill();
      if (e.type==='heavyTank') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(ux-ts+2,uy-8,ts*2-4,5);
      }
    } else if (e.type==='arty') {
      ctx.fillStyle = '#222'; ctx.fillRect(ux-11,uy+1,22,7);
      ctx.fillStyle = td; ctx.fillRect(ux-9,uy-5,18,8);
      ctx.fillStyle = tc; ctx.fillRect(ux-6,uy-7,12,5);
      ctx.fillStyle = '#222';
      ctx.save();
      ctx.translate(ux,uy-3);
      ctx.rotate(e.turretDir-0.3);
      ctx.fillRect(0,-2,20,4);
      ctx.restore();
    } else if (e.type==='mlrs') {
      ctx.fillStyle = '#222'; ctx.fillRect(ux-11,uy+1,22,7);
      ctx.fillStyle = td; ctx.fillRect(ux-10,uy-5,20,8);
      ctx.fillStyle = tc; ctx.fillRect(ux-8,uy-7,16,5);
      // Rocket pods
      ctx.fillStyle = '#1a1a1a';
      ctx.save();
      ctx.translate(ux,uy-3);
      ctx.rotate(e.turretDir);
      for (var rt=0;rt<3;rt++) {
        ctx.fillRect(2,rt*3-4,9,2);
      }
      ctx.restore();
    } else if (e.type2==='harvester') {
      ctx.fillStyle = '#333'; ctx.fillRect(ux-11,uy+1,22,7);
      ctx.fillStyle = td; ctx.fillRect(ux-11,uy-5,22,8);
      ctx.fillStyle = tc; ctx.fillRect(ux-9,uy-7,18,5);
      ctx.fillStyle = '#f1c40f'; ctx.fillRect(ux-15,uy-4,6,9);
      ctx.fillStyle = '#e67e22'; ctx.fillRect(ux-16,uy-2,4,5);
      if (e.ore>0) {
        var oh = Math.min(7,(e.ore/e.capacity)*7);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(ux-14,uy+8-oh,2,oh);
      }
    } else if (e.type==='apc') {
      ctx.fillStyle = '#222'; ctx.fillRect(ux-11,uy+1,22,7);
      ctx.fillStyle = td; ctx.fillRect(ux-10,uy-6,20,8);
      ctx.fillStyle = tc; ctx.fillRect(ux-8,uy-8,16,5);
      ctx.fillStyle = '#5d6d7e'; ctx.fillRect(ux+6,uy-4,7,3);
    }
  }

  // Muzzle flash
  if (e.muzzleFlash>0) {
    var mdir = e.turretDir;
    var mfDist = (e.type2==='vehicle')?16:12;
    var mfx = ux+Math.cos(mdir)*mfDist;
    var mfy = uy+Math.sin(mdir)*mfDist;
    ctx.fillStyle = 'rgba(255,220,50,0.95)';
    ctx.beginPath(); ctx.arc(mfx,mfy,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(mfx,mfy,3,0,Math.PI*2); ctx.fill();
  }

  // Movement waypoint indicator
  if (e.selected&&e.path.length>0&&e.pathIndex<e.path.length) {
    var lastWP = e.path[e.path.length-1];
    var wpX = (lastWP.x+0.5)*TILE_SIZE;
    var wpY = (lastWP.y+0.5)*TILE_SIZE;
    ctx.strokeStyle = 'rgba(46,204,113,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3,3]);
    ctx.beginPath();
    ctx.moveTo(ux,uy);
    ctx.lineTo(wpX,wpY);
    ctx.stroke();
    ctx.setLineDash([]);
    // X marker
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wpX-4,wpY-4); ctx.lineTo(wpX+4,wpY+4);
    ctx.moveTo(wpX+4,wpY-4); ctx.lineTo(wpX-4,wpY+4);
    ctx.stroke();
  }
}

// ===================== MINIMAP =====================
function renderMinimap() {
  var mw = minimapCanvas.width, mh = minimapCanvas.height;
  var sx = mw/MAP_WIDTH, sy = mh/MAP_HEIGHT;
  minimapCtx.fillStyle = '#060610';
  minimapCtx.fillRect(0,0,mw,mh);

  for (var my=0;my<MAP_HEIGHT;my+=1) {
    for (var mx=0;mx<MAP_WIDTH;mx+=1) {
      var t = gameState.map.terrain[my][mx];
      if (t===GRASS) minimapCtx.fillStyle = '#2d5a1e';
      else if (t===WATER) minimapCtx.fillStyle = '#1a5276';
      else if (t===ORE) minimapCtx.fillStyle = '#c9a800';
      else if (t===ROCK) minimapCtx.fillStyle = '#4a5568';
      else if (t===CONCRETE) minimapCtx.fillStyle = '#3d3d3d';
      else if (t===SAND) minimapCtx.fillStyle = '#9a7d0a';
      else if (t===TREE) minimapCtx.fillStyle = '#1e4a10';
      else continue;
      minimapCtx.fillRect(mx*sx,my*sy,sx+1,sy+1);
    }
  }
  for (var i=0;i<gameState.entities.length;i++) {
    var e = gameState.entities[i];
    if (e.dead) continue;
    minimapCtx.fillStyle = e.team===TEAM_PLAYER?'#4a9fd4':'#e74c3c';
    var emx = (e.x+(e.isBuilding?e.size/2:0.5))*sx;
    var emy = (e.y+(e.isBuilding?e.size/2:0.5))*sy;
    var ds = e.isBuilding?3:2;
    minimapCtx.fillRect(emx-ds/2,emy-ds/2,ds,ds);
  }
  // Minimap alerts
  for (var ai=0;ai<gameState.minimapAlerts.length;ai++) {
    var al = gameState.minimapAlerts[ai];
    var alpha = al.timer/al.maxTimer;
    var radius = (1-alpha)*15+3;
    minimapCtx.strokeStyle = al.color;
    minimapCtx.globalAlpha = alpha;
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    minimapCtx.arc(al.x*sx,al.y*sy,radius,0,Math.PI*2);
    minimapCtx.stroke();
    minimapCtx.globalAlpha = 1;
  }
  // Viewport rect
  minimapCtx.strokeStyle = 'rgba(255,255,255,0.7)';
  minimapCtx.lineWidth = 1;
  var vpX = camera.x/camera.zoom/TILE_SIZE*sx;
  var vpY = camera.y/camera.zoom/TILE_SIZE*sy;
  var vpW = (canvas.width-300)/camera.zoom/TILE_SIZE*sx;
  var vpH = canvas.height/camera.zoom/TILE_SIZE*sy;
  minimapCtx.strokeRect(vpX,vpY,vpW,vpH);
}

// ===================== UI =====================
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.build-tab').forEach(function(t){
    t.classList.toggle('active',t.getAttribute('data-tab')===tab);
  });
  updateBuildList();
}

function updateBuildList() {
  if (!gameState) return;
  var list = document.getElementById('buildList');
  var defs = currentTab==='buildings'?BUILDING_DEFS:(currentTab==='defenses'?DEFENSE_DEFS:UNIT_DEFS);
  // Clear & rebuild (DOM diff would be nicer but this is OK for small lists)
  list.innerHTML = '';
  Object.keys(defs).forEach(function(key){
    var def = defs[key];
    var canB = gameState.canBuild(key,TEAM_PLAYER);
    var item = document.createElement('div');
    var classes = 'build-item';
    if (!canB) classes += ' disabled';
    // Check production state
    if (def.category==='units') {
      var pb = findProducingBuilding(key,TEAM_PLAYER);
      if (pb && pb.producing===key) classes += ' active-build';
    }
    item.className = classes;

    var iconCanvas = document.createElement('canvas');
    iconCanvas.className = 'build-item-icon';
    iconCanvas.width = 44; iconCanvas.height = 44;
    drawBuildIcon(iconCanvas.getContext('2d'),key,def);

    var infoDiv = document.createElement('div');
    infoDiv.className = 'build-item-info';
    var nameDiv = document.createElement('div');
    nameDiv.className = 'build-item-name';
    nameDiv.textContent = def.name;
    var costDiv = document.createElement('div');
    costDiv.className = 'build-item-cost';
    var ct = '$'+def.cost;
    if (def.power) ct += '  +'+def.power+'⚡';
    if (def.powerUse) ct += '  -'+def.powerUse+'⚡';
    if (def.buildTime) ct += '  '+def.buildTime+'s';
    costDiv.textContent = ct;
    var descDiv = document.createElement('div');
    descDiv.className = 'build-item-desc';
    descDiv.textContent = def.desc;
    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(costDiv);
    infoDiv.appendChild(descDiv);

    item.appendChild(iconCanvas);
    item.appendChild(infoDiv);

    // Queue badge
    if (def.category==='units') {
      var pb2 = findProducingBuilding(key,TEAM_PLAYER);
      if (pb2&&pb2.producing===key) {
        var qb = document.createElement('div');
        qb.className = 'build-item-queue';
        qb.textContent = Math.floor(pb2.produceProgress)+'%';
        item.appendChild(qb);
      } else if (pb2&&pb2.productionQueue.indexOf(key)>=0) {
        var qb2 = document.createElement('div');
        qb2.className = 'build-item-queue';
        qb2.textContent = '×'+pb2.productionQueue.filter(function(k){return k===key;}).length;
        item.appendChild(qb2);
      }
    }

    if (canB) {
      item.addEventListener('click',(function(k){
        return function(){startBuild(k,TEAM_PLAYER); playSelectSound();};
      })(key));
    }
    list.appendChild(item);
  });
}

function drawBuildIcon(c,type,def) {
  c.fillStyle = '#0a0a14';
  c.fillRect(0,0,44,44);
  // Use entity drawing functions in mini form
  if (BUILDING_DEFS[type]||DEFENSE_DEFS[type]) {
    c.fillStyle = COLOR_PLAYER_DARK;
    c.fillRect(4,4,36,36);
    c.fillStyle = COLOR_PLAYER;
    c.fillRect(6,6,32,32);
    c.fillStyle = def.icon;
    c.fillRect(10,10,24,24);
    // Building-specific badge
    if (type==='powerPlant') {
      c.fillStyle = '#fff'; c.font = 'bold 16px Arial'; c.textAlign = 'center';
      c.fillText('⚡',22,28);
    } else if (type==='refinery') {
      c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.textAlign = 'center';
      c.fillText('$',22,28);
    } else if (type==='barracks') {
      c.fillStyle = '#fff'; c.font = 'bold 12px Arial'; c.textAlign = 'center';
      c.fillText('兵',22,27);
    } else if (type==='warFactory') {
      c.fillStyle = '#fff'; c.font = 'bold 12px Arial'; c.textAlign = 'center';
      c.fillText('车',22,27);
    } else if (type==='radar') {
      c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.textAlign = 'center';
      c.fillText('◉',22,28);
    } else if (type==='techCenter') {
      c.fillStyle = '#fff'; c.font = 'bold 12px Arial'; c.textAlign = 'center';
      c.fillText('科',22,27);
    } else if (type==='tesla') {
      c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.textAlign = 'center';
      c.fillText('⚡',22,28);
    }
  } else {
    // Unit icons
    c.fillStyle = '#1a2a3a';
    c.fillRect(4,4,36,36);
    c.fillStyle = def.icon;
    if (def.type==='infantry') {
      c.fillRect(18,12,8,12);
      c.beginPath(); c.arc(22,10,3,0,Math.PI*2); c.fill();
      c.fillRect(17,24,4,10);
      c.fillRect(23,24,4,10);
    } else if (def.type==='harvester') {
      c.fillRect(8,16,28,14);
      c.fillStyle = '#f1c40f'; c.fillRect(4,18,6,10);
    } else {
      // Vehicle generic
      c.fillRect(8,18,28,14);
      c.fillStyle = def.icon; c.beginPath(); c.arc(22,22,7,0,Math.PI*2); c.fill();
      c.fillStyle = '#222'; c.fillRect(22,20,12,4);
    }
  }
  c.textAlign = 'left';
}

function updateUI() {
  if (!gameState) return;
  document.getElementById('resCredits').textContent = Math.floor(gameState.playerCredits);
  var pwEl = document.getElementById('resPower');
  pwEl.textContent = gameState.playerPower+'/'+gameState.playerPowerUse;
  pwEl.className = 'res-value' + (gameState.playerPower<gameState.playerPowerUse?' danger':(gameState.playerPower<gameState.playerPowerUse+50?' warn':''));
  var uEl = document.getElementById('resUnits');
  uEl.textContent = gameState.playerUnitCount+'/'+gameState.playerUnitMax;
  uEl.className = 'res-value' + (gameState.playerUnitCount>=gameState.playerUnitMax?' warn':'');
  var el = Math.floor((Date.now()-gameStartTime)/1000);
  var mm = Math.floor(el/60), ss = el%60;
  document.getElementById('gameTime').textContent = (mm<10?'0':'')+mm+':'+(ss<10?'0':'')+ss;

  document.getElementById('minimapStats').textContent =
    '消灭: ' + gameState.stats.unitsKilled + '/' + gameState.stats.buildingsKilled + 'B';

  var info = document.getElementById('selectionInfo');
  if (selectedUnits.length===1) {
    var u = selectedUnits[0];
    info.innerHTML = '<b>'+u.name+'</b> HP:'+Math.ceil(u.hp)+'/'+u.maxHp+
      (u.damage>0?' ATK:'+u.damage+' 范围:'+u.range:'')+
      (u.type2==='harvester'?'<br>矿石:<b>'+u.ore+'/'+u.capacity+'</b>':'')+
      (u.veterancy>0?'<br>等级: '+'★'.repeat(u.veterancy):'')+
      (u.kills>0?' 击杀:'+u.kills:'');
  } else if (selectedUnits.length>1) {
    var counts = {};
    selectedUnits.forEach(function(u){counts[u.name]=(counts[u.name]||0)+1;});
    var summary = Object.keys(counts).map(function(k){return k+'×'+counts[k];}).join(' ');
    info.innerHTML = '<b>已选 '+selectedUnits.length+' 个</b><br><span style="font-size:10px">'+summary+'</span>';
  } else if (selectedBuilding) {
    var b = selectedBuilding;
    var bInfo = '<b>'+b.name+'</b> HP:'+Math.ceil(b.hp)+'/'+b.maxHp;
    if (b.producing) bInfo += '<br>生产: '+UNIT_DEFS[b.producing].name+' <span style="color:#2ecc71">'+Math.floor(b.produceProgress)+'%</span>';
    if (b.productionQueue&&b.productionQueue.length>0) bInfo += ' [队列:'+b.productionQueue.length+']';
    if (b.damage>0) bInfo += '<br>ATK:'+b.damage+' 范围:'+b.range;
    if (b.power) bInfo += '<br>发电:+'+b.power;
    if (b.rallyPoint) bInfo += '<br><span style="color:#888;font-size:10px">集合点已设置</span>';
    info.innerHTML = bInfo;
  } else {
    info.innerHTML = '<span class="info-hint">左键选择 · 右键移动/攻击 · 拖拽框选</span>';
  }

  document.getElementById('btnRepair').classList.toggle('disabled',gameState.getPlayerBuildings().length===0);
  document.getElementById('btnSell').classList.toggle('disabled',gameState.getPlayerBuildings().length===0);
  document.getElementById('btnStop').classList.toggle('disabled',selectedUnits.length===0);

  if (frameCount%20===0) updateBuildList();
}

function notify(text,kind) {
  notifTimer = 150;
  var el = document.getElementById('notification');
  el.textContent = text;
  el.className = kind==='warn'?'warn':(kind==='danger'?'danger':'');
  el.style.display = 'block';
}
function updateNotification() {
  if (notifTimer>0) {
    notifTimer--;
    if (notifTimer<=0) document.getElementById('notification').style.display = 'none';
  }
}

function checkGameOver() {
  if (gameState.gameOver) {
    gameRunning = false;
    var goEl = document.getElementById('gameOver');
    goEl.style.display = 'flex';
    var gt = document.getElementById('gameOverText'), gs = document.getElementById('gameOverSub');
    if (gameState.winner===TEAM_PLAYER) {
      gt.textContent = 'VICTORY'; gt.style.color = '#2ecc71';
      gs.textContent = '敌方基地已被摧毁！';
    } else {
      gt.textContent = 'DEFEATED'; gt.style.color = '#c0392b';
      gs.textContent = '你的基地被摧毁了';
    }
    // Stats
    var statsEl = document.getElementById('gameStats');
    var elapsed = Math.floor((Date.now()-gameStartTime)/1000);
    var mins = Math.floor(elapsed/60), secs = elapsed%60;
    statsEl.innerHTML =
      '<span class="label">游戏时长</span><span class="value">'+mins+':'+(secs<10?'0':'')+secs+'</span>'+
      '<span class="label">单位击杀</span><span class="value">'+gameState.stats.unitsKilled+'</span>'+
      '<span class="label">建筑摧毁</span><span class="value">'+gameState.stats.buildingsKilled+'</span>'+
      '<span class="label">单位损失</span><span class="value">'+gameState.stats.unitsLost+'</span>'+
      '<span class="label">建筑损失</span><span class="value">'+gameState.stats.buildingsLost+'</span>'+
      '<span class="label">矿石采集</span><span class="value">$'+gameState.stats.oreGathered+'</span>'+
      '<span class="label">难度</span><span class="value">'+difficulty.toUpperCase()+'</span>';
  }
}

// ===================== GROUP BAR =====================
function renderGroupBar() {
  var bar = document.getElementById('groupBar');
  bar.innerHTML = '';
  for (var i=1;i<=9;i++) {
    var slot = document.createElement('div');
    slot.className = 'group-slot';
    var count = (gameState.controlGroups[i]||[]).filter(function(id){
      var ent = findEntityById(id);
      return ent&&!ent.dead;
    }).length;
    slot.textContent = i;
    if (count>0) {
      slot.classList.add('active');
      var cb = document.createElement('div');
      cb.className = 'count';
      cb.textContent = count;
      slot.appendChild(cb);
    }
    slot.addEventListener('click',(function(n){return function(){selectGroup(n);};})(i));
    bar.appendChild(slot);
  }
}

function findEntityById(id) {
  for (var i=0;i<gameState.entities.length;i++) if (gameState.entities[i].id===id) return gameState.entities[i];
  return null;
}

function setGroup(n) {
  if (selectedUnits.length===0) return;
  gameState.controlGroups[n] = selectedUnits.map(function(u){return u.id;});
  notify('编队 '+n+' 已设置 ('+selectedUnits.length+'个单位)','info');
  renderGroupBar();
}

function selectGroup(n) {
  var ids = gameState.controlGroups[n];
  if (!ids||ids.length===0) return;
  selectedUnits.forEach(function(u){u.selected=false;});
  selectedUnits = [];
  if (selectedBuilding) { selectedBuilding.selected=false; selectedBuilding=null; }
  ids.forEach(function(id){
    var e = findEntityById(id);
    if (e&&!e.dead&&!e.isBuilding) { e.selected=true; selectedUnits.push(e); }
  });
  // Double-press: jump camera
  var now = Date.now();
  if (lastNumberKey===n&&now-lastNumberTime<400) {
    if (selectedUnits.length>0) {
      var cx = selectedUnits.reduce(function(s,u){return s+u.x;},0)/selectedUnits.length;
      var cy = selectedUnits.reduce(function(s,u){return s+u.y;},0)/selectedUnits.length;
      camera.x = cx*TILE_SIZE*camera.zoom-(canvas.width-300)/2;
      camera.y = cy*TILE_SIZE*camera.zoom-canvas.height/2;
      camera.x = Math.max(0,Math.min(MAP_WIDTH*TILE_SIZE*camera.zoom-(canvas.width-300),camera.x));
      camera.y = Math.max(0,Math.min(MAP_HEIGHT*TILE_SIZE*camera.zoom-canvas.height,camera.y));
    }
  }
  lastNumberKey = n; lastNumberTime = now;
  playSelectSound();
}

// ===================== INPUT =====================
function setupInput() {
  canvas.addEventListener('mousemove',function(ev){
    var rect = canvas.getBoundingClientRect();
    mouse.x = ev.clientX-rect.left;
    mouse.y = ev.clientY-rect.top;
    var viewW = canvas.width - 300;
    var viewH = canvas.height;
    mouse.inCanvas = (mouse.x >= 0 && mouse.x < viewW && mouse.y >= 0 && mouse.y < viewH);
    var clampedX = Math.max(0, Math.min(viewW, mouse.x));
    var clampedY = Math.max(0, Math.min(viewH, mouse.y));
    mouse.worldX = (clampedX + camera.x) / camera.zoom;
    mouse.worldY = (clampedY + camera.y) / camera.zoom;
    mouse.mapX = Math.max(0,Math.min(MAP_WIDTH-1,Math.floor(mouse.worldX/TILE_SIZE)));
    mouse.mapY = Math.max(0,Math.min(MAP_HEIGHT-1,Math.floor(mouse.worldY/TILE_SIZE)));
    if (dragSelect.active) { dragSelect.endX = mouse.x; dragSelect.endY = mouse.y; }
  });

  canvas.addEventListener('mousedown',function(ev){
    if (ev.button===0) {
      // Action modes
      if (activeAction==='repair') {
        var clk = gameState.getEntityAt(mouse.worldX,mouse.worldY);
        if (clk&&clk.team===TEAM_PLAYER&&clk.isBuilding&&!clk.dead) repairBuilding(clk);
        return;
      }
      if (activeAction==='sell') {
        var clk2 = gameState.getEntityAt(mouse.worldX,mouse.worldY);
        if (clk2&&clk2.team===TEAM_PLAYER&&clk2.isBuilding&&!clk2.dead) sellBuilding(clk2);
        return;
      }
      // Placement
  if (placingBuilding&&placingType&&mouse.inCanvas) {
        var pDef = BUILDING_DEFS[placingType]||DEFENSE_DEFS[placingType];
        if (pDef&&gameState.map.isBuildable(mouse.mapX,mouse.mapY,pDef.size)&&
            gameState.map.isNearBuilding(mouse.mapX,mouse.mapY,pDef.size,TEAM_PLAYER)) {
          gameState.playerCredits -= pDef.cost;
          var nb = gameState.spawnEntity(placingType,TEAM_PLAYER,mouse.mapX,mouse.mapY);
          for (var ci=0;ci<nb.size;ci++) for (var cj=0;cj<nb.size;cj++) {
            if (mouse.mapY+ci<MAP_HEIGHT&&mouse.mapX+cj<MAP_WIDTH) gameState.map.terrain[mouse.mapY+ci][mouse.mapX+cj] = CONCRETE;
          }
          if (!ev.shiftKey) { placingBuilding=false; placingType=null; }
          notify(pDef.name+' 开始建造','info');
          playBuildSound();
        } else { notify('无法在此处建造','warn'); playCancelSound(); }
        return;
      }
      // Attack-move: if pending, treat left click as attack-move target
      if (pendingAttackMove && selectedUnits.length > 0 && mouse.inCanvas) {
        var amTarget = gameState.getEntityAt(mouse.worldX, mouse.worldY);
        if (amTarget && amTarget.team !== TEAM_PLAYER && !amTarget.dead) {
          selectedUnits.forEach(function(u){
            u.attackTarget = amTarget; u.path = []; u.pathIndex = 0;
            u.attackMoveTarget = null; u.guardPos = null;
          });
          gameState.addFloatingText(amTarget.getCenterX(), amTarget.getCenterY()-15, '攻击!', '#e74c3c');
        } else {
          var amx = mouse.mapX, amy = mouse.mapY;
          selectedUnits.forEach(function(u){
            u.attackTarget = null;
            u.attackMoveTarget = {x: amx, y: amy};
            u.guardPos = null;
            u.path = gameState.map.findPath(Math.floor(u.x), Math.floor(u.y), amx, amy);
            u.pathIndex = 0;
          });
          gameState.addFloatingText(mouse.worldX, mouse.worldY, 'A→', '#e67e22');
        }
        pendingAttackMove = false;
        return;
      }
      // Start drag-select
      dragSelect.active = true;
      dragSelect.startX = mouse.x; dragSelect.startY = mouse.y;
      dragSelect.endX = mouse.x; dragSelect.endY = mouse.y;
    }
  });

  canvas.addEventListener('mouseup',function(ev){
    if (ev.button===0&&dragSelect.active) {
      var dx = Math.abs(dragSelect.endX-dragSelect.startX);
      var dy = Math.abs(dragSelect.endY-dragSelect.startY);
      if (dx>8||dy>8) {
        var wx1 = (Math.min(dragSelect.startX,dragSelect.endX)+camera.x)/camera.zoom;
        var wy1 = (Math.min(dragSelect.startY,dragSelect.endY)+camera.y)/camera.zoom;
        var wx2 = (Math.max(dragSelect.startX,dragSelect.endX)+camera.x)/camera.zoom;
        var wy2 = (Math.max(dragSelect.startY,dragSelect.endY)+camera.y)/camera.zoom;
        if (!ev.shiftKey) {
          selectedUnits.forEach(function(u){u.selected=false;});
          selectedUnits = [];
          if (selectedBuilding) { selectedBuilding.selected=false; selectedBuilding=null; }
        }
        var bu = gameState.getEntitiesInRect(wx1,wy1,wx2,wy2);
        bu.forEach(function(u){
          if (selectedUnits.indexOf(u)<0) { u.selected=true; selectedUnits.push(u); }
        });
        if (bu.length>0) playSelectSound();
      } else {
        // Click select
        var clicked = gameState.getEntityAt(mouse.worldX,mouse.worldY);
        if (clicked&&clicked.team===TEAM_PLAYER&&!clicked.dead) {
          if (clicked.isBuilding) {
            selectedUnits.forEach(function(u){u.selected=false;});
            selectedUnits = [];
            if (selectedBuilding) selectedBuilding.selected = false;
            selectedBuilding = clicked; clicked.selected = true;
          } else {
            if (ev.shiftKey) {
              if (selectedUnits.indexOf(clicked)>=0) {
                clicked.selected = false;
                selectedUnits = selectedUnits.filter(function(u){return u!==clicked;});
              } else { clicked.selected = true; selectedUnits.push(clicked); }
            } else {
              selectedUnits.forEach(function(u){u.selected=false;});
              selectedUnits = [];
              if (selectedBuilding) { selectedBuilding.selected=false; selectedBuilding=null; }
              clicked.selected = true; selectedUnits.push(clicked);
            }
          }
          playSelectSound();
        } else if (ev.shiftKey) {
          // Double-click on same unit type selects all
          var dbl = gameState.getEntityAt(mouse.worldX,mouse.worldY);
          if (!dbl) {
            // Clear if not shift
            if (!ev.shiftKey) {
              selectedUnits.forEach(function(u){u.selected=false;});
              selectedUnits = [];
              if (selectedBuilding) { selectedBuilding.selected=false; selectedBuilding=null; }
            }
          }
        } else if (!clicked) {
          selectedUnits.forEach(function(u){u.selected=false;});
          selectedUnits = [];
          if (selectedBuilding) { selectedBuilding.selected=false; selectedBuilding=null; }
        }
      }
      dragSelect.active = false;
    }
  });

  canvas.addEventListener('contextmenu',function(ev){
    ev.preventDefault();
    pendingAttackMove = false;
    if (placingBuilding) { placingBuilding=false; placingType=null; playCancelSound(); return; }
    if (activeAction) { activeAction = null;
      document.getElementById('btnRepair').classList.remove('active');
      document.getElementById('btnSell').classList.remove('active');
      return;
    }
    var rc = gameState.getEntityAt(mouse.worldX,mouse.worldY);
    if (selectedUnits.length>0) {
      if (rc&&rc.team!==TEAM_PLAYER&&!rc.dead) {
        // Attack
        selectedUnits.forEach(function(u){
          u.attackTarget = rc; u.path = []; u.pathIndex = 0;
          u.attackMoveTarget = null; u.guardPos = null;
        });
        gameState.addFloatingText(rc.getCenterX(),rc.getCenterY()-15,'目标!','#e74c3c');
        notify('攻击 '+rc.name,'info');
      } else if (rc&&rc.team===TEAM_PLAYER&&rc.isBuilding&&!rc.dead) {
        // Engineer: repair, others: guard near building
        selectedUnits.forEach(function(u){
          if (u.canRepair) { u.attackTarget = rc; u.path = []; u.pathIndex = 0; }
          else u.guardPos = {x:Math.floor(rc.x),y:Math.floor(rc.y)};
        });
        notify('护卫 '+rc.name,'info');
      } else {
        // Move - spread formation
        var cx = mouse.mapX, cy = mouse.mapY;
        var spread = Math.ceil(Math.sqrt(selectedUnits.length));
        selectedUnits.forEach(function(u,idx){
          var ox = idx%spread-Math.floor(spread/2);
          var oy = Math.floor(idx/spread)-Math.floor(spread/2);
          var tx2 = Math.max(0,Math.min(MAP_WIDTH-1,cx+ox));
          var ty2 = Math.max(0,Math.min(MAP_HEIGHT-1,cy+oy));
          u.attackTarget = null;
          u.attackMoveTarget = null;
          u.guardPos = null;
          u.burstRemaining = 0;
          u.path = gameState.map.findPath(Math.floor(u.x),Math.floor(u.y),tx2,ty2);
          u.pathIndex = 0;
        });
        gameState.addFloatingText(mouse.worldX,mouse.worldY,'→','#2ecc71');
      }
    }
    if (selectedBuilding&&selectedBuilding.isBuilding) {
      if (rc&&rc.team!==TEAM_PLAYER&&!rc.dead) {
        selectedBuilding.rallyPoint = {x:Math.floor(rc.x),y:Math.floor(rc.y)};
        notify('集合点 → '+rc.name,'info');
      } else {
        selectedBuilding.rallyPoint = {x:mouse.mapX,y:mouse.mapY};
        notify('集合点已设置','info');
      }
    }
  });

  document.addEventListener('keydown',function(ev){
    keys[ev.code] = true;
    if (ev.target.tagName==='INPUT'||ev.target.tagName==='TEXTAREA') return;

    if (ev.code==='Escape') {
      if (placingBuilding) { placingBuilding=false; placingType=null; }
      else if (activeAction) {
        activeAction = null;
        document.getElementById('btnRepair').classList.remove('active');
        document.getElementById('btnSell').classList.remove('active');
      } else {
        selectedUnits.forEach(function(u){u.selected=false;});
        selectedUnits = [];
        if (selectedBuilding) { selectedBuilding.selected=false; selectedBuilding=null; }
        hideHelp();
      }
    }
    if (ev.code==='Delete'||ev.code==='Backspace') {
      if (selectedUnits.length>0) {
        selectedUnits.forEach(function(u){
          u.selected = false;
          gameState.removeEntity(u);
        });
        selectedUnits = [];
        notify('已删除选中单位','info');
      }
    }
    if (ev.code==='Space') { ev.preventDefault(); togglePause(); }
    if (ev.code==='KeyH'&&!ev.ctrlKey) { ev.preventDefault(); showHelp(); }
    if (ev.code==='KeyS'&&!ev.ctrlKey&&selectedUnits.length>0) { ev.preventDefault(); commandStop(); }
    if (ev.code==='KeyA'&&!ev.ctrlKey&&selectedUnits.length>0) {
      ev.preventDefault();
      notify('攻击模式：移动并攻击沿途敌人','info');
      // Wait for next click
      pendingAttackMove = true;
    }
    if (ev.code==='KeyG'&&selectedUnits.length>0) {
      ev.preventDefault();
      selectedUnits.forEach(function(u){
        u.guardPos = {x:Math.floor(u.x),y:Math.floor(u.y)};
        u.path = []; u.pathIndex = 0; u.attackTarget = null;
      });
      notify('守卫当前位置','info');
    }
    if (ev.code==='KeyA'&&ev.ctrlKey) {
      ev.preventDefault();
      selectedUnits.forEach(function(u){u.selected=false;});
      selectedUnits = gameState.getPlayerUnits();
      selectedUnits.forEach(function(u){u.selected=true;});
      if (selectedBuilding) { selectedBuilding.selected=false; selectedBuilding=null; }
      playSelectSound();
    }
    if (ev.code==='Home'||ev.code==='Numpad5') {
      var base = gameState.entities.find(function(e){return e.team===TEAM_PLAYER&&e.type==='base';});
      if (base) {
        camera.x = base.x*TILE_SIZE*camera.zoom-(canvas.width-300)/2;
        camera.y = base.y*TILE_SIZE*camera.zoom-canvas.height/2;
        camera.x = Math.max(0,camera.x); camera.y = Math.max(0,camera.y);
      }
    }
    // Control groups
    var keyMatch = ev.code.match(/^Digit([1-9])$/);
    if (keyMatch) {
      ev.preventDefault();
      var n = parseInt(keyMatch[1]);
      if (ev.ctrlKey) setGroup(n);
      else selectGroup(n);
    }
    if (ev.code==='Tab') {
      ev.preventDefault();
      var tabs = ['buildings','units','defenses'];
      var idx = tabs.indexOf(currentTab);
      switchTab(tabs[(idx+1)%tabs.length]);
    }
    if (ev.code==='F5') { ev.preventDefault(); saveGame(); }
    if (ev.code==='F9') { ev.preventDefault(); loadGame(); }
  });

  document.addEventListener('keyup',function(ev){
    keys[ev.code] = false;
  });

  canvas.addEventListener('wheel',function(ev){
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) {
      var oldZoom = camera.zoom;
      if (ev.deltaY < 0) camera.zoom = Math.min(2.0, camera.zoom + 0.1);
      else camera.zoom = Math.max(0.5, camera.zoom - 0.1);
      var zoomRatio = camera.zoom / oldZoom;
      var viewW = canvas.width - 300;
      var cx = mouse.x + camera.x / oldZoom;
      camera.x = camera.x * zoomRatio + (mouse.x - viewW/2) * (1 - zoomRatio);
      camera.y = camera.y * zoomRatio + (mouse.y - canvas.height/2) * (1 - zoomRatio);
    } else if (ev.shiftKey) {
      camera.x += ev.deltaY*0.5;
    } else {
      camera.y += ev.deltaY*0.5;
    }
    var maxX = MAP_WIDTH*TILE_SIZE*camera.zoom-(canvas.width-300);
    var maxY = MAP_HEIGHT*TILE_SIZE*camera.zoom-canvas.height;
    camera.x = Math.max(0,Math.min(maxX,camera.x));
    camera.y = Math.max(0,Math.min(maxY,camera.y));
  },{passive:false});

  minimapCanvas.addEventListener('mousedown',function(ev){
    var rect = minimapCanvas.getBoundingClientRect();
    var mx = ev.clientX-rect.left, my = ev.clientY-rect.top;
    var sxR = minimapCanvas.width/MAP_WIDTH, syR = minimapCanvas.height/MAP_HEIGHT;
    if (ev.button===2&&selectedUnits.length>0) {
      // Right click on minimap: move/attack
      ev.preventDefault();
      var tmx = mx/sxR, tmy = my/syR;
      selectedUnits.forEach(function(u,idx){
        var spread = Math.ceil(Math.sqrt(selectedUnits.length));
        var ox = idx%spread-Math.floor(spread/2);
        var oy = Math.floor(idx/spread)-Math.floor(spread/2);
        u.attackTarget = null;
        u.path = gameState.map.findPath(Math.floor(u.x),Math.floor(u.y),
          Math.max(0,Math.min(MAP_WIDTH-1,Math.floor(tmx)+ox)),
          Math.max(0,Math.min(MAP_HEIGHT-1,Math.floor(tmy)+oy)));
        u.pathIndex = 0;
      });
    } else {
      camera.x = Math.floor(mx/sxR*TILE_SIZE*camera.zoom-(canvas.width-300)/2);
      camera.y = Math.floor(my/syR*TILE_SIZE*camera.zoom-canvas.height/2);
      camera.x = Math.max(0,Math.min(MAP_WIDTH*TILE_SIZE*camera.zoom-(canvas.width-300),camera.x));
      camera.y = Math.max(0,Math.min(MAP_HEIGHT*TILE_SIZE*camera.zoom-canvas.height,camera.y));
    }
  });
  minimapCanvas.addEventListener('contextmenu',function(ev){ev.preventDefault();});

  window.addEventListener('resize',function(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  canvas.addEventListener('mouseleave',function(){
    mouse.inCanvas = false;
  });
}
var pendingAttackMove = false;

// ===================== SAVE / LOAD =====================
function saveGame() {
  if (!gameState || !gameRunning) { notify('无法存档：游戏未运行','warn'); return; }
  try {
    var entityData = gameState.entities.filter(function(e){return !e.dead;}).map(function(e){
      var obj = {};
      var keys = ['id','type','team','x','y','hp','maxHp','size','name','isBuilding','category',
        'damage','range','fireRate','fireCooldown','speed','type2','antiArmor','canRepair',
        'canCapture','splashRadius','burstCount','burstRemaining','direction','turretDir',
        'animFrame','built','buildProgress','buildTime','producing','produceProgress',
        'ore','capacity','harvestTarget','returningToRefinery','rallyPoint','selected',
        'attackMoveTarget','guardPos','power','powerUse','requires','cost','icon','desc',
        'veterancy','kills','productionQueue'];
      for (var i=0;i<keys.length;i++) {
        var k = keys[i];
        if (e[k] !== undefined) {
          if (k === 'harvestTarget' && e[k]) obj[k] = {x:e[k].x, y:e[k].y};
          else if (k === 'rallyPoint' && e[k]) obj[k] = {x:e[k].x, y:e[k].y};
          else if (k === 'attackMoveTarget' && e[k]) obj[k] = {x:e[k].x, y:e[k].y};
          else if (k === 'guardPos' && e[k]) obj[k] = {x:e[k].x, y:e[k].y};
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
      camera: {x:camera.x, y:camera.y, zoom:camera.zoom},
      difficulty: difficulty,
      frameCount: frameCount,
      enemyAttackWave: enemyAttackWave,
      version: 1
    };
    localStorage.setItem('redAlertSave', JSON.stringify(saveObj));
    notify('游戏已存档','info');
    playBuildSound();
  } catch(e) {
    notify('存档失败: '+e.message,'danger');
  }
}

function loadGame() {
  try {
    var data = localStorage.getItem('redAlertSave');
    if (!data) { notify('没有存档','warn'); return; }
    var save = JSON.parse(data);
    if (!save || !save.entities || !save.map) { notify('存档数据损坏','warn'); return; }

    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    minimapCanvas = document.getElementById('minimapCanvas');
    minimapCtx = minimapCanvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    minimapCanvas.width = 300; minimapCanvas.height = 200;

    Entity.counter = 0;
    gameState = new GameState();
    gameState.map.terrain = save.map.terrain;
    gameState.map.oreAmount = save.map.oreAmount;
    gameState.map.occupancy = [];
    for (var i=0;i<MAP_HEIGHT;i++) {
      gameState.map.occupancy[i] = [];
      for (var j=0;j<MAP_WIDTH;j++) gameState.map.occupancy[i][j] = null;
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
    for (var ei=0;ei<save.entities.length;ei++) {
      var ed = save.entities[ei];
      var e = new Entity(ed.type, ed.team, ed.x, ed.y);
      var ekeys = ['hp','maxHp','size','name','isBuilding','category','damage','range',
        'fireRate','fireCooldown','speed','type2','antiArmor','canRepair','canCapture',
        'splashRadius','burstCount','burstRemaining','direction','turretDir','animFrame',
        'built','buildProgress','buildTime','producing','produceProgress','ore','capacity',
        'returningToRefinery','selected','power','powerUse','cost','icon','desc',
        'veterancy','kills'];
      for (var ki=0;ki<ekeys.length;ki++) {
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
    for (var ai=0;ai<gameState.entities.length;ai++) {
      var ae = gameState.entities[ai];
      var aed = save.entities[ai];
      if (aed.attackTarget && entityMap[aed.attackTarget]) ae.attackTarget = entityMap[aed.attackTarget];
      if (aed.burstTarget && entityMap[aed.burstTarget]) ae.burstTarget = entityMap[aed.burstTarget];
    }

    camera.x = save.camera.x; camera.y = save.camera.y; camera.zoom = save.camera.zoom || 1;
    difficulty = save.difficulty;
    frameCount = save.frameCount;
    enemyAttackWave = save.enemyAttackWave || 0;
    gameStartTime = Date.now() - frameCount * (1000/60);
    selectedUnits = []; selectedBuilding = null;
    placingBuilding = false; placingType = null;
    enemyAITimer = 0; enemyBuildQueue = []; enemyAttackTimer = 0;
    enemyScoutTimer = 0; notifTimer = 0; currentTab = 'buildings';
    gameRunning = true; gamePaused = false; gameSpeed = 1;
    dragSelect = {active:false,startX:0,startY:0,endX:0,endY:0};
    activeAction = null; pendingAttackMove = false;

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    renderGroupBar();
    setupInput();
    updateBuildList();
    notify('游戏已读档','info');
    playBuildSound();
    gameLoop();
  } catch(e) {
    notify('读档失败: '+e.message,'danger');
  }
}

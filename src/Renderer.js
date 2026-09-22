import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, GRASS, WATER, ORE, ROCK, CONCRETE, SAND, TREE,
         TEAM_PLAYER, TEAM_ENEMY, COLOR_PLAYER, COLOR_PLAYER_DARK, COLOR_ENEMY, COLOR_ENEMY_DARK,
         COLOR_ALLIED, COLOR_ALLIED_DARK, COLOR_SOVIET, COLOR_SOVIET_DARK, TYPE_AIRCRAFT, TYPE_HELICOPTER, TYPE_AIRSHIP } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS, SUPER_WEAPONS, FACTION_ALLIED, FACTION_SOVIET } from './definitions.js';
import { drawBuilding as drawBuildingSprite, drawUnit as drawUnitSprite } from './Sprites.js';

// 水纹动画的相位量化档数。原实现每格每帧程序化绘制（1 底色 + 3 波纹 + 2 次 sin），
// 预渲染为 64 张相位图后每格只需 1 次取模 + 1 次 drawImage。
// 64 档 / 2.6s 周期 ≈ 25 步/秒，缓慢水纹的跳变肉眼不可辨。
const WATER_PHASES = 64;
// 矿石晶体数上界（与 render 中 crystals 计算一致：1 + floor(oreAmt/100)，封顶 6）
const ORE_MAX_CRYSTALS = 6;

export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.ctx = canvas.getContext('2d');
    this.minimapCtx = minimapCanvas.getContext('2d');
    this.canvas = canvas;
    this.minimapCanvas = minimapCanvas;
    this.tileCache = [];
    this.waterCache = [];   // [phaseIdx] → 预渲染水格（含波纹）
    this.oreCache = [];     // [crystals][variant] → 预渲染晶体层（透明底，alpha 由 globalAlpha 控制）
    this.minimapTerrainCanvas = null;
    this.minimapTerrainDirty = true;
  }

  getSortedEntities(gameState) {
    // 单位每帧都在移动，y 序必须每帧重排，否则重叠绘制顺序错乱。
    // 这里刻意保留 slice()：实测「复用成员数组 + 手动复制」比 slice() 慢约 4%
    //（V8 的 slice 是紧凑数组的快速拷贝），且本项每帧仅约 6µs，不值得改复杂。
    return gameState.entities.slice().sort(function(a, b) {
      return (a.y + (a.isBuilding ? a.size : 1)) - (b.y + (b.isBuilding ? b.size : 1));
    });
  }

  getTileCanvas(type, tx, ty) {
    var variant = (tx * 7 + ty * 13) % 4;
    // 地形类型是 0~6 的枚举，用二维数组直接索引。
    // 原来每格每帧拼接 'type_variant' 字符串做 key，全图铺满时每帧产生数千次字符串分配
    var byType = this.tileCache[type];
    if (!byType) byType = this.tileCache[type] = [];
    var cached = byType[variant];
    if (cached) return cached;
    var tc = document.createElement('canvas');
    tc.width = TILE_SIZE; tc.height = TILE_SIZE;
    this.drawTileToCtx(tc.getContext('2d'), type, variant);
    byType[variant] = tc;
    return tc;
  }

  /**
   * 预渲染水格：把波纹动画按相位量化成 WATER_PHASES 张图。
   * 相位 = frameCount*0.04 + tx*0.7 + ty*0.5，逐格天然错相，量化档只按相位索引即可保留错相效果。
   * 第三条波纹原为独立相位（0.03 频率、只含 tx），现绑到主相位（×0.75 保持频率比）——
   * 装饰性水纹，同步与否肉眼不可辨。
   */
  _getWaterCanvas(phaseIdx) {
    var c = this.waterCache[phaseIdx];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = TILE_SIZE; c.height = TILE_SIZE;
    var tctx = c.getContext('2d');
    var s = TILE_SIZE;
    var phase = phaseIdx / WATER_PHASES * Math.PI * 2;
    var woff = Math.sin(phase) * 2;
    tctx.fillStyle = '#1a5276'; tctx.fillRect(0, 0, s, s);
    tctx.fillStyle = 'rgba(52,152,219,0.3)';
    tctx.fillRect(0, 10 + woff, s, 3);
    tctx.fillRect(5, 22 - woff, s - 10, 3);
    tctx.fillStyle = 'rgba(120,200,255,0.18)';
    tctx.fillRect(Math.sin(phase * 0.75) * 3, 2, s - 8, 2);
    this.waterCache[phaseIdx] = c;
    return c;
  }

  /**
   * 预渲染矿石晶体层（透明底）。晶体布局按 variant（4 循环）固化——原实现用完整 tx/ty
   * 生成伪随机布局，但本来就是装饰性晶体，4 循环重复与原纹理变体的重复节奏一致，看不出差异。
   * 呼吸明暗（pulse）不改图、用渲染时的 globalAlpha 缩放实现，因此每种晶体数只需 4 张图。
   */
  _getOreCrystalCanvas(crystals, variant) {
    var byCount = this.oreCache[crystals];
    if (!byCount) byCount = this.oreCache[crystals] = [];
    var c = byCount[variant];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = TILE_SIZE; c.height = TILE_SIZE;
    var tctx = c.getContext('2d');
    for (var ci = 0; ci < crystals; ci++) {
      var crx = 4 + ((ci * 7 + variant * 3) % 22);
      var cry = 4 + ((ci * 11 + variant * 5) % 22);
      tctx.fillStyle = 'rgb(241,196,15)';
      tctx.beginPath();
      tctx.moveTo(crx, cry - 5); tctx.lineTo(crx + 4, cry); tctx.lineTo(crx, cry + 5); tctx.lineTo(crx - 4, cry);
      tctx.closePath(); tctx.fill();
      tctx.fillStyle = 'rgba(255,220,50,0.65)';
      tctx.beginPath();
      tctx.moveTo(crx, cry - 2); tctx.lineTo(crx + 2, cry); tctx.lineTo(crx, cry + 2); tctx.lineTo(crx - 2, cry);
      tctx.closePath(); tctx.fill();
    }
    byCount[variant] = c;
    return c;
  }

  drawTileToCtx(tctx, type, variant) {
    var s = TILE_SIZE;
    if (type === GRASS) {
      var bc = ['#2d5a1e', '#3a6b2a', '#2a5520', '#326020'];
      tctx.fillStyle = bc[variant]; tctx.fillRect(0, 0, s, s);
      tctx.fillStyle = 'rgba(60,120,40,0.35)';
      if (variant % 3 === 0) { tctx.fillRect(14, 8, 2, 5); tctx.fillRect(15, 6, 2, 4); }
      if (variant % 2 === 0) {
        tctx.fillStyle = 'rgba(30,80,15,0.3)';
        tctx.beginPath(); tctx.arc(s - 14, s - 14, 3, 0, Math.PI * 2); tctx.fill();
      }
      tctx.fillStyle = 'rgba(0,0,0,0.05)';
      tctx.fillRect(0, s - 1, s, 1);
    } else if (type === SAND) {
      var sc = ['#b8960c', '#c9a21a', '#b5911a', '#c2a015'];
      tctx.fillStyle = sc[variant]; tctx.fillRect(0, 0, s, s);
      tctx.fillStyle = 'rgba(200,170,40,0.4)';
      for (var si = 0; si < 4; si++) tctx.fillRect(si * 7 + 2, si * 6 + 4, 3, 2);
    } else if (type === ROCK) {
      tctx.fillStyle = '#4a5568'; tctx.fillRect(0, 0, s, s);
      tctx.fillStyle = '#6b7a8d'; tctx.fillRect(3, 3, s - 6, s - 6);
      tctx.fillStyle = '#8a9ab0'; tctx.fillRect(7, 5, 8, 5); tctx.fillRect(17, 14, 9, 4);
      tctx.fillStyle = 'rgba(0,0,0,0.25)'; tctx.fillRect(s - 5, 3, 5, s - 3); tctx.fillRect(3, s - 5, s - 8, 5);
    } else if (type === CONCRETE) {
      tctx.fillStyle = '#3d3d3d'; tctx.fillRect(0, 0, s, s);
      tctx.fillStyle = '#484848'; tctx.fillRect(1, 1, s - 2, s - 2);
      tctx.strokeStyle = '#2a2a2a'; tctx.lineWidth = 0.5;
      tctx.strokeRect(0.5, 0.5, s - 1, s - 1);
      tctx.fillStyle = 'rgba(255,255,255,0.04)'; tctx.fillRect(1, 1, s / 2 - 1, s / 2 - 1);
    } else if (type === TREE) {
      tctx.fillStyle = '#2d5a1e'; tctx.fillRect(0, 0, s, s);
      tctx.fillStyle = '#5d4037';
      tctx.fillRect(s / 2 - 2, s - 12, 4, 8);
      tctx.fillStyle = '#1e4a10';
      tctx.beginPath(); tctx.arc(s / 2, s / 2 - 2, 9, 0, Math.PI * 2); tctx.fill();
      tctx.fillStyle = '#2d5e1e';
      tctx.beginPath(); tctx.arc(s / 2 - 3, s / 2 - 4, 6, 0, Math.PI * 2); tctx.fill();
      tctx.fillStyle = '#3d6e2e';
      tctx.beginPath(); tctx.arc(s / 2 + 3, s / 2 - 5, 5, 0, Math.PI * 2); tctx.fill();
    }
  }

  render(gameState, camera, frameCount, selectedUnits, selectedBuilding, placingBuilding, placingType, mouse, dragSelect, activeAction, superWeaponTargeting, gamePaused, viewWidth, viewHeight) {
    var ctx = this.ctx;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    var zoom = camera.zoom;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, viewWidth, viewHeight);
    ctx.clip();
    ctx.scale(zoom, zoom);
    ctx.translate(-camera.x / zoom, -camera.y / zoom);
    var startTX = Math.max(0, Math.floor(camera.x / zoom / TILE_SIZE));
    var startTY = Math.max(0, Math.floor(camera.y / zoom / TILE_SIZE));
    var endTX = Math.min(MAP_WIDTH, Math.ceil((camera.x / zoom + viewWidth / zoom) / TILE_SIZE) + 1);
    var endTY = Math.min(MAP_HEIGHT, Math.ceil((camera.y / zoom + viewHeight / zoom) / TILE_SIZE) + 1);
    // 视口剔除边界（世界坐标），一次算好给抛射物/爆炸/飘字复用。
    // 原来只有烟雾做了剔除，这三类屏幕外对象照样走完整绘制路径
    var cullL = camera.x / zoom, cullT = camera.y / zoom;
    var cullR = cullL + viewWidth / zoom, cullB = cullT + viewHeight / zoom;

    // Terrain with fog of war
    for (var ty = startTY; ty < endTY; ty++) {
      for (var tx = startTX; tx < endTX; tx++) {
        var sx = tx * TILE_SIZE;
        var sy = ty * TILE_SIZE;
        
        // 战争迷雾：未探索区域不渲染地形
        if (gameState.fogOfWar && !gameState.fogOfWar.isExplored(tx, ty)) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          continue;
        }
        
        var terrain = gameState.map.terrain[ty][tx];
        if (terrain === ORE) {
          // 矿石：不透明底色 + 预渲染晶体层（globalAlpha 实现呼吸脉冲）。
          // 原实现每格每帧画 6 个双层菱形（约 14 次 canvas 调用），现降为 1 fillRect + 1 drawImage
          ctx.fillStyle = '#2d5a1e'; ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          var oreAmt = gameState.map.oreAmount[ty][tx];
          var crystals = Math.min(ORE_MAX_CRYSTALS, Math.floor(oreAmt / 100) + 1);
          var pulse = 0.85 + Math.sin(frameCount * 0.08 + tx + ty) * 0.15;
          ctx.globalAlpha = pulse;
          ctx.drawImage(this._getOreCrystalCanvas(crystals, (tx * 7 + ty * 13) % 4), sx, sy);
          ctx.globalAlpha = 1;
        } else if (terrain === WATER) {
          // 水面：按相位选预渲染帧。phase 含 tx/ty 项，逐格天然错相
          var wPhase = (frameCount * 0.04 + tx * 0.7 + ty * 0.5) % (Math.PI * 2);
          if (wPhase < 0) wPhase += Math.PI * 2;
          ctx.drawImage(this._getWaterCanvas(Math.min(WATER_PHASES - 1, Math.floor(wPhase / (Math.PI * 2) * WATER_PHASES))), sx, sy);
        } else {
          ctx.drawImage(this.getTileCanvas(terrain, tx, ty), sx, sy);
        }
      }
    }

    // Entities sorted by y for proper overlap (cached)
    var sortedE = this.getSortedEntities(gameState);
    for (var ei = 0; ei < sortedE.length; ei++) {
      var e = sortedE[ei];
      var ex = e.x * TILE_SIZE;
      var ey2 = e.y * TILE_SIZE;
      var eS = e.size * TILE_SIZE;
      if (ex + eS < camera.x / zoom || ey2 + eS < camera.y / zoom || ex > camera.x / zoom + viewWidth / zoom || ey2 > camera.y / zoom + viewHeight / zoom) continue;
      
      // 战争迷雾：敌方单位在迷雾中不可见
      if (gameState.fogOfWar && e.team !== TEAM_PLAYER) {
        var centerX = Math.floor(e.x + (e.isBuilding ? e.size / 2 : 0.5));
        var centerY = Math.floor(e.y + (e.isBuilding ? e.size / 2 : 0.5));
        if (!gameState.fogOfWar.isVisible(centerX, centerY)) continue;
      }
      if (e.dead) {
        ctx.globalAlpha = e.deathTimer / 45;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(ex, ey2, eS, eS);
        ctx.globalAlpha = 1;
        continue;
      }
      // 根据阵营获取颜色
      var tc, td;
      if (e.faction === FACTION_ALLIED) {
        tc = COLOR_ALLIED;
        td = COLOR_ALLIED_DARK;
      } else if (e.faction === FACTION_SOVIET) {
        tc = COLOR_SOVIET;
        td = COLOR_SOVIET_DARK;
      } else {
        tc = e.team === TEAM_PLAYER ? COLOR_PLAYER : COLOR_ENEMY;
        td = e.team === TEAM_PLAYER ? COLOR_PLAYER_DARK : COLOR_ENEMY_DARK;
      }
      if (e.flashTimer > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flashTimer * 2) * 0.5;
      if (e.isBuilding) this.drawBuilding(e, ex, ey2, eS, tc, td, gameState, frameCount);
      else this.drawUnit(e, ex, ey2, tc, td, frameCount);
      ctx.globalAlpha = 1;

      // Selection highlight
      if (e.selected) {
        ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(ex - 2, ey2 - 2, eS + 4, eS + 4);
        ctx.setLineDash([]);
        // Corner brackets
        var brSize = 5;
        ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex - 2, ey2 - 2 + brSize); ctx.lineTo(ex - 2, ey2 - 2); ctx.lineTo(ex - 2 + brSize, ey2 - 2);
        ctx.moveTo(ex + eS + 2 - brSize, ey2 - 2); ctx.lineTo(ex + eS + 2, ey2 - 2); ctx.lineTo(ex + eS + 2, ey2 - 2 + brSize);
        ctx.moveTo(ex - 2, ey2 + eS + 2 - brSize); ctx.lineTo(ex - 2, ey2 + eS + 2); ctx.lineTo(ex - 2 + brSize, ey2 + eS + 2);
        ctx.moveTo(ex + eS + 2 - brSize, ey2 + eS + 2); ctx.lineTo(ex + eS + 2, ey2 + eS + 2); ctx.lineTo(ex + eS + 2, ey2 + eS + 2 - brSize);
        ctx.stroke();
      }
      // HP bar
      if (e.hp < e.maxHp && !e.dead) {
        var bw = eS, bh = 4, bx2 = ex, by2 = ey2 - 7;
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx2, by2, bw, bh);
        var r = e.hp / e.maxHp;
        ctx.fillStyle = r > 0.6 ? '#2ecc71' : (r > 0.3 ? '#f39c12' : '#e74c3c');
        ctx.fillRect(bx2, by2, bw * r, bh);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx2, by2, bw, bh);
      }
      // Veterancy chevrons
      if (e.veterancy > 0) {
        ctx.fillStyle = e.veterancy >= 2 ? '#f1c40f' : '#bdc3c7';
        for (var v = 0; v < e.veterancy; v++) {
          ctx.beginPath();
          ctx.moveTo(ex + v * 5 + 2, ey2 + eS - 2);
          ctx.lineTo(ex + v * 5 + 5, ey2 + eS - 6);
          ctx.lineTo(ex + v * 5 + 8, ey2 + eS - 2);
          ctx.closePath(); ctx.fill();
        }
      }
      // 无敌（铁幕）状态：紫色脉冲描边
      if (e.invulnerable) {
        var ivPulse = 0.45 + Math.sin(frameCount * 0.2) * 0.3;
        ctx.strokeStyle = 'rgba(142,68,173,' + ivPulse + ')';
        ctx.lineWidth = 2;
        ctx.strokeRect(ex - 3, ey2 - 3, eS + 6, eS + 6);
      }
    }

    // Smoke particles
    for (var smi = 0; smi < gameState.smokeParticles.length; smi++) {
      var sm = gameState.smokeParticles[smi];
      var smx = sm.x, smy = sm.y;
      if (smx < camera.x / zoom - 20 || smy < camera.y / zoom - 20 || smx > camera.x / zoom + viewWidth / zoom + 20 || smy > camera.y / zoom + viewHeight / zoom + 20) continue;
      var alpha = sm.timer / sm.maxTimer * 0.4;
      ctx.fillStyle = 'rgba(80,80,80,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(smx, smy, sm.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Projectiles
    for (var pi = 0; pi < gameState.projectiles.length; pi++) {
      var p = gameState.projectiles[pi];
      var px = p.x, py = p.y;
      // 剔除：子弹会画一条从当前位置指向目标的曳光轨迹，所以要用「线段包围盒」
      // 判断，不能只看弹体位置 —— 弹体在屏幕外、目标在屏幕内时轨迹仍可见。
      // 线段必包含于其两端点的包围盒内，故按包围盒判定不会误杀。
      var segMinX = px < p.targetX ? px : p.targetX, segMaxX = px < p.targetX ? p.targetX : px;
      var segMinY = py < p.targetY ? py : p.targetY, segMaxY = py < p.targetY ? p.targetY : py;
      if (segMaxX < cullL || segMinX > cullR || segMaxY < cullT || segMinY > cullB) continue;
      if (p.type === 'bullet') {
        ctx.fillStyle = '#ffe234';
        ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
        // Tracer trail
        ctx.strokeStyle = 'rgba(255,226,52,0.4)';
        ctx.lineWidth = 1.5;
        var dxT = p.targetX - p.x, dyT = p.targetY - p.y;
        var lT = Math.sqrt(dxT * dxT + dyT * dyT);
        if (lT > 0) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - dxT / lT * 6, py - dyT / lT * 6);
          ctx.stroke();
        }
      } else if (p.type === 'shell') {
        ctx.fillStyle = '#e67e22';
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f39c12';
        ctx.beginPath(); ctx.arc(px - 1, py - 1, 2, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'rocket') {
        ctx.save();
        var rocketAngle = Math.atan2(p.targetY - p.y, p.targetX - p.x);
        ctx.translate(px, py); ctx.rotate(rocketAngle);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-5, -2, 10, 4);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(-8, -1, 4, 2);
        ctx.fillStyle = 'rgba(255,180,0,0.7)';
        ctx.beginPath(); ctx.arc(-7, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (p.type === 'tesla') {
        ctx.strokeStyle = 'rgba(0,191,255,0.9)';
        ctx.lineWidth = 3;
        var segs = 5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        var dxL = p.targetX - p.x, dyL = p.targetY - p.y;
        for (var li = 1; li <= segs; li++) {
          var lt = li / segs;
          var lx = p.x + dxL * lt + (Math.random() - 0.5) * 12;
          var ly = p.y + dyL * lt + (Math.random() - 0.5) * 12;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(100,220,255,0.85)';
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Explosions
    for (var xi = 0; xi < gameState.explosions.length; xi++) {
      var exp = gameState.explosions[xi];
      var expX = exp.x, expY = exp.y;
      // 剔除：爆炸是圆形，半径最大约为 size*1.2，留一倍余量避免边缘突然消失
      var cullM = exp.size * 2 + 32;
      if (expX + cullM < cullL || expX - cullM > cullR || expY + cullM < cullT || expY - cullM > cullB) continue;
      var prog = 1 - exp.timer / exp.maxTimer;
      var es2 = exp.size * (0.4 + prog * 0.8);
      if (exp.type === 'fire' || exp.type === 'big') {
        ctx.fillStyle = 'rgba(255,80,0,' + (1 - prog) + ')';
        ctx.beginPath(); ctx.arc(expX, expY, es2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,200,0,' + (0.85 - prog * 0.85) + ')';
        ctx.beginPath(); ctx.arc(expX, expY, es2 * 0.65, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,200,' + (0.6 - prog * 0.6) + ')';
        ctx.beginPath(); ctx.arc(expX, expY, es2 * 0.3, 0, Math.PI * 2); ctx.fill();
        if (exp.type === 'big') {
          for (var si2 = 0; si2 < 6; si2++) {
            var angle = si2 * Math.PI / 3 + prog * 2;
            var dist = es2 * (0.6 + prog * 0.4);
            var sx3 = expX + Math.cos(angle) * dist;
            var sy3 = expY + Math.sin(angle) * dist;
            ctx.fillStyle = 'rgba(120,70,30,' + (0.6 - prog * 0.6) + ')';
            ctx.beginPath(); ctx.arc(sx3, sy3, 4 + prog * 5, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (exp.type === 'electric') {
        ctx.strokeStyle = 'rgba(0,191,255,' + (1 - prog) + ')';
        ctx.lineWidth = 3 + prog * 2;
        ctx.beginPath(); ctx.arc(expX, expY, es2, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(93,173,226,' + (0.45 - prog * 0.45) + ')';
        ctx.beginPath(); ctx.arc(expX, expY, es2 * 0.5, 0, Math.PI * 2); ctx.fill();
        // Tesla branches
        ctx.strokeStyle = 'rgba(150,220,255,' + (0.8 - prog * 0.8) + ')';
        ctx.lineWidth = 2;
        for (var br = 0; br < 4; br++) {
          ctx.beginPath();
          ctx.moveTo(expX, expY);
          var ang = br * Math.PI / 2 + frameCount * 0.1;
          ctx.lineTo(expX + Math.cos(ang) * es2, expY + Math.sin(ang) * es2);
          ctx.stroke();
        }
      }
    }

    // Floating texts
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px Arial';
    for (var fi = 0; fi < gameState.floatingTexts.length; fi++) {
      var ft = gameState.floatingTexts[fi];
      var ftx = ft.x, fty = ft.y;
      // 剔除：12px 字体、居中绘制，128px 余量足够覆盖任意文本宽度
      if (ftx + 128 < cullL || ftx - 128 > cullR || fty + 128 < cullT || fty - 128 > cullB) continue;
      ctx.globalAlpha = ft.timer / 50;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(ft.text, ftx + 1, fty + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ftx, fty);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';

    // 战争迷雾：在世界坐标系内一次 drawImage 覆盖未探索/无视野区域
    if (gameState.fogOfWar) {
      gameState.fogOfWar.render(ctx);
    }

    // 超级武器效果渲染（世界坐标系，跟随镜头与缩放）
    if (gameState.superWeaponManager) {
      gameState.superWeaponManager.render(ctx, frameCount);
    }

    // Building placement ghost
    if (placingBuilding && placingType && mouse.inCanvas) {
      var pd2 = BUILDING_DEFS[placingType] || DEFENSE_DEFS[placingType];
      if (pd2) {
        var pS = pd2.size * TILE_SIZE;
        var pgx = mouse.mapX * TILE_SIZE;
        var pgy = mouse.mapY * TILE_SIZE;
        var canPlace = gameState.map.isBuildable(mouse.mapX, mouse.mapY, pd2.size) &&
                       gameState.map.isNearBuilding(mouse.mapX, mouse.mapY, pd2.size, TEAM_PLAYER);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = canPlace ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(pgx, pgy, pS, pS);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = canPlace ? '#2ecc71' : '#e74c3c';
        ctx.lineWidth = 2;
        ctx.strokeRect(pgx, pgy, pS, pS);
        // Show range for defenses
        if (DEFENSE_DEFS[placingType] && pd2.range > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(pgx + pS / 2, pgy + pS / 2, pd2.range * TILE_SIZE, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 超级武器瞄准预览
    if (superWeaponTargeting && mouse.inCanvas) {
      var swDef = SUPER_WEAPONS[superWeaponTargeting];
      var swRadius = swDef ? (swDef.radius || (superWeaponTargeting === 'ironCurtain' ? 3 : 2)) : 2;
      var swx = mouse.mapX * TILE_SIZE + TILE_SIZE / 2;
      var swy = mouse.mapY * TILE_SIZE + TILE_SIZE / 2;
      var swPulse = 0.5 + Math.sin(frameCount * 0.15) * 0.25;
      ctx.fillStyle = 'rgba(231,76,60,0.12)';
      ctx.beginPath(); ctx.arc(swx, swy, swRadius * TILE_SIZE, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(231,76,60,' + swPulse + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(swx, swy, swRadius * TILE_SIZE, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(231,76,60,0.9)';
      ctx.beginPath();
      ctx.moveTo(swx - 8, swy); ctx.lineTo(swx + 8, swy);
      ctx.moveTo(swx, swy - 8); ctx.lineTo(swx, swy + 8);
      ctx.stroke();
    }

    ctx.restore();

    // === Screen-space overlays (not affected by zoom) ===

    // Drag select rectangle
    if (dragSelect.active) {
      var drx = Math.min(dragSelect.startX, dragSelect.endX);
      var dry = Math.min(dragSelect.startY, dragSelect.endY);
      var drw = Math.abs(dragSelect.endX - dragSelect.startX);
      var drh = Math.abs(dragSelect.endY - dragSelect.startY);
      ctx.fillStyle = 'rgba(46,204,113,0.12)';
      ctx.fillRect(drx, dry, drw, drh);
      ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(drx, dry, drw, drh);
      ctx.setLineDash([]);
    }

    // Action-mode cursor overlay
    if (activeAction) {
      ctx.fillStyle = activeAction === 'repair' ? 'rgba(46,204,113,0.2)' : 'rgba(241,196,15,0.2)';
      ctx.fillRect(mouse.x - 12, mouse.y - 12, 24, 24);
      ctx.strokeStyle = activeAction === 'repair' ? '#2ecc71' : '#f1c40f';
      ctx.lineWidth = 2;
      ctx.strokeRect(mouse.x - 12, mouse.y - 12, 24, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Arial';
      ctx.fillText(activeAction === 'repair' ? '\u{1F527}' : '$', mouse.x - 5, mouse.y + 4);
    }

    // Game paused overlay
    if (gamePaused) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, viewWidth, this.canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('\u6682\u505C', viewWidth / 2, this.canvas.height / 2);
      ctx.font = '14px Arial';
      ctx.fillStyle = '#aaa';
      ctx.fillText('\u6309 Space \u7EE7\u7EED', viewWidth / 2, this.canvas.height / 2 + 30);
      ctx.textAlign = 'left';
    }

    this.renderMinimap(gameState, camera, frameCount, viewWidth);
  }

  drawBuilding(e, ex, ey2, eS, tc, td, gameState, frameCount) {
    // 实现已外提到 Sprites.js（这两个方法不依赖 Renderer 实例状态）
    return drawBuildingSprite(this.ctx, e, ex, ey2, eS, tc, td, gameState, frameCount);
  }

  drawUnit(e, ex, ey2, tc, td, frameCount) {
    // 实现已外提到 Sprites.js
    return drawUnitSprite(this.ctx, e, ex, ey2, tc, td, frameCount);
  }

  renderMinimap(gameState, camera, frameCount, viewWidth) {
    var minimapCtx = this.minimapCtx;
    var minimapCanvas = this.minimapCanvas;
    var mw = minimapCanvas.width, mh = minimapCanvas.height;
    var sx = mw / MAP_WIDTH, sy = mh / MAP_HEIGHT;

    if (!this.minimapTerrainCanvas) {
      this.minimapTerrainCanvas = document.createElement('canvas');
      this.minimapTerrainCanvas.width = mw;
      this.minimapTerrainCanvas.height = mh;
      this.minimapTerrainDirty = true;
    }
    if (this.minimapTerrainDirty || frameCount % 120 === 0) {
      var tCtx = this.minimapTerrainCanvas.getContext('2d');
      tCtx.fillStyle = '#060610';
      tCtx.fillRect(0, 0, mw, mh);
      for (var my = 0; my < MAP_HEIGHT; my += 1) {
        for (var mx = 0; mx < MAP_WIDTH; mx += 1) {
          var t = gameState.map.terrain[my][mx];
          if (t === GRASS) tCtx.fillStyle = '#2d5a1e';
          else if (t === WATER) tCtx.fillStyle = '#1a5276';
          else if (t === ORE) tCtx.fillStyle = '#c9a800';
          else if (t === ROCK) tCtx.fillStyle = '#4a5568';
          else if (t === CONCRETE) tCtx.fillStyle = '#3d3d3d';
          else if (t === SAND) tCtx.fillStyle = '#9a7d0a';
          else if (t === TREE) tCtx.fillStyle = '#1e4a10';
          else continue;
          tCtx.fillRect(mx * sx, my * sy, sx + 1, sy + 1);
        }
      }
      this.minimapTerrainDirty = false;
    }

    minimapCtx.drawImage(this.minimapTerrainCanvas, 0, 0);

    // 战争迷雾覆盖小地图（未探索全黑 / 已探索半暗）
    if (gameState.fogOfWar) {
      gameState.fogOfWar.render(minimapCtx, mw, mh);
    }

    for (var i = 0; i < gameState.entities.length; i++) {
      var e = gameState.entities[i];
      if (e.dead) continue;
      
      // 战争迷雾：小地图上敌方单位只在有视野时显示
      if (gameState.fogOfWar && e.team !== TEAM_PLAYER) {
        var eCenterX = Math.floor(e.x + (e.isBuilding ? e.size / 2 : 0.5));
        var eCenterY = Math.floor(e.y + (e.isBuilding ? e.size / 2 : 0.5));
        if (!gameState.fogOfWar.isVisible(eCenterX, eCenterY)) continue;
      }
      
      minimapCtx.fillStyle = e.team === TEAM_PLAYER ? '#4a9fd4' : '#e74c3c';
      var emx = (e.x + (e.isBuilding ? e.size / 2 : 0.5)) * sx;
      var emy = (e.y + (e.isBuilding ? e.size / 2 : 0.5)) * sy;
      var ds = e.isBuilding ? 3 : 2;
      minimapCtx.fillRect(emx - ds / 2, emy - ds / 2, ds, ds);
    }
    // Minimap alerts
    for (var ai = 0; ai < gameState.minimapAlerts.length; ai++) {
      var al = gameState.minimapAlerts[ai];
      var alpha = al.timer / al.maxTimer;
      var radius = (1 - alpha) * 15 + 3;
      minimapCtx.strokeStyle = al.color;
      minimapCtx.globalAlpha = alpha;
      minimapCtx.lineWidth = 2;
      minimapCtx.beginPath();
      minimapCtx.arc(al.x * sx, al.y * sy, radius, 0, Math.PI * 2);
      minimapCtx.stroke();
      minimapCtx.globalAlpha = 1;
    }
    // Viewport rect
    minimapCtx.strokeStyle = 'rgba(255,255,255,0.7)';
    minimapCtx.lineWidth = 1;
    var vpX = camera.x / camera.zoom / TILE_SIZE * sx;
    var vpY = camera.y / camera.zoom / TILE_SIZE * sy;
    var vpW = viewWidth / camera.zoom / TILE_SIZE * sx;
    var vpH = this.canvas.height / camera.zoom / TILE_SIZE * sy;
    minimapCtx.strokeRect(vpX, vpY, vpW, vpH);
  }
}

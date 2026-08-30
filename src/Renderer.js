import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, GRASS, WATER, ORE, ROCK, CONCRETE, SAND, TREE,
         TEAM_PLAYER, TEAM_ENEMY, COLOR_PLAYER, COLOR_PLAYER_DARK, COLOR_ENEMY, COLOR_ENEMY_DARK,
         COLOR_ALLIED, COLOR_ALLIED_DARK, COLOR_SOVIET, COLOR_SOVIET_DARK, TYPE_AIRCRAFT, TYPE_HELICOPTER, TYPE_AIRSHIP } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS, SUPER_WEAPONS, FACTION_ALLIED, FACTION_SOVIET } from './definitions.js';

export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.ctx = canvas.getContext('2d');
    this.minimapCtx = minimapCanvas.getContext('2d');
    this.canvas = canvas;
    this.minimapCanvas = minimapCanvas;
    this.tileCache = {};
    this.minimapTerrainCanvas = null;
    this.minimapTerrainDirty = true;
  }

  getSortedEntities(gameState) {
    // 单位每帧都在移动，y 序必须每帧重排，否则重叠绘制顺序错乱；
    // 实体规模（~百级）下每帧排序开销可忽略
    return gameState.entities.slice().sort(function(a, b) {
      return (a.y + (a.isBuilding ? a.size : 1)) - (b.y + (b.isBuilding ? b.size : 1));
    });
  }

  getTileCanvas(type, tx, ty) {
    var variant = (tx * 7 + ty * 13) % 4;
    var key = type + '_' + variant;
    if (this.tileCache[key]) return this.tileCache[key];
    var tc = document.createElement('canvas');
    tc.width = TILE_SIZE; tc.height = TILE_SIZE;
    this.drawTileToCtx(tc.getContext('2d'), type, variant);
    this.tileCache[key] = tc;
    return tc;
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
          ctx.fillStyle = '#2d5a1e'; ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          var oreAmt = gameState.map.oreAmount[ty][tx];
          var crystals = Math.min(6, Math.floor(oreAmt / 100) + 1);
          var pulse = 0.85 + Math.sin(frameCount * 0.08 + tx + ty) * 0.15;
          for (var ci = 0; ci < crystals; ci++) {
            var crx = sx + 4 + ((ci * 7 + tx * 3) % 22);
            var cry = sy + 4 + ((ci * 11 + ty * 5) % 22);
            ctx.fillStyle = 'rgba(241,196,15,' + pulse + ')';
            ctx.beginPath();
            ctx.moveTo(crx, cry - 5); ctx.lineTo(crx + 4, cry); ctx.lineTo(crx, cry + 5); ctx.lineTo(crx - 4, cry);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,220,50,0.65)';
            ctx.beginPath();
            ctx.moveTo(crx, cry - 2); ctx.lineTo(crx + 2, cry); ctx.lineTo(crx, cry + 2); ctx.lineTo(crx - 2, cry);
            ctx.closePath(); ctx.fill();
          }
        } else if (terrain === WATER) {
          ctx.fillStyle = '#1a5276'; ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          var woff = Math.sin(frameCount * 0.04 + tx * 0.7 + ty * 0.5) * 2;
          ctx.fillStyle = 'rgba(52,152,219,0.3)';
          ctx.fillRect(sx, sy + 10 + woff, TILE_SIZE, 3);
          ctx.fillRect(sx + 5, sy + 22 - woff, TILE_SIZE - 10, 3);
          ctx.fillStyle = 'rgba(120,200,255,0.18)';
          ctx.fillRect(sx + Math.sin(frameCount * 0.03 + tx) * 3, sy + 2, TILE_SIZE - 8, 2);
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
      if (p.type === 'bullet') {
        ctx.fillStyle = '#ffe234';
        ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
        // Tracer trail
        ctx.strokeStyle = 'rgba(255,226,52,0.4)';
        ctx.lineWidth = 1.5;
        var dxT = p.targetX - p.x, dyT = p.targetY - p.y;
        var lT = Math.hypot(dxT, dyT);
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
    var ctx = this.ctx;
    if (!e.built) ctx.globalAlpha = (ctx.globalAlpha || 1) * (0.35 + e.buildProgress / 100 * 0.65);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(ex + 3, ey2 + 3, eS, eS);
    ctx.fillStyle = td; ctx.fillRect(ex, ey2, eS, eS);
    ctx.fillStyle = tc; ctx.fillRect(ex + 2, ey2 + 2, eS - 4, eS - 4);

    switch (e.type) {
      case 'base':
        ctx.fillStyle = '#5d6d7e';
        ctx.fillRect(ex + eS * 0.12, ey2 + eS * 0.12, eS * 0.76, eS * 0.76);
        ctx.fillStyle = tc;
        ctx.fillRect(ex + eS * 0.22, ey2 + eS * 0.22, eS * 0.56, eS * 0.56);
        ctx.fillStyle = '#aaa'; ctx.fillRect(ex + eS * 0.15, ey2 + 8, 2, eS * 0.45);
        ctx.fillStyle = '#ccc'; ctx.fillRect(ex + eS * 0.13, ey2 + 8, 6, 2);
        var fy = ey2 + 10 + Math.sin(frameCount * 0.08) * 3;
        ctx.fillStyle = tc; ctx.fillRect(ex + eS - 14, fy, 12, 8);
        ctx.fillStyle = '#fff'; ctx.fillRect(ex + eS - 14, fy, 12, 2);
        ctx.fillStyle = '#888'; ctx.fillRect(ex + eS - 15, ey2 + 5, 2, eS * 0.55);
        // Door
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(ex + eS * 0.4, ey2 + eS * 0.6, eS * 0.2, eS * 0.25);
        break;
      case 'powerPlant':
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(ex + eS * 0.18, ey2 + eS * 0.35, eS * 0.64, eS * 0.52);
        ctx.fillStyle = '#555';
        ctx.fillRect(ex + eS * 0.28, ey2 + 5, 7, eS * 0.38);
        ctx.fillRect(ex + eS * 0.6, ey2 + 5, 7, eS * 0.38);
        if (e.built) {
          var sr = 5 + Math.sin(frameCount * 0.07) * 2;
          ctx.fillStyle = 'rgba(241,196,15,0.4)';
          ctx.beginPath(); ctx.arc(ex + eS * 0.315, ey2 + 4, sr, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(ex + eS * 0.635, ey2 + 4, sr, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'refinery':
        ctx.fillStyle = '#e67e22';
        ctx.fillRect(ex + 4, ey2 + 4, eS - 8, eS - 8);
        ctx.fillStyle = '#d35400';
        ctx.fillRect(ex + eS * 0.55, ey2 + eS * 0.08, eS * 0.35, eS * 0.45);
        ctx.fillStyle = '#f39c12';
        ctx.beginPath(); ctx.arc(ex + eS * 0.33, ey2 + eS * 0.55, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#555';
        ctx.fillRect(ex + eS * 0.1, ey2 + eS * 0.7, eS * 0.8, 5);
        break;
      case 'barracks':
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = '#145a32';
        ctx.fillRect(ex + eS * 0.08, ey2 + eS * 0.08, eS * 0.84, eS * 0.25);
        ctx.fillStyle = '#1e8449';
        ctx.fillRect(ex + eS * 0.08, ey2 + eS * 0.55, eS * 0.22, eS * 0.35);
        ctx.fillRect(ex + eS * 0.38, ey2 + eS * 0.55, eS * 0.22, eS * 0.35);
        ctx.fillStyle = '#aaa';
        ctx.fillRect(ex + eS * 0.25, ey2 + eS * 0.55, eS * 0.12, eS * 0.3);
        break;
      case 'warFactory':
        ctx.fillStyle = '#5b2c6f';
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = '#6c3483';
        ctx.fillRect(ex + eS * 0.04, ey2 + eS * 0.5, eS * 0.92, eS * 0.44);
        ctx.fillStyle = '#333';
        ctx.fillRect(ex + eS * 0.08, ey2 + eS * 0.55, eS * 0.35, eS * 0.38);
        ctx.fillStyle = '#999';
        ctx.fillRect(ex + eS * 0.65, ey2 + eS * 0.08, 5, eS * 0.45);
        ctx.fillRect(ex + eS * 0.5, ey2 + eS * 0.08, eS * 0.3, 4);
        ctx.fillStyle = '#555';
        ctx.fillRect(ex + eS * 0.1, ey2 + 8, 6, 18);
        ctx.fillRect(ex + eS * 0.22, ey2 + 5, 6, 22);
        break;
      case 'radar':
        ctx.fillStyle = '#1a252f';
        ctx.fillRect(ex + 4, ey2 + 4, eS - 8, eS - 8);
        ctx.fillStyle = tc;
        ctx.fillRect(ex + eS * 0.18, ey2 + eS * 0.35, eS * 0.64, eS * 0.45);
        if (e.built) {
          ctx.save();
          ctx.translate(ex + eS * 0.5, ey2 + eS * 0.4);
          ctx.rotate(frameCount * 0.04);
          ctx.fillStyle = '#5dade2';
          ctx.fillRect(-14, -2, 28, 4);
          ctx.fillRect(-2, -14, 4, 28);
          ctx.fillStyle = 'rgba(93,173,226,0.4)';
          ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 0.5); ctx.lineTo(0, 0); ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#333';
          ctx.beginPath(); ctx.arc(ex + eS * 0.5, ey2 + eS * 0.4, 4, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'alliedTech':
      case 'sovietTech': {
        var techBase = e.type === 'alliedTech' ? '#0e6655' : '#641e16';
        var techGlow = e.type === 'alliedTech' ? '#1abc9c' : '#e74c3c';
        ctx.fillStyle = techBase;
        ctx.fillRect(ex + 4, ey2 + 4, eS - 8, eS - 8);
        ctx.fillStyle = techGlow;
        ctx.fillRect(ex + eS * 0.12, ey2 + eS * 0.12, eS * 0.76, eS * 0.28);
        for (var di = 0; di < 3; di++) {
          ctx.fillStyle = techGlow === '#1abc9c' ? 'rgba(26,188,156,0.7)' : 'rgba(231,76,60,0.7)';
          ctx.beginPath();
          ctx.arc(ex + eS * (0.25 + di * 0.25), ey2 + eS * 0.65, 6 + Math.sin(frameCount * 0.08 + di) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        if (e.built && frameCount % 15 < 7) {
          ctx.fillStyle = techGlow === '#1abc9c' ? 'rgba(26,188,156,0.2)' : 'rgba(231,76,60,0.2)';
          ctx.beginPath(); ctx.arc(ex + eS * 0.5, ey2 + eS * 0.5, eS * 0.55, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'orePurifier':
        ctx.fillStyle = '#7d6608';
        ctx.fillRect(ex + 4, ey2 + 4, eS - 8, eS - 8);
        ctx.fillStyle = '#b7950b';
        ctx.fillRect(ex + eS * 0.15, ey2 + eS * 0.15, eS * 0.7, eS * 0.7);
        // 漏斗与金流
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.moveTo(ex + eS * 0.3, ey2 + eS * 0.2);
        ctx.lineTo(ex + eS * 0.7, ey2 + eS * 0.2);
        ctx.lineTo(ex + eS * 0.55, ey2 + eS * 0.5);
        ctx.lineTo(ex + eS * 0.55, ey2 + eS * 0.7);
        ctx.lineTo(ex + eS * 0.45, ey2 + eS * 0.7);
        ctx.lineTo(ex + eS * 0.45, ey2 + eS * 0.5);
        ctx.closePath(); ctx.fill();
        if (e.built && frameCount % 30 < 15) {
          ctx.fillStyle = 'rgba(241,196,15,0.35)';
          ctx.fillRect(ex + eS * 0.42, ey2 + eS * 0.72, eS * 0.16, eS * 0.14);
        }
        break;
      case 'nukeSilo':
        ctx.fillStyle = '#4a1518';
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = '#2c0d0f';
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, eS * 0.36, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, eS * 0.36, 0, Math.PI * 2); ctx.stroke();
        // 辐射标志
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, eS * 0.2, 0.5, 1.6); ctx.lineTo(ex + eS / 2, ey2 + eS / 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, eS * 0.2, 2.6, 3.7); ctx.lineTo(ex + eS / 2, ey2 + eS / 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, eS * 0.2, 4.7, 5.8); ctx.lineTo(ex + eS / 2, ey2 + eS / 2); ctx.fill();
        if (e.built) {
          var siloGlow = 0.3 + Math.sin(frameCount * 0.06) * 0.2;
          ctx.fillStyle = 'rgba(231,76,60,' + siloGlow + ')';
          ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, eS * 0.46, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'ironCurtain':
        ctx.fillStyle = '#4a235a';
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = '#8e44ad';
        ctx.fillRect(ex + eS / 2 - 5, ey2 + eS * 0.3, 10, eS * 0.45);
        ctx.fillStyle = '#d7bde2';
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS * 0.25, 6, 0, Math.PI * 2); ctx.fill();
        if (e.built && frameCount % 20 < 10) {
          ctx.strokeStyle = 'rgba(142,68,173,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, eS * 0.42, frameCount * 0.05, frameCount * 0.05 + 2); ctx.stroke();
        }
        break;
      case 'weatherControl':
        ctx.fillStyle = '#4a3b8f';
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = '#9b59b6';
        ctx.fillRect(ex + eS * 0.15, ey2 + eS * 0.45, eS * 0.7, eS * 0.35);
        // 云朵
        ctx.fillStyle = '#d2b4de';
        ctx.beginPath(); ctx.arc(ex + eS * 0.35, ey2 + eS * 0.3, eS * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex + eS * 0.55, ey2 + eS * 0.25, eS * 0.13, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex + eS * 0.68, ey2 + eS * 0.32, eS * 0.11, 0, Math.PI * 2); ctx.fill();
        if (e.built && frameCount % 25 < 6) {
          ctx.strokeStyle = '#f4ecf7'; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ex + eS * 0.5, ey2 + eS * 0.4);
          ctx.lineTo(ex + eS * 0.45, ey2 + eS * 0.6);
          ctx.lineTo(ex + eS * 0.55, ey2 + eS * 0.58);
          ctx.lineTo(ex + eS * 0.48, ey2 + eS * 0.8);
          ctx.stroke();
        }
        break;
      case 'chronosphere':
        ctx.fillStyle = '#0b3c5d';
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = '#154360';
        ctx.fillRect(ex + eS * 0.2, ey2 + eS * 0.5, eS * 0.6, eS * 0.3);
        ctx.save();
        ctx.translate(ex + eS / 2, ey2 + eS * 0.35);
        ctx.rotate(frameCount * 0.06);
        ctx.strokeStyle = '#00bfff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, eS * 0.26, 0, Math.PI * 1.4); ctx.stroke();
        ctx.rotate(Math.PI);
        ctx.beginPath(); ctx.arc(0, 0, eS * 0.26, 0, Math.PI * 1.4); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#aef0ff';
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS * 0.35, 3 + Math.sin(frameCount * 0.1) * 1.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'repairBay':
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(ex + 4, ey2 + 4, eS - 8, eS - 8);
        ctx.fillStyle = '#566573';
        ctx.fillRect(ex + eS * 0.15, ey2 + eS * 0.15, eS * 0.7, eS * 0.7);
        // Wrench icon
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(ex + eS * 0.4, ey2 + eS * 0.3, eS * 0.2, eS * 0.4);
        ctx.fillRect(ex + eS * 0.3, ey2 + eS * 0.32, eS * 0.4, eS * 0.08);
        ctx.fillStyle = '#888';
        // Floor markings
        ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(ex + eS * 0.1, ey2 + eS * 0.7, eS * 0.8, eS * 0.18);
        ctx.setLineDash([]);
        break;
      case 'wall':
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(ex + 1, ey2 + 1, eS - 2, eS - 2);
        ctx.fillStyle = '#566573';
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        // Stones
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(ex + 4, ey2 + 4, eS / 2 - 5, eS / 2 - 5);
        ctx.fillRect(ex + eS / 2 + 1, ey2 + 4, eS / 2 - 5, eS / 2 - 5);
        ctx.fillRect(ex + 4, ey2 + eS / 2 + 1, eS / 2 - 5, eS / 2 - 5);
        ctx.fillRect(ex + eS / 2 + 1, ey2 + eS / 2 + 1, eS / 2 - 5, eS / 2 - 5);
        break;
      case 'pillbox':
        ctx.fillStyle = td;
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = tc;
        ctx.fillRect(ex + 7, ey2 + 7, eS - 14, eS - 14);
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(ex + eS / 2 - 1, ey2 + 5, 3, eS / 2 - 5);
        break;
      case 'turret':
        ctx.fillStyle = td;
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = tc;
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, 13, 0, Math.PI * 2); ctx.fill();
        // Use cached turret angle from update phase
        var turretAngle = e.renderTurretAngle || 0;
        ctx.save();
        ctx.translate(ex + eS / 2, ey2 + eS / 2);
        ctx.rotate(turretAngle);
        ctx.fillStyle = '#222';
        ctx.fillRect(0, -3, 18, 6);
        ctx.restore();
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, 6, 0, Math.PI * 2); ctx.fill();
        break;
      case 'tesla':
        // 磁暴线圈 - 苏联
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = '#8e44ad';
        ctx.fillRect(ex + eS / 2 - 4, ey2 + 4, 8, eS / 2 - 3);
        ctx.fillStyle = '#00bfff';
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + 8, 8, 0, Math.PI * 2); ctx.fill();
        if (e.built && e.fireCooldown > e.fireRate - 8) {
          ctx.strokeStyle = 'rgba(0,191,255,0.9)';
          ctx.lineWidth = 2;
          for (var li = 0; li < 4; li++) {
            ctx.beginPath(); ctx.moveTo(ex + eS / 2, ey2 + 6);
            var lx2 = ex + eS / 2 + (Math.random() - 0.5) * 25;
            var ly2 = ey2 + 6 - Math.random() * 20;
            ctx.lineTo(lx2, ly2); ctx.stroke();
          }
        }
        break;
      case 'prismTower':
        // 光棱塔 - 盟军
        ctx.fillStyle = '#34495e';
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath();
        ctx.moveTo(ex + eS / 2, ey2 + 4);
        ctx.lineTo(ex + eS - 6, ey2 + eS - 6);
        ctx.lineTo(ex + 6, ey2 + eS - 6);
        ctx.fill();
        ctx.fillStyle = '#e91e63';
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + 10, 6, 0, Math.PI * 2); ctx.fill();
        // 充能效果
        if (e.built && e.fireCooldown > e.fireRate - 10) {
          ctx.strokeStyle = 'rgba(233,30,99,0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ex + eS / 2, ey2 + 10);
          ctx.lineTo(ex + eS / 2 + (Math.random() - 0.5) * 30, ey2 + 10 - Math.random() * 25);
          ctx.stroke();
        }
        break;
      case 'patriot':
        // 爱国者导弹 - 盟军防空
        ctx.fillStyle = '#34495e';
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = '#3498db';
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, 10, 0, Math.PI * 2); ctx.fill();
        var aaAngle = e.renderTurretAngle || 0;
        ctx.save();
        ctx.translate(ex + eS / 2, ey2 + eS / 2);
        ctx.rotate(aaAngle);
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(0, -2, 14, 4);
        ctx.restore();
        break;
      case 'flakCannon':
        // 高射炮 - 苏联防空
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(ex + 3, ey2 + 3, eS - 6, eS - 6);
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.arc(ex + eS / 2, ey2 + eS / 2, 11, 0, Math.PI * 2); ctx.fill();
        var flakAngle = e.renderTurretAngle || 0;
        ctx.save();
        ctx.translate(ex + eS / 2, ey2 + eS / 2);
        ctx.rotate(flakAngle);
        ctx.fillStyle = '#222';
        ctx.fillRect(0, -4, 12, 3);
        ctx.fillRect(0, 1, 12, 3);
        ctx.restore();
        break;
    }

    // Build progress
    if (!e.built) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(ex, ey2, eS, eS);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(ex + 2, ey2 + eS - 7, (eS - 4) * (e.buildProgress / 100), 5);
      ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
      ctx.strokeRect(ex + 2, ey2 + eS - 7, eS - 4, 5);
      ctx.font = '10px Arial'; ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(Math.floor(e.buildProgress) + '%', ex + eS / 2, ey2 + eS / 2 + 4);
      ctx.textAlign = 'left';
    }

    // Production progress
    if (e.producing) {
      var pb = e.produceProgress / 100;
      ctx.fillStyle = 'rgba(46,204,113,0.9)';
      ctx.fillRect(ex + 2, ey2 - 7, (eS - 4) * pb, 5);
      ctx.strokeStyle = 'rgba(46,204,113,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ex + 2, ey2 - 7, eS - 4, 5);
      // Queue indicator
      if (e.productionQueue.length > 0) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('+' + e.productionQueue.length, ex + eS - 12, ey2 - 9);
      }
    }
  }

  drawUnit(e, ex, ey2, tc, td, frameCount) {
    var ctx = this.ctx;
    var ux = ex + TILE_SIZE / 2, uy = ey2 + TILE_SIZE / 2;
    
    // 空军单位绘制阴影在地面
    if (e.isAirUnit) {
      var shadowY = uy + 15 + Math.sin(frameCount * 0.1) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(ux, shadowY, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      // 空军单位在更高位置绘制
      uy -= 15 + Math.sin(frameCount * 0.1) * 5;
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(ux, uy + 8, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    }

    if (e.type2 === 'infantry') {
      var lo = Math.sin(e.animFrame * Math.PI / 2) * 3;
      ctx.fillStyle = tc;
      ctx.fillRect(ux - 4, uy - 7, 8, 10);
      ctx.fillStyle = '#c8a87a';
      ctx.beginPath(); ctx.arc(ux, uy - 11, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = td;
      ctx.beginPath(); ctx.arc(ux, uy - 12, 5, Math.PI, 0); ctx.fill();
      ctx.fillStyle = td;
      ctx.fillRect(ux - 3, uy + 3, 3, 6 + lo);
      ctx.fillRect(ux, uy + 3, 3, 6 - lo);
      if (e.type === 'rocket') {
        ctx.fillStyle = '#888'; ctx.fillRect(ux + 4, uy - 5, 9, 3);
        ctx.fillStyle = '#c0392b'; ctx.fillRect(ux + 11, uy - 7, 3, 7);
      } else if (e.type === 'engineer') {
        ctx.fillStyle = '#f39c12'; ctx.fillRect(ux + 4, uy - 2, 9, 5);
        ctx.fillStyle = '#ccc'; ctx.fillRect(ux + 11, uy - 4, 3, 3);
        // Hard hat
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath(); ctx.arc(ux, uy - 13, 4, Math.PI, 0); ctx.fill();
      } else {
        ctx.fillStyle = '#333'; ctx.fillRect(ux + 4, uy - 3, 9, 2.5);
      }
    } else if (e.type2 === 'vehicle' || e.type2 === 'harvester') {
      if (e.type === 'arty') {
        ctx.fillStyle = '#222'; ctx.fillRect(ux - 11, uy + 1, 22, 7);
        ctx.fillStyle = td; ctx.fillRect(ux - 9, uy - 5, 18, 8);
        ctx.fillStyle = tc; ctx.fillRect(ux - 6, uy - 7, 12, 5);
        ctx.fillStyle = '#222';
        ctx.save();
        ctx.translate(ux, uy - 3);
        ctx.rotate(e.turretDir - 0.3);
        ctx.fillRect(0, -2, 20, 4);
        ctx.restore();
      } else if (e.type2 === 'harvester') {
        ctx.fillStyle = '#333'; ctx.fillRect(ux - 11, uy + 1, 22, 7);
        ctx.fillStyle = td; ctx.fillRect(ux - 11, uy - 5, 22, 8);
        ctx.fillStyle = tc; ctx.fillRect(ux - 9, uy - 7, 18, 5);
        ctx.fillStyle = '#f1c40f'; ctx.fillRect(ux - 15, uy - 4, 6, 9);
        ctx.fillStyle = '#e67e22'; ctx.fillRect(ux - 16, uy - 2, 4, 5);
        if (e.ore > 0) {
          var oh = Math.min(7, (e.ore / e.capacity) * 7);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(ux - 14, uy + 8 - oh, 2, oh);
        }
      } else if (e.type === 'grizzly') {
        // 灰熊坦克 - 盟军主战坦克
        var ts = 12;
        ctx.fillStyle = '#222';
        ctx.fillRect(ux - ts, uy + 2, ts * 2, 6);
        ctx.fillStyle = tc;
        ctx.fillRect(ux - ts + 1, uy - 3, ts * 2 - 2, 7);
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath(); ctx.arc(ux, uy, 7, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.translate(ux, uy);
        ctx.rotate(e.turretDir);
        ctx.fillStyle = '#34495e';
        ctx.fillRect(0, -2, ts + 6, 4);
        ctx.restore();
      } else if (e.type === 'rhino') {
        // 犀牛坦克 - 苏联主战坦克
        var ts = 13;
        ctx.fillStyle = '#222';
        ctx.fillRect(ux - ts, uy + 2, ts * 2, 7);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(ux - ts + 1, uy - 4, ts * 2 - 2, 8);
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.arc(ux, uy - 1, 8, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.translate(ux, uy - 1);
        ctx.rotate(e.turretDir);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, -2.5, ts + 5, 5);
        ctx.restore();
      } else if (e.type === 'apocalypse') {
        // 天启坦克 - 苏联终极坦克
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(ux - 16, uy + 3, 32, 8);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(ux - 14, uy - 5, 28, 10);
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.arc(ux, uy - 1, 10, 0, Math.PI * 2); ctx.fill();
        // 双炮管
        ctx.save();
        ctx.translate(ux, uy - 3);
        ctx.rotate(e.turretDir);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, -4, 16, 3);
        ctx.fillRect(0, 1, 16, 3);
        ctx.restore();
      } else if (e.type === 'prism') {
        // 光棱坦克
        ctx.fillStyle = '#222';
        ctx.fillRect(ux - 10, uy + 2, 20, 6);
        ctx.fillStyle = '#9b59b6';
        ctx.fillRect(ux - 9, uy - 3, 18, 7);
        ctx.save();
        ctx.translate(ux, uy);
        ctx.rotate(e.turretDir);
        // 光棱发射器
        ctx.fillStyle = '#e91e63';
        ctx.fillRect(0, -3, 14, 6);
        ctx.fillStyle = '#f8bbd9';
        ctx.fillRect(8, -1.5, 4, 3);
        ctx.restore();
      } else if (e.type === 'v3') {
        // V3火箭车
        ctx.fillStyle = '#222';
        ctx.fillRect(ux - 11, uy + 2, 22, 6);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(ux - 10, uy - 3, 20, 7);
        ctx.save();
        ctx.translate(ux, uy - 2);
        ctx.rotate(e.turretDir - 0.5);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(0, -2, 18, 4);
        // 火箭
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(14, -1.5, 8, 3);
        ctx.restore();
      } else if (e.type === 'ifv') {
        // 多功能步兵车
        ctx.fillStyle = '#222';
        ctx.fillRect(ux - 9, uy + 2, 18, 5);
        ctx.fillStyle = tc;
        ctx.fillRect(ux - 8, uy - 3, 16, 6);
        ctx.save();
        ctx.translate(ux, uy);
        ctx.rotate(e.turretDir);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, -1.5, 10, 3);
        ctx.restore();
      } else if (e.type === 'flakTrack') {
        // 防空履带车
        ctx.fillStyle = '#222';
        ctx.fillRect(ux - 10, uy + 2, 20, 6);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(ux - 9, uy - 3, 18, 7);
        ctx.save();
        ctx.translate(ux, uy);
        ctx.rotate(e.turretDir);
        ctx.fillStyle = '#8e44ad';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(0, -2, 10, 4);
        ctx.restore();
      } else if (e.type === 'mirage') {
        // 幻影坦克 - 伪装成树
        if (e.stealthActive && e.team !== TEAM_PLAYER) {
          // 伪装成树
          ctx.fillStyle = '#2d5016';
          ctx.beginPath();
          ctx.moveTo(ux, uy - 15);
          ctx.lineTo(ux + 8, uy + 5);
          ctx.lineTo(ux - 8, uy + 5);
          ctx.fill();
          ctx.fillStyle = '#5d4037';
          ctx.fillRect(ux - 2, uy + 5, 4, 6);
        } else {
          ctx.fillStyle = '#27ae60';
          ctx.fillRect(ux - 10, uy + 2, 20, 6);
          ctx.save();
          ctx.translate(ux, uy);
          ctx.rotate(e.turretDir);
          ctx.fillStyle = '#2ecc71';
          ctx.fillRect(0, -2, 14, 4);
          ctx.restore();
        }
      } else if (e.type === 'warMiner') {
        // 苏联武装采矿车
        ctx.fillStyle = '#333';
        ctx.fillRect(ux - 12, uy + 2, 24, 7);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(ux - 12, uy - 4, 24, 8);
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.arc(ux, uy - 1, 7, 0, Math.PI * 2); ctx.fill();
        // 机枪
        ctx.save();
        ctx.translate(ux + 8, uy - 2);
        ctx.rotate(e.turretDir);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, -1, 8, 2);
        ctx.restore();
        if (e.ore > 0) {
          var oh = Math.min(7, (e.ore / e.capacity) * 7);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(ux - 10, uy + 7 - oh, 3, oh);
        }
      }
    } else if (e.isAirUnit) {
      // 空军单位渲染
      if (e.type2 === TYPE_AIRCRAFT) {
        // 战机
        ctx.fillStyle = tc;
        ctx.beginPath();
        ctx.moveTo(ux + 12, uy);
        ctx.lineTo(ux - 8, uy - 8);
        ctx.lineTo(ux - 5, uy);
        ctx.lineTo(ux - 8, uy + 8);
        ctx.fill();
        // 机翼
        ctx.fillStyle = td;
        ctx.beginPath();
        ctx.moveTo(ux, uy);
        ctx.lineTo(ux - 5, uy - 12);
        ctx.lineTo(ux + 3, uy);
        ctx.lineTo(ux - 5, uy + 12);
        ctx.fill();
      } else if (e.type2 === TYPE_HELICOPTER) {
        // 直升机
        ctx.fillStyle = tc;
        ctx.fillRect(ux - 10, uy - 4, 20, 8);
        // 旋翼
        ctx.fillStyle = '#333';
        var rotorOffset = Math.sin(frameCount * 0.5) * 2;
        ctx.fillRect(ux - 12, uy - 6 + rotorOffset, 24, 2);
        // 尾翼
        ctx.fillStyle = td;
        ctx.fillRect(ux - 14, uy - 2, 6, 4);
      } else if (e.type2 === TYPE_AIRSHIP) {
        // 基洛夫空艇
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.ellipse(ux, uy, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // 吊舱
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(ux - 8, uy + 8, 16, 8);
        // 螺旋桨
        ctx.fillStyle = '#333';
        var propOffset = Math.sin(frameCount * 0.3) * 3;
        ctx.fillRect(ux - 15, uy - 12 + propOffset, 30, 2);
      }
    }

    // Muzzle flash
    if (e.muzzleFlash > 0) {
      var mdir = e.turretDir;
      var mfDist = (e.type2 === 'vehicle') ? 16 : 12;
      var mfx = ux + Math.cos(mdir) * mfDist;
      var mfy = uy + Math.sin(mdir) * mfDist;
      ctx.fillStyle = 'rgba(255,220,50,0.95)';
      ctx.beginPath(); ctx.arc(mfx, mfy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(mfx, mfy, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Movement waypoint indicator
    if (e.selected && e.path.length > 0 && e.pathIndex < e.path.length) {
      var lastWP = e.path[e.path.length - 1];
      var wpX = (lastWP.x + 0.5) * TILE_SIZE;
      var wpY = (lastWP.y + 0.5) * TILE_SIZE;
      ctx.strokeStyle = 'rgba(46,204,113,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.lineTo(wpX, wpY);
      ctx.stroke();
      ctx.setLineDash([]);
      // X marker
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wpX - 4, wpY - 4); ctx.lineTo(wpX + 4, wpY + 4);
      ctx.moveTo(wpX + 4, wpY - 4); ctx.lineTo(wpX - 4, wpY + 4);
      ctx.stroke();
    }
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

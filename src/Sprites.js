// 单位与建筑的精灵绘制
//
// 从 Renderer.js 外提出来的两个巨型方法（合计约 640 行）——它们本质上不依赖
// Renderer 实例状态（原本各只有一处 this.ctx），依赖早已全部通过参数传递，
// 因此改成显式接收 ctx 即可，绘制逻辑一行未改。
// Renderer 里保留同名薄封装，render() 的调用点不受影响。
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, GRASS, WATER, ORE, ROCK, CONCRETE, SAND, TREE,
         TEAM_PLAYER, TEAM_ENEMY, COLOR_PLAYER, COLOR_PLAYER_DARK, COLOR_ENEMY, COLOR_ENEMY_DARK,
         COLOR_ALLIED, COLOR_ALLIED_DARK, COLOR_SOVIET, COLOR_SOVIET_DARK, TYPE_AIRCRAFT, TYPE_HELICOPTER, TYPE_AIRSHIP } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS, SUPER_WEAPONS, FACTION_ALLIED, FACTION_SOVIET } from './definitions.js';
import { FPS } from './constants.js';

export function drawBuilding(ctx, e, ex, ey2, eS, tc, td, gameState, frameCount) {
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

export function drawUnit(ctx, e, ex, ey2, tc, td, frameCount) {
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

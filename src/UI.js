import { TEAM_PLAYER, TEAM_ENEMY, TILE_SIZE } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS } from './definitions.js';

export class UIManager {
  constructor() {
    this.currentTab = 'buildings';
    this.notifTimer = 0;
    this._callbacks = null;
  }

  init(callbacks) {
    this._callbacks = callbacks;
  }

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.build-tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tab);
    });
    this.updateBuildList(this._callbacks ? this._callbacks.gameState : null);
  }

  updateBuildList(gameState) {
    if (!gameState) return;
    var self = this;
    var list = document.getElementById('buildList');
    var defs = this.currentTab === 'buildings' ? BUILDING_DEFS : (this.currentTab === 'defenses' ? DEFENSE_DEFS : UNIT_DEFS);
    list.innerHTML = '';
    Object.keys(defs).forEach(function(key) {
      var def = defs[key];
      var canB = gameState.canBuild(key, TEAM_PLAYER);
      var item = document.createElement('div');
      var classes = 'build-item';
      if (!canB) classes += ' disabled';
      if (def.category === 'units') {
        var pb = self._callbacks ? self._callbacks.findProducingBuilding(key, TEAM_PLAYER) : null;
        if (pb && pb.producing === key) classes += ' active-build';
      }
      item.className = classes;

      var iconCanvas = document.createElement('canvas');
      iconCanvas.className = 'build-item-icon';
      iconCanvas.width = 44; iconCanvas.height = 44;
      self.drawBuildIcon(iconCanvas.getContext('2d'), key, def);

      var infoDiv = document.createElement('div');
      infoDiv.className = 'build-item-info';
      var nameDiv = document.createElement('div');
      nameDiv.className = 'build-item-name';
      nameDiv.textContent = def.name;
      var costDiv = document.createElement('div');
      costDiv.className = 'build-item-cost';
      var ct = '$' + def.cost;
      if (def.power) ct += '  +' + def.power + '\u26a1';
      if (def.powerUse) ct += '  -' + def.powerUse + '\u26a1';
      if (def.buildTime) ct += '  ' + def.buildTime + 's';
      costDiv.textContent = ct;
      var descDiv = document.createElement('div');
      descDiv.className = 'build-item-desc';
      descDiv.textContent = def.desc;
      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(costDiv);
      infoDiv.appendChild(descDiv);

      item.appendChild(iconCanvas);
      item.appendChild(infoDiv);

      if (def.category === 'units') {
        var pb2 = self._callbacks ? self._callbacks.findProducingBuilding(key, TEAM_PLAYER) : null;
        if (pb2 && pb2.producing === key) {
          var qb = document.createElement('div');
          qb.className = 'build-item-queue';
          qb.textContent = Math.floor(pb2.produceProgress) + '%';
          item.appendChild(qb);
        } else if (pb2 && pb2.productionQueue.indexOf(key) >= 0) {
          var qb2 = document.createElement('div');
          qb2.className = 'build-item-queue';
          qb2.textContent = '\u00d7' + pb2.productionQueue.filter(function(k) { return k === key; }).length;
          item.appendChild(qb2);
        }
      }

      if (canB) {
        item.addEventListener('click', (function(k) {
          return function() {
            if (self._callbacks && self._callbacks.startBuild) self._callbacks.startBuild(k, TEAM_PLAYER);
            if (self._callbacks && self._callbacks.playSelectSound) self._callbacks.playSelectSound();
          };
        })(key));
      }
      list.appendChild(item);
    });
  }

  updateUI(gameState, gameStartTime, selectedUnits, selectedBuilding, frameCount) {
    if (!gameState) return;
    document.getElementById('resCredits').textContent = Math.floor(gameState.playerCredits);
    var pwEl = document.getElementById('resPower');
    pwEl.textContent = gameState.playerPower + '/' + gameState.playerPowerUse;
    pwEl.className = 'res-value' + (gameState.playerPower < gameState.playerPowerUse ? ' danger' : (gameState.playerPower < gameState.playerPowerUse + 50 ? ' warn' : ''));
    var uEl = document.getElementById('resUnits');
    uEl.textContent = gameState.playerUnitCount + '/' + gameState.playerUnitMax;
    uEl.className = 'res-value' + (gameState.playerUnitCount >= gameState.playerUnitMax ? ' warn' : '');
    var el = Math.floor((Date.now() - gameStartTime) / 1000);
    var mm = Math.floor(el / 60), ss = el % 60;
    document.getElementById('gameTime').textContent = (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;

    document.getElementById('minimapStats').textContent =
      '\u6d88\u706d: ' + gameState.stats.unitsKilled + '/' + gameState.stats.buildingsKilled + 'B';

    var info = document.getElementById('selectionInfo');
    if (selectedUnits.length === 1) {
      var u = selectedUnits[0];
      info.innerHTML = '<b>' + u.name + '</b> HP:' + Math.ceil(u.hp) + '/' + u.maxHp +
        (u.damage > 0 ? ' ATK:' + u.damage + ' \u8303\u56f4:' + u.range : '') +
        (u.type2 === 'harvester' ? '<br>\u77ff\u77f3:<b>' + u.ore + '/' + u.capacity + '</b>' : '') +
        (u.veterancy > 0 ? '<br>\u7b49\u7ea7: ' + '\u2605'.repeat(u.veterancy) : '') +
        (u.kills > 0 ? ' \u51fb\u6740:' + u.kills : '');
    } else if (selectedUnits.length > 1) {
      var counts = {};
      selectedUnits.forEach(function(u) { counts[u.name] = (counts[u.name] || 0) + 1; });
      var summary = Object.keys(counts).map(function(k) { return k + '\u00d7' + counts[k]; }).join(' ');
      info.innerHTML = '<b>\u5df2\u9009 ' + selectedUnits.length + ' \u4e2a</b><br><span style="font-size:10px">' + summary + '</span>';
    } else if (selectedBuilding) {
      var b = selectedBuilding;
      var bInfo = '<b>' + b.name + '</b> HP:' + Math.ceil(b.hp) + '/' + b.maxHp;
      if (b.producing) bInfo += '<br>\u751f\u4ea7: ' + UNIT_DEFS[b.producing].name + ' <span style="color:#2ecc71">' + Math.floor(b.produceProgress) + '%</span>';
      if (b.productionQueue && b.productionQueue.length > 0) bInfo += ' [\u961f\u5217:' + b.productionQueue.length + ']';
      if (b.damage > 0) bInfo += '<br>ATK:' + b.damage + ' \u8303\u56f4:' + b.range;
      if (b.power) bInfo += '<br>\u53d1\u7535:+' + b.power;
      if (b.rallyPoint) bInfo += '<br><span style="color:#888;font-size:10px">\u96c6\u5408\u70b9\u5df2\u8bbe\u7f6e</span>';
      info.innerHTML = bInfo;
    } else {
      info.innerHTML = '<span class="info-hint">\u5de6\u952e\u9009\u62e9 \u00b7 \u53f3\u952e\u79fb\u52a8/\u653b\u51fb \u00b7 \u62d6\u62fd\u6846\u9009</span>';
    }

    document.getElementById('btnRepair').classList.toggle('disabled', gameState.getPlayerBuildings().length === 0);
    document.getElementById('btnSell').classList.toggle('disabled', gameState.getPlayerBuildings().length === 0);
    document.getElementById('btnStop').classList.toggle('disabled', selectedUnits.length === 0);

    if (frameCount % 60 === 0) this.updateBuildList(gameState);
  }

  notify(text, kind) {
    this.notifTimer = 150;
    var el = document.getElementById('notification');
    el.textContent = text;
    el.className = kind === 'warn' ? 'warn' : (kind === 'danger' ? 'danger' : '');
    el.style.display = 'block';
  }

  updateNotification() {
    if (this.notifTimer > 0) {
      this.notifTimer--;
      if (this.notifTimer <= 0) document.getElementById('notification').style.display = 'none';
    }
  }

  renderGroupBar(gameState) {
    var self = this;
    var bar = document.getElementById('groupBar');
    bar.innerHTML = '';
    for (var i = 1; i <= 9; i++) {
      var slot = document.createElement('div');
      slot.className = 'group-slot';
      var count = (gameState.controlGroups[i] || []).filter(function(id) {
        var ent = self._callbacks && self._callbacks.findEntityById ? self._callbacks.findEntityById(id) : null;
        return ent && !ent.dead;
      }).length;
      slot.textContent = i;
      if (count > 0) {
        slot.classList.add('active');
        var cb = document.createElement('div');
        cb.className = 'count';
        cb.textContent = count;
        slot.appendChild(cb);
      }
      slot.addEventListener('click', (function(n) { return function() { if (self._callbacks && self._callbacks.onSelectGroup) self._callbacks.onSelectGroup(n); }; })(i));
      bar.appendChild(slot);
    }
  }

  checkGameOver(gameState, gameStartTime, difficulty, gameRunning) {
    if (gameState.gameOver) {
      var goEl = document.getElementById('gameOver');
      goEl.style.display = 'flex';
      var gt = document.getElementById('gameOverText'), gs = document.getElementById('gameOverSub');
      if (gameState.winner === TEAM_PLAYER) {
        gt.textContent = 'VICTORY'; gt.style.color = '#2ecc71';
        gs.textContent = '\u654c\u65b9\u57fa\u5730\u5df2\u88ab\u6467\u6bc1\uff01';
      } else {
        gt.textContent = 'DEFEATED'; gt.style.color = '#c0392b';
        gs.textContent = '\u4f60\u7684\u57fa\u5730\u88ab\u6467\u6bc1\u4e86';
      }
      var statsEl = document.getElementById('gameStats');
      var elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
      var mins = Math.floor(elapsed / 60), secs = elapsed % 60;
      statsEl.innerHTML =
        '<span class="label">\u6e38\u620f\u65f6\u957f</span><span class="value">' + mins + ':' + (secs < 10 ? '0' : '') + secs + '</span>' +
        '<span class="label">\u5355\u4f4d\u51fb\u6740</span><span class="value">' + gameState.stats.unitsKilled + '</span>' +
        '<span class="label">\u5efa\u7b51\u6467\u6bc1</span><span class="value">' + gameState.stats.buildingsKilled + '</span>' +
        '<span class="label">\u5355\u4f4d\u635f\u5931</span><span class="value">' + gameState.stats.unitsLost + '</span>' +
        '<span class="label">\u5efa\u7b51\u635f\u5931</span><span class="value">' + gameState.stats.buildingsLost + '</span>' +
        '<span class="label">\u77ff\u77f3\u91c7\u96c6</span><span class="value">$' + gameState.stats.oreGathered + '</span>' +
        '<span class="label">\u96be\u5ea6</span><span class="value">' + difficulty.toUpperCase() + '</span>';
      return false;
    }
    return gameRunning;
  }

  drawBuildIcon(c, type, def) {
    c.fillStyle = '#0a0a14';
    c.fillRect(0, 0, 44, 44);
    if (BUILDING_DEFS[type] || DEFENSE_DEFS[type]) {
      c.fillStyle = '#1a5276';
      c.fillRect(4, 4, 36, 36);
      c.fillStyle = '#4a9fd4';
      c.fillRect(6, 6, 32, 32);
      c.fillStyle = def.icon;
      c.fillRect(10, 10, 24, 24);
      if (type === 'powerPlant') {
        c.fillStyle = '#fff'; c.font = 'bold 16px Arial'; c.textAlign = 'center';
        c.fillText('\u26a1', 22, 28);
      } else if (type === 'refinery') {
        c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.textAlign = 'center';
        c.fillText('$', 22, 28);
      } else if (type === 'barracks') {
        c.fillStyle = '#fff'; c.font = 'bold 12px Arial'; c.textAlign = 'center';
        c.fillText('\u5175', 22, 27);
      } else if (type === 'warFactory') {
        c.fillStyle = '#fff'; c.font = 'bold 12px Arial'; c.textAlign = 'center';
        c.fillText('\u8f66', 22, 27);
      } else if (type === 'radar') {
        c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.textAlign = 'center';
        c.fillText('\u25c9', 22, 28);
      } else if (type === 'techCenter') {
        c.fillStyle = '#fff'; c.font = 'bold 12px Arial'; c.textAlign = 'center';
        c.fillText('\u79d1', 22, 27);
      } else if (type === 'tesla') {
        c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.textAlign = 'center';
        c.fillText('\u26a1', 22, 28);
      }
    } else {
      c.fillStyle = '#1a2a3a';
      c.fillRect(4, 4, 36, 36);
      c.fillStyle = def.icon;
      if (def.type === 'infantry') {
        c.fillRect(18, 12, 8, 12);
        c.beginPath(); c.arc(22, 10, 3, 0, Math.PI * 2); c.fill();
        c.fillRect(17, 24, 4, 10);
        c.fillRect(23, 24, 4, 10);
      } else if (def.type === 'harvester') {
        c.fillRect(8, 16, 28, 14);
        c.fillStyle = '#f1c40f'; c.fillRect(4, 18, 6, 10);
      } else {
        c.fillRect(8, 18, 28, 14);
        c.fillStyle = def.icon; c.beginPath(); c.arc(22, 22, 7, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#222'; c.fillRect(22, 20, 12, 4);
      }
    }
    c.textAlign = 'left';
  }

  showStartScreen() {
    document.getElementById('startScreen').style.display = 'flex';
  }

  hideStartScreen() {
    document.getElementById('startScreen').style.display = 'none';
  }

  hideGameOver() {
    document.getElementById('gameOver').style.display = 'none';
  }

  showHelp() {
    document.getElementById('helpOverlay').style.display = 'flex';
  }

  hideHelp() {
    document.getElementById('helpOverlay').style.display = 'none';
  }
}

import { TEAM_PLAYER, TEAM_ENEMY, TILE_SIZE } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS, FACTION_ALLIED, FACTION_NAMES } from './definitions.js';

// 单位面板按兵种分组，避免步兵/坦克/飞机/舰船混排
const UNIT_GROUPS = [
  { label: '\u6b65\u5175', types: ['infantry'] },
  { label: '\u88c5\u7532\u8f66\u8f86', types: ['vehicle'] },
  { label: '\u91c7\u77ff', types: ['harvester'] },
  { label: '\u7a7a\u519b', types: ['aircraft', 'helicopter', 'airship'] },
  { label: '\u6d77\u519b', types: ['naval'] }
];

export class UIManager {
  constructor() {
    this.currentTab = 'buildings';
    this.notifTimer = 0;
    this._callbacks = null;
    this._dom = null;       // 缓存的 DOM 引用
    this._buildItems = {};  // 缓存建造列表项 DOM { key: { item, queueBadge } }
    this._lastBuildListKey = ''; // 上次渲染的 tab+canBuild 签名
    this._swItems = {};     // 超武面板缓存 { type: { item, barFill, status, ready, lastPct, lastState } }
    this._swSig = '';       // 超武面板已渲染的武器类型签名
    this._lastUI = {};      // updateUI 变更检测缓存，避免每帧重复写 DOM
  }

  init(callbacks) {
    this._callbacks = callbacks;
    this._cacheDOM();
  }

  _cacheDOM() {
    this._dom = {
      resCredits: document.getElementById('resCredits'),
      resPower: document.getElementById('resPower'),
      resUnits: document.getElementById('resUnits'),
      gameTime: document.getElementById('gameTime'),
      minimapStats: document.getElementById('minimapStats'),
      selectionInfo: document.getElementById('selectionInfo'),
      buildList: document.getElementById('buildList'),
      notification: document.getElementById('notification'),
      groupBar: document.getElementById('groupBar'),
      btnRepair: document.getElementById('btnRepair'),
      btnSell: document.getElementById('btnSell'),
      btnStop: document.getElementById('btnStop'),
      gameOver: document.getElementById('gameOver'),
      gameOverText: document.getElementById('gameOverText'),
      gameOverSub: document.getElementById('gameOverSub'),
      gameStats: document.getElementById('gameStats'),
      startScreen: document.getElementById('startScreen'),
      helpOverlay: document.getElementById('helpOverlay'),
      swList: document.getElementById('swList'),
      superWeaponPanel: document.getElementById('superWeaponPanel')
    };
  }

  switchTab(tab) {
    this.currentTab = tab;
    this._lastBuildListKey = ''; // 强制重建
    document.querySelectorAll('.build-tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tab);
    });
    this.updateBuildList(this._callbacks ? this._callbacks.gameState : null);
  }

  updateBuildList(gameState) {
    if (!gameState) return;
    var self = this;
    var list = this._dom.buildList;
    var defs = this.currentTab === 'buildings' ? BUILDING_DEFS : (this.currentTab === 'defenses' ? DEFENSE_DEFS : UNIT_DEFS);
    var myFaction = gameState.getFaction(TEAM_PLAYER);
    // 只列出本阵营与通用单位：盟军的建造列表里混着天启坦克会让人无从下手
    var keys = Object.keys(defs).filter(function(k) {
      var d = defs[k];
      return !d.faction || !myFaction || d.faction === myFaction;
    });

    // 计算当前可建造状态的签名，判断是否需要重建整个列表
    var sigParts = [this.currentTab, myFaction || ''];
    var canBuildMap = {};
    for (var si = 0; si < keys.length; si++) {
      var k = keys[si];
      var cb = gameState.canBuild(k, TEAM_PLAYER);
      canBuildMap[k] = cb;
      sigParts.push(k + (cb ? '1' : '0'));
    }
    var sig = sigParts.join('|');

    if (sig === this._lastBuildListKey) {
      // 签名相同：仅增量更新进度文字
      for (var ui = 0; ui < keys.length; ui++) {
        var uk = keys[ui];
        var def = defs[uk];
        if (def.category !== 'units') continue;
        var cached = this._buildItems[uk];
        if (!cached) continue;
        var pb = self._callbacks ? self._callbacks.findProducingBuilding(uk, TEAM_PLAYER) : null;
        if (pb && pb.producing === uk) {
          if (!cached.queueBadge) {
            var qb = document.createElement('div');
            qb.className = 'build-item-queue';
            cached.item.appendChild(qb);
            cached.queueBadge = qb;
          }
          cached.queueBadge.textContent = Math.floor(pb.produceProgress) + '%';
        } else if (pb && pb.productionQueue.indexOf(uk) >= 0) {
          if (!cached.queueBadge) {
            var qb2 = document.createElement('div');
            qb2.className = 'build-item-queue';
            cached.item.appendChild(qb2);
            cached.queueBadge = qb2;
          }
          cached.queueBadge.textContent = '\u00d7' + pb.productionQueue.filter(function(x) { return x === uk; }).length;
        } else {
          if (cached.queueBadge) { cached.queueBadge.remove(); cached.queueBadge = null; }
        }
      }
      return;
    }

    // 签名变化：完全重建列表
    this._lastBuildListKey = sig;
    this._buildItems = {};
    list.innerHTML = '';

    var renderItem = function(key) {
      var def = defs[key];
      var canB = canBuildMap[key];
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
      if (def.faction) {
        var fTag = document.createElement('span');
        fTag.className = 'build-item-faction faction-' + def.faction;
        fTag.textContent = FACTION_NAMES[def.faction] || def.faction;
        nameDiv.appendChild(fTag);
      }
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
      // 不可建造时把原因直接写在条目上。原先只是变灰且不响应点击，
      // 玩家点下去毫无反应，根本不知道缺的是科技还是电力
      if (!canB) {
        var why = gameState.getBuildReason(key, TEAM_PLAYER);
        if (why) {
          var rSpan = document.createElement('span');
          rSpan.className = 'build-item-reason';
          rSpan.textContent = ' \u00b7 ' + why;
          descDiv.appendChild(rSpan);
        }
      }
      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(costDiv);
      infoDiv.appendChild(descDiv);

      item.appendChild(iconCanvas);
      item.appendChild(infoDiv);

      var queueBadge = null;
      if (def.category === 'units') {
        var pb2 = self._callbacks ? self._callbacks.findProducingBuilding(key, TEAM_PLAYER) : null;
        if (pb2 && pb2.producing === key) {
          queueBadge = document.createElement('div');
          queueBadge.className = 'build-item-queue';
          queueBadge.textContent = Math.floor(pb2.produceProgress) + '%';
          item.appendChild(queueBadge);
        } else if (pb2 && pb2.productionQueue.indexOf(key) >= 0) {
          queueBadge = document.createElement('div');
          queueBadge.className = 'build-item-queue';
          queueBadge.textContent = '\u00d7' + pb2.productionQueue.filter(function(x) { return x === key; }).length;
          item.appendChild(queueBadge);
        }
      }

      // 无论能否建造都绑定点击：不可建造时弹出原因，而不是毫无反应
      item.addEventListener('click', (function(k, canBuild) {
        return function() {
          if (!self._callbacks) return;
          if (canBuild) {
            if (self._callbacks.startBuild) self._callbacks.startBuild(k, TEAM_PLAYER);
            if (self._callbacks.playSelectSound) self._callbacks.playSelectSound();
          } else {
            var reason = gameState.getBuildReason(k, TEAM_PLAYER);
            if (reason && self._callbacks.onNotify) self._callbacks.onNotify(reason, 'warn');
            if (self._callbacks.playCancelSound) self._callbacks.playCancelSound();
          }
        };
      })(key, canB));

      list.appendChild(item);
      self._buildItems[key] = { item: item, queueBadge: queueBadge };
    };

    if (this.currentTab === 'units') {
      UNIT_GROUPS.forEach(function(g) {
        var gk = keys.filter(function(k) { return g.types.indexOf(defs[k].type) >= 0; });
        if (gk.length === 0) return;
        var header = document.createElement('div');
        header.className = 'build-group-header';
        header.textContent = g.label;
        list.appendChild(header);
        gk.forEach(renderItem);
      });
    } else {
      keys.forEach(renderItem);
    }
  }

  updateUI(gameState, gameStartTime, selectedUnits, selectedBuilding, frameCount) {
    if (!gameState) return;
    var dom = this._dom;
    var last = this._lastUI;

    var creditsText = String(Math.floor(gameState.playerCredits));
    if (last.credits !== creditsText) { last.credits = creditsText; dom.resCredits.textContent = creditsText; }

    var powerText = gameState.playerPower + '/' + gameState.playerPowerUse;
    var powerClass = 'res-value' + (gameState.playerPower < gameState.playerPowerUse ? ' danger' : (gameState.playerPower < gameState.playerPowerUse + 50 ? ' warn' : ''));
    if (last.power !== powerText || last.powerClass !== powerClass) {
      last.power = powerText; last.powerClass = powerClass;
      dom.resPower.textContent = powerText;
      dom.resPower.className = powerClass;
    }

    var unitsText = gameState.playerUnitCount + '/' + gameState.playerUnitMax;
    var unitsClass = 'res-value' + (gameState.playerUnitCount >= gameState.playerUnitMax ? ' warn' : '');
    if (last.units !== unitsText || last.unitsClass !== unitsClass) {
      last.units = unitsText; last.unitsClass = unitsClass;
      dom.resUnits.textContent = unitsText;
      dom.resUnits.className = unitsClass;
    }

    var el = Math.floor((Date.now() - gameStartTime) / 1000);
    var mm = Math.floor(el / 60), ss = el % 60;
    var timeText = (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
    if (last.time !== timeText) { last.time = timeText; dom.gameTime.textContent = timeText; }

    var statsText = '\u6d88\u706d: ' + gameState.stats.unitsKilled + '/' + gameState.stats.buildingsKilled + 'B';
    if (last.stats !== statsText) { last.stats = statsText; dom.minimapStats.textContent = statsText; }

    var infoHtml;
    if (selectedUnits.length === 1) {
      var u = selectedUnits[0];
      infoHtml = '<b>' + u.name + '</b> HP:' + Math.ceil(u.hp) + '/' + u.maxHp +
        (u.damage > 0 ? ' ATK:' + u.damage + ' \u8303\u56f4:' + u.range : '') +
        (u.type2 === 'harvester' ? '<br>\u77ff\u77f3:<b>' + u.ore + '/' + u.capacity + '</b>' : '') +
        (u.veterancy > 0 ? '<br>\u7b49\u7ea7: ' + '\u2605'.repeat(u.veterancy) : '') +
        (u.kills > 0 ? ' \u51fb\u6740:' + u.kills : '');
    } else if (selectedUnits.length > 1) {
      var counts = {};
      selectedUnits.forEach(function(un) { counts[un.name] = (counts[un.name] || 0) + 1; });
      var summary = Object.keys(counts).map(function(k) { return k + '\u00d7' + counts[k]; }).join(' ');
      infoHtml = '<b>\u5df2\u9009 ' + selectedUnits.length + ' \u4e2a</b><br><span style="font-size:10px">' + summary + '</span>';
    } else if (selectedBuilding) {
      var b = selectedBuilding;
      infoHtml = '<b>' + b.name + '</b> HP:' + Math.ceil(b.hp) + '/' + b.maxHp;
      if (b.producing) infoHtml += '<br>\u751f\u4ea7: ' + UNIT_DEFS[b.producing].name + ' <span style="color:#2ecc71">' + Math.floor(b.produceProgress) + '%</span>';
      if (b.productionQueue && b.productionQueue.length > 0) infoHtml += ' [\u961f\u5217:' + b.productionQueue.length + ']';
      if (b.damage > 0) infoHtml += '<br>ATK:' + b.damage + ' \u8303\u56f4:' + b.range;
      if (b.power) infoHtml += '<br>\u53d1\u7535:+' + b.power;
      if (b.rallyPoint) infoHtml += '<br><span style="color:#888;font-size:10px">\u96c6\u5408\u70b9\u5df2\u8bbe\u7f6e</span>';
    } else {
      infoHtml = '<span class="info-hint">\u5de6\u952e\u9009\u62e9 \u00b7 \u53f3\u952e\u79fb\u52a8/\u653b\u51fb \u00b7 \u62d6\u62fd\u6846\u9009</span>';
    }
    if (last.info !== infoHtml) { last.info = infoHtml; dom.selectionInfo.innerHTML = infoHtml; }

    var playerBuildings = gameState.getPlayerBuildings();
    var hasBuildings = playerBuildings.length > 0;
    var noSel = selectedUnits.length === 0;
    // 只在状态变化时 toggle class，避免每帧触发
    if (dom.btnRepair.classList.contains('disabled') === hasBuildings) dom.btnRepair.classList.toggle('disabled', !hasBuildings);
    if (dom.btnSell.classList.contains('disabled') === hasBuildings) dom.btnSell.classList.toggle('disabled', !hasBuildings);
    if (dom.btnStop.classList.contains('disabled') !== noSel) dom.btnStop.classList.toggle('disabled', noSel);

    if (frameCount % 30 === 0) this.updateBuildList(gameState);
  }

  updateSuperWeapons(gameState, superWeaponTargeting) {
    var dom = this._dom;
    var swm = gameState.superWeaponManager;
    if (!swm || !dom.swList || !dom.superWeaponPanel) return;
    var panel = dom.superWeaponPanel;
    var weapons = swm.getAllSuperWeapons(TEAM_PLAYER);
    if (weapons.length === 0) {
      panel.classList.add('hidden');
      this._swItems = {};
      this._swSig = '';
      return;
    }
    panel.classList.remove('hidden');

    var sig = '';
    for (var si = 0; si < weapons.length; si++) sig += weapons[si].type + ',';
    if (sig !== this._swSig) this._rebuildSwPanel(weapons);

    for (var i = 0; i < weapons.length; i++) {
      var w = weapons[i];
      var cached = this._swItems[w.type];
      if (!cached) continue;
      cached.ready = w.ready;
      var pct = w.ready ? 100 : Math.min(99, Math.floor(w.timer / w.cooldown * 100));
      if (pct !== cached.lastPct) {
        cached.lastPct = pct;
        cached.barFill.style.width = pct + '%';
      }
      var targeting = superWeaponTargeting === w.type ||
        (superWeaponTargeting === '__chronoDest' && w.type === 'chrono');
      var state = targeting ? 'targeting' : (w.ready ? 'ready' : 'charging:' + pct);
      if (state !== cached.lastState) {
        cached.lastState = state;
        cached.item.className = 'sw-item' + (targeting ? ' targeting' : (w.ready ? ' ready' : ''));
        cached.status.textContent = targeting ? '\u9009\u62e9\u76ee\u6807...' : (w.ready ? '\u5c31\u7eea' : pct + '%');
      }
    }
  }

  _rebuildSwPanel(weapons) {
    var self = this;
    var list = this._dom.swList;
    this._swSig = '';
    this._swItems = {};
    list.innerHTML = '';
    weapons.forEach(function(w) {
      self._swSig += w.type + ',';
      var def = w.def || {};
      var item = document.createElement('div');
      item.className = 'sw-item';
      if (def.description) item.title = def.description;
      var name = document.createElement('div');
      name.className = 'sw-name';
      name.textContent = def.name || w.type;
      var bar = document.createElement('div');
      bar.className = 'sw-bar';
      var barFill = document.createElement('div');
      barFill.className = 'sw-bar-fill';
      barFill.style.width = '0%';
      bar.appendChild(barFill);
      var status = document.createElement('div');
      status.className = 'sw-status';
      status.textContent = '0%';
      item.appendChild(name);
      item.appendChild(bar);
      item.appendChild(status);
      var cached = { item: item, barFill: barFill, status: status, ready: false, lastPct: -1, lastState: '' };
      item.addEventListener('click', function() {
        if (!cached.ready) {
          if (self._callbacks && self._callbacks.onNotify) self._callbacks.onNotify('\u8d85\u7ea7\u6b66\u5668\u5c1a\u672a\u5c31\u7eea', 'warn');
          return;
        }
        if (self._callbacks && self._callbacks.onSuperWeaponClick) self._callbacks.onSuperWeaponClick(w.type);
      });
      list.appendChild(item);
      self._swItems[w.type] = cached;
    });
  }

  notify(text, kind) {
    this.notifTimer = 150;
    var el = this._dom.notification;
    el.textContent = text;
    el.className = kind === 'warn' ? 'warn' : (kind === 'danger' ? 'danger' : '');
    el.style.display = 'block';
  }

  updateNotification() {
    if (this.notifTimer > 0) {
      this.notifTimer--;
      if (this.notifTimer <= 0) this._dom.notification.style.display = 'none';
    }
  }

  renderGroupBar(gameState) {
    var self = this;
    var bar = this._dom.groupBar;
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
      var dom = this._dom;
      dom.gameOver.style.display = 'flex';
      if (gameState.winner === TEAM_PLAYER) {
        dom.gameOverText.textContent = 'VICTORY'; dom.gameOverText.style.color = '#2ecc71';
        dom.gameOverSub.textContent = '\u654c\u65b9\u57fa\u5730\u5df2\u88ab\u6467\u6bc1\uff01';
      } else {
        dom.gameOverText.textContent = 'DEFEATED'; dom.gameOverText.style.color = '#c0392b';
        dom.gameOverSub.textContent = '\u4f60\u7684\u57fa\u5730\u88ab\u6467\u6bc1\u4e86';
      }
      var elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
      var mins = Math.floor(elapsed / 60), secs = elapsed % 60;
      dom.gameStats.innerHTML =
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
    
    // 根据阵营确定颜色
    var factionColor = '#1a5276', factionLight = '#4a9fd4';
    if (def.faction === 'soviet') {
      factionColor = '#7b241c';
      factionLight = '#c0392b';
    } else if (def.faction === 'allied') {
      factionColor = '#1a5276';
      factionLight = '#4a9fd4';
    }
    
    if (BUILDING_DEFS[type] || DEFENSE_DEFS[type]) {
      c.fillStyle = factionColor;
      c.fillRect(4, 4, 36, 36);
      c.fillStyle = factionLight;
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
    this._dom.startScreen.style.display = 'flex';
  }

  hideStartScreen() {
    this._dom.startScreen.style.display = 'none';
  }

  hideGameOver() {
    this._dom.gameOver.style.display = 'none';
  }

  showHelp() {
    this._dom.helpOverlay.style.display = 'flex';
  }

  hideHelp() {
    this._dom.helpOverlay.style.display = 'none';
  }
}

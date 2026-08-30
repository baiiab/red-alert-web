import { TEAM_PLAYER, TEAM_ENEMY, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, CONCRETE } from './constants.js';
import { BUILDING_DEFS, DEFENSE_DEFS, UNIT_DEFS } from './definitions.js';

export class InputHandler {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.minimapCanvas = minimapCanvas;
    this.keys = {};
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, mapX: 0, mapY: 0, down: false, inCanvas: false };
    this.dragSelect = { active: false, startX: 0, startY: 0, endX: 0, endY: 0 };
    this.pendingAttackMove = false;
    this._callbacks = null;
    this._gameState = null;
    this._camera = null;
    this.lastNumberKey = 0;
    this.lastNumberTime = 0;
  }

  /**
   * 读档后重新绑定世界与相机。
   * 读档会构造全新的 GameState / camera 对象，而 setup 中的事件闭包捕获的是
   * 初次 setup 时的引用。若不重新绑定，读档后所有鼠标操作（点选、框选、建造放置、
   * 移动命令、滚轮缩放、小地图导航）都会作用在读档前的旧世界上。
   */
  rebind(gameState, camera) {
    this._gameState = gameState;
    this._camera = camera;
  }

  setup(gameState, camera, callbacks) {
    this._gameState = gameState;
    this._camera = camera;
    this._callbacks = callbacks;
    var self = this;
    var canvas = this.canvas;
    var mouse = this.mouse;
    var dragSelect = this.dragSelect;

    canvas.addEventListener('mousemove', function(ev) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = ev.clientX - rect.left;
      mouse.y = ev.clientY - rect.top;
      var viewW = canvas.width - 300;
      var viewH = canvas.height;
      mouse.inCanvas = (mouse.x >= 0 && mouse.x < viewW && mouse.y >= 0 && mouse.y < viewH);
      var clampedX = Math.max(0, Math.min(viewW, mouse.x));
      var clampedY = Math.max(0, Math.min(viewH, mouse.y));
      mouse.worldX = (clampedX + self._camera.x) / self._camera.zoom;
      mouse.worldY = (clampedY + self._camera.y) / self._camera.zoom;
      mouse.mapX = Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor(mouse.worldX / TILE_SIZE)));
      mouse.mapY = Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor(mouse.worldY / TILE_SIZE)));
      if (dragSelect.active) { dragSelect.endX = mouse.x; dragSelect.endY = mouse.y; }
    });

    canvas.addEventListener('mousedown', function(ev) {
      if (ev.button === 0) {
        if (callbacks.superWeaponTargeting && mouse.inCanvas) {
          if (callbacks.onSuperWeaponFire) callbacks.onSuperWeaponFire(callbacks.superWeaponTargeting, mouse.mapX, mouse.mapY);
          return;
        }
        if (callbacks.activeAction === 'repair') {
          var clk = self._gameState.getEntityAt(mouse.worldX, mouse.worldY);
          if (clk && clk.team === TEAM_PLAYER && clk.isBuilding && !clk.dead) callbacks.onRepair(clk);
          return;
        }
        if (callbacks.activeAction === 'sell') {
          var clk2 = self._gameState.getEntityAt(mouse.worldX, mouse.worldY);
          if (clk2 && clk2.team === TEAM_PLAYER && clk2.isBuilding && !clk2.dead) callbacks.onSell(clk2);
          return;
        }
        if (callbacks.placingBuilding && callbacks.placingType && mouse.inCanvas) {
          var pDef = BUILDING_DEFS[callbacks.placingType] || DEFENSE_DEFS[callbacks.placingType];
          if (pDef && self._gameState.map.isBuildable(mouse.mapX, mouse.mapY, pDef.size) &&
              self._gameState.map.isNearBuilding(mouse.mapX, mouse.mapY, pDef.size, TEAM_PLAYER)) {
            self._gameState.playerCredits -= pDef.cost;
            var nb = self._gameState.spawnEntity(callbacks.placingType, TEAM_PLAYER, mouse.mapX, mouse.mapY);
            for (var ci = 0; ci < nb.size; ci++) for (var cj = 0; cj < nb.size; cj++) {
              if (mouse.mapY + ci < MAP_HEIGHT && mouse.mapX + cj < MAP_WIDTH) self._gameState.map.terrain[mouse.mapY + ci][mouse.mapX + cj] = CONCRETE;
            }
            if (!ev.shiftKey) { callbacks.placingBuilding = false; callbacks.placingType = null; }
            callbacks.onNotify(pDef.name + ' \u5f00\u59cb\u5efa\u9020', 'info');
            callbacks.onPlayBuildSound();
          } else { callbacks.onNotify('\u65e0\u6cd5\u5728\u6b64\u5904\u5efa\u9020', 'warn'); callbacks.onPlayCancelSound(); }
          return;
        }
        if (self.pendingAttackMove && callbacks.selectedUnits.length > 0 && mouse.inCanvas) {
          var amTarget = self._gameState.getEntityAt(mouse.worldX, mouse.worldY);
          if (amTarget && amTarget.team !== TEAM_PLAYER && !amTarget.dead) {
            callbacks.selectedUnits.forEach(function(u) {
              u.attackTarget = amTarget; u.path = []; u.pathIndex = 0;
              u.attackMoveTarget = null; u.guardPos = null;
            });
            self._gameState.addFloatingText(amTarget.getCenterX(), amTarget.getCenterY() - 15, '\u653b\u51fb!', '#e74c3c');
          } else {
            var amx = mouse.mapX, amy = mouse.mapY;
            callbacks.selectedUnits.forEach(function(u) {
              u.attackTarget = null;
              u.attackMoveTarget = { x: amx, y: amy };
              u.guardPos = null;
              u.path = self._gameState.map.findPath(Math.floor(u.x), Math.floor(u.y), amx, amy, 3000, u, true);
              u.pathIndex = 0;
            });
            self._gameState.addFloatingText(mouse.worldX, mouse.worldY, 'A\u2192', '#e67e22');
          }
          self.pendingAttackMove = false;
          return;
        }
        dragSelect.active = true;
        dragSelect.startX = mouse.x; dragSelect.startY = mouse.y;
        dragSelect.endX = mouse.x; dragSelect.endY = mouse.y;
      }
    });

    canvas.addEventListener('mouseup', function(ev) {
      if (ev.button === 0 && dragSelect.active) {
        var dx = Math.abs(dragSelect.endX - dragSelect.startX);
        var dy = Math.abs(dragSelect.endY - dragSelect.startY);
        if (dx > 8 || dy > 8) {
          var wx1 = (Math.min(dragSelect.startX, dragSelect.endX) + self._camera.x) / self._camera.zoom;
          var wy1 = (Math.min(dragSelect.startY, dragSelect.endY) + self._camera.y) / self._camera.zoom;
          var wx2 = (Math.max(dragSelect.startX, dragSelect.endX) + self._camera.x) / self._camera.zoom;
          var wy2 = (Math.max(dragSelect.startY, dragSelect.endY) + self._camera.y) / self._camera.zoom;
          if (!ev.shiftKey) {
            callbacks.selectedUnits.forEach(function(u) { u.selected = false; });
            callbacks.selectedUnits.length = 0;
            if (callbacks.selectedBuilding) { callbacks.selectedBuilding.selected = false; callbacks.selectedBuilding = null; }
          }
          var bu = self._gameState.getEntitiesInRect(wx1, wy1, wx2, wy2);
          bu.forEach(function(u) {
            if (callbacks.selectedUnits.indexOf(u) < 0) { u.selected = true; callbacks.selectedUnits.push(u); }
          });
          if (bu.length > 0) callbacks.onPlaySelectSound();
        } else {
          var clicked = self._gameState.getEntityAt(mouse.worldX, mouse.worldY);
          if (clicked && clicked.team === TEAM_PLAYER && !clicked.dead) {
            if (clicked.isBuilding) {
              callbacks.selectedUnits.forEach(function(u) { u.selected = false; });
              callbacks.selectedUnits.length = 0;
              if (callbacks.selectedBuilding) callbacks.selectedBuilding.selected = false;
              callbacks.selectedBuilding = clicked; clicked.selected = true;
            } else {
              if (ev.shiftKey) {
                if (callbacks.selectedUnits.indexOf(clicked) >= 0) {
                  clicked.selected = false;
                  var idx = callbacks.selectedUnits.indexOf(clicked);
                  if (idx >= 0) callbacks.selectedUnits.splice(idx, 1);
                } else { clicked.selected = true; callbacks.selectedUnits.push(clicked); }
              } else {
                callbacks.selectedUnits.forEach(function(u) { u.selected = false; });
                callbacks.selectedUnits.length = 0;
                if (callbacks.selectedBuilding) { callbacks.selectedBuilding.selected = false; callbacks.selectedBuilding = null; }
                clicked.selected = true; callbacks.selectedUnits.push(clicked);
              }
            }
            callbacks.onPlaySelectSound();
          } else if (ev.shiftKey) {
            var dbl = self._gameState.getEntityAt(mouse.worldX, mouse.worldY);
            if (!dbl) {
              if (!ev.shiftKey) {
                callbacks.selectedUnits.forEach(function(u) { u.selected = false; });
                callbacks.selectedUnits.length = 0;
                if (callbacks.selectedBuilding) { callbacks.selectedBuilding.selected = false; callbacks.selectedBuilding = null; }
              }
            }
          } else if (!clicked) {
            callbacks.selectedUnits.forEach(function(u) { u.selected = false; });
            callbacks.selectedUnits.length = 0;
            if (callbacks.selectedBuilding) { callbacks.selectedBuilding.selected = false; callbacks.selectedBuilding = null; }
          }
        }
        dragSelect.active = false;
      }
    });

    canvas.addEventListener('contextmenu', function(ev) {
      ev.preventDefault();
      self.pendingAttackMove = false;
      if (callbacks.superWeaponTargeting) { callbacks.superWeaponTargeting = null; if (callbacks.onNotify) callbacks.onNotify('\u5df2\u53d6\u6d88', 'info'); return; }
      if (callbacks.placingBuilding) { callbacks.placingBuilding = false; callbacks.placingType = null; callbacks.onPlayCancelSound(); return; }
      if (callbacks.activeAction) {
        callbacks.activeAction = null;
        document.getElementById('btnRepair').classList.remove('active');
        document.getElementById('btnSell').classList.remove('active');
        return;
      }
      var rc = self._gameState.getEntityAt(mouse.worldX, mouse.worldY);
      if (callbacks.selectedUnits.length > 0) {
        if (rc && rc.team !== TEAM_PLAYER && !rc.dead) {
          callbacks.selectedUnits.forEach(function(u) {
            u.attackTarget = rc; u.path = []; u.pathIndex = 0;
            u.attackMoveTarget = null; u.guardPos = null;
          });
          self._gameState.addFloatingText(rc.getCenterX(), rc.getCenterY() - 15, '\u76ee\u6807!', '#e74c3c');
          callbacks.onNotify('\u653b\u51fb ' + rc.name, 'info');
        } else if (rc && rc.team === TEAM_PLAYER && rc.isBuilding && !rc.dead) {
          callbacks.selectedUnits.forEach(function(u) {
            if (u.canRepair) { u.attackTarget = rc; u.path = []; u.pathIndex = 0; }
            else u.guardPos = { x: Math.floor(rc.x), y: Math.floor(rc.y) };
          });
          callbacks.onNotify('\u62a4\u536b ' + rc.name, 'info');
        } else {
          var cx = mouse.mapX, cy = mouse.mapY;
          var spread = Math.ceil(Math.sqrt(callbacks.selectedUnits.length));
          callbacks.selectedUnits.forEach(function(u, idx) {
            var ox = idx % spread - Math.floor(spread / 2);
            var oy = Math.floor(idx / spread) - Math.floor(spread / 2);
            var tx2 = Math.max(0, Math.min(MAP_WIDTH - 1, cx + ox));
            var ty2 = Math.max(0, Math.min(MAP_HEIGHT - 1, cy + oy));
            u.attackTarget = null;
            u.attackMoveTarget = null;
            u.guardPos = null;
            u.burstRemaining = 0;
            u.path = self._gameState.map.findPath(Math.floor(u.x), Math.floor(u.y), tx2, ty2, 3000, u, true);
            u.pathIndex = 0;
          });
          self._gameState.addFloatingText(mouse.worldX, mouse.worldY, '\u2192', '#2ecc71');
        }
      }
      if (callbacks.selectedBuilding && callbacks.selectedBuilding.isBuilding) {
        if (rc && rc.team !== TEAM_PLAYER && !rc.dead) {
          callbacks.selectedBuilding.rallyPoint = { x: Math.floor(rc.x), y: Math.floor(rc.y) };
          callbacks.onNotify('\u96c6\u5408\u70b9 \u2192 ' + rc.name, 'info');
        } else {
          callbacks.selectedBuilding.rallyPoint = { x: mouse.mapX, y: mouse.mapY };
          callbacks.onNotify('\u96c6\u5408\u70b9\u5df2\u8bbe\u7f6e', 'info');
        }
      }
    });

    document.addEventListener('keydown', function(ev) {
      self.keys[ev.code] = true;
      if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;

      if (ev.code === 'Escape') {
        if (callbacks.superWeaponTargeting) { callbacks.superWeaponTargeting = null; }
        else if (callbacks.placingBuilding) { callbacks.placingBuilding = false; callbacks.placingType = null; }
        else if (callbacks.activeAction) {
          callbacks.activeAction = null;
          document.getElementById('btnRepair').classList.remove('active');
          document.getElementById('btnSell').classList.remove('active');
        } else {
          callbacks.selectedUnits.forEach(function(u) { u.selected = false; });
          callbacks.selectedUnits.length = 0;
          if (callbacks.selectedBuilding) { callbacks.selectedBuilding.selected = false; callbacks.selectedBuilding = null; }
          callbacks.onHideHelp();
        }
      }
      if (ev.code === 'Delete' || ev.code === 'Backspace') {
        if (callbacks.selectedUnits.length > 0) {
          callbacks.selectedUnits.forEach(function(u) {
            u.selected = false;
            self._gameState.removeEntity(u);
          });
          callbacks.selectedUnits.length = 0;
          callbacks.onNotify('\u5df2\u5220\u9664\u9009\u4e2d\u5355\u4f4d', 'info');
        }
      }
      if (ev.code === 'Space') { ev.preventDefault(); callbacks.onTogglePause(); }
      if (ev.code === 'KeyH' && !ev.ctrlKey) { ev.preventDefault(); callbacks.onShowHelp(); }
      if (ev.code === 'KeyS' && !ev.ctrlKey && callbacks.selectedUnits.length > 0) { ev.preventDefault(); callbacks.onCommandStop(); }
      if (ev.code === 'KeyA' && !ev.ctrlKey && callbacks.selectedUnits.length > 0) {
        ev.preventDefault();
        callbacks.onNotify('\u653b\u51fb\u6a21\u5f0f\uff1a\u79fb\u52a8\u5e76\u653b\u51fb\u6cbf\u9014\u654c\u4eba', 'info');
        self.pendingAttackMove = true;
      }
      if (ev.code === 'KeyG' && callbacks.selectedUnits.length > 0) {
        ev.preventDefault();
        callbacks.selectedUnits.forEach(function(u) {
          u.guardPos = { x: Math.floor(u.x), y: Math.floor(u.y) };
          u.path = []; u.pathIndex = 0; u.attackTarget = null;
        });
        callbacks.onNotify('\u5b88\u536b\u5f53\u524d\u4f4d\u7f6e', 'info');
      }
      if (ev.code === 'KeyA' && ev.ctrlKey) {
        ev.preventDefault();
        callbacks.selectedUnits.forEach(function(u) { u.selected = false; });
        var allUnits = self._gameState.getPlayerUnits();
        callbacks.selectedUnits.length = 0;
        allUnits.forEach(function(u) { u.selected = true; callbacks.selectedUnits.push(u); });
        if (callbacks.selectedBuilding) { callbacks.selectedBuilding.selected = false; callbacks.selectedBuilding = null; }
        callbacks.onPlaySelectSound();
      }
      if (ev.code === 'Home' || ev.code === 'Numpad5') {
        var base = self._gameState.entities.find(function(e) { return e.team === TEAM_PLAYER && e.type === 'base'; });
        if (base) {
          self._camera.x = base.x * TILE_SIZE * self._camera.zoom - (canvas.width - 300) / 2;
          self._camera.y = base.y * TILE_SIZE * self._camera.zoom - canvas.height / 2;
          self._camera.x = Math.max(0, self._camera.x); self._camera.y = Math.max(0, self._camera.y);
        }
      }
      var keyMatch = ev.code.match(/^Digit([1-9])$/);
      if (keyMatch) {
        ev.preventDefault();
        var n = parseInt(keyMatch[1]);
        if (ev.ctrlKey) callbacks.onSetGroup(n);
        else callbacks.onSelectGroup(n);
      }
      if (ev.code === 'Tab') {
        ev.preventDefault();
        callbacks.onCycleTab();
      }
      if (ev.code === 'F5') { ev.preventDefault(); callbacks.onSaveGame(); }
      if (ev.code === 'F9') { ev.preventDefault(); callbacks.onLoadGame(); }
    });

    document.addEventListener('keyup', function(ev) {
      self.keys[ev.code] = false;
    });

    canvas.addEventListener('wheel', function(ev) {
      ev.preventDefault();
      if (ev.ctrlKey || ev.metaKey) {
        var oldZoom = self._camera.zoom;
        if (ev.deltaY < 0) self._camera.zoom = Math.min(2.0, self._camera.zoom + 0.1);
        else self._camera.zoom = Math.max(0.5, self._camera.zoom - 0.1);
        var zoomRatio = self._camera.zoom / oldZoom;
        var viewW = canvas.width - 300;
        self._camera.x = self._camera.x * zoomRatio + (mouse.x - viewW / 2) * (1 - zoomRatio);
        self._camera.y = self._camera.y * zoomRatio + (mouse.y - canvas.height / 2) * (1 - zoomRatio);
      } else if (ev.shiftKey) {
        self._camera.x += ev.deltaY * 0.5;
      } else {
        self._camera.y += ev.deltaY * 0.5;
      }
      var maxX = MAP_WIDTH * TILE_SIZE * self._camera.zoom - (canvas.width - 300);
      var maxY = MAP_HEIGHT * TILE_SIZE * self._camera.zoom - canvas.height;
      self._camera.x = Math.max(0, Math.min(maxX, self._camera.x));
      self._camera.y = Math.max(0, Math.min(maxY, self._camera.y));
    }, { passive: false });

    var mmCanvas = this.minimapCanvas;
    mmCanvas.addEventListener('mousedown', function(ev) {
      var rect = mmCanvas.getBoundingClientRect();
      var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      var sxR = mmCanvas.width / MAP_WIDTH, syR = mmCanvas.height / MAP_HEIGHT;
      if (ev.button === 2 && callbacks.selectedUnits.length > 0) {
        ev.preventDefault();
        var tmx = mx / sxR, tmy = my / syR;
        callbacks.selectedUnits.forEach(function(u, idx) {
          var spread = Math.ceil(Math.sqrt(callbacks.selectedUnits.length));
          var ox = idx % spread - Math.floor(spread / 2);
          var oy = Math.floor(idx / spread) - Math.floor(spread / 2);
          u.attackTarget = null;
          u.path = self._gameState.map.findPath(Math.floor(u.x), Math.floor(u.y),
            Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor(tmx) + ox)),
            Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor(tmy) + oy)), 3000, u, true);
          u.pathIndex = 0;
        });
      } else {
        self._camera.x = Math.floor(mx / sxR * TILE_SIZE * self._camera.zoom - (canvas.width - 300) / 2);
        self._camera.y = Math.floor(my / syR * TILE_SIZE * self._camera.zoom - canvas.height / 2);
        self._camera.x = Math.max(0, Math.min(MAP_WIDTH * TILE_SIZE * self._camera.zoom - (canvas.width - 300), self._camera.x));
        self._camera.y = Math.max(0, Math.min(MAP_HEIGHT * TILE_SIZE * self._camera.zoom - canvas.height, self._camera.y));
      }
    });
    mmCanvas.addEventListener('contextmenu', function(ev) { ev.preventDefault(); });

    window.addEventListener('resize', function() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    canvas.addEventListener('mouseleave', function() {
      mouse.inCanvas = false;
    });
  }
}

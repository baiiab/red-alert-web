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
      mouse.worldX = (clampedX + camera.x) / camera.zoom;
      mouse.worldY = (clampedY + camera.y) / camera.zoom;
      mouse.mapX = Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor(mouse.worldX / TILE_SIZE)));
      mouse.mapY = Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor(mouse.worldY / TILE_SIZE)));
      if (dragSelect.active) { dragSelect.endX = mouse.x; dragSelect.endY = mouse.y; }
    });

    canvas.addEventListener('mousedown', function(ev) {
      if (ev.button === 0) {
        if (callbacks.activeAction === 'repair') {
          var clk = gameState.getEntityAt(mouse.worldX, mouse.worldY);
          if (clk && clk.team === TEAM_PLAYER && clk.isBuilding && !clk.dead) callbacks.onRepair(clk);
          return;
        }
        if (callbacks.activeAction === 'sell') {
          var clk2 = gameState.getEntityAt(mouse.worldX, mouse.worldY);
          if (clk2 && clk2.team === TEAM_PLAYER && clk2.isBuilding && !clk2.dead) callbacks.onSell(clk2);
          return;
        }
        if (callbacks.placingBuilding && callbacks.placingType && mouse.inCanvas) {
          var pDef = BUILDING_DEFS[callbacks.placingType] || DEFENSE_DEFS[callbacks.placingType];
          if (pDef && gameState.map.isBuildable(mouse.mapX, mouse.mapY, pDef.size) &&
              gameState.map.isNearBuilding(mouse.mapX, mouse.mapY, pDef.size, TEAM_PLAYER)) {
            gameState.playerCredits -= pDef.cost;
            var nb = gameState.spawnEntity(callbacks.placingType, TEAM_PLAYER, mouse.mapX, mouse.mapY);
            for (var ci = 0; ci < nb.size; ci++) for (var cj = 0; cj < nb.size; cj++) {
              if (mouse.mapY + ci < MAP_HEIGHT && mouse.mapX + cj < MAP_WIDTH) gameState.map.terrain[mouse.mapY + ci][mouse.mapX + cj] = CONCRETE;
            }
            if (!ev.shiftKey) { callbacks.placingBuilding = false; callbacks.placingType = null; }
            callbacks.onNotify(pDef.name + ' \u5f00\u59cb\u5efa\u9020', 'info');
            callbacks.onPlayBuildSound();
          } else { callbacks.onNotify('\u65e0\u6cd5\u5728\u6b64\u5904\u5efa\u9020', 'warn'); callbacks.onPlayCancelSound(); }
          return;
        }
        if (self.pendingAttackMove && callbacks.selectedUnits.length > 0 && mouse.inCanvas) {
          var amTarget = gameState.getEntityAt(mouse.worldX, mouse.worldY);
          if (amTarget && amTarget.team !== TEAM_PLAYER && !amTarget.dead) {
            callbacks.selectedUnits.forEach(function(u) {
              u.attackTarget = amTarget; u.path = []; u.pathIndex = 0;
              u.attackMoveTarget = null; u.guardPos = null;
            });
            gameState.addFloatingText(amTarget.getCenterX(), amTarget.getCenterY() - 15, '\u653b\u51fb!', '#e74c3c');
          } else {
            var amx = mouse.mapX, amy = mouse.mapY;
            callbacks.selectedUnits.forEach(function(u) {
              u.attackTarget = null;
              u.attackMoveTarget = { x: amx, y: amy };
              u.guardPos = null;
              u.path = gameState.map.findPath(Math.floor(u.x), Math.floor(u.y), amx, amy);
              u.pathIndex = 0;
            });
            gameState.addFloatingText(mouse.worldX, mouse.worldY, 'A\u2192', '#e67e22');
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
          var wx1 = (Math.min(dragSelect.startX, dragSelect.endX) + camera.x) / camera.zoom;
          var wy1 = (Math.min(dragSelect.startY, dragSelect.endY) + camera.y) / camera.zoom;
          var wx2 = (Math.max(dragSelect.startX, dragSelect.endX) + camera.x) / camera.zoom;
          var wy2 = (Math.max(dragSelect.startY, dragSelect.endY) + camera.y) / camera.zoom;
          if (!ev.shiftKey) {
            callbacks.selectedUnits.forEach(function(u) { u.selected = false; });
            callbacks.selectedUnits.length = 0;
            if (callbacks.selectedBuilding) { callbacks.selectedBuilding.selected = false; callbacks.selectedBuilding = null; }
          }
          var bu = gameState.getEntitiesInRect(wx1, wy1, wx2, wy2);
          bu.forEach(function(u) {
            if (callbacks.selectedUnits.indexOf(u) < 0) { u.selected = true; callbacks.selectedUnits.push(u); }
          });
          if (bu.length > 0) callbacks.onPlaySelectSound();
        } else {
          var clicked = gameState.getEntityAt(mouse.worldX, mouse.worldY);
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
            var dbl = gameState.getEntityAt(mouse.worldX, mouse.worldY);
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
      if (callbacks.placingBuilding) { callbacks.placingBuilding = false; callbacks.placingType = null; callbacks.onPlayCancelSound(); return; }
      if (callbacks.activeAction) {
        callbacks.activeAction = null;
        document.getElementById('btnRepair').classList.remove('active');
        document.getElementById('btnSell').classList.remove('active');
        return;
      }
      var rc = gameState.getEntityAt(mouse.worldX, mouse.worldY);
      if (callbacks.selectedUnits.length > 0) {
        if (rc && rc.team !== TEAM_PLAYER && !rc.dead) {
          callbacks.selectedUnits.forEach(function(u) {
            u.attackTarget = rc; u.path = []; u.pathIndex = 0;
            u.attackMoveTarget = null; u.guardPos = null;
          });
          gameState.addFloatingText(rc.getCenterX(), rc.getCenterY() - 15, '\u76ee\u6807!', '#e74c3c');
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
            u.path = gameState.map.findPath(Math.floor(u.x), Math.floor(u.y), tx2, ty2);
            u.pathIndex = 0;
          });
          gameState.addFloatingText(mouse.worldX, mouse.worldY, '\u2192', '#2ecc71');
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
        if (callbacks.placingBuilding) { callbacks.placingBuilding = false; callbacks.placingType = null; }
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
            gameState.removeEntity(u);
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
        var allUnits = gameState.getPlayerUnits();
        callbacks.selectedUnits.length = 0;
        allUnits.forEach(function(u) { u.selected = true; callbacks.selectedUnits.push(u); });
        if (callbacks.selectedBuilding) { callbacks.selectedBuilding.selected = false; callbacks.selectedBuilding = null; }
        callbacks.onPlaySelectSound();
      }
      if (ev.code === 'Home' || ev.code === 'Numpad5') {
        var base = gameState.entities.find(function(e) { return e.team === TEAM_PLAYER && e.type === 'base'; });
        if (base) {
          camera.x = base.x * TILE_SIZE * camera.zoom - (canvas.width - 300) / 2;
          camera.y = base.y * TILE_SIZE * camera.zoom - canvas.height / 2;
          camera.x = Math.max(0, camera.x); camera.y = Math.max(0, camera.y);
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
        var oldZoom = camera.zoom;
        if (ev.deltaY < 0) camera.zoom = Math.min(2.0, camera.zoom + 0.1);
        else camera.zoom = Math.max(0.5, camera.zoom - 0.1);
        var zoomRatio = camera.zoom / oldZoom;
        var viewW = canvas.width - 300;
        camera.x = camera.x * zoomRatio + (mouse.x - viewW / 2) * (1 - zoomRatio);
        camera.y = camera.y * zoomRatio + (mouse.y - canvas.height / 2) * (1 - zoomRatio);
      } else if (ev.shiftKey) {
        camera.x += ev.deltaY * 0.5;
      } else {
        camera.y += ev.deltaY * 0.5;
      }
      var maxX = MAP_WIDTH * TILE_SIZE * camera.zoom - (canvas.width - 300);
      var maxY = MAP_HEIGHT * TILE_SIZE * camera.zoom - canvas.height;
      camera.x = Math.max(0, Math.min(maxX, camera.x));
      camera.y = Math.max(0, Math.min(maxY, camera.y));
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
          u.path = gameState.map.findPath(Math.floor(u.x), Math.floor(u.y),
            Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor(tmx) + ox)),
            Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor(tmy) + oy)));
          u.pathIndex = 0;
        });
      } else {
        camera.x = Math.floor(mx / sxR * TILE_SIZE * camera.zoom - (canvas.width - 300) / 2);
        camera.y = Math.floor(my / syR * TILE_SIZE * camera.zoom - canvas.height / 2);
        camera.x = Math.max(0, Math.min(MAP_WIDTH * TILE_SIZE * camera.zoom - (canvas.width - 300), camera.x));
        camera.y = Math.max(0, Math.min(MAP_HEIGHT * TILE_SIZE * camera.zoom - canvas.height, camera.y));
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

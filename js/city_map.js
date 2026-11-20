(function (global) {
  'use strict';

  var Startuem = global.Startuem = global.Startuem || {};

  var WORLD_SIZE = 2400;
  var BLOCK_STEP = 480;
  var ROAD_WIDTH = 156;
  var ROAD_HALF = ROAD_WIDTH / 2;
  var ROAD_CENTERS = [240, 720, 1200, 1680, 2160];
  var CANAL_Y = 1440;
  var CANAL_HALF = 28;

  var PALETTE = [
    { wall: '#9f7b40', roof: '#4e3f28', trim: '#c89d54' }, // Ochre Petersburg classic
    { wall: '#965642', roof: '#472c25', trim: '#b36a52' }, // Terracotta
    { wall: '#55695d', roof: '#2d3933', trim: '#6d8476' }, // Sage palace
    { wall: '#5b636b', roof: '#343a40', trim: '#78828c' }, // Grey panel
    { wall: '#a89b80', roof: '#524b3f', trim: '#d6c8a8' }  // Neoclassical cream
  ];

  // Deterministic PRNG so the St. Petersburg layout stays identical across runs
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function CityMap() {
    this.worldSize = WORLD_SIZE;
    this.roadWidth = ROAD_WIDTH;
    this.roadHalf = ROAD_HALF;
    this.roadCenters = ROAD_CENTERS.slice();
    this.canalY = CANAL_Y;
    this.canalHalf = CANAL_HALF;

    this.jeepPad = {
      x: 1920,
      y: 1920,
      radius: 76
    };

    this.buildings = [];
    this.canalBlocks = [];
    this.busStops = [];
    this.puddles = [];

    this._generate();
  }

  CityMap.prototype._generate = function () {
    var rng = makeRng(20130417);

    // Canal solid granite embankments between vertical avenues so cars drive on bridges only
    for (var i = 0; i <= ROAD_CENTERS.length; i++) {
      var prevEdge = i === 0 ? 0 : ROAD_CENTERS[i - 1] + ROAD_HALF;
      var nextEdge = i === ROAD_CENTERS.length ? WORLD_SIZE : ROAD_CENTERS[i] - ROAD_HALF;
      if (nextEdge - prevEdge > 10) {
        this.canalBlocks.push({
          x: prevEdge,
          y: CANAL_Y - CANAL_HALF,
          w: nextEdge - prevEdge,
          h: CANAL_HALF * 2
        });
      }
    }

    // Generate blocks between avenues (4x4 inner blocks + perimeter edges)
    var spans = [
      { min: 0, max: ROAD_CENTERS[0] - ROAD_HALF, edge: true },
      { min: ROAD_CENTERS[0] + ROAD_HALF, max: ROAD_CENTERS[1] - ROAD_HALF, edge: false },
      { min: ROAD_CENTERS[1] + ROAD_HALF, max: ROAD_CENTERS[2] - ROAD_HALF, edge: false },
      { min: ROAD_CENTERS[2] + ROAD_HALF, max: ROAD_CENTERS[3] - ROAD_HALF, edge: false },
      { min: ROAD_CENTERS[3] + ROAD_HALF, max: ROAD_CENTERS[4] - ROAD_HALF, edge: false },
      { min: ROAD_CENTERS[4] + ROAD_HALF, max: WORLD_SIZE, edge: true }
    ];

    for (var by = 0; by < spans.length; by++) {
      for (var bx = 0; bx < spans.length; bx++) {
        var sx = spans[bx];
        var sy = spans[by];
        var pad = 22; // Sidewalk buffer around blocks
        var x0 = sx.min + (bx === 0 ? 6 : pad);
        var y0 = sy.min + (by === 0 ? 6 : pad);
        var x1 = sx.max - (bx === spans.length - 1 ? 6 : pad);
        var y1 = sy.max - (by === spans.length - 1 ? 6 : pad);
        var bw = x1 - x0;
        var bh = y1 - y0;
        if (bw < 60 || bh < 60) continue;

        // Leave South-East block (bx===4, by===4) open as Moscow Plaza for the Jeep Pad!
        if (bx === 4 && by === 4) {
          continue;
        }

        // Row by === 3 contains the Griboedov Canal horizontally around y = 1440
        if (by === 3) {
          var northH = (CANAL_Y - CANAL_HALF - 20) - y0;
          var southY = CANAL_Y + CANAL_HALF + 20;
          var southH = y1 - southY;
          if (northH > 55) {
            this._addBuilding(x0, y0, bw, northH, rng);
          }
          if (southH > 55) {
            this._addBuilding(x0, southY, bw, southH, rng);
          }
          continue;
        }

        if (sx.edge || sy.edge) {
          this._addBuilding(x0, y0, bw, bh, rng);
        } else {
          // Subdivide inner Petersburg blocks into 2 buildings with a courtyard alley
          if (rng() > 0.45) {
            var splitW = Math.floor(bw * (0.44 + rng() * 0.12));
            var alley = 20;
            this._addBuilding(x0, y0, splitW, bh, rng);
            this._addBuilding(x0 + splitW + alley, y0, bw - splitW - alley, bh, rng);
          } else {
            var splitH = Math.floor(bh * (0.44 + rng() * 0.12));
            var alleyH = 20;
            this._addBuilding(x0, y0, bw, splitH, rng);
            this._addBuilding(x0, y0 + splitH + alleyH, bw, bh - splitH - alleyH, rng);
          }
        }
      }
    }

    // Bus stops along major avenues
    this.busStops = [
      { x: 460, y: 720 - ROAD_HALF - 12, label: 'А • НЕВСКИЙ', dir: 0 },
      { x: 960, y: 1200 - ROAD_HALF - 12, label: 'А • ГОСТИНЫЙ ДВОР', dir: 0 },
      { x: 1440, y: 720 + ROAD_HALF + 12, label: 'А • ВОКЗАЛ', dir: Math.PI },
      { x: 720 + ROAD_HALF + 12, y: 480, label: 'А • ПЕТРОГРАДКА', dir: Math.PI / 2 },
      { x: 1200 - ROAD_HALF - 12, y: 960, label: 'А • КАНАЛ', dir: -Math.PI / 2 },
      { x: 460, y: 1680 + ROAD_HALF + 12, label: 'А • КУПЧИНО', dir: Math.PI },
      { x: 1440, y: 2160 - ROAD_HALF - 12, label: 'А • НА МОСКВУ', dir: 0 },
      { x: 1680 - ROAD_HALF - 12, y: 1920, label: 'А • ВЫЕЗД М-10', dir: -Math.PI / 2 }
    ];

    // Rain puddles on avenues
    for (var p = 0; p < 34; p++) {
      var onHoriz = rng() > 0.5;
      var c = ROAD_CENTERS[Math.floor(rng() * ROAD_CENTERS.length)];
      var along = 140 + rng() * (WORLD_SIZE - 280);
      var offset = (rng() - 0.5) * (ROAD_WIDTH - 48);
      this.puddles.push({
        x: onHoriz ? along : c + offset,
        y: onHoriz ? c + offset : along,
        rx: 18 + rng() * 24,
        ry: 10 + rng() * 14,
        rot: rng() * Math.PI
      });
    }
  };

  CityMap.prototype._addBuilding = function (x, y, w, h, rng) {
    var style = PALETTE[Math.floor(rng() * PALETTE.length)];
    var z = 0.11 + rng() * 0.13; // Height factor for 2.5D extrusion
    var vents = [];
    var ventCount = 1 + Math.floor(rng() * 3);
    for (var v = 0; v < ventCount; v++) {
      vents.push({
        rx: 0.18 + rng() * 0.62,
        ry: 0.18 + rng() * 0.62,
        rw: 12 + rng() * 18,
        rh: 10 + rng() * 16
      });
    }
    this.buildings.push({
      x: x,
      y: y,
      w: w,
      h: h,
      z: z,
      wallColor: style.wall,
      roofColor: style.roof,
      trimColor: style.trim,
      windowSeed: Math.floor(rng() * 10000),
      vents: vents
    });
  };

  CityMap.prototype.getDistrict = function (x, y) {
    if (x >= 1520 && y >= 1520) return 'ТРАССА М-10 → МОСКВА';
    if (y >= 1120 && y <= 1560) return 'КАНАЛ ГРИБОЕДОВА • ЦЕНТР';
    if (x < 1050 && y < 1120) return 'ВАСИЛЬЕВСКИЙ ОСТРОВ';
    if (x >= 1050 && y < 1120) return 'МОСКОВСКИЙ ВОКЗАЛ';
    return 'КУПЧИНО • ОКРАИНА';
  };

  CityMap.prototype.isOnRoad = function (x, y) {
    for (var i = 0; i < ROAD_CENTERS.length; i++) {
      if (Math.abs(x - ROAD_CENTERS[i]) <= ROAD_HALF) return true;
      if (Math.abs(y - ROAD_CENTERS[i]) <= ROAD_HALF) return true;
    }
    // Moscow Plaza
    if (x >= 1758 && x <= 2082 && y >= 1758 && y <= 2082) return true;
    return false;
  };

  CityMap.prototype.getNearestRoadSpawn = function () {
    return {
      x: 720,
      y: 1200,
      angle: 0
    };
  };

  CityMap.prototype._resolveRect = function (circle, rect) {
    var closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    var closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    var dx = circle.x - closestX;
    var dy = circle.y - closestY;
    var distSq = dx * dx + dy * dy;

    if (distSq >= circle.r * circle.r) return false;

    if (distSq > 0.0001) {
      var dist = Math.sqrt(distSq);
      var push = circle.r - dist;
      var nx = dx / dist;
      var ny = dy / dist;
      circle.x += nx * push;
      circle.y += ny * push;
      circle.nx = nx;
      circle.ny = ny;
    } else {
      // Center inside rect — push out along minimum axis
      var leftPen = circle.x - rect.x;
      var rightPen = (rect.x + rect.w) - circle.x;
      var topPen = circle.y - rect.y;
      var botPen = (rect.y + rect.h) - circle.y;
      var m = Math.min(leftPen, rightPen, topPen, botPen);
      if (m === leftPen) {
        circle.x = rect.x - circle.r;
        circle.nx = -1;
        circle.ny = 0;
      } else if (m === rightPen) {
        circle.x = rect.x + rect.w + circle.r;
        circle.nx = 1;
        circle.ny = 0;
      } else if (m === topPen) {
        circle.y = rect.y - circle.r;
        circle.nx = 0;
        circle.ny = -1;
      } else {
        circle.y = rect.y + rect.h + circle.r;
        circle.nx = 0;
        circle.ny = 1;
      }
    }
    return true;
  };

  CityMap.prototype.resolveCircleCollision = function (x, y, radius) {
    var state = { x: x, y: y, r: radius, nx: 0, ny: 0 };
    var hit = false;

    for (var i = 0; i < this.buildings.length; i++) {
      if (this._resolveRect(state, this.buildings[i])) {
        hit = true;
      }
    }

    for (var c = 0; c < this.canalBlocks.length; c++) {
      if (this._resolveRect(state, this.canalBlocks[c])) {
        hit = true;
      }
    }

    var margin = radius + 12;
    if (state.x < margin) {
      state.x = margin;
      state.nx = 1;
      state.ny = 0;
      hit = true;
    } else if (state.x > WORLD_SIZE - margin) {
      state.x = WORLD_SIZE - margin;
      state.nx = -1;
      state.ny = 0;
      hit = true;
    }

    if (state.y < margin) {
      state.y = margin;
      state.nx = 0;
      state.ny = 1;
      hit = true;
    } else if (state.y > WORLD_SIZE - margin) {
      state.y = WORLD_SIZE - margin;
      state.nx = 0;
      state.ny = -1;
      hit = true;
    }

    return {
      x: state.x,
      y: state.y,
      hit: hit,
      nx: state.nx,
      ny: state.ny
    };
  };

  Startuem.CityMap = CityMap;
})(window);

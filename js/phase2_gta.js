(function (global) {
  'use strict';

  var Startuem = global.Startuem = global.Startuem || {};

  function Phase2GTA(opts) {
    this.audio = opts.audio;
    this.map = new Startuem.CityMap();
    this.onGameOver = opts.onGameOver;

    this.ui = {
      district: document.getElementById('p2-district'),
      mission: document.getElementById('p2-mission'),
      rubles: document.getElementById('p2-rubles'),
      score: document.getElementById('p2-score'),
      combo: document.getElementById('p2-combo'),
      vehicleBadge: document.getElementById('p2-vehicle-badge'),
      hpFill: document.getElementById('p2-hp-fill'),
      hpVal: document.getElementById('p2-hp-val'),
      tripFill: document.getElementById('p2-trip-fill'),
      tripVal: document.getElementById('p2-trip-val'),
      subtitle: document.getElementById('p2-subtitle'),
      stars: Array.prototype.slice.call(document.querySelectorAll('#p2-stars .star')),
      btnShock: document.getElementById('btn-p2-startuem'),
      btnTrip: document.getElementById('btn-p2-trip')
    };

    this.nataliaImgReady = false;
    this.nataliaImg = new global.Image();
    var self = this;
    this.nataliaImg.onload = function () {
      self.nataliaImgReady = true;
    };
    this.nataliaImg.src = './video/clips/poster.jpg';

    this.reset(15);
  }

  Phase2GTA.prototype.reset = function (startingRubles) {
    var spawn = this.map.getNearestRoadSpawn();
    var initRubles = typeof startingRubles === 'number' ? startingRubles : 15;

    this.player = {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      angle: spawn.angle,
      speed: 0,
      isJeep: false,
      hp: 100,
      maxHp: 100,
      radius: 22
    };

    this.cam = {
      x: spawn.x,
      y: spawn.y,
      zoom: 1,
      shake: 0,
      roll: 0
    };

    this.rubles = initRubles;
    this.jeepUnlockRubles = Math.max(60, initRubles + 35);
    this.score = initRubles * 10;
    this.mayhem = 0;
    this.wantedStars = 0;
    this.maxStarsReached = 0;

    this.combo = 1;
    this.comboTimer = 0;

    this.shockCooldown = 0;
    this.tripCharge = 40;
    this.tripTimer = 0;
    this.tripsCount = 0;
    this.bustedProgress = 0;

    this.subtitleTimer = 0;
    this.subtitleText = '';

    this.gameOverState = null; // { timer, duration, reason }
    this.time = 0;
    this.heliAngle = 0;

    this.skids = [];
    this.shockwaves = [];
    this.particles = [];
    this.popups = [];
    this.hallucinations = [];
    this.pickups = [];
    this.peds = [];
    this.traffic = [];
    this.cops = [];

    this._populateWorld();
    this.showQuote('shockwave', false);
    this.syncHUD();
  };

  Phase2GTA.prototype._populateWorld = function () {
    var centers = this.map.roadCenters;

    // Guaranteed Trip Spirals near spawn so players experience LSD Trip Mode early
    var nearSpirals = [
      { x: 960, y: 1200 },
      { x: 720, y: 940 },
      { x: 1200, y: 1200 },
      { x: 1680, y: 1200 },
      { x: 1680, y: 1680 },
      { x: 480, y: 720 }
    ];
    for (var s = 0; s < nearSpirals.length; s++) {
      this.pickups.push({
        x: nearSpirals[s].x,
        y: nearSpirals[s].y,
        type: 'trip',
        phase: s * 1.1
      });
    }

    // Rubles & Beret repair kits along roads & bus stops
    for (var b = 0; b < this.map.busStops.length; b++) {
      var stop = this.map.busStops[b];
      this.pickups.push({
        x: stop.x + Math.cos(stop.dir + Math.PI / 2) * 32,
        y: stop.y + Math.sin(stop.dir + Math.PI / 2) * 32,
        type: 'ruble10',
        phase: b
      });
    }

    for (var r = 0; r < 24; r++) {
      var pt = this._randomRoadPoint();
      this.pickups.push({
        x: pt.x,
        y: pt.y,
        type: r % 6 === 0 ? 'beret' : (r % 3 === 0 ? 'ruble10' : 'ruble1'),
        phase: Math.random() * 6
      });
    }

    // Slapstick pedestrians along sidewalks/roads
    for (var p = 0; p < 32; p++) {
      var pp = this._randomRoadPoint();
      this.peds.push({
        x: pp.x + (Math.random() - 0.5) * 80,
        y: pp.y + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 38,
        vy: (Math.random() - 0.5) * 38,
        color: ['#558b2f', '#5c6bc0', '#d84315', '#8d6e63', '#00838f'][p % 5],
        scaredTimer: 0,
        respawnTimer: 0
      });
    }

    // Civilian traffic cars (Lada / Gazelle / Yellow Taxi)
    for (var t = 0; t < 11; t++) {
      var horiz = t % 2 === 0;
      var roadC = centers[t % centers.length];
      var laneOffset = (t % 4 < 2 ? 32 : -32);
      var posAlong = 200 + Math.random() * 2000;
      var angle = horiz ? (laneOffset > 0 ? 0 : Math.PI) : (laneOffset > 0 ? Math.PI / 2 : -Math.PI / 2);
      this.traffic.push({
        x: horiz ? posAlong : roadC + laneOffset,
        y: horiz ? roadC + laneOffset : posAlong,
        angle: angle,
        speed: 145 + Math.random() * 55,
        kind: t % 3 === 0 ? 'taxi' : (t % 3 === 1 ? 'gazelle' : 'lada'),
        color: t % 3 === 0 ? '#f5c400' : (t % 3 === 1 ? '#d7dee6' : ['#9e2a2b', '#3a6ea5', '#4f772d'][t % 3]),
        stunTimer: 0,
        vx: 0,
        vy: 0
      });
    }
  };

  Phase2GTA.prototype._randomRoadPoint = function () {
    var centers = this.map.roadCenters;
    var horiz = Math.random() > 0.5;
    var c = centers[Math.floor(Math.random() * centers.length)];
    var along = 140 + Math.random() * (this.map.worldSize - 280);
    var offset = (Math.random() - 0.5) * (this.map.roadWidth - 40);
    return {
      x: horiz ? along : c + offset,
      y: horiz ? c + offset : along
    };
  };

  Phase2GTA.prototype.showQuote = function (category, playAudio) {
    var q = Startuem.QUOTES.pickQuote(category);
    if (!q) return;
    this.subtitleText = q.text;
    this.subtitleTimer = 3.2;
    if (playAudio) {
      this.audio.playVoice(q.slotId, q.text.replace(/[«»]/g, ''), false);
    }
  };

  Phase2GTA.prototype.triggerShockwave = function () {
    if (this.gameOverState || this.shockCooldown > 0) return;

    this.shockCooldown = 5.5;
    this.cam.shake = 0.85;
    this.tripCharge = Math.min(100, this.tripCharge + 18);
    this.audio.playStartuemBoom();

    var q = Startuem.QUOTES.pickQuote('shockwave');
    if (q) {
      this.subtitleText = q.text;
      this.subtitleTimer = 3.0;
      this.audio.playVoice(q.slotId, q.text.replace(/[«»]/g, ''), true);
    }

    var px = this.player.x;
    var py = this.player.y;
    this.shockwaves.push({
      x: px,
      y: py,
      radius: 25,
      maxRadius: 270,
      life: 0.55,
      maxLife: 0.55
    });

    this.popups.push({
      x: px,
      y: py - 35,
      text: 'СТАРТУЕМ!!',
      color: '#f5b800',
      life: 1.1,
      maxLife: 1.1
    });

    // Blast traffic & cops away
    var blastRadius = 265;
    var i, dx, dy, dist, nx, ny;

    for (i = 0; i < this.traffic.length; i++) {
      var car = this.traffic[i];
      dx = car.x - px;
      dy = car.y - py;
      dist = Math.hypot(dx, dy);
      if (dist < blastRadius && dist > 1) {
        nx = dx / dist;
        ny = dy / dist;
        car.vx += nx * 520;
        car.vy += ny * 520;
        car.stunTimer = 1.6;
        this._awardPoints(120, '+120 РАЗГОН!', car.x, car.y, '#00e5ff');
        this._dropRubles(car.x, car.y, 1, 'ruble10');
      }
    }

    for (i = this.cops.length - 1; i >= 0; i--) {
      var cop = this.cops[i];
      dx = cop.x - px;
      dy = cop.y - py;
      dist = Math.hypot(dx, dy);
      if (dist < blastRadius && dist > 1) {
        nx = dx / dist;
        ny = dy / dist;
        cop.vx += nx * 620;
        cop.vy += ny * 620;
        cop.stunTimer = 1.9;
        cop.hp -= 55;
        this._awardPoints(220, 'ОТЖИМАЙСЯ! +220', cop.x, cop.y, '#39ff14');
        if (cop.hp <= 0) {
          this._spawnExplosion(cop.x, cop.y, '#ff5722');
          this._dropRubles(cop.x, cop.y, 2, 'ruble10');
          this.cops.splice(i, 1);
        }
      }
    }

    for (i = 0; i < this.peds.length; i++) {
      var ped = this.peds[i];
      if (ped.respawnTimer > 0) continue;
      dx = ped.x - px;
      dy = ped.y - py;
      dist = Math.hypot(dx, dy);
      if (dist < blastRadius) {
        this._scatterPed(ped, px, py);
      }
    }

    this.mayhem += 35;
    this._recomputeWanted();
    this.syncHUD();
  };

  Phase2GTA.prototype.triggerTripMode = function (forced) {
    if (this.gameOverState) return;
    if (!forced && this.tripCharge < 100) return;

    this.tripCharge = 0;
    this.tripTimer = 10.0;
    this.tripsCount += 1;
    this.cam.shake = 0.6;

    this.audio.playTripStart();
    this.showQuote('trip_start', true);

    this.popups.push({
      x: this.player.x,
      y: this.player.y - 48,
      text: '🌀 КУЛЬТУРНЫЙ ПРИХОД! ×3',
      color: '#e040fb',
      life: 1.8,
      maxLife: 1.8
    });

    // Seed surreal hallucination sprites around the player
    this.hallucinations = [];
    var phrases = ['СТАРТУЕМ!!!', 'ДЖИП В МОСКВЕ!', 'КУЛЬТУРНЫЙ ГОРОД', 'ВДОХ-ВЫДОХ!'];
    for (var i = 0; i < 8; i++) {
      this.hallucinations.push({
        angle: (i / 8) * Math.PI * 2,
        dist: 150 + (i % 3) * 85,
        kind: i % 4 === 0 ? 'jeep' : (i % 4 === 1 ? 'beret' : (i % 4 === 2 ? 'ruble' : 'word')),
        word: phrases[i % phrases.length],
        spin: (i % 2 === 0 ? 1 : -1) * (1.2 + i * 0.2)
      });
    }

    this.syncHUD();
  };

  Phase2GTA.prototype._awardPoints = function (basePts, label, wx, wy, color) {
    var tripMult = this.tripTimer > 0 ? 3 : 1;
    var pts = Math.round(basePts * this.combo * tripMult);
    this.score += pts;
    this.comboTimer = 4.0;
    if (this.combo < 3) {
      this.combo = Math.min(3, +(this.combo + 0.25).toFixed(2));
    }
    if (label) {
      this.popups.push({
        x: wx,
        y: wy - 20,
        text: label,
        color: color || '#f5b800',
        life: 1.0,
        maxLife: 1.0
      });
    }
  };

  Phase2GTA.prototype._dropRubles = function (x, y, count, type) {
    for (var i = 0; i < count; i++) {
      this.pickups.push({
        x: x + (Math.random() - 0.5) * 44,
        y: y + (Math.random() - 0.5) * 44,
        type: type || 'ruble1',
        phase: Math.random() * 6
      });
    }
  };

  Phase2GTA.prototype._scatterPed = function (ped, fromX, fromY) {
    var dx = ped.x - fromX;
    var dy = ped.y - fromY;
    var d = Math.hypot(dx, dy) || 1;
    ped.vx = (dx / d) * 230;
    ped.vy = (dy / d) * 230;
    ped.scaredTimer = 1.4;
    ped.respawnTimer = 2.0; // Jumps into doorway after diving aside
    this.audio.playCoin();
    this._dropRubles(ped.x, ped.y, 1, Math.random() > 0.72 ? 'ruble10' : 'ruble1');
    this._awardPoints(45, 'ПО РУБЛЮ!', ped.x, ped.y, '#39ff14');
  };

  Phase2GTA.prototype._recomputeWanted = function () {
    var s = 0;
    if (this.mayhem >= 40) s = 1;
    if (this.mayhem >= 140 || this.player.isJeep) s = Math.max(s, 2);
    if (this.mayhem >= 320) s = 3;
    if (this.mayhem >= 580) s = 4;
    this.wantedStars = s;
    if (s > this.maxStarsReached) this.maxStarsReached = s;
  };

  Phase2GTA.prototype._spawnExplosion = function (x, y, color) {
    for (var i = 0; i < 16; i++) {
      var a = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
      var spd = 70 + Math.random() * 210;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75,
        size: 4 + Math.random() * 6,
        color: color || '#ff9800'
      });
    }
  };

  Phase2GTA.prototype.update = function (dt, input) {
    this.time += dt;

    if (this.gameOverState) {
      this.gameOverState.timer += dt;
      this.audio.stopDrivingAudio();
      if (this.gameOverState.timer >= this.gameOverState.duration && this.onGameOver) {
        var cb = this.onGameOver;
        this.onGameOver = null;
        cb({
          score: this.score,
          rubles: this.rubles,
          maxStars: this.maxStarsReached,
          tripsCount: this.tripsCount,
          isJeep: this.player.isJeep,
          reason: this.gameOverState.reason
        });
      }
      return;
    }

    if (this.shockCooldown > 0) this.shockCooldown = Math.max(0, this.shockCooldown - dt);
    if (this.subtitleTimer > 0) this.subtitleTimer = Math.max(0, this.subtitleTimer - dt);
    if (this.cam.shake > 0) this.cam.shake = Math.max(0, this.cam.shake - dt * 1.8);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }

    // Trip Mode countdown
    var wasTrip = this.tripTimer > 0;
    if (this.tripTimer > 0) {
      this.tripTimer = Math.max(0, this.tripTimer - dt);
      this.cam.roll = Math.sin(this.time * 2.2) * 0.032;
      if (wasTrip && this.tripTimer === 0) {
        this.cam.roll = 0;
        this._awardPoints(500, 'КУЛЬТУРНЫЙ ШОК! +500', this.player.x, this.player.y, '#e040fb');
      }
    } else {
      this.cam.roll = 0;
    }

    this._updatePlayerPhysics(dt, input);
    this._updatePickups(dt);
    this._updatePedestrians(dt);
    this._updateTraffic(dt);
    this._updateCops(dt);
    this._updateEffects(dt);
    this._checkJeepPad();
    this._checkGameOver(dt);

    // Camera follow with velocity look-ahead & speed zoom
    var p = this.player;
    var targetX = p.x + p.vx * 0.22;
    var targetY = p.y + p.vy * 0.22;
    this.cam.x += (targetX - this.cam.x) * Math.min(1, dt * 6.5);
    this.cam.y += (targetY - this.cam.y) * Math.min(1, dt * 6.5);

    var speedRatio = Math.abs(p.speed) / (p.isJeep ? 610 : 430);
    var targetZoom = 1.0 - Math.min(0.18, speedRatio * 0.16);
    if (this.tripTimer > 0) {
      targetZoom += Math.sin(this.time * 3.1) * 0.045;
    }
    this.cam.zoom += (targetZoom - this.cam.zoom) * Math.min(1, dt * 4.5);

    // Closest police siren proximity
    var minCopDist = 9999;
    for (var c = 0; c < this.cops.length; c++) {
      var d = Math.hypot(this.cops[c].x - p.x, this.cops[c].y - p.y);
      if (d < minCopDist) minCopDist = d;
    }
    var sirenProx = this.cops.length ? Math.max(0, 1 - minCopDist / 650) : 0;
    var drifting = input.drift || (Math.abs(p.vx * -Math.sin(p.angle) + p.vy * Math.cos(p.angle)) > 110);
    this.audio.updateDrivingAudio(dt, speedRatio, p.isJeep, drifting, sirenProx, this.tripTimer > 0);

    this.syncHUD();
  };

  Phase2GTA.prototype._updatePlayerPhysics = function (dt, input) {
    var p = this.player;
    var tripBoost = this.tripTimer > 0 ? 1.25 : 1.0;
    var maxFwd = (p.isJeep ? 610 : 430) * tripBoost;
    var maxRev = p.isJeep ? -240 : -170;
    var accel = (p.isJeep ? 690 : 440) * tripBoost;
    var turnRate = p.isJeep ? 3.55 : 2.65;

    var throttle = 0;
    var steer = 0;

    // Support both classic steering (WASD/Arrows) and touch analog vector
    if (input.joyActive && (Math.abs(input.joyX) > 0.12 || Math.abs(input.joyY) > 0.12)) {
      var targetAng = Math.atan2(input.joyY, input.joyX);
      var diff = targetAng - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      steer = Math.max(-1, Math.min(1, diff * 2.4));
      throttle = Math.min(1, Math.hypot(input.joyX, input.joyY));
    } else {
      if (input.up) throttle += 1;
      if (input.down) throttle -= 1;
      if (input.left) steer -= 1;
      if (input.right) steer += 1;
    }

    var fx = Math.cos(p.angle);
    var fy = Math.sin(p.angle);
    var fwdSpeed = p.vx * fx + p.vy * fy;

    if (throttle > 0) {
      p.vx += fx * accel * throttle * dt;
      p.vy += fy * accel * throttle * dt;
    } else if (throttle < 0) {
      p.vx += fx * (accel * 0.78) * throttle * dt;
      p.vy += fy * (accel * 0.78) * throttle * dt;
    } else {
      // Natural rolling friction
      p.vx *= Math.pow(0.28, dt);
      p.vy *= Math.pow(0.28, dt);
    }

    // Steering effectiveness scales with velocity
    var speedMag = Math.hypot(p.vx, p.vy);
    var steerScale = Math.min(1, speedMag / 90);
    var reverseSign = fwdSpeed < -25 ? -1 : 1;
    var driftBoost = input.drift ? 1.32 : 1.0;
    p.angle += steer * turnRate * driftBoost * steerScale * reverseSign * dt;

    // Lateral tire grip (lower while drifting so tail swings out!)
    fx = Math.cos(p.angle);
    fy = Math.sin(p.angle);
    var rx = -fy;
    var ry = fx;
    var fwd = p.vx * fx + p.vy * fy;
    var lat = p.vx * rx + p.vy * ry;

    var lateralGrip = input.drift ? 2.4 : 7.8;
    lat *= Math.exp(-lateralGrip * dt);

    fwd = Math.max(maxRev, Math.min(maxFwd, fwd));
    p.vx = fx * fwd + rx * lat;
    p.vy = fy * fwd + ry * lat;
    p.speed = fwd;

    // Skidmarks when drifting or sliding laterally
    if ((input.drift || Math.abs(lat) > 95) && speedMag > 130) {
      this.tripCharge = Math.min(100, this.tripCharge + dt * 7);
      var rearX = p.x - fx * (p.isJeep ? 16 : 22);
      var rearY = p.y - fy * (p.isJeep ? 16 : 22);
      this.skids.push({
        x1: rearX + rx * 9,
        y1: rearY + ry * 9,
        x2: rearX - rx * 9,
        y2: rearY - ry * 9,
        hue: (this.time * 240) % 360,
        trip: this.tripTimer > 0,
        life: 5.5
      });
      if (this.skids.length > 320) this.skids.shift();
    }

    // Move & resolve wall/building collisions
    var nextX = p.x + p.vx * dt;
    var nextY = p.y + p.vy * dt;
    var col = this.map.resolveCircleCollision(nextX, nextY, p.radius);
    p.x = col.x;
    p.y = col.y;

    if (col.hit) {
      var impact = Math.abs(p.vx * col.nx + p.vy * col.ny);
      if (impact > 165) {
        this.audio.playCrash(impact / 500);
        this.cam.shake = Math.min(0.6, impact / 600);
        if (this.tripTimer <= 0 && !p.isJeep) {
          p.hp = Math.max(0, p.hp - Math.round(impact * 0.025));
        }
      }
      // Slide cleanly along wall normal without sticking
      var vn = p.vx * col.nx + p.vy * col.ny;
      if (vn < 0) {
        p.vx -= col.nx * vn * 1.25;
        p.vy -= col.ny * vn * 1.25;
        p.vx *= 0.78;
        p.vy *= 0.78;
      }
    }
  };

  Phase2GTA.prototype._updatePickups = function (dt) {
    var p = this.player;
    var tripMult = this.tripTimer > 0 ? 3 : 1;

    for (var i = this.pickups.length - 1; i >= 0; i--) {
      var item = this.pickups[i];
      item.phase += dt * 4;
      var d = Math.hypot(item.x - p.x, item.y - p.y);
      if (d < p.radius + 22) {
        if (item.type === 'ruble1' || item.type === 'ruble10') {
          var amt = (item.type === 'ruble10' ? 10 : 1) * tripMult;
          this.rubles += amt;
          this.audio.playCoin();
          this._awardPoints(amt * 15, '+' + amt + '₽', item.x, item.y, '#39ff14');
        } else if (item.type === 'beret') {
          p.hp = Math.min(p.maxHp, p.hp + 35);
          this.audio.playCoin();
          this._awardPoints(100, 'БЕРЕТ +35 БРОНИ', item.x, item.y, '#00e5ff');
        } else if (item.type === 'trip') {
          this.tripCharge = Math.min(100, this.tripCharge + 55);
          this._awardPoints(150, '🌀 +55% ПРИХОД', item.x, item.y, '#e040fb');
          if (this.tripCharge >= 100 && this.tripTimer <= 0) {
            this.triggerTripMode(true);
          } else {
            this.audio.playCoin();
          }
        }
        this.pickups.splice(i, 1);

        // Respawn a replacement pickup elsewhere so map stays lively
        if (this.pickups.length < 32) {
          var rp = this._randomRoadPoint();
          var roll = Math.random();
          this.pickups.push({
            x: rp.x,
            y: rp.y,
            type: roll < 0.16 ? 'trip' : (roll < 0.30 ? 'beret' : (roll < 0.65 ? 'ruble10' : 'ruble1')),
            phase: Math.random() * 6
          });
        }
      }
    }
  };

  Phase2GTA.prototype._updatePedestrians = function (dt) {
    var p = this.player;
    var speedMag = Math.hypot(p.vx, p.vy);

    for (var i = 0; i < this.peds.length; i++) {
      var ped = this.peds[i];
      if (ped.respawnTimer > 0) {
        ped.x += ped.vx * dt;
        ped.y += ped.vy * dt;
        ped.respawnTimer -= dt;
        if (ped.respawnTimer <= 0) {
          var rp = this._randomRoadPoint();
          ped.x = rp.x;
          ped.y = rp.y;
          ped.vx = (Math.random() - 0.5) * 38;
          ped.vy = (Math.random() - 0.5) * 38;
          ped.scaredTimer = 0;
        }
        continue;
      }

      ped.x += ped.vx * dt;
      ped.y += ped.vy * dt;
      var col = this.map.resolveCircleCollision(ped.x, ped.y, 10);
      ped.x = col.x;
      ped.y = col.y;
      if (col.hit) {
        ped.vx = -ped.vx;
        ped.vy = -ped.vy;
      }

      var dist = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (dist < p.radius + 32 && speedMag > 65) {
        this._scatterPed(ped, p.x, p.y);
        this.mayhem += 12;
        this._recomputeWanted();
      }
    }
  };

  Phase2GTA.prototype._updateTraffic = function (dt) {
    var p = this.player;
    var pSpeed = Math.hypot(p.vx, p.vy);

    for (var i = 0; i < this.traffic.length; i++) {
      var car = this.traffic[i];
      if (car.stunTimer > 0) {
        car.stunTimer -= dt;
        car.x += car.vx * dt;
        car.y += car.vy * dt;
        car.vx *= Math.pow(0.15, dt);
        car.vy *= Math.pow(0.15, dt);
      } else {
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        if (car.x < 80) car.x = this.map.worldSize - 90;
        if (car.x > this.map.worldSize - 80) car.x = 90;
        if (car.y < 80) car.y = this.map.worldSize - 90;
        if (car.y > this.map.worldSize - 80) car.y = 90;
      }

      var col = this.map.resolveCircleCollision(car.x, car.y, 18);
      car.x = col.x;
      car.y = col.y;
      if (col.hit && car.stunTimer <= 0) {
        car.angle += Math.PI;
      }

      // Collision with player
      var dx = car.x - p.x;
      var dy = car.y - p.y;
      var dist = Math.hypot(dx, dy);
      var minDist = p.radius + 19;
      if (dist < minDist && dist > 0.01) {
        var nx = dx / dist;
        var ny = dy / dist;
        var overlap = minDist - dist;
        car.x += nx * overlap * 0.7;
        car.y += ny * overlap * 0.7;
        p.x -= nx * overlap * 0.3;
        p.y -= ny * overlap * 0.3;

        var hitForce = Math.max(140, pSpeed);
        car.vx = nx * hitForce * 0.95;
        car.vy = ny * hitForce * 0.95;
        car.stunTimer = 1.2;

        if (this.tripTimer <= 0 && !p.isJeep) {
          p.hp = Math.max(0, p.hp - 4);
        }
        p.vx *= 0.86;
        p.vy *= 0.86;

        this.audio.playCrash(0.6);
        this.cam.shake = 0.4;
        this.tripCharge = Math.min(100, this.tripCharge + 6);
        this.mayhem += 20;
        this._recomputeWanted();
        this._dropRubles(car.x, car.y, 1, 'ruble10');
        this._awardPoints(90, 'БАМ! +90', car.x, car.y, '#ff9800');
      }
    }
  };

  Phase2GTA.prototype._updateCops = function (dt) {
    var p = this.player;
    var targetCops = this.wantedStars === 0 ? 0 : Math.min(6, this.wantedStars + 1);

    // Spawn missing police cars outside immediate view
    while (this.cops.length < targetCops) {
      var rp = this._randomRoadPoint();
      if (Math.hypot(rp.x - p.x, rp.y - p.y) > 420) {
        var tier = this.wantedStars >= 3 && this.cops.length % 2 === 0 ? 'omon' : (this.wantedStars >= 2 ? 'dps' : 'conductor');
        this.cops.push({
          x: rp.x,
          y: rp.y,
          vx: 0,
          vy: 0,
          angle: 0,
          tier: tier,
          hp: tier === 'omon' ? 140 : 80,
          stunTimer: 0
        });
      } else {
        break;
      }
    }

    var touchingCop = false;

    for (var i = this.cops.length - 1; i >= 0; i--) {
      var cop = this.cops[i];
      if (cop.stunTimer > 0) {
        cop.stunTimer -= dt;
        cop.x += cop.vx * dt;
        cop.y += cop.vy * dt;
        cop.vx *= Math.pow(0.16, dt);
        cop.vy *= Math.pow(0.16, dt);
      } else {
        var dx = p.x - cop.x;
        var dy = p.y - cop.y;
        var desired = Math.atan2(dy, dx);
        var diff = desired - cop.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cop.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));

        var copSpeed = cop.tier === 'dps' ? 355 : (cop.tier === 'omon' ? 310 : 285);
        cop.vx = Math.cos(cop.angle) * copSpeed;
        cop.vy = Math.sin(cop.angle) * copSpeed;
        cop.x += cop.vx * dt;
        cop.y += cop.vy * dt;
      }

      var col = this.map.resolveCircleCollision(cop.x, cop.y, 19);
      cop.x = col.x;
      cop.y = col.y;
      if (col.hit && cop.stunTimer <= 0) {
        // Slide along obstacle toward player
        cop.angle += 0.9 * dt * 10;
      }

      var pdx = cop.x - p.x;
      var pdy = cop.y - p.y;
      var pdist = Math.hypot(pdx, pdy);
      var minD = p.radius + 20;

      if (pdist < minD + 8) {
        touchingCop = true;
      }

      if (pdist < minD && pdist > 0.01) {
        var nx = pdx / pdist;
        var ny = pdy / pdist;
        var push = minD - pdist;
        cop.x += nx * push * 0.65;
        cop.y += ny * push * 0.65;
        p.x -= nx * push * 0.35;
        p.y -= ny * push * 0.35;

        var pSpeed = Math.hypot(p.vx, p.vy);
        if (this.tripTimer > 0 || p.isJeep || pSpeed > 260) {
          var bounce = this.tripTimer > 0 ? 580 : 380;
          cop.vx = nx * bounce;
          cop.vy = ny * bounce;
          cop.stunTimer = 1.25;
          cop.hp -= this.tripTimer > 0 ? 80 : 45;
          this.audio.playCrash(0.7);
          this.cam.shake = 0.45;
          this.tripCharge = Math.min(100, this.tripCharge + 15);
          this._awardPoints(250, 'ВЫЛЕТЕЛ! +250', cop.x, cop.y, '#39ff14');
          if (Math.random() < 0.4) this.showQuote('ram_cop', true);

          if (cop.hp <= 0) {
            this._spawnExplosion(cop.x, cop.y, '#00e5ff');
            this._dropRubles(cop.x, cop.y, 2, 'ruble10');
            this.cops.splice(i, 1);
            continue;
          }
        } else {
          // Cop rammed player
          p.hp = Math.max(0, p.hp - dt * 26);
          if (p.hp < 30 && Math.random() < 0.03) {
            this.showQuote('low_hp', true);
          }
        }
      }
    }

    if (this.wantedStars >= 4) {
      this.heliAngle += dt * 0.9;
    }

    // Track boxed-in arrest timer
    if (touchingCop && Math.hypot(p.vx, p.vy) < 32 && this.tripTimer <= 0) {
      this.bustedProgress = Math.min(1, this.bustedProgress + dt / 2.6);
    } else {
      this.bustedProgress = Math.max(0, this.bustedProgress - dt * 1.4);
    }
  };

  Phase2GTA.prototype._updateEffects = function (dt) {
    for (var i = this.skids.length - 1; i >= 0; i--) {
      this.skids[i].life -= dt;
      if (this.skids[i].life <= 0) this.skids.splice(i, 1);
    }

    for (var s = this.shockwaves.length - 1; s >= 0; s--) {
      var sw = this.shockwaves[s];
      sw.life -= dt;
      var prog = 1 - sw.life / sw.maxLife;
      sw.radius = 25 + prog * sw.maxRadius;
      if (sw.life <= 0) this.shockwaves.splice(s, 1);
    }

    for (var p = this.particles.length - 1; p >= 0; p--) {
      var pt = this.particles[p];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.2, dt);
      pt.vy *= Math.pow(0.2, dt);
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(p, 1);
    }

    for (var u = this.popups.length - 1; u >= 0; u--) {
      var pop = this.popups[u];
      pop.y -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(u, 1);
    }
  };

  Phase2GTA.prototype._checkJeepPad = function () {
    var p = this.player;
    if (p.isJeep || this.rubles < this.jeepUnlockRubles) return;

    var pad = this.map.jeepPad;
    var dist = Math.hypot(p.x - pad.x, p.y - pad.y);
    if (dist < pad.radius) {
      p.isJeep = true;
      p.hp = p.maxHp;
      p.radius = 19;
      this.mayhem = Math.max(this.mayhem, 160);
      this._recomputeWanted();
      this.tripCharge = Math.min(100, this.tripCharge + 40);
      this.cam.shake = 0.75;

      this.audio.playHorn(true);
      this.showQuote('jeep_pickup', true);
      this._spawnExplosion(pad.x, pad.y, '#f5b800');
      this._awardPoints(1000, 'ДЖИП В МОСКВЕ! +1000', p.x, p.y, '#f5b800');
    }
  };

  Phase2GTA.prototype._checkGameOver = function (dt) {
    if (this.player.hp <= 0) {
      this._triggerGameOver('АВТОПРОБЕГ ЗАВЕРШЁН');
    } else if (this.bustedProgress >= 1) {
      this._triggerGameOver('ЗАДЕРЖАНА НА ПОСТУ');
    }
  };

  Phase2GTA.prototype._triggerGameOver = function (reason) {
    this.audio.playBusted();
    this.showQuote('busted', true);
    this.gameOverState = {
      timer: 0,
      duration: 0.95,
      reason: reason
    };
  };

  Phase2GTA.prototype.syncHUD = function () {
    var p = this.player;
    if (this.ui.district) {
      this.ui.district.textContent = this.map.getDistrict(p.x, p.y);
    }
    if (this.ui.mission) {
      if (this.tripTimer > 0) {
        this.ui.mission.textContent = '🌀 КУЛЬТУРНЫЙ ПРИХОД: ' + this.tripTimer.toFixed(1) + 'с (ОЧКИ ×3!)';
      } else if (!p.isJeep && this.rubles < this.jeepUnlockRubles) {
        var left = this.jeepUnlockRubles - this.rubles;
        this.ui.mission.textContent = 'МИССИЯ: Собери ещё ' + left + ' ₽ до Джипа в Москве!';
      } else if (!p.isJeep) {
        this.ui.mission.textContent = 'МИССИЯ: Гони на золотую метку — МОЙ ДЖИП В МОСКВЕ!';
      } else {
        this.ui.mission.textContent = 'ДЖИП В МОСКВЕ! Тарань кордоны, лови 🌀 Приход!';
      }
    }

    if (this.ui.rubles) this.ui.rubles.textContent = String(this.rubles);
    if (this.ui.score) this.ui.score.textContent = String(this.score);
    if (this.ui.combo) {
      var mult = this.combo * (this.tripTimer > 0 ? 3 : 1);
      this.ui.combo.textContent = '×' + (+mult.toFixed(1));
    }
    if (this.ui.vehicleBadge) {
      this.ui.vehicleBadge.textContent = p.isJeep ? '🚙 ДЖИП В МОСКВЕ' : '🚌 АВТОБУС № 24';
    }
    if (this.ui.hpFill) this.ui.hpFill.style.width = Math.max(0, Math.round(p.hp)) + '%';
    if (this.ui.hpVal) this.ui.hpVal.textContent = String(Math.max(0, Math.round(p.hp)));

    var tripPct = this.tripTimer > 0 ? Math.round((this.tripTimer / 10) * 100) : Math.round(this.tripCharge);
    if (this.ui.tripFill) this.ui.tripFill.style.width = tripPct + '%';
    if (this.ui.tripVal) this.ui.tripVal.textContent = tripPct + '%';

    for (var s = 0; s < this.ui.stars.length; s++) {
      if (s < this.wantedStars) this.ui.stars[s].classList.add('active');
      else this.ui.stars[s].classList.remove('active');
    }

    if (this.ui.btnShock) {
      if (this.shockCooldown > 0) this.ui.btnShock.classList.add('cooldown');
      else this.ui.btnShock.classList.remove('cooldown');
    }

    if (this.ui.btnTrip) {
      if (this.tripCharge >= 100 && this.tripTimer <= 0) this.ui.btnTrip.classList.add('ready');
      else this.ui.btnTrip.classList.remove('ready');
    }

    if (this.ui.subtitle) {
      if (this.subtitleTimer > 0 && this.subtitleText) {
        this.ui.subtitle.textContent = this.subtitleText;
        this.ui.subtitle.classList.remove('hidden');
      } else {
        this.ui.subtitle.classList.add('hidden');
      }
    }
  };

  Phase2GTA.prototype.render = function (ctx, w, h) {
    var tripActive = this.tripTimer > 0;
    var camX = this.cam.x;
    var camY = this.cam.y;
    var zoom = this.cam.zoom;

    ctx.save();

    // Base twilight asphalt background
    ctx.fillStyle = '#181e28';
    ctx.fillRect(0, 0, w, h);

    var shakeX = (Math.random() - 0.5) * this.cam.shake * 22;
    var shakeY = (Math.random() - 0.5) * this.cam.shake * 22;

    ctx.translate(w * 0.5 + shakeX, h * 0.5 + shakeY);
    if (this.cam.roll !== 0) {
      ctx.rotate(this.cam.roll);
    }
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    var viewHalfW = (w * 0.5) / zoom + 220;
    var viewHalfH = (h * 0.5) / zoom + 220;

    this._drawGroundAndRoads(ctx, camX, camY, viewHalfW, viewHalfH);
    this._drawSkidmarks(ctx);
    this._drawPickups(ctx);
    this._drawPedsAndCars(ctx, tripActive);
    this._drawExtrudedBuildings(ctx, camX, camY, viewHalfW, viewHalfH);
    this._drawWorldFX(ctx, tripActive);

    ctx.restore();

    // Screen-space overlays (LSD acid wash + hallucinations, directional Jeep pointer, crisp Minimap)
    ctx.save();
    if (tripActive) {
      this._drawTripOverlay(ctx, w, h);
      this._drawTripHallucinations(ctx, w, h);
    }
    if (this.gameOverState) {
      var desat = Math.min(1, this.gameOverState.timer / this.gameOverState.duration);
      ctx.fillStyle = 'rgba(10, 12, 18,' + (desat * 0.58).toFixed(2) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    this._drawJeepEdgePointer(ctx, w, h);
    this._drawMinimap(ctx, w);
    ctx.restore();
  };

  Phase2GTA.prototype._drawGroundAndRoads = function (ctx, camX, camY, vw, vh) {
    var size = this.map.worldSize;
    var rw = this.map.roadWidth;
    var rh = this.map.roadHalf;
    var centers = this.map.roadCenters;

    // Sidewalks / ground base inside world
    ctx.fillStyle = '#262d38';
    ctx.fillRect(0, 0, size, size);

    // Asphalt avenues
    ctx.fillStyle = '#1b2028';
    for (var i = 0; i < centers.length; i++) {
      var c = centers[i];
      ctx.fillRect(0, c - rh, size, rw);
      ctx.fillRect(c - rh, 0, rw, size);
    }

    // Road curbs
    ctx.strokeStyle = '#3b4454';
    ctx.lineWidth = 4;
    for (i = 0; i < centers.length; i++) {
      c = centers[i];
      ctx.strokeRect(0, c - rh, size, rw);
      ctx.strokeRect(c - rh, 0, rw, size);
    }

    // Center dashed lane dividers
    ctx.strokeStyle = 'rgba(245, 184, 0, 0.45)';
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 24]);
    ctx.beginPath();
    for (i = 0; i < centers.length; i++) {
      c = centers[i];
      ctx.moveTo(0, c);
      ctx.lineTo(size, c);
      ctx.moveTo(c, 0);
      ctx.lineTo(c, size);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Zebra crosswalks & warm streetlamp corner pools at intersections
    var cwList = this.map.crosswalks;
    for (i = 0; i < cwList.length; i++) {
      var cw = cwList[i];
      if (Math.abs(cw.x - camX) > vw + 120 || Math.abs(cw.y - camY) > vh + 120) continue;

      ctx.fillStyle = 'rgba(232, 238, 248, 0.22)';
      for (var st = -rh + 12; st <= rh - 18; st += 16) {
        // Horizontal arms (left & right of intersection)
        ctx.fillRect(cw.x - rh - 24, cw.y + st, 20, 8);
        ctx.fillRect(cw.x + rh + 4, cw.y + st, 20, 8);
        // Vertical arms (top & bottom of intersection)
        ctx.fillRect(cw.x + st, cw.y - rh - 24, 8, 20);
        ctx.fillRect(cw.x + st, cw.y + rh + 4, 8, 20);
      }

      // Corner streetlamp amber glow pools
      ctx.fillStyle = 'rgba(255, 195, 80, 0.11)';
      var corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (var cr = 0; cr < corners.length; cr++) {
        ctx.beginPath();
        ctx.arc(cw.x + corners[cr][0] * (rh + 10), cw.y + corners[cr][1] * (rh + 10), 42, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Griboedov Canal & bridges at vertical avenues
    var cy = this.map.canalY;
    var ch = this.map.canalHalf;
    ctx.fillStyle = '#0d2638';
    ctx.fillRect(0, cy - ch, size, ch * 2);

    // Water shimmer lines
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
    ctx.lineWidth = 2;
    for (var wx = 40; wx < size; wx += 90) {
      var wave = Math.sin(this.time * 2 + wx * 0.05) * 6;
      ctx.beginPath();
      ctx.moveTo(wx, cy + wave * 0.4);
      ctx.lineTo(wx + 42, cy + wave * 0.4);
      ctx.stroke();
    }

    // Stone bridges where vertical avenues cross the canal
    for (i = 0; i < centers.length; i++) {
      c = centers[i];
      ctx.fillStyle = '#252b36';
      ctx.fillRect(c - rh, cy - ch - 4, rw, ch * 2 + 8);
      ctx.fillStyle = '#737d8c';
      ctx.fillRect(c - rh - 6, cy - ch - 4, 8, ch * 2 + 8);
      ctx.fillRect(c + rh - 2, cy - ch - 4, 8, ch * 2 + 8);
    }

    // Puddles
    ctx.fillStyle = 'rgba(56, 128, 178, 0.24)';
    for (var p = 0; p < this.map.puddles.length; p++) {
      var pud = this.map.puddles[p];
      if (Math.abs(pud.x - camX) > vw || Math.abs(pud.y - camY) > vh) continue;
      ctx.beginPath();
      ctx.ellipse(pud.x, pud.y, pud.rx, pud.ry, pud.rot, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bus stops ("А")
    for (var b = 0; b < this.map.busStops.length; b++) {
      var st = this.map.busStops[b];
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.fillStyle = '#1d4d8b';
      ctx.fillRect(-16, -10, 32, 20);
      ctx.strokeStyle = '#f5b800';
      ctx.lineWidth = 2;
      ctx.strokeRect(-16, -10, 32, 20);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('А', 0, 1);
      ctx.restore();
    }

    // Moscow Plaza & Golden Jeep Garage Pad
    ctx.fillStyle = '#2f3744';
    ctx.fillRect(1758, 1758, 324, 324);

    var pad = this.map.jeepPad;
    var unlocked = !this.player.isJeep && this.rubles >= this.jeepUnlockRubles;
    var pulse = 0.7 + Math.sin(this.time * 5) * 0.3;

    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.fillStyle = unlocked ? 'rgba(245, 184, 0, 0.22)' : 'rgba(255, 255, 255, 0.06)';
    ctx.strokeStyle = unlocked ? 'rgba(245, 184, 0,' + pulse.toFixed(2) + ')' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = unlocked ? 5 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, pad.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Parked waiting Moscow Jeep silhouette if not yet picked up
    if (!this.player.isJeep) {
      this._drawJeepSprite(ctx, 0, 0, -Math.PI / 4, unlocked ? 1 : 0.45);
    }

    ctx.fillStyle = unlocked ? '#f5b800' : '#9aa7bd';
    ctx.font = '900 14px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('МОСКВА • МОЙ ДЖИП', 0, -pad.radius - 10);
    ctx.restore();

    // Courtyard & canal embankment trees
    var trees = this.map.trees;
    for (var tr = 0; tr < trees.length; tr++) {
      var tree = trees[tr];
      if (Math.abs(tree.x - camX) > vw || Math.abs(tree.y - camY) > vh) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.arc(tree.x + 4, tree.y + 5, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#234a2e';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#336b42';
      ctx.beginPath();
      ctx.arc(tree.x - 2, tree.y - 2, tree.r * 0.68, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  Phase2GTA.prototype._drawSkidmarks = function (ctx) {
    for (var i = 0; i < this.skids.length; i++) {
      var s = this.skids[i];
      var alpha = Math.min(0.65, s.life / 5.5);
      ctx.fillStyle = s.trip
        ? 'hsla(' + s.hue + ', 100%, 60%, ' + alpha.toFixed(2) + ')'
        : 'rgba(8, 10, 14, ' + (alpha * 0.85).toFixed(2) + ')';
      ctx.fillRect(s.x1 - 3, s.y1 - 3, 6, 6);
      ctx.fillRect(s.x2 - 3, s.y2 - 3, 6, 6);
    }
  };

  Phase2GTA.prototype._drawPickups = function (ctx) {
    for (var i = 0; i < this.pickups.length; i++) {
      var it = this.pickups[i];
      var bob = Math.sin(it.phase) * 3;
      ctx.save();
      ctx.translate(it.x, it.y + bob);

      if (it.type === 'trip') {
        ctx.rotate(it.phase * 0.9);
        ctx.fillStyle = 'rgba(224, 64, 251, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e040fb';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 1.6);
        ctx.stroke();
        ctx.strokeStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(0, 0, 8, Math.PI * 0.5, Math.PI * 2.1);
        ctx.stroke();
      } else if (it.type === 'beret') {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 9, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(-2, -4, 4, 6);
      } else {
        var big = it.type === 'ruble10';
        ctx.fillStyle = big ? '#ffca28' : '#d4a017';
        ctx.strokeStyle = '#704b00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, big ? 13 : 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#4a3100';
        ctx.font = 'bold ' + (big ? '12px' : '10px') + ' monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(big ? '10' : '₽', 0, 1);
      }
      ctx.restore();
    }
  };

  Phase2GTA.prototype._drawPedsAndCars = function (ctx, tripActive) {
    // Pedestrians
    for (var i = 0; i < this.peds.length; i++) {
      var ped = this.peds[i];
      if (ped.respawnTimer > 0 && ped.scaredTimer <= 0) continue;
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(2, 3, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2c9a0';
      ctx.beginPath();
      ctx.arc(0, -1, 4, 0, Math.PI * 2);
      ctx.fill();
      if (ped.scaredTimer > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ОЙ!', 0, -14);
      }
      ctx.restore();
    }

    // Civilian traffic
    for (var t = 0; t < this.traffic.length; t++) {
      var car = this.traffic[t];
      this._drawGenericCar(ctx, car.x, car.y, car.angle, car.color, car.kind === 'gazelle' ? 42 : 34, 18, false);
    }

    // Police units
    for (var c = 0; c < this.cops.length; c++) {
      var cop = this.cops[c];
      var col = cop.tier === 'omon' ? '#1c2a3a' : (cop.tier === 'conductor' ? '#6b2238' : '#e6eef8');
      var len = cop.tier === 'omon' ? 46 : 38;
      this._drawGenericCar(ctx, cop.x, cop.y, cop.angle, col, len, 20, true);
    }

    // Player Vehicle (with optional chromatic ghost during LSD Trip Mode)
    var p = this.player;
    if (tripActive) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      if (p.isJeep) {
        this._drawJeepSprite(ctx, p.x - 9, p.y - 5, p.angle, 1, '#00e5ff');
        this._drawJeepSprite(ctx, p.x + 9, p.y + 5, p.angle, 1, '#e040fb');
      } else {
        this._drawBusSprite(ctx, p.x - 10, p.y - 5, p.angle, '#00e5ff');
        this._drawBusSprite(ctx, p.x + 10, p.y + 5, p.angle, '#e040fb');
      }
      ctx.restore();
    }

    if (p.isJeep) {
      this._drawJeepSprite(ctx, p.x, p.y, p.angle, 1);
    } else {
      this._drawBusSprite(ctx, p.x, p.y, p.angle);
    }

    // Arrest warning progress ring if pinned by police
    if (this.bustedProgress > 0.05) {
      ctx.save();
      ctx.strokeStyle = '#ff2a3c';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.bustedProgress);
      ctx.stroke();
      ctx.fillStyle = '#ff2a3c';
      ctx.font = '900 13px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ПОСИДИ, ДРУЖОК...', p.x, p.y - p.radius - 18);
      ctx.restore();
    }
  };

  Phase2GTA.prototype._drawGenericCar = function (ctx, x, y, angle, color, len, wid, isCop) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-len * 0.5 + 4, -wid * 0.5 + 5, len, wid);

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(-len * 0.5, -wid * 0.5, len, wid);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-len * 0.5, -wid * 0.5, len, wid);

    // Windshield & rear window
    ctx.fillStyle = '#182436';
    ctx.fillRect(len * 0.1, -wid * 0.4, len * 0.22, wid * 0.8);
    ctx.fillRect(-len * 0.34, -wid * 0.36, len * 0.14, wid * 0.72);

    if (isCop) {
      // Blue stripe + alternating red/blue strobe roof lights
      ctx.fillStyle = '#1565c0';
      ctx.fillRect(-len * 0.45, -2, len * 0.9, 4);
      var flash = Math.floor(this.time * 10) % 2 === 0;
      ctx.fillStyle = flash ? '#ff1744' : '#00b0ff';
      ctx.fillRect(-3, -wid * 0.35, 6, wid * 0.35);
      ctx.fillStyle = flash ? '#00b0ff' : '#ff1744';
      ctx.fillRect(-3, 0, 6, wid * 0.35);
    }
    ctx.restore();
  };

  Phase2GTA.prototype._drawBusSprite = function (ctx, x, y, angle, tintOverride) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    var len = 58;
    var wid = 24;

    // Headlight cones
    ctx.fillStyle = 'rgba(255, 240, 175, 0.18)';
    ctx.beginPath();
    ctx.moveTo(len * 0.5, -wid * 0.35);
    ctx.lineTo(len * 0.5 + 110, -wid * 1.4);
    ctx.lineTo(len * 0.5 + 110, wid * 1.4);
    ctx.lineTo(len * 0.5, wid * 0.35);
    ctx.closePath();
    ctx.fill();

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-len * 0.5 + 5, -wid * 0.5 + 6, len, wid);

    // Wheel arches
    ctx.fillStyle = '#11151d';
    ctx.fillRect(-len * 0.34, -wid * 0.5 - 2, 12, 2);
    ctx.fillRect(len * 0.14, -wid * 0.5 - 2, 12, 2);
    ctx.fillRect(-len * 0.34, wid * 0.5, 12, 2);
    ctx.fillRect(len * 0.14, wid * 0.5, 12, 2);

    // LiAZ Blue & White body
    ctx.fillStyle = tintOverride || '#e8eef5';
    ctx.fillRect(-len * 0.5, -wid * 0.5, len, wid);
    ctx.fillStyle = tintOverride || '#1b5eb8';
    ctx.fillRect(-len * 0.48, -wid * 0.5, len * 0.96, 4);
    ctx.fillRect(-len * 0.48, wid * 0.5 - 4, len * 0.96, 4);

    // Roof hatches & № 24 roof badge
    ctx.fillStyle = '#c2cdd9';
    ctx.fillRect(-16, -6, 12, 12);
    ctx.fillRect(4, -6, 12, 12);
    if (!tintOverride) {
      ctx.fillStyle = '#0d223f';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('24', -10, 0);
    }

    // Front panoramic windshield
    ctx.fillStyle = '#101d2e';
    ctx.fillRect(len * 0.34, -wid * 0.42, len * 0.13, wid * 0.84);

    // Headlights & brake lights
    ctx.fillStyle = '#fff59d';
    ctx.fillRect(len * 0.47, -wid * 0.4, 3, 5);
    ctx.fillRect(len * 0.47, wid * 0.4 - 5, 3, 5);
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(-len * 0.5, -wid * 0.4, 3, 5);
    ctx.fillRect(-len * 0.5, wid * 0.4 - 5, 3, 5);

    ctx.restore();
  };

  Phase2GTA.prototype._drawJeepSprite = function (ctx, x, y, angle, alpha, tintOverride) {
    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 1;
    ctx.translate(x, y);
    ctx.rotate(angle);

    var len = 44;
    var wid = 24;

    // Strong amber/white Jeep headlights
    ctx.fillStyle = 'rgba(255, 225, 130, 0.22)';
    ctx.beginPath();
    ctx.moveTo(len * 0.5, -wid * 0.35);
    ctx.lineTo(len * 0.5 + 130, -wid * 1.5);
    ctx.lineTo(len * 0.5 + 130, wid * 1.5);
    ctx.lineTo(len * 0.5, wid * 0.35);
    ctx.closePath();
    ctx.fill();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fillRect(-len * 0.5 + 5, -wid * 0.5 + 6, len, wid);

    // Matte black & gold-trimmed Moscow Jeep
    ctx.fillStyle = tintOverride || '#1b1f27';
    ctx.fillRect(-len * 0.5, -wid * 0.5, len, wid);
    ctx.strokeStyle = '#f5b800';
    ctx.lineWidth = 2;
    ctx.strokeRect(-len * 0.5, -wid * 0.5, len, wid);

    // Spare wheel mounted on back
    ctx.fillStyle = '#0e1014';
    ctx.fillRect(-len * 0.5 - 4, -7, 4, 14);

    // Windshield & sunroof
    ctx.fillStyle = '#182c42';
    ctx.fillRect(len * 0.08, -wid * 0.38, len * 0.22, wid * 0.76);
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(-len * 0.28, -wid * 0.34, len * 0.3, wid * 0.68);

    // Bullbar in front
    ctx.fillStyle = '#9aa7bd';
    ctx.fillRect(len * 0.5, -wid * 0.42, 3, wid * 0.84);

    ctx.restore();
  };

  Phase2GTA.prototype._drawExtrudedBuildings = function (ctx, camX, camY, vw, vh) {
    var blds = this.map.buildings;
    // Draw furthest buildings from camera first for clean 2.5D painter's order
    var visible = [];
    for (var i = 0; i < blds.length; i++) {
      var b = blds[i];
      if (b.x + b.w < camX - vw || b.x > camX + vw || b.y + b.h < camY - vh || b.y > camY + vh) {
        continue;
      }
      var cx = b.x + b.w * 0.5;
      var cy = b.y + b.h * 0.5;
      var distSq = (cx - camX) * (cx - camX) + (cy - camY) * (cy - camY);
      visible.push({ b: b, distSq: distSq });
    }

    visible.sort(function (a, c) {
      return c.distSq - a.distSq;
    });

    for (var v = 0; v < visible.length; v++) {
      var bld = visible[v].b;
      var x0 = bld.x;
      var y0 = bld.y;
      var x1 = bld.x + bld.w;
      var y1 = bld.y + bld.h;
      var z = bld.z;

      var rx0 = x0 + (x0 - camX) * z;
      var ry0 = y0 + (y0 - camY) * z;
      var rx1 = x1 + (x1 - camX) * z;
      var ry1 = y1 + (y1 - camY) * z;

      // Draw visible side walls facing the camera + lit apartment windows
      ctx.fillStyle = bld.wallColor;
      if (camY < y0) {
        this._drawQuad(ctx, x0, y0, x1, y0, rx1, ry0, rx0, ry0);
        this._drawWallWindows(ctx, x0, y0, x1, y0, rx0, ry0, rx1, ry0, bld.w, bld.windowSeed + 1);
      }
      if (camY > y1) {
        this._drawQuad(ctx, x0, y1, x1, y1, rx1, ry1, rx0, ry1);
        this._drawWallWindows(ctx, x0, y1, x1, y1, rx0, ry1, rx1, ry1, bld.w, bld.windowSeed + 2);
      }

      ctx.fillStyle = bld.trimColor;
      if (camX < x0) {
        this._drawQuad(ctx, x0, y0, x0, y1, rx0, ry1, rx0, ry0);
        this._drawWallWindows(ctx, x0, y0, x0, y1, rx0, ry0, rx0, ry1, bld.h, bld.windowSeed + 3);
      }
      if (camX > x1) {
        this._drawQuad(ctx, x1, y0, x1, y1, rx1, ry1, rx1, ry0);
        this._drawWallWindows(ctx, x1, y0, x1, y1, rx1, ry0, rx1, ry1, bld.h, bld.windowSeed + 4);
      }

      // Roof surface + parapet rim
      ctx.fillStyle = bld.roofColor;
      ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
      ctx.strokeStyle = 'rgba(0,0,0,0.48)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx0, ry0, rx1 - rx0, ry1 - ry0);

      var rw = rx1 - rx0;
      var rh = ry1 - ry0;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      if (rw > 24 && rh > 24) {
        ctx.strokeRect(rx0 + 6, ry0 + 6, rw - 12, rh - 12);
      }

      // Rooftop vents / skylights
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (var k = 0; k < bld.vents.length; k++) {
        var vt = bld.vents[k];
        ctx.fillRect(rx0 + rw * vt.rx, ry0 + rh * vt.ry, vt.rw, vt.rh);
      }

      // Retro Russian rooftop shop signs
      if (bld.signLabel && rw > 90) {
        var sw = Math.min(rw - 16, 118);
        var sh = 18;
        var sx = rx0 + rw * 0.5 - sw * 0.5;
        var sy = ry0 + rh * 0.5 - sh * 0.5;
        ctx.fillStyle = 'rgba(12, 16, 26, 0.86)';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = '#f5b800';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.fillStyle = '#ffd54f';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bld.signLabel, sx + sw * 0.5, sy + sh * 0.5 + 1, sw - 8);
      }
    }
  };

  Phase2GTA.prototype._drawWallWindows = function (ctx, bx0, by0, bx1, by1, rx0, ry0, rx1, ry1, spanPx, seed) {
    var cols = Math.max(2, Math.min(8, Math.floor(spanPx / 34)));
    var rows = 2;
    for (var r = 0; r < rows; r++) {
      var v0 = 0.20 + r * 0.36;
      var v1 = v0 + 0.22;
      for (var c = 0; c < cols; c++) {
        var u0 = (c + 0.22) / cols;
        var u1 = (c + 0.78) / cols;

        // Deterministic lit vs dark window hash
        var h = ((seed * 31 + r * 17 + c * 53) & 15);
        if (h < 5) ctx.fillStyle = 'rgba(255, 214, 102, 0.82)'; // warm lit flat
        else if (h === 6 || h === 7) ctx.fillStyle = 'rgba(92, 214, 255, 0.55)'; // TV glow
        else ctx.fillStyle = 'rgba(14, 20, 30, 0.65)'; // dark window

        var p00x = bx0 + (bx1 - bx0) * u0;
        var p00y = by0 + (by1 - by0) * u0;
        var p10x = bx0 + (bx1 - bx0) * u1;
        var p10y = by0 + (by1 - by0) * u1;
        var q00x = rx0 + (rx1 - rx0) * u0;
        var q00y = ry0 + (ry1 - ry0) * u0;
        var q10x = rx0 + (rx1 - rx0) * u1;
        var q10y = ry0 + (ry1 - ry0) * u1;

        ctx.beginPath();
        ctx.moveTo(p00x + (q00x - p00x) * v0, p00y + (q00y - p00y) * v0);
        ctx.lineTo(p10x + (q10x - p10x) * v0, p10y + (q10y - p10y) * v0);
        ctx.lineTo(p10x + (q10x - p10x) * v1, p10y + (q10y - p10y) * v1);
        ctx.lineTo(p00x + (q00x - p00x) * v1, p00y + (q00y - p00y) * v1);
        ctx.closePath();
        ctx.fill();
      }
    }
  };

  Phase2GTA.prototype._drawQuad = function (ctx, x1, y1, x2, y2, x3, y3, x4, y4) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  Phase2GTA.prototype._drawWorldFX = function (ctx, tripActive) {
    // Shockwave rings
    for (var s = 0; s < this.shockwaves.length; s++) {
      var sw = this.shockwaves[s];
      var a = sw.life / sw.maxLife;
      ctx.strokeStyle = tripActive
        ? 'rgba(224, 64, 251,' + a.toFixed(2) + ')'
        : 'rgba(245, 184, 0,' + a.toFixed(2) + ')';
      ctx.lineWidth = 8 * a + 2;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 229, 255,' + (a * 0.8).toFixed(2) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius * 0.78, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Particles
    for (var p = 0; p < this.particles.length; p++) {
      var pt = this.particles[p];
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // 4-star Helicopter sweeping spotlight
    if (this.wantedStars >= 4) {
      var sx = this.player.x + Math.cos(this.heliAngle) * 85;
      var sy = this.player.y + Math.sin(this.heliAngle * 1.3) * 85;
      var grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, 125);
      grad.addColorStop(0, 'rgba(220, 245, 255, 0.34)');
      grad.addColorStop(1, 'rgba(220, 245, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, 125, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating world popups
    for (var u = 0; u < this.popups.length; u++) {
      var pop = this.popups[u];
      var alpha = Math.min(1, pop.life / (pop.maxLife * 0.4));
      ctx.globalAlpha = alpha;
      ctx.font = '900 18px Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;
  };

  Phase2GTA.prototype._drawTripOverlay = function (ctx, w, h) {
    ctx.save();
    var hue1 = (this.time * 140) % 360;
    var hue2 = (hue1 + 125) % 360;
    var hue3 = (hue1 + 240) % 360;

    // Vivid psychedelic radial plasma & color shift (fast on every GPU/CPU)
    ctx.globalCompositeOperation = 'screen';
    var grad = ctx.createRadialGradient(
      w * (0.5 + Math.sin(this.time * 2.1) * 0.2),
      h * (0.5 + Math.cos(this.time * 1.7) * 0.2),
      30,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.78
    );
    grad.addColorStop(0, 'hsla(' + hue1.toFixed(0) + ', 95%, 55%, 0.24)');
    grad.addColorStop(0.55, 'hsla(' + hue2.toFixed(0) + ', 95%, 52%, 0.22)');
    grad.addColorStop(1, 'hsla(' + hue3.toFixed(0) + ', 95%, 45%, 0.34)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Wavy VHS/LSD chromatic scan-bands
    for (var b = 0; b < 6; b++) {
      var by = ((b * (h / 6) + this.time * 160) % h);
      ctx.fillStyle = 'hsla(' + ((hue1 + b * 45) % 360).toFixed(0) + ', 100%, 62%, 0.12)';
      ctx.fillRect(0, by, w, 10 + Math.sin(this.time * 7 + b) * 5);
    }
    ctx.restore();
  };

  Phase2GTA.prototype._drawTripHallucinations = function (ctx, w, h) {
    ctx.save();
    for (var i = 0; i < this.hallucinations.length; i++) {
      var hal = this.hallucinations[i];
      var a = hal.angle + this.time * hal.spin;
      var sx = w * 0.5 + Math.cos(a) * Math.min(w, h) * 0.32;
      var sy = h * 0.5 + Math.sin(a * 1.2) * Math.min(w, h) * 0.25;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(this.time * 3 + i) * 0.45);
      ctx.globalAlpha = 0.42;

      if (hal.kind === 'jeep') {
        this._drawJeepSprite(ctx, 0, 0, this.time * 2, 0.55, '#00e5ff');
      } else if (hal.kind === 'beret') {
        if (this.nataliaImgReady) {
          ctx.globalAlpha = 0.68;
          ctx.beginPath();
          ctx.arc(0, 0, 30, 0, Math.PI * 2);
          ctx.save();
          ctx.clip();
          ctx.drawImage(this.nataliaImg, -36, -30, 72, 60);
          ctx.restore();
          ctx.strokeStyle = i % 2 === 0 ? '#e040fb' : '#00e5ff';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#e040fb';
          ctx.font = '900 22px Impact, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('МОРСКАЯ ПЕХОТА!', 0, 0);
        }
      } else if (hal.kind === 'ruble') {
        ctx.fillStyle = '#ffd54f';
        ctx.font = '900 42px Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('₽', 0, 14);
      } else {
        ctx.fillStyle = i % 2 === 0 ? '#e040fb' : '#00e5ff';
        ctx.font = '900 22px Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(hal.word, 0, 0);
      }
      ctx.restore();
    }
    ctx.restore();
  };

  Phase2GTA.prototype._drawJeepEdgePointer = function (ctx, w, h) {
    if (this.player.isJeep || this.rubles < this.jeepUnlockRubles) return;
    var pad = this.map.jeepPad;
    var dx = pad.x - this.player.x;
    var dy = pad.y - this.player.y;
    var dist = Math.hypot(dx, dy);
    if (dist < 220) return;

    var ang = Math.atan2(dy, dx);
    var r = Math.min(w, h) * 0.38;
    var px = w * 0.5 + Math.cos(ang) * r;
    var py = h * 0.5 + Math.sin(ang) * r;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = '#f5b800';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.rotate(-ang);
    ctx.fillStyle = '#f5b800';
    ctx.font = '900 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ДЖИП ' + Math.round(dist / 10) + 'м', 0, 24);
    ctx.restore();
  };

  Phase2GTA.prototype._drawMinimap = function (ctx, w) {
    var size = w <= 768 ? 104 : 140;
    var mx = w <= 768 ? 8 : 12;
    var my = w <= 768 ? 8 : 12;
    var scale = size / this.map.worldSize;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 22, 0.86)';
    ctx.strokeStyle = 'rgba(245, 184, 0, 0.65)';
    ctx.lineWidth = 2;
    ctx.fillRect(mx, my, size, size);
    ctx.strokeRect(mx, my, size, size);

    // Roads on minimap
    ctx.fillStyle = 'rgba(180, 200, 225, 0.25)';
    var centers = this.map.roadCenters;
    var rw = Math.max(4, this.map.roadWidth * scale);
    for (var i = 0; i < centers.length; i++) {
      var pos = centers[i] * scale - rw * 0.5;
      ctx.fillRect(mx, my + pos, size, rw);
      ctx.fillRect(mx + pos, my, rw, size);
    }

    // Griboedov Canal line
    ctx.fillStyle = 'rgba(0, 180, 255, 0.4)';
    ctx.fillRect(mx, my + (this.map.canalY - 24) * scale, size, 3);

    // Trip spiral blips
    ctx.fillStyle = '#e040fb';
    for (var p = 0; p < this.pickups.length; p++) {
      if (this.pickups[p].type === 'trip') {
        ctx.fillRect(mx + this.pickups[p].x * scale - 2, my + this.pickups[p].y * scale - 2, 4, 4);
      }
    }

    // Moscow Jeep garage pad marker
    if (!this.player.isJeep) {
      var pad = this.map.jeepPad;
      ctx.fillStyle = this.rubles >= this.jeepUnlockRubles ? '#f5b800' : 'rgba(245,184,0,0.4)';
      ctx.beginPath();
      ctx.arc(mx + pad.x * scale, my + pad.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cop red dots
    ctx.fillStyle = '#ff2a3c';
    for (var c = 0; c < this.cops.length; c++) {
      ctx.fillRect(mx + this.cops[c].x * scale - 2, my + this.cops[c].y * scale - 2, 4, 4);
    }

    // Player bright triangle
    var px = mx + this.player.x * scale;
    var py = my + this.player.y * scale;
    ctx.translate(px, py);
    ctx.rotate(this.player.angle);
    ctx.fillStyle = '#39ff14';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  Startuem.Phase2GTA = Phase2GTA;
})(window);

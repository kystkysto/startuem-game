(function (global) {
  'use strict';

  var Startuem = global.Startuem = global.Startuem || {};

  var ZONE_NAMES = ['САЛОН', 'ВАЛИДАТОР', 'КАБИНА ВОДИТЕЛЯ'];

  function Phase1Bus(opts) {
    this.audio = opts.audio;
    this.onComplete = opts.onComplete;

    this.authority = 0;
    this.rubles = 15;
    this.walkPos = 0.25; // 0 = Salon, 1 = Validator, 2 = Driver cabin
    this.walkBob = 0;
    this.busTime = 0;

    this.encounterIndex = 0;
    this.encounterTimer = 9.0;
    this.encounterMaxTimer = 9.0;
    this.encounterIntroPlayed = false;

    this.gesture = null; // { type, timer, duration, quote, color }
    this.popups = [];
    this.flyingCoins = [];
    this.driverEject = null; // { timer, active }
    this.completed = false;
    this.shake = 0;

    this.ui = {
      zoneLabel: document.getElementById('p1-zone-label'),
      walkStatus: document.getElementById('p1-walk-status'),
      authFill: document.getElementById('p1-authority-fill'),
      authPct: document.getElementById('p1-authority-pct'),
      rublesEl: document.getElementById('p1-rubles'),
      climaxWrap: document.getElementById('p1-climax-wrap'),
      phraseButtons: Array.prototype.slice.call(document.querySelectorAll('#p1-phrase-grid .btn-phrase'))
    };
  }

  Phase1Bus.prototype.reset = function () {
    this.authority = 0;
    this.rubles = 15;
    this.walkPos = 0.2;
    this.walkBob = 0;
    this.busTime = 0;
    this.encounterIndex = 0;
    this.encounterTimer = 9.0;
    this.encounterIntroPlayed = false;
    this.gesture = null;
    this.popups = [];
    this.flyingCoins = [];
    this.driverEject = null;
    this.completed = false;
    this.shake = 0;
    this.syncHUD();
  };

  Phase1Bus.prototype.getCurrentZone = function () {
    return Math.max(0, Math.min(2, Math.round(this.walkPos)));
  };

  Phase1Bus.prototype.getActiveEncounter = function () {
    var list = Startuem.QUOTES.P1_ENCOUNTERS;
    return list[this.encounterIndex % list.length];
  };

  Phase1Bus.prototype.stepWalk = function (delta) {
    if (this.driverEject && this.driverEject.active) return;
    this.walkPos = Math.max(0, Math.min(2, this.walkPos + delta));
    this.walkBob += Math.abs(delta) * 14;
    this.syncHUD();
  };

  Phase1Bus.prototype.triggerAction = function (actionId) {
    if (this.completed || (this.driverEject && this.driverEject.active)) return;
    var action = Startuem.QUOTES.P1_ACTIONS[actionId];
    if (!action) return;

    this.audio.unlock();
    this.audio.playGesture(action.gesture);
    this.audio.playVoice(action.slotId, null, true);

    this.gesture = {
      type: action.gesture,
      timer: 0.65,
      duration: 0.65,
      quote: action.quote,
      color: action.color
    };
    this.shake = 0.25;

    var enc = this.getActiveEncounter();
    var zone = this.getCurrentZone();
    var isMatch = enc.expectedAction === actionId;
    var isPointBlank = zone === enc.zone;

    if (isMatch) {
      var gainAuth = isPointBlank ? 34 : 24;
      var gainRubles = isPointBlank ? 18 : 12;
      this.authority = Math.min(100, this.authority + gainAuth);
      this.rubles += gainRubles;
      this.audio.playCoin();

      this.popups.push({
        text: isPointBlank ? 'В УПОР! ×1.5  +' + gainRubles + '₽' : 'КУЛЬТУРНО! +' + gainRubles + '₽',
        x: 0.36 + Math.random() * 0.28,
        y: 0.33 + Math.random() * 0.14,
        vy: -0.14,
        life: 1.25,
        maxLife: 1.25,
        color: '#39ff14'
      });

      this._spawnCoins(isPointBlank ? 6 : 4);
      this.encounterIndex++;
      this.encounterTimer = this.encounterMaxTimer;
    } else {
      this.authority = Math.min(100, this.authority + 8);
      this.rubles += 4;
      this.popups.push({
        text: '+4₽ НАПОР!',
        x: 0.38 + Math.random() * 0.24,
        y: 0.36 + Math.random() * 0.12,
        vy: -0.11,
        life: 0.9,
        maxLife: 0.9,
        color: '#f5b800'
      });
    }

    this.syncHUD();
  };

  Phase1Bus.prototype._spawnCoins = function (count) {
    for (var i = 0; i < count; i++) {
      this.flyingCoins.push({
        x: 0.45 + (Math.random() - 0.5) * 0.2,
        y: 0.52 + (Math.random() - 0.5) * 0.1,
        tx: 0.85,
        ty: 0.06,
        t: 0,
        dur: 0.55 + Math.random() * 0.25
      });
    }
  };

  Phase1Bus.prototype.triggerClimax = function () {
    if (this.completed || (this.driverEject && this.driverEject.active)) return;
    if (this.authority < 100) return;

    this.audio.unlock();
    this.audio.playStartuemBoom();
    this.audio.playVoice('startuem', 'Я сказала — стартуем!', true);

    this.walkPos = 2.0; // Snap close to driver cabin
    this.shake = 0.95;
    this.driverEject = {
      active: true,
      timer: 0,
      duration: 1.05
    };
    this.syncHUD();
    this.popups.push({
      text: 'Я СКАЗАЛА — СТАРТУЕМ!',
      x: 0.5,
      y: 0.30,
      vy: -0.05,
      life: 1.05,
      maxLife: 1.05,
      color: '#ff2a3c'
    });
  };

  Phase1Bus.prototype.syncHUD = function () {
    var zone = this.getCurrentZone();
    if (this.ui.zoneLabel) {
      this.ui.zoneLabel.textContent = ZONE_NAMES[zone];
    }
    if (this.ui.walkStatus) {
      this.ui.walkStatus.textContent = 'ПОЗИЦИЯ: ' + ZONE_NAMES[zone] + ' (' + (zone + 1) + '/3)';
    }
    if (this.ui.authFill) {
      this.ui.authFill.style.width = Math.round(this.authority) + '%';
    }
    if (this.ui.authPct) {
      this.ui.authPct.textContent = Math.round(this.authority) + '%';
    }
    if (this.ui.rublesEl) {
      this.ui.rublesEl.textContent = String(this.rubles);
    }
    if (this.ui.climaxWrap) {
      if (this.authority >= 100 && !(this.driverEject && this.driverEject.active)) {
        this.ui.climaxWrap.classList.remove('hidden');
      } else {
        this.ui.climaxWrap.classList.add('hidden');
      }
    }

    var enc = this.getActiveEncounter();
    for (var i = 0; i < this.ui.phraseButtons.length; i++) {
      var btn = this.ui.phraseButtons[i];
      if (btn.getAttribute('data-action') === enc.expectedAction && this.authority < 100) {
        btn.classList.add('is-recommended');
      } else {
        btn.classList.remove('is-recommended');
      }
    }
  };

  Phase1Bus.prototype.update = function (dt, input) {
    this.busTime += dt;
    this.shake = Math.max(0, this.shake - dt * 1.4);

    // Continuous keyboard walking along the aisle
    var walkDir = 0;
    if (input.up || input.right) walkDir += 1;
    if (input.down || input.left) walkDir -= 1;
    if (walkDir !== 0 && !(this.driverEject && this.driverEject.active)) {
      this.walkPos = Math.max(0, Math.min(2, this.walkPos + walkDir * dt * 1.35));
      this.walkBob += dt * 11;
      this.syncHUD();
    }

    // Encounter timer cycles smoothly if player stalls
    if (this.authority < 100 && !(this.driverEject && this.driverEject.active)) {
      var activeEnc = this.getActiveEncounter();
      if (!this.encounterIntroPlayed && activeEnc.introSlotId && this.busTime > 2.3 && this.authority === 0) {
        this.encounterIntroPlayed = true;
        this.audio.playVoice(activeEnc.introSlotId, activeEnc.prompt, false);
      }
      this.encounterTimer -= dt;
      if (this.encounterTimer <= 0) {
        this.encounterIndex++;
        this.encounterTimer = this.encounterMaxTimer;
        this.syncHUD();
      }
    }

    if (this.gesture) {
      this.gesture.timer -= dt;
      if (this.gesture.timer <= 0) this.gesture = null;
    }

    for (var i = this.popups.length - 1; i >= 0; i--) {
      var p = this.popups[i];
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }

    for (var c = this.flyingCoins.length - 1; c >= 0; c--) {
      var fc = this.flyingCoins[c];
      fc.t += dt;
      if (fc.t >= fc.dur) this.flyingCoins.splice(c, 1);
    }

    if (this.driverEject && this.driverEject.active) {
      this.driverEject.timer += dt;
      if (this.driverEject.timer >= this.driverEject.duration && !this.completed) {
        this.completed = true;
        if (this.onComplete) this.onComplete(this.rubles);
      }
    }
  };

  Phase1Bus.prototype.render = function (ctx, w, h) {
    ctx.save();

    // Optional psychedelic 3GP glitch preview once Authority > 60% (fast composite, zero ctx.filter lag)
    var glitchPower = Math.max(0, (this.authority - 60) / 40);
    if (this.driverEject && this.driverEject.active) glitchPower = 1.35;

    // Hand-held 2013 phone camera shake + bus road vibration + walk bob
    var roadBump = Math.sin(this.busTime * 9.5) * 2.5 + Math.sin(this.busTime * 23) * 1.1;
    var bobY = Math.sin(this.walkBob) * 5;
    var bobX = Math.cos(this.walkBob * 0.5) * 4;
    var shakeX = (Math.random() - 0.5) * this.shake * 22 + bobX;
    var shakeY = (Math.random() - 0.5) * this.shake * 20 + roadBump + bobY;
    ctx.translate(shakeX, shakeY);

    // Zoom & vanishing point shift as Natalia walks down the aisle toward cabin (walkPos 0..2)
    var zoom = 1 + this.walkPos * 0.24;
    var vx = w * 0.5;
    var vy = h * (0.43 - this.walkPos * 0.02);

    this._drawOutsidePetersburg(ctx, w, h, vx, vy, zoom);
    this._drawBusShell(ctx, w, h, vx, vy, zoom);
    this._drawCabinCharacters(ctx, w, h, vx, vy, zoom);
    this._drawHandrailsAndStraps(ctx, w, h, vx, vy, zoom);
    this._drawForegroundNatalia(ctx, w, h);
    this._drawEncounterBubble(ctx, w, h);
    this._drawPopupsAndCoins(ctx, w, h);

    // Chromatic glitch flash near climax
    if (glitchPower > 0.2) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(224, 64, 251,' + (0.08 * glitchPower).toFixed(3) + ')';
      ctx.fillRect(0, 0, w, h);
      if (Math.random() < 0.35 * glitchPower) {
        var sliceY = Math.random() * h;
        var sliceH = 6 + Math.random() * 18;
        ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
        ctx.fillRect(0, sliceY, w, sliceH);
      }
      ctx.restore();
    }

    // Final flash when driver flies out
    if (this.driverEject && this.driverEject.active) {
      var prog = this.driverEject.timer / this.driverEject.duration;
      if (prog > 0.72) {
        var alpha = Math.min(1, (prog - 0.72) / 0.28);
        ctx.fillStyle = 'rgba(255, 245, 200,' + alpha.toFixed(3) + ')';
        ctx.fillRect(-40, -40, w + 80, h + 80);
      }
    }

    ctx.restore();
  };

  Phase1Bus.prototype._drawOutsidePetersburg = function (ctx, w, h, vx, vy, zoom) {
    // Twilight Petersburg sky visible through bus windows
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0f1829');
    grad.addColorStop(0.55, '#1d2b44');
    grad.addColorStop(1, '#10151e');
    ctx.fillStyle = grad;
    ctx.fillRect(-40, -40, w + 80, h + 80);

    // Scrolling silhouettes of historic buildings & glowing streetlamps outside
    var scroll = (this.busTime * 220) % 260;
    ctx.fillStyle = '#0c121c';
    for (var i = -1; i < 9; i++) {
      var bx = ((i * 260 - scroll) % (w + 400));
      var bh = 110 + ((i * 37) % 60);
      ctx.fillRect(bx, vy - bh * 0.9, 175, bh * 1.4);

      // Amber streetlamp
      var lx = bx + 205;
      var ly = vy - 95;
      ctx.fillStyle = 'rgba(255, 196, 64, 0.25)';
      ctx.beginPath();
      ctx.arc(lx, ly, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd56b';
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c121c';
    }

    // Rain streaks on side glass
    ctx.strokeStyle = 'rgba(180, 215, 255, 0.22)';
    ctx.lineWidth = 1.5;
    for (var r = 0; r < 26; r++) {
      var rx = ((r * 79 + this.busTime * 340) % (w + 60)) - 30;
      var ry = ((r * 113 + this.busTime * 480) % h);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 14, ry + 26);
      ctx.stroke();
    }
  };

  Phase1Bus.prototype._drawBusShell = function (ctx, w, h, vx, vy, zoom) {
    // Far driver cabin back wall rectangle scaled by walkPos
    var cw = w * 0.34 * zoom;
    var ch = h * 0.42 * zoom;
    var cx = vx - cw * 0.5;
    var cy = vy - ch * 0.48;

    // Left & Right side walls (with window cutouts left transparent to show rainy SPb!)
    // Roof panel
    ctx.fillStyle = '#d3d8de';
    ctx.beginPath();
    ctx.moveTo(-40, -40);
    ctx.lineTo(w + 40, -40);
    ctx.lineTo(cx + cw, cy);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();

    // Ceiling fluorescent lamps
    for (var l = 0; l < 3; l++) {
      var t0 = 0.18 + l * 0.25;
      var t1 = t0 + 0.14;
      var y0 = t0 * cy;
      var y1 = t1 * cy;
      var lw0 = w * (0.28 - t0 * 0.18);
      var lw1 = w * (0.28 - t1 * 0.18);
      ctx.fillStyle = l === 1 ? 'rgba(220, 248, 255, 0.85)' : 'rgba(245, 252, 255, 0.65)';
      ctx.beginPath();
      ctx.moveTo(vx - lw0, y0);
      ctx.lineTo(vx + lw0, y0);
      ctx.lineTo(vx + lw1, y1);
      ctx.lineTo(vx - lw1, y1);
      ctx.closePath();
      ctx.fill();
    }

    // Floor aisle
    ctx.fillStyle = '#252c36';
    ctx.beginPath();
    ctx.moveTo(-40, h + 40);
    ctx.lineTo(w + 40, h + 40);
    ctx.lineTo(cx + cw, cy + ch);
    ctx.lineTo(cx, cy + ch);
    ctx.closePath();
    ctx.fill();

    // Aisle floor yellow safety edge lines
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h + 20);
    ctx.lineTo(cx + cw * 0.25, cy + ch);
    ctx.moveTo(w * 0.82, h + 20);
    ctx.lineTo(cx + cw * 0.75, cy + ch);
    ctx.stroke();

    // Lower interior wall panels (below windows)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(-40, h * 0.56);
    ctx.lineTo(cx, cy + ch * 0.52);
    ctx.lineTo(cx, cy + ch);
    ctx.lineTo(-40, h + 40);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w + 40, h * 0.56);
    ctx.lineTo(cx + cw, cy + ch * 0.52);
    ctx.lineTo(cx + cw, cy + ch);
    ctx.lineTo(w + 40, h + 40);
    ctx.closePath();
    ctx.fill();

    // Window vertical pillars left & right
    ctx.fillStyle = '#1e2733';
    for (var p = 0; p < 3; p++) {
      var f = 0.22 + p * 0.28;
      var lx = f * cx;
      var lyTop = f * cy;
      var lyBot = h * 0.56 + f * (cy + ch * 0.52 - h * 0.56);
      ctx.fillRect(lx - 10, lyTop, 18, lyBot - lyTop);

      var rx = w - f * (w - (cx + cw));
      ctx.fillRect(rx - 8, lyTop, 18, lyBot - lyTop);
    }

    // Blue patterned bus seats in perspective
    for (var s = 0; s < 3; s++) {
      var sf = 0.15 + s * 0.26;
      var seatW = w * 0.15 * (1 - sf * 0.45);
      var seatH = h * 0.16 * (1 - sf * 0.42);
      var slx = sf * cx + 10;
      var sly = h * 0.68 - sf * (h * 0.68 - (cy + ch * 0.62));
      this._drawSeat(ctx, slx, sly, seatW, seatH);

      var srx = w - sf * (w - (cx + cw)) - seatW - 10;
      this._drawSeat(ctx, srx, sly, seatW, seatH);
    }

    // Driver Cabin Partition at front (cx, cy, cw, ch)
    ctx.fillStyle = '#222b38';
    ctx.fillRect(cx, cy, cw, ch);

    // Front windshield inside cabin
    ctx.fillStyle = '#101a2a';
    ctx.fillRect(cx + cw * 0.08, cy + ch * 0.08, cw * 0.84, ch * 0.44);

    // Wipers & street lights through front windshield
    ctx.fillStyle = 'rgba(255, 195, 70, 0.72)';
    ctx.beginPath();
    ctx.arc(cx + cw * 0.32, cy + ch * 0.28, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + cw * 0.70, cy + ch * 0.28, 5, 0, Math.PI * 2);
    ctx.fill();

    var wiperSwing = Math.sin(this.busTime * 3.4) * 0.35;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + cw * 0.28, cy + ch * 0.50);
    ctx.lineTo(cx + cw * 0.28 + Math.sin(wiperSwing) * cw * 0.16, cy + ch * 0.20);
    ctx.moveTo(cx + cw * 0.66, cy + ch * 0.50);
    ctx.lineTo(cx + cw * 0.66 + Math.sin(wiperSwing) * cw * 0.16, cy + ch * 0.20);
    ctx.stroke();

    // Partition window glass & curtain
    ctx.fillStyle = 'rgba(130, 195, 240, 0.16)';
    ctx.fillRect(cx + cw * 0.07, cy + ch * 0.54, cw * 0.42, ch * 0.26);
    ctx.fillStyle = '#6c2b35';
    ctx.fillRect(cx + cw * 0.07, cy + ch * 0.54, cw * 0.11, ch * 0.26);

    // Destination sign plate "№ 24 • СПб"
    ctx.fillStyle = '#f4f0dc';
    ctx.fillRect(cx + cw * 0.52, cy + ch * 0.56, cw * 0.42, ch * 0.14);
    ctx.fillStyle = '#111';
    ctx.font = 'bold ' + Math.max(10, Math.round(cw * 0.05)) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('№ 24 • СПб', cx + cw * 0.73, cy + ch * 0.63);
    ctx.textBaseline = 'alphabetic';

    // Steering wheel visible in cabin
    ctx.strokeStyle = '#0d1016';
    ctx.lineWidth = Math.max(3, cw * 0.025);
    ctx.beginPath();
    ctx.ellipse(cx + cw * 0.28, cy + ch * 0.78, cw * 0.1, ch * 0.06, -0.2, 0, Math.PI * 2);
    ctx.stroke();

    // Cache cabin bounds for character placement
    this._cabin = { cx: cx, cy: cy, cw: cw, ch: ch };
  };

  Phase1Bus.prototype._drawSeat = function (ctx, x, y, w, h) {
    ctx.fillStyle = '#1d4d8b';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#2966b3';
    ctx.fillRect(x + 4, y + 4, w - 8, h * 0.55);
    ctx.strokeStyle = '#f5b800';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  };

  Phase1Bus.prototype._drawCabinCharacters = function (ctx, w, h, vx, vy, zoom) {
    var cab = this._cabin;
    var enc = this.getActiveEncounter();

    // 1. Driver inside cabin (zone 2)
    var ejectOffset = 0;
    var ejectAngle = 0;
    if (this.driverEject && this.driverEject.active) {
      var ep = this.driverEject.timer / this.driverEject.duration;
      ejectOffset = ep * ep * w * 0.9;
      ejectAngle = ep * 7.5;
    }

    ctx.save();
    var drvX = cab.cx + cab.cw * 0.29 + ejectOffset;
    var drvY = cab.cy + cab.ch * 0.66 - Math.sin(Math.min(1, ejectOffset / 300) * Math.PI) * 90;
    ctx.translate(drvX, drvY);
    ctx.rotate(ejectAngle);
    this._drawPersonSprite(ctx, cab.cw * 0.18, '#4e5d6c', '#f2c9a0', '#222', enc.zone === 2);
    if (this.driverEject && this.driverEject.active) {
      ctx.fillStyle = '#ff2a3c';
      ctx.font = '900 18px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ААААА!!', 0, -cab.cw * 0.24);
    }
    ctx.restore();

    // 2. Conductor near validator (zone 1, right side mid-aisle)
    var condScale = (0.72 + this.walkPos * 0.18);
    var condX = vx + cab.cw * 0.52;
    var condY = cab.cy + cab.ch * 0.86;
    ctx.save();
    ctx.translate(condX, condY);
    this._drawPersonSprite(ctx, 42 * condScale, '#7b2848', '#f0c4a0', '#3d251e', enc.zone === 1);
    // Ticket bag
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(-16 * condScale, 6 * condScale, 20 * condScale, 16 * condScale);
    ctx.restore();

    // 3. Passenger filming on 2013 smartphone (zone 0, left side mid-aisle)
    var passScale = (0.8 + (1 - Math.abs(this.walkPos - 0.3)) * 0.2);
    var passX = vx - cab.cw * 0.54;
    var passY = cab.cy + cab.ch * 0.95;
    ctx.save();
    ctx.translate(passX, passY);
    this._drawPersonSprite(ctx, 46 * passScale, '#28523b', '#f2cba8', '#1f1b18', enc.zone === 0);
    // 2013 brick phone held up
    ctx.fillStyle = '#10141c';
    ctx.fillRect(14 * passScale, -22 * passScale, 12 * passScale, 22 * passScale);
    ctx.fillStyle = '#5cd6ff';
    ctx.fillRect(16 * passScale, -20 * passScale, 8 * passScale, 15 * passScale);
    ctx.restore();
  };

  Phase1Bus.prototype._drawPersonSprite = function (ctx, size, coatColor, skinColor, hairColor, isHighlighted) {
    if (isHighlighted) {
      ctx.shadowColor = '#f5b800';
      ctx.shadowBlur = 16;
    }
    // Shoulders / coat
    ctx.fillStyle = coatColor;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.42, size * 0.58, size * 0.5, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(size * 0.58, size * 0.95);
    ctx.lineTo(-size * 0.58, size * 0.95);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, -size * 0.22, size * 0.34, 0, Math.PI * 2);
    ctx.fill();

    // Hat / hair
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(0, -size * 0.34, size * 0.34, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-size * 0.11, -size * 0.22, Math.max(2, size * 0.05), 0, Math.PI * 2);
    ctx.arc(size * 0.11, -size * 0.22, Math.max(2, size * 0.05), 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  };

  Phase1Bus.prototype._drawHandrailsAndStraps = function (ctx, w, h, vx, vy, zoom) {
    var cab = this._cabin;
    ctx.strokeStyle = '#f5b800';
    ctx.lineWidth = 6;

    // Two overhead yellow rails
    ctx.beginPath();
    ctx.moveTo(w * 0.24, -10);
    ctx.lineTo(cab.cx + cab.cw * 0.2, cab.cy + cab.ch * 0.12);
    ctx.moveTo(w * 0.76, -10);
    ctx.lineTo(cab.cx + cab.cw * 0.8, cab.cy + cab.ch * 0.12);
    ctx.stroke();

    // Swaying hanging straps
    var sway = Math.sin(this.busTime * 3.1) * 9 + (this.shake * 14);
    for (var i = 0; i < 3; i++) {
      var t = 0.25 + i * 0.25;
      var lx = w * 0.24 + t * (cab.cx + cab.cw * 0.2 - w * 0.24);
      var ly = -10 + t * (cab.cy + cab.ch * 0.12 + 10);
      var rx = w * 0.76 + t * (cab.cx + cab.cw * 0.8 - w * 0.76);
      var strapLen = 46 * (1 - t * 0.4);

      this._drawStrap(ctx, lx, ly, strapLen, sway + i * 2);
      this._drawStrap(ctx, rx, ly, strapLen, sway - i * 2);
    }
  };

  Phase1Bus.prototype._drawStrap = function (ctx, x, y, len, sway) {
    ctx.strokeStyle = '#151922';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sway, y + len);
    ctx.stroke();

    ctx.strokeStyle = '#f5b800';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + sway, y + len + 7, 8, 0, Math.PI * 2);
    ctx.stroke();
  };

  Phase1Bus.prototype._drawForegroundNatalia = function (ctx, w, h) {
    // Stylized Marine Beret crest badge in corner + active camo arm gesture
    var gest = this.gesture;
    var swing = 0;
    if (gest) {
      var p = 1 - (gest.timer / gest.duration);
      swing = Math.sin(p * Math.PI);
    }

    // Camo jacket sleeve & expressive gesture hand visible above bottom button deck
    ctx.save();
    var hx = w * 0.84 - swing * w * 0.18;
    var hy = h * 0.76 - swing * h * 0.18;
    ctx.translate(hx, hy);
    ctx.rotate(-0.38 - swing * 0.28);

    // Camo sleeve
    ctx.fillStyle = '#3d5235';
    ctx.fillRect(-36, 0, 72, 160);
    ctx.fillStyle = '#25331f';
    ctx.fillRect(-26, 20, 24, 30);
    ctx.fillStyle = '#5a6e43';
    ctx.fillRect(0, 48, 28, 34);

    // Hand
    ctx.fillStyle = '#efc39d';
    ctx.beginPath();
    ctx.arc(0, -14, 24, 0, Math.PI * 2);
    ctx.fill();

    // Pointing finger or fist slam
    if (!gest || gest.type === 'point' || gest.type === 'salute') {
      ctx.fillRect(-7, -54, 14, 42);
    } else if (gest.type === 'palm') {
      ctx.fillRect(-22, -44, 44, 30);
    }
    ctx.restore();

    // Natalia's own speech banner when she delivers a line
    if (gest) {
      ctx.save();
      ctx.font = '900 ' + Math.max(15, Math.round(w * 0.02)) + 'px "Segoe UI", sans-serif';
      var pad = 16;
      var textW = Math.min(w * 0.85, ctx.measureText(gest.quote).width + pad * 2);
      var bx = w * 0.5 - textW * 0.5;
      var by = h * 0.675;
      ctx.fillStyle = 'rgba(12, 16, 23, 0.9)';
      ctx.strokeStyle = gest.color;
      ctx.lineWidth = 3;
      this._roundRect(ctx, bx, by, textW, 40, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = gest.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gest.quote, w * 0.5, by + 20, textW - 20);
      ctx.restore();
    }
  };

  Phase1Bus.prototype._drawEncounterBubble = function (ctx, w, h) {
    if (this.authority >= 100 || (this.driverEject && this.driverEject.active)) return;
    var enc = this.getActiveEncounter();
    var zone = this.getCurrentZone();
    var pointBlank = zone === enc.zone;

    ctx.save();
    var boxW = Math.min(460, w * 0.88);
    var boxH = 68;
    var bx = w * 0.5 - boxW * 0.5;
    var by = h * 0.105;

    ctx.fillStyle = 'rgba(255, 250, 232, 0.96)';
    ctx.strokeStyle = pointBlank ? '#39ff14' : '#f5b800';
    ctx.lineWidth = 3;
    this._roundRect(ctx, bx, by, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();

    // Speaker tag
    ctx.fillStyle = '#7b141d';
    ctx.font = '800 13px "Courier New", monospace';
    ctx.textAlign = 'left';
    var tag = enc.speaker.toUpperCase() + ' [' + ZONE_NAMES[enc.zone] + ']';
    if (pointBlank) tag += ' • В УПОР ×1.5!';
    ctx.fillText(tag, bx + 14, by + 22);

    // Quote prompt
    ctx.fillStyle = '#111622';
    ctx.font = '800 ' + (w < 600 ? 13 : 16) + 'px system-ui, sans-serif';
    ctx.fillText(enc.prompt, bx + 14, by + 44, boxW - 28);

    // Timer bar at bottom of speech bubble
    var ratio = Math.max(0, this.encounterTimer / this.encounterMaxTimer);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(bx + 14, by + boxH - 10, boxW - 28, 5);
    ctx.fillStyle = '#ff2a3c';
    ctx.fillRect(bx + 14, by + boxH - 10, (boxW - 28) * ratio, 5);
    ctx.restore();
  };

  Phase1Bus.prototype._drawPopupsAndCoins = function (ctx, w, h) {
    ctx.save();
    for (var i = 0; i < this.popups.length; i++) {
      var p = this.popups[i];
      var alpha = Math.min(1, p.life / (p.maxLife * 0.4));
      ctx.globalAlpha = alpha;
      ctx.font = '900 24px Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 5;
      ctx.strokeText(p.text, p.x * w, p.y * h);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x * w, p.y * h);
    }

    ctx.globalAlpha = 1;
    for (var c = 0; c < this.flyingCoins.length; c++) {
      var fc = this.flyingCoins[c];
      var u = Math.min(1, fc.t / fc.dur);
      var cx = (fc.x + (fc.tx - fc.x) * u) * w;
      var cy = (fc.y + (fc.ty - fc.y) * u - Math.sin(u * Math.PI) * 0.12) * h;
      ctx.fillStyle = '#ffd000';
      ctx.strokeStyle = '#8a5a00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#5c3c00';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₽', cx, cy + 1);
    }
    ctx.restore();
  };

  Phase1Bus.prototype._roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  Startuem.Phase1Bus = Phase1Bus;
})(window);

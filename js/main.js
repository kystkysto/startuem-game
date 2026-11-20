(function (global) {
  'use strict';

  var Startuem = global.Startuem = global.Startuem || {};
  var BEST_KEY = 'startuem2013_best';

  function loadBestScore() {
    try {
      var val = parseInt(global.localStorage.getItem(BEST_KEY) || '0', 10);
      return isNaN(val) ? 0 : val;
    } catch (e) {
      return 0;
    }
  }

  function saveBestScore(score) {
    try {
      var prev = loadBestScore();
      if (score > prev) {
        global.localStorage.setItem(BEST_KEY, String(score));
        return score;
      }
      return prev;
    } catch (e) {
      return score;
    }
  }

  function GameApp() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.viewW = global.innerWidth;
    this.viewH = global.innerHeight;

    this.audio = new Startuem.AudioEngine();
    this.mode = 'title'; // 'title' | 'phase1' | 'phase2' | 'gameover'
    this.lastStats = null;
    this.idleTime = 0;

    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      drift: false,
      joyActive: false,
      joyX: 0,
      joyY: 0
    };

    this.screens = {
      title: document.getElementById('screen-title'),
      phase1: document.getElementById('hud-phase1'),
      phase2: document.getElementById('hud-phase2'),
      gameover: document.getElementById('screen-gameover'),
      voiceModal: document.getElementById('modal-voice')
    };

    this.videoUI = {
      p1: document.getElementById('p1-video'),
      p2: document.getElementById('p2-video'),
      p2Pip: document.getElementById('p2-video-pip')
    };

    var self = this;
    this.phase1 = new Startuem.Phase1Bus({
      audio: this.audio,
      onComplete: function (rublesEarned) {
        self.startPhase2(rublesEarned);
      }
    });

    this.phase2 = new Startuem.Phase2GTA({
      audio: this.audio,
      onGameOver: function (stats) {
        self.showGameOver(stats);
      }
    });

    this._bindEvents();
    this._renderVoiceSlots();
    this._syncAudioButtons();
    this._updateBestDisplays();
    this._handleResize();

    this.lastTime = performance.now();
    requestAnimationFrame(function (ts) {
      self._loop(ts);
    });
  }

  GameApp.prototype._setMode = function (mode) {
    this.mode = mode;
    this.screens.title.classList.toggle('active', mode === 'title');
    this.screens.title.classList.toggle('hidden', mode !== 'title');
    this.screens.phase1.classList.toggle('hidden', mode !== 'phase1');
    this.screens.phase2.classList.toggle('hidden', mode !== 'phase2');
    this.screens.gameover.classList.toggle('active', mode === 'gameover');
    this.screens.gameover.classList.toggle('hidden', mode !== 'gameover');

    if (mode !== 'phase2') {
      this.audio.stopDrivingAudio();
      if (this.videoUI.p2) {
        try { this.videoUI.p2.pause(); } catch (e) {}
      }
      if (this.videoUI.p2Pip) {
        this.videoUI.p2Pip.classList.remove('active');
      }
    }
    if (mode !== 'phase1' && this.videoUI.p1) {
      try { this.videoUI.p1.pause(); } catch (e) {}
    }
  };

  GameApp.prototype._playVideoClip = function (slotId) {
    if (!slotId) return;
    var vid = this.mode === 'phase1' ? this.videoUI.p1 : (this.mode === 'phase2' ? this.videoUI.p2 : null);
    if (!vid) return;

    var clipSrc = './video/clips/' + slotId + '.mp4';
    if (this.mode === 'phase2' && this.videoUI.p2Pip) {
      this.videoUI.p2Pip.classList.add('active');
    }

    try {
      if (vid.getAttribute('data-slot') !== slotId) {
        vid.setAttribute('data-slot', slotId);
        vid.src = clipSrc;
      } else {
        vid.currentTime = 0;
      }
      var p = vid.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  };

  GameApp.prototype.startPhase1 = function () {
    this.audio.unlock();
    this.phase1.reset();
    this._setMode('phase1');
    this.audio.playHorn(false);
    this.audio.playVoice('morskaya_pehota', 'Наталья — морская пехота!', true);
  };

  GameApp.prototype.startPhase2 = function (rubles) {
    this.audio.unlock();
    var self = this;
    this.phase2.onGameOver = function (stats) {
      self.showGameOver(stats);
    };
    this.phase2.reset(typeof rubles === 'number' ? rubles : 15);
    this._setMode('phase2');
    this.audio.playStartuemBoom();
    this.audio.playVoice('startuem', 'Я сказала — стартуем!', true);
  };

  GameApp.prototype.showGameOver = function (stats) {
    this.lastStats = stats;
    var best = saveBestScore(stats.score);
    this._updateBestDisplays();

    document.getElementById('go-stamp').textContent = stats.isJeep ? 'ДЖИП ПОКОРИЛ ПИТЕР' : 'ПОСИДИ, ДРУЖОК';
    document.getElementById('go-subtitle').textContent = stats.reason || 'ДО ПОРЫ ДО ВРЕМЕНИ…';
    document.getElementById('go-rank').textContent = 'РАНГ: ' + Startuem.QUOTES.getRank(stats.score);
    document.getElementById('go-score').textContent = String(stats.score);
    document.getElementById('go-best').textContent = String(best);
    document.getElementById('go-rubles').textContent = stats.rubles + ' ₽';

    var starsStr = '';
    for (var i = 0; i < 4; i++) {
      starsStr += i < stats.maxStars ? '★' : '☆';
    }
    document.getElementById('go-stars').textContent = starsStr;
    document.getElementById('go-trips').textContent = String(stats.tripsCount);
    document.getElementById('go-vehicle').textContent = stats.isJeep ? 'ДЖИП В МОСКВЕ' : 'АВТОБУС № 24';

    var shareBtn = document.getElementById('btn-share-chat');
    shareBtn.textContent = '📋 СКОПИРОВАТЬ ДЛЯ ЧАТА ПАЦАНОВ';

    this._setMode('gameover');
  };

  GameApp.prototype._updateBestDisplays = function () {
    var best = loadBestScore();
    var el = document.getElementById('title-best-score');
    if (el) el.textContent = String(best);
  };

  GameApp.prototype._syncAudioButtons = function () {
    var sText = this.audio.soundEnabled ? '🔊 Звук: ВКЛ' : '🔇 Звук: ВЫКЛ';
    var vText = this.audio.voiceEnabled ? '🗣 Голос: ВКЛ' : '🤫 Голос: ВЫКЛ';
    document.getElementById('btn-title-sound').textContent = sText;
    document.getElementById('btn-title-voice').textContent = vText;

    var p2Mute = document.getElementById('btn-p2-mute');
    var p2Voice = document.getElementById('btn-p2-voice');
    p2Mute.textContent = this.audio.soundEnabled ? '🔊' : '🔇';
    p2Mute.classList.toggle('muted', !this.audio.soundEnabled);
    p2Voice.textContent = this.audio.voiceEnabled ? '🗣' : '🤫';
    p2Voice.classList.toggle('muted', !this.audio.voiceEnabled);
  };

  GameApp.prototype._renderVoiceSlots = function () {
    var listEl = document.getElementById('voice-slot-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    var self = this;
    var slots = Startuem.QUOTES.VOICE_SLOTS;
    for (var i = 0; i < slots.length; i++) {
      (function (slot) {
        var row = document.createElement('div');
        row.className = 'voice-slot-item';

        var meta = document.createElement('div');
        meta.className = 'voice-slot-meta';

        var title = document.createElement('strong');
        title.textContent = slot.text;

        var file = document.createElement('span');
        file.className = 'voice-slot-file';
        file.textContent = 'audio/voice/' + slot.file;

        meta.appendChild(title);
        meta.appendChild(file);

        var right = document.createElement('div');
        right.style.display = 'flex';
        right.style.alignItems = 'center';
        right.style.gap = '6px';

        var status = document.createElement('span');
        var loaded = self.audio.hasCustomVoice(slot.id);
        status.className = 'voice-slot-status' + (loaded ? ' loaded' : '');
        status.textContent = loaded ? '✓ MP3 загружен' : 'Синтез ru-RU';

        var playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'btn btn-mini';
        playBtn.textContent = '▶';
        playBtn.title = 'Прослушать';
        playBtn.addEventListener('click', function () {
          self.audio.unlock();
          self.audio.playVoice(slot.id, slot.text, true);
        });

        right.appendChild(status);
        right.appendChild(playBtn);
        row.appendChild(meta);
        row.appendChild(right);
        listEl.appendChild(row);
      })(slots[i]);
    }
  };

  GameApp.prototype._copyBragText = function () {
    var s = this.lastStats || { score: 0, rubles: 0, maxStars: 0, tripsCount: 0, isJeep: false };
    var url = global.location.href;
    var rank = Startuem.QUOTES.getRank(s.score);
    var msg =
      '🚌 «Я СКАЗАЛА — СТАРТУЕМ!» (2013)\n' +
      'Ранг: ' + rank + '\n' +
      'Очки: ' + s.score + ' | Рублей: ' + s.rubles + ' ₽ | Звёзд: ' + s.maxStars + '★\n' +
      'Приходов поймано: ' + s.tripsCount + ' | Транспорт: ' + (s.isJeep ? 'Джип в Москве 🚙' : 'Автобус № 24 🚌') + '\n' +
      'Попробуй перебить: ' + url;

    var btn = document.getElementById('btn-share-chat');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).then(function () {
        btn.textContent = '✓ СКОПИРОВАНО! КИДАЙ В ЧАТ';
      }).catch(function () {
        fallbackCopy(msg, btn);
      });
    } else {
      fallbackCopy(msg, btn);
    }
  };

  function fallbackCopy(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      btn.textContent = '✓ СКОПИРОВАНО! КИДАЙ В ЧАТ';
    } catch (e) {
      btn.textContent = '📋 ВЫДЕЛИТЕ ВРУЧНУЮ';
    }
    document.body.removeChild(ta);
  }

  GameApp.prototype._handleResize = function () {
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    this.viewW = global.innerWidth;
    this.viewH = global.innerHeight;
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  GameApp.prototype._bindEvents = function () {
    var self = this;

    global.addEventListener('resize', function () {
      self._handleResize();
    });

    this.audio.onSlotsUpdated = function () {
      self._renderVoiceSlots();
    };
    this.audio.onVoicePlay = function (slotId) {
      self._playVideoClip(slotId);
    };

    if (this.videoUI.p2) {
      var hidePip = function () {
        if (self.videoUI.p2Pip) self.videoUI.p2Pip.classList.remove('active');
      };
      this.videoUI.p2.addEventListener('ended', hidePip);
      this.videoUI.p2.addEventListener('error', hidePip);
    }

    // Title screen buttons
    document.getElementById('btn-start-full').addEventListener('click', function () {
      self.startPhase1();
    });
    document.getElementById('btn-start-gta').addEventListener('click', function () {
      self.startPhase2(15);
    });
    document.getElementById('btn-open-voice').addEventListener('click', function () {
      self.audio.unlock();
      self._renderVoiceSlots();
      self.screens.voiceModal.classList.remove('hidden');
    });
    document.getElementById('btn-p2-voice-modal').addEventListener('click', function () {
      self.audio.unlock();
      self._renderVoiceSlots();
      self.screens.voiceModal.classList.remove('hidden');
    });
    document.getElementById('btn-close-voice').addEventListener('click', function () {
      self.screens.voiceModal.classList.add('hidden');
    });

    document.getElementById('voice-file-input').addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) {
        self.audio.loadLocalFiles(e.target.files);
      }
    });

    function toggleSound() {
      self.audio.unlock();
      self.audio.setSoundEnabled(!self.audio.soundEnabled);
      self._syncAudioButtons();
    }
    function toggleVoice() {
      self.audio.unlock();
      self.audio.setVoiceEnabled(!self.audio.voiceEnabled);
      self._syncAudioButtons();
    }

    document.getElementById('btn-title-sound').addEventListener('click', toggleSound);
    document.getElementById('btn-title-voice').addEventListener('click', toggleVoice);
    document.getElementById('btn-p2-mute').addEventListener('click', toggleSound);
    document.getElementById('btn-p2-voice').addEventListener('click', toggleVoice);

    // Phase 1 HUD controls
    document.getElementById('btn-p1-skip').addEventListener('click', function () {
      self.startPhase2(Math.max(20, self.phase1.rubles));
    });
    document.getElementById('btn-p1-back').addEventListener('click', function () {
      self.phase1.stepWalk(-0.85);
    });
    document.getElementById('btn-p1-forward').addEventListener('click', function () {
      self.phase1.stepWalk(0.85);
    });
    document.getElementById('btn-p1-startuem').addEventListener('click', function () {
      self.phase1.triggerClimax();
    });

    var phraseBtns = document.querySelectorAll('#p1-phrase-grid .btn-phrase');
    for (var i = 0; i < phraseBtns.length; i++) {
      phraseBtns[i].addEventListener('click', function () {
        var actionId = this.getAttribute('data-action');
        self.phase1.triggerAction(actionId);
      });
    }

    // Phase 2 action buttons (pointerdown for instant mobile latency)
    var btnShock = document.getElementById('btn-p2-startuem');
    var btnTrip = document.getElementById('btn-p2-trip');
    var btnDrift = document.getElementById('btn-p2-drift');

    btnShock.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      self.audio.unlock();
      self.phase2.triggerShockwave();
    });
    btnTrip.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      self.audio.unlock();
      self.phase2.triggerTripMode(false);
    });
    btnDrift.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      self.input.drift = true;
    });
    var stopDrift = function () {
      self.input.drift = false;
    };
    btnDrift.addEventListener('pointerup', stopDrift);
    btnDrift.addEventListener('pointercancel', stopDrift);
    btnDrift.addEventListener('pointerleave', stopDrift);

    // Virtual Joystick for touch devices
    var joyZone = document.getElementById('touch-joystick-zone');
    var joyBase = document.getElementById('joystick-base');
    var joyKnob = document.getElementById('joystick-knob');
    var activePointerId = null;

    function updateJoy(clientX, clientY) {
      var rect = joyBase.getBoundingClientRect();
      var cx = rect.left + rect.width * 0.5;
      var cy = rect.top + rect.height * 0.5;
      var maxR = rect.width * 0.42;
      var dx = clientX - cx;
      var dy = clientY - cy;
      var dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      joyKnob.style.transform = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px)';
      self.input.joyActive = true;
      self.input.joyX = dx / maxR;
      self.input.joyY = dy / maxR;
    }

    function resetJoy() {
      activePointerId = null;
      self.input.joyActive = false;
      self.input.joyX = 0;
      self.input.joyY = 0;
      joyKnob.style.transform = 'translate(0px, 0px)';
    }

    joyZone.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      self.audio.unlock();
      activePointerId = e.pointerId;
      if (joyZone.setPointerCapture) {
        try { joyZone.setPointerCapture(e.pointerId); } catch (err) {}
      }
      updateJoy(e.clientX, e.clientY);
    });
    joyZone.addEventListener('pointermove', function (e) {
      if (activePointerId === e.pointerId) {
        updateJoy(e.clientX, e.clientY);
      }
    });
    joyZone.addEventListener('pointerup', function (e) {
      if (activePointerId === e.pointerId) resetJoy();
    });
    joyZone.addEventListener('pointercancel', function (e) {
      if (activePointerId === e.pointerId) resetJoy();
    });

    // Game Over screen buttons
    document.getElementById('btn-share-chat').addEventListener('click', function () {
      self._copyBragText();
    });
    document.getElementById('btn-retry-gta').addEventListener('click', function () {
      self.startPhase2(15);
    });
    document.getElementById('btn-retry-bus').addEventListener('click', function () {
      self.startPhase1();
    });

    // Keyboard bindings using e.code (works in both RU and EN layouts!)
    global.addEventListener('keydown', function (e) {
      if (!self.screens.voiceModal.classList.contains('hidden')) {
        if (e.code === 'Escape') self.screens.voiceModal.classList.add('hidden');
        return;
      }

      if (e.code === 'KeyW' || e.code === 'ArrowUp') self.input.up = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') self.input.down = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') self.input.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') self.input.right = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') self.input.drift = true;

      if (e.code === 'KeyM') {
        toggleSound();
      }

      if (self.mode === 'phase1') {
        if (e.code === 'Digit1') self.phase1.triggerAction('cultural');
        else if (e.code === 'Digit2') self.phase1.triggerAction('ruble');
        else if (e.code === 'Digit3') self.phase1.triggerAction('wheel');
        else if (e.code === 'Digit4') self.phase1.triggerAction('breathe');
        else if (e.code === 'Space') {
          e.preventDefault();
          self.phase1.triggerClimax();
        }
      } else if (self.mode === 'phase2') {
        if (e.code === 'Space') {
          e.preventDefault();
          self.phase2.triggerShockwave();
        } else if (e.code === 'KeyE') {
          self.phase2.triggerTripMode(false);
        }
      }
    });

    global.addEventListener('keyup', function (e) {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') self.input.up = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') self.input.down = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') self.input.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') self.input.right = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') self.input.drift = false;
    });
  };

  GameApp.prototype._drawTitleBackdrop = function (ctx, w, h) {
    ctx.fillStyle = '#0c1017';
    ctx.fillRect(0, 0, w, h);

    // Animated retro perspective neon street grid behind title card
    ctx.save();
    var horizon = h * 0.44;
    var grad = ctx.createLinearGradient(0, 0, 0, horizon);
    grad.addColorStop(0, '#0a0e18');
    grad.addColorStop(1, '#261433');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, horizon);

    // City skyline silhouettes
    ctx.fillStyle = '#111824';
    for (var b = 0; b < 18; b++) {
      var bx = (b / 18) * w;
      var bw = w / 16;
      var bh = 36 + ((b * 47) % 85);
      ctx.fillRect(bx, horizon - bh, bw - 2, bh);
    }

    // Moving retro grid floor
    ctx.strokeStyle = 'rgba(245, 184, 0, 0.22)';
    ctx.lineWidth = 1.5;
    var vanishX = w * 0.5;
    for (var i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(vanishX + i * 24, horizon);
      ctx.lineTo(vanishX + i * 220, h);
      ctx.stroke();
    }

    var speedOffset = (this.idleTime * 1.4) % 1;
    for (var row = 0; row < 10; row++) {
      var t = (row + speedOffset) / 10;
      var y = horizon + Math.pow(t, 2) * (h - horizon);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  GameApp.prototype._loop = function (now) {
    var dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.idleTime += dt;

    if (this.mode === 'phase1') {
      this.phase1.update(dt, this.input);
      this.phase1.render(this.ctx, this.viewW, this.viewH);
    } else if (this.mode === 'phase2') {
      this.phase2.update(dt, this.input);
      this.phase2.render(this.ctx, this.viewW, this.viewH);
    } else if (this.mode === 'gameover') {
      this.phase2.render(this.ctx, this.viewW, this.viewH);
    } else {
      this._drawTitleBackdrop(this.ctx, this.viewW, this.viewH);
    }

    var self = this;
    requestAnimationFrame(function (ts) {
      self._loop(ts);
    });
  };

  global.addEventListener('DOMContentLoaded', function () {
    Startuem.app = new GameApp();
  });
})(window);

(function (global) {
  'use strict';

  var Startuem = global.Startuem = global.Startuem || {};

  function Phase1Bus(opts) {
    this.audio = opts.audio;
    this.onComplete = opts.onComplete;

    this.authority = 0;
    this.rubles = 15;
    this.busTime = 0;

    this.encounterIndex = 0;
    this.encounterTimer = 9.0;
    this.encounterMaxTimer = 9.0;
    this.encounterIntroPlayed = false;

    this.quoteText = '';
    this.quoteTimer = 0;
    this.toastText = '';
    this.toastTimer = 0;
    this.toastColor = '#39ff14';

    this.driverEject = null; // { timer, duration, active }
    this.completed = false;

    this.ui = {
      videoStage: document.getElementById('p1-video-stage'),
      authFill: document.getElementById('p1-authority-fill'),
      authPct: document.getElementById('p1-authority-pct'),
      rublesEl: document.getElementById('p1-rubles'),
      promptBanner: document.getElementById('p1-prompt-banner'),
      promptSpeaker: document.getElementById('p1-prompt-speaker'),
      promptText: document.getElementById('p1-prompt-text'),
      promptTimerFill: document.getElementById('p1-prompt-timer-fill'),
      feedbackToast: document.getElementById('p1-feedback-toast'),
      quoteStrip: document.getElementById('p1-quote-strip'),
      climaxWrap: document.getElementById('p1-climax-wrap'),
      phraseButtons: Array.prototype.slice.call(document.querySelectorAll('#p1-phrase-grid .btn-phrase'))
    };
  }

  Phase1Bus.prototype.reset = function () {
    this.authority = 0;
    this.rubles = 15;
    this.busTime = 0;
    this.encounterIndex = 0;
    this.encounterTimer = 9.0;
    this.encounterIntroPlayed = false;
    this.quoteText = '«Наталья — морская пехота!»';
    this.quoteTimer = 2.2;
    this.toastText = '';
    this.toastTimer = 0;
    this.driverEject = null;
    this.completed = false;
    this.syncHUD();
  };

  Phase1Bus.prototype.getActiveEncounter = function () {
    var list = Startuem.QUOTES.P1_ENCOUNTERS;
    return list[this.encounterIndex % list.length];
  };

  Phase1Bus.prototype.triggerAction = function (actionId) {
    if (this.completed || (this.driverEject && this.driverEject.active)) return;
    var action = Startuem.QUOTES.P1_ACTIONS[actionId];
    if (!action) return;

    this.audio.unlock();
    this.audio.playGesture(action.gesture);
    this.audio.playVoice(action.slotId, null, true);

    this.quoteText = action.quote;
    this.quoteTimer = 2.6;

    var enc = this.getActiveEncounter();
    if (enc.expectedAction === actionId) {
      this.authority = Math.min(100, this.authority + 28);
      this.rubles += 15;
      this.audio.playCoin();

      this.toastText = '🔥 В ТОЧКУ! +15 ₽';
      this.toastColor = '#39ff14';
      this.toastTimer = 1.25;

      this.encounterIndex++;
      this.encounterTimer = this.encounterMaxTimer;
    } else {
      this.authority = Math.min(100, this.authority + 10);
      this.rubles += 5;

      this.toastText = '💪 НАПОР! +5 ₽';
      this.toastColor = '#f5b800';
      this.toastTimer = 0.95;
    }

    this.syncHUD();
  };

  Phase1Bus.prototype.triggerClimax = function () {
    if (this.completed || (this.driverEject && this.driverEject.active)) return;
    if (this.authority < 100) return;

    this.audio.unlock();
    this.audio.playStartuemBoom();
    this.audio.playVoice('startuem', 'Я сказала — стартуем!', true);

    this.quoteText = '«Я СКАЗАЛА — СТАРТУЕМ!»';
    this.quoteTimer = 1.8;
    this.toastText = '🚌 ПОЕХАЛИ!!';
    this.toastColor = '#ff2a3c';
    this.toastTimer = 1.6;

    this.driverEject = {
      active: true,
      timer: 0,
      duration: 1.65
    };
    this.syncHUD();
  };

  Phase1Bus.prototype.syncHUD = function () {
    var ejecting = !!(this.driverEject && this.driverEject.active);

    if (this.ui.authFill) {
      this.ui.authFill.style.width = Math.round(this.authority) + '%';
    }
    if (this.ui.authPct) {
      this.ui.authPct.textContent = Math.round(this.authority) + '%';
    }
    if (this.ui.rublesEl) {
      this.ui.rublesEl.textContent = String(this.rubles);
    }

    var enc = this.getActiveEncounter();
    if (this.ui.promptBanner) {
      if (this.authority >= 100 || ejecting) {
        this.ui.promptBanner.classList.add('hidden');
      } else {
        this.ui.promptBanner.classList.remove('hidden');
        if (this.ui.promptSpeaker) {
          this.ui.promptSpeaker.textContent = enc.speaker.toUpperCase();
        }
        if (this.ui.promptText) {
          this.ui.promptText.textContent = enc.prompt;
        }
        if (this.ui.promptTimerFill) {
          var pct = Math.max(0, Math.min(100, (this.encounterTimer / this.encounterMaxTimer) * 100));
          this.ui.promptTimerFill.style.width = pct.toFixed(1) + '%';
        }
      }
    }

    if (this.ui.climaxWrap) {
      if (this.authority >= 100 && !ejecting) {
        this.ui.climaxWrap.classList.remove('hidden');
      } else {
        this.ui.climaxWrap.classList.add('hidden');
      }
    }

    if (this.ui.feedbackToast) {
      if (this.toastTimer > 0 && this.toastText) {
        this.ui.feedbackToast.textContent = this.toastText;
        this.ui.feedbackToast.style.color = this.toastColor;
        this.ui.feedbackToast.style.borderColor = this.toastColor;
        this.ui.feedbackToast.classList.remove('hidden');
      } else {
        this.ui.feedbackToast.classList.add('hidden');
      }
    }

    if (this.ui.quoteStrip) {
      if (this.quoteTimer > 0 && this.quoteText) {
        this.ui.quoteStrip.textContent = this.quoteText;
        this.ui.quoteStrip.classList.remove('hidden');
      } else {
        this.ui.quoteStrip.classList.add('hidden');
      }
    }

    if (this.ui.videoStage) {
      this.ui.videoStage.classList.toggle('glitch-high', ejecting || this.authority >= 80);
      this.ui.videoStage.classList.toggle('glitch-mid', !ejecting && this.authority >= 50 && this.authority < 80);
    }

    for (var i = 0; i < this.ui.phraseButtons.length; i++) {
      var btn = this.ui.phraseButtons[i];
      if (btn.getAttribute('data-action') === enc.expectedAction && this.authority < 100 && !ejecting) {
        btn.classList.add('is-recommended');
      } else {
        btn.classList.remove('is-recommended');
      }
    }
  };

  Phase1Bus.prototype.update = function (dt) {
    this.busTime += dt;

    if (this.quoteTimer > 0) {
      this.quoteTimer = Math.max(0, this.quoteTimer - dt);
    }
    if (this.toastTimer > 0) {
      this.toastTimer = Math.max(0, this.toastTimer - dt);
    }

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
      }
    }

    if (this.driverEject && this.driverEject.active) {
      this.driverEject.timer += dt;
      if (this.driverEject.timer >= this.driverEject.duration && !this.completed) {
        this.completed = true;
        if (this.onComplete) this.onComplete(this.rubles);
        return;
      }
    }

    this.syncHUD();
  };

  Phase1Bus.prototype.render = function (ctx, w, h) {
    // Fullscreen real video renders in #p1-video-stage; keep underlying canvas clean dark
    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, w, h);
  };

  Startuem.Phase1Bus = Phase1Bus;
})(window);

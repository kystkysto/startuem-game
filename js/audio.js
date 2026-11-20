(function (global) {
  'use strict';

  var Startuem = global.Startuem = global.Startuem || {};

  function AudioEngine() {
    this.ctx = null;
    this.masterGain = null;
    this.soundEnabled = true;
    this.voiceEnabled = true;
    this.buffers = {};
    this.rawArrayBuffers = {};
    this.preloadStarted = false;
    this.onSlotsUpdated = null;
    this.onVoicePlay = null;

    // Single active voice channel so real meme quotes never overlap
    this.activeVoiceNode = null;
    this.activeHtmlAudio = null;

    // Warm low-fatigue Phase 2 engine & subtle tire sound
    this.drivingActive = false;
    this.engineOsc = null;
    this.engineSub = null;
    this.engineGain = null;
    this.driftNoise = null;
    this.driftFilter = null;
    this.driftGain = null;

    this.lastVoiceAt = 0;
    this._fetchAllDefaultVoices();
  }

  AudioEngine.prototype._fetchAllDefaultVoices = function () {
    if (this.preloadStarted) return;
    this.preloadStarted = true;
    if (typeof fetch !== 'function' || global.location.protocol === 'file:') {
      return;
    }

    var self = this;
    var slots = Startuem.QUOTES.VOICE_SLOTS;
    slots.forEach(function (slot) {
      fetch('./audio/voice/' + slot.file)
        .then(function (res) {
          if (!res.ok) return null;
          return res.arrayBuffer();
        })
        .then(function (arrBuf) {
          if (!arrBuf) return;
          self.rawArrayBuffers[slot.id] = arrBuf;
          if (self.ctx) {
            return self._decodeCachedBuffer(slot.id);
          }
        })
        .catch(function () {});
    });
  };

  AudioEngine.prototype._decodeCachedBuffer = function (slotId) {
    var self = this;
    var raw = this.rawArrayBuffers[slotId];
    if (!raw || !this.ctx || this.buffers[slotId]) return Promise.resolve();
    return this.ctx.decodeAudioData(raw.slice(0))
      .then(function (decoded) {
        if (decoded) {
          self.buffers[slotId] = decoded;
          if (self.onSlotsUpdated) self.onSlotsUpdated();
        }
      })
      .catch(function () {});
  };

  AudioEngine.prototype.unlock = function () {
    if (!this.ctx) {
      var AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.soundEnabled ? 0.72 : 0;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(function () {});
    }

    var self = this;
    Object.keys(this.rawArrayBuffers).forEach(function (slotId) {
      if (!self.buffers[slotId]) {
        self._decodeCachedBuffer(slotId);
      }
    });
  };

  AudioEngine.prototype.setSoundEnabled = function (enabled) {
    this.soundEnabled = !!enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.soundEnabled ? 0.72 : 0, this.ctx.currentTime, 0.03);
    }
    if (!this.soundEnabled) {
      this.stopDrivingAudio();
    }
  };

  AudioEngine.prototype.setVoiceEnabled = function (enabled) {
    this.voiceEnabled = !!enabled;
    if (!this.voiceEnabled) {
      this._stopActiveVoice();
    }
  };

  AudioEngine.prototype._stopActiveVoice = function () {
    if (this.activeVoiceNode) {
      try {
        this.activeVoiceNode.stop();
        this.activeVoiceNode.disconnect();
      } catch (e) {}
      this.activeVoiceNode = null;
    }
    if (this.activeHtmlAudio) {
      try {
        this.activeHtmlAudio.pause();
        this.activeHtmlAudio.currentTime = 0;
      } catch (e) {}
      this.activeHtmlAudio = null;
    }
    if ('speechSynthesis' in global) {
      try {
        global.speechSynthesis.cancel();
      } catch (e) {}
    }
  };

  AudioEngine.prototype.loadLocalFiles = function (fileList) {
    var self = this;
    this.unlock();
    if (!this.ctx || !fileList || !fileList.length) return;

    var slots = Startuem.QUOTES.VOICE_SLOTS;
    var files = Array.prototype.slice.call(fileList);
    var unmatched = [];

    files.forEach(function (file) {
      var lower = file.name.toLowerCase();
      var matchedSlot = null;
      for (var i = 0; i < slots.length; i++) {
        var slot = slots[i];
        if (lower.indexOf(slot.id) !== -1) {
          matchedSlot = slot;
          break;
        }
        for (var k = 0; k < slot.keywords.length; k++) {
          if (lower.indexOf(slot.keywords[k]) !== -1) {
            matchedSlot = slot;
            break;
          }
        }
        if (matchedSlot) break;
      }

      if (matchedSlot) {
        self._decodeFileIntoSlot(file, matchedSlot.id);
      } else {
        unmatched.push(file);
      }
    });

    if (unmatched.length) {
      var cursor = 0;
      for (var s = 0; s < slots.length && cursor < unmatched.length; s++) {
        if (!self.buffers[slots[s].id]) {
          self._decodeFileIntoSlot(unmatched[cursor], slots[s].id);
          cursor++;
        }
      }
      while (cursor < unmatched.length) {
        self._decodeFileIntoSlot(unmatched[cursor], slots[cursor % slots.length].id);
        cursor++;
      }
    }
  };

  AudioEngine.prototype._decodeFileIntoSlot = function (file, slotId) {
    var self = this;
    var reader = new FileReader();
    reader.onload = function (ev) {
      if (!ev.target || !ev.target.result || !self.ctx) return;
      self.ctx.decodeAudioData(ev.target.result.slice(0))
        .then(function (decoded) {
          self.buffers[slotId] = decoded;
          if (self.onSlotsUpdated) self.onSlotsUpdated();
        })
        .catch(function () {});
    };
    reader.readAsArrayBuffer(file);
  };

  AudioEngine.prototype.hasCustomVoice = function (slotId) {
    return !!(this.buffers[slotId] || this.rawArrayBuffers[slotId]);
  };

  AudioEngine.prototype.getSlotFile = function (slotId) {
    var slots = Startuem.QUOTES.VOICE_SLOTS;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].id === slotId) return slots[i].file;
    }
    return null;
  };

  AudioEngine.prototype.playVoice = function (slotId, fallbackText, priority) {
    if (!this.voiceEnabled) return;
    var nowMs = Date.now();
    if (!priority && nowMs - this.lastVoiceAt < 1400) {
      return;
    }
    this.lastVoiceAt = nowMs;

    this._stopActiveVoice();

    if (slotId && this.onVoicePlay) {
      try {
        this.onVoicePlay(slotId);
      } catch (e) {}
    }

    var buf = slotId ? this.buffers[slotId] : null;
    if (buf && this.ctx && this.soundEnabled) {
      try {
        var src = this.ctx.createBufferSource();
        src.buffer = buf;

        // Clean unaltered original voice playback
        var gain = this.ctx.createGain();
        gain.gain.value = 1.05;

        src.connect(gain);
        gain.connect(this.masterGain);
        src.onended = function () {
          try {
            src.disconnect();
            gain.disconnect();
          } catch (e) {}
        };
        this.activeVoiceNode = src;
        src.start(0);
        return;
      } catch (e) {}
    }

    // HTML5 Audio fallback for file:// or before Web Audio decode finishes
    var slotFile = slotId ? this.getSlotFile(slotId) : null;
    if (slotFile && this.soundEnabled) {
      try {
        var self = this;
        var el = new global.Audio('./audio/voice/' + slotFile);
        el.volume = 0.9;
        this.activeHtmlAudio = el;
        el.play().catch(function () {
          self._speakFallback(slotId, fallbackText);
        });
        return;
      } catch (e) {}
    }

    this._speakFallback(slotId, fallbackText);
  };

  AudioEngine.prototype._speakFallback = function (slotId, fallbackText) {
    if (!this.voiceEnabled) return;
    if (!fallbackText && slotId) {
      var slots = Startuem.QUOTES.VOICE_SLOTS;
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].id === slotId) {
          fallbackText = slots[i].text;
          break;
        }
      }
    }
    if (fallbackText && 'speechSynthesis' in global) {
      try {
        global.speechSynthesis.cancel();
        var utter = new global.SpeechSynthesisUtterance(fallbackText);
        utter.lang = 'ru-RU';
        utter.rate = 1.1;
        utter.pitch = 0.95;
        utter.volume = 0.85;
        global.speechSynthesis.speak(utter);
      } catch (e) {}
    }
  };

  AudioEngine.prototype._createNoiseBuffer = function (seconds) {
    var sr = this.ctx.sampleRate;
    var length = Math.max(1, Math.floor(sr * seconds));
    var buf = this.ctx.createBuffer(1, length, sr);
    var data = buf.getChannelData(0);
    for (var i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  };

  AudioEngine.prototype.playCoin = function () {
    if (!this.soundEnabled || !this.ctx) return;
    var t = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1040, t);
    osc.frequency.setValueAtTime(1480, t + 0.045);
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  };

  AudioEngine.prototype.playHorn = function (isJeep) {
    if (!this.soundEnabled || !this.ctx) return;
    var t = this.ctx.currentTime;
    var f1 = isJeep ? 150 : 196;
    var f2 = isJeep ? 188 : 247;
    [f1, f2].forEach(function (freq) {
      var osc = this.ctx.createOscillator();
      var flt = this.ctx.createBiquadFilter();
      var gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      flt.type = 'lowpass';
      flt.frequency.value = 600;
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(flt);
      flt.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
    }, this);
  };

  AudioEngine.prototype.playGesture = function (type) {
    if (!this.soundEnabled || !this.ctx) return;
    var t = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(type === 'slam' ? 130 : 210, t);
    osc.frequency.exponentialRampToValueAtTime(65, t + 0.1);
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.12);
  };

  AudioEngine.prototype.playStartuemBoom = function () {
    if (!this.soundEnabled || !this.ctx) return;
    var t = this.ctx.currentTime;

    var sub = this.ctx.createOscillator();
    var subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(125, t);
    sub.frequency.exponentialRampToValueAtTime(34, t + 0.45);
    subGain.gain.setValueAtTime(0.32, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 0.5);
  };

  AudioEngine.prototype.playCrash = function (intensity) {
    if (!this.soundEnabled || !this.ctx) return;
    var level = Math.max(0.15, Math.min(1, intensity || 0.5));
    var t = this.ctx.currentTime;

    var noise = this.ctx.createBufferSource();
    noise.buffer = this._createNoiseBuffer(0.2);
    var filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340 + level * 260;

    var gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.16 * level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.2);
  };

  AudioEngine.prototype.playTripStart = function () {
    if (!this.soundEnabled || !this.ctx) return;
    var t = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.55);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.6);
  };

  AudioEngine.prototype.playBusted = function () {
    if (!this.soundEnabled || !this.ctx) return;
    var t = this.ctx.currentTime;
    var notes = [246.94, 220.0, 196.0, 146.83];
    notes.forEach(function (freq, idx) {
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      osc.type = 'triangle';
      var start = t + idx * 0.14;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.32);
    }, this);
  };

  AudioEngine.prototype._ensureDrivingNodes = function () {
    if (this.drivingActive || !this.ctx) return;
    this.drivingActive = true;

    // Gentle low-frequency vehicle rumble (no harsh sawtooth buzz)
    this.engineOsc = this.ctx.createOscillator();
    this.engineSub = this.ctx.createOscillator();
    var engFilter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc.type = 'triangle';
    this.engineSub.type = 'sine';
    this.engineOsc.frequency.value = 46;
    this.engineSub.frequency.value = 23;
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 130;
    this.engineGain.gain.value = 0;

    this.engineOsc.connect(engFilter);
    this.engineSub.connect(engFilter);
    engFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();
    this.engineSub.start();

    // Soft tire whoosh during drifts
    this.driftNoise = this.ctx.createBufferSource();
    this.driftNoise.buffer = this._createNoiseBuffer(1.0);
    this.driftNoise.loop = true;
    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.value = 780;
    this.driftFilter.Q.value = 2.0;
    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.value = 0;
    this.driftNoise.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.masterGain);
    this.driftNoise.start();
  };

  AudioEngine.prototype.updateDrivingAudio = function (dt, speedRatio, isJeep, drifting) {
    if (!this.ctx || !this.soundEnabled) return;
    this._ensureDrivingNodes();

    var now = this.ctx.currentTime;
    var sr = Math.max(0, Math.min(1.4, speedRatio || 0));
    var baseFreq = isJeep ? 54 : 38;
    this.engineOsc.frequency.setTargetAtTime(baseFreq + sr * (isJeep ? 72 : 48), now, 0.08);
    this.engineSub.frequency.setTargetAtTime((baseFreq + sr * 38) * 0.5, now, 0.08);
    this.engineGain.gain.setTargetAtTime(0.012 + sr * 0.018, now, 0.08);

    var targetDrift = drifting && sr > 0.3 ? 0.032 : 0;
    this.driftGain.gain.setTargetAtTime(targetDrift, now, 0.05);
  };

  AudioEngine.prototype.stopDrivingAudio = function () {
    if (!this.drivingActive) return;
    this.drivingActive = false;
    var nodes = [this.engineOsc, this.engineSub, this.driftNoise];
    nodes.forEach(function (n) {
      if (n) {
        try {
          n.stop();
          n.disconnect();
        } catch (e) {}
      }
    });
    this.engineOsc = null;
    this.engineSub = null;
    this.engineGain = null;
    this.driftNoise = null;
    this.driftFilter = null;
    this.driftGain = null;
  };

  Startuem.AudioEngine = AudioEngine;
})(window);

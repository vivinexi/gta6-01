// Redline District — synthesized WebAudio sound. No audio files, no network.
(function (global) {
  'use strict';
  function createAudio() {
    let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, sirenTimer = 0;
    let enabled = false;
    function ensure() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.35;
        master.connect(ctx.destination);
        // Engine hum: sawtooth + lowpass, pitch follows speed.
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 420;
        engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
        // Police siren: alternating two tones.
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 700;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.0;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start();
        enabled = true;
        return true;
      } catch (e) { return false; }
    }
    function tone(freq, dur, type, vol, slideTo) {
      if (!ensure() || !enabled) return;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }
    function noise(dur, vol, freq) {
      if (!ensure() || !enabled) return;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = freq || 1800;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(filt); filt.connect(g); g.connect(master);
      src.start();
    }
    return {
      unlock: ensure,
      shot: function () { noise(0.14, 0.5, 2600); tone(160, 0.1, 'square', 0.18, 60); },
      punch: function () { noise(0.08, 0.3, 500); },
      crash: function () { noise(0.25, 0.45, 700); tone(90, 0.25, 'sawtooth', 0.2, 45); },
      pickup: function () { tone(660, 0.12, 'sine', 0.25); setTimeout(function () { tone(990, 0.18, 'sine', 0.25); }, 110); },
      mission: function () { tone(523, 0.15, 'sine', 0.25); setTimeout(function () { tone(659, 0.15, 'sine', 0.25); }, 140); setTimeout(function () { tone(784, 0.3, 'sine', 0.25); }, 280); },
      busted: function () { tone(440, 0.4, 'sawtooth', 0.2, 220); setTimeout(function () { tone(330, 0.6, 'sawtooth', 0.2, 165); }, 380); },
      step: function (dt, speed, wanted) {
        if (!ctx || !enabled) return;
        if (engineOsc) {
          engineOsc.frequency.value = 50 + Math.abs(speed) * 4.2;
          engineGain.gain.value = Math.abs(speed) > 0.5 ? 0.05 : 0.0;
        }
        if (sirenOsc) {
          if (wanted > 0) {
            sirenTimer += dt;
            sirenOsc.frequency.value = (Math.floor(sirenTimer * 1.6) % 2 === 0) ? 720 : 540;
            sirenGain.gain.value = 0.045;
          } else sirenGain.gain.value = 0.0;
        }
      }
    };
  }
  global.RD.audio = createAudio();
})(window);

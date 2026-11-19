// Synthesized sound only — no audio files. Every effect is built from WebAudio
// oscillators and filtered noise, so the game stays fully offline.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a triangle that wails between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function noiseBurst(duration, filterFreq, gainValue, type = 'bandpass') {
    if (!ensure()) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function tone(freq, duration, type, gainValue, slideTo = null) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** Continuous engine hum: speed01 is 0..1, on is whether the player drives. */
    engine(speed01, on) {
      if (!ctx || !engineOsc) return;
      const target = on ? 0.05 + speed01 * 0.11 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.08);
    },
    /** Continuous police siren: level 0..1, on while any police chase. */
    siren(on, t) {
      if (!ctx || !sirenOsc) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(650 + 260 * Math.sin(t * 2.4), ctx.currentTime, 0.05);
    },
    shot() {
      noiseBurst(0.14, 1800, 0.5, 'highpass');
      tone(180, 0.1, 'square', 0.22, 60);
    },
    punch() {
      noiseBurst(0.08, 300, 0.5, 'lowpass');
    },
    crash() {
      noiseBurst(0.25, 220, 0.6, 'lowpass');
      tone(90, 0.25, 'sine', 0.4, 45);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.3);
      setTimeout(() => tone(990, 0.18, 'sine', 0.3), 90);
    },
    cash() {
      tone(880, 0.1, 'triangle', 0.3);
      setTimeout(() => tone(1174, 0.14, 'triangle', 0.3), 80);
      setTimeout(() => tone(1568, 0.22, 'triangle', 0.3), 160);
    },
    busted() {
      tone(440, 0.3, 'sawtooth', 0.25, 220);
      setTimeout(() => tone(330, 0.5, 'sawtooth', 0.25, 165), 280);
    },
    click() {
      tone(520, 0.06, 'sine', 0.2);
    },
    horn() {
      tone(370, 0.25, 'square', 0.12, 370);
      tone(466, 0.25, 'square', 0.08, 466);
    },
  };
}

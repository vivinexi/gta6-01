// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, police siren, gunshot, pickup chime, footsteps and a slow
// sunset-chord music loop. The context is created on the first user gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

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
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(master);
      // Engine: a sawtooth whose pitch follows speed, always on once created.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a triangle wave wobbling between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  // A slow sunset loop: Am — F — C — G pads with a soft bass note each bar.
  const CHORDS = [
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [196.0, 246.94, 293.66],
    [164.81, 196.0, 246.94],
  ];
  const BASS = [110.0, 87.31, 98.0, 82.41];

  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const chord = CHORDS[musicStep % CHORDS.length];
      for (const freq of chord) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t0 = ctx.currentTime;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(0.5, t0 + 0.4);
        gain.gain.linearRampToValueAtTime(0.0001, t0 + 1.9);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(t0);
        osc.stop(t0 + 2.0);
      }
      tone(BASS[musicStep % BASS.length], 1.6, 'triangle', 0.5);
      musicStep += 1;
    }, 2000);
  }

  return {
    /** Call from a user gesture (Start button) so the context may run. */
    unlock() {
      ensure();
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    /** speed01: 0..1, how fast the player's car is going. */
    engine(speed01, driving) {
      if (!ctx) return;
      engineOsc.frequency.value = 45 + speed01 * 130;
      engineGain.gain.value = driving ? 0.05 + speed01 * 0.05 : 0;
    },
    siren(on) {
      if (!ctx) return;
      if (on) {
        sirenGain.gain.value = 0.045;
        sirenOsc.frequency.setTargetAtTime(sirenOsc.frequency.value > 850 ? 700 : 1000, ctx.currentTime, 0.25);
      } else {
        sirenGain.gain.value = 0;
      }
    },
    gunshot() {
      noiseBurst(0.14, 0.5, 1800);
      tone(180, 0.08, 'square', 0.2);
    },
    punch() {
      noiseBurst(0.09, 0.35, 700);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.35);
      tone(880, 0.16, 'sine', 0.35, 0.09);
      tone(1320, 0.22, 'sine', 0.3, 0.18);
    },
    crash(strength) {
      noiseBurst(0.25, 0.3 + strength * 0.4, 500);
      tone(70, 0.2, 'sine', 0.4);
    },
    step() {
      noiseBurst(0.05, 0.12, 900);
    },
    busted() {
      tone(392, 0.25, 'square', 0.25);
      tone(311, 0.25, 'square', 0.25, 0.25);
      tone(233, 0.5, 'square', 0.25, 0.5);
    },
    missionDone() {
      tone(523, 0.14, 'sine', 0.35);
      tone(659, 0.14, 'sine', 0.35, 0.12);
      tone(784, 0.3, 'sine', 0.35, 0.24);
    },
  };
}

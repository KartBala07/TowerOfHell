/* audio.js — tiny procedural WebAudio SFX (no assets) */
(function () {
  const T = window.TOH;

  T.Audio = function () {
    let ctx = null, master = null, muted = false, rumble = null;

    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return ctx;
    }

    function tone(freq, dur, type, vol, slideTo) {
      const c = ensure();
      if (!c || muted) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, c.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(c.currentTime + dur + 0.02);
    }

    function noiseBurst(dur, vol, filterFreq) {
      const c = ensure();
      if (!c || muted) return;
      const n = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 900;
      const g = c.createGain();
      g.gain.value = vol || 0.4;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    }

    const api = {
      unlock() {
        const c = ensure();
        if (c && c.state === 'suspended') c.resume();
      },
      jump() { tone(320, 0.12, 'square', 0.16, 620); },
      land() { noiseBurst(0.1, 0.22, 500); },
      coin() { tone(880, 0.07, 'square', 0.2); setTimeout(() => tone(1320, 0.11, 'square', 0.18), 55); },
      checkpoint() { tone(520, 0.1, 'triangle', 0.22); setTimeout(() => tone(780, 0.14, 'triangle', 0.2), 90); },
      death() { tone(220, 0.55, 'sawtooth', 0.24, 55); noiseBurst(0.45, 0.3, 700); },
      win() {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.26, 'triangle', 0.24), i * 130));
      },
      startLava() {
        const c = ensure();
        if (!c || rumble) return;
        const len = 2, buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate);
        const d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < d.length; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          d[i] = last * 3.2;
        }
        const src = c.createBufferSource();
        src.buffer = buf; src.loop = true;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
        const g = c.createGain(); g.gain.value = 0.0;
        src.connect(f); f.connect(g); g.connect(master);
        src.start();
        rumble = { src, gain: g, filter: f };
      },
      setLavaIntensity(v) {
        if (!rumble) return;
        rumble.gain.gain.value = T.clamp(v, 0, 1) * 0.28;
        rumble.filter.frequency.value = 220 + 480 * T.clamp(v, 0, 1);
      },
      stopLava() {
        if (!rumble) return;
        try { rumble.src.stop(); } catch (e) { /* already stopped */ }
        rumble = null;
      },
      toggleMute() {
        muted = !muted;
        if (master) master.gain.value = muted ? 0 : 0.35;
        return muted;
      },
    };
    return api;
  };
})();

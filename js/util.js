/* util.js — helpers, procedural textures, block/coin builders */
(function () {
  const T = (window.TOH = window.TOH || {});

  T.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  T.lerp = (a, b, t) => a + (b - a) * t;
  T.smooth = (t) => t * t * (3 - 2 * t);
  T.damp = (a, b, lambda, dt) => b + (a - b) * Math.exp(-lambda * dt);

  // deterministic PRNG (mulberry32)
  T.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  T.pad = (n, w) => String(n).padStart(w || 2, '0');

  function canvas2d(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }
  T.rgb = (hex) => {
    const c = hexToRgb(hex);
    return `rgb(${c.r},${c.g},${c.b})`;
  };
  T.shade = function (hex, amt) {
    const c = hexToRgb(hex);
    const f = (v) => T.clamp(Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255);
    return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
  };

  // Roblox-ish studded brick texture: 2x2 studs per tile
  T.studTexture = function (color) {
    const S = 256, c = canvas2d(S, S), x = c.getContext('2d');
    x.fillStyle = T.shade(color, -0.06);
    x.fillRect(0, 0, S, S);
    // faint plate seams
    x.strokeStyle = 'rgba(0,0,0,.10)';
    x.lineWidth = 4;
    x.strokeRect(0, 0, S, S);
    x.beginPath(); x.moveTo(S / 2, 0); x.lineTo(S / 2, S); x.moveTo(0, S / 2); x.lineTo(S, S / 2); x.stroke();
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const cx = 64 + i * 128, cy = 64 + j * 128;
        const g = x.createRadialGradient(cx - 10, cy - 12, 3, cx, cy, 48);
        g.addColorStop(0, T.shade(color, 0.30));
        g.addColorStop(0.55, T.shade(color, 0.10));
        g.addColorStop(1, T.shade(color, -0.12));
        x.beginPath(); x.arc(cx, cy, 43, 0, Math.PI * 2); x.fillStyle = g; x.fill();
        x.beginPath(); x.arc(cx, cy, 43, 0, Math.PI * 2);
        x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 3; x.stroke();
        x.beginPath(); x.arc(cx - 9, cy - 10, 12, 0, Math.PI * 2);
        x.fillStyle = 'rgba(255,255,255,.12)'; x.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };

  // conveyor arrows
  T.conveyorTexture = function (color, dir) {
    const S = 256, c = canvas2d(S, S), x = c.getContext('2d');
    x.fillStyle = color; x.fillRect(0, 0, S, S);
    x.fillStyle = 'rgba(0,0,0,.22)';
    for (let i = 0; i < 4; i++) x.fillRect(0, i * 64, S, 3);
    x.save();
    x.translate(S / 2, S / 2);
    if (dir === 'z') x.rotate(Math.PI / 2);
    x.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = -1; i <= 1; i++) {
      x.beginPath();
      x.moveTo(i * 80 - 20, -26); x.lineTo(i * 80 + 18, 0); x.lineTo(i * 80 - 20, 26);
      x.closePath(); x.fill();
    }
    x.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };

  T.faceTexture = function () {
    const S = 128, c = canvas2d(S, S), x = c.getContext('2d');
    x.fillStyle = '#f6d55c'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#241a10';
    x.beginPath(); x.ellipse(42, 52, 8, 11, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(86, 52, 8, 11, 0, 0, Math.PI * 2); x.fill();
    x.lineWidth = 7; x.strokeStyle = '#241a10'; x.lineCap = 'round';
    x.beginPath(); x.arc(64, 74, 28, 0.18 * Math.PI, 0.82 * Math.PI); x.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  T.skyTexture = function () {
    const w = 32, h = 256, c = canvas2d(w, h), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.00, '#12040a');
    g.addColorStop(0.42, '#2a0a14');
    g.addColorStop(0.68, '#6b1410');
    g.addColorStop(0.86, '#c33a10');
    g.addColorStop(1.00, '#ff8a1e');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  T.lavaTexture = function () {
    const S = 256, c = canvas2d(S, S), x = c.getContext('2d');
    x.fillStyle = '#ff5a12'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      const r = 10 + Math.random() * 42;
      const cx = Math.random() * S, cy = Math.random() * S;
      const g = x.createRadialGradient(cx, cy, 1, cx, cy, r);
      const hot = Math.random() > 0.45;
      g.addColorStop(0, hot ? 'rgba(255,244,180,.95)' : 'rgba(120,10,0,.85)');
      g.addColorStop(1, hot ? 'rgba(255,150,20,0)' : 'rgba(120,10,0,0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 900; i++) {
      x.fillStyle = Math.random() > 0.5 ? 'rgba(255,220,120,.35)' : 'rgba(90,6,0,.35)';
      x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };

  T.shadowTexture = function () {
    const S = 128, c = canvas2d(S, S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(0,0,0,.68)');
    g.addColorStop(0.55, 'rgba(0,0,0,.34)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  // ---- material cache ----
  const brickCache = new Map();
  T.brickMaterial = function (color, w, d) {
    const key = color + '|' + w.toFixed(2) + '|' + d.toFixed(2);
    let m = brickCache.get(key);
    if (m) return m;
    const tex = T.studTexture(color);
    tex.repeat.set(Math.max(0.5, w / 1.7), Math.max(0.5, d / 1.7));
    m = new THREE.MeshLambertMaterial({ map: tex });
    brickCache.set(key, m);
    return m;
  };

  const flatCache = new Map();
  T.flatMaterial = function (color, opts) {
    const key = color + JSON.stringify(opts || {});
    let m = flatCache.get(key);
    if (m) return m;
    m = new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(color) }, opts || {}));
    flatCache.set(key, m);
    return m;
  };

  const neonCache = new Map();
  T.neonMaterial = function (color) {
    let m = neonCache.get(color);
    if (m) return m;
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), toneMapped: false });
    neonCache.set(color, m);
    return m;
  };

  const GEO = new Map();
  function boxGeo(w, h, d) {
    const k = w.toFixed(3) + 'x' + h.toFixed(3) + 'x' + d.toFixed(3);
    let g = GEO.get(k);
    if (!g) { g = new THREE.BoxGeometry(w, h, d); GEO.set(k, g); }
    return g;
  }
  T.boxGeo = boxGeo;

  T.box = function (w, h, d, color, opts) {
    const o = opts || {};
    const mat = o.neon ? T.neonMaterial(color) : o.flat ? T.flatMaterial(color, o.matOpts) : T.brickMaterial(color, w, d);
    const mesh = new THREE.Mesh(boxGeo(w, h, d), mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  };
})();

/* level.js — procedural tower: section templates, colliders, coins, checkpoints */
(function () {
  const T = window.TOH;

  const SEC_H = 12;
  T.SEC_H = SEC_H;
  T.SECTIONS = 30;
  T.PAD = 5.0;               // entry / exit pad size
  T.PAD_TOP = 0.6;           // top of the entry pad, local
  T.EXIT_TOP = 11.5;

  const COLORS = ['#c4281c', '#0d69ac', '#f5cd30', '#4b974b', '#6b327c', '#008f9c', '#d35400', '#a3a2a5', '#e8e8e8'];
  const DARK = ['#4b4b4b', '#3a3f44', '#5a3a2e', '#2f4858'];

  function pushRoute(section, x, yTop, z, w, d) {
    section.route.push({ x, yTop, z, w, d });
  }

  T.Level = class Level {
    constructor(scene, seed) {
      this.scene = scene;
      this.seed = seed >>> 0;
      this.group = new THREE.Group();
      scene.add(this.group);
      this.sections = [];
      this.colliders = [];
      this.coins = [];
      this.checkpoints = [];
      this.moverList = [];
      this.spinners = [];
      this.blinkers = [];
      this.conveyors = [];
      this.time = 0;
      this.killMat = T.neonMaterial('#ff2d18');
      this.coinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd23f'), toneMapped: false });
      this.topY = T.SECTIONS * SEC_H;
      this.TPL = {
        spiral: this.tplSpiral.bind(this),
        beams: this.tplBeams.bind(this),
        spinner: this.tplSpinner.bind(this),
        conveyor: this.tplConveyor.bind(this),
        vanish: this.tplVanish.bind(this),
        killgrid: this.tplKillGrid.bind(this),
        pillars: this.tplPillars.bind(this),
        movers: this.tplMovers.bind(this),
      };
      this.build();
      this.buildEmbers();
      this.buildSummit();
    }

    // ---------- building blocks ----------
    makeApi(section) {
      const self = this;
      return {
        group: section.group,
        section,
        rnd: section.rnd,
        pick() {
          const pool = section.rnd() > 0.26 ? COLORS : DARK;
          return pool[Math.floor(section.rnd() * pool.length)];
        },
        plat(x, yTop, z, w, d, color, opts) {
          return self.addPlatform(section, x, yTop, z, w, d, color || this.pick(), opts || {});
        },
        coin(x, y, z) {
          self.addCoin(section, x, y, z);
        },
        trusted() { section.trusted = true; },
      };
    }

    addPlatform(section, x, yTop, z, w, d, color, opts) {
      const o = opts || {};
      const h = o.h || 0.9;
      const mesh = T.box(w, h, d, color, { neon: !!o.neon, flat: !!o.flat });
      mesh.position.set(x, yTop - h / 2, z);
      section.group.add(mesh);
      const col = {
        mesh,
        cx: x, cy: section.baseY + yTop - h / 2, cz: z,
        hx: w / 2, hy: h / 2, hz: d / 2,
        top: yTop + section.baseY,
        bottom: yTop - h + section.baseY,
        rot: 0,
        solid: o.solid === undefined ? true : o.solid,
        kill: !!o.kill,
        knock: o.knock || 0,
        conveyor: o.conveyor || null,
        blink: o.blink || null,
        noCam: !!o.noCam,
        section: section.index,
        baseY: section.baseY,
        topLocal: yTop,
      };
      if (o.blink) this.blinkers.push(col);
      if (o.conveyor) this.conveyors.push(col);
      if (o.route) pushRoute(section, x, yTop, z, w, d);
      section.colliders.push(col);
      this.colliders.push(col);
      return col;
    }

    addCoin(section, x, y, z) {
      if (!T.coinGeo) T.coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 18);
      const mesh = new THREE.Mesh(T.coinGeo, this.coinMat);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(x, y, z);
      section.group.add(mesh);
      const coin = { mesh, x, y, z, taken: false, section: section.index, baseY: y };
      section.coins.push(coin);
      this.coins.push(coin);
    }

    // ---------- templates ----------
    tplSpiral(api) {
      const rnd = api.rnd;
      const n = 8;
      const radius = 5.2 + rnd() * 0.5;
      const start = rnd() * Math.PI * 2;
      const dir = rnd() > 0.5 ? 1 : -1;
      const y0 = 1.7, y1 = 10.2;
      for (let i = 0; i < n; i++) {
        const a = start + dir * (i * (Math.PI * 1.9)) / (n - 1);
        const y = y0 + ((y1 - y0) * i) / (n - 1);
        const w = 2.8 + rnd() * 0.5;
        api.plat(Math.cos(a) * radius, y, Math.sin(a) * radius, w, w, api.pick(), { h: 1.0, route: true });
        if (i % 2 === 0 || i === n - 1) api.coin(Math.cos(a) * radius, y + 1.5, Math.sin(a) * radius);
      }
    }

    tplBeams(api) {
      // switchback: alternating side ledges and centre pads, all with head clearance
      const seq = [
        [-4.8, 2.0, 4.2, 2.6], [0, 3.3, 3.0, 3.0],
        [4.8, 4.6, 4.2, 2.6], [0, 5.9, 3.0, 3.0],
        [-4.8, 7.2, 4.2, 2.6], [0, 8.5, 3.0, 3.0],
        [4.8, 10.4, 4.2, 2.6],
      ];
      seq.forEach(([x, y, w, d], i) => {
        api.plat(x, y, 0, w, d, api.pick(), { h: 0.4, route: true });
        if (i !== 6) api.coin(x, y + 1.5, 0);
      });
    }

    tplSpinner(api) {
      const rnd = api.rnd;
      const dir = rnd() > 0.5 ? 1 : -1;
      const radius = 4.6;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const y = 1.6 + i * 1.15;
        api.plat(Math.cos(a) * radius, y, Math.sin(a) * radius, 2.6, 2.6, api.pick(), { h: 1.0, route: true });
      }
      const discTop = 6.35;
      api.plat(0, discTop, 0, 6.2, 6.2, '#a3a2a5', { h: 0.8, route: true });
      const bar = T.box(7.4, 0.55, 0.55, '#ff2d18', { neon: true });
      bar.position.set(0, discTop + 1.05, 0);
      api.group.add(bar);
      const col = {
        mesh: bar,
        cx: 0, cy: api.section.baseY + discTop + 1.05, cz: 0,
        hx: 3.7, hy: 0.28, hz: 0.28,
        top: discTop + 1.32 + api.section.baseY,
        bottom: discTop + 0.78 + api.section.baseY,
        rot: 0, solid: true, kill: false, knock: 9, noStand: true, spin: 1.35 * dir,
        section: api.section.index, noCam: true,
      };
      this.spinners.push(col);
      api.section.colliders.push(col);
      this.colliders.push(col);
      api.coin(0, discTop + 2.2, -2.0);
      api.coin(0, discTop + 2.2, 2.0);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 2;
        const y = 7.7 + i * 0.95;
        api.plat(Math.cos(a) * radius, y, Math.sin(a) * radius, 2.5, 2.5, api.pick(), { h: 1.0, route: true });
      }
    }

    tplConveyor(api) {
      // spiral of pads where every other pad is a belt dragging you sideways
      const dir = api.rnd() > 0.5 ? 1 : -1;
      const n = 8;
      const radius = 5.4;
      const start = api.rnd() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = start + dir * (i * (Math.PI * 1.9)) / (n - 1);
        const y = 1.7 + (i * (10.2 - 1.7)) / (n - 1);
        const belt = i % 2 === 1;
        const col = api.plat(Math.cos(a) * radius, y, Math.sin(a) * radius, 2.9, 2.9,
          belt ? '#2b3138' : api.pick(), { h: 1.0, route: true });
        if (belt) {
          const tx = -Math.sin(a) * dir, tz = Math.cos(a) * dir;
          col.conveyor = { x: tx * 3.0, z: tz * 3.0 };
          col.mesh.material = new THREE.MeshLambertMaterial({ map: T.conveyorTexture('#2b3138', Math.abs(tx) > Math.abs(tz) ? 'x' : 'z') });
          this.conveyors.push(col);
        }
        if (i % 3 === 0) api.coin(Math.cos(a) * radius, y + 1.5, Math.sin(a) * radius);
      }
    }

    tplVanish(api) {
      const rnd = api.rnd;
      const n = 9;
      const radius = 5.1;
      const start = rnd() * Math.PI * 2;
      const dir = rnd() > 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const a = start + dir * (i * (Math.PI * 1.9)) / (n - 1);
        const y = 1.7 + (i * (10.2 - 1.7)) / (n - 1);
        const blink = i % 3 === 2 ? null : { period: 2.4 + rnd() * 0.6, offset: i * 0.31, duty: 0.62 };
        api.plat(Math.cos(a) * radius, y, Math.sin(a) * radius, 2.8, 2.8,
          blink ? '#e8e8e8' : api.pick(), { h: 1.0, route: true, blink });
        if (i % 3 === 1) api.coin(Math.cos(a) * radius, y + 1.5, Math.sin(a) * radius);
      }
    }

    tplKillGrid(api) {
      const step = 1.75;
      const fieldTop = 0.42;
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          const x = i * step, z = j * step;
          const safe = Math.abs(x) < 1.1 || Math.abs(z - 1.75) < 1.1;
          if (safe) {
            api.plat(x, fieldTop, z, step - 0.06, step - 0.06, '#4b974b',
              { h: 0.4, route: Math.abs(x) < 1.1 });
          } else {
            const col = api.plat(x, fieldTop, z, step - 0.06, step - 0.06, '#ff2d18', { h: 0.4, kill: true, neon: true });
            col.mesh.material = this.killMat;
          }
        }
      }
      // ascent: a wide ring outside the kill field, up to the exit
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + i * 0.75;
        const y = 1.6 + i * ((10.2 - 1.6) / (n - 1));
        api.plat(Math.cos(a) * 6.0, y, Math.sin(a) * 6.0, 2.6, 2.6, api.pick(), { h: 1.0, route: true });
        if (i % 2 === 1) api.coin(Math.cos(a) * 6.0, y + 1.5, Math.sin(a) * 6.0);
      }
    }

    tplPillars(api) {
      const n = 8;
      const start = api.rnd() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = start + i * 1.05;
        const y = 1.7 + i * 1.16;
        api.plat(Math.cos(a) * 4.5, y, Math.sin(a) * 4.5, 1.6, 1.6,
          i % 2 ? '#f5cd30' : '#c4281c', { h: 1.0, route: true });
        if (i % 3 === 1) api.coin(Math.cos(a) * 4.5, y + 1.6, Math.sin(a) * 4.5);
      }
    }

    tplMovers(api) {
      api.trusted();
      api.plat(0, 1.45, -4.6, 3.0, 3.0, '#0d69ac', { h: 1.0, route: true });
      const mk = (x, z, lo, hi, period, phase, color) => {
        const col = api.plat(x, lo, z, 3.0, 3.0, color, { h: 0.7, route: true });
        col.mover = { lo, hi, period, phase };
        this.moverList.push(col);
        return col;
      };
      mk(4.0, -4.6, 2.4, 6.2, 6.0, 0, '#f5cd30');
      api.plat(4.0, 6.4, -1.2, 3.0, 3.0, '#4b974b', { h: 1.0, route: true });
      mk(4.0, 2.0, 7.0, 10.0, 6.0, Math.PI * 0.85, '#6b327c');
      api.coin(0, 4.2, -6.4);
      api.coin(4.0, 8.4, 2.0);
      api.coin(4.0, 7.3, -1.2);
    }

    // ---------- assemble ----------
    build() {
      const order = ['spiral', 'beams', 'spinner', 'conveyor', 'vanish', 'killgrid', 'pillars', 'movers'];
      let last = '';
      for (let k = 0; k < T.SECTIONS; k++) {
        const rng = T.rng(this.seed + k * 7919 + 13);
        const section = {
          index: k,
          baseY: k * SEC_H,
          rnd: rng,
          group: new THREE.Group(),
          colliders: [],
          coins: [],
          route: [],
          trusted: false,
        };
        section.group.position.y = section.baseY;
        this.group.add(section.group);
        this.sections.push(section);

        const isCk = k % 6 === 0;
        const entry = this.addPlatform(section, 0, T.PAD_TOP, 0, T.PAD, T.PAD,
          isCk ? '#25e0ff' : '#a3a2a5', { h: 1.0, neon: isCk });
        if (isCk) {
          this.checkpoints.push({
            x: 0, y: section.baseY + T.PAD_TOP, z: 0, index: k,
            mesh: entry.mesh, active: k === 0, section: k,
          });
        }
        const exit = this.addPlatform(section, 0, T.EXIT_TOP, 0, T.PAD, T.PAD, '#a3a2a5', { h: 1.0 });

        let choice = order[Math.floor(rng() * order.length)];
        if (choice === last) choice = order[(order.indexOf(choice) + 1) % order.length];
        last = choice;

        const api = this.makeApi(section);
        let built = choice;
        this.TPL[choice](api);
        const firstOk = this.validateRoute(section);
        section.firstFail = firstOk ? null : section.failReason;
        if (!firstOk) {
          this.clearTemplate(section, [entry, exit]);
          this.TPL.spiral(api);
          built = 'spiral~fallback';
          if (!this.validateRoute(section)) {
            this.clearTemplate(section, [entry, exit]);
            this.TPL.beams(api);
            built = 'beams~fallback';
          }
        }
        section.template = built;
      }
    }

    clearTemplate(section, keeps) {
      const keepSet = new Set(keeps);
      section.group.children.slice().forEach((child) => {
        let isKeep = false;
        for (const k of keeps) if (k.mesh === child) isKeep = true;
        if (!isKeep) section.group.remove(child);
      });
      for (const c of section.colliders) {
        if (keepSet.has(c)) continue;
        const idx = this.colliders.indexOf(c);
        if (idx >= 0) this.colliders.splice(idx, 1);
        const m = this.moverList.indexOf(c);
        if (m >= 0) this.moverList.splice(m, 1);
        const s = this.spinners.indexOf(c);
        if (s >= 0) this.spinners.splice(s, 1);
        const b = this.blinkers.indexOf(c);
        if (b >= 0) this.blinkers.splice(b, 1);
        const cv = this.conveyors.indexOf(c);
        if (cv >= 0) this.conveyors.splice(cv, 1);
      }
      section.colliders = keeps.slice();
      section.coins.length = 0;
      this.coins = this.coins.filter((c) => c.section !== section.index);
      section.route.length = 0;
      section.trusted = false;
    }

    validateRoute(section) {
      section.failReason = null;
      const fail = (why) => { section.failReason = why; return false; };
      if (section.trusted) return true;
      const route = section.route;
      if (route.length < 3) return fail('few-steps');
      const P = T.PHYS;
      const reach = (rise) => {
        const disc = P.jumpVel * P.jumpVel - 2 * P.gravity * Math.max(0, rise);
        if (disc < 0) return -1;
        return P.moveSpeed * ((P.jumpVel + Math.sqrt(disc)) / P.gravity);
      };
      // no platform hanging in the player's head space over the entry pad
      for (const p of route) {
        const dx = Math.max(0, Math.abs(p.x) - (p.w + T.PAD) / 2);
        const dz = Math.max(0, Math.abs(p.z) - (p.d + T.PAD) / 2);
        if (dx === 0 && dz === 0 && p.yTop > T.PAD_TOP && p.yTop < T.PAD_TOP + 2.15) return fail('pad-headroom');
      }
      // nothing wide may hang over the spawn pad inside jump height (you must be able to jump off it)
      for (const c of section.colliders) {
        if (c.noStand || c.knock || c.kill) continue;
        const top = c.top - section.baseY, bottom = c.bottom - section.baseY;
        if (Math.abs(top - T.PAD_TOP) < 0.02) continue;
        if (top < T.PAD_TOP) continue;
        if (bottom > 4.95) continue;
        if (c.hx <= 1.9 && c.hz <= 1.9) continue;
        if (Math.abs(c.cx) < c.hx + T.PAD / 2 && Math.abs(c.cz) < c.hz + T.PAD / 2) return fail('pad-jump-clearance');
      }
      // every landing spot needs head room above it
      for (const p of route) {
        for (const c of section.colliders) {
          if (c.noStand || c.knock || c.kill) continue;
          const top = c.top - section.baseY, bottom = c.bottom - section.baseY;
          if (top <= p.yTop + 0.2 || bottom >= p.yTop + P.height + 0.12) continue;
          if (Math.abs(p.x - c.cx) < c.hx + 0.35 && Math.abs(p.z - c.cz) < c.hz + 0.35) {
            return fail('headroom@' + p.yTop.toFixed(2) + '/' + c.cx.toFixed(1) + ',' + top.toFixed(1) + ',' + c.cz.toFixed(1));
          }
        }
      }
      const chain = [{ x: 0, z: 0, yTop: T.PAD_TOP, w: T.PAD, d: T.PAD }]
        .concat(route)
        .concat([{ x: 0, z: 0, yTop: T.EXIT_TOP, w: T.PAD, d: T.PAD }]);
      for (let i = 1; i < chain.length; i++) {
        const a = chain[i - 1], b = chain[i];
        const dx = Math.max(0, Math.abs(b.x - a.x) - (a.w + b.w) / 2);
        const dz = Math.max(0, Math.abs(b.z - a.z) - (a.d + b.d) / 2);
        const gap = Math.hypot(dx, dz);
        const rise = b.yTop - a.yTop;
        if (rise > 1.95) return fail('rise:' + rise.toFixed(2) + '@' + i);
        const max = reach(rise);
        if (max < 0 || gap > max * 0.75 || gap > 5.6) return fail('gap:' + gap.toFixed(2) + '@' + i);
      }
      return true;
    }

    buildEmbers() {
      const n = 460;
      const pos = new Float32Array(n * 3);
      const speed = new Float32Array(n);
      const H = this.topY + 40;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 7 + Math.random() * 36;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = Math.random() * H;
        pos[i * 3 + 2] = Math.sin(a) * r;
        speed[i] = 0.6 + Math.random() * 1.8;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xffa040, size: 0.34, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      });
      this.emberSpeed = speed;
      this.embers = new THREE.Points(geo, mat);
      this.embers.frustumCulled = false;
      this.scene.add(this.embers);
    }

    buildSummit() {
      const g = new THREE.Group();
      g.position.y = this.topY;
      const pad = T.box(11, 1.2, 11, '#f5cd30');
      pad.position.set(0, -0.6, 0);
      g.add(pad);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.18, 8, 40), T.neonMaterial('#25e0ff'));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.12;
      g.add(ring);
      // trophy: base, stem, cup
      const base = T.box(2.2, 0.35, 2.2, '#e8e8e8', { flat: true });
      base.position.set(0, 0.18, 0);
      g.add(base);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.5, 10), T.flatMaterial('#ffd23f'));
      stem.position.set(0, 1.1, 0);
      g.add(stem);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.42, 1.35, 12, 1, true), T.flatMaterial('#ffd23f'));
      cup.position.set(0, 2.5, 0);
      g.add(cup);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.1, 8, 20), T.neonMaterial('#fff2a8'));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, 3.18, 0);
      g.add(rim);
      const glow = new THREE.PointLight(0xffcc44, 2.4, 16, 2);
      glow.position.set(0, 2.6, 0);
      g.add(glow);
      this.summitRing = ring;
      this.summit = g;
      this.scene.add(g);
      this.colliders.push({
        mesh: pad, cx: 0, cy: this.topY - 0.6, cz: 0, hx: 5.5, hy: 0.6, hz: 5.5,
        top: this.topY, bottom: this.topY - 1.2, rot: 0, solid: true, kill: false,
        section: 999, noCam: false,
      });
    }

    // ---------- teardown ----------
    dispose() {
      if (this.group) this.scene.remove(this.group);
      if (this.embers) this.scene.remove(this.embers);
      if (this.summit) this.scene.remove(this.summit);
      this.colliders.length = 0;
      this.coins.length = 0;
      this.sections.length = 0;
      this.checkpoints.length = 0;
      this.moverList.length = 0;
      this.spinners.length = 0;
      this.blinkers.length = 0;
      this.conveyors.length = 0;
    }

    // ---------- per-frame ----------
    update(dt, playerY) {
      this.time += dt;
      const t = this.time;

      const sec = T.clamp(Math.floor(playerY / SEC_H), 0, T.SECTIONS - 1);
      for (let i = 0; i < this.sections.length; i++) {
        this.sections[i].group.visible = Math.abs(i - sec) <= 4;
      }
      if (this.summit) this.summit.visible = playerY > this.topY - SEC_H * 5;
      if (this.embers) {
        const pos = this.embers.geometry.attributes.position;
        const arr = pos.array;
        for (let i = 0; i < this.emberSpeed.length; i++) {
          let y = arr[i * 3 + 1] + this.emberSpeed[i] * dt;
          if (y > this.topY + 40) y = 0;
          arr[i * 3 + 1] = y;
        }
        pos.needsUpdate = true;
        this.embers.material.opacity = 0.55 + 0.18 * Math.sin(t * 2);
      }

      for (const s of this.spinners) {
        s.rot += s.spin * dt;
        s.mesh.rotation.y = s.rot;
      }

      for (const m of this.moverList) {
        if (!m.mover) continue;
        const p = (t / m.mover.period) * Math.PI * 2 + m.mover.phase;
        const k = 0.5 - 0.5 * Math.cos(p);
        const yTop = m.mover.lo + (m.mover.hi - m.mover.lo) * k;
        const dy = yTop - m.topLocal;
        m.topLocal = yTop;
        m.top += dy;
        m.bottom += dy;
        m.cy += dy;
        m.mesh.position.y = yTop - m.hy;
        m.dy = dy;
      }

      for (const b of this.blinkers) {
        const bl = b.blink;
        const phase = ((t + bl.offset) % bl.period) / bl.period;
        const on = phase < bl.duty;
        if (on !== b.solid) {
          b.solid = on;
          b.mesh.visible = on;
        }
      }

      for (const c of this.conveyors) {
        const map = c.mesh.material && c.mesh.material.map;
        if (map) map.offset.x = (t * 0.6 * Math.sign(c.conveyor.x || 1)) % 1;
      }

      for (const c of this.coins) {
        if (c.taken) continue;
        c.mesh.rotation.y = t * 2.6 + c.baseY;
        c.mesh.position.y = c.y + Math.sin(t * 2.2 + c.baseY) * 0.12;
      }

      const pulse = 0.8 + 0.2 * Math.sin(t * 7.5);
      this.killMat.color.setRGB(pulse, 0.16 * pulse, 0.09 * pulse);

      if (this.summitRing) {
        this.summitRing.rotation.z = t * 0.6;
        this.summitRing.position.y = 0.12 + Math.sin(t * 1.6) * 0.12;
      }
    }

    collectCoins(px, py, pz, radius) {
      let n = 0;
      for (const c of this.coins) {
        if (c.taken) continue;
        if (Math.abs(c.y - py) > 2.4) continue;
        const dx = c.x - px, dz = c.z - pz;
        if (dx * dx + dz * dz < radius * radius) {
          c.taken = true;
          c.mesh.visible = false;
          n++;
        }
      }
      return n;
    }

    checkpointFor(y) {
      let best = this.checkpoints[0];
      for (const c of this.checkpoints) {
        if (c.y <= y + 0.6 && c.y >= best.y) best = c;
      }
      return best;
    }

    nearby(x, y, z, out) {
      out.length = 0;
      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i];
        if (Math.abs(c.cy - y) > 6.0) continue;
        if (Math.abs(c.cx - x) > 11 || Math.abs(c.cz - z) > 11) continue;
        out.push(c);
      }
      return out;
    }
  };

  T.towerHeight = () => T.SECTIONS * SEC_H;
})();

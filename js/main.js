/* main.js — boot, frame loop, __sim test surface */
(function () {
  const T = window.TOH;
  const canvas = document.getElementById('scene');

  const engine = T.Engine(canvas);
  const input = T.Input(canvas, engine);
  const audio = T.Audio();
  const seed = ((Math.random() * 0xffffff) | 0) || 424242;
  const level = new T.Level(engine.scene, seed);
  const player = new T.Player(engine.scene, level);
  const lava = new T.Lava(engine.scene);
  const game = new T.Game({ engine, input, audio, level, player, lava });

  T.game = game;
  T.engine = engine;
  T.player = player;
  T.lava = lava;

  // corporate panels: 1/2/3 open staff/market/ranks, Escape closes
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1' || e.code === 'Numpad1') game.toggleDrawer('staff');
    else if (e.code === 'Digit2' || e.code === 'Numpad2') game.toggleDrawer('market');
    else if (e.code === 'Digit3' || e.code === 'Numpad3') game.toggleDrawer('ranks');
    else if (e.code === 'Escape' && game.drawerTab) game.toggleDrawer(null);
  });

  function step(dt) {
    game.update(dt);
    engine.updateCamera(dt, player.pos, game.level, lava.y);
  }

  let last = performance.now();
  let lastFrameAt = last;
  let frames = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.05);
    step(dt);
    engine.render();
    frames++;
    lastFrameAt = performance.now();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Safety net: requestAnimationFrame is suspended in hidden/occluded tabs and in some
  // automation contexts, which freezes both the simulation and the painted canvas.
  setInterval(() => {
    if (performance.now() - lastFrameAt < 260) return;
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    step(Math.min(dt, 0.033));
    engine.render();
    frames++;
    lastFrameAt = performance.now();
  }, 33);

  // ---- headless test surface ----
  function auditSection(s) {
    const chain = [{ x: 0, z: 0, yTop: T.PAD_TOP, w: T.PAD, d: T.PAD }]
      .concat(s.route)
      .concat([{ x: 0, z: 0, yTop: T.EXIT_TOP, w: T.PAD, d: T.PAD }]);
    let maxGap = 0, maxRise = -Infinity, worst = -1;
    for (let i = 1; i < chain.length; i++) {
      const a = chain[i - 1], b = chain[i];
      const dx = Math.max(0, Math.abs(b.x - a.x) - (a.w + b.w) / 2);
      const dz = Math.max(0, Math.abs(b.z - a.z) - (a.d + b.d) / 2);
      const gap = Math.hypot(dx, dz), rise = b.yTop - a.yTop;
      if (gap > maxGap) { maxGap = gap; worst = i; }
      if (rise > maxRise) maxRise = rise;
    }
    return { i: s.index, tpl: s.template, steps: s.route.length, maxGap: +maxGap.toFixed(2), maxRise: +maxRise.toFixed(2), worst };
  }

  window.__sim = {
    start(sd) {
      game.start(typeof sd === 'number' ? sd : undefined);
      return true;
    },
    advance(seconds) {
      let left = seconds;
      let guard = 0;
      while (left > 1e-6 && guard++ < 20000) {
        const dt = Math.min(1 / 60, left);
        step(dt);
        left -= dt;
      }
      return this.state();
    },
    step(dt) { step(dt); },
    render() { engine.render(); return true; },
    state() {
      return {
        state: game.state,
        x: +player.pos.x.toFixed(3),
        y: +player.pos.y.toFixed(3),
        z: +player.pos.z.toFixed(3),
        vy: +player.vel.y.toFixed(3),
        grounded: player.grounded,
        coins: game.coins,
        elapsed: +game.elapsed.toFixed(2),
        lavaY: +lava.y.toFixed(2),
        lavaSpeed: +lava.speed.toFixed(2),
        checkpoint: game.checkpoint.index,
        sections: game.level.sections.length,
        colliders: game.level.colliders.length,
        topY: game.level.topY,
        frames,
      };
    },
    teleport(x, y, z) { player.reset(x, y, z); return this.state(); },
    setLava(y) {
      lava.y = y;
      lava.mesh.position.y = y;
      lava.glow.position.y = y + 0.7;
      return this.state();
    },
    key(code, down) {
      input.keys[code] = !!down;
      if (code === 'Space' && down) input.jumpPressed = true;
      return true;
    },
    jump() { input.jumpPressed = true; input.keys.Space = true; return true; },
    look(yaw, pitch) {
      if (typeof yaw === 'number') engine.rig.yaw = yaw;
      if (typeof pitch === 'number') engine.rig.pitch = pitch;
      return { yaw: engine.rig.yaw, pitch: engine.rig.pitch };
    },
    die() { game.die('lava'); return this.state(); },
    win() { game.winNow(); return this.state(); },
    sections() { return game.level.sections.map((s) => ({ i: s.index, tpl: s.template, steps: s.route.length })); },
    audit() { return game.level.sections.map(auditSection); },
    checkpoints() { return game.level.checkpoints.map((c) => ({ i: c.index, y: c.y })); },
    coinsLeft() { return game.level.coins.filter((c) => !c.taken).length; },
    coinCount() { return game.level.coins.length; },
    sectionAt(y) { return Math.floor(y / T.SEC_H); },
    moveToward(x, z, seconds) {
      // helper for scripted climbs: point the camera so that W walks toward (x,z)
      const yaw = Math.atan2(x - player.pos.x, z - player.pos.z);
      engine.rig.yaw = yaw;
      input.keys.KeyW = true;
      this.advance(seconds);
      input.keys.KeyW = false;
      return this.state();
    },
    get player() { return player; },
    get level() { return game.level; },
    get game() { return game; },
    get lava() { return lava; },
    get engine() { return engine; },
    // ---- corporate test hooks ----
    get economy() { return game.economy; },
    get market() { return game.market; },
    get npcs() { return game.npcs.npcs; },
    money() {
      const e = game.economy;
      return { cash: +e.cash.toFixed(2), netWorth: +e.netWorth().toFixed(2), idle: +e.idleRate().toFixed(3), rank: e.rank, rankName: e.rankName() };
    },
    hire(id) { const ok = game.economy.hire(id); game.syncCorpHud(); return ok; },
    buy(id, qty) { return game.market.buy(id, qty || 1); },
    sellAll(id) { return game.market.sell(id, game.market.shares(id)); },
    give(n) { game.economy.earn(n); game.economy.checkPromotion(); game.syncCorpHud(); return this.money(); },
    openTab(t) { game.toggleDrawer(t); return game.drawerTab; },
    drawerHtml() { return game.el.drawerBody.innerHTML.length; },
    toastCount() { return document.querySelectorAll('#toasts .toast').length; },
    npcInfo() {
      return game.npcs.npcs.map((n) => ({ id: n.id, name: n.name, section: n.section, y: +n.y.toFixed(1), met: n.met, reward: n.reward }));
    },
    greetNearest(dx) {
      const p = player;
      const best = game.npcs.nearest(p.pos.x, p.pos.y + 1, p.pos.z);
      if (!best.npc) return null;
      const n = best.npc;
      const d = Math.hypot(p.pos.x - n.x, p.pos.y - n.y, p.pos.z - n.z);
      if (d > (dx || 3)) return null;
      if (!n.met) { n.met = true; game.greetNpc(n); }
      return n.id;
    },
    T,
  };

  // A visible error surface for the verification pass
  window.__errors = [];
  window.addEventListener('error', (e) => window.__errors.push(String(e.message || e)));
  window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));
})();

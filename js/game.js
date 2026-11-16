/* game.js — state machine, HUD, checkpoints, win/lose, local records */
(function () {
  const T = window.TOH;
  const LS_KEY = 'toh.v1.best';

  function fmt(sec) {
    if (!isFinite(sec)) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const c = Math.floor((sec * 100) % 100);
    return `${m}:${T.pad(s)}.${T.pad(c)}`;
  }
  T.fmtTime = fmt;

  T.Game = class Game {
    constructor(opts) {
      Object.assign(this, opts);
      this.state = 'menu';
      this.coins = 0;
      this.elapsed = 0;
      this.respawnT = 0;
      this.toastT = 0;
      this.seed = (Date.now() & 0xffffff) || 12345;
      this.checkpoint = this.level.checkpoints[0];
      this.best = this.loadBest();

      this.el = {
        hud: document.getElementById('hud'),
        menu: document.getElementById('menu'),
        dead: document.getElementById('dead'),
        win: document.getElementById('win'),
        timer: document.getElementById('timer'),
        coins: document.getElementById('coins'),
        section: document.getElementById('sectionLabel'),
        best: document.getElementById('bestLabel'),
        deadTitle: document.getElementById('deadTitle'),
        deadSub: document.getElementById('deadSub'),
        deadStats: document.getElementById('deadStats'),
        deadBtn: document.getElementById('deadBtn'),
        winStats: document.getElementById('winStats'),
        winSub: document.getElementById('winSub'),
        menuStats: document.getElementById('menuStats'),
        lavaWarn: document.getElementById('lavaWarn'),
        lavaFill: document.getElementById('lavaFill'),
        toast: document.getElementById('checkpointToast'),
        vignette: this.ensureVignette(),
      };

      document.getElementById('playBtn').addEventListener('click', () => this.start());
      document.getElementById('againBtn').addEventListener('click', () => this.start());
      this.el.deadBtn.addEventListener('click', () => this.toMenu());

      this.player.onJump = () => this.audio.jump();
      this.player.onLand = () => this.audio.land();
      this.player.onKnock = () => this.audio.land();

      this.renderMenuStats();
      this.syncHud();
    }

    ensureVignette() {
      let v = document.getElementById('vignette');
      if (!v) {
        v = document.createElement('div');
        v.id = 'vignette';
        document.body.appendChild(v);
      }
      return v;
    }

    loadBest() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return { time: null, coins: 0, runs: 0, wins: 0 };
        const b = JSON.parse(raw);
        return { time: null, coins: 0, runs: 0, wins: 0, ...b };
      } catch (e) {
        return { time: null, coins: 0, runs: 0, wins: 0 };
      }
    }
    saveBest() {
      try { localStorage.setItem(LS_KEY, JSON.stringify(this.best)); } catch (e) { /* private mode */ }
    }

    renderMenuStats() {
      const b = this.best;
      this.el.menuStats.innerHTML =
        `<div class="stat"><b>${b.time ? fmt(b.time) : '—'}</b><span>best time</span></div>` +
        `<div class="stat"><b>${b.coins || 0}</b><span>best coins</span></div>` +
        `<div class="stat"><b>${b.wins || 0}/${b.runs || 0}</b><span>clears / runs</span></div>`;
    }

    show(el, on) { el.classList.toggle('hidden', !on); }

    start(seedOpt) {
      this.audio.unlock();
      this.seed = typeof seedOpt === 'number' ? (seedOpt >>> 0) : (((Math.random() * 0xffffff) | 0) || 7);
      this.rebuildLevel(this.seed);
      this.player.reset(0, T.PAD_TOP + 0.02, 0);
      this.lava.reset();
      this.checkpoint = this.level.checkpoints[0];
      this.checkpoint.active = true;
      this.coins = 0;
      this.elapsed = 0;
      this.respawnT = 0;
      this.state = 'play';
      this.show(this.el.menu, false);
      this.show(this.el.dead, false);
      this.show(this.el.win, false);
      this.show(this.el.hud, true);
      this.best.runs = (this.best.runs || 0) + 1;
      this.saveBest();
      this.audio.startLava();
      this.syncHud();
      if (this.onStart) this.onStart();
    }

    rebuildLevel(seed) {
      const old = this.level;
      if (old) old.dispose();
      this.level = new T.Level(this.engine.scene, seed);
      this.player.level = this.level;
    }

    toMenu() {
      this.state = 'menu';
      this.show(this.el.dead, false);
      this.show(this.el.win, false);
      this.show(this.el.menu, true);
      this.show(this.el.hud, false);
      this.audio.stopLava();
      this.renderMenuStats();
      this.rebuildLevel(this.seed);
      this.player.reset(0, T.PAD_TOP + 0.02, 0);
      this.lava.reset();
      this.checkpoint = this.level.checkpoints[0];
      this.coins = 0;
      this.elapsed = 0;
      this.syncHud();
    }

    die(reason) {
      if (this.state !== 'play') return;
      this.player.dead = true;
      this.player.avatar.visible = false;
      if (this.player.shadow) this.player.shadow.visible = false;
      this.audio.death();
      const ck = this.checkpoint;
      const drowned = ck.y + 0.35 < this.lava.y;
      this.state = drowned ? 'eliminated' : 'dead';
      this.respawnT = 1.15;
      this.el.deadTitle.textContent = drowned ? 'ELIMINATED' : 'YOU DIED';
      this.el.deadSub.textContent = drowned
        ? 'The lava swallowed your checkpoint. The tower wins this round.'
        : (reason === 'kill' ? 'Red bricks are not friendly. Respawning at your checkpoint…'
          : 'The lava got you. Respawning at your checkpoint…');
      this.el.deadStats.innerHTML =
        `<div class="stat"><b>${fmt(this.elapsed)}</b><span>survived</span></div>` +
        `<div class="stat"><b>${this.coins}</b><span>coins</span></div>` +
        `<div class="stat"><b>${Math.floor(this.player.pos.y / T.SEC_H) + 1}/${T.SECTIONS}</b><span>section</span></div>`;
      this.el.deadBtn.classList.toggle('hidden', !drowned);
      this.show(this.el.dead, true);
      this.show(this.el.hud, false);
      if (drowned) this.audio.stopLava();
    }

    doRespawn() {
      const ck = this.checkpoint;
      this.player.reset(ck.x, ck.y + 0.03, ck.z);
      this.state = 'play';
      this.show(this.el.dead, false);
      this.show(this.el.hud, true);
      this.el.vignette.classList.remove('on');
    }

    touchCheckpoint(cp) {
      if (cp.index === this.checkpoint.index) return;
      this.checkpoint = cp;
      cp.active = true;
      this.toastT = 1.5;
      this.el.toast.classList.add('on');
      this.audio.checkpoint();
    }

    winNow() {
      if (this.state !== 'play') return;
      this.state = 'win';
      this.audio.stopLava();
      this.audio.win();
      const t = this.elapsed;
      const prevBest = this.best.time;
      if (!prevBest || t < prevBest) this.best.time = t;
      if (this.coins > (this.best.coins || 0)) this.best.coins = this.coins;
      this.best.wins = (this.best.wins || 0) + 1;
      this.saveBest();
      const isRecord = !prevBest || t < prevBest;
      this.el.winSub.textContent = isRecord ? 'New personal record — the lava never had a chance.' : 'You beat the lava.';
      this.el.winStats.innerHTML =
        `<div class="stat"><b>${fmt(t)}</b><span>your time</span></div>` +
        `<div class="stat"><b>${this.coins}</b><span>coins</span></div>` +
        `<div class="stat"><b>${fmt(this.best.time)}</b><span>best time</span></div>`;
      this.show(this.el.win, true);
      this.show(this.el.hud, false);
      this.player.dead = true;
    }

    syncHud() {
      this.el.timer.textContent = fmt(this.elapsed);
      this.el.coins.textContent = String(this.coins);
      this.el.section.textContent = `SECTION ${T.clamp(Math.floor(this.player.pos.y / T.SEC_H) + 1, 1, T.SECTIONS)} / ${T.SECTIONS}`;
      this.el.best.textContent = this.best.time ? `BEST ${fmt(this.best.time)}` : 'BEST —';
    }

    update(dt) {
      const p = this.player;
      const lv = this.level;

      if (this.state === 'play') {
        this.elapsed += dt;
        const hit = p.update(dt, this.input, this.engine.rig.yaw, this.lava.y);
        if (hit) this.die(hit);

        // coins
        const c = p.center();
        const got = lv.collectCoins(c.x, c.y, c.z, 1.15);
        if (got) {
          this.coins += got;
          this.audio.coin();
        }

        // checkpoints
        if (p.grounded) {
          for (const cp of lv.checkpoints) {
            if (Math.abs(cp.y - p.pos.y) < 0.7 && Math.hypot(cp.x - p.pos.x, cp.z - p.pos.z) < 2.6) {
              this.touchCheckpoint(cp);
              break;
            }
          }
        }

        // reset to checkpoint
        if (this.input.keys.KeyR) {
          this.input.keys.KeyR = false;
          this.doRespawn();
        }

        // summit
        if (p.pos.y >= lv.topY - 0.12) this.winNow();

        lv.update(dt, p.pos.y);
        this.lava.update(dt, this.engine.lavaLight);
      } else if (this.state === 'dead') {
        this.respawnT -= dt;
        lv.update(dt, p.pos.y);
        this.lava.update(dt, this.engine.lavaLight);
        if (this.respawnT <= 0) this.doRespawn();
      } else {
        lv.update(dt, p.pos.y);
        if (this.state === 'menu') {
          this.engine.rig.yaw += dt * 0.16;
        }
      }

      if (this.toastT > 0) {
        this.toastT -= dt;
        if (this.toastT <= 0) this.el.toast.classList.remove('on');
      }

      // lava warning
      const dist = p.pos.y - this.lava.y;
      const intensity = T.clamp(1 - dist / 16, 0, 1);
      this.el.vignette.classList.toggle('on', intensity > 0.62 && this.state === 'play');
      if (this.state === 'play') {
        this.el.lavaWarn.classList.toggle('on', intensity > 0.25);
        this.el.lavaFill.style.width = `${Math.round(intensity * 100)}%`;
        this.audio.setLavaIntensity(intensity);
      } else {
        this.el.lavaWarn.classList.remove('on');
      }

      this.syncHud();
    }
  };
})();

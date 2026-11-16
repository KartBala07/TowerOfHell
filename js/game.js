/* game.js — state machine, HUD, economy, market UI, NPCs, checkpoints, win/lose */
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
      T.game = this;

      this.state = 'menu';
      this.coins = 0;
      this.elapsed = 0;
      this.respawnT = 0;
      this.toastT = 0;
      this.hudT = 0;
      this.uiT = 0;
      this.maxSection = -1;
      this.seed = (Date.now() & 0xffffff) || 12345;
      this.checkpoint = this.level.checkpoints[0];
      this.best = this.loadBest();
      this.drawerTab = null;

      this.market = new T.Market();
      T.market = this.market;
      this.economy = new T.Economy((p) => this.onPromote(p));
      if (this.economy.restorePortfolio) {
        this.market.restore(this.economy.restorePortfolio, this.economy.restorePrices);
      }
      this.npcs = new T.NPCManager(this.engine.scene, this.level);
      this.npcs.rebuild(this.level);

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
        cash: document.getElementById('cash'),
        income: document.getElementById('income'),
        rankName: document.getElementById('rankName'),
        rankFill: document.getElementById('rankFill'),
        rankNext: document.getElementById('rankNext'),
        tabs: document.getElementById('tabs'),
        drawer: document.getElementById('drawer'),
        drawerTitle: document.getElementById('drawerTitle'),
        drawerBody: document.getElementById('drawerBody'),
        drawerClose: document.getElementById('drawerClose'),
        toasts: document.getElementById('toasts'),
      };

      document.getElementById('playBtn').addEventListener('click', () => this.start());
      document.getElementById('againBtn').addEventListener('click', () => this.start());
      this.el.deadBtn.addEventListener('click', () => this.toMenu());
      this.el.tabs.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-tab]');
        if (b) this.toggleDrawer(b.dataset.tab);
      });
      this.el.drawerClose.addEventListener('click', () => this.toggleDrawer(null));
      this.el.drawerBody.addEventListener('click', (e) => this.onDrawerClick(e));
      this.el.drawerBody.addEventListener('change', (e) => this.onDrawerClick(e));

      window.addEventListener('beforeunload', () => this.economy.save());
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.economy.save(); });

      this.player.onJump = () => this.audio.jump();
      this.player.onLand = () => this.audio.land();
      this.player.onKnock = () => this.audio.land();

      this.renderMenuStats();
      this.syncHud();
      this.setIncomeLabel();
      this.syncCorpHud();

      const off = this.economy.applyOffline();
      if (off) {
        setTimeout(() => this.toast(
          `WHILE YOU WERE OUT: +${T.fmtMoney(off.earned)}`,
          `${Math.round(off.seconds / 60)} min of staff income, at half rate`, 'green'), 700);
      }
      setTimeout(() => this.checkFirstSteps(), 900);
    }

    // ---------- corporate side ----------
    checkFirstSteps() {
      if (this.economy.totalEarned <= 25 && this.state === 'menu') {
        this.toast('WELCOME, INTERN', 'Climb floors for salary · hire staff in STAFF · trade in MARKET', '');
      }
    }

    onPromote(p) {
      this.audio.win();
      this.toast(`PROMOTED: ${p.name.toUpperCase()}`, `${p.line} · signing bonus ${T.fmtMoney(p.bonus)}`, 'green');
      this.economy.save();
      if (this.drawerTab === 'ranks') this.renderDrawer();
    }

    toast(title, sub, cls) {
      if (!this.el.toasts) return;
      const d = document.createElement('div');
      d.className = 'toast ' + (cls || '');
      d.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
      this.el.toasts.appendChild(d);
      while (this.el.toasts.children.length > 4) this.el.toasts.removeChild(this.el.toasts.firstChild);
      setTimeout(() => {
        d.style.transition = 'opacity .3s, transform .3s';
        d.style.opacity = '0';
        d.style.transform = 'translateY(-6px)';
        setTimeout(() => d.remove(), 320);
      }, cls === 'green' ? 3600 : 2800);
    }

    setIncomeLabel() {
      const rate = this.economy.idleRate();
      this.el.income.textContent = rate > 0 ? `+${T.fmtMoney(rate)}/s` : '+$0/s';
    }

    syncCorpHud() {
      const eco = this.economy;
      this.el.cash.textContent = T.fmtMoney(eco.cash);
      this.setIncomeLabel();
      this.el.rankName.textContent = eco.rankName();
      const pr = eco.progress();
      this.el.rankFill.style.width = `${Math.round(pr.pct * 100)}%`;
      const nx = eco.nextRank();
      this.el.rankNext.textContent = nx ? T.fmtMoney(nx.need) : 'TOP';
    }

    toggleDrawer(tab) {
      if (!tab || this.drawerTab === tab) {
        this.drawerTab = null;
        this.el.drawer.classList.add('hidden');
        for (const b of this.el.tabs.querySelectorAll('button')) b.classList.remove('on');
        return;
      }
      this.drawerTab = tab;
      this.el.drawer.classList.remove('hidden');
      for (const b of this.el.tabs.querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === tab);
      this.renderDrawer();
    }

    renderDrawer() {
      const tab = this.drawerTab;
      if (!tab) return;
      this.el.drawerTitle.textContent = tab === 'staff' ? 'Staff · idle income'
        : tab === 'market' ? 'Market · fake stocks' : 'Career · milestones';
      if (tab === 'staff') this.el.drawerBody.innerHTML = this.staffHtml();
      else if (tab === 'market') this.el.drawerBody.innerHTML = this.marketHtml();
      else this.el.drawerBody.innerHTML = this.ranksHtml();
      if (tab === 'market') this.paintSparklines();
    }

    staffHtml() {
      const eco = this.economy;
      const rate = eco.idleRate();
      let h = `<div class="newsline">Idle income <b>${T.fmtMoney(rate)}/s</b> · rank multiplier <b>x${eco.mult().toFixed(2)}</b> · your staff keeps working while you climb (and while you're away).</div>`;
      for (const s of eco.staff) {
        const cost = eco.cost(s);
        const can = eco.cash >= cost;
        h += `<div class="row">
          <div class="ico">${s.icon}</div>
          <div class="meta"><b>${s.name}</b><span>${s.blurb}</span>
            <span style="color:#7dffb0">+${T.fmtMoney(s.rate * eco.mult())}/s each · owned ${s.n}</span></div>
          <div class="act"><button class="buy" data-act="hire" data-id="${s.id}" ${can ? '' : 'disabled'}>${T.fmtMoney(cost)}</button>
            <div class="cnt">${s.n > 0 ? '+' + T.fmtMoney(s.n * s.rate * eco.mult()) + '/s' : ''}</div></div>
        </div>`;
      }
      return h;
    }

    marketHtml() {
      const m = this.market;
      const eco = this.economy;
      let h = `<div class="newsline">📰 ${m.news}${m.newsTone === -1 ? ' <b style="color:#ff8a7a">▼</b>' : m.newsTone === 1 ? ' <b style="color:#7dffb0">▲</b>' : ''}</div>`;
      h += `<div class="newsline" style="background:rgba(37,224,255,.07);border-color:rgba(37,224,255,.25)">Cash <b>${T.fmtMoney(eco.cash)}</b> · portfolio <b>${T.fmtMoney(m.portfolioValue())}</b> · net worth <b>${T.fmtMoney(eco.netWorth())}</b></div>`;
      for (const r of m.rows) {
        const chg = r.prev ? ((r.price - r.prev) / r.prev) * 100 : 0;
        const cls = chg >= 0 ? 'up' : 'down';
        const held = m.shares(r.id);
        const avg = m.avgCost(r.id);
        const pl = held ? (r.price - avg) * held : 0;
        h += `<div class="stock">
          <div><div class="head"><span class="tick" style="color:${r.color}">${r.id}</span><span class="nm">${r.name}</span></div></div>
          <div><div class="px">$${r.price.toFixed(2)}</div><div class="chg ${cls}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</div></div>
          <canvas data-spark="${r.id}" width="330" height="34"></canvas>
          <div class="trade">
            <span class="held">${held ? `held ${held.toFixed(2)} @ ${T.fmtMoney(avg)} · ${pl >= 0 ? '+' : ''}${T.fmtMoney(pl)}` : 'no position'}</span>
            <button class="buy" data-act="buy" data-id="${r.id}" data-qty="1" ${eco.cash >= r.price ? '' : 'disabled'}>BUY 1</button>
            <button class="buy" data-act="buy" data-id="${r.id}" data-qty="10" ${eco.cash >= r.price * 10 ? '' : 'disabled'}>BUY 10</button>
            <button class="buy sell" data-act="sell" data-id="${r.id}" ${held ? '' : 'disabled'}>SELL</button>
          </div>
        </div>`;
      }
      return h;
    }

    paintSparklines() {
      const m = this.market;
      for (const c of this.el.drawerBody.querySelectorAll('canvas[data-spark]')) {
        const r = m.byId(c.dataset.spark);
        if (r) m.sparkline(c, r.hist, r.color);
      }
    }

    ranksHtml() {
      const eco = this.economy;
      let h = `<div class="newsline">Net worth <b>${T.fmtMoney(eco.netWorth())}</b> — cash plus portfolio. Each promotion pays a signing bonus and permanently multiplies your income.</div>`;
      T.RANKS.forEach((r, i) => {
        const cls = i === eco.rank ? 'now' : i < eco.rank ? 'done' : '';
        const st = i === eco.rank ? 'CURRENT' : i < eco.rank ? 'CLEARED' : T.fmtMoney(r.need);
        h += `<div class="rankrow ${cls}">
          <div><b>${r.name}</b><span>needs ${T.fmtMoney(r.need)} net worth · x${r.mult.toFixed(2)} income</span>
            <span class="tagline">${r.line}</span></div>
          <div class="st">${st}</div>
        </div>`;
      });
      return h;
    }

    onDrawerClick(e) {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act, id = b.dataset.id;
      if (act === 'hire') {
        if (this.economy.hire(id)) {
          this.audio.checkpoint();
          this.renderDrawer();
          this.syncCorpHud();
        } else {
          this.toast('NOT ENOUGH CASH', 'Climb a floor or sell a position first.', 'red');
        }
      } else if (act === 'buy') {
        const qty = parseInt(b.dataset.qty, 10) || 1;
        const r = this.market.buy(id, qty);
        if (!r.ok) this.toast('ORDER REJECTED', r.why === 'no-cash' ? 'Not enough cash for that order.' : r.why, 'red');
        else { this.audio.coin(); this.renderDrawer(); this.syncCorpHud(); }
      } else if (act === 'sell') {
        const held = this.market.shares(id);
        const r = this.market.sell(id, held);
        if (!r.ok) this.toast('NO POSITION', 'You own no shares of ' + id, 'red');
        else {
          this.audio.coin();
          this.toast(`SOLD ${id}`, `${r.pl >= 0 ? 'profit' : 'loss'} ${T.fmtMoney(Math.abs(r.pl))} · +${T.fmtMoney(r.proceeds)} cash`, r.pl >= 0 ? 'green' : 'red');
          this.renderDrawer(); this.syncCorpHud();
        }
      }
    }

    greetNpc(npc) {
      const pay = Math.round(npc.reward * this.economy.mult());
      this.economy.earn(pay);
      this.economy.checkPromotion();
      this.audio.coin();
      this.toast(`${npc.name.toUpperCase()} — ${npc.title}`, `"${npc.lines[1] || npc.lines[0]}" · +${T.fmtMoney(pay)}`, 'green');
    }

    // ---------- lifecycle ----------
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
        `<div class="stat"><b>${this.economy.rankName()}</b><span>rank</span></div>` +
        `<div class="stat"><b>${T.fmtMoney(this.economy.netWorth())}</b><span>net worth</span></div>` +
        `<div class="stat"><b>${b.time ? fmt(b.time) : '—'}</b><span>best time</span></div>` +
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
      this.maxSection = 0;
      this.state = 'play';
      this.show(this.el.menu, false);
      this.show(this.el.dead, false);
      this.show(this.el.win, false);
      this.show(this.el.hud, true);
      this.best.runs = (this.best.runs || 0) + 1;
      this.saveBest();
      this.audio.startLava();
      this.syncHud();
      this.syncCorpHud();
      if (this.onStart) this.onStart();
    }

    rebuildLevel(seed) {
      const old = this.level;
      if (old) old.dispose();
      this.level = new T.Level(this.engine.scene, seed);
      this.player.level = this.level;
      if (this.npcs) this.npcs.rebuild(this.level);
    }

    toMenu() {
      this.state = 'menu';
      this.show(this.el.dead, false);
      this.show(this.el.win, false);
      this.show(this.el.menu, true);
      this.show(this.el.hud, false);
      this.el.drawer.classList.add('hidden');
      this.drawerTab = null;
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
      this.economy.save();
      const ck = this.checkpoint;
      const drowned = ck.y + 0.35 < this.lava.y;
      this.state = drowned ? 'eliminated' : 'dead';
      this.respawnT = 1.15;
      this.el.deadTitle.textContent = drowned ? 'ELIMINATED' : 'YOU DIED';
      this.el.deadSub.textContent = drowned
        ? 'The lava swallowed your checkpoint. The company survives without you — staff keep earning.'
        : (reason === 'kill' ? 'Red bricks are not friendly. Respawning at your checkpoint…'
          : 'The lava got you. Respawning at your checkpoint…');
      this.el.deadStats.innerHTML =
        `<div class="stat"><b>${fmt(this.elapsed)}</b><span>survived</span></div>` +
        `<div class="stat"><b>${this.coins}</b><span>coins</span></div>` +
        `<div class="stat"><b>${T.fmtMoney(this.economy.cash)}</b><span>cash</span></div>` +
        `<div class="stat"><b>${Math.floor(this.player.pos.y / T.SEC_H) + 1}/${T.SECTIONS}</b><span>floor</span></div>`;
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
      const pay = this.economy.salary(120 + cp.index * 40);
      this.economy.earn(pay);
      this.toast('CHECKPOINT SECURED', `promotion paperwork filed · +${T.fmtMoney(pay)}`, 'green');
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
      const bonus = this.economy.salary(25000);
      this.economy.earn(bonus);
      this.economy.checkPromotion();
      this.economy.save();
      const isRecord = !prevBest || t < prevBest;
      this.el.winSub.textContent = isRecord ? 'New personal record — the lava never had a chance.' : 'You beat the lava.';
      this.el.winStats.innerHTML =
        `<div class="stat"><b>${fmt(t)}</b><span>your time</span></div>` +
        `<div class="stat"><b>${T.fmtMoney(bonus)}</b><span>summit bonus</span></div>` +
        `<div class="stat"><b>${T.fmtMoney(this.economy.cash)}</b><span>cash</span></div>` +
        `<div class="stat"><b>${this.economy.rankName()}</b><span>rank</span></div>` +
        `<div class="stat"><b>${fmt(this.best.time)}</b><span>best time</span></div>`;
      this.show(this.el.win, true);
      this.show(this.el.hud, false);
      this.player.dead = true;
    }

    syncHud() {
      this.el.timer.textContent = fmt(this.elapsed);
      this.el.coins.textContent = String(this.coins);
      const sec = T.clamp(Math.floor(this.player.pos.y / T.SEC_H) + 1, 1, T.SECTIONS);
      this.el.section.textContent = `FLOOR ${sec} / ${T.SECTIONS}`;
      this.el.best.textContent = this.best.time ? `BEST ${fmt(this.best.time)}` : 'BEST —';
    }

    update(dt) {
      const p = this.player;
      const lv = this.level;

      // economy always runs: idle staff income and the market never sleep
      this.economy.tick(dt);
      this.market.tick(dt);
      if (this.npcs) {
        this.npcs.layerHidden = this.state !== 'play';
        this.npcs.update(dt, p, (npc) => this.greetNpc(npc), this.engine.camera);
      }

      if (this.state === 'play') {
        this.elapsed += dt;
        const hit = p.update(dt, this.input, this.engine.rig.yaw, this.lava.y);
        if (hit) this.die(hit);

        // coins -> cash
        const c = p.center();
        const got = lv.collectCoins(c.x, c.y, c.z, 1.15);
        if (got) {
          this.coins += got;
          this.audio.coin();
          this.economy.earn(this.economy.salary(8) * got);
        }

        // floor salary
        const floorIdx = Math.floor(p.pos.y / T.SEC_H);
        if (floorIdx > this.maxSection && p.grounded) {
          this.maxSection = floorIdx;
          const pay = this.economy.salary(20 + floorIdx * 9);
          this.economy.earn(pay);
          this.toast(`FLOOR ${floorIdx + 1}`, `salary +${T.fmtMoney(pay)}`, '');
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

        if (this.input.keys.KeyR) {
          this.input.keys.KeyR = false;
          this.doRespawn();
        }

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
        if (this.state === 'menu') this.engine.rig.yaw += dt * 0.16;
      }

      if (this.toastT > 0) {
        this.toastT -= dt;
        if (this.toastT <= 0) this.el.toast.classList.remove('on');
      }

      // HUD refresh (throttled)
      this.hudT += dt;
      if (this.hudT > 0.1) {
        this.hudT = 0;
        this.syncHud();
        if (this.state === 'play' || this.state === 'dead') this.syncCorpHud();
        if (this.drawerTab) {
          this.uiT += 0.1;
          if (this.uiT >= 0.5) { this.uiT = 0; this.renderDrawer(); }
        }
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

      // autosave
      this.saveT = (this.saveT || 0) + dt;
      if (this.saveT > 8) { this.saveT = 0; this.economy.save(); }
    }
  };
})();

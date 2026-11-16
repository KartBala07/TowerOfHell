/* economy.js — cash, idle staff income, promotion milestones, offline earnings */
(function () {
  const T = window.TOH;
  const SAVE_KEY = 'toh.corp.v1';

  const STAFF = [
    { id: 'intern', name: 'Unpaid Intern', blurb: 'Fetches coffee, files TPS reports.', base: 15, rate: 0.4, icon: '🧑‍🎓' },
    { id: 'analyst', name: 'Analyst', blurb: 'Builds spreadsheets nobody opens.', base: 120, rate: 2.4, icon: '📊' },
    { id: 'sales', name: 'Sales Rep', blurb: 'Sells synergy to other sales reps.', base: 900, rate: 15, icon: '📞' },
    { id: 'manager', name: 'Middle Manager', blurb: 'Schedules meetings about meetings.', base: 7000, rate: 95, icon: '🧑‍💼' },
    { id: 'vp', name: 'Vice President', blurb: 'Owns a strategy. It is "more".', base: 55000, rate: 650, icon: '🎩' },
    { id: 'cfo', name: 'Chief Financial Officer', blurb: 'Finds the money you already lost.', base: 400000, rate: 4200, icon: '💼' },
    { id: 'bot', name: 'Synergy Bot 9000', blurb: 'Runs the company while you climb.', base: 3000000, rate: 30000, icon: '🤖' },
  ];

  const RANKS = [
    { name: 'Intern', need: 0, reward: 0, mult: 1.0, line: 'Coffee is a personality.' },
    { name: 'Junior Analyst', need: 200, reward: 100, mult: 1.1, line: 'You have a badge now.' },
    { name: 'Analyst', need: 1200, reward: 650, mult: 1.25, line: 'Your spreadsheet has three tabs.' },
    { name: 'Senior Associate', need: 6000, reward: 3200, mult: 1.5, line: 'People CC you on purpose.' },
    { name: 'Manager', need: 25000, reward: 14000, mult: 1.8, line: 'You own a recurring meeting.' },
    { name: 'Director', need: 120000, reward: 66000, mult: 2.2, line: 'Your calendar is a war crime.' },
    { name: 'VP of Synergy', need: 600000, reward: 330000, mult: 2.7, line: 'You say "circle back" unironically.' },
    { name: 'SVP', need: 3000000, reward: 1600000, mult: 3.3, line: 'The org chart bends around you.' },
    { name: 'CFO', need: 15000000, reward: 8000000, mult: 4.0, line: 'Lava is now a line item.' },
    { name: 'CEO', need: 80000000, reward: 42000000, mult: 5.0, line: 'The tower is yours. The lava reports to you.' },
  ];

  const COST_GROWTH = 1.18;

  function fmtMoney(n) {
    const v = Math.max(0, n);
    if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e4) return '$' + (v / 1e3).toFixed(1) + 'k';
    if (v >= 100) return '$' + Math.round(v).toLocaleString();
    return '$' + v.toFixed(v < 10 ? 2 : 1);
  }
  T.fmtMoney = fmtMoney;

  T.Economy = class Economy {
    constructor(onPromote) {
      this.onPromote = onPromote || function () {};
      this.cash = 25;
      this.totalEarned = 25;
      this.rank = 0;
      this.staff = STAFF.map((s) => Object.assign({}, s, { n: 0 }));
      this.bestNetWorth = 0;
      this.lastSeen = Date.now();
      this.offlineReport = null;
      this.load();
    }

    mult() { return RANKS[this.rank].mult; }
    rankName() { return RANKS[this.rank].name; }
    nextRank() { return RANKS[this.rank + 1] || null; }

    idleRate() {
      let r = 0;
      for (const s of this.staff) r += s.n * s.rate;
      return r * this.mult();
    }

    cost(s) { return Math.floor(s.base * Math.pow(COST_GROWTH, s.n)); }
    staffById(id) { return this.staff.find((s) => s.id === id); }

    hire(id) {
      const s = this.staffById(id);
      if (!s) return false;
      const c = this.cost(s);
      if (!this.spend(c)) return false;
      s.n++;
      this.save();
      return true;
    }

    earn(n, why) {
      if (!(n > 0)) return 0;
      this.cash += n;
      this.totalEarned += n;
      return n;
    }

    spend(n) {
      if (this.cash < n) return false;
      this.cash -= n;
      return true;
    }

    netWorth() {
      const port = T.market ? T.market.portfolioValue() : 0;
      return this.cash + port;
    }

    // cash that a climb event pays, scaled by rank
    salary(base) { return Math.round(base * this.mult() * (1 + this.rank * 0.35)); }

    checkPromotion() {
      let promoted = null;
      const nw = this.netWorth();
      if (nw > this.bestNetWorth) this.bestNetWorth = nw;
      while (this.rank + 1 < RANKS.length && nw >= RANKS[this.rank + 1].need) {
        this.rank++;
        const r = RANKS[this.rank];
        const bonus = Math.round(r.reward * this.mult());
        this.earn(bonus);
        promoted = { rank: this.rank, name: r.name, bonus, line: r.line, need: r.need };
        this.onPromote(promoted);
      }
      if (promoted) this.save();
      return promoted;
    }

    progress() {
      const nw = this.netWorth();
      const next = this.nextRank();
      if (!next) return { pct: 1, have: nw, need: nw };
      const from = RANKS[this.rank].need;
      const pct = T.clamp((nw - from) / Math.max(1, next.need - from), 0, 1);
      return { pct, have: nw, need: next.need };
    }

    tick(dt) {
      const inc = this.idleRate() * dt;
      if (inc > 0) { this.cash += inc; this.totalEarned += inc; }
      this._chk = (this._chk || 0) + dt;
      if (this._chk > 0.4) { this._chk = 0; this.checkPromotion(); }
    }

    save() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          cash: this.cash,
          totalEarned: this.totalEarned,
          rank: this.rank,
          staff: this.staff.map((s) => s.n),
          bestNetWorth: this.bestNetWorth,
          lastSeen: Date.now(),
          portfolio: T.market ? T.market.holdings : {},
          prices: T.market ? T.market.prices() : null,
        }));
      } catch (e) { /* private mode */ }
    }

    load() {
      let raw = null;
      try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return; }
      if (!raw) return;
      let d;
      try { d = JSON.parse(raw); } catch (e) { return; }
      this.cash = typeof d.cash === 'number' ? d.cash : this.cash;
      this.totalEarned = typeof d.totalEarned === 'number' ? d.totalEarned : this.totalEarned;
      this.rank = T.clamp(d.rank | 0, 0, RANKS.length - 1);
      this.bestNetWorth = d.bestNetWorth || 0;
      if (Array.isArray(d.staff)) d.staff.forEach((n, i) => { if (this.staff[i]) this.staff[i].n = n | 0; });
      if (d.lastSeen) this.lastSeen = d.lastSeen;
      this.restorePortfolio = d.portfolio || null;
      this.restorePrices = d.prices || null;
    }

    // offline income: cap at 8h, half rate, needs an idle income to exist
    applyOffline() {
      const rate = this.idleRate();
      if (!rate) return null;
      const seconds = T.clamp((Date.now() - this.lastSeen) / 1000, 0, 8 * 3600);
      if (seconds < 60) return null;
      const earned = Math.round(rate * seconds * 0.5);
      if (earned < 1) return null;
      this.earn(earned);
      this.offlineReport = { seconds, earned };
      this.checkPromotion();
      this.save();
      return this.offlineReport;
    }
  };

  T.STAFF = STAFF;
  T.RANKS = RANKS;
})();

/* market.js — fake stock market: five tickers, random walk, news shocks, buy/sell */
(function () {
  const T = window.TOH;

  const DEFS = [
    { id: 'HELL', name: 'LavaCorp', price: 42, drift: 0.010, vol: 0.055, color: '#ff6a3c' },
    { id: 'CUBE', name: 'Cube Holdings', price: 118, drift: 0.006, vol: 0.030, color: '#4fa3ff' },
    { id: 'SYNR', name: 'Synergy Group', price: 26, drift: 0.014, vol: 0.075, color: '#9d7bff' },
    { id: 'MEME', name: 'Meme Logistics', price: 8, drift: 0.004, vol: 0.130, color: '#ff4fa3' },
    { id: 'BOSS', name: 'Boss Fight Inc', price: 260, drift: 0.009, vol: 0.045, color: '#ffd23f' },
  ];

  const GOOD = [
    'Q3 earnings beat expectations',
    'CEO promises "more synergy"',
    'New tower wing breaks ground',
    'Analysts upgrade to Strong Buy',
    'Buyback announced',
  ];
  const BAD = [
    'Lava containment incident',
    'Audit finds "creative" accounting',
    'Executive departs for rival tower',
    'Product recall after stud shortage',
    'Regulators ask about the basement',
  ];

  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  T.Market = class Market {
    constructor() {
      this.fee = 0.004;
      this.acc = 0;
      this.t = 0;
      this.holdings = {};
      this.news = 'Market opens flat. The lava is up 3%.';
      this.newsT = 6;
      this.shockT = 0;
      this.rows = DEFS.map((d) => Object.assign({}, d, {
        hist: new Array(48).fill(d.price),
        prev: d.price,
        trend: 0,
      }));
    }

    byId(id) { return this.rows.find((r) => r.id === id); }
    prices() { const o = {}; for (const r of this.rows) o[r.id] = +r.price.toFixed(2); return o; }
    restore(holdings, prices) {
      if (holdings) this.holdings = holdings;
      if (prices) for (const r of this.rows) if (typeof prices[r.id] === 'number') r.price = prices[r.id];
    }

    step() {
      for (const r of this.rows) {
        r.prev = r.price;
        const shock = r.shock || 0;
        const drift = r.drift + shock;
        r.price = Math.max(1.2, r.price * Math.exp(drift * 0.4 + r.vol * 0.4 * gauss()));
        r.shock = shock * 0.86;
        r.hist.push(r.price);
        if (r.hist.length > 48) r.hist.shift();
        r.trend = r.price - r.prev;
      }
      this.newsT -= 0.4;
      if (this.newsT <= 0) {
        this.newsT = 12 + Math.random() * 10;
        const r = this.rows[Math.floor(Math.random() * this.rows.length)];
        const good = Math.random() > 0.45;
        r.shock = (good ? 1 : -1) * (0.010 + Math.random() * 0.012);
        this.news = `${r.id}: ${good ? GOOD[Math.floor(Math.random() * GOOD.length)] : BAD[Math.floor(Math.random() * BAD.length)]}`;
        this.newsTone = good ? 1 : -1;
      }
    }

    tick(dt) {
      this.t += dt;
      this.acc += dt;
      if (this.acc >= 0.4) { this.acc = 0; this.step(); }
    }

    shares(id) { return (this.holdings[id] && this.holdings[id].qty) || 0; }
    avgCost(id) { return (this.holdings[id] && this.holdings[id].cost) || 0; }

    buy(id, qty) {
      const r = this.byId(id);
      if (!r || qty <= 0) return { ok: false, why: 'bad-order' };
      const cost = r.price * qty * (1 + this.fee);
      if (!T.game.economy.spend(cost)) return { ok: false, why: 'no-cash' };
      const h = this.holdings[id] || { qty: 0, cost: 0 };
      h.qty += qty;
      h.cost += cost;
      this.holdings[id] = h;
      T.game.economy.save();
      return { ok: true, spent: cost };
    }

    sell(id, qty) {
      const r = this.byId(id);
      const h = this.holdings[id];
      if (!r || !h || h.qty <= 0) return { ok: false, why: 'no-shares' };
      qty = Math.min(qty, h.qty);
      const proceeds = r.price * qty * (1 - this.fee);
      const avg = h.cost / h.qty;
      h.qty -= qty;
      h.cost = Math.max(0, h.cost - avg * qty);
      if (h.qty <= 0.0001) delete this.holdings[id];
      T.game.economy.earn(proceeds);
      T.game.economy.checkPromotion();
      T.game.economy.save();
      return { ok: true, proceeds, pl: (r.price * (1 - this.fee) - avg) * qty };
    }

    portfolioValue() {
      let v = 0;
      for (const id in this.holdings) {
        const r = this.byId(id);
        if (r) v += r.price * this.holdings[id].qty;
      }
      return v;
    }

    sparkline(canvas, hist, color) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const min = Math.min.apply(null, hist), max = Math.max.apply(null, hist);
      const span = Math.max(0.0001, max - min);
      ctx.beginPath();
      for (let i = 0; i < hist.length; i++) {
        const x = (i / (hist.length - 1)) * w;
        const y = h - 2 - ((hist[i] - min) / span) * (h - 4);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      ctx.fillStyle = color + '22';
      ctx.fill();
    }
  };
})();

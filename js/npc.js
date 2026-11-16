/* npc.js — suited coworkers on the tower: idle animation, name tags, speech bubbles, handshakes */
(function () {
  const T = window.TOH;

  const LINES = [
    ['Have you tried closing and reopening the tower?', 'Synergy is just friendship with a budget.', 'I CC\'d the lava on that.'],
    ['We are a family here. A family with quotas.', 'Per my last email: climb faster.', 'Lunch is a networking event.'],
    ['The org chart says you report to me now.', 'Let\'s circle back after the lava recedes.', 'I own three dashboards and no answers.'],
    ['Equity vests in four years. The lava vests hourly.', 'Have you considered monetizing your fear?', 'I am "across it".'],
    ['Q4 is a state of mind.', 'This could have been an email.', 'I put your name on a slide. You\'re welcome.'],
    ['We move fast and break interns.', 'Let me loop in somebody who cares.', 'The basement is fine. Do not ask.'],
  ];

  function textSprite(text, opts) {
    const o = opts || {};
    const fs = o.fontSize || 40;
    const pad = 22;
    const c = document.createElement('canvas');
    const ctx0 = c.getContext('2d');
    ctx0.font = `800 ${fs}px "Trebuchet MS", system-ui, sans-serif`;
    const lines = Array.isArray(text) ? text : [text];
    let widest = 0;
    for (const l of lines) widest = Math.max(widest, ctx0.measureText(l).width);
    c.width = Math.ceil(widest + pad * 2);
    c.height = Math.ceil(lines.length * fs * 1.25 + pad * 1.5);
    const ctx = c.getContext('2d');
    if (o.bubble) {
      const r = 26;
      ctx.fillStyle = o.bg || 'rgba(12,8,14,.92)';
      ctx.strokeStyle = o.border || 'rgba(255,255,255,.35)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(c.width - r, 0); ctx.quadraticCurveTo(c.width, 0, c.width, r);
      ctx.lineTo(c.width, c.height - r - 14); ctx.quadraticCurveTo(c.width, c.height - 14, c.width - r, c.height - 14);
      ctx.lineTo(c.width / 2 + 20, c.height - 14); ctx.lineTo(c.width / 2, c.height);
      ctx.lineTo(c.width / 2 - 20, c.height - 14);
      ctx.lineTo(r, c.height - 14); ctx.quadraticCurveTo(0, c.height - 14, 0, c.height - r);
      ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = o.bg || 'rgba(0,0,0,.55)';
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.font = `800 ${fs}px "Trebuchet MS", system-ui, sans-serif`;
    ctx.fillStyle = o.color || '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, c.width / 2, pad * 0.5 + fs * 0.62 + i * fs * 1.25));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true });
    const sprite = new THREE.Sprite(mat);
    const scale = (o.scale || 0.011);
    sprite.scale.set(c.width * scale, c.height * scale, 1);
    return sprite;
  }
  T.textSprite = textSprite;

  const SUITS = ['#2b3a55', '#3d2b4e', '#243b36', '#4a2b2b', '#2c2c3a', '#1f4152'];
  const SHIRTS = ['#e8e8e8', '#dfe7ef', '#f2e9d8', '#e3d5f0'];
  const TIES = ['#c4281c', '#0d69ac', '#f5cd30', '#4b974b', '#9d7bff'];

  function buildNpcMesh(rnd) {
    const g = new THREE.Group();
    const suit = SUITS[Math.floor(rnd() * SUITS.length)];
    const shirt = SHIRTS[Math.floor(rnd() * SHIRTS.length)];
    const tie = TIES[Math.floor(rnd() * TIES.length)];
    const h = 1.85;
    const skin = ['#f6d55c', '#e8b48a', '#b7794f', '#8d5524', '#f2c9a0'][Math.floor(rnd() * 5)];

    const legGeo = new THREE.BoxGeometry(0.5, 1.5, 0.5);
    const legMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#20222b') });
    const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.32, 0.75, 0);
    const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(0.32, 0.75, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.55, 0.7), new THREE.MeshLambertMaterial({ color: new THREE.Color(suit) }));
    torso.position.set(0, 2.28, 0);
    const shirtPlane = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 0.1), new THREE.MeshLambertMaterial({ color: new THREE.Color(shirt) }));
    shirtPlane.position.set(0, 2.32, 0.36);
    const tiePlate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.95, 0.08), new THREE.MeshLambertMaterial({ color: new THREE.Color(tie) }));
    tiePlate.position.set(0, 2.22, 0.42);
    const armGeo = new THREE.BoxGeometry(0.4, 1.4, 0.4);
    const armMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(suit) });
    const armL = new THREE.Mesh(armGeo, armMat); armL.position.set(-0.9, 2.3, 0);
    const armR = new THREE.Mesh(armGeo, armMat); armR.position.set(0.9, 2.3, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshLambertMaterial({ color: new THREE.Color(skin) }));
    head.position.set(0, 3.6, 0);
    [legL, legR, torso, shirtPlane, tiePlate, armL, armR, head].forEach((m) => g.add(m));
    g.scale.setScalar(h / 4.15);
    return { group: g, armL, armR, head, torso };
  }

  const NAMES = ['Brenda', 'Chad', 'Diane', 'Trent', 'Sasha', 'Marcus', 'Priya', 'Kevin', 'Yuki', 'Otis', 'Rebecca', 'Dev', 'Mona', 'Brock'];
  const TITLES = ['Regional Synergy', 'Head of Alignment', 'Growth', 'Ops', 'People Ops', 'Strategy', 'Procurement', 'Compliance'];

  T.NPCManager = class NPCManager {
    constructor(scene, level) {
      this.scene = scene;
      this.level = level;
      this.npcs = [];
      this.group = new THREE.Group();
      scene.add(this.group);
      this.seed = 1;
      this.layer = document.getElementById('npclabels');
      if (!this.layer) {
        this.layer = document.createElement('div');
        this.layer.id = 'npclabels';
        document.body.appendChild(this.layer);
      }
    }

    rebuild(level) {
      this.clear();
      this.level = level;
      const rnd = T.rng((level.seed ^ 0x9e3779b9) >>> 0);
      const wanted = [1, 3, 5, 8, 11, 14, 17, 20, 23, 26, 28];
      let id = 0;
      for (const si of wanted) {
        const sec = level.sections[si];
        if (!sec) continue;
        const nodes = sec.route.filter((r) => r.yTop > 1.2 && r.yTop < 9.5);
        if (!nodes.length) continue;
        const node = nodes[Math.floor(rnd() * nodes.length)];
        const npc = this.spawn({
          id: id++,
          x: node.x * 0.82,
          y: sec.baseY + node.yTop,
          z: node.z * 0.82,
          section: si,
          title: TITLES[Math.floor(rnd() * TITLES.length)],
          name: NAMES[Math.floor(rnd() * NAMES.length)],
          lines: LINES[Math.floor(rnd() * LINES.length)],
          reward: Math.round((35 + si * 18) * 1.0),
          rnd,
        });
        this.npcs.push(npc);
      }
      // the boss at the summit
      const ceo = this.spawn({
        id: id++,
        x: 2.2, y: level.topY + 0.02, z: 2.2, section: 999,
        name: 'The CEO', title: 'Chief Executive Officer',
        lines: ['So you climbed. Bold. I\'ll allow it.', 'Your promotion is... pending synergy.', 'The tower was inside you all along. Ship it.'],
        reward: 250000,
        boss: true,
        rnd,
      });
      this.npcs.push(ceo);
      return this.npcs;
    }

    spawn(o) {
      const npc = { id: o.id, x: o.x, y: o.y, z: o.z, section: o.section, name: o.name, title: o.title, lines: o.lines, reward: o.reward, met: false, boss: !!o.boss, t: Math.random() * 6, phase: Math.random() * 6 };
      const parts = buildNpcMesh(() => o.rnd ? o.rnd() : Math.random());
      npc.mesh = parts.group;
      npc.armL = parts.armL;
      npc.armR = parts.armR;
      npc.head = parts.head;
      npc.mesh.position.set(o.x, o.y, o.z);
      if (o.boss) npc.mesh.scale.multiplyScalar(1.18);
      this.group.add(npc.mesh);

      const tag = null;
      npc.tag = tag;

      // DOM label (crisper than sprites, and it can't fail to render text)
      const el = document.createElement('div');
      el.className = 'npc-label';
      el.innerHTML = `<b>${o.name}</b><span>${o.title}</span><em>${o.lines[0]}</em><i>+${o.reward} handshake</i>`;
      this.layer.appendChild(el);
      npc.el = el;

      const bubble = null;
      npc.bubble = bubble;
      npc.bubbleLine = 0;
      return npc;
    }

    clear() {
      for (const n of this.npcs) {
        if (n.mesh.parent) n.mesh.parent.remove(n.mesh);
        if (n.el && n.el.parentNode) n.el.parentNode.removeChild(n.el);
      }
      this.npcs.length = 0;
    }

    update(dt, player, onGreet, camera) {
      if (!this.npcs.length) return;
      const px = player.pos.x, py = player.pos.y + player.height * 0.5, pz = player.pos.z;
      const v = this._v || (this._v = new THREE.Vector3());
      const w = window.innerWidth, h = window.innerHeight;
      for (const n of this.npcs) {
        n.t += dt;
        const bob = Math.sin(n.t * 1.6 + n.phase) * 0.035;
        n.mesh.position.y = n.y + bob;
        n.armL.rotation.x = Math.sin(n.t * 1.3 + n.phase) * 0.16;
        n.armR.rotation.x = -Math.sin(n.t * 1.3 + n.phase) * 0.16;
        n.mesh.rotation.y = Math.atan2(px - n.x, pz - n.z);
        const d = Math.hypot(px - n.x, py - (n.y + 1.0), pz - n.z);

        if (!n.met && d < 2.8 && player.grounded) {
          n.met = true;
          n.el.classList.add('met');
          n.el.querySelector('em').textContent = 'handshake collected · keep climbing';
          if (onGreet) onGreet(n);
        }
        n.el.classList.toggle('near', d < 3.6);

        // project the label above the NPC's head
        v.set(n.x, n.y + 2.35, n.z).project(camera);
        const sx = ((v.x + 1) / 2) * w, sy = ((1 - v.y) / 2) * h;
        const visible = d < 34 && v.z > -1 && v.z < 1 && sx > 90 && sx < w - 90 && sy > 150 && sy < h - 40;
        if (!visible || this.layerHidden) {
          if (n.el.style.display !== 'none') n.el.style.display = 'none';
          continue;
        }
        n.el.style.display = 'block';
        n.el.style.transform = `translate(-50%,-100%) translate(${sx}px, ${sy}px)`;
        n.el.style.opacity = String(T.clamp(1 - (d - 22) / 12, 0.25, 1));
      }
    }

    nearest(x, y, z) {
      let best = null, bd = Infinity;
      for (const n of this.npcs) {
        const d = Math.hypot(x - n.x, y - n.y, z - n.z);
        if (d < bd) { bd = d; best = n; }
      }
      return { npc: best, dist: bd };
    }
  };
})();

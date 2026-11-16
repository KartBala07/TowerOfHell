/* player.js — blocky avatar, kinematic physics, collision, animation */
(function () {
  const T = window.TOH;

  const P = {
    gravity: 32,
    moveSpeed: 9.2,
    accelGround: 24,
    accelAir: 7.5,
    jumpVel: 12.6,
    coyote: 0.12,
    buffer: 0.13,
    radius: 0.45,
    height: 1.85,
    step: 0.38,
  };
  T.PHYS = P;

  const _near = [];
  const _tmp = { x: 0, z: 0 };

  function toLocal(dx, dz, rot) {
    if (!rot) return { x: dx, z: dz };
    const s = Math.sin(-rot), c = Math.cos(-rot);
    return { x: dx * c - dz * s, z: dx * s + dz * c };
  }
  function toWorld(lx, lz, rot) {
    if (!rot) return { x: lx, z: lz };
    const s = Math.sin(rot), c = Math.cos(rot);
    return { x: lx * c - lz * s, z: lx * s + lz * c };
  }

  T.Player = class Player {
    constructor(scene, level) {
      this.scene = scene;
      this.level = level;
      this.pos = new THREE.Vector3(0, T.PAD_TOP, 0);
      this.vel = new THREE.Vector3();
      this.grounded = false;
      this.standingOn = null;
      this.coyoteT = 0;
      this.bufferT = 0;
      this.radius = P.radius;
      this.height = P.height;
      this.walkPhase = 0;
      this.facing = 0;
      this.dead = false;
      this.spawnPos = new THREE.Vector3(0, T.PAD_TOP + 0.02, 0);
      this.avatar = this.buildAvatar();
      scene.add(this.avatar);
      if (this.shadow) scene.add(this.shadow);
      this.avatar.position.copy(this.pos);
    }

    buildAvatar() {
      const g = new THREE.Group();
      const skin = '#f6d55c';
      const shirt = '#0d69ac';
      const pants = '#2f4858';
      const armMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(skin) });
      const legMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(pants) });
      const shirtMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(shirt) });

      const legGeo = new THREE.BoxGeometry(0.55, 1.5, 0.55);
      const armGeo = new THREE.BoxGeometry(0.45, 1.45, 0.45);
      const torsoGeo = new THREE.BoxGeometry(1.42, 1.6, 0.72);
      const headGeo = new THREE.BoxGeometry(1.15, 1.15, 1.15);

      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.36, 1.5 - 0.75, 0);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(0.36, 1.5 - 0.75, 0);

      const torso = new THREE.Mesh(torsoGeo, shirtMat);
      torso.position.set(0, 1.5 + 0.8, 0);

      const armL = new THREE.Mesh(armGeo, armMat);
      armL.position.set(-0.95, 2.3, 0);
      const armR = new THREE.Mesh(armGeo, armMat);
      armR.position.set(0.95, 2.3, 0);

      const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ map: T.faceTexture() }));
      head.position.set(0, 3.1 + 0.575, 0);

      [legL, legR, torso, armL, armR, head].forEach((m) => { g.add(m); });
      g.scale.setScalar(P.height / 4.25);
      this.parts = { legL, legR, armL, armR, torso, head };

      // fake contact shadow (two concentric discs = soft blob without a texture)
      const shadow = new THREE.Group();
      const discA = new THREE.Mesh(
        new THREE.CircleGeometry(0.72, 24),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false })
      );
      const discB = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 20),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false, toneMapped: false })
      );
      discA.rotation.x = -Math.PI / 2;
      discB.rotation.x = -Math.PI / 2;
      discB.position.y = 0.004;
      shadow.add(discA, discB);
      this.shadow = shadow;
      return g;
    }

    updateShadow(lavaY) {
      if (!this.shadow) return;
      let best = typeof lavaY === 'number' ? lavaY : -Infinity;
      const near = this.level.nearby(this.pos.x, this.pos.y, this.pos.z, _near);
      for (let i = 0; i < near.length; i++) {
        const c = near[i];
        if (!c.solid || c.kill) continue;
        if (c.top > this.pos.y + 0.15) continue;
        if (!this.overlapsHoriz(c, this.pos.x, this.pos.z, this.radius)) continue;
        if (c.top > best) best = c.top;
      }
      if (!isFinite(best)) { this.shadow.visible = false; return; }
      const drop = this.pos.y - best;
      this.shadow.visible = drop < 14;
      this.shadow.position.set(this.pos.x, best + 0.04, this.pos.z);
      const k = T.clamp(1 - drop / 16, 0.2, 1);
      this.shadow.scale.setScalar(0.8 + 0.35 * k);
      this.shadow.children[0].material.opacity = 0.22 * k;
      this.shadow.children[1].material.opacity = 0.44 * k;
    }

    reset(x, y, z) {
      this.pos.set(x, y, z);
      this.vel.set(0, 0, 0);
      this.grounded = false;
      this.standingOn = null;
      this.coyoteT = 0;
      this.bufferT = 0;
      this.dead = false;
      this.avatar.visible = true;
      this.avatar.position.copy(this.pos);
    }

    overlapsHoriz(c, x, z, r) {
      const dx = x - c.cx, dz = z - c.cz;
      if (Math.abs(dx) > c.hx + c.hz + r + 1) return false;
      const l = toLocal(dx, dz, c.rot);
      const qx = Math.max(-c.hx, Math.min(c.hx, l.x));
      const qz = Math.max(-c.hz, Math.min(c.hz, l.z));
      const ddx = l.x - qx, ddz = l.z - qz;
      return ddx * ddx + ddz * ddz < r * r;
    }

    update(dt, input, camYaw, lavaY) {
      if (this.dead) return;
      const ax = input.axis();
      const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
      let wishX = sy * -ax.z + cy * ax.x;
      let wishZ = cy * -ax.z - sy * ax.x;
      const wl = Math.hypot(wishX, wishZ);
      if (wl > 1) { wishX /= wl; wishZ /= wl; }

      // jump buffering
      this.bufferT = Math.max(0, this.bufferT - dt);
      if (input.consumeJump()) this.bufferT = P.buffer;
      const canJump = this.grounded || this.coyoteT > 0;
      if (this.bufferT > 0 && canJump) {
        this.vel.y = P.jumpVel;
        this.grounded = false;
        this.standingOn = null;
        this.coyoteT = 0;
        this.bufferT = 0;
        if (this.onJump) this.onJump();
      }

      // horizontal accel
      const targetX = wishX * P.moveSpeed;
      const targetZ = wishZ * P.moveSpeed;
      const accel = this.grounded ? P.accelGround : P.accelAir;
      const k = Math.min(1, accel * dt);
      this.vel.x += (targetX - this.vel.x) * k;
      this.vel.z += (targetZ - this.vel.z) * k;

      // carry by moving platform / conveyor
      if (this.standingOn) {
        if (this.standingOn.dy) this.pos.y += this.standingOn.dy;
        const cv = this.standingOn.conveyor;
        if (cv) { this.pos.x += cv.x * dt; this.pos.z += cv.z * dt; }
      }

      this.vel.y -= P.gravity * dt;
      if (this.vel.y < -62) this.vel.y = -62;

      // vertical first: land on platforms before the horizontal pass can shove us off their edge
      const prevFeet = this.pos.y;
      const prevVelY = this.vel.y;
      this.pos.y += this.vel.y * dt;
      this.grounded = false;
      this.standingOn = null;
      this.resolveVertical(prevFeet, prevVelY, dt);

      // then horizontal
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.resolveHorizontal(dt);

      if (this.grounded) this.coyoteT = P.coyote; else this.coyoteT = Math.max(0, this.coyoteT - dt);

      // animations
      const speed = Math.hypot(this.vel.x, this.vel.z);
      if (this.grounded && speed > 0.6) {
        this.walkPhase += dt * (5.2 + speed * 0.55);
        const s = Math.sin(this.walkPhase);
        this.parts.legL.rotation.x = s * 0.62;
        this.parts.legR.rotation.x = -s * 0.62;
        this.parts.armL.rotation.x = -s * 0.55;
        this.parts.armR.rotation.x = s * 0.55;
      } else if (!this.grounded) {
        this.parts.legL.rotation.x += (0.45 - this.parts.legL.rotation.x) * Math.min(1, 10 * dt);
        this.parts.legR.rotation.x += (-0.25 - this.parts.legR.rotation.x) * Math.min(1, 10 * dt);
        this.parts.armL.rotation.x += (-1.5 - this.parts.armL.rotation.x) * Math.min(1, 10 * dt);
        this.parts.armR.rotation.x += (-1.5 - this.parts.armR.rotation.x) * Math.min(1, 10 * dt);
      } else {
        ['legL', 'legR', 'armL', 'armR'].forEach((n) => {
          this.parts[n].rotation.x *= Math.max(0, 1 - 9 * dt);
        });
      }

      if (speed > 0.8) {
        const target = Math.atan2(this.vel.x, this.vel.z);
        let d = target - this.facing;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.facing += d * Math.min(1, 14 * dt);
      }
      this.avatar.rotation.y = this.facing;
      this.avatar.position.copy(this.pos);
      this.avatar.scale.y = (P.height / 4.25) * (1 + Math.min(0.06, Math.abs(this.vel.y) * 0.004));

      // hazards
      if (typeof lavaY === 'number' && this.pos.y < lavaY + 0.05) return 'lava';
      if (this.pos.y < -35) return 'void';
      this.updateShadow(lavaY);
      return this.checkHazards(prevFeet);
    }

    resolveHorizontal(dt) {
      const near = this.level.nearby(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z, _near);
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < near.length; i++) {
          const c = near[i];
          if (!c.solid) continue;
          if (c.kill) continue;
          if (c.top <= this.pos.y + 0.06) continue;
          if (c.bottom >= this.pos.y + this.height - 0.06) continue;
          const dx = this.pos.x - c.cx, dz = this.pos.z - c.cz;
          if (Math.abs(dx) > c.hx + c.hz + this.radius + 1.2) continue;
          if (Math.abs(dz) > c.hx + c.hz + this.radius + 1.2) continue;
          const l = toLocal(dx, dz, c.rot);
          const qx = Math.max(-c.hx, Math.min(c.hx, l.x));
          const qz = Math.max(-c.hz, Math.min(c.hz, l.z));
          let nx = l.x - qx, nz = l.z - qz;
          let d2 = nx * nx + nz * nz;
          if (d2 >= this.radius * this.radius) continue;

          // step up small ledges instead of blocking
          if (!c.noStand && c.top - this.pos.y <= P.step && c.top - this.pos.y > -0.02) {
            this.pos.y = c.top + 0.001;
            continue;
          }

          let push;
          if (d2 > 1e-7) {
            const d = Math.sqrt(d2);
            push = { x: (nx / d) * (this.radius - d), z: (nz / d) * (this.radius - d) };
          } else {
            const penX = c.hx - Math.abs(l.x) + this.radius;
            const penZ = c.hz - Math.abs(l.z) + this.radius;
            if (penX < penZ) push = { x: Math.sign(l.x || 1) * penX, z: 0 };
            else push = { x: 0, z: Math.sign(l.z || 1) * penZ };
          }
          const w = toWorld(push.x, push.z, c.rot);
          this.pos.x += w.x;
          this.pos.z += w.z;
          if (c.knock) {
            const rl = Math.hypot(dx, dz) || 1;
            this.vel.x += (dx / rl) * c.knock;
            this.vel.z += (dz / rl) * c.knock;
            this.vel.y = Math.max(this.vel.y, 3.2);
            this.standingOn = null;
            this.grounded = false;
            if (this.onKnock) this.onKnock();
          }
        }
      }
    }

    resolveVertical(prevFeet, prevVelY, dt) {
      const head = this.pos.y + this.height;
      const prevHead = prevFeet + this.height;
      const near = this.level.nearby(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z, _near);
      let landTop = -Infinity, landCol = null;
      for (let i = 0; i < near.length; i++) {
        const c = near[i];
        if (!c.solid || c.kill || c.noStand) continue;
        if (!this.overlapsHoriz(c, this.pos.x, this.pos.z, this.radius * 0.94)) continue;
        if (prevVelY <= 0) {
          if (prevFeet >= c.top - 0.22 && this.pos.y <= c.top + 0.02 && c.top > landTop) {
            landTop = c.top;
            landCol = c;
          }
        } else if (prevHead <= c.bottom + 0.02 && head > c.bottom) {
          this.pos.y = c.bottom - this.height;
          this.vel.y = 0;
        }
      }
      if (landCol) {
        this.pos.y = landTop;
        if (this.vel.y < -14 && this.onLand) this.onLand(-this.vel.y);
        this.vel.y = 0;
        this.grounded = true;
        this.standingOn = landCol;
      }
    }

    checkHazards(prevFeet) {
      const feet = this.pos.y;
      const prev = typeof prevFeet === 'number' ? prevFeet : feet;
      const near = this.level.nearby(this.pos.x, feet + this.height * 0.5, this.pos.z, _near);
      for (let i = 0; i < near.length; i++) {
        const c = near[i];
        if (!c.kill || !c.solid) continue;
        // lethal only at its own level: standing on it, brushing it, or landing on it
        const atLevel = feet > c.bottom - 0.25 && feet < c.top + 0.2;
        const landing = prev >= c.top - 0.1 && feet <= c.top + 0.05;
        if (!atLevel && !landing) continue;
        if (this.overlapsHoriz(c, this.pos.x, this.pos.z, this.radius * 0.88)) return 'kill';
      }
      return null;
    }

    center() {
      return { x: this.pos.x, y: this.pos.y + this.height * 0.5, z: this.pos.z };
    }
  };
})();

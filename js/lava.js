/* lava.js — the rising killing floor */
(function () {
  const T = window.TOH;

  T.Lava = class Lava {
    constructor(scene) {
      this.scene = scene;
      this.y = -9;
      this.time = 0;
      this.base = 0.78;
      this.accel = 0.0125;
      this.max = 3.5;
      this.speed = this.base;

      const tex = T.lavaTexture();
      tex.repeat.set(14, 14);
      this.tex = tex;
      const geo = new THREE.PlaneGeometry(320, 320, 1, 1);
      this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = this.y;
      this.mesh.renderOrder = 2;
      scene.add(this.mesh);

      // hot haze just above the surface
      const glowTex = T.lavaTexture();
      glowTex.repeat.set(6, 6);
      this.glow = new THREE.Mesh(
        new THREE.PlaneGeometry(340, 340),
        new THREE.MeshBasicMaterial({
          map: glowTex, transparent: true, opacity: 0.35, depthWrite: false,
          blending: THREE.AdditiveBlending, toneMapped: false,
        })
      );
      this.glow.rotation.x = -Math.PI / 2;
      this.glow.position.y = this.y + 0.6;
      scene.add(this.glow);
      this.glowTex = glowTex;
    }

    reset() {
      this.y = -9;
      this.time = 0;
      this.speed = this.base;
      this.mesh.position.y = this.y;
    }

    update(dt, light) {
      this.time += dt;
      this.speed = Math.min(this.max, this.base + this.accel * this.time);
      this.y += this.speed * dt;
      this.mesh.position.y = this.y;
      this.glow.position.y = this.y + 0.7;
      this.tex.offset.y = (this.tex.offset.y + dt * 0.045) % 1;
      this.tex.offset.x = (this.tex.offset.x + dt * 0.012) % 1;
      this.glowTex.offset.y = (this.glowTex.offset.y + dt * 0.07) % 1;
      if (light) light.position.set(0, this.y + 3.2, 0);
    }

    distanceTo(y) {
      return y - this.y;
    }
  };
})();

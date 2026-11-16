/* engine.js — renderer, scene, sky, lights, third-person camera rig */
(function () {
  const T = window.TOH;

  T.Engine = function (canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x2a0810, 0.011);

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    camera.position.set(0, 12, 16);

    // sky dome
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(520, 24, 16),
      new THREE.MeshBasicMaterial({ map: T.skyTexture(), side: THREE.BackSide, depthWrite: false, fog: false })
    );
    sky.name = 'sky';
    scene.add(sky);

    // lights
    const hemi = new THREE.HemisphereLight(0xffb080, 0x2a0a12, 0.85);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffe0b8, 1.45);
    key.position.set(-18, 40, 22);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff4a2a, 0.55);
    rim.position.set(16, -20, -14);
    scene.add(rim);
    const ambient = new THREE.AmbientLight(0x4a2432, 0.55);
    scene.add(ambient);

    const lavaLight = new THREE.PointLight(0xff5a12, 3.2, 90, 2);
    scene.add(lavaLight);

    // camera rig
    const rig = {
      yaw: Math.PI * 0.15,
      pitch: 0.26,
      dist: 7.2,
      height: 1.45,
      mode: 'third',
      pos: new THREE.Vector3(0, 12, 16),
      lookup: new THREE.Vector3(),
    };

    const _v = new THREE.Vector3();

    // point-in-OBB test used for camera occlusion
    function insideCollider(p, c, pad) {
      const dx = p.x - c.cx, dy = p.y - c.cy, dz = p.z - c.cz;
      if (Math.abs(dy) > c.hy + pad) return false;
      let lx = dx, lz = dz;
      if (c.rot) {
        const s = Math.sin(-c.rot), co = Math.cos(-c.rot);
        lx = dx * co - dz * s;
        lz = dx * s + dz * co;
      }
      return Math.abs(lx) < c.hx + pad && Math.abs(lz) < c.hz + pad;
    }
    T.insideCollider = insideCollider;

    function updateCamera(dt, target, level, lavaY) {
      const focus = _v.set(target.x, target.y + rig.height, target.z);
      const cp = Math.cos(rig.pitch), sp = Math.sin(rig.pitch);
      const dirX = Math.sin(rig.yaw) * cp, dirY = sp, dirZ = Math.cos(rig.yaw) * cp;
      let dist = rig.dist;

      // step along the boom and stop before geometry
      if (level) {
        const steps = 14;
        for (let i = 1; i <= steps; i++) {
          const d = (rig.dist * i) / steps;
          const px = focus.x - dirX * d, py = focus.y + dirY * d, pz = focus.z - dirZ * d;
          let hit = false;
          for (let k = 0; k < level.colliders.length; k++) {
            const c = level.colliders[k];
            if (c.noCam) continue;
            if (Math.abs(c.cy - py) > c.hy + 1.6) continue;
            if (insideCollider({ x: px, y: py, z: pz }, c, 0.42)) { hit = true; break; }
          }
          if (hit) { dist = Math.max(2.2, d - 0.55); break; }
        }
      }

      let wx = focus.x - dirX * dist;
      let wy = focus.y + dirY * dist;
      let wz = focus.z - dirZ * dist;
      if (typeof lavaY === 'number') wy = Math.max(wy, lavaY + 1.1);

      const k = rig.mode === 'first' ? 1 : 1 - Math.exp(-14 * dt);
      rig.pos.x += (wx - rig.pos.x) * k;
      rig.pos.y += (wy - rig.pos.y) * k;
      rig.pos.z += (wz - rig.pos.z) * k;

      camera.position.copy(rig.pos);
      rig.lookup.set(focus.x, focus.y + 0.15, focus.z);
      camera.lookAt(rig.lookup);
    }

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    return {
      renderer, scene, camera, rig, updateCamera, resize, lavaLight,
      render() { renderer.render(scene, camera); },
    };
  };
})();

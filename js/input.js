/* input.js — keyboard, mouse-drag look, touch stick */
(function () {
  const T = window.TOH;

  T.Input = function (canvas, engine) {
    const keys = Object.create(null);
    const state = {
      keys,
      jumpPressed: false,
      jumpHeld: false,
      moveX: 0,
      moveZ: 0,
      touch: false,
      lookDX: 0,
      lookDY: 0,
      sensitivity: 0.0042,
    };

    function onKey(e, down) {
      const code = e.code;
      if (down) {
        if (code === 'Space') {
          if (!keys.Space) state.jumpPressed = true;
          e.preventDefault();
        }
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
      }
      keys[code] = down;
      state.jumpHeld = !!keys.Space;
    }
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
    window.addEventListener('blur', () => {
      for (const k in keys) keys[k] = false;
      state.jumpHeld = false;
    });

    // mouse drag look
    let dragging = false, lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerType === 'touch') return;
      engine.rig.yaw -= (e.clientX - lastX) * state.sensitivity;
      engine.rig.pitch = T.clamp(engine.rig.pitch + (e.clientY - lastY) * state.sensitivity, -0.55, 1.15);
      lastX = e.clientX; lastY = e.clientY;
    });
    const stopDrag = () => { dragging = false; };
    canvas.addEventListener('pointerup', stopDrag);
    canvas.addEventListener('pointercancel', stopDrag);
    canvas.addEventListener('pointerleave', stopDrag);
    canvas.addEventListener('wheel', (e) => {
      engine.rig.dist = T.clamp(engine.rig.dist + Math.sign(e.deltaY) * 0.8, 4.5, 18);
      e.preventDefault();
    }, { passive: false });

    // ---- touch ----
    const stick = document.getElementById('stick');
    const knob = stick ? stick.querySelector('i') : null;
    const jumpBtn = document.getElementById('jumpBtn');
    let stickId = null, origin = null;

    function touchModeOn() {
      state.touch = true;
      document.getElementById('touch').classList.remove('hidden');
      document.getElementById('hint').classList.add('hidden');
    }

    if (stick) {
      stick.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        stickId = e.pointerId;
        const r = stick.getBoundingClientRect();
        origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        stick.setPointerCapture(e.pointerId);
      });
      stick.addEventListener('pointermove', (e) => {
        if (e.pointerId !== stickId || !origin) return;
        const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
        const max = 52;
        const len = Math.hypot(dx, dy) || 1;
        const cl = Math.min(len, max);
        const nx = (dx / len) * (cl / max), ny = (dy / len) * (cl / max);
        if (knob) knob.style.transform = `translate(${(dx / len) * cl}px, ${(dy / len) * cl}px)`;
        state.moveX = nx;
        state.moveZ = ny;
      });
      const endStick = (e) => {
        if (e.pointerId !== stickId) return;
        stickId = null;
        state.moveX = 0; state.moveZ = 0;
        if (knob) knob.style.transform = 'translate(0,0)';
      };
      stick.addEventListener('pointerup', endStick);
      stick.addEventListener('pointercancel', endStick);
    }
    if (jumpBtn) {
      jumpBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        state.jumpPressed = true;
        state.jumpHeld = true;
      });
      jumpBtn.addEventListener('pointerup', () => { state.jumpHeld = false; });
      jumpBtn.addEventListener('pointercancel', () => { state.jumpHeld = false; });
    }
    canvas.addEventListener('touchstart', touchModeOn, { passive: true, once: true });

    state.consumeJump = function () {
      const j = state.jumpPressed;
      state.jumpPressed = false;
      return j;
    };
    state.axis = function () {
      let x = 0, z = 0;
      if (keys.KeyW || keys.ArrowUp) z -= 1;
      if (keys.KeyS || keys.ArrowDown) z += 1;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      if (state.touch) {
        if (Math.abs(state.moveX) > 0.08) x += state.moveX;
        if (Math.abs(state.moveZ) > 0.08) z += state.moveZ;
      }
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      return { x, z };
    };
    state.resetJump = function () { state.jumpPressed = false; };

    return state;
  };
})();

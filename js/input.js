(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});
   const cfg = PP.cfg, u = PP.util;
  const D2R = u.d2r;

  PP.makeInput = function (canvas, pad, h) {
     const K = cfg.ctl;
    const keys = new Set();
    const io = { locked: false, lockFailed: !canvas.requestPointerLock, swinging: false, rightDrag: false, touches: new Map() };

    function grab() {
      if (io.lockFailed || io.locked || !canvas.requestPointerLock) return;
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => (io.lockFailed = true));
      } catch (e) {
        io.lockFailed = true;
       }
   }
    function release() {
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
     }
    document.addEventListener('pointerlockchange', () => {
      io.locked = document.pointerLockElement === canvas;
      if (!io.locked && io.swinging) {
        io.swinging = false;
        h.swingOff();
      }
      h.lockChange && h.lockChange(io.locked);
    });
    document.addEventListener('pointerlockerror', () => {
       io.lockFailed = true;
      h.lockChange && h.lockChange(false);
     });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        if (!io.locked && !io.lockFailed && h.needsLock()) {
          grab();
          return;
         }
        if (h.swingStart()) io.swinging = true;
      } else if (e.button === 2) {
        if (io.swinging) {
          io.swinging = false;
          h.swingOff();
        } else io.rightDrag = true;
      }
    });
    root.addEventListener('mouseup', (e) => {
      if (e.button === 0 && io.swinging) {
        io.swinging = false;
        h.swingGo();
      } else if (e.button === 2) io.rightDrag = false;
    });
   root.addEventListener('mousemove', (e) => {
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (!dx && !dy) return;
      if (!io.locked && e.target !== canvas && !io.swinging) return;
     if (io.rightDrag) h.look(dx * K.lookPerPx * D2R, -dy * K.lookPerPx * D2R);
      else if (io.swinging) h.swingMove(dx, dy);
      else h.turn(dx * (e.shiftKey ? K.turnFine : K.turnPerPx) * D2R);
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      h.look(0, -Math.sign(e.deltaY) * 3 * D2R);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const MINE = new Set(['KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyC', 'KeyR', 'KeyV', 'KeyM', 'Space', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
    root.addEventListener('keydown', (e) => {
       const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!h.playing()) return;
      if (MINE.has(e.code)) e.preventDefault();
      if (e.code === 'Escape' && io.swinging) {
        io.swinging = false;
         h.swingOff();
        return;
      }
      if (!e.repeat) h.key(e.code, true);
      keys.add(e.code);
     });
    root.addEventListener('keyup', (e) => {
      keys.delete(e.code);
      if (h.playing()) h.key(e.code, false);
     });
     root.addEventListener('blur', () => keys.clear());

     function tick(dt) {
      const fine = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const rate = (fine ? K.turnPerSec * 0.25 : K.turnPerSec) * D2R * dt;
      if (!io.swinging) {
        if (keys.has('KeyA') || keys.has('KeyQ')) h.turn(-rate);
        if (keys.has('KeyD') || keys.has('KeyE')) h.turn(rate);
      }
      const look = K.lookPerSec * D2R * dt;
      if (keys.has('ArrowLeft')) h.look(-look, 0);
      if (keys.has('ArrowRight')) h.look(look, 0);
      if (keys.has('ArrowUp')) h.look(0, look * 0.7);
      if (keys.has('ArrowDown')) h.look(0, -look * 0.7);
      return { fast: keys.has('Space') };
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      io.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
       if (e.pointerType !== 'touch' || !io.touches.has(e.pointerId)) return;
       const p = io.touches.get(e.pointerId);
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
     p.x = e.clientX;
      p.y = e.clientY;
      if (io.touches.size >= 2) h.look((dx * K.lookPerPx * D2R) / 2, (-dy * K.lookPerPx * D2R) / 2);
      else h.turn(dx * K.turnFine * 1.5 * D2R);
    });
    const endTouch = (e) => io.touches.delete(e.pointerId);
    canvas.addEventListener('pointerup', endTouch);
    canvas.addEventListener('pointercancel', endTouch);


    let padAt = null;
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!h.swingStart()) return;
      io.swinging = true;
      padAt = { x: e.clientX, y: e.clientY };
      pad.setPointerCapture && pad.setPointerCapture(e.pointerId);
    });
     pad.addEventListener('pointermove', (e) => {
      if (!io.swinging || !padAt) return;
      const dx = e.clientX - padAt.x, dy = e.clientY - padAt.y;
      padAt = { x: e.clientX, y: e.clientY };
      h.swingMove(dx * 0.6, dy * 1.4);
    });
    const padEnd = () => {
      if (io.swinging) {
        io.swinging = false;
        h.swingGo();
      }
      padAt = null;
    };
    pad.addEventListener('pointerup', padEnd);
    pad.addEventListener('pointercancel', () => {
      if (io.swinging) {
        io.swinging = false;
        h.swingOff();
      }
      padAt = null;
    });

    return { io, tick, grab, release };
  };
})(typeof window !== 'undefined' ? window : globalThis);


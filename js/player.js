/*
 * player.js — the golfer's body and head.
 *
 * The stance is set by the layout (deliberately never square to the true
 * line). The camera is the golfer's eyes: it sits beside and behind the ball
 * at address height and rotates around a neck pivot, so turning the head to
 * look at the cup shifts the eyes slightly, as it does in real life.
 */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});
  const C = MG.CONFIG, U = MG.Util;
  const DEG = U.DEG;

  MG.Player = function (camera) {
    const P = C.player;
    const st = {
      ball: [0, 0],
      stanceYaw: 0,
      eyeSide: -1, // −1: eyes left of the line (right-handed), +1: left-handed
      eyeHeight: P.eyeHeight,
      pivot: new THREE.Vector3(),
      yaw: 0, // head yaw relative to the stance
      pitch: P.defaultPitchDeg * DEG,
      tYaw: 0,
      tPitch: P.defaultPitchDeg * DEG,
      defYaw: 0,
      defPitch: 0,
      behind: null, // post-shot "behind the line" view
      sway: 0
    };
    const shoulders = [new THREE.Vector3(), new THREE.Vector3()];
    const handsBase = new THREE.Vector3();

    function setStance(L, settings) {
      st.ball = [L.ball[0], L.ball[1]];
      st.stanceYaw = L.stanceYaw;
      st.eyeSide = settings.leftHanded ? 1 : -1;
      st.eyeHeight = settings.eyeHeight || P.eyeHeight;
      st.behind = null;
      const fx = U.dirX(st.stanceYaw), fz = U.dirZ(st.stanceYaw);
      const rx = U.rightX(st.stanceYaw), rz = U.rightZ(st.stanceYaw);
      const side = st.eyeSide * P.eyeSide;
      st.pivot.set(st.ball[0] - fx * P.eyeBehind + rx * side, st.eyeHeight, st.ball[1] - fz * P.eyeBehind + rz * side);

      // Shoulders run along the stance line, below and slightly toward the ball.
      const sx = st.pivot.x - rx * side * 0.12, sz = st.pivot.z - rz * side * 0.12, sy = st.eyeHeight - 0.3;
      shoulders[0].set(sx + fx * 0.18, sy, sz + fz * 0.18);
      shoulders[1].set(sx - fx * 0.18, sy, sz - fz * 0.18);
      // Hands: just below the eyes and a little toward the ball, so the shaft
      // rises out of the bottom of the frame and never hides the ball.
      handsBase.set(st.pivot.x + (st.ball[0] - st.pivot.x) * 0.2 + fx * 0.04, 0.8, st.pivot.z + (st.ball[1] - st.pivot.z) * 0.2 + fz * 0.04);

      // Default head: looking a metre past the ball, ball low in the frame.
      const lx = st.ball[0] + fx * 1.0 - st.pivot.x, lz = st.ball[1] + fz * 1.0 - st.pivot.z;
      st.defYaw = U.wrap(U.angleOf(lx, lz) - st.stanceYaw);
      const hb = Math.hypot(st.ball[0] - st.pivot.x, st.ball[1] - st.pivot.z);
      const dep = Math.atan2(st.eyeHeight - C.ball.radius, hb);
      st.defPitch = -(dep - 0.24 * P.fovDeg * DEG);
      resetView(true);
    }

    function resetView(snap) {
      st.tYaw = st.defYaw;
      st.tPitch = st.defPitch;
      if (snap) {
        st.yaw = st.tYaw;
        st.pitch = st.tPitch;
      }
    }

    function look(dYaw, dPitch) {
      const lim = P.maxLookYawDeg * DEG;
      st.tYaw = U.clamp(st.tYaw + dYaw, -lim, lim);
      st.tPitch = U.clamp(st.tPitch + dPitch, P.minPitchDeg * DEG, P.maxPitchDeg * DEG);
    }

    // Post-shot: crouch behind the ball on the true line.
    function behindLine(start, idealYaw, holeDist) {
      st.behind = { start, idealYaw };
      st.tYaw = 0;
      st.tPitch = -Math.atan2(0.75, holeDist + 1.3) - 2 * DEG;
      st.yaw = st.tYaw;
      st.pitch = st.tPitch;
    }
    function leaveBehind() {
      st.behind = null;
      resetView(true);
    }

    const _look = new THREE.Vector3(), _up = new THREE.Vector3(), _eye = new THREE.Vector3();
    function update(dt, t) {
      const k = 1 - Math.exp(-dt * 16);
      st.yaw += (st.tYaw - st.yaw) * k;
      st.pitch += (st.tPitch - st.pitch) * k;
      let baseYaw, pivot;
      if (st.behind) {
        baseYaw = st.behind.idealYaw;
        const s = st.behind.start;
        pivot = _eye.set(s[0] - U.dirX(baseYaw) * 1.3, 0.78, s[1] - U.dirZ(baseYaw) * 1.3);
      } else {
        baseYaw = st.stanceYaw;
        pivot = _eye.copy(st.pivot);
        // Very small postural sway, as a standing body never holds perfectly still.
        pivot.x += Math.sin(t * 0.9) * 0.0012;
        pivot.y += Math.sin(t * 1.4 + 1) * 0.0008;
        pivot.z += Math.cos(t * 0.7) * 0.0012;
      }
      const yaw = baseYaw + st.yaw, cp = Math.cos(st.pitch);
      _look.set(Math.sin(yaw) * cp, Math.sin(st.pitch), -Math.cos(yaw) * cp);
      // head-up vector (perpendicular to look, in the vertical plane)
      _up.set(-Math.sin(yaw) * Math.sin(st.pitch), cp, Math.cos(yaw) * Math.sin(st.pitch));
      const n = P.neckToEye;
      camera.position.copy(pivot).addScaledVector(_up, n[1]).addScaledVector(_look, -n[2]);
      camera.up.set(0, 1, 0);
      camera.lookAt(camera.position.x + _look.x, camera.position.y + _look.y, camera.position.z + _look.z);
    }

    return { st, shoulders, handsBase, setStance, resetView, look, behindLine, leaveBehind, update };
  };
})(typeof window !== 'undefined' ? window : globalThis);

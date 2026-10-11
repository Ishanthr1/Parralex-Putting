(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});
  const cfg = PP.cfg, u = PP.util;
  const D2R = u.d2r;

  PP.makeGolfer = function (camera) {
    const gp = cfg.golfer;
    const me = {
       ball: [0, 0],
      stanceYaw: 0,
      eyeSide: -1,
      eyeY: gp.eyeY,
     pivot: new THREE.Vector3(),
       yaw: 0,
      pitch: gp.restPitch * D2R,
      tYaw: 0,
      tPitch: gp.restPitch * D2R,
      defYaw: 0,
      defPitch: 0,
      behind: null,
     sway: 0
    };
    const shoulders = [new THREE.Vector3(), new THREE.Vector3()];
    const handsBase = new THREE.Vector3();

     function setUp(L, settings, lie, aimYaw, smooth) {
      const at = lie || L.ball;
      const prev = me.pivot.clone();
      me.ball = [at[0], at[1]];
      me.baseY = (L.terrain || PP.terrain.flat).y(at[0], at[1]);
      me.stanceYaw = aimYaw != null ? aimYaw : L.stanceYaw;
      me.eyeSide = settings.leftHanded ? 1 : -1;
      me.eyeY = (settings.eyeY || gp.eyeY) + me.baseY;
      me.behind = null;
       const fx = u.dirX(me.stanceYaw), fz = u.dirZ(me.stanceYaw);
      const rx = u.rightX(me.stanceYaw), rz = u.rightZ(me.stanceYaw);
      const side = me.eyeSide * gp.eyeOff;
      me.pivot.set(me.ball[0] - fx * gp.eyeBack + rx * side, me.eyeY, me.ball[1] - fz * gp.eyeBack + rz * side);

      const sx = me.pivot.x - rx * side * 0.12, sz = me.pivot.z - rz * side * 0.12, sy = me.eyeY - 0.3;
      shoulders[0].set(sx + fx * 0.18, sy, sz + fz * 0.18);
     shoulders[1].set(sx - fx * 0.18, sy, sz - fz * 0.18);
      handsBase.set(me.pivot.x + (me.ball[0] - me.pivot.x) * 0.2 + fx * 0.04, me.baseY + 0.8, me.pivot.z + (me.ball[1] - me.pivot.z) * 0.2 + fz * 0.04);

       const lx = me.ball[0] + fx * 1.0 - me.pivot.x, lz = me.ball[1] + fz * 1.0 - me.pivot.z;
      me.defYaw = u.wrap(u.angleOf(lx, lz) - me.stanceYaw);
     const hb = Math.hypot(me.ball[0] - me.pivot.x, me.ball[1] - me.pivot.z);
      const dep = Math.atan2(me.eyeY - cfg.ball.r, hb);
      me.defPitch = -(dep - 0.24 * gp.fov * D2R);
      recentre(true);
      if (smooth) {
        me.from = prev;
        me.blend = 1;
      } else {
        me.from = null;
        me.blend = 0;
      }
    }


    function recentre(snap) {
      me.tYaw = me.defYaw;
      me.tPitch = me.defPitch;
      if (snap) {
        me.yaw = me.tYaw;
        me.pitch = me.tPitch;
      }
     }


    function look(dYaw, dPitch) {
      const lim = gp.yawLimit * D2R;
      me.tYaw = u.clamp(me.tYaw + dYaw, -lim, lim);
      me.tPitch = u.clamp(me.tPitch + dPitch, gp.pitchMin * D2R, gp.pitchMax * D2R);
    }

    function goBehind(start, idealYaw, holeDist) {
      me.behind = { start, idealYaw };
      me.tYaw = 0;
      me.tPitch = -Math.atan2(0.75, holeDist + 1.3) - 2 * D2R;
      me.yaw = me.tYaw;
      me.pitch = me.tPitch;
     }
    function comeBack() {
      me.behind = null;
      recentre(true);
    }
    const _look = new THREE.Vector3(), _up = new THREE.Vector3(), _eye = new THREE.Vector3();
    function update(dt, t) {
      const k = 1 - Math.exp(-dt * 16);
      me.yaw += (me.tYaw - me.yaw) * k;
      me.pitch += (me.tPitch - me.pitch) * k;
      let baseYaw, pivot;
      if (me.behind) {
         baseYaw = me.behind.idealYaw;
         const s = me.behind.start;
        pivot = _eye.set(s[0] - u.dirX(baseYaw) * 1.3, me.baseY + 0.78, s[1] - u.dirZ(baseYaw) * 1.3);
      } else {
        baseYaw = me.stanceYaw;
        pivot = _eye.copy(me.pivot);
        pivot.x += Math.sin(t * 0.9) * 0.0012;
        pivot.y += Math.sin(t * 1.4 + 1) * 0.0008;
       pivot.z += Math.cos(t * 0.7) * 0.0012;
     }
      if (me.blend > 0 && me.from) {
        me.blend = Math.max(0, me.blend - dt / (cfg.play.walkMs / 1000));
        const e = me.blend * me.blend * (3 - 2 * me.blend);
        pivot.lerp(me.from, e);
      }
      const yaw = baseYaw + me.yaw, cp = Math.cos(me.pitch);
      _look.set(Math.sin(yaw) * cp, Math.sin(me.pitch), -Math.cos(yaw) * cp);
      _up.set(-Math.sin(yaw) * Math.sin(me.pitch), cp, Math.cos(yaw) * Math.sin(me.pitch));
      const n = gp.neckToEye;
      camera.position.copy(pivot).addScaledVector(_up, n[1]).addScaledVector(_look, -n[2]);
      camera.up.set(0, 1, 0);
      camera.lookAt(camera.position.x + _look.x, camera.position.y + _look.y, camera.position.z + _look.z);
    }
    return { me, shoulders, handsBase, setUp, recentre, look, goBehind, comeBack, update };
  };
})(typeof window !== 'undefined' ? window : globalThis);

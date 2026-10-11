(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});
  const u = PP.util, ph = PP.phys;
  const D2R = u.d2r;

  function grade(L, shot) {
    const world = L.world;
     const target = { x: L.hole[0], z: L.hole[1] };
    const D = Math.hypot(L.hole[0], L.hole[1]);

    let pick = L.lines[0], bestGap = Infinity;
    for (const c of L.lines) {
       const g = Math.abs(u.wrap(shot.launchYaw - c.angle));
      if (g < bestGap) {
        bestGap = g;
        pick = c;
      }
    }
    let ideal = pick.angle;
    let refSpeed = pick.kind === 'direct' ? ph.speedFor(D + 0.3) : pick.speedRef;
    if (pick.kind === 'bank') {
      const r = ph.tuneAngle(world, 0, 0, target, pick.angle, shot.speed, 4 * D2R, 0.25 * D2R);
      if (r.minDist < 0.8 * L.cupR) {
        ideal = r.angle;
        refSpeed = shot.speed;
       }
    }
    const ip = ph.runLine(world, 0, 0, ideal, refSpeed, { record: true, target });
    const idealPath = ip.points.slice(0, ip.minIdx + 1);
    idealPath.push([target.x, target.z]);
    const approach = pick.kind === 'direct' ? u.angleOf(target.x, target.z) : u.angleOf(ip.minVel[0], ip.minVel[1]);

    const ox = shot.final[0] - target.x, oz = shot.final[1] - target.z;
    const along = ox * u.dirX(approach) + oz * u.dirZ(approach);
    const lateral = ox * u.rightX(approach) + oz * u.rightZ(approach);


    const res = {
      kind: L.kind,
      label: L.label,
      lineKind: pick.kind,
      idealYaw: ideal,
      idealPath,
      puttLength: D,
       alignDeg: u.wrap(shot.faceYaw - ideal) / D2R,
      startDeg: u.wrap(shot.launchYaw - ideal) / D2R,
      stanceDeg: u.wrap(L.stanceYaw - ideal) / D2R,
      holed: !!shot.holed,
      lipped: !shot.holed && !!shot.rimTouched,
      lateral: shot.holed ? 0 : lateral,
      along: shot.holed ? 0 : along,
      finalDist: shot.holed ? 0 : Math.hypot(ox, oz),
      finishDeg: null,
      speed: shot.speed
    };
    if (pick.kind === 'direct' && !shot.holed && Math.hypot(shot.final[0], shot.final[1]) > 0.05) {
      res.finishDeg = u.wrap(u.angleOf(shot.final[0], shot.final[1]) - u.angleOf(target.x, target.z)) / D2R;
    }
     return res;
  }
   const side = (v) => (v < 0 ? 'left' : 'right');
  function degTxt(v, digits) {
   const a = Math.abs(v);
   if (a < 0.05) return '0.0°';
    return a.toFixed(digits == null ? 1 : digits) + '° ' + side(v);
  }
  function cmTxt(m) {
    const cm = Math.abs(m) * 100;
    return cm >= 100 ? (cm / 100).toFixed(2) + ' m' : Math.round(cm) + ' cm';
  }
  function rate(absDeg) {
    if (absDeg <= 1) return { text: 'Dead on', tone: 'good' };
     if (absDeg <= 2) return { text: 'Excellent', tone: 'good' };
     if (absDeg <= 5) return { text: 'Good', tone: 'ok' };
    if (absDeg <= 10) return { text: 'Off line', tone: 'warn' };
    return { text: 'Way off', tone: 'bad' };
   }

   PP.score = { grade, degTxt, cmTxt, rate, side };
})(typeof window !== 'undefined' ? window : globalThis);

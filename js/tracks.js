(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});

  function fromPts(pts, opts) {
    opts = opts || {};
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i-1], b = pts[i];
      cum.push(cum[i-1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    const n = pts.length;
    const ax = pts[1][0] - pts[0][0], az = pts[1][2] - pts[0][2];
    const al = Math.hypot(ax, az) || 1;
    const bx = pts[n-1][0] - pts[n-2][0], bz = pts[n-1][2] - pts[n-2][2];
    const bl = Math.hypot(bx, bz) || 1;
    return Object.assign({
      kind: 'tube',
      pts,
      cum,
      len: cum[n-1],
      inDir: [ax/al, az/al],
      outDir: [bx/bl, bz/bl],
      entry: pts[0],
      exit: pts[n-1],
      mouth: PP.cfg.pipe.mouth,
      minV: 0
    }, opts);
  }

  function tube(a, b, opts) {
    opts = opts || {};
    const lift = opts.lift || 0;
    const sag = opts.sag || 0;
    const steps = opts.steps || 14;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[2] + (b[2] - a[2]) * t;
      const base = a[1] + (b[1] - a[1]) * t;
      pts.push([x, base + lift - sag * Math.sin(Math.PI * t), z]);
    }
    return fromPts(pts, Object.assign({ kind: 'tube', style: 'pipe' }, opts));
  }

  function bend(a, b, ctrl, opts) {
    opts = opts || {};
    const steps = opts.steps || 20;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, m = 1 - t;
      pts.push([
        m*m*a[0] + 2*m*t*ctrl[0] + t*t*b[0],
        m*m*a[1] + 2*m*t*ctrl[1] + t*t*b[1],
        m*m*a[2] + 2*m*t*ctrl[2] + t*t*b[2]
      ]);
    }
    return fromPts(pts, Object.assign({ kind: 'tube', style: 'pipe' }, opts));
  }

  function loop(x, y, z, dir, R, opts) {
    opts = opts || {};
    const drift = opts.drift != null ? opts.drift : R * 1.15;
    const steps = opts.steps || 48;
    const fx = Math.sin(dir), fz = -Math.cos(dir);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      const along = R * Math.sin(th) + (drift * th) / (Math.PI * 2);
      const up = R * (1 - Math.cos(th));
      pts.push([x + fx * along, y + up, z + fz * along]);
    }
    const t = fromPts(pts, Object.assign({ kind: 'loop', style: 'loop', R }, opts));
    t.minV = Math.sqrt((10/7) * PP.cfg.g * (2 * R)) * 1.04;
    t.inDir = [fx, fz];
    t.outDir = [fx, fz];
    return t;
  }

  function posAt(tr, s, out) {
    const cum = tr.cum, pts = tr.pts;
    if (s <= 0) {
      out[0] = pts[0][0]; out[1] = pts[0][1]; out[2] = pts[0][2];
      return 0;
    }
    const last = pts.length - 1;
    if (s >= tr.len) {
      out[0] = pts[last][0]; out[1] = pts[last][1]; out[2] = pts[last][2];
      return 0;
    }
    let lo = 0, hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid; else hi = mid;
    }
    const segLen = cum[hi] - cum[lo] || 1;
    const t = (s - cum[lo]) / segLen;
    const a = pts[lo], b = pts[hi];
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return (b[1] - a[1]) / segLen;
  }

  function tangent(tr, s, out) {
    const eps = 0.02;
    const p0 = [0,0,0], p1 = [0,0,0];
    posAt(tr, Math.max(0, s - eps), p0);
    posAt(tr, Math.min(tr.len, s + eps), p1);
    const dx = p1[0] - p0[0], dz = p1[2] - p0[2];
    const l = Math.hypot(dx, dz) || 1;
    out[0] = dx / l;
    out[1] = dz / l;
    return out;
  }

  function tryEnter(b, list) {
    if (!list || !list.length || b.trackCool > 0) return null;
    const sp = Math.hypot(b.vx, b.vz);
    if (sp < 0.25) return null;
    const ux = b.vx / sp, uz = b.vz / sp;
    for (let i = 0; i < list.length; i++) {
      const tr = list[i];
      const e = tr.entry;
      if (Math.abs(b.y - e[1]) > 0.14) continue;
      const dx = b.x - e[0], dz = b.z - e[2];
      if (dx*dx + dz*dz > tr.mouth * tr.mouth) continue;
      if (ux * tr.inDir[0] + uz * tr.inDir[1] < 0.35) continue;
      return { tr, v: sp };
    }
    return null;
  }

  PP.tracks = { fromPts, tube, bend, loop, posAt, tangent, tryEnter };
})(typeof window !== 'undefined' ? window : globalThis);

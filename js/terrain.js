(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});

  const ss = (t) => t*t*(3 - 2*t);
  const dss = (t) => 6*t*(1 - t);
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

  const FLAT = {
    flat: true,
    feats: [],
    zones: [],
    probe(x, z, o) {
      o.y = 0;
      o.gx = 0;
      o.gz = 0;
      return o;
    },
    y: () => 0,
    zoneAt: () => null
  };

  function prep(f) {
    const g = Object.assign({}, f);
    if (f.dir != null) {
      g.fx = Math.sin(f.dir);
      g.fz = -Math.cos(f.dir);
      g.rx = Math.cos(f.dir);
      g.rz = Math.sin(f.dir);
    }
    if (f.kind === 'ramp') {
      g.inW = (f.halfW || 1) * 0.62;
      g.edge = Math.max(1e-4, (f.halfW || 1) - g.inW);
    }
    return g;
  }

  function make(feats, zones) {
    feats = (feats || []).map(prep);
    zones = zones || [];
    if (!feats.length && !zones.length) return FLAT;

    function probe(x, z, o) {
      let y = 0, gx = 0, gz = 0;
      for (let i = 0; i < feats.length; i++) {
        const f = feats[i];
        if (f.kind === 'mound' || f.kind === 'dip') {
          const dx = x - f.x, dz = z - f.z;
          const d2 = dx*dx + dz*dz;
          const r = f.r;
          if (d2 >= r*r) continue;
          const d = Math.sqrt(d2);
          const a = Math.PI * d / r;
          const amp = (f.kind === 'dip' ? -f.depth : f.h) * 0.5;
          y += amp * (1 + Math.cos(a));
          if (d > 1e-6) {
            const k = (-amp * Math.PI / r) * Math.sin(a) / d;
            gx += k * dx;
            gz += k * dz;
          }
        } else if (f.kind === 'ramp') {
          const dx = x - f.x, dz = z - f.z;
          const a = dx * f.fx + dz * f.fz;
          const b = dx * f.rx + dz * f.rz;
          const ab = Math.abs(b);
          if (ab >= f.halfW) continue;
          let w = 1, dwd = 0;
          if (ab > f.inW) {
            const q = (f.halfW - ab) / f.edge;
            w = ss(q);
            dwd = -dss(q) / f.edge;
          }
          const half = f.len / 2;
          let t, dtda;
          if (a <= -half) { t = 0; dtda = 0; }
          else if (a >= half) { t = 1; dtda = 0; }
          else { t = (a + half) / f.len; dtda = 1 / f.len; }
          const prof = ss(t);
          y += f.rise * prof * w;
          const dha = f.rise * dss(t) * dtda * w;
          const dhb = f.rise * prof * dwd * (b < 0 ? -1 : 1);
          gx += dha * f.fx + dhb * f.rx;
          gz += dha * f.fz + dhb * f.rz;
        } else if (f.kind === 'shelf') {
          const dx = x - f.x, dz = z - f.z;
          const d2 = dx*dx + dz*dz;
          if (d2 >= f.r*f.r) continue;
          const d = Math.sqrt(d2);
          const q = clamp01((f.r - d) / Math.max(1e-4, f.r - f.flatR));
          y += f.rise * ss(q);
          if (d > 1e-6 && d > f.flatR) {
            const k = (-f.rise * dss(q) / Math.max(1e-4, f.r - f.flatR)) / d;
            gx += k * dx;
            gz += k * dz;
          }
        }
      }
      o.y = y;
      o.gx = gx;
      o.gz = gz;
      return o;
    }

    const scratch = { y: 0, gx: 0, gz: 0 };
    function y(x, z) {
      return probe(x, z, scratch).y;
    }

    function zoneAt(x, z) {
      let hit = null;
      for (let i = 0; i < zones.length; i++) {
        const q = zones[i];
        const dx = x - q.x, dz = z - q.z;
        if (q.r2 != null) {
          const a = dx * q.fx + dz * q.fz, b = dx * q.rx + dz * q.rz;
          if (Math.abs(a) > q.r || Math.abs(b) > q.r2) continue;
        } else if (dx*dx + dz*dz >= q.r*q.r) continue;
        if (!hit || (q.rank || 0) > (hit.rank || 0)) hit = q;
      }
      return hit;
    }

    return { flat: false, feats, zones, probe, y, zoneAt };
  }

  function zone(kind, x, z, r, opts) {
    const rank = kind === 'sand' ? 3 : kind === 'rough' ? 2 : 1;
    const q = Object.assign({ kind, x, z, r, rank }, opts || {});
    const rot = q.rot || 0;
    q.fx = Math.sin(rot);
    q.fz = -Math.cos(rot);
    q.rx = Math.cos(rot);
    q.rz = Math.sin(rot);
    return q;
  }

  PP.terrain = { make, flat: FLAT, zone };
})(typeof window !== 'undefined' ? window : globalThis);

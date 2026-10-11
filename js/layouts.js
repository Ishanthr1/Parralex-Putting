(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});
  const u = PP.util, T = PP.terrain, TR = PP.tracks;
  const D2R = u.d2r;

  function resample(path, ds) {
    const out = [path[0]];
    for (let i = 1; i < path.length; i++) {
      const a = path[i-1], b = path[i];
      const l = Math.hypot(b[0]-a[0], b[1]-a[1]);
      const n = Math.max(1, Math.round(l / ds));
      for (let k = 1; k <= n; k++) out.push([a[0] + (b[0]-a[0])*k/n, a[1] + (b[1]-a[1])*k/n]);
    }
    return out;
  }

  function offsets(path, hw) {
    const n = path.length;
    const span = (() => {
      let t = 0;
      const acc = [0];
      for (let i = 1; i < n; i++) { t += Math.hypot(path[i][0]-path[i-1][0], path[i][1]-path[i-1][1]); acc.push(t); }
      return { acc, total: t || 1 };
    })();
    const wAt = (i) => {
      if (!Array.isArray(hw)) return hw;
      const f = (span.acc[i] / span.total) * (hw.length - 1);
      const lo = Math.floor(f), hi = Math.min(hw.length - 1, lo + 1);
      return hw[lo] + (hw[hi] - hw[lo]) * (f - lo);
    };
    const en = [];
    for (let i = 0; i < n - 1; i++) {
      const ex = path[i+1][0] - path[i][0], ez = path[i+1][1] - path[i][1];
      const l = Math.hypot(ex, ez) || 1;
      en.push([-ez/l, ex/l]);
    }
    const dirAt = (i, j) => {
      const dx = path[j][0] - path[i][0], dz = path[j][1] - path[i][1];
      const l = Math.hypot(dx, dz) || 1;
      return [dx/l, dz/l];
    };
    const head = dirAt(0, 1), tail = dirAt(n-2, n-1);
    const ext = 0.45;
    const side = (sgn) => {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = en[Math.max(0, i - 1)], b = en[Math.min(en.length - 1, i)];
        const d = 1 + a[0]*b[0] + a[1]*b[1];
        const k = (sgn * wAt(i)) / (d > 0.25 ? d : 0.25);
        let px = path[i][0] + (a[0] + b[0]) * k;
        let pz = path[i][1] + (a[1] + b[1]) * k;
        if (i === 0) { px -= head[0] * ext; pz -= head[1] * ext; }
        else if (i === n - 1) { px += tail[0] * ext; pz += tail[1] * ext; }
        pts.push([px, pz]);
      }
      return pts;
    };
    return { left: side(1), right: side(-1) };
  }

  function chains(path, hw, ds) {
    const o = offsets(path, hw);
    const n = o.left.length;
    const L = [], R = [];
    for (let i = 0; i < n - 1; i++) {
      const dl = Math.hypot(o.left[i+1][0] - o.left[i][0], o.left[i+1][1] - o.left[i][1]);
      const dr = Math.hypot(o.right[i+1][0] - o.right[i][0], o.right[i+1][1] - o.right[i][1]);
      const k = Math.max(1, Math.round(Math.max(dl, dr) / ds));
      for (let j = 0; j < k; j++) {
        const t = j / k;
        L.push([o.left[i][0] + (o.left[i+1][0] - o.left[i][0]) * t, o.left[i][1] + (o.left[i+1][1] - o.left[i][1]) * t]);
        R.push([o.right[i][0] + (o.right[i+1][0] - o.right[i][0]) * t, o.right[i][1] + (o.right[i+1][1] - o.right[i][1]) * t]);
      }
    }
    L.push(o.left[n-1].slice());
    R.push(o.right[n-1].slice());
    return { left: L, right: R };
  }

  function fairway(path, hw) {
    const o = offsets(path, hw);
    const r = o.right.slice();
    r.reverse();
    return o.left.concat(r);
  }

  const step = (x, z, dir, len, halfW, rise) => ({ kind: 'ramp', x, z, dir, len, halfW, rise });
  const bump = (x, z, r, h) => ({ kind: 'mound', x, z, r, h });
  const pit  = (x, z, r, depth) => ({ kind: 'dip', x, z, r, depth });
  const pad  = (x, z, r, flatR, rise) => ({ kind: 'shelf', x, z, r, flatR, rise });

  const HOLES = [
    {
      name: 'The Opener',
      par: 2,
      blurb: 'A gentle double bend. Nothing hidden, nothing steep.',
      path: [[0,0],[0,-4.2],[1.1,-7.4],[1.1,-11.2]],
      hw: 0.62,
      cup: [1.1, -10.6],
      feats: [bump(-0.9, -6.0, 1.5, 0.16)],
      zones: [],
      props: [{ type:'rock', x:-1.9, z:-6.4, r:0.3 }, { type:'pine', x:3.0, z:-9.0, h:3.2 }]
    },
    {
      name: 'Rolling Hills',
      par: 3,
      blurb: 'Over the crest, down into the hollow, then up to the cup.',
      path: [[0,0],[0,-15.5]],
      hw: 0.66,
      cup: [0, -14.6],
      feats: [
        step(0, -3.4, 0, 2.2, 1.1, 0.42),
        step(0, -6.6, 0, 2.4, 1.1, -0.58),
        step(0, -10.4, 0, 2.6, 1.1, 0.34),
        pad(0, -14.6, 1.5, 0.8, 0)
      ],
      zones: [],
      props: [{ type:'pine', x:-2.9, z:-5.0, h:4.0 }, { type:'pine', x:3.0, z:-12.4, h:3.4 }]
    },
    {
      name: 'Horseshoe',
      par: 4,
      blurb: 'Round the wall and back up. Two cushions if you play it right.',
      path: [[0,0],[0,-6.6],[3.0,-6.6],[3.0,-1.5]],
      hw: 0.66,
      cup: [3.0, -2.3],
      feats: [bump(1.5, -5.4, 1.0, 0.08)],
      zones: [],
      props: [{ type:'rock', x:1.5, z:-4.2, r:0.5 }, { type:'rock', x:1.5, z:-3.1, r:0.32 }]
    },
    {
      name: 'Sand Trap',
      par: 3,
      blurb: 'Two bunkers guard a raised green. Long is safer than short.',
      path: [[0,0],[0,-6.4],[1.6,-10.2],[1.6,-13.9]],
      hw: [0.74, 0.82, 1.16, 1.28],
      cup: [1.6, -13.1],
      feats: [
        step(1.6, -11.3, 0, 1.3, 1.5, 0.18),
        pit(0.92, -12.3, 0.46, 0.075),
        pit(2.3, -12.7, 0.46, 0.075),
        pad(1.6, -13.1, 1.0, 0.55, 0)
      ],
      zones: [T.zone('sand', 0.92, -12.3, 0.46), T.zone('sand', 2.3, -12.7, 0.46)],
      props: [{ type:'pine', x:-2.4, z:-9.0, h:3.6 }]
    },
    {
      name: 'The Tunnel',
      par: 2,
      blurb: 'Through the stonework is short. Around it is not.',
      path: [[0,0],[0,-12.4]],
      hw: 0.82,
      cup: [0, -11.5],
      feats: [],
      zones: [T.zone('rough', -0.95, -6.2, 0.5), T.zone('rough', 0.95, -6.2, 0.5)],
      obstacles: [
        { type:'box', x:0, z:-6.2, w:1.05, d:0.75, rot:0, h:0.62, style:'stone' }
      ],
      tracks: () => [TR.tube([0, 0, -5.78], [0, 0, -6.62], { lift: 0.0, mouth: 0.12, steps: 6 })],
      props: [{ type:'rock', x:-2.1, z:-6.2, r:0.4 }, { type:'rock', x:2.1, z:-6.2, r:0.4 }]
    },
    {
      name: 'Loop the Loop',
      par: 3,
      blurb: 'The loop is the only way through. Hit it firm or it comes back at you.',
      path: [[0,0],[0,-10.4]],
      hw: 0.7,
      cup: [0, -9.5],
      feats: [],
      zones: [],
      obstacles: [
        { type:'box', x:-0.45, z:-4.02, w:0.64, d:0.2, rot:0, h:0.4, style:'stone' },
        { type:'box', x:0.45, z:-4.02, w:0.64, d:0.2, rot:0, h:0.4, style:'stone' }
      ],
      tracks: () => [TR.loop(0, 0, -4.25, 0, 0.29, { drift: 0.56, mouth: 0.13 })],
      props: [{ type:'pine', x:-2.8, z:-7.5, h:3.8 }, { type:'pine', x:2.8, z:-2.5, h:3.0 }]
    },
    {
      name: 'Switchback',
      par: 4,
      blurb: 'Two legs and a long climb. Pace matters more than line.',
      path: [[0,0],[0,-6.8],[3.6,-6.8],[3.6,-15.0]],
      hw: 0.62,
      cup: [3.6, -14.2],
      feats: [
        step(3.6, -9.5, 0, 2.6, 1.1, 0.55),
        bump(2.9, -12.4, 1.3, 0.18),
        pad(3.6, -14.2, 1.3, 0.7, 0)
      ],
      zones: [T.zone('rough', 1.8, -5.9, 0.45)],
      props: [{ type:'rock', x:1.8, z:-4.6, r:0.5 }, { type:'pine', x:5.4, z:-11.0, h:4.2 }]
    },
    {
      name: 'The Causeway',
      par: 3,
      blurb: 'A narrow crossing with a long drop either side.',
      path: [[0,0],[0,-4.6],[0,-9.4],[0,-14.2]],
      hw: [0.72, 0.34, 0.34, 0.8],
      cup: [0, -13.4],
      feats: [pad(0, -13.4, 1.4, 0.8, 0)],
      zones: [],
      props: [
        { type:'water', x:0, z:-7.0, w:11, d:7.2 },
        { type:'pine', x:-4.2, z:-13.0, h:4.4 },
        { type:'pine', x:4.0, z:-12.0, h:3.6 }
      ]
    }
  ];

  function make(i) {
    const H = HOLES[((i % HOLES.length) + HOLES.length) % HOLES.length];
    const boundary = fairway(H.path, H.hw);
    const terrain = T.make(H.feats || [], H.zones || []);
    const tee = H.path[0];
    const L = {
      index: i,
      name: H.name,
      par: H.par,
      blurb: H.blurb,
      boundary,
      obstacles: H.obstacles || [],
      terrain,
      tracks: H.tracks ? H.tracks() : null,
      props: H.props || [],
      path: H.path,
      hw: H.hw,
      ball: [tee[0], tee[1]],
      tee: [tee[0], tee[1]],
      hole: [H.cup[0], H.cup[1]],
      cupR: 0.054,
      cues: 'full',
      kind: 'course',
      label: H.name,
      mode: 'course'
    };
    const a = H.path[1];
    L.laneYaw = u.angleOf(a[0] - tee[0], a[1] - tee[1]);
    L.stanceYaw = L.laneYaw;
    L.clubStart = L.laneYaw;
    L.world = PP.phys.makeWorld(L, L.cupR);
    L.length = (() => {
      let d = 0;
      for (let k = 1; k < H.path.length; k++) d += Math.hypot(H.path[k][0]-H.path[k-1][0], H.path[k][1]-H.path[k-1][1]);
      return d;
    })();
    return L;
  }

  PP.layouts = { make, count: HOLES.length, defs: HOLES, fairway, offsets, resample, chains };
})(typeof window !== 'undefined' ? window : globalThis);

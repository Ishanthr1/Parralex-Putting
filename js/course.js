(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});
  const cfg = PP.cfg, u = PP.util, ph = PP.phys;
  const BR = ph.BR;
  const D2R = u.d2r;
  const EDGE = 0.16;

  function inPoly(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
     const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }

  function clearOf(world, x, z) {
     let m = Infinity;
    for (const s of world.segs) m = Math.min(m, u.ptSeg(x, z, s.ax, s.az, s.bx, s.bz).d);
    for (const p of world.posts) m = Math.min(m, Math.hypot(x - p.x, z - p.z) - p.r);
    return m;
  }

  function openLine(world, ax, az, bx, bz, gap, skipSeg) {
    const segs = world.segs;
    for (let i = 0; i < segs.length; i++) {
     if (i === skipSeg) continue;
      const s = segs[i];
      if (u.segSeg(ax, az, bx, bz, s.ax, s.az, s.bx, s.bz) < gap) return false;
    }
     for (const p of world.posts) {
      if (u.ptSeg(p.x, p.z, ax, az, bx, bz).d < p.r + gap) return false;
    }
     return true;
  }
  const rect = (x0, x1, zBack, zFront) => [
    [x0, zBack],
    [x1, zBack],
    [x1, zFront],
    [x0, zFront]
  ];
  function laneBox(rng, W, ball, hole) {
    const zBack = ball[1] + rng.range(0.45, 0.65);
    const zFront = hole[1] - rng.range(0.35, 0.9);
     return rect(-W/2, W/2, zBack, zFront);
  }

  function spread(rng, W, lat) {
    const lo = -W/2 + EDGE, hi = W/2 - EDGE;
    const xbMin = Math.max(lo, lo - lat), xbMax = Math.min(hi, hi - lat);
    if (xbMax < xbMin) return null;
    const xb = rng.range(xbMin, xbMax);
    return [xb, xb + lat];
   }
   const MAKE = {
    straight(rng, P) {
      const D = rng.range(P.dist[0], P.dist[1]);
      const W = rng.range(P.lane[0], P.lane[1]);
      const x0 = rng.range(-0.15, 0.15) * W;
      const ball = [x0, 0], hole = [x0 + rng.range(-0.02, 0.02), -D];
      return { boundary: laneBox(rng, W, ball, hole), obstacles: [], ball, hole };
    },

   slightLeft(rng, P) {
      return tilted(rng, P, -1);
    },
    slightRight(rng, P) {
      return tilted(rng, P, 1);
    },
    long(rng, P) {
      const lo = Math.max(4.5, P.dist[1] * 0.8), hi = Math.min(13, Math.max(lo + 0.5, P.dist[1] * 1.15));
      const D = rng.range(lo, hi);
      const lat = D * Math.tan(rng.range(-3, 3) * D2R);
      const W = Math.max(rng.range(P.lane[0], P.lane[1]), Math.abs(lat) + 2 * EDGE + 0.1);
      const xs = spread(rng, W, lat);
       if (!xs) return null;
     const ball = [xs[0], 0], hole = [xs[1], -D];
       return { boundary: laneBox(rng, W, ball, hole), obstacles: [], ball, hole };
    },

    short(rng, P) {
      const D = rng.range(0.6, 1.4);
      const lat = D * Math.tan(rng.range(-12, 12) * D2R);
      const W = Math.max(rng.range(P.lane[0], P.lane[1]), Math.abs(lat) + 2 * EDGE + 0.1);
     const xs = spread(rng, W, lat);
      if (!xs) return null;
      const ball = [xs[0], 0], hole = [xs[1], -D];
       return { boundary: laneBox(rng, W, ball, hole), obstacles: [], ball, hole };
    },
    obscured(rng, P, ctx) {
      const D = rng.range(Math.max(2.4, P.dist[0]), Math.max(3.2, Math.min(P.dist[1], 8)));
     const lat = D * Math.tan(rng.range(-5, 5) * D2R);
      const W = rng.range(1.1, 1.5);
      const xs = spread(rng, W, lat);
     if (!xs) return null;
       const ball = [xs[0], 0], hole = [xs[1], -D];
      const th = u.angleOf(hole[0] - ball[0], hole[1] - ball[1]);
      const dx = u.dirX(th), dz = u.dirZ(th), rx = u.rightX(th), rz = u.rightZ(th);
      const side = rng.chance(0.7) ? ctx.eyeSide : -ctx.eyeSide;
      const dAlong = rng.range(0.1, 0.22);
      const s = rng.range(dAlong/2 + ctx.cupR + 0.05, dAlong/2 + ctx.cupR + 0.3);
      const q = BR + rng.range(0.012, 0.03);
       const room = (side > 0 ? W/2 - hole[0] : hole[0] + W/2) - q - 0.03;
      const w = Math.min(rng.range(0.22, 0.42), room);
      if (w < 0.12) return null;
      const off = side * (q + w/2);
      const obstacles = [
        {
          type: 'box',
          x: hole[0] - dx * s + rx * off,
           z: hole[1] - dz * s + rz * off,
          w,
          d: dAlong,
          rot: th,
          h: rng.range(0.16, 0.32),
          style: 'stone'
        }
      ];
       if (rng.chance(P.cues === 'minimal' || P.dist[1] >= 8 ? 0.8 : 0.4)) {
        const pr = rng.range(0.035, 0.06);
        const s2 = rng.range(0.6, Math.min(1.3, D * 0.5));
        const q2 = -side * (BR + pr + rng.range(0.025, 0.07));
        obstacles.push({ type: 'post', x: hole[0] - dx * s2 + rx * q2, z: hole[1] - dz * s2 + rz * q2, r: pr, h: rng.range(0.25, 0.45), style: 'post' });
      }
      return { boundary: laneBox(rng, W, ball, hole), obstacles, ball, hole };
    },

    bank(rng, P, ctx) {
      return rng.chance(0.5) ? bankWall(rng, P) : bankCorner(rng, P, ctx);
   },

    awkward(rng, P) {
      const W = rng.range(1.8, 2.8);
      const side = rng.sign();
      const a = rng.range(15, 32) * D2R;
      let D = rng.range(Math.max(1.6, P.dist[0]), Math.max(2.5, P.dist[1]));
      D = Math.min(D, (W - 2 * EDGE - 0.05) / Math.tan(a));
      if (D < 1.2) return null;
      const xs = spread(rng, W, side * D * Math.tan(a));
      if (!xs) return null;
      const ball = [xs[0], 0], hole = [xs[1], -D];
      return { boundary: laneBox(rng, W, ball, hole), obstacles: [], ball, hole, stanceMode: 'lane' };
    },
     open(rng, P) {
      const N = 11, rx = rng.range(2.6, 4.2), rz = rng.range(4.8, 7.5);
      const boundary = [];
      for (let i = 0; i < N; i++) {
       const t = (i / N) * Math.PI * 2 + rng.range(-0.12, 0.12);
        const k = rng.range(0.85, 1.08);
        boundary.push([Math.cos(t) * rx * k, Math.sin(t) * rz * k]);
      }
      const ball = [rng.range(-0.35, 0.35) * rx, 0.62 * rz];
      if (!inPoly(ball[0], ball[1], boundary)) return null;
      for (let tries = 0; tries < 60; tries++) {
        const D = rng.range(Math.max(4, P.dist[0]), Math.min(12, P.dist[1]));
        const th = rng.range(-45, 45) * D2R;
        const hole = [ball[0] + u.dirX(th) * D, ball[1] + u.dirZ(th) * D];
        if (inPoly(hole[0], hole[1], boundary)) return { boundary, obstacles: [], ball, hole };
      }
      return null;
    }
  };


  function tilted(rng, P, sign) {
    const D = rng.range(Math.max(1.4, P.dist[0]), P.dist[1]);
    const lat = sign * D * Math.tan(rng.range(3, 10) * D2R);
    const W = Math.max(rng.range(P.lane[0], P.lane[1]), Math.abs(lat) + 2 * EDGE + 0.06);
    const xs = spread(rng, W, lat);
    if (!xs) return null;
     const ball = [xs[0], 0], hole = [xs[1], -D];
    return { boundary: laneBox(rng, W, ball, hole), obstacles: [], ball, hole };
  }

  function bankWall(rng, P) {
    const W = rng.range(0.95, 1.35);
    const D = rng.range(Math.max(2.4, P.dist[0]), Math.max(3.4, Math.min(P.dist[1], 7)));
    const side = rng.sign();
    const ball = [side * (W/2 - rng.range(0.17, 0.32)), 0];
    const hole = [side * (W/2 - rng.range(0.17, 0.32)), -D];
    const gap = rng.range(0.26, 0.38) * W;
    const bw = W - gap + 0.02;
    const bd = rng.range(0.12, 0.22);
    const obstacles = [
      { type: 'box', x: side * (W/2 + 0.01 - bw/2), z: -D * rng.range(0.42, 0.58), w: bw, d: bd, rot: 0, h: rng.range(0.11, 0.18), style: 'stone' }
    ];
    return { boundary: laneBox(rng, W, ball, hole), obstacles, ball, hole, variant: 'block' };
  }

  function bankCorner(rng, P, ctx) {
    const W = rng.range(0.85, 1.2);
    const L1 = rng.range(Math.max(1.8, P.dist[0] * 0.7), Math.max(2.6, Math.min(P.dist[1] * 0.75, 5)));
     const L2 = rng.range(1.8, 3.4);
    const turn = rng.sign();
    const zb = 0.5;
    const cham = rng.range(0.6, 0.95) * W;
    let boundary = [
     [-W/2, zb],
      [W/2, zb],
      [W/2, -L1],
      [W/2 + L2, -L1],
      [W/2 + L2, -L1 - W],
      [-W/2 + cham, -L1 - W],
      [-W/2, -L1 - W + cham]
     ];
    let ball = [rng.range(-0.25, 0.25) * W, 0];
    if (turn < 0) {
       boundary = boundary.map(([x, z]) => [-x, z]).reverse();
       ball = [-ball[0], ball[1]];
     }
    const world = ph.makeWorld({ boundary, obstacles: [] }, ctx.cupR);
    const A = [turn * (-W/2 + cham), -L1 - W], B = [turn * (-W/2), -L1 - W + cham];
    for (let tries = 0; tries < 10; tries++) {
      const uu = rng.range(0.2, 0.8);
      const aim = u.angleOf(A[0] + uu * (B[0] - A[0]) - ball[0], A[1] + uu * (B[1] - A[1]) - ball[1]);
      const speed = rng.range(2.3, 4.2);
      const sim = ph.runLine(world, ball[0], ball[1], aim, speed, { record: true });
      const pts = sim.points;
       const ok = [];
      for (let i = 1; i < pts.length; i++) {
        const [x, z] = pts[i];
        const v = Math.hypot(x - pts[i-1][0], z - pts[i-1][1]) / 0.01;
        if (turn * x < W/2 + 0.45 || v < 0.35 || v > 1.35) continue;
        if (!inPoly(x, z, boundary) || clearOf(world, x, z) < ctx.cupR + 0.06) continue;
        ok.push([x, z]);
      }
       if (!ok.length) continue;
      const hole = ok[Math.floor(rng.next() * ok.length)];
      return { boundary, obstacles: [], ball, hole, variant: 'dogleg', seeds: [{ angle: aim, speed }] };
     }
     return null;
  }

  function solveLines(layout, world, opts) {
   opts = opts || {};
    const [sx, sz] = layout.ball, [hx, hz] = layout.hole;
    const target = { x: hx, z: hz };
    const gap = BR + 0.004;
    const out = [];
    const D = Math.hypot(hx - sx, hz - sz);
    const directOpen = openLine(world, sx, sz, hx, hz, gap, -1);
    if (directOpen) out.push({ angle: u.angleOf(hx - sx, hz - sz), kind: 'direct', pathLen: D, minDist: 0 });
    if (!opts.banks) return { lines: out, directOpen };

     world.segs.forEach((s, i) => {
      const ex = s.bx - s.ax, ez = s.bz - s.az, len = Math.sqrt(s.len2);
      let nx = -ez / len, nz = ex / len;
      let db = (sx - s.ax) * nx + (sz - s.az) * nz;
      if (db < 0) {
        nx = -nx;
        nz = -nz;
        db = -db;
      }
      const dh = (hx - s.ax) * nx + (hz - s.az) * nz;
      if (db < BR + 0.02 || dh < BR + 0.02) return;
     const mx = hx - 2 * (dh - BR) * nx, mz = hz - 2 * (dh - BR) * nz;
      const den = (mx - sx) * nx + (mz - sz) * nz;
      if (Math.abs(den) < 1e-9) return;
      const t = (BR - db) / den;
      if (t <= 0 || t >= 1) return;
      const px = sx + t * (mx - sx), pz = sz + t * (mz - sz);
      const cx = px - nx * BR, cz = pz - nz * BR;
      const uu = ((cx - s.ax) * ex + (cz - s.az) * ez) / s.len2;
      if (uu < 0.02 || uu > 0.98) return;
      if (!openLine(world, sx, sz, px, pz, gap, i)) return;
      if (!openLine(world, px, pz, hx, hz, gap, i)) return;
      out.push({ angle: u.angleOf(mx - sx, mz - sz), kind: 'bank', pathLen: Math.hypot(mx - sx, mz - sz), seg: i });
    });

    for (const c of out) {
      if (c.kind !== 'bank') continue;
      c.speedRef = ph.speedFor(1.5 * c.pathLen + 0.6);
      const r = ph.tuneAngle(world, sx, sz, target, c.angle, c.speedRef, 10 * D2R, 0.5 * D2R);
      c.mirrorAngle = c.angle;
      c.angle = r.angle;
      c.minDist = r.minDist;
    }
    for (const sd of opts.seeds || []) {
     const r = ph.tuneAngle(world, sx, sz, target, sd.angle, sd.speed, 1.5 * D2R, 0.25 * D2R);
       out.push({ angle: r.angle, kind: 'bank', pathLen: ph.distOf(sd.speed) / 1.5, speedRef: sd.speed, minDist: r.minDist, seeded: true });
    }
     return {
      lines: out.filter((c) => c.kind === 'direct' || c.minDist < 0.3 * layout.cupR),
       directOpen
    };
  }

  function spin(raw, yaw) {
    const [bx, bz] = raw.ball;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const T = ([x, z]) => {
      const lx = x - bx, lz = z - bz;
      return [lx * c - lz * s, lx * s + lz * c];
    };
    return {
       boundary: raw.boundary.map(T),
      obstacles: (raw.obstacles || []).map((o) => {
        const [x, z] = T([o.x, o.z]);
        return Object.assign({}, o, { x, z, rot: (o.rot || 0) + yaw });
      }),
      ball: [0, 0],
      hole: T(raw.hole),
      laneYaw: yaw
    };
  }

  function build(opts) {
    const P = cfg.levels[opts.difficulty];
    const eyeSide = opts.eyeSide || -1;
    const rng = PP.rng(opts.seed);
    const cupR = P.cupR;
    let kind = opts.kind || rng.pick(P.kinds);
    for (let attempt = 0; attempt < 60; attempt++) {
      if (!opts.kind && attempt > 0 && attempt % 12 === 0) kind = rng.pick(P.kinds);
      const raw = MAKE[kind](rng, P, { eyeSide, cupR });
       if (!raw) continue;
      const L = spin(raw, rng.range(0, Math.PI * 2));
      Object.assign(L, {
        seed: opts.seed,
        kind,
        variant: raw.variant || null,
        difficulty: opts.difficulty,
        cupR,
        cues: P.cues,
        label: cfg.kindText[kind] + (raw.variant === 'dogleg' ? ' (dog-leg)' : '')
      });
       L.terrain = PP.terrain.flat;
      L.tracks = null;
      const world = ph.makeWorld(L, cupR);
       if (!inPoly(0, 0, L.boundary) || !inPoly(L.hole[0], L.hole[1], L.boundary)) continue;
      if (clearOf(world, 0, 0) < 0.12) continue;
      if (clearOf(world, L.hole[0], L.hole[1]) < cupR + 0.05) continue;

      const isBank = kind === 'bank';
      const seeds = (raw.seeds || []).map((sd) => ({ angle: sd.angle + L.laneYaw, speed: sd.speed }));
     const sol = solveLines(L, world, { banks: isBank, seeds });
      if (isBank && sol.directOpen) continue;
      const picks = sol.lines.filter((c) => (isBank ? c.kind === 'bank' : c.kind === 'direct'));
      if (!picks.length) continue;
      picks.sort((a, b) => (a.minDist || 0) - (b.minDist || 0) || a.pathLen - b.pathLen);
      L.lines = picks;
      L.ideal = picks[0].angle;
      L.idealKind = picks[0].kind;

      const off = rng.range(P.stanceOff[0], P.stanceOff[1]) * D2R * rng.sign();
      if (raw.stanceMode === 'lane') {
        L.stanceYaw = L.laneYaw + rng.range(-4, 4) * D2R;
      } else {
       L.stanceYaw = L.ideal + off;
      }
     L.clubStart = L.stanceYaw + rng.range(-7, 7) * D2R;
      L.world = world;
      return L;
     }
    return build(Object.assign({}, opts, { kind: 'straight', seed: opts.seed + 1 }));
  }

  const ROUND = ['straight', 'slightLeft', 'slightRight', 'long', 'short', 'obscured', 'bank', 'awkward'];
  const LVL_IX = { easy: 0, medium: 1, hard: 2, expert: 3 };

  function courseHole(index, difficulty, attempt, eyeSide) {
    const seed = 7919 * (index + 1) + 104729 * LVL_IX[difficulty] + 17;
    const L = build({ difficulty, seed, kind: ROUND[index], eyeSide });
    const jr = PP.rng(seed * 31 + attempt * 977);
    L.stanceYaw += jr.range(-2.5, 2.5) * D2R;
    L.clubStart = L.stanceYaw + jr.range(-7, 7) * D2R;
    return L;
  }

  PP.holes = {
    build,
    courseHole,
    ROUND_LEN: ROUND.length,
    solveLines,
    openLine,
    inPoly
  };
})(typeof window !== 'undefined' ? window : globalThis);

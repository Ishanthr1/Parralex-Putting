/*
 * course.js — layout generation for the eight training situations, the fixed
 * 8-hole course, and the hidden line solver.
 *
 * Every layout is built in a local frame where the lane runs toward −Z with
 * the ball near the origin, then moved so the ball sits at (0, 0) and spun by
 * a random yaw (so the sun and shadows never act as a fixed reference).
 *
 * Nothing in here is ever shown to the player before the shot. The solver's
 * answer (`layout.ideal`) is used only to place the stance with a deliberate
 * offset and to score the shot afterwards.
 */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});
  const C = MG.CONFIG, U = MG.Util, Ph = MG.Physics;
  const R = Ph.R_BALL;
  const DEG = U.DEG;
  const EDGE = 0.16; // minimum distance from a border for the ball and the hole centre

  // ---------------------------------------------------------------- geometry
  function pointInPoly(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }

  function minSegDist(world, x, z) {
    let m = Infinity;
    for (const s of world.segs) m = Math.min(m, U.pointSegDist(x, z, s.ax, s.az, s.bx, s.bz).d);
    for (const p of world.posts) m = Math.min(m, Math.hypot(x - p.x, z - p.z) - p.r);
    return m;
  }

  function lineClear(world, ax, az, bx, bz, clearance, skipSeg) {
    const segs = world.segs;
    for (let i = 0; i < segs.length; i++) {
      if (i === skipSeg) continue;
      const s = segs[i];
      if (U.segSegDist(ax, az, bx, bz, s.ax, s.az, s.bx, s.bz) < clearance) return false;
    }
    for (const p of world.posts) {
      if (U.pointSegDist(p.x, p.z, ax, az, bx, bz).d < p.r + clearance) return false;
    }
    return true;
  }

  const rect = (x0, x1, zBack, zFront) => [
    [x0, zBack],
    [x1, zBack],
    [x1, zFront],
    [x0, zFront]
  ];

  // A straight lane of width W containing ball and hole.
  function laneAround(rng, W, ball, hole) {
    const zBack = ball[1] + rng.range(0.45, 0.65);
    const zFront = hole[1] - rng.range(0.35, 0.9);
    return rect(-W / 2, W / 2, zBack, zFront);
  }

  // Place ball/hole across a lane of width W so that the lateral gap `lat`
  // (hole x − ball x) fits with EDGE margins. Returns [xBall, xHole] or null.
  function placeAcross(rng, W, lat) {
    const lo = -W / 2 + EDGE, hi = W / 2 - EDGE;
    const xbMin = Math.max(lo, lo - lat), xbMax = Math.min(hi, hi - lat);
    if (xbMax < xbMin) return null;
    const xb = rng.range(xbMin, xbMax);
    return [xb, xb + lat];
  }

  // ---------------------------------------------------------------- generators
  // Each returns a raw layout in the local frame (or null to retry).
  const GEN = {
    straight(rng, P) {
      const D = rng.range(P.dist[0], P.dist[1]);
      const W = rng.range(P.laneWidth[0], P.laneWidth[1]);
      const x0 = rng.range(-0.15, 0.15) * W;
      const ball = [x0, 0], hole = [x0 + rng.range(-0.02, 0.02), -D];
      return { boundary: laneAround(rng, W, ball, hole), obstacles: [], ball, hole };
    },

    slightLeft(rng, P) {
      return slight(rng, P, -1);
    },
    slightRight(rng, P) {
      return slight(rng, P, 1);
    },

    long(rng, P) {
      const lo = Math.max(4.5, P.dist[1] * 0.8), hi = Math.min(13, Math.max(lo + 0.5, P.dist[1] * 1.15));
      const D = rng.range(lo, hi);
      const lat = D * Math.tan(rng.range(-3, 3) * DEG);
      const W = Math.max(rng.range(P.laneWidth[0], P.laneWidth[1]), Math.abs(lat) + 2 * EDGE + 0.1);
      const xs = placeAcross(rng, W, lat);
      if (!xs) return null;
      const ball = [xs[0], 0], hole = [xs[1], -D];
      return { boundary: laneAround(rng, W, ball, hole), obstacles: [], ball, hole };
    },

    short(rng, P) {
      const D = rng.range(0.6, 1.4);
      const lat = D * Math.tan(rng.range(-12, 12) * DEG);
      const W = Math.max(rng.range(P.laneWidth[0], P.laneWidth[1]), Math.abs(lat) + 2 * EDGE + 0.1);
      const xs = placeAcross(rng, W, lat);
      if (!xs) return null;
      const ball = [xs[0], 0], hole = [xs[1], -D];
      return { boundary: laneAround(rng, W, ball, hole), obstacles: [], ball, hole };
    },

    obscured(rng, P, ctx) {
      const D = rng.range(Math.max(2.4, P.dist[0]), Math.max(3.2, Math.min(P.dist[1], 8)));
      const lat = D * Math.tan(rng.range(-5, 5) * DEG);
      const W = rng.range(1.1, 1.5);
      const xs = placeAcross(rng, W, lat);
      if (!xs) return null;
      const ball = [xs[0], 0], hole = [xs[1], -D];
      const th = U.angleOf(hole[0] - ball[0], hole[1] - ball[1]);
      const dx = U.dirX(th), dz = U.dirZ(th), rx = U.rightX(th), rz = U.rightZ(th);
      // The block sits just off the line, close to the hole, preferably on the
      // side the player's eyes are on so it eats into the view of the cup.
      const side = rng.chance(0.7) ? ctx.eyeSide : -ctx.eyeSide; // −1 = left of the line
      const dAlong = rng.range(0.1, 0.22);
      const s = rng.range(dAlong / 2 + ctx.holeR + 0.05, dAlong / 2 + ctx.holeR + 0.3);
      const q = R + rng.range(0.012, 0.03);
      const room = (side > 0 ? W / 2 - hole[0] : hole[0] + W / 2) - q - 0.03;
      const w = Math.min(rng.range(0.22, 0.42), room);
      if (w < 0.12) return null;
      const off = side * (q + w / 2);
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
        const q2 = -side * (R + pr + rng.range(0.025, 0.07));
        obstacles.push({ type: 'post', x: hole[0] - dx * s2 + rx * q2, z: hole[1] - dz * s2 + rz * q2, r: pr, h: rng.range(0.25, 0.45), style: 'post' });
      }
      return { boundary: laneAround(rng, W, ball, hole), obstacles, ball, hole };
    },

    bank(rng, P, ctx) {
      return rng.chance(0.5) ? bankBlock(rng, P) : bankDogleg(rng, P, ctx);
    },

    awkward(rng, P) {
      const W = rng.range(1.8, 2.8);
      const side = rng.sign();
      const a = rng.range(15, 32) * DEG;
      let D = rng.range(Math.max(1.6, P.dist[0]), Math.max(2.5, P.dist[1]));
      D = Math.min(D, (W - 2 * EDGE - 0.05) / Math.tan(a));
      if (D < 1.2) return null;
      const xs = placeAcross(rng, W, side * D * Math.tan(a));
      if (!xs) return null;
      const ball = [xs[0], 0], hole = [xs[1], -D];
      return { boundary: laneAround(rng, W, ball, hole), obstacles: [], ball, hole, stanceMode: 'lane' };
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
      if (!pointInPoly(ball[0], ball[1], boundary)) return null;
      for (let tries = 0; tries < 60; tries++) {
        const D = rng.range(Math.max(4, P.dist[0]), Math.min(12, P.dist[1]));
        const th = rng.range(-45, 45) * DEG;
        const hole = [ball[0] + U.dirX(th) * D, ball[1] + U.dirZ(th) * D];
        if (pointInPoly(hole[0], hole[1], boundary)) return { boundary, obstacles: [], ball, hole };
      }
      return null;
    }
  };

  function slight(rng, P, sign) {
    const D = rng.range(Math.max(1.4, P.dist[0]), P.dist[1]);
    const lat = sign * D * Math.tan(rng.range(3, 10) * DEG);
    const W = Math.max(rng.range(P.laneWidth[0], P.laneWidth[1]), Math.abs(lat) + 2 * EDGE + 0.06);
    const xs = placeAcross(rng, W, lat);
    if (!xs) return null;
    const ball = [xs[0], 0], hole = [xs[1], -D];
    return { boundary: laneAround(rng, W, ball, hole), obstacles: [], ball, hole };
  }

  // Bank variant A: a block across most of a straight lane hides the direct line.
  function bankBlock(rng, P) {
    const W = rng.range(0.95, 1.35);
    const D = rng.range(Math.max(2.4, P.dist[0]), Math.max(3.4, Math.min(P.dist[1], 7)));
    const side = rng.sign(); // the side the block is attached to
    const ball = [side * (W / 2 - rng.range(0.17, 0.32)), 0];
    const hole = [side * (W / 2 - rng.range(0.17, 0.32)), -D];
    const gap = rng.range(0.26, 0.38) * W;
    const bw = W - gap + 0.02; // slightly into the wall so no sliver shows
    const bd = rng.range(0.12, 0.22);
    const obstacles = [
      { type: 'box', x: side * (W / 2 + 0.01 - bw / 2), z: -D * rng.range(0.42, 0.58), w: bw, d: bd, rot: 0, h: rng.range(0.11, 0.18), style: 'stone' }
    ];
    return { boundary: laneAround(rng, W, ball, hole), obstacles, ball, hole, bankVariant: 'block' };
  }

  // Bank variant B: a 90° dog-leg with a chamfered outer corner; the cup is
  // round the corner and the 45° cushion is the way in. A rebounding ball keeps
  // most of its forward roll and curls afterwards, so instead of guessing a cup
  // position and hoping it is reachable, a real putt is simulated off the
  // cushion and the cup is placed on its path where the ball is still moving at
  // a holeable pace.
  function bankDogleg(rng, P, ctx) {
    const W = rng.range(0.85, 1.2);
    const L1 = rng.range(Math.max(1.8, P.dist[0] * 0.7), Math.max(2.6, Math.min(P.dist[1] * 0.75, 5)));
    const L2 = rng.range(1.8, 3.4);
    const turn = rng.sign();
    const zb = 0.5;
    const cham = rng.range(0.6, 0.95) * W; // 45° cushion across the outer corner
    let boundary = [
      [-W / 2, zb],
      [W / 2, zb],
      [W / 2, -L1],
      [W / 2 + L2, -L1],
      [W / 2 + L2, -L1 - W],
      [-W / 2 + cham, -L1 - W],
      [-W / 2, -L1 - W + cham]
    ];
    let ball = [rng.range(-0.25, 0.25) * W, 0];
    if (turn < 0) {
      boundary = boundary.map(([x, z]) => [-x, z]).reverse();
      ball = [-ball[0], ball[1]];
    }
    const world = Ph.buildWorld({ boundary, obstacles: [] }, ctx.holeR);
    const A = [turn * (-W / 2 + cham), -L1 - W], B = [turn * (-W / 2), -L1 - W + cham];
    for (let tries = 0; tries < 10; tries++) {
      const u = rng.range(0.2, 0.8);
      const aim = U.angleOf(A[0] + u * (B[0] - A[0]) - ball[0], A[1] + u * (B[1] - A[1]) - ball[1]);
      const speed = rng.range(2.3, 4.2);
      const sim = Ph.simulateLine(world, ball[0], ball[1], aim, speed, { record: true });
      const pts = sim.points;
      const ok = [];
      for (let i = 1; i < pts.length; i++) {
        const [x, z] = pts[i];
        const v = Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]) / 0.01;
        if (turn * x < W / 2 + 0.45 || v < 0.35 || v > 1.35) continue;
        if (!pointInPoly(x, z, boundary) || minSegDist(world, x, z) < ctx.holeR + 0.06) continue;
        ok.push([x, z]);
      }
      if (!ok.length) continue;
      const hole = ok[Math.floor(rng.next() * ok.length)];
      return { boundary, obstacles: [], ball, hole, bankVariant: 'dogleg', seeds: [{ angle: aim, speed }] };
    }
    return null;
  }

  // ---------------------------------------------------------------- solver
  // Candidate launch angles that would send the ball over the centre of the
  // cup: the direct line (if open) plus every single-cushion bank found by the
  // mirror method and then corrected with the real physics (restitution and
  // friction change the rebound angle, so the mirror line is only a guess).
  function solve(layout, world, opts) {
    opts = opts || {};
    const [sx, sz] = layout.ball, [hx, hz] = layout.hole;
    const target = { x: hx, z: hz };
    const clearance = R + 0.004;
    const out = [];
    const D = Math.hypot(hx - sx, hz - sz);
    const directOpen = lineClear(world, sx, sz, hx, hz, clearance, -1);
    if (directOpen) out.push({ angle: U.angleOf(hx - sx, hz - sz), kind: 'direct', pathLen: D, minDist: 0 });
    if (!opts.banks) return { candidates: out, directOpen };

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
      if (db < R + 0.02 || dh < R + 0.02) return;
      // Reflect the cup across the line the ball's centre bounces on (one radius off the wall).
      const mx = hx - 2 * (dh - R) * nx, mz = hz - 2 * (dh - R) * nz;
      const den = (mx - sx) * nx + (mz - sz) * nz;
      if (Math.abs(den) < 1e-9) return;
      const t = (R - db) / den;
      if (t <= 0 || t >= 1) return;
      const px = sx + t * (mx - sx), pz = sz + t * (mz - sz);
      const cx = px - nx * R, cz = pz - nz * R; // contact point on the wall
      const u = ((cx - s.ax) * ex + (cz - s.az) * ez) / s.len2;
      if (u < 0.02 || u > 0.98) return;
      if (!lineClear(world, sx, sz, px, pz, clearance, i)) return;
      if (!lineClear(world, px, pz, hx, hz, clearance, i)) return;
      out.push({ angle: U.angleOf(mx - sx, mz - sz), kind: 'bank', pathLen: Math.hypot(mx - sx, mz - sz), seg: i });
    });

    for (const c of out) {
      if (c.kind !== 'bank') continue;
      c.speedRef = Ph.speedForDistance(1.5 * c.pathLen + 0.6);
      const r = Ph.refineAngle(world, sx, sz, target, c.angle, c.speedRef, 10 * DEG, 0.5 * DEG);
      c.mirrorAngle = c.angle;
      c.angle = r.angle;
      c.minDist = r.minDist;
    }
    // Known-good launch directions from the generator (simulated putts).
    for (const sd of opts.seeds || []) {
      const r = Ph.refineAngle(world, sx, sz, target, sd.angle, sd.speed, 1.5 * DEG, 0.25 * DEG);
      out.push({ angle: r.angle, kind: 'bank', pathLen: Ph.distanceForSpeed(sd.speed) / 1.5, speedRef: sd.speed, minDist: r.minDist, seeded: true });
    }
    return {
      candidates: out.filter((c) => c.kind === 'direct' || c.minDist < 0.3 * layout.holeR),
      directOpen
    };
  }

  // ---------------------------------------------------------------- finalize
  function transform(raw, yaw) {
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

  // opts: { difficulty, seed, kind?, eyeSide (−1 right-handed, +1 left-handed) }
  function generate(opts) {
    const P = C.difficulty[opts.difficulty];
    const eyeSide = opts.eyeSide || -1;
    const rng = MG.createRng(opts.seed);
    const holeR = P.holeRadius;
    let kind = opts.kind || rng.pick(P.kinds);
    for (let attempt = 0; attempt < 60; attempt++) {
      // Retry the same situation a few times before picking another one, so
      // hard-to-build layouts (banks) still turn up as often as their weight says.
      if (!opts.kind && attempt > 0 && attempt % 12 === 0) kind = rng.pick(P.kinds);
      const raw = GEN[kind](rng, P, { eyeSide, holeR });
      if (!raw) continue;
      const L = transform(raw, rng.range(0, Math.PI * 2));
      Object.assign(L, {
        seed: opts.seed,
        kind,
        bankVariant: raw.bankVariant || null,
        difficulty: opts.difficulty,
        holeR,
        cues: P.cues,
        label: C.kindLabels[kind] + (raw.bankVariant === 'dogleg' ? ' (dog-leg)' : '')
      });
      const world = Ph.buildWorld(L, holeR);
      // Ball and cup must sit comfortably inside the course.
      if (!pointInPoly(0, 0, L.boundary) || !pointInPoly(L.hole[0], L.hole[1], L.boundary)) continue;
      if (minSegDist(world, 0, 0) < 0.12) continue;
      if (minSegDist(world, L.hole[0], L.hole[1]) < holeR + 0.05) continue;

      const isBank = kind === 'bank';
      const seeds = (raw.seeds || []).map((sd) => ({ angle: sd.angle + L.laneYaw, speed: sd.speed }));
      const sol = solve(L, world, { banks: isBank, seeds });
      if (isBank && sol.directOpen) continue; // must actually need the cushion
      const cands = sol.candidates.filter((c) => (isBank ? c.kind === 'bank' : c.kind === 'direct'));
      if (!cands.length) continue;
      cands.sort((a, b) => (a.minDist || 0) - (b.minDist || 0) || a.pathLen - b.pathLen);
      L.candidates = cands;
      L.ideal = cands[0].angle;
      L.idealKind = cands[0].kind;

      // Stance: never square to the true line. Offset sign and size are random.
      const off = rng.range(P.stanceOffsetDeg[0], P.stanceOffsetDeg[1]) * DEG * rng.sign();
      if (raw.stanceMode === 'lane') {
        // Set up parallel to the borders, the way people instinctively do.
        L.stanceYaw = L.laneYaw + rng.range(-4, 4) * DEG;
      } else {
        L.stanceYaw = L.ideal + off;
      }
      L.clubStart = L.stanceYaw + rng.range(-7, 7) * DEG;
      L.world = world;
      return L;
    }
    // Fallback that always works.
    return generate(Object.assign({}, opts, { kind: 'straight', seed: opts.seed + 1 }));
  }

  // ---------------------------------------------------------------- course mode
  const COURSE_KINDS = ['straight', 'slightLeft', 'slightRight', 'long', 'short', 'obscured', 'bank', 'awkward'];
  const DIFF_INDEX = { easy: 0, medium: 1, hard: 2, expert: 3 };

  // Fixed layout per hole and difficulty; the stance shifts a little on each attempt.
  function courseHole(index, difficulty, attempt, eyeSide) {
    const seed = 7919 * (index + 1) + 104729 * DIFF_INDEX[difficulty] + 17;
    const L = generate({ difficulty, seed, kind: COURSE_KINDS[index], eyeSide });
    const jr = MG.createRng(seed * 31 + attempt * 977);
    L.stanceYaw += jr.range(-2.5, 2.5) * DEG;
    L.clubStart = L.stanceYaw + jr.range(-7, 7) * DEG;
    return L;
  }

  MG.Course = {
    generate,
    courseHole,
    COURSE_LENGTH: COURSE_KINDS.length,
    solve,
    lineClear,
    pointInPoly
  };
})(typeof window !== 'undefined' ? window : globalThis);

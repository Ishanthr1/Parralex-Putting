(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});
  const cfg = PP.cfg;

  const u = (PP.util = PP.util || {});
  u.d2r = Math.PI / 180;
  u.dirX = (a) => Math.sin(a);
  u.dirZ = (a) => -Math.cos(a);
  u.angleOf = (x, z) => Math.atan2(x, -z);
  u.wrap = (a) => {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  };
  u.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  u.lerp = (a, b, t) => a + (b - a) * t;
  u.rightX = (a) => Math.cos(a);
  u.rightZ = (a) => Math.sin(a);

  function ptSeg(px, pz, ax, az, bx, bz) {
    const ex = bx - ax, ez = bz - az;
    const len2 = ex*ex + ez*ez;
    let t = len2 > 0 ? ((px - ax) * ex + (pz - az) * ez) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + t * ex, cz = az + t * ez;
    return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
  }
  u.ptSeg = ptSeg;

  function segSeg(a1x, a1z, b1x, b1z, a2x, a2z, b2x, b2z) {
    const d1 = (b1x - a1x) * (a2z - a1z) - (b1z - a1z) * (a2x - a1x);
    const d2 = (b1x - a1x) * (b2z - a1z) - (b1z - a1z) * (b2x - a1x);
    const d3 = (b2x - a2x) * (a1z - a2z) - (b2z - a2z) * (a1x - a2x);
    const d4 = (b2x - a2x) * (b1z - a2z) - (b2z - a2z) * (b1x - a2x);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
    return Math.min(
      ptSeg(a1x, a1z, a2x, a2z, b2x, b2z).d,
      ptSeg(b1x, b1z, a2x, a2z, b2x, b2z).d,
      ptSeg(a2x, a2z, a1x, a1z, b1x, b1z).d,
      ptSeg(b2x, b2z, a1x, a1z, b1x, b1z).d
    );
  }
  u.segSeg = segSeg;

  const BR = cfg.ball.r;
  const G = cfg.g;
  const GREEN = cfg.surf.green;
  const STOP = cfg.turf.vStop;
  const RAIL_E = cfg.rail.e;
  const RAIL_MU = cfg.rail.mu;
  const CUP = cfg.cup;
  const RIM_MU = cfg.cup.rimMu;
  const PIPE_MU = cfg.pipe.mu;

  const rollA = (crr) => (5/7) * crr * G;
  const KD = (1 - 25/49) / (2 * GREEN.skid * G) + (25/49) / (2 * rollA(GREEN.crr));
  const distOf = (v) => KD * v * v;
  const speedFor = (d) => Math.sqrt(Math.max(0, d) / KD);

  const P0 = { y: 0, gx: 0, gz: 0 };
  const P1 = { y: 0, gx: 0, gz: 0 };
  const TP = [0, 0, 0];
  const TD = [0, 0];

  function makeWorld(layout, cupR) {
    const segs = [];
    const addSeg = (a, b, tag) => {
      const ex = b[0] - a[0], ez = b[1] - a[1];
      segs.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], len2: ex*ex + ez*ez, tag });
    };
    const B = layout.boundary;
    for (let i = 0; i < B.length; i++) addSeg(B[i], B[(i + 1) % B.length], 'border');
    const posts = [];
    for (const o of layout.obstacles || []) {
      if (o.type === 'box') {
        const cs = cornersOf(o);
        for (let i = 0; i < 4; i++) addSeg(cs[i], cs[(i + 1) % 4], 'obstacle');
      } else if (o.type === 'post') {
        posts.push({ x: o.x, z: o.z, r: o.r });
      }
    }
    const terrain = layout.terrain || PP.terrain.flat;
    const tracks = layout.tracks || null;
    let hole = null;
    if (layout.hole) {
      hole = { x: layout.hole[0], z: layout.hole[1], R: cupR, depth: CUP.depth, y: terrain.y(layout.hole[0], layout.hole[1]) };
    }
    return { segs, posts, hole, terrain, tracks };
  }

  function cornersOf(o) {
    const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
    const hw = o.w / 2, hd = o.d / 2;
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd]
    ].map(([lx, lz]) => [o.x + lx * c - lz * s, o.z + lx * s + lz * c]);
  }

  function newBall(x, z, gy) {
    const base = gy || 0;
    return {
      x, y: base + BR, z,
      vx: 0, vy: 0, vz: 0,
      wx: 0, wz: 0,
      moving: false, sliding: false, airborne: false, flying: false,
      holed: false, rimTouched: false, inCup: false, wallHits: 0,
      track: null, trackS: 0, trackV: 0, trackCool: 0, rode: 0, calm: 0,
      surf: 'green',
      spinDX: 0, spinDZ: 0,
      time: 0
    };
  }

  function hit(b, angle, speed) {
    b.vx = speed * Math.sin(angle);
    b.vz = -speed * Math.cos(angle);
    b.vy = 0;
    b.wx = 0;
    b.wz = 0;
    b.flying = false;
    b.moving = true;
    b.sliding = true;
  }

  function step(b, world, dt) {
    if (b.track) {
      ride(b, dt);
      return;
    }
    if (b.trackCool > 0) b.trackCool -= dt;

    const terr = world.terrain;
    const hole = world.hole;
    terr.probe(b.x, b.z, P0);
    const gy = P0.y;

    let overHole = false;
    if (hole) overHole = Math.hypot(b.x - hole.x, b.z - hole.z) < hole.R;

    const zn = terr.zoneAt(b.x, b.z);
    const sfc = (zn && cfg.surf[zn.kind]) || GREEN;
    b.surf = zn ? zn.kind : 'green';

    const slope2 = P0.gx * P0.gx + P0.gz * P0.gz;
    const vFollow = P0.gx * b.vx + P0.gz * b.vz;
    const onGround = !overHole && !b.flying && b.y <= gy + BR + 1e-4 && b.vy - vFollow <= 1e-3;
    b.airborne = !onGround;
    if (onGround) {
      b.y = gy + BR;
      b.vy = vFollow;
      const ka = (5/7) * G * dt;
      b.vx -= ka * P0.gx;
      b.wx -= ka * P0.gx;
      b.vz -= ka * P0.gz;
      b.wz -= ka * P0.gz;
      const hold = Math.sqrt(slope2) > sfc.crr * 1.05;
      rubTurf(b, dt, sfc, Math.sqrt(1 + slope2), hold);
      if (!b.moving) return;
      if (Math.hypot(b.vx, b.vz) < 0.055) {
        b.calm += dt;
        if (b.calm > 0.7) {
          b.vx = b.vz = b.wx = b.wz = 0;
          b.moving = false;
          return;
        }
      } else b.calm = 0;
      const sp = Math.hypot(b.vx, b.vz);
      const vsy = P0.gx * b.vx + P0.gz * b.vz;
      if (sp > 1.2 && vsy < -0.05) {
        terr.probe(b.x + b.vx * dt, b.z + b.vz * dt, P1);
        const need = ((P1.gx * b.vx + P1.gz * b.vz) - vsy) / dt;
        if (need < -G) {
          b.airborne = true;
          b.flying = true;
          b.vy = vsy;
        }
      }
    } else {
      b.vy -= G * dt;
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.spinDX += b.wx * dt;
    b.spinDZ += b.wz * dt;
    b.time += dt;

    if (world.tracks && !b.inCup) {
      const got = PP.tracks.tryEnter(b, world.tracks);
      if (got) {
        board(b, got.tr, got.v);
        return;
      }
    }
    if (!b.inCup) bumpRails(b, world);

    terr.probe(b.x, b.z, P1);
    if (hole) cupCheck(b, hole, dt, P1);
    else if (b.y < P1.y + BR) land(b, P1.y, P1.gx, P1.gz);
  }

  function board(b, tr, v) {
    b.track = tr;
    b.trackS = 0;
    b.trackV = v;
    b.rode++;
    b.vy = 0;
    b.moving = true;
  }

  function ride(b, dt) {
    const tr = b.track;
    const slope = PP.tracks.posAt(tr, b.trackS, TP);
    b.x = TP[0];
    b.y = TP[1];
    b.z = TP[2];
    const dir = b.trackV >= 0 ? 1 : -1;
    b.trackV += (-(5/7) * G * slope - PIPE_MU * G * dir) * dt;
    b.trackS += b.trackV * dt;
    b.spinDX += Math.abs(b.trackV) * dt;
    b.time += dt;

    if (b.trackS >= tr.len) {
      leave(b, tr, tr.len, Math.max(0.15, Math.abs(b.trackV)), 1);
    } else if (b.trackS <= 0) {
      leave(b, tr, 0, Math.max(0.15, Math.abs(b.trackV)), -1);
    } else if (Math.abs(b.trackV) < cfg.pipe.stallV && Math.abs(slope) < 0.04) {
      const back = b.trackS < tr.len / 2;
      leave(b, tr, back ? 0 : tr.len, 0.3, back ? -1 : 1);
    }
  }

  function leave(b, tr, s, v, dir) {
    PP.tracks.posAt(tr, s, TP);
    PP.tracks.tangent(tr, s, TD);
    b.x = TP[0];
    b.y = TP[1];
    b.z = TP[2];
    b.vx = TD[0] * v * dir;
    b.vz = TD[1] * v * dir;
    b.vy = 0;
    b.wx = b.vx;
    b.wz = b.vz;
    b.track = null;
    b.flying = false;
    b.trackCool = 0.35;
    b.sliding = false;
    b.moving = true;
  }

  function rubTurf(b, dt, sfc, nScale, hold) {
    const mu = sfc.skid;
    const sx = b.vx - b.wx, sz = b.vz - b.wz;
    const slip = Math.hypot(sx, sz);
    if (slip > 1e-4) {
      b.sliding = true;
      const dSlip = 3.5 * mu * G * dt;
      if (dSlip >= slip) {
        const vx = (5 * b.vx + 2 * b.wx) / 7, vz = (5 * b.vz + 2 * b.wz) / 7;
        b.vx = b.wx = vx;
        b.vz = b.wz = vz;
      } else {
        const ux = sx / slip, uz = sz / slip, a = mu * G * dt;
        b.vx -= a * ux;
        b.vz -= a * uz;
        b.wx += 2.5 * a * ux;
        b.wz += 2.5 * a * uz;
      }
    } else {
      b.sliding = false;
      const sp = Math.hypot(b.vx, b.vz);
      const dec = (rollA(sfc.crr) / (nScale || 1)) * dt;
      if (sp <= dec || (!hold && sp < STOP)) {
        b.vx = b.vz = b.wx = b.wz = 0;
        if (!hold) b.moving = false;
        return;
      }
      const k = (sp - dec) / sp;
      b.vx *= k;
      b.vz *= k;
      b.wx = b.vx;
      b.wz = b.vz;
    }
  }

  function bumpRails(b, world) {
    const segs = world.segs;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const ex = s.bx - s.ax, ez = s.bz - s.az;
      let t = ((b.x - s.ax) * ex + (b.z - s.az) * ez) / s.len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = s.ax + t * ex, cz = s.az + t * ez;
      let nx = b.x - cx, nz = b.z - cz;
      const d = Math.hypot(nx, nz);
      if (d < BR && d > 1e-9) {
        nx /= d;
        nz /= d;
        b.x = cx + nx * BR;
        b.z = cz + nz * BR;
        railKick(b, nx, nz);
      }
    }
    const posts = world.posts;
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      let nx = b.x - p.x, nz = b.z - p.z;
      const d = Math.hypot(nx, nz), min = BR + p.r;
      if (d < min && d > 1e-9) {
        nx /= d;
        nz /= d;
        b.x = p.x + nx * min;
        b.z = p.z + nz * min;
        railKick(b, nx, nz);
      }
    }
  }

  function railKick(b, nx, nz) {
    const vn = b.vx * nx + b.vz * nz;
    if (vn >= 0) return;
    const e = -vn < 0.03 ? 0 : RAIL_E;
    const jn = (1 + e) * -vn;
    let tx = b.vx - vn * nx, tz = b.vz - vn * nz;
    const vt = Math.hypot(tx, tz);
    if (vt > 1e-9) {
      const dvt = Math.min((2/7) * vt, RAIL_MU * jn);
      const k = (vt - dvt) / vt;
      tx *= k;
      tz *= k;
    }
    b.vx = tx - e * vn * nx;
    b.vz = tz - e * vn * nz;
    const wn = b.wx * nx + b.wz * nz;
    if (Math.abs(wn) > 1e-9) {
      const dw = Math.min((5/7) * Math.abs(wn), 2.5 * RAIL_MU * jn);
      const nw = wn - Math.sign(wn) * dw;
      b.wx += (nw - wn) * nx;
      b.wz += (nw - wn) * nz;
    }
    if (-vn > 0.03) b.wallHits++;
  }

  function rimRub(b, nx, ny, nz, jn) {
    const r = BR;
    const ox = b.wz / r, oz = -b.wx / r;
    const rcx = -nx * r, rcy = -ny * r, rcz = -nz * r;
    const cx = b.vx + (0 * rcz - oz * rcy);
    const cy = b.vy + (oz * rcx - ox * rcz);
    const cz = b.vz + (ox * rcy - 0 * rcx);
    const cn = cx * nx + cy * ny + cz * nz;
    let tx = cx - cn * nx, ty = cy - cn * ny, tz = cz - cn * nz;
    const slip = Math.sqrt(tx*tx + ty*ty + tz*tz);
    if (slip < 1e-9) return;
    tx /= slip;
    ty /= slip;
    tz /= slip;
    const jt = Math.min((2/7) * slip, RIM_MU * jn);
    const fx = -jt * tx, fy = -jt * ty, fz = -jt * tz;
    b.vx += fx;
    b.vy += fy;
    b.vz += fz;
    const k = 2.5 / (r * r);
    const dox = (rcy * fz - rcz * fy) * k;
    const doz = (rcx * fy - rcy * fx) * k;
    b.wx = -(oz + doz) * r;
    b.wz = (ox + dox) * r;
  }

  function land(b, gy, gx, gz) {
    b.y = gy + BR;
    const follow = (gx || 0) * b.vx + (gz || 0) * b.vz;
    const impact = b.vy - follow;
    if (impact < -0.4) {
      b.vy = follow - impact * 0.3;
      b.flying = true;
    } else {
      b.vy = follow;
      b.flying = false;
    }
  }

  function cupCheck(b, hole, dt, gnd) {
    const R = hole.R;
    const hy = hole.y;
    let hx = b.x - hole.x, hz = b.z - hole.z;
    let d = Math.hypot(hx, hz);
    let ux = 1, uz = 0;
    if (d > 1e-9) {
      ux = hx / d;
      uz = hz / d;
    }

    if (b.y - hy > -BR) {
      const rx = hole.x + ux * R, rz = hole.z + uz * R;
      const dx = b.x - rx, dy = b.y - hy, dz = b.z - rz;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist < BR && dist > 1e-9) {
        const nx = dx / dist, ny = dy / dist, nz = dz / dist;
        b.x = rx + nx * BR;
        b.y = hy + ny * BR;
        b.z = rz + nz * BR;
        const vn = b.vx * nx + b.vy * ny + b.vz * nz;
        if (vn < 0) {
          const e = -vn < 0.08 ? 0 : CUP.rimE;
          const jn = -(1 + e) * vn;
          b.vx += jn * nx;
          b.vy += jn * ny;
          b.vz += jn * nz;
          rimRub(b, nx, ny, nz, jn);
        }
        b.rimTouched = true;
      }
      hx = b.x - hole.x;
      hz = b.z - hole.z;
      d = Math.hypot(hx, hz);
      if (d > 1e-9) {
        ux = hx / d;
        uz = hz / d;
      }
    }

    if (d >= R) {
      if (b.y < gnd.y + BR) land(b, gnd.y, gnd.gx, gnd.gz);
      return;
    }
    if (b.y - hy < 0) {
      b.inCup = true;
      const maxD = R - BR;
      if (d > maxD) {
        b.x = hole.x + ux * maxD;
        b.z = hole.z + uz * maxD;
        const vr = b.vx * ux + b.vz * uz;
        if (vr > 0) {
          b.vx -= (1 + CUP.sideE) * vr * ux;
          b.vz -= (1 + CUP.sideE) * vr * uz;
        }
      }
      const floor = hy - hole.depth + BR;
      if (b.y < floor) {
        b.y = floor;
        if (b.vy < 0) b.vy = -b.vy > 0.1 ? -b.vy * CUP.floorE : 0;
        const k = Math.max(0, 1 - 8 * dt);
        b.vx *= k;
        b.vz *= k;
        b.wx *= k;
        b.wz *= k;
        if (b.vy === 0 && Math.hypot(b.vx, b.vz) < 0.01) {
          b.vx = b.vz = b.wx = b.wz = 0;
          b.moving = false;
        }
      }
      if (b.y - hy < -CUP.dropFactor * BR) b.holed = true;
    }
  }

  function runLine(world, sx, sz, angle, speed, opts) {
    opts = opts || {};
    const target = opts.target;
    const maxTime = opts.maxTime || 25;
    const terr = world.terrain || PP.terrain.flat;
    const W = { segs: world.segs, posts: world.posts, hole: null, terrain: terr, tracks: null };
    const b = newBall(sx, sz, terr.y(sx, sz));
    hit(b, angle, speed);
    const pts = opts.record ? [[b.x, b.z]] : null;
    let minD = target ? Math.hypot(b.x - target.x, b.z - target.z) : Infinity;
    let minIdx = 0, minAt = [b.x, b.z], minVel = [b.vx, b.vz];
    let t = 0, px = b.x, pz = b.z, recT = 0;
    const baseDt = cfg.sim.solveDt;
    while (t < maxTime && b.moving) {
      const sp = Math.hypot(b.vx, b.vz);
      const dt = sp > 0 ? Math.min(baseDt, cfg.sim.maxTravel / sp) : baseDt;
      step(b, W, dt);
      t += dt;
      if (target) {
        const r = ptSeg(target.x, target.z, px, pz, b.x, b.z);
        if (r.d < minD) {
          minD = r.d;
          minAt = [r.cx, r.cz];
          minVel = [b.vx, b.vz];
          minIdx = pts ? pts.length : 0;
        }
      }
      px = b.x;
      pz = b.z;
      if (pts) {
        recT += dt;
        if (recT >= 0.01) {
          pts.push([b.x, b.z]);
          recT = 0;
        }
      }
    }
    if (pts) pts.push([b.x, b.z]);
    return { minDist: minD, minAt, minVel, minIdx, final: [b.x, b.z], points: pts, time: t, wallHits: b.wallHits };
  }

  function tuneAngle(world, sx, sz, target, a0, speed, halfWin, stepA) {
    halfWin = halfWin || 8 * u.d2r;
    stepA = stepA || 0.25 * u.d2r;
    const f = (a) => runLine(world, sx, sz, a, speed, { target }).minDist;
    let best = a0, bestV = Infinity;
    for (let a = a0 - halfWin; a <= a0 + halfWin + 1e-9; a += stepA) {
      const v = f(a);
      if (v < bestV) {
        bestV = v;
        best = a;
      }
    }
    let lo = best - stepA, hi = best + stepA;
    const gr = (Math.sqrt(5) - 1) / 2;
    let c = hi - gr * (hi - lo), d = lo + gr * (hi - lo);
    let fc = f(c), fd = f(d);
    for (let i = 0; i < 22; i++) {
      if (fc < fd) {
        hi = d; d = c; fd = fc;
        c = hi - gr * (hi - lo); fc = f(c);
      } else {
        lo = c; c = d; fc = fd;
        d = lo + gr * (hi - lo); fd = f(d);
      }
    }
    const a = (lo + hi) / 2;
    const v = f(a);
    return v <= bestV ? { angle: a, minDist: v } : { angle: best, minDist: bestV };
  }

  PP.phys = {
    BR,
    rollA,
    makeWorld,
    cornersOf,
    newBall,
    hit,
    step,
    runLine,
    tuneAngle,
    distOf,
    speedFor
  };
})(typeof window !== 'undefined' ? window : globalThis);

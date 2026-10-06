/*
 * physics.js — golf-ball dynamics. Pure JavaScript, no Three.js, so it can be
 * unit-tested in Node.
 *
 * Coordinates: the green is the X/Z plane, Y is up (same as Three.js).
 * An aim angle θ points along (sin θ, −cos θ): θ = 0 is "forward" (−Z) and a
 * positive θ turns to the RIGHT when seen by a player standing on the green.
 *
 * Model
 *  • Sliding phase: kinetic friction μk·g decelerates the centre of mass and
 *    spins the ball up at 5/2·μk·g/r until the contact point stops slipping.
 *    The ball then rolls with v = (5·v0 + 2·w0)/7 (angular momentum about the
 *    contact point is conserved).
 *  • Rolling phase: constant rolling-resistance deceleration (5/7)·Crr·g.
 *  • Borders: normal restitution e, Coulomb friction during the impact on
 *    the tangential velocity and on the forward roll (the spin is not reset,
 *    so a rebounding ball skids and curls slightly before rolling again).
 *  • Hole: full 3-D treatment. The rim is a circle edge, the cup a cylinder.
 *    The ball pivots over the near edge, falls under gravity and either
 *    catches the far side of the cup or bounces over it, so capture speed and
 *    lip-outs emerge from the geometry instead of a "close enough" rule.
 */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});
  const C = MG.CONFIG;

  // ---------------------------------------------------------------- helpers
  const U = (MG.Util = MG.Util || {});
  U.DEG = Math.PI / 180;
  U.dirX = (a) => Math.sin(a);
  U.dirZ = (a) => -Math.cos(a);
  U.angleOf = (x, z) => Math.atan2(x, -z);
  U.wrap = (a) => {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  };
  U.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  // Right-hand vector of a facing angle (unit, on the ground plane).
  U.rightX = (a) => Math.cos(a);
  U.rightZ = (a) => Math.sin(a);

  function pointSegDist(px, pz, ax, az, bx, bz) {
    const ex = bx - ax, ez = bz - az;
    const len2 = ex * ex + ez * ez;
    let t = len2 > 0 ? ((px - ax) * ex + (pz - az) * ez) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + t * ex, cz = az + t * ez;
    return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
  }
  U.pointSegDist = pointSegDist;

  function segSegDist(a1x, a1z, b1x, b1z, a2x, a2z, b2x, b2z) {
    // 0 if they cross, otherwise the smallest endpoint-to-segment distance.
    const d1 = (b1x - a1x) * (a2z - a1z) - (b1z - a1z) * (a2x - a1x);
    const d2 = (b1x - a1x) * (b2z - a1z) - (b1z - a1z) * (b2x - a1x);
    const d3 = (b2x - a2x) * (a1z - a2z) - (b2z - a2z) * (a1x - a2x);
    const d4 = (b2x - a2x) * (b1z - a2z) - (b2z - a2z) * (b1x - a2x);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
    return Math.min(
      pointSegDist(a1x, a1z, a2x, a2z, b2x, b2z).d,
      pointSegDist(b1x, b1z, a2x, a2z, b2x, b2z).d,
      pointSegDist(a2x, a2z, a1x, a1z, b1x, b1z).d,
      pointSegDist(b2x, b2z, a1x, a1z, b1x, b1z).d
    );
  }
  U.segSegDist = segSegDist;

  // ---------------------------------------------------------------- constants
  const R_BALL = C.ball.radius;
  const G = C.g;
  const MU_S = C.surface.slideFriction;
  const ROLL_DECEL = (5 / 7) * C.surface.rollingResistance * G;
  const STOP = C.surface.stopSpeed;
  const WALL_E = C.wall.restitution;
  const MU_W = C.wall.friction;
  const H = C.hole;
  const MU_RIM = C.hole.rimFriction;

  // Flat-ground distance a ball launched (sliding, no spin) at speed v travels.
  // Slide: v → 5v/7 over (v² − (5v/7)²)/(2μg); roll: (5v/7)²/(2a).
  const K_DIST = (1 - 25 / 49) / (2 * MU_S * G) + (25 / 49) / (2 * ROLL_DECEL);
  const distanceForSpeed = (v) => K_DIST * v * v;
  const speedForDistance = (d) => Math.sqrt(Math.max(0, d) / K_DIST);

  // ---------------------------------------------------------------- world
  // layout: { boundary:[[x,z],…], obstacles:[{type:'box',x,z,w,d,rot}|{type:'post',x,z,r}], hole:[x,z] }
  function buildWorld(layout, holeR) {
    const segs = [];
    const addSeg = (a, b, tag) => {
      const ex = b[0] - a[0], ez = b[1] - a[1];
      segs.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], len2: ex * ex + ez * ez, tag });
    };
    const B = layout.boundary;
    for (let i = 0; i < B.length; i++) addSeg(B[i], B[(i + 1) % B.length], 'border');
    const posts = [];
    for (const o of layout.obstacles || []) {
      if (o.type === 'box') {
        const corners = boxCorners(o);
        for (let i = 0; i < 4; i++) addSeg(corners[i], corners[(i + 1) % 4], 'obstacle');
      } else if (o.type === 'post') {
        posts.push({ x: o.x, z: o.z, r: o.r });
      }
    }
    const hole = layout.hole ? { x: layout.hole[0], z: layout.hole[1], R: holeR, depth: H.depth } : null;
    return { segs, posts, hole };
  }

  function boxCorners(o) {
    const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
    const hw = o.w / 2, hd = o.d / 2;
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd]
    ].map(([lx, lz]) => [o.x + lx * c - lz * s, o.z + lx * s + lz * c]);
  }

  // ---------------------------------------------------------------- ball
  function createBall(x, z) {
    return {
      x, y: R_BALL, z,
      vx: 0, vy: 0, vz: 0,
      wx: 0, wz: 0, // contact-point "rolling velocity" ω×r (equals v when rolling)
      moving: false, sliding: false, airborne: false,
      holed: false, rimTouched: false, inCup: false, wallHits: 0,
      // accumulated rotation for rendering (axis-angle increments are applied by the renderer)
      spinDX: 0, spinDZ: 0,
      time: 0
    };
  }

  function launch(b, angle, speed) {
    b.vx = speed * Math.sin(angle);
    b.vz = -speed * Math.cos(angle);
    b.vy = 0;
    b.wx = 0; // a putt leaves the face skidding with ~zero spin
    b.wz = 0;
    b.moving = true;
    b.sliding = true;
  }

  // ---------------------------------------------------------------- step
  function step(b, world, dt) {
    const hole = world.hole;
    let overHole = false;
    if (hole) overHole = Math.hypot(b.x - hole.x, b.z - hole.z) < hole.R;

    const onGround = !overHole && b.y <= R_BALL + 1e-6 && b.vy <= 1e-6;
    b.airborne = !onGround;
    if (onGround) {
      b.y = R_BALL;
      b.vy = 0;
      groundFriction(b, dt);
      if (!b.moving) return;
    } else {
      b.vy -= G * dt;
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    // rolling distance for the renderer (only meaningful while touching)
    b.spinDX += b.wx * dt;
    b.spinDZ += b.wz * dt;
    b.time += dt;

    if (!b.inCup) collideWalls(b, world);
    if (hole) holeConstraints(b, hole, dt);
    else if (b.y < R_BALL) landOnGround(b);
  }

  function groundFriction(b, dt) {
    const sx = b.vx - b.wx, sz = b.vz - b.wz;
    const slip = Math.hypot(sx, sz);
    if (slip > 1e-4) {
      b.sliding = true;
      const dSlip = 3.5 * MU_S * G * dt; // |slip| shrinks at (1 + 5/2)·μk·g
      if (dSlip >= slip) {
        const vx = (5 * b.vx + 2 * b.wx) / 7, vz = (5 * b.vz + 2 * b.wz) / 7;
        b.vx = b.wx = vx;
        b.vz = b.wz = vz;
      } else {
        const ux = sx / slip, uz = sz / slip, a = MU_S * G * dt;
        b.vx -= a * ux;
        b.vz -= a * uz;
        b.wx += 2.5 * a * ux;
        b.wz += 2.5 * a * uz;
      }
    } else {
      b.sliding = false;
      const sp = Math.hypot(b.vx, b.vz);
      const dec = ROLL_DECEL * dt;
      if (sp <= dec || sp < STOP) {
        b.vx = b.vz = b.wx = b.wz = 0;
        b.moving = false;
        return;
      }
      const k = (sp - dec) / sp;
      b.vx *= k;
      b.vz *= k;
      b.wx = b.vx;
      b.wz = b.vz;
    }
  }

  function collideWalls(b, world) {
    const segs = world.segs;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const ex = s.bx - s.ax, ez = s.bz - s.az;
      let t = ((b.x - s.ax) * ex + (b.z - s.az) * ez) / s.len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = s.ax + t * ex, cz = s.az + t * ez;
      let nx = b.x - cx, nz = b.z - cz;
      const d = Math.hypot(nx, nz);
      if (d < R_BALL && d > 1e-9) {
        nx /= d;
        nz /= d;
        b.x = cx + nx * R_BALL;
        b.z = cz + nz * R_BALL;
        wallImpulse(b, nx, nz);
      }
    }
    const posts = world.posts;
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      let nx = b.x - p.x, nz = b.z - p.z;
      const d = Math.hypot(nx, nz), min = R_BALL + p.r;
      if (d < min && d > 1e-9) {
        nx /= d;
        nz /= d;
        b.x = p.x + nx * min;
        b.z = p.z + nz * min;
        wallImpulse(b, nx, nz);
      }
    }
  }

  function wallImpulse(b, nx, nz) {
    const vn = b.vx * nx + b.vz * nz;
    if (vn >= 0) return;
    const e = -vn < 0.03 ? 0 : WALL_E; // a gentle touch just stops the inward motion
    const Jn = (1 + e) * -vn; // normal impulse per unit mass
    // Tangential slip at the contact is reduced by friction (at most to rolling along the wall: 5/7 of vt).
    let tx = b.vx - vn * nx, tz = b.vz - vn * nz;
    const vt = Math.hypot(tx, tz);
    if (vt > 1e-9) {
      const dvt = Math.min((2 / 7) * vt, MU_W * Jn);
      const k = (vt - dvt) / vt;
      tx *= k;
      tz *= k;
    }
    b.vx = tx - e * vn * nx;
    b.vz = tz - e * vn * nz;
    // Forward roll toward the wall rubs on the border; friction removes part of it.
    const wn = b.wx * nx + b.wz * nz;
    if (Math.abs(wn) > 1e-9) {
      const dw = Math.min((5 / 7) * Math.abs(wn), 2.5 * MU_W * Jn);
      const nw = wn - Math.sign(wn) * dw;
      b.wx += (nw - wn) * nx;
      b.wz += (nw - wn) * nz;
    }
    if (-vn > 0.03) b.wallHits++;
  }

  // Coulomb friction at the rim edge acting on the whole rigid sphere. Forward
  // roll makes the contact point slip down the far edge, so friction pushes a
  // fast ball up and over the back of the cup (why firm putts lip out).
  // Spin is stored as w = ω × (r·ŷ) on the ground plane, so ω = (wz, 0, −wx)/r.
  function rimFriction(b, nx, ny, nz, jn) {
    const r = R_BALL;
    const ox = b.wz / r, oz = -b.wx / r; // ωy is not tracked
    const rcx = -nx * r, rcy = -ny * r, rcz = -nz * r; // centre → contact
    const cx = b.vx + (0 * rcz - oz * rcy);
    const cy = b.vy + (oz * rcx - ox * rcz);
    const cz = b.vz + (ox * rcy - 0 * rcx);
    const cn = cx * nx + cy * ny + cz * nz;
    let tx = cx - cn * nx, ty = cy - cn * ny, tz = cz - cn * nz;
    const slip = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (slip < 1e-9) return;
    tx /= slip;
    ty /= slip;
    tz /= slip;
    // Impulse per unit mass; 2/7·slip is what it takes to stop the slip of a solid sphere.
    const jt = Math.min((2 / 7) * slip, MU_RIM * jn);
    const fx = -jt * tx, fy = -jt * ty, fz = -jt * tz;
    b.vx += fx;
    b.vy += fy;
    b.vz += fz;
    const k = 2.5 / (r * r); // m / I
    const dox = (rcy * fz - rcz * fy) * k;
    const doz = (rcx * fy - rcy * fx) * k;
    b.wx = -(oz + doz) * r;
    b.wz = (ox + dox) * r;
  }

  function landOnGround(b) {
    b.y = R_BALL;
    if (b.vy < 0) b.vy = -b.vy > 0.12 ? -b.vy * 0.3 : 0;
  }

  function holeConstraints(b, hole, dt) {
    const R = hole.R;
    let hx = b.x - hole.x, hz = b.z - hole.z;
    let d = Math.hypot(hx, hz);
    let ux = 1, uz = 0;
    if (d > 1e-9) {
      ux = hx / d;
      uz = hz / d;
    }

    // Rim edge: nearest point of the rim circle (radius R, height 0).
    if (b.y > -R_BALL) {
      const rx = hole.x + ux * R, rz = hole.z + uz * R;
      const dx = b.x - rx, dy = b.y, dz = b.z - rz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < R_BALL && dist > 1e-9) {
        const nx = dx / dist, ny = dy / dist, nz = dz / dist;
        b.x = rx + nx * R_BALL;
        b.y = ny * R_BALL;
        b.z = rz + nz * R_BALL;
        const vn = b.vx * nx + b.vy * ny + b.vz * nz;
        if (vn < 0) {
          const e = -vn < 0.08 ? 0 : H.rimRestitution;
          const jn = -(1 + e) * vn; // normal impulse per unit mass
          b.vx += jn * nx;
          b.vy += jn * ny;
          b.vz += jn * nz;
          rimFriction(b, nx, ny, nz, jn);
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
      if (b.y < R_BALL) landOnGround(b);
      return;
    }
    if (b.y < 0) {
      b.inCup = true;
      const maxD = R - R_BALL;
      if (d > maxD) {
        b.x = hole.x + ux * maxD;
        b.z = hole.z + uz * maxD;
        const vr = b.vx * ux + b.vz * uz;
        if (vr > 0) {
          b.vx -= (1 + H.wallRestitution) * vr * ux;
          b.vz -= (1 + H.wallRestitution) * vr * uz;
        }
      }
      const floor = -hole.depth + R_BALL;
      if (b.y < floor) {
        b.y = floor;
        if (b.vy < 0) b.vy = -b.vy > 0.1 ? -b.vy * H.bottomRestitution : 0;
        const k = Math.max(0, 1 - 8 * dt); // friction on the cup floor
        b.vx *= k;
        b.vz *= k;
        b.wx *= k;
        b.wz *= k;
        if (b.vy === 0 && Math.hypot(b.vx, b.vz) < 0.01) {
          b.vx = b.vz = b.wx = b.wz = 0;
          b.moving = false;
        }
      }
      if (b.y < -H.captureDepthFactor * R_BALL) b.holed = true;
    }
  }

  // ------------------------------------------------------------ analysis
  // Fast simulation without the hole (the ball rolls over it) used by the
  // line solver. Tracks the closest approach to `target`.
  function simulateLine(world, sx, sz, angle, speed, opts) {
    opts = opts || {};
    const target = opts.target;
    const maxTime = opts.maxTime || 25;
    const W = { segs: world.segs, posts: world.posts, hole: null };
    const b = createBall(sx, sz);
    launch(b, angle, speed);
    const pts = opts.record ? [[b.x, b.z]] : null;
    let minD = target ? Math.hypot(b.x - target.x, b.z - target.z) : Infinity;
    let minIdx = 0, minAt = [b.x, b.z], minVel = [b.vx, b.vz];
    let t = 0, px = b.x, pz = b.z, recT = 0;
    const baseDt = C.sim.analysisDt;
    while (t < maxTime && b.moving) {
      const sp = Math.hypot(b.vx, b.vz);
      const dt = sp > 0 ? Math.min(baseDt, C.sim.maxStepTravel / sp) : baseDt;
      step(b, W, dt);
      t += dt;
      if (target) {
        const r = pointSegDist(target.x, target.z, px, pz, b.x, b.z);
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

  // Search ±halfWin around a0 for the launch angle whose path passes closest to target.
  function refineAngle(world, sx, sz, target, a0, speed, halfWin, stepA) {
    halfWin = halfWin || 8 * U.DEG;
    stepA = stepA || 0.25 * U.DEG;
    const f = (a) => simulateLine(world, sx, sz, a, speed, { target }).minDist;
    let best = a0, bestV = Infinity;
    for (let a = a0 - halfWin; a <= a0 + halfWin + 1e-9; a += stepA) {
      const v = f(a);
      if (v < bestV) {
        bestV = v;
        best = a;
      }
    }
    // golden-section refinement
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

  MG.Physics = {
    R_BALL,
    ROLL_DECEL,
    buildWorld,
    boxCorners,
    createBall,
    launch,
    step,
    simulateLine,
    refineAngle,
    distanceForSpeed,
    speedForDistance
  };
})(typeof window !== 'undefined' ? window : globalThis);

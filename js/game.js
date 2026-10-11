(function (root) {
  'use strict';
  const PP = root.PP;
  const cfg = PP.cfg, u = PP.util, ph = PP.phys, ui = PP.ui;
  const D2R = u.d2r;
  const $ = ui.$;

  const view = $('view');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  view.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(cfg.golfer.fov, 1, 0.03, 600);
  const scn = PP.buildScene();
  const putter = PP.makePutter(scn.scene, scn.col);
  const golfer = PP.makeGolfer(camera);

  function resize() {
    const w = view.clientWidth || root.innerWidth, h = view.clientHeight || root.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  root.addEventListener('resize', resize);
  resize();

  const st = {
    phase: 'menu',
    inSession: false,
    mode: 'course',
    difficulty: 'medium',
    settings: { leftHanded: false, eyeY: cfg.golfer.eyeY },
    layout: null,
    lie: [0, 0],
    holeIx: 0,
    players: [],
    turn: 0,
    strokes: 0,
    holeNo: 0,
    attempt: 0,
    clubYaw: 0,
    faceYaw: 0,
    back: 0,
    lateral: 0,
    swing: null,
    ball: null,
    path: [],
    pathClock: 0,
    simTime: 0,
    launch: null,
    behind: false,
    session: [],
    strokesTaken: 0,
    lastResult: null
  };

  const heelSide = () => (st.settings.leftHanded ? 1 : -1);
  const eyeSide = () => (st.settings.leftHanded ? 1 : -1);
  const onCourse = () => st.mode === 'course' || st.mode === 'vs';
  const me = () => st.players[st.turn];
  const terrOf = (L) => (L && L.terrain) || PP.terrain.flat;
  const groundY = () => (st.layout ? terrOf(st.layout).y(st.lie[0], st.lie[1]) : 0);

  function aimFrom(L, pos) {
    if (!L.path) return L.stanceYaw;
    const wps = L.path.slice(1).concat([L.hole]);
    let pick = wps[0];
    for (const w of wps) {
      if (PP.holes.openLine(L.world, pos[0], pos[1], w[0], w[1], ph.BR + 0.01, -1)) pick = w;
    }
    return u.angleOf(pick[0] - pos[0], pick[1] - pos[1]);
  }

  function stanceAt(L, pos) {
    return aimFrom(L, pos) + (Math.random() - 0.5) * 2 * cfg.play.stanceOffDeg * D2R;
  }

  function clubAt(stanceYaw) {
    const r = cfg.play.clubOffDeg;
    const mag = r[0] + Math.random() * (r[1] - r[0]);
    return stanceYaw + (Math.random() < 0.5 ? -mag : mag) * D2R;
  }

  function setLevel(k, focus) {
    st.difficulty = k;
    ui.drawLevels(k, setLevel);
    if (focus) ui.focusLevel(k);
  }
  setLevel(st.difficulty);

  const eye = $('eye-height'), eyeOut = $('eye-height-out');
  eye.addEventListener('input', () => (eyeOut.textContent = (+eye.value).toFixed(2) + ' m'));

  $('setup').addEventListener('submit', (e) => {
    e.preventDefault();
    st.mode = document.querySelector('input[name="mode"]:checked').value;
    st.settings.leftHanded = document.querySelector('input[name="hand"]:checked').value === 'left';
    st.settings.eyeY = +eye.value;
    startSession();
  });
  $('btn-stats').addEventListener('click', () => {
    ui.showMenu(false);
    ui.showStats(true);
  });
  $('btn-stats-close').addEventListener('click', () => {
    ui.showStats(false);
    ui.showMenu(true, st.inSession);
  });
  document.addEventListener('click', (e) => {
    const id = e.target && e.target.id;
    if (id === 'btn-resume') resume();
  });
  $('btn-menu').addEventListener('click', (e) => (e.currentTarget.blur(), openMenu()));
  $('btn-restart').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (onCourse()) replayHole();
    else if (st.phase === 'result') retry();
    else resetAttempt();
  });
  $('btn-next').addEventListener('click', (e) => (e.currentTarget.blur(), next()));
  $('btn-retry').addEventListener('click', (e) => (e.currentTarget.blur(), retry()));
  $('btn-behind').addEventListener('click', (e) => (e.currentTarget.blur(), flipView()));
  $('btn-hole-next').addEventListener('click', (e) => (e.currentTarget.blur(), afterHole()));
  $('btn-hand-go').addEventListener('click', (e) => (e.currentTarget.blur(), takeOver()));
  $('btn-round-done').addEventListener('click', (e) => (e.currentTarget.blur(), openMenu()));
  $('btn-card').addEventListener('click', (e) => (e.currentTarget.blur(), ui.toggleCard(st)));

  function openMenu() {
    if (st.phase === 'backswing') abortSwing();
    st.menuFrom = st.phase;
    st.phase = 'menu';
    input.release();
    ui.hint(null);
    ui.showHud(false);
    ui.hideResult();
    ui.closeCards();
    ui.showMenu(true, st.inSession);
  }
  function resume() {
    ui.showMenu(false);
    ui.showHud(true);
    st.phase = st.menuFrom === 'result' ? 'result' : 'aim';
    if (st.phase === 'result' && st.lastResult) ui.drawResult(st.lastResult.res, st.lastResult.ctx);
    if (st.phase === 'aim') input.grab();
  }

  function startSession() {
    st.inSession = true;
    st.session = [];
    st.holeNo = 0;
    ui.showMenu(false);
    ui.showStats(false);
    ui.showHud(true);
    $('pad').hidden = !root.matchMedia('(pointer: coarse)').matches;
    input.grab();
    if (onCourse()) startRound();
    else newHole();
  }

  function startRound() {
    const who = PP.profiles.active();
    st.players = [{ name: who ? who.name : 'Player 1', scores: [], total: 0 }];
    if (st.mode === 'vs') st.players.push({ name: ($('p2-name').value || 'Player 2').slice(0, 18), scores: [], total: 0 });
    st.holeIx = 0;
    loadHole();
  }

  function loadHole() {
    st.layout = PP.layouts.make(st.holeIx);
    scn.build(st.layout);
    st.turn = 0;
    beginTurn(true);
  }

  function replayHole() {
    if (!onCourse()) return;
    st.strokes = 0;
    beginTurn(false);
  }

  function beginTurn(intro) {
    const L = st.layout;
    st.strokes = 0;
    st.lie = [L.tee[0], L.tee[1]];
    placeBallAtLie();
    const yaw = stanceAt(L, st.lie);
    golfer.setUp(L, st.settings, st.lie, yaw, false);
    st.clubYaw = clubAt(yaw);
    st.faceYaw = st.clubYaw;
    st.back = 0;
    st.lateral = 0;
    st.swing = null;
    st.behind = false;
    putter.show(true);
    ui.hideResult();
    ui.closeCards();
    refreshHud();
    st.phase = 'aim';
    if (intro || st.mode === 'vs') {
      ui.holeCard({
        hole: st.holeIx + 1,
        holes: PP.layouts.count,
        name: L.name,
        par: L.par,
        blurb: L.blurb,
        player: st.mode === 'vs' ? me().name : null
      });
    }
    updateHint();
  }

  function placeBallAtLie() {
    const L = st.layout;
    st.ball = ph.newBall(st.lie[0], st.lie[1], terrOf(L).y(st.lie[0], st.lie[1]));
    scn.placeBall(st.ball);
    scn.wipeTrails();
    st.path = [];
    st.simTime = 0;
  }

  function refreshHud() {
    if (onCourse()) {
      ui.setHud({
        course: true,
        hole: st.holeIx + 1,
        holes: PP.layouts.count,
        name: st.layout.name,
        par: st.layout.par,
        strokes: st.strokes,
        player: st.mode === 'vs' ? me().name : null,
        total: me() ? me().total : 0
      });
    } else {
      ui.setHud({ course: false, hole: st.holeNo, attempt: st.attempt });
    }
  }

  function newHole() {
    st.attempt = 1;
    st.holeNo++;
    st.layout = PP.holes.build({ difficulty: st.difficulty, seed: PP.newSeed(), eyeSide: eyeSide() });
    scn.build(st.layout);
    setupAttempt();
  }

  function retry() {
    if (!st.layout) return;
    st.attempt++;
    setupAttempt();
    input.grab();
  }

  function next() {
    newHole();
    input.grab();
  }

  function setupAttempt() {
    const L = st.layout;
    st.lie = [L.ball[0], L.ball[1]];
    placeBallAtLie();
    golfer.setUp(L, st.settings, L.ball, L.stanceYaw, false);
    st.behind = false;
    st.clubYaw = L.clubStart;
    st.faceYaw = st.clubYaw;
    st.back = 0;
    st.lateral = 0;
    st.swing = null;
    putter.show(true);
    ui.hideResult();
    refreshHud();
    st.phase = 'aim';
    updateHint();
  }

  function resetAttempt() {
    if (st.phase === 'aim' || st.phase === 'backswing') {
      st.clubYaw = st.layout.clubStart;
      st.back = st.lateral = 0;
      st.phase = 'aim';
      golfer.recentre(false);
    }
  }

  function updateHint() {
    if (st.phase === 'aim' && !input.io.locked && !input.io.lockFailed && !root.matchMedia('(pointer: coarse)').matches) {
      ui.hint('Click the course to take control of the putter.');
    } else if (st.phase === 'aim' && st.strokesTaken === 0) {
      ui.hint('Move the mouse to turn the putter. Hold the left button, pull back, release to putt.');
    } else if (st.phase === 'rolling' && st.strokesTaken === 1) {
      ui.hint('Hold Space to speed the ball up.', 2500);
    } else ui.hint(null);
  }

  function abortSwing() {
    if (st.phase !== 'backswing') return;
    st.back = 0;
    st.lateral = 0;
    st.phase = 'aim';
  }

  const handlers = {
    playing: () => st.phase !== 'menu' && $('stats').hidden,
    needsLock: () => st.phase === 'aim' || st.phase === 'result',
    lockChange: () => updateHint(),
    turn(d) {
      if (st.phase !== 'aim') return;
      const lim = 160 * D2R;
      const ref = golfer.me.stanceYaw;
      st.clubYaw = ref + u.clamp(u.wrap(st.clubYaw + d - ref), -lim, lim);
    },
    look(dy, dp) {
      if (st.phase === 'menu') return;
      golfer.look(dy, dp);
    },
    swingStart() {
      if (st.phase !== 'aim') return false;
      st.phase = 'backswing';
      st.faceYaw = st.clubYaw;
      st.back = 0;
      st.lateral = 0;
      return true;
    },
    swingMove(dx, dy) {
      if (st.phase !== 'backswing') return;
      const K = cfg.ctl;
      st.back = u.clamp(st.back + dy * K.backPerPx, 0, cfg.putter.maxBack);
      const maxLat = st.back * Math.tan(cfg.putter.maxPathDeg * D2R);
      st.lateral = u.clamp(st.lateral + dx * K.latPerPx, -maxLat, maxLat);
    },
    swingGo() {
      if (st.phase !== 'backswing') return;
      if (st.back < 0.008) {
        abortSwing();
        return;
      }
      st.swing = { A: st.back, L: st.lateral, t: 0, impact: false, follow: 0 };
      st.phase = 'downswing';
      ui.hint(null);
    },
    swingOff: abortSwing,
    key(code, down) {
      if (!down) return;
      if (code === 'KeyM') return openMenu();
      if (code === 'KeyC') return golfer.recentre(false);
      if (code === 'Tab' && onCourse()) return ui.toggleCard(st);
      if (st.phase === 'holeDone' && (code === 'Enter' || code === 'Space')) return afterHole();
      if (st.phase === 'handover' && (code === 'Enter' || code === 'Space')) return takeOver();
      if (st.phase === 'result') {
        if (code === 'Enter' || code === 'Space') next();
        else if (code === 'KeyR') retry();
        else if (code === 'KeyV') flipView();
      }
    }
  };
  const input = PP.makeInput(renderer.domElement, $('pad'), handlers);

  function strike() {
    const sw = st.swing, P = cfg.putter;
    const clubSpeed = sw.A * P.omega;
    const pathRel = Math.atan2(-sw.L, sw.A);
    const launchYaw = st.faceYaw + (1 - P.faceShare) * pathRel;
    const M = P.mass, m = cfg.ball.kg;
    const speed = ((1 + P.cor) * M) / (M + m) * clubSpeed;
    ph.hit(st.ball, launchYaw, speed);
    st.launch = { faceYaw: st.faceYaw, launchYaw, speed };
    st.path = [[st.ball.x, st.ball.z]];
    st.pathClock = 0;
    st.simTime = 0;
    st.phase = 'rolling';
    st.strokesTaken++;
    if (onCourse()) {
      st.strokes++;
      refreshHud();
    }
    updateHint();
  }

  function ballStopped() {
    if (onCourse()) courseStroke();
    else finishPractice();
  }

  function courseStroke() {
    const b = st.ball;
    if (b.holed) return finishHole(st.strokes, false);
    st.lie = [b.x, b.z];
    if (st.strokes >= cfg.play.strokeCap) return finishHole(cfg.play.strokeCap, true);
    const L = st.layout;
    const yaw = stanceAt(L, st.lie);
    golfer.setUp(L, st.settings, st.lie, yaw, true);
    st.clubYaw = clubAt(yaw);
    st.faceYaw = st.clubYaw;
    st.back = 0;
    st.lateral = 0;
    st.swing = null;
    st.phase = 'aim';
    refreshHud();
    input.grab();
  }

  function finishHole(score, capped) {
    const p = me();
    p.scores[st.holeIx] = score;
    p.total = p.scores.reduce((s, v) => s + (v || 0), 0);
    putter.show(false);
    st.phase = 'holeDone';
    input.release();
    ui.hint(null);
    const L = st.layout;
    const vs = st.mode === 'vs';
    const last = st.holeIx === PP.layouts.count - 1;
    const more = vs && st.turn === 0;
    ui.holeDone({
      name: L.name,
      hole: st.holeIx + 1,
      holes: PP.layouts.count,
      par: L.par,
      score,
      capped,
      player: vs ? p.name : null,
      players: st.players,
      nextLabel: more ? 'Hand over' : last ? 'See your card' : 'Next hole',
      scores: st.players.map((q) => ({ name: q.name, scores: q.scores, total: q.total }))
    });
  }

  function afterHole() {
    const vs = st.mode === 'vs';
    if (vs && st.turn === 0) {
      st.phase = 'handover';
      ui.handover({ from: st.players[0].name, to: st.players[1].name, hole: st.holeIx + 1, name: st.layout.name });
      return;
    }
    ui.closeCards();
    if (st.holeIx >= PP.layouts.count - 1) return endRound();
    st.holeIx++;
    loadHole();
    input.grab();
  }

  function takeOver() {
    st.turn = 1;
    ui.closeCards();
    beginTurn(true);
    input.grab();
  }

  function endRound() {
    const par = PP.layouts.defs.reduce((s, h) => s + h.par, 0);
    const p0 = st.players[0];
    PP.store.addRound({
      ts: Date.now(),
      par,
      scores: p0.scores.slice(),
      total: p0.total,
      vs: st.mode === 'vs' ? { name: st.players[1].name, total: st.players[1].total } : null
    });
    st.phase = 'roundDone';
    input.release();
    let verdict = null;
    if (st.mode === 'vs') {
      const a = st.players[0], b = st.players[1];
      verdict = a.total === b.total ? 'Tied on ' + a.total : (a.total < b.total ? a.name : b.name) + ' wins';
    }
    ui.roundDone({ players: st.players, par, verdict, holes: PP.layouts.defs });
  }

  function finishPractice() {
    const b = st.ball;
    st.path.push([b.x, b.z]);
    const shot = {
      faceYaw: st.launch.faceYaw,
      launchYaw: st.launch.launchYaw,
      speed: st.launch.speed,
      final: [b.x, b.z],
      holed: b.holed,
      rimTouched: b.rimTouched,
      wallHits: b.wallHits,
      path: st.path
    };
    const res = PP.score.grade(st.layout, shot);
    const rec = {
      ts: Date.now(),
      mode: 'practice',
      difficulty: st.difficulty,
      kind: res.kind,
      dist: res.puttLength,
      alignDeg: res.alignDeg,
      startDeg: res.startDeg,
      stanceDeg: res.stanceDeg,
      lateral: res.lateral,
      along: res.along,
      finalDist: res.finalDist,
      holed: res.holed,
      speed: res.speed
    };
    PP.store.add(rec);
    st.session.push(rec);
    scn.drawTrails(st.path, res.idealPath, [st.layout.ball[0], st.layout.ball[1]]);
    st.idealYaw = res.idealYaw;
    const n = st.session.length;
    const avg = st.session.reduce((s, r) => s + Math.abs(r.alignDeg), 0) / n;
    const ctx = {
      holeLabel: `Hole ${st.holeNo}`,
      sessionLine: `This session: ${n} putt${n === 1 ? '' : 's'} · average alignment error ${avg.toFixed(1)}°`,
      nextLabel: 'Next hole',
      behind: false
    };
    st.lastResult = { res, ctx };
    st.phase = 'result';
    input.release();
    ui.hint(null);
    ui.drawResult(res, ctx);
  }

  function flipView() {
    if (st.phase !== 'result') return;
    st.behind = !st.behind;
    if (st.behind) {
      putter.show(false);
      golfer.goBehind(st.layout.ball, st.idealYaw, Math.hypot(st.layout.hole[0], st.layout.hole[1]));
    } else {
      putter.show(true);
      golfer.comeBack();
    }
    ui.setBehindLabel(st.behind);
  }

  let last = performance.now();
  let clock = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    const ctl = input.tick(dt);

    if (st.layout) {
      if (st.phase === 'downswing') {
        const sw = st.swing, w = cfg.putter.omega;
        sw.t += dt;
        const pz = Math.min(Math.PI / 2, w * sw.t);
        st.back = sw.A * Math.cos(pz);
        st.lateral = sw.L * Math.cos(pz);
        if (pz >= Math.PI / 2) {
          st.back = 0;
          st.lateral = 0;
          strike();
        }
      } else if (st.phase === 'rolling' || st.phase === 'result' || st.phase === 'holeDone') {
        const sw = st.swing;
        if (sw) {
          sw.follow += dt;
          const pz = Math.min(Math.PI / 2, cfg.putter.omega * sw.follow);
          st.back = -sw.A * 0.8 * Math.sin(pz);
        }
      }

      if (st.phase === 'rolling') {
        let simDt = dt * (ctl.fast ? 3.5 : 1);
        const stepDt = cfg.sim.dt;
        while (simDt > 1e-9) {
          const h = Math.min(stepDt, simDt);
          ph.step(st.ball, st.layout.world, h);
          simDt -= h;
          st.simTime += h;
          st.pathClock += h;
          if (st.pathClock >= 0.01) {
            st.pathClock = 0;
            if (st.ball.y > -0.005) st.path.push([st.ball.x, st.ball.z]);
          }
          if (!st.ball.moving) break;
        }
        scn.moveBall(st.ball);
        if (!st.ball.moving || st.simTime > 45) ballStopped();
      }

      putter.update({
        ball: st.lie,
        groundY: groundY(),
        faceYaw: st.phase === 'aim' ? st.clubYaw : st.faceYaw,
        back: st.back,
        lateral: st.lateral,
        heelSide: heelSide(),
        handsBase: golfer.handsBase
      });
      golfer.update(dt, clock);
    } else {
      const B = st.backdrop, mx = B.hole[0] / 2, mz = B.hole[1] / 2;
      camera.position.set(mx + Math.sin(clock * 0.05) * 5.5, 2.8, mz + Math.cos(clock * 0.05) * 5.5);
      camera.lookAt(mx, 0.2, mz);
    }
    renderer.render(scn.scene, camera);
    requestAnimationFrame(loop);
  }

  (function backdrop() {
    const L = PP.layouts.make(0);
    scn.build(L);
    st.backdrop = L;
    const b = ph.newBall(L.ball[0], L.ball[1], terrOf(L).y(L.ball[0], L.ball[1]));
    scn.placeBall(b);
    putter.show(false);
  })();

  PP.profiles.init();
  PP.store.load();
  ui.drawProfiles();
  requestAnimationFrame(loop);

  PP.game = { st, camera, renderer, golfer, scn, handlers, strike, ballStopped, startSession, startRound,
              next, retry, flipView, afterHole, takeOver, loadHole, aimFrom, stanceAt, clubAt, openMenu };
})(typeof window !== 'undefined' ? window : globalThis);

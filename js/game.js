/*
 * game.js — wires everything together and runs the loop.
 *
 * Phases:  menu → aim → backswing → downswing → rolling → result → (next | retry)
 *
 * LOOK → JUDGE → ALIGN CLUB → HIT → SEE RESULT. Nothing about the line is
 * shown or computed for display until the ball is at rest.
 */
(function (root) {
  'use strict';
  const MG = root.MG;
  const C = MG.CONFIG, U = MG.Util, Ph = MG.Physics, UI = MG.UI;
  const DEG = U.DEG;
  const $ = UI.$;

  // ------------------------------------------------------------ renderer
  const view = $('view');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  view.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(C.player.fovDeg, 1, 0.03, 400);
  const W3 = MG.World3D();
  const putter = MG.Putter(W3.scene, W3.col);
  const player = MG.Player(camera);

  function resize() {
    const w = view.clientWidth || root.innerWidth, h = view.clientHeight || root.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  root.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------ state
  const S = {
    phase: 'menu',
    inSession: false,
    mode: 'practice',
    difficulty: 'medium',
    settings: { leftHanded: false, eyeHeight: C.player.eyeHeight },
    layout: null,
    holeNo: 0,
    attempt: 0,
    courseIndex: 0,
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
    round: [],
    strokesTaken: 0,
    lastResult: null
  };

  const heelSide = () => (S.settings.leftHanded ? 1 : -1);
  const eyeSide = () => (S.settings.leftHanded ? 1 : -1);

  // ------------------------------------------------------------ menu wiring
  function pickDifficulty(k, focus) {
    S.difficulty = k;
    UI.renderDifficulty(k, pickDifficulty);
    if (focus) UI.focusDifficulty(k);
  }
  pickDifficulty(S.difficulty);
  const eye = $('eye-height'), eyeOut = $('eye-height-out');
  eye.addEventListener('input', () => (eyeOut.textContent = (+eye.value).toFixed(2) + ' m'));

  $('setup').addEventListener('submit', (e) => {
    e.preventDefault();
    S.mode = document.querySelector('input[name="mode"]:checked').value;
    S.settings.leftHanded = document.querySelector('input[name="hand"]:checked').value === 'left';
    S.settings.eyeHeight = +eye.value;
    startSession();
  });
  $('btn-stats').addEventListener('click', () => {
    UI.showMenu(false);
    UI.showStats(true);
  });
  $('btn-stats-close').addEventListener('click', () => {
    UI.showStats(false);
    UI.showMenu(true, S.inSession);
  });
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-resume') resume();
  });
  $('btn-menu').addEventListener('click', (e) => (e.currentTarget.blur(), openMenu()));
  $('btn-restart').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (S.phase === 'result') retry();
    else restartAttempt();
  });
  // Buttons drop focus after a click so Space/Enter never trigger them twice.
  $('btn-next').addEventListener('click', (e) => (e.currentTarget.blur(), next()));
  $('btn-retry').addEventListener('click', (e) => (e.currentTarget.blur(), retry()));
  $('btn-behind').addEventListener('click', (e) => (e.currentTarget.blur(), toggleBehind()));

  function openMenu() {
    if (S.phase === 'backswing') cancelStroke();
    S.menuFrom = S.phase;
    S.phase = 'menu';
    input.exitLock();
    UI.hint(null);
    UI.showHud(false);
    UI.hideResult();
    UI.showMenu(true, S.inSession);
  }
  function resume() {
    UI.showMenu(false);
    UI.showHud(true);
    S.phase = S.menuFrom === 'result' ? 'result' : 'aim';
    if (S.phase === 'result' && S.lastResult) UI.showResult(S.lastResult.res, S.lastResult.ctx);
    if (S.phase === 'aim') input.requestLock();
  }

  function startSession() {
    S.inSession = true;
    S.session = [];
    S.round = [];
    S.holeNo = 0;
    S.courseIndex = -1;
    S.sessionStart = Date.now();
    UI.showMenu(false);
    UI.showStats(false);
    UI.showHud(true);
    $('pad').hidden = !root.matchMedia('(pointer: coarse)').matches;
    input.requestLock();
    newHole();
  }

  // ------------------------------------------------------------ holes and attempts
  function newHole() {
    S.attempt = 1;
    if (S.mode === 'course') {
      S.courseIndex = (S.courseIndex + 1) % MG.Course.COURSE_LENGTH;
      if (S.courseIndex === 0) S.round = [];
      S.layout = MG.Course.courseHole(S.courseIndex, S.difficulty, S.attempt, eyeSide());
    } else {
      S.holeNo++;
      S.layout = MG.Course.generate({ difficulty: S.difficulty, seed: MG.randomSeed(), eyeSide: eyeSide() });
    }
    W3.buildLayout(S.layout);
    setupAttempt();
  }

  function retry() {
    if (!S.layout) return;
    S.attempt++;
    if (S.mode === 'course') {
      S.layout = MG.Course.courseHole(S.courseIndex, S.difficulty, S.attempt, eyeSide());
      W3.buildLayout(S.layout);
    }
    setupAttempt();
    input.requestLock();
  }

  function next() {
    newHole();
    input.requestLock();
  }

  function setupAttempt() {
    const L = S.layout;
    S.ball = Ph.createBall(L.ball[0], L.ball[1]);
    W3.resetBall(S.ball);
    W3.clearTrails();
    player.setStance(L, S.settings);
    S.behind = false;
    S.clubYaw = L.clubStart;
    S.faceYaw = S.clubYaw;
    S.back = 0;
    S.lateral = 0;
    S.swing = null;
    S.path = [];
    S.simTime = 0;
    putter.setVisible(true);
    UI.hideResult();
    UI.setHud(S.mode === 'course' ? S.courseIndex + 1 : S.holeNo, S.attempt, S.mode === 'course' ? MG.Course.COURSE_LENGTH : 0);
    S.phase = 'aim';
    refreshHint();
  }

  function restartAttempt() {
    if (S.phase === 'aim' || S.phase === 'backswing') {
      S.clubYaw = S.layout.clubStart;
      S.back = S.lateral = 0;
      S.phase = 'aim';
      player.resetView(false);
    }
  }

  function refreshHint() {
    if (S.phase === 'aim' && !input.st.locked && !input.st.lockFailed && !root.matchMedia('(pointer: coarse)').matches) {
      UI.hint('Click the course to take control of the putter.');
    } else if (S.phase === 'aim' && S.strokesTaken === 0) {
      UI.hint('Move the mouse to turn the putter. Hold the left button, pull back, release to putt.');
    } else if (S.phase === 'rolling' && S.strokesTaken === 1) {
      UI.hint('Hold Space to speed the ball up.', 2500);
    } else UI.hint(null);
  }

  // ------------------------------------------------------------ stroke
  function cancelStroke() {
    if (S.phase !== 'backswing') return;
    S.back = 0;
    S.lateral = 0;
    S.phase = 'aim';
  }

  const handlers = {
    playing: () => S.phase !== 'menu' && $('stats').hidden,
    wantsLock: () => S.phase === 'aim' || S.phase === 'result',
    lockChange: () => refreshHint(),
    club(d) {
      if (S.phase !== 'aim') return;
      const lim = 110 * DEG;
      S.clubYaw = S.layout.stanceYaw + U.clamp(U.wrap(S.clubYaw + d - S.layout.stanceYaw), -lim, lim);
    },
    look(dy, dp) {
      if (S.phase === 'menu') return;
      player.look(dy, dp);
    },
    strokeStart() {
      if (S.phase !== 'aim') return false;
      S.phase = 'backswing';
      S.faceYaw = S.clubYaw;
      S.back = 0;
      S.lateral = 0;
      return true;
    },
    strokeMove(dx, dy) {
      if (S.phase !== 'backswing') return;
      const K = C.controls;
      S.back = U.clamp(S.back + dy * K.backswingMPerPx, 0, C.putter.maxBackswing);
      const maxLat = S.back * Math.tan(C.putter.maxPathDeg * DEG);
      S.lateral = U.clamp(S.lateral + dx * K.pathMPerPx, -maxLat, maxLat);
    },
    strokeRelease() {
      if (S.phase !== 'backswing') return;
      if (S.back < 0.008) {
        cancelStroke();
        return;
      }
      S.swing = { A: S.back, L: S.lateral, t: 0, impact: false, follow: 0 };
      S.phase = 'downswing';
      UI.hint(null);
    },
    strokeCancel: cancelStroke,
    key(code, down) {
      if (!down) return;
      if (code === 'KeyM') return openMenu();
      if (code === 'KeyC') return player.resetView(false);
      if (S.phase === 'result') {
        if (code === 'Enter' || code === 'Space') next();
        else if (code === 'KeyR') retry();
        else if (code === 'KeyV') toggleBehind();
      }
    }
  };
  const input = MG.Input(renderer.domElement, $('pad'), handlers);

  function impact() {
    const sw = S.swing, P = C.putter;
    const omega = P.pendulumOmega;
    const clubSpeed = sw.A * omega; // SHM: peak speed at the bottom of the arc
    const pathRel = Math.atan2(-sw.L, sw.A); // + = club travelling right of the face line
    const launchYaw = S.faceYaw + (1 - P.faceWeight) * pathRel;
    // 1-D impact of putter head (M) on ball (m) with restitution e.
    const M = P.headMass, m = C.ball.mass;
    const speed = ((1 + P.cor) * M) / (M + m) * clubSpeed;
    Ph.launch(S.ball, launchYaw, speed);
    S.launch = { faceYaw: S.faceYaw, launchYaw, speed };
    S.path = [[S.ball.x, S.ball.z]];
    S.pathClock = 0;
    S.simTime = 0;
    S.phase = 'rolling';
    S.strokesTaken++;
    refreshHint();
  }

  function finishShot() {
    const b = S.ball;
    S.path.push([b.x, b.z]);
    const shot = {
      faceYaw: S.launch.faceYaw,
      launchYaw: S.launch.launchYaw,
      speed: S.launch.speed,
      final: [b.x, b.z],
      holed: b.holed,
      rimTouched: b.rimTouched,
      wallHits: b.wallHits,
      path: S.path
    };
    const res = MG.Analysis.evaluate(S.layout, shot);
    const rec = {
      ts: Date.now(),
      mode: S.mode,
      difficulty: S.difficulty,
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
    MG.Stats.add(rec);
    S.session.push(rec);
    if (S.mode === 'course') S.round[S.courseIndex] = rec;

    W3.showTrails(S.path, res.idealPath, [S.layout.ball[0], S.layout.ball[1]]);
    S.idealYaw = res.idealYaw;
    const n = S.session.length;
    const avg = S.session.reduce((s, r) => s + Math.abs(r.alignDeg), 0) / n;
    let sessionLine = `This session: ${n} putt${n === 1 ? '' : 's'} · average alignment error ${avg.toFixed(1)}°`;
    let nextLabel = 'Next hole';
    if (S.mode === 'course' && S.courseIndex === MG.Course.COURSE_LENGTH - 1) {
      const done = S.round.filter(Boolean);
      const ra = done.reduce((s, r) => s + Math.abs(r.alignDeg), 0) / done.length;
      sessionLine = `Round complete: ${done.length} holes · average alignment error ${ra.toFixed(1)}° · ${done.filter((r) => r.holed).length} holed`;
      nextLabel = 'New round';
    }
    const ctx = {
      holeLabel: S.mode === 'course' ? `Hole ${S.courseIndex + 1}` : `Hole ${S.holeNo}`,
      sessionLine,
      nextLabel,
      behind: false
    };
    S.lastResult = { res, ctx };
    S.phase = 'result';
    input.exitLock();
    UI.hint(null);
    UI.showResult(res, ctx);
  }

  function toggleBehind() {
    if (S.phase !== 'result') return;
    S.behind = !S.behind;
    if (S.behind) {
      putter.setVisible(false);
      player.behindLine(S.layout.ball, S.idealYaw, Math.hypot(S.layout.hole[0], S.layout.hole[1]));
    } else {
      putter.setVisible(true);
      player.leaveBehind();
    }
    UI.setBehindLabel(S.behind);
  }

  // ------------------------------------------------------------ loop
  let last = performance.now();
  let clock = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    const ctl = input.poll(dt);

    if (S.layout) {
      if (S.phase === 'downswing') {
        const sw = S.swing, w = C.putter.pendulumOmega;
        sw.t += dt;
        const ph = Math.min(Math.PI / 2, w * sw.t);
        S.back = sw.A * Math.cos(ph);
        S.lateral = sw.L * Math.cos(ph);
        if (ph >= Math.PI / 2) {
          S.back = 0;
          S.lateral = 0;
          impact();
        }
      } else if (S.phase === 'rolling' || S.phase === 'result') {
        // follow-through: the head swings past the ball and stops
        const sw = S.swing;
        if (sw) {
          sw.follow += dt;
          const ph = Math.min(Math.PI / 2, C.putter.pendulumOmega * sw.follow);
          S.back = -sw.A * 0.8 * Math.sin(ph);
        }
      }

      if (S.phase === 'rolling') {
        let simDt = dt * (ctl.fast ? 3.5 : 1) * (S.timeScale || 1);
        const step = C.sim.dt;
        while (simDt > 1e-9) {
          const h = Math.min(step, simDt);
          Ph.step(S.ball, S.layout.world, h);
          simDt -= h;
          S.simTime += h;
          S.pathClock += h;
          if (S.pathClock >= 0.01) {
            S.pathClock = 0;
            if (S.ball.y > -0.005) S.path.push([S.ball.x, S.ball.z]);
          }
          if (!S.ball.moving) break;
        }
        W3.syncBall(S.ball);
        if (!S.ball.moving || S.simTime > 40) finishShot();
      }

      putter.update({
        ball: S.layout.ball,
        faceYaw: S.phase === 'aim' ? S.clubYaw : S.faceYaw,
        back: S.back,
        lateral: S.lateral,
        heelSide: heelSide(),
        handsBase: player.handsBase
      });
      player.update(dt, clock);
    } else {
      // Before the first hole: a slow orbit over an idle layout behind the menu.
      const B = S.backdrop, mx = B.hole[0] / 2, mz = B.hole[1] / 2;
      camera.position.set(mx + Math.sin(clock * 0.05) * 4.5, 2.4, mz + Math.cos(clock * 0.05) * 4.5);
      camera.lookAt(mx, 0, mz);
    }
    renderer.render(W3.scene, camera);
    requestAnimationFrame(frame);
  }

  // A backdrop layout behind the menu.
  (function backdrop() {
    const L = MG.Course.generate({ difficulty: 'medium', seed: 424242, kind: 'obscured', eyeSide: -1 });
    W3.buildLayout(L);
    S.backdrop = L;
    const b = Ph.createBall(L.ball[0], L.ball[1]);
    W3.resetBall(b);
    putter.setVisible(false);
  })();

  MG.Stats.load();
  requestAnimationFrame(frame);

  // Small hook for automated checks.
  function loadLayout(L) {
    S.layout = L;
    W3.buildLayout(L);
    setupAttempt();
  }
  MG.Game = { S, camera, renderer, player, W3, handlers, impact, finishShot, startSession, next, retry, toggleBehind, loadLayout };
})(typeof window !== 'undefined' ? window : globalThis);

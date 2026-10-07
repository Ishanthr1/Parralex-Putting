/*
 * scene.js — builds the Three.js world: sky, light, ground, the green with a
 * real cut-out cup, borders, obstacles, decoration, the ball and the
 * post-shot path ribbons.
 *
 * Nothing here draws a reference line, marker or grid. Textures are
 * non-directional noise on purpose.
 */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});
  const C = MG.CONFIG, U = MG.Util;

  const col = (hex) => new THREE.Color(hex).convertSRGBToLinear();

  // ------------------------------------------------------------- textures
  function noiseCanvas(size, base, amp, extra) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    const [r0, g0, b0] = base;
    for (let i = 0; i < size * size; i++) {
      const n = (Math.random() - 0.5) * amp;
      img.data[i * 4] = r0 + n;
      img.data[i * 4 + 1] = g0 + n;
      img.data[i * 4 + 2] = b0 + n;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    if (extra) extra(g, size);
    return c;
  }

  function texFrom(canvas, repeatMetres) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    if (repeatMetres) t.repeat.set(1 / repeatMetres, 1 / repeatMetres);
    return t;
  }

  // Short random fibres in every direction, so the felt never forms lines.
  function carpetCanvas() {
    return noiseCanvas(512, [34, 96, 52], 22, (g, s) => {
      for (let i = 0; i < 9000; i++) {
        const x = Math.random() * s, y = Math.random() * s, a = Math.random() * Math.PI * 2, l = 1 + Math.random() * 3;
        g.strokeStyle = Math.random() < 0.5 ? 'rgba(14,52,26,0.35)' : 'rgba(96,160,104,0.2)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
    });
  }

  function gravelCanvas() {
    return noiseCanvas(512, [118, 112, 100], 34, (g, s) => {
      for (let i = 0; i < 2600; i++) {
        const x = Math.random() * s, y = Math.random() * s, r = 1 + Math.random() * 3.5;
        const v = 80 + Math.random() * 90;
        g.fillStyle = `rgba(${v},${v - 6},${v - 14},0.55)`;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    });
  }

  function woodCanvas() {
    return noiseCanvas(256, [126, 84, 52], 22, (g, s) => {
      for (let i = 0; i < 70; i++) {
        const y = Math.random() * s;
        g.strokeStyle = `rgba(70,40,20,${0.08 + Math.random() * 0.12})`;
        g.lineWidth = 1 + Math.random() * 2;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(s * 0.3, y + Math.random() * 6 - 3, s * 0.7, y + Math.random() * 6 - 3, s, y);
        g.stroke();
      }
    });
  }

  function stoneCanvas() {
    return noiseCanvas(256, [138, 136, 128], 34, (g, s) => {
      for (let i = 0; i < 400; i++) {
        const v = 90 + Math.random() * 90;
        g.fillStyle = `rgba(${v},${v},${v - 6},0.25)`;
        g.beginPath();
        g.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 7, 0, Math.PI * 2);
        g.fill();
      }
    });
  }

  // Bump map with a dimple pattern for the ball (equirectangular).
  function dimpleCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 512, 256);
    const rows = 22;
    for (let r = 0; r < rows; r++) {
      const lat = ((r + 0.5) / rows) * Math.PI;
      const count = Math.max(4, Math.round(44 * Math.sin(lat)));
      const y = ((r + 0.5) / rows) * 256;
      for (let k = 0; k < count; k++) {
        const x = ((k + (r % 2) * 0.5) / count) * 512;
        const rx = (512 / count) * 0.36, ry = (256 / rows) * 0.38;
        const grd = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
        grd.addColorStop(0, '#6a6a6a');
        grd.addColorStop(1, '#ffffff');
        g.fillStyle = grd;
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    return c;
  }

  function cupCanvas() {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    // v = 1 at the top of the cylinder (canvas top)
    grd.addColorStop(0, '#f2f2ee');
    grd.addColorStop(0.16, '#e6e6e0');
    grd.addColorStop(0.2, '#3a3d3a');
    grd.addColorStop(1, '#1d1f1d');
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 256);
    return c;
  }

  // ------------------------------------------------------------- helpers
  function polyArea(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length];
      a += x1 * z2 - x2 * z1;
    }
    return a / 2;
  }

  // Outward miter offset of a simple polygon.
  function offsetPoly(poly, t) {
    const n = poly.length;
    const ccw = polyArea(poly) > 0; // in (x,z) with this sign convention
    const normals = [];
    for (let i = 0; i < n; i++) {
      const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % n];
      const ex = x2 - x1, ez = z2 - z1, l = Math.hypot(ex, ez);
      // outward normal: for positive area the interior is to the right of (ex,ez) rotated… pick by sign
      let nx = ez / l, nz = -ex / l;
      if (!ccw) {
        nx = -nx;
        nz = -nz;
      }
      normals.push([nx, nz]);
    }
    return poly.map((p, i) => {
      const n1 = normals[(i - 1 + n) % n], n2 = normals[i];
      const d = 1 + n1[0] * n2[0] + n1[1] * n2[1];
      const k = d > 0.15 ? t / d : t / 0.15;
      return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k];
    });
  }

  // Shape in the XY plane that maps onto the ground after rotation.x = −π/2.
  const toShapePts = (poly) => poly.map(([x, z]) => new THREE.Vector2(x, -z));

  function disposeGroup(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
    while (g.children.length) g.remove(g.children[0]);
  }

  function ribbon(points, width, y, color, opacity) {
    const pos = [], idx = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const px = -dz * width * 0.5, pz = dx * width * 0.5;
      pos.push(points[i][0] + px, y, points[i][1] + pz, points[i][0] - px, y, points[i][1] - pz);
      if (i < n - 1) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color: col(color), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    return m;
  }

  // ------------------------------------------------------------- world
  MG.World3D = function () {
    const scene = new THREE.Scene();
    const fogCol = col('#cfdde3');
    scene.fog = new THREE.Fog(fogCol, 40, 160);

    // Sky dome with a vertical gradient.
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: col('#5d8fc4') }, horizon: { value: col('#d6e4ea') }, bottom: { value: col('#b9c4b2') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }'
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 32, 16), skyMat);
    scene.add(sky);

    const hemi = new THREE.HemisphereLight(col('#cfe3ff'), col('#5a5340'), 0.55);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(col('#fff4e2'), 1.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.012;
    scene.add(sun);
    scene.add(sun.target);

    // Ground (gravel) far beyond the course.
    const gravelTex = texFrom(gravelCanvas(), 1.4);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 1, color: col('#ffffff') })
    );
    ground.material.map.repeat.set(500 / 1.4, 500 / 1.4);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.04;
    ground.receiveShadow = true;
    scene.add(ground);

    const courseGroup = new THREE.Group();
    const decoGroup = new THREE.Group();
    const trailGroup = new THREE.Group();
    scene.add(courseGroup, decoGroup, trailGroup);

    const tex = {
      carpet: texFrom(carpetCanvas(), 0.6),
      wood: texFrom(woodCanvas(), 0.5),
      stone: texFrom(stoneCanvas(), 0.4),
      cup: (() => {
        const t = new THREE.CanvasTexture(cupCanvas());
        t.encoding = THREE.sRGBEncoding;
        return t;
      })(),
      dimples: new THREE.CanvasTexture(dimpleCanvas())
    };

    // Ball
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(C.ball.radius, 40, 28),
      new THREE.MeshStandardMaterial({ color: col('#fbfbf7'), roughness: 0.38, bumpMap: tex.dimples, bumpScale: 0.0006 })
    );
    ballMesh.castShadow = true;
    ballMesh.receiveShadow = true;
    scene.add(ballMesh);

    function buildLayout(L) {
      disposeGroup(courseGroup);
      disposeGroup(decoGroup);
      clearTrails();
      const minimal = L.cues === 'minimal';
      const R = L.holeR;
      const [hx, hz] = L.hole;

      // --- the green with the cup cut out
      const shape = new THREE.Shape(toShapePts(L.boundary));
      const holePath = new THREE.Path();
      holePath.absarc(hx, -hz, R, 0, Math.PI * 2, true);
      shape.holes.push(holePath);
      const greenGeo = new THREE.ShapeGeometry(shape, 64);
      const greenMat = new THREE.MeshStandardMaterial({
        color: minimal ? col('#2a6a3e') : col('#ffffff'),
        map: minimal ? null : tex.carpet,
        roughness: 0.96
      });
      const green = new THREE.Mesh(greenGeo, greenMat);
      green.rotation.x = -Math.PI / 2;
      green.receiveShadow = true;
      courseGroup.add(green);

      // Shadow-only collar so the cup interior is shaded by the green around it.
      const collar = new THREE.Mesh(
        new THREE.RingGeometry(R, R + 0.25, 64),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
      );
      collar.material.shadowSide = THREE.DoubleSide;
      collar.rotation.x = -Math.PI / 2;
      collar.position.set(hx, -0.004, hz);
      collar.castShadow = true;
      courseGroup.add(collar);

      // Cup liner and floor
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R, C.hole.depth, 64, 1, true),
        new THREE.MeshStandardMaterial({ map: minimal ? null : tex.cup, color: minimal ? col('#9a9d97') : col('#ffffff'), side: THREE.BackSide, roughness: 0.7 })
      );
      cup.position.set(hx, -C.hole.depth / 2 - 0.0005, hz);
      cup.receiveShadow = true;
      courseGroup.add(cup);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ color: col('#1b1d1b'), roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(hx, -C.hole.depth, hz);
      floor.receiveShadow = true;
      courseGroup.add(floor);

      // --- borders: one extruded ring around the green
      const t = C.wall.thickness;
      const outer = offsetPoly(L.boundary, t);
      const ringShape = new THREE.Shape(toShapePts(outer));
      ringShape.holes.push(new THREE.Path(toShapePts(L.boundary)));
      const wallH = C.wall.height + 0.04;
      const wallGeo = new THREE.ExtrudeGeometry(ringShape, { depth: wallH, bevelEnabled: false, curveSegments: 1 });
      const wallMat = new THREE.MeshStandardMaterial({
        map: minimal ? null : tex.wood,
        color: minimal ? col('#285c39') : col('#ffffff'),
        roughness: 0.8
      });
      const walls = new THREE.Mesh(wallGeo, wallMat);
      walls.rotation.x = -Math.PI / 2;
      walls.position.y = -0.04;
      walls.castShadow = true;
      walls.receiveShadow = true;
      courseGroup.add(walls);

      // --- obstacles
      for (const o of L.obstacles) {
        let m;
        if (o.type === 'box') {
          m = new THREE.Mesh(
            new THREE.BoxGeometry(o.w, o.h + 0.04, o.d),
            new THREE.MeshStandardMaterial({ map: minimal ? null : tex.stone, color: minimal ? col('#4b6b55') : col('#ffffff'), roughness: 0.9 })
          );
          m.position.set(o.x, (o.h + 0.04) / 2 - 0.04, o.z);
          m.rotation.y = -o.rot;
        } else {
          m = new THREE.Mesh(
            new THREE.CylinderGeometry(o.r, o.r, o.h + 0.04, 28),
            new THREE.MeshStandardMaterial({ color: minimal ? col('#4b6b55') : col('#b8452f'), roughness: 0.6 })
          );
          m.position.set(o.x, (o.h + 0.04) / 2 - 0.04, o.z);
        }
        m.castShadow = true;
        m.receiveShadow = true;
        courseGroup.add(m);
      }

      if (!minimal) decorate(L);

      // --- sun and its shadow frustum around the course
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of outer) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const half = Math.max(maxX - minX, maxZ - minZ) / 2 + 1.5;
      const az = L.sunAzimuth != null ? L.sunAzimuth : 2.2, el = 0.95;
      sun.position.set(cx + Math.cos(az) * Math.cos(el) * 30, Math.sin(el) * 30, cz + Math.sin(az) * Math.cos(el) * 30);
      sun.target.position.set(cx, 0, cz);
      const sc = sun.shadow.camera;
      sc.left = -half;
      sc.right = half;
      sc.top = half;
      sc.bottom = -half;
      sc.near = 1;
      sc.far = 70;
      sc.updateProjectionMatrix();
    }

    function decorate(L) {
      const bushMat = new THREE.MeshStandardMaterial({ color: col('#3f6b34'), roughness: 1, flatShading: true });
      const bushMat2 = new THREE.MeshStandardMaterial({ color: col('#557d3b'), roughness: 1, flatShading: true });
      const rockMat = new THREE.MeshStandardMaterial({ color: col('#9a958a'), roughness: 1, flatShading: true });
      const trunkMat = new THREE.MeshStandardMaterial({ color: col('#5b4632'), roughness: 1 });
      const crownMat = new THREE.MeshStandardMaterial({ color: col('#2f5a33'), roughness: 1, flatShading: true });
      const inside = (x, z) => MG.Course.pointInPoly(x, z, L.boundary);
      const nearBoundary = (x, z) => {
        let m = Infinity;
        for (let i = 0; i < L.boundary.length; i++) {
          const a = L.boundary[i], b = L.boundary[(i + 1) % L.boundary.length];
          m = Math.min(m, U.pointSegDist(x, z, a[0], a[1], b[0], b[1]).d);
        }
        return m;
      };
      // Low planting around the course, kept clear of the borders and of the
      // spot where the player stands.
      const eyeX = -U.dirX(L.stanceYaw) * 0.6, eyeZ = -U.dirZ(L.stanceYaw) * 0.6;
      let placed = 0;
      for (let i = 0; i < 200 && placed < 22; i++) {
        const a = Math.random() * Math.PI * 2, d = 1.5 + Math.random() * 9;
        const f = Math.random();
        const x = L.hole[0] * f + Math.cos(a) * d, z = L.hole[1] * f + Math.sin(a) * d;
        if (inside(x, z) || nearBoundary(x, z) < 0.9 || Math.hypot(x - eyeX, z - eyeZ) < 2.4) continue;
        const r = Math.random();
        let m;
        if (r < 0.6) {
          const s = 0.14 + Math.random() * 0.2;
          m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), Math.random() < 0.5 ? bushMat : bushMat2);
          m.scale.y = 0.75;
          m.position.set(x, s * 0.5, z);
        } else {
          const s = 0.05 + Math.random() * 0.12;
          m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
          m.position.set(x, s * 0.35, z);
          m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        }
        m.castShadow = true;
        m.receiveShadow = true;
        decoGroup.add(m);
        placed++;
      }
      // A loose ring of trees far away.
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2, d = 22 + Math.random() * 30;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        const h = 3 + Math.random() * 4;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, h * 0.4, 8), trunkMat);
        trunk.position.set(x, h * 0.2, z);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.32, 1), crownMat);
        crown.position.set(x, h * 0.62, z);
        crown.scale.y = 1.25;
        decoGroup.add(trunk, crown);
      }
    }

    // --- ball rendering (position + rolling rotation from the spin integral)
    const _q = new THREE.Quaternion(), _axis = new THREE.Vector3();
    let lastSpin = [0, 0];
    function resetBall(b) {
      lastSpin = [b.spinDX, b.spinDZ];
      ballMesh.position.set(b.x, b.y, b.z);
      ballMesh.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    }
    function syncBall(b) {
      ballMesh.position.set(b.x, b.y, b.z);
      const dx = b.spinDX - lastSpin[0], dz = b.spinDZ - lastSpin[1];
      lastSpin = [b.spinDX, b.spinDZ];
      const d = Math.hypot(dx, dz);
      if (d > 1e-7) {
        _axis.set(dz / d, 0, -dx / d);
        _q.setFromAxisAngle(_axis, d / C.ball.radius);
        ballMesh.quaternion.premultiply(_q);
      }
    }

    // --- post-shot ribbons (only ever created after the ball has stopped)
    function showTrails(actual, ideal, start) {
      clearTrails();
      if (ideal && ideal.length > 1) trailGroup.add(ribbon(ideal, 0.012, 0.0025, '#ffd36a', 0.85));
      if (actual && actual.length > 1) trailGroup.add(ribbon(actual, 0.016, 0.003, '#ffffff', 0.9));
      if (start) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(C.ball.radius * 0.8, C.ball.radius * 1.15, 32),
          new THREE.MeshBasicMaterial({ color: col('#ffffff'), transparent: true, opacity: 0.85, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(start[0], 0.0035, start[1]);
        trailGroup.add(ring);
      }
    }
    function clearTrails() {
      disposeGroup(trailGroup);
    }

    return { scene, sun, ballMesh, buildLayout, resetBall, syncBall, showTrails, clearTrails, col };
  };
})(typeof window !== 'undefined' ? window : globalThis);

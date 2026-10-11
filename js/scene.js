(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});
  const cfg = PP.cfg, u = PP.util;

  const col = (hex) => new THREE.Color(hex).convertSRGBToLinear();

  function noiseTile(size, base, amp, extra) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    const [r0, g0, b0] = base;
    for (let i = 0; i < size * size; i++) {
      const n = (Math.random() - 0.5) * amp;
      img.data[i*4] = r0 + n;
      img.data[i*4 + 1] = g0 + n;
      img.data[i*4 + 2] = b0 + n;
      img.data[i*4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    if (extra) extra(g, size);
    return c;
  }

  function mkTex(canvas, repeatMetres) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    if (repeatMetres) t.repeat.set(1 / repeatMetres, 1 / repeatMetres);
    return t;
  }

  function feltTile() {
    return noiseTile(512, [38, 92, 54], 20, (g, s) => {
      for (let i = 0; i < 9000; i++) {
        const x = Math.random() * s, y = Math.random() * s, a = Math.random() * Math.PI * 2, l = 1 + Math.random() * 3;
        g.strokeStyle = Math.random() < 0.5 ? 'rgba(16,54,28,0.33)' : 'rgba(104,162,108,0.2)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
    });
  }

  function meadowTile() {
    return noiseTile(512, [96, 104, 62], 30, (g, s) => {
      for (let i = 0; i < 5200; i++) {
        const x = Math.random() * s, y = Math.random() * s, a = Math.random() * Math.PI * 2, l = 2 + Math.random() * 5;
        const r = Math.random();
        g.strokeStyle = r < 0.42 ? 'rgba(66,76,40,0.4)' : r < 0.78 ? 'rgba(138,140,78,0.3)' : 'rgba(176,122,52,0.33)';
        g.lineWidth = 1 + Math.random();
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
      for (let i = 0; i < 520; i++) {
        const x = Math.random() * s, y = Math.random() * s;
        g.fillStyle = ['rgba(186,104,38,0.5)','rgba(204,142,48,0.45)','rgba(158,70,36,0.42)'][i % 3];
        g.beginPath();
        g.ellipse(x, y, 2 + Math.random() * 3, 1.2 + Math.random() * 2, Math.random() * 3, 0, Math.PI * 2);
        g.fill();
      }
    });
  }

  function timberTile() {
    return noiseTile(256, [108, 76, 50], 20, (g, s) => {
      for (let i = 0; i < 80; i++) {
        const y = Math.random() * s;
        g.strokeStyle = `rgba(58,36,20,${0.1 + Math.random() * 0.14})`;
        g.lineWidth = 1 + Math.random() * 2;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(s * 0.3, y + Math.random() * 6 - 3, s * 0.7, y + Math.random() * 6 - 3, s, y);
        g.stroke();
      }
    });
  }

  function stoneTile() {
    return noiseTile(256, [142, 139, 130], 26, (g, s) => {
      g.strokeStyle = 'rgba(70,68,62,0.45)';
      g.lineWidth = 2;
      for (let row = 0; row < 6; row++) {
        const y = (row / 6) * s;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(s, y);
        g.stroke();
        const off = (row % 2) * 0.5;
        for (let k = 0; k < 4; k++) {
          const x = ((k + off) / 4) * s;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + s / 6);
          g.stroke();
        }
      }
      for (let i = 0; i < 300; i++) {
        const v = 100 + Math.random() * 80;
        g.fillStyle = `rgba(${v},${v},${v - 8},0.2)`;
        g.beginPath();
        g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 5, 0, Math.PI * 2);
        g.fill();
      }
    });
  }

  function sandTile() {
    return noiseTile(256, [206, 186, 148], 22, (g, s) => {
      for (let i = 0; i < 900; i++) {
        const v = 170 + Math.random() * 60;
        g.fillStyle = `rgba(${v},${v - 18},${v - 48},0.5)`;
        g.beginPath();
        g.arc(Math.random() * s, Math.random() * s, 0.8 + Math.random() * 1.6, 0, Math.PI * 2);
        g.fill();
      }
    });
  }

  function dimpleTile() {
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

  function cupTile() {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#f2f2ee');
    grd.addColorStop(0.16, '#e6e6e0');
    grd.addColorStop(0.2, '#3a3d3a');
    grd.addColorStop(1, '#1d1f1d');
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 256);
    return c;
  }

  function areaOf(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length];
      a += x1 * z2 - x2 * z1;
    }
    return a / 2;
  }

  function growPoly(poly, t) {
    const n = poly.length;
    const ccw = areaOf(poly) > 0;
    const normals = [];
    for (let i = 0; i < n; i++) {
      const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % n];
      const ex = x2 - x1, ez = z2 - z1, l = Math.hypot(ex, ez);
      let nx = ez / l, nz = -ex / l;
      if (!ccw) {
        nx = -nx;
        nz = -nz;
      }
      normals.push([nx, nz]);
    }
    const lim = Math.abs(t) * 2.0;
    return poly.map((p, i) => {
      const n1 = normals[(i - 1 + n) % n], n2 = normals[i];
      const d = 1 + n1[0] * n2[0] + n1[1] * n2[1];
      const k = d > 0.15 ? t / d : t / 0.15;
      let ox = (n1[0] + n2[0]) * k, oz = (n1[1] + n2[1]) * k;
      const m = Math.hypot(ox, oz);
      if (m > lim) {
        ox *= lim / m;
        oz *= lim / m;
      }
      return [p[0] + ox, p[1] + oz];
    });
  }

  const shapePts = (poly) => poly.map(([x, z]) => new THREE.Vector2(x, -z));

  function wipe(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
    while (g.children.length) g.remove(g.children[0]);
  }

  function strip(points, width, y, color, opacity) {
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

  function greenMesh(L, terr, mat) {
    const off = PP.layouts.chains(L.path, L.hw, 0.13);
    const rows = off.left.length;
    let widest = 0;
    for (let i = 0; i < rows; i++) {
      widest = Math.max(widest, Math.hypot(off.right[i][0] - off.left[i][0], off.right[i][1] - off.left[i][1]));
    }
    const cols = Math.max(6, Math.min(18, Math.round(widest / 0.13)));
    const cx = L.hole[0], cz = L.hole[1];
    const cut = 0.26;
    const pos = [], uvs = [], idx = [];
    const grid = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j <= cols; j++) {
        const t = j / cols;
        const x = off.left[i][0] + (off.right[i][0] - off.left[i][0]) * t;
        const z = off.left[i][1] + (off.right[i][1] - off.left[i][1]) * t;
        row.push(pos.length / 3);
        pos.push(x, terr.y(x, z), z);
        uvs.push(x, z);
      }
      grid.push(row);
    }
    const at = (i, j) => grid[i][j] * 3;
    let gap = 0;
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols; j++) {
        const q = [at(i, j), at(i, j+1), at(i+1, j), at(i+1, j+1)];
        let mx = 0, mz = 0;
        for (const k of q) {
          mx += pos[k] / 4;
          mz += pos[k+2] / 4;
        }
        if (Math.hypot(mx - cx, mz - cz) < cut) {
          for (const k of q) gap = Math.max(gap, Math.hypot(pos[k] - cx, pos[k+2] - cz));
          continue;
        }
        const a = grid[i][j], b = grid[i][j+1], c = grid[i+1][j], d = grid[i+1][j+1];
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.userData.gap = gap;
    return m;
  }

  function cupApron(cx, cz, inner, outer, cupY, terr, mat) {
    const segs = 40, rings = 5;
    const pos = [], uvs = [], idx = [];
    for (let r = 0; r <= rings; r++) {
      const f = r / rings;
      const rad = inner + (outer - inner) * f;
      const blend = f * f * (3 - 2 * f);
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
        pos.push(x, cupY + (terr.y(x, z) - cupY) * blend + 0.0009, z);
        uvs.push(x, z);
      }
    }
    for (let r = 0; r < rings; r++) {
      const a0 = r * segs, b0 = (r + 1) * segs;
      for (let i = 0; i < segs; i++) {
        const j = (i + 1) % segs;
        idx.push(a0 + i, b0 + j, b0 + i, a0 + i, a0 + j, b0 + j);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    return m;
  }

  function railMesh(L, terr, mat, hgt, thick, floorY) {
    const off = PP.layouts.chains(L.path, L.hw, 0.13);
    const loop = off.left.concat(off.right.slice().reverse());
    const out = growPoly(loop, thick);
    const pos = [], uvs = [], idx = [];
    const n = loop.length;
    let run = 0;
    for (let i = 0; i <= n; i++) {
      const k = i % n;
      const a = loop[k], b = out[k];
      const gy = terr.y(a[0], a[1]);
      const foot = Math.min(gy - 0.05, floorY == null ? gy - 0.05 : floorY - 0.02);
      const base = pos.length / 3;
      pos.push(a[0], foot, a[1]);
      pos.push(a[0], gy + hgt, a[1]);
      pos.push(b[0], gy + hgt, b[1]);
      pos.push(b[0], foot, b[1]);
      uvs.push(run, 0, run, hgt, run + thick, hgt, run + thick, 0);
      if (i > 0) {
        const p = base - 4;
        idx.push(p+1, base+1, p+2, base+1, base+2, p+2);
        idx.push(p, p+1, base, p+1, base+1, base);
        idx.push(p+3, base+3, p+2, base+3, base+2, p+2);
      }
      const nx = loop[(k + 1) % n];
      run += Math.hypot(nx[0] - a[0], nx[1] - a[1]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  PP.buildScene = function () {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(col('#ccd9e2'), 70, 320);

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: col('#275f9e') },
        mid: { value: col('#86b2d6') },
        horizon: { value: col('#e8eef0') },
        bottom: { value: col('#8e9a86') }
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP;' +
        'void main(){ float h = vP.y; vec3 c;' +
        'if (h > 0.0) { c = h < 0.35 ? mix(horizon, mid, pow(h/0.35, 0.7)) : mix(mid, top, pow((h-0.35)/0.65, 0.8)); }' +
        'else { c = mix(horizon, bottom, pow(-h, 0.45)); }' +
        'gl_FragColor = vec4(c, 1.0); }'
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), skyMat));

    const hemi = new THREE.HemisphereLight(col('#c3dcff'), col('#6b6048'), 0.5);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(col('#ffe9c6'), 2.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.012;
    scene.add(sun);
    scene.add(sun.target);
    const rim = new THREE.DirectionalLight(col('#9fc2e8'), 0.35);
    rim.position.set(-24, 14, 18);
    scene.add(rim);

    const tex = {
      felt: mkTex(feltTile(), 0.6),
      meadow: mkTex(meadowTile(), 2.2),
      timber: mkTex(timberTile(), 0.5),
      stone: mkTex(stoneTile(), 0.7),
      sand: mkTex(sandTile(), 0.5),
      cup: (() => {
        const t = new THREE.CanvasTexture(cupTile());
        t.encoding = THREE.sRGBEncoding;
        return t;
      })(),
      dimples: new THREE.CanvasTexture(dimpleTile())
    };

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshStandardMaterial({ map: tex.meadow, roughness: 1, color: col('#ffffff') })
    );
    ground.material.map.repeat.set(700 / 2.2, 700 / 2.2);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    scene.add(ground);

    scene.add(mountains());

    const courseGroup = new THREE.Group();
    const decoGroup = new THREE.Group();
    const trailGroup = new THREE.Group();
    scene.add(courseGroup, decoGroup, trailGroup);

    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.ball.r, 40, 28),
      new THREE.MeshStandardMaterial({ color: col('#fbfbf7'), roughness: 0.38, bumpMap: tex.dimples, bumpScale: 0.0006 })
    );
    ballMesh.castShadow = false;
    ballMesh.receiveShadow = true;
    scene.add(ballMesh);

    const blobTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 31);
      grd.addColorStop(0, 'rgba(0,0,0,0.62)');
      grd.addColorStop(0.5, 'rgba(0,0,0,0.34)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      return t;
    })();
    const ballShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.ball.r * 4.6, cfg.ball.r * 4.6),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: false })
    );
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.renderOrder = 3;
    scene.add(ballShadow);
    let terrRef = PP.terrain.flat;

    function syncShadow(b) {
      const gy = terrRef.y(b.x, b.z);
      const low = b.y - cfg.ball.r;
      if (low < gy - 0.015) {
        ballShadow.visible = false;
        return;
      }
      const air = Math.max(0, low - gy);
      const k = Math.max(0, 1 - air / 0.55);
      ballShadow.visible = k > 0.03;
      ballShadow.position.set(b.x, gy + 0.0045, b.z);
      const sc = 1 + air * 1.2;
      ballShadow.scale.set(sc, sc, 1);
      ballShadow.material.opacity = k * k;
    }

    function mountains() {
      const g = new THREE.Group();
      const far = new THREE.MeshStandardMaterial({ color: col('#5b7290'), roughness: 1, flatShading: true });
      const near = new THREE.MeshStandardMaterial({ color: col('#44593f'), roughness: 1, flatShading: true });
      const snow = new THREE.MeshStandardMaterial({ color: col('#eef3f6'), roughness: 0.9, flatShading: true });
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + Math.random() * 0.12;
        const d = 180 + Math.random() * 90;
        const h = 34 + Math.random() * 54;
        const r = 26 + Math.random() * 26;
        const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5 + (i % 3), 1), Math.random() < 0.5 ? far : near);
        peak.position.set(Math.cos(a) * d, h / 2 - 6, Math.sin(a) * d);
        peak.rotation.y = Math.random() * 3;
        g.add(peak);
        if (h > 58) {
          const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, h * 0.26, 5, 1), snow);
          cap.position.set(peak.position.x, h - h * 0.13 - 6, peak.position.z);
          cap.rotation.y = peak.rotation.y;
          g.add(cap);
        }
      }
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * Math.PI * 2, d = 55 + Math.random() * 100;
        const h = 6 + Math.random() * 9;
        const t = new THREE.Mesh(new THREE.ConeGeometry(h * 0.26, h, 6, 1), near);
        t.position.set(Math.cos(a) * d, h / 2 - 1, Math.sin(a) * d);
        g.add(t);
      }
      return g;
    }

    function pine(x, z, h, y0) {
      const g = new THREE.Group();
      const trunkMat = new THREE.MeshStandardMaterial({ color: col('#4a3a28'), roughness: 1 });
      const needleMat = new THREE.MeshStandardMaterial({ color: col('#2d4f31'), roughness: 1, flatShading: true });
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.035, h * 0.055, h * 0.32, 7), trunkMat);
      tr.position.y = h * 0.16;
      g.add(tr);
      for (let k = 0; k < 3; k++) {
        const s = 1 - k * 0.26;
        const c = new THREE.Mesh(new THREE.ConeGeometry(h * 0.3 * s, h * 0.42, 8, 1), needleMat);
        c.position.y = h * (0.3 + k * 0.22);
        g.add(c);
      }
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.position.set(x, y0 || 0, z);
      return g;
    }

    function birch(x, z, h, y0) {
      const g = new THREE.Group();
      const bark = new THREE.MeshStandardMaterial({ color: col('#cfcabb'), roughness: 0.95, flatShading: true });
      const tone = [col('#c98a24'), col('#b35f22'), col('#d2a632')][Math.floor(Math.random() * 3)];
      const leaf = new THREE.MeshStandardMaterial({ color: tone, roughness: 1, flatShading: true });
      const th = h * 0.62;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.028, h * 0.055, th, 7), bark);
      tr.position.y = th / 2;
      g.add(tr);
      for (let k = 0; k < 3; k++) {
        const r = h * (0.21 - k * 0.045);
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf);
        c.position.set((Math.random() - 0.5) * h * 0.12, th + r * 0.55 + k * r * 0.72, (Math.random() - 0.5) * h * 0.12);
        c.scale.set(1.15, 0.8, 1.15);
        g.add(c);
      }
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.position.set(x, y0 || 0, z);
      g.rotation.y = Math.random() * 3;
      return g;
    }

    function zoneDisc(q, terr, mat) {
      const segs = 34, rings = 6;
      const lift = 0.014;
      const pos = [], uvs = [], idx = [];
      pos.push(q.x, terr.y(q.x, q.z) + lift, q.z);
      uvs.push(q.x, q.z);
      for (let r = 1; r <= rings; r++) {
        const rad = (q.r * r) / rings;
        for (let i = 0; i < segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          const x = q.x + Math.cos(a) * rad, z = q.z + Math.sin(a) * rad;
          pos.push(x, terr.y(x, z) + lift * (1 - 0.45 * (r / rings)), z);
          uvs.push(x, z);
        }
      }
      for (let i = 0; i < segs; i++) idx.push(0, 1 + ((i + 1) % segs), 1 + i);
      for (let r = 0; r < rings - 1; r++) {
        const a0 = 1 + r * segs, b0 = 1 + (r + 1) * segs;
        for (let i = 0; i < segs; i++) {
          const j = (i + 1) % segs;
          idx.push(a0 + i, b0 + j, b0 + i, a0 + i, a0 + j, b0 + j);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      return m;
    }

    function build(L) {
      terrRef = L.terrain || PP.terrain.flat;
      wipe(courseGroup);
      wipe(decoGroup);
      wipeTrails();
      const terr = L.terrain || PP.terrain.flat;
      const R = L.cupR;
      const [hx, hz] = L.hole;
      const cupY = terr.y(hx, hz);

      let lowest = 0;
      if (L.path) {
        const ch = PP.layouts.chains(L.path, L.hw, 0.2);
        for (let k = 0; k < ch.left.length; k++) {
          for (let t = 0; t <= 4; t++) {
            const f = t / 4;
            const sx = ch.left[k][0] + (ch.right[k][0] - ch.left[k][0]) * f;
            const sz = ch.left[k][1] + (ch.right[k][1] - ch.left[k][1]) * f;
            lowest = Math.min(lowest, terr.y(sx, sz));
          }
        }
      }
      const base = Math.min(-0.06, lowest - 0.09);
      ground.position.y = base;
      decoGroup.position.y = base + 0.06;

      const feltMat = new THREE.MeshStandardMaterial({ map: tex.felt, color: col('#ffffff'), roughness: 0.96 });
      const stoneMat = new THREE.MeshStandardMaterial({ map: tex.stone, color: col('#ffffff'), roughness: 0.92 });
      const timberMat = new THREE.MeshStandardMaterial({ map: tex.timber, color: col('#ffffff'), roughness: 0.82 });

      if (L.path) {
        const gm = greenMesh(L, terr, feltMat);
        courseGroup.add(gm);
        courseGroup.add(railMesh(L, terr, L.index % 2 ? timberMat : stoneMat, cfg.rail.h + 0.05, cfg.rail.t, base));
        const outer = Math.max(R + 0.12, (gm.userData.gap || 0.3) + 0.05);
        courseGroup.add(cupApron(hx, hz, R, outer, cupY, terr, feltMat));
      } else {
        const shape = new THREE.Shape(shapePts(L.boundary));
        const cutp = new THREE.Path();
        cutp.absarc(hx, -hz, R, 0, Math.PI * 2, true);
        shape.holes.push(cutp);
        const green = new THREE.Mesh(new THREE.ShapeGeometry(shape, 64), feltMat);
        green.rotation.x = -Math.PI / 2;
        green.receiveShadow = true;
        courseGroup.add(green);
        const outer = growPoly(L.boundary, cfg.rail.t);
        const rs = new THREE.Shape(shapePts(outer));
        rs.holes.push(new THREE.Path(shapePts(L.boundary)));
        const wallH = cfg.rail.h + 0.04;
        const walls = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: wallH, bevelEnabled: false, curveSegments: 1 }), timberMat);
        walls.rotation.x = -Math.PI / 2;
        walls.position.y = -0.05;
        walls.castShadow = true;
        walls.receiveShadow = true;
        courseGroup.add(walls);
      }

      const collar = new THREE.Mesh(
        new THREE.RingGeometry(R, R + 0.25, 48),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
      );
      collar.material.shadowSide = THREE.DoubleSide;
      collar.rotation.x = -Math.PI / 2;
      collar.position.set(hx, cupY - 0.004, hz);
      collar.castShadow = true;
      courseGroup.add(collar);

      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R, cfg.cup.depth, 48, 1, true),
        new THREE.MeshStandardMaterial({ map: tex.cup, color: col('#ffffff'), side: THREE.BackSide, roughness: 0.7 })
      );
      cup.position.set(hx, cupY - cfg.cup.depth / 2 - 0.0005, hz);
      cup.receiveShadow = true;
      courseGroup.add(cup);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 32), new THREE.MeshStandardMaterial({ color: col('#1b1d1b'), roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(hx, cupY - cfg.cup.depth, hz);
      courseGroup.add(floor);

      const flag = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.78, 8),
        new THREE.MeshStandardMaterial({ color: col('#e8e8e4'), roughness: 0.5 }));
      pole.position.y = 0.39;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.13),
        new THREE.MeshStandardMaterial({ color: col('#c23c2c'), roughness: 0.8, side: THREE.DoubleSide }));
      cloth.position.set(0.1, 0.68, 0);
      flag.add(pole, cloth);
      flag.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      flag.position.set(hx, cupY, hz);
      courseGroup.add(flag);

      for (const q of (terr.zones || [])) {
        const isSand = q.kind === 'sand';
        courseGroup.add(zoneDisc(q, terr, new THREE.MeshStandardMaterial({
          map: isSand ? tex.sand : tex.felt,
          color: isSand ? col('#b8a278') : col('#7e9158'),
          roughness: 1
        })));
      }

      for (const o of L.obstacles || []) {
        let m;
        if (o.type === 'box') {
          m = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h + 0.04, o.d), stoneMat);
          m.position.set(o.x, terr.y(o.x, o.z) + (o.h + 0.04) / 2 - 0.04, o.z);
          m.rotation.y = -o.rot;
        } else {
          m = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, o.h + 0.04, 20),
            new THREE.MeshStandardMaterial({ color: col('#b8452f'), roughness: 0.6 }));
          m.position.set(o.x, terr.y(o.x, o.z) + (o.h + 0.04) / 2 - 0.04, o.z);
        }
        m.castShadow = true;
        m.receiveShadow = true;
        courseGroup.add(m);
      }

      for (const tr of L.tracks || []) {
        const curve = new THREE.CatmullRomCurve3(tr.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
        const bore = cfg.ball.r * 2.2;
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, Math.max(16, tr.pts.length * 2), bore, 16, false),
          new THREE.MeshStandardMaterial({
            color: tr.kind === 'loop' ? col('#7fd2ea') : col('#b8c2bd'),
            roughness: 0.18,
            metalness: 0.15,
            transparent: true,
            opacity: tr.kind === 'loop' ? 0.52 : 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        );
        tube.renderOrder = 1;
        courseGroup.add(tube);
        const rimMat = new THREE.MeshStandardMaterial({ color: col('#223037'), roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide });
        const mawMat = new THREE.MeshBasicMaterial({ color: col('#0c1114'), side: THREE.DoubleSide });
        for (const end of [0, tr.pts.length - 1]) {
          const p = tr.pts[end];
          const q = tr.pts[end === 0 ? 1 : tr.pts.length - 2];
          const rim = new THREE.Mesh(new THREE.RingGeometry(bore, bore + 0.05, 24), rimMat);
          rim.position.set(p[0], p[1], p[2]);
          rim.lookAt(q[0], q[1], q[2]);
          rim.castShadow = true;
          courseGroup.add(rim);
          if (tr.kind !== 'loop') {
            const maw = new THREE.Mesh(new THREE.CircleGeometry(bore, 24), mawMat);
            maw.position.set(p[0] + (q[0] - p[0]) * 0.02, p[1], p[2] + (q[2] - p[2]) * 0.02);
            maw.lookAt(q[0], q[1], q[2]);
            courseGroup.add(maw);
          }
        }
        if (tr.kind === 'loop') {
          const frameMat = new THREE.MeshStandardMaterial({ color: col('#4a5a63'), roughness: 0.6, metalness: 0.3 });
          for (const s of [0.25, 0.5, 0.75]) {
            const p = tr.pts[Math.floor(tr.pts.length * s)];
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, Math.max(0.05, p[1]), 8), frameMat);
            post.position.set(p[0] + 0.07, p[1] / 2, p[2]);
            post.castShadow = true;
            courseGroup.add(post);
          }
        }
      }

      for (const pr of L.props || []) {
        if (pr.type === 'water') {
          const bank = new THREE.Mesh(
            new THREE.PlaneGeometry(pr.w + 0.9, pr.d + 0.9),
            new THREE.MeshStandardMaterial({ color: col('#6b6450'), roughness: 1 })
          );
          bank.rotation.x = -Math.PI / 2;
          bank.position.set(pr.x, -0.052, pr.z);
          bank.receiveShadow = true;
          decoGroup.add(bank);
          const w = new THREE.Mesh(
            new THREE.PlaneGeometry(pr.w, pr.d),
            new THREE.MeshStandardMaterial({ color: col('#24596f'), roughness: 0.08, metalness: 0.65, transparent: true, opacity: 0.92 })
          );
          w.rotation.x = -Math.PI / 2;
          w.position.set(pr.x, -0.046, pr.z);
          decoGroup.add(w);
        } else if (pr.type === 'rock') {
          const m = new THREE.Mesh(new THREE.DodecahedronGeometry(pr.r, 0),
            new THREE.MeshStandardMaterial({ color: col('#8e8c84'), roughness: 1, flatShading: true }));
          m.position.set(pr.x, terr.y(pr.x, pr.z) + pr.r * 0.4, pr.z);
          m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
          m.castShadow = true;
          m.receiveShadow = true;
          decoGroup.add(m);
        } else if (pr.type === 'pine') {
          decoGroup.add(pine(pr.x, pr.z, pr.h, 0));
        }
      }

      dressUp(L, terr);

      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of L.boundary) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const half = Math.max(maxX - minX, maxZ - minZ) / 2 + 2.2;
      const az = 2.35, el = 0.62;
      sun.position.set(cx + Math.cos(az) * Math.cos(el) * 40, Math.sin(el) * 40, cz + Math.sin(az) * Math.cos(el) * 40);
      sun.target.position.set(cx, 0, cz);
      const sc = sun.shadow.camera;
      sc.left = -half;
      sc.right = half;
      sc.top = half;
      sc.bottom = -half;
      sc.near = 1;
      sc.far = 90;
      sc.updateProjectionMatrix();
    }

    function dressUp(L, terr) {
      const bushA = new THREE.MeshStandardMaterial({ color: col('#51682f'), roughness: 1, flatShading: true });
      const bushB = new THREE.MeshStandardMaterial({ color: col('#7a6a28'), roughness: 1, flatShading: true });
      const rockMat = new THREE.MeshStandardMaterial({ color: col('#948f85'), roughness: 1, flatShading: true });
      const leafMat = new THREE.MeshStandardMaterial({ color: col('#b4702a'), roughness: 1, side: THREE.DoubleSide });
      const inside = (x, z) => PP.holes.inPoly(x, z, L.boundary);
      const nearRail = (x, z) => {
        let m = Infinity;
        for (let i = 0; i < L.boundary.length; i++) {
          const a = L.boundary[i], b = L.boundary[(i + 1) % L.boundary.length];
          m = Math.min(m, u.ptSeg(x, z, a[0], a[1], b[0], b[1]).d);
        }
        return m;
      };
      let bx = 0, bz = 0;
      for (const p of L.boundary) { bx += p[0]; bz += p[1]; }
      bx /= L.boundary.length;
      bz /= L.boundary.length;
      const eyeX = L.tee ? L.tee[0] : 0, eyeZ = L.tee ? L.tee[1] : 0;
      const wet = (L.props || []).filter((q) => q.type === 'water');
      const inWater = (x, z) => {
        for (const q of wet) {
          if (Math.abs(x - q.x) < q.w / 2 + 0.5 && Math.abs(z - q.z) < q.d / 2 + 0.5) return true;
        }
        return false;
      };

      let placed = 0;
      for (let i = 0; i < 420 && placed < 46; i++) {
        const a = Math.random() * Math.PI * 2, d = 1.0 + Math.random() * 11;
        const x = bx + Math.cos(a) * d, z = bz + Math.sin(a) * d;
        if (inside(x, z) || inWater(x, z) || nearRail(x, z) < 0.55 || Math.hypot(x - eyeX, z - eyeZ) < 1.8) continue;
        const r = Math.random();
        let m;
        if (r < 0.46) {
          const s = 0.13 + Math.random() * 0.22;
          m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), Math.random() < 0.55 ? bushA : bushB);
          m.scale.y = 0.72;
          m.position.set(x, s * 0.45, z);
        } else if (r < 0.72) {
          const s = 0.05 + Math.random() * 0.13;
          m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
          m.position.set(x, s * 0.35, z);
          m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        } else {
          m = new THREE.Mesh(new THREE.CircleGeometry(0.035 + Math.random() * 0.03, 5), leafMat);
          m.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
          m.rotation.z = Math.random() * 3;
          m.position.set(x, 0.002, z);
        }
        m.castShadow = true;
        m.receiveShadow = true;
        decoGroup.add(m);
        placed++;
      }
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * Math.PI * 2, d = 9 + Math.random() * 26;
        const x = bx + Math.cos(a) * d, z = bz + Math.sin(a) * d;
        if (inside(x, z) || inWater(x, z) || nearRail(x, z) < 3.0) continue;
        decoGroup.add(Math.random() < 0.55 ? pine(x, z, 3 + Math.random() * 4.5, 0) : birch(x, z, 3 + Math.random() * 3, 0));
      }
    }

    const _q = new THREE.Quaternion(), _axis = new THREE.Vector3();
    let lastSpin = [0, 0];
    function placeBall(b) {
      lastSpin = [b.spinDX, b.spinDZ];
      ballMesh.position.set(b.x, b.y, b.z);
      ballMesh.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      syncShadow(b);
    }
    function moveBall(b) {
      ballMesh.position.set(b.x, b.y, b.z);
      syncShadow(b);
      const dx = b.spinDX - lastSpin[0], dz = b.spinDZ - lastSpin[1];
      lastSpin = [b.spinDX, b.spinDZ];
      const d = Math.hypot(dx, dz);
      if (d > 1e-7) {
        _axis.set(dz / d, 0, -dx / d);
        _q.setFromAxisAngle(_axis, d / cfg.ball.r);
        ballMesh.quaternion.premultiply(_q);
      }
    }

    function drawTrails(actual, ideal, start) {
      wipeTrails();
      if (ideal && ideal.length > 1) trailGroup.add(strip(ideal, 0.012, 0.0025, '#ffd36a', 0.85));
      if (actual && actual.length > 1) trailGroup.add(strip(actual, 0.016, 0.003, '#ffffff', 0.9));
      if (start) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(cfg.ball.r * 0.8, cfg.ball.r * 1.15, 32),
          new THREE.MeshBasicMaterial({ color: col('#ffffff'), transparent: true, opacity: 0.85, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(start[0], 0.0035, start[1]);
        trailGroup.add(ring);
      }
    }
    function wipeTrails() {
      wipe(trailGroup);
    }

    return { scene, sun, ballMesh, build, placeBall, moveBall, drawTrails, wipeTrails, col };
  };
})(typeof window !== 'undefined' ? window : globalThis);

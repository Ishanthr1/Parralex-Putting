(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});
  const cfg = PP.cfg;

   const HD = { len: 0.108, height: 0.027, depth: 0.026 };
  const SHAFT = 0.87;
  const GRIP = 0.27;

  PP.makePutter = function (scene, col) {
     const metal = new THREE.MeshStandardMaterial({ color: col('#b9bcc0'), metalness: 0.85, roughness: 0.32 });
    const faceMat = new THREE.MeshStandardMaterial({ color: col('#8e9297'), metalness: 0.8, roughness: 0.55 });
    const chrome = new THREE.MeshStandardMaterial({ color: col('#d4d7da'), metalness: 0.95, roughness: 0.18 });
    const gripMat = new THREE.MeshStandardMaterial({ color: col('#1d1f22'), roughness: 0.85 });

    const head = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(HD.len, HD.height, HD.depth), metal);
    body.position.set(0, HD.height / 2, 0);
    const face = new THREE.Mesh(new THREE.BoxGeometry(HD.len * 0.96, HD.height * 0.86, 0.0016), faceMat);
    face.position.set(0, HD.height / 2, -HD.depth / 2 - 0.0007);
    const hosel = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0055, 0.04, 14), chrome);
    head.add(body, face, hosel);
    [body, face, hosel].forEach((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
    });
    scene.add(head);

    const tube = (r1, r2, mat) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, 1, 16), mat);
      m.castShadow = true;
      scene.add(m);
       return m;
    };
    const shaft = tube(0.0045, 0.0045, chrome);
    const grip = tube(0.0125, 0.0105, gripMat);
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
    function span(mesh, a, b) {
      _d.subVectors(b, a);
      const len = _d.length();
      mesh.position.addVectors(a, b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(_up, _d.normalize());
     mesh.scale.set(1, len, 1);
    }

   const handsPos = new THREE.Vector3();
    function update(p) {
      const ax = Math.sin(p.faceYaw), az = -Math.cos(p.faceYaw);
      const rx = Math.cos(p.faceYaw), rz = Math.sin(p.faceYaw);
      const r = cfg.ball.r;
      const gap = 0.003 + p.back;
      const L = cfg.putter.armLen;
      const lift = L - Math.sqrt(Math.max(0, L*L - p.back * p.back));
       const hx = p.ball[0] - ax * (r + gap + HD.depth / 2) + rx * p.lateral;
      const hz = p.ball[1] - az * (r + gap + HD.depth / 2) + rz * p.lateral;
      head.position.set(hx, (p.groundY || 0) + lift + 0.0008, hz);
      head.rotation.set(0, -p.faceYaw, 0);
      head.rotateX(-Math.min(0.25, p.back * 0.5));

      const heelX = p.heelSide * (HD.len / 2 - 0.012);
      hosel.position.set(heelX, HD.height + 0.016, HD.depth * 0.15);
      head.updateMatrixWorld(true);
      _a.set(heelX, HD.height + 0.034, HD.depth * 0.15).applyMatrix4(head.matrixWorld);
      handsPos.set(
         p.handsBase.x - ax * p.back * (p.back > 0 ? 0.45 : 0.2) + rx * p.lateral * 0.45,
        p.handsBase.y + lift * 0.4,
        p.handsBase.z - az * p.back * (p.back > 0 ? 0.45 : 0.2) + rz * p.lateral * 0.45
      );
      const toHands = _d.subVectors(handsPos, _a).length();
      _d.normalize();
      const len = Math.max(SHAFT, toHands + 0.4);
      _b.copy(_a).addScaledVector(_d, len);
      span(shaft, _a, _b);
       const gripStart = _a.clone().addScaledVector(_d, len - GRIP);
      span(grip, gripStart, _b);
     }

    function show(v) {
      [head, shaft, grip].forEach((m) => (m.visible = v));
    }

    return { update, show, HD };
  };
})(typeof window !== 'undefined' ? window : globalThis);
/*
 * club.js — the putter (blade head, hosel, shaft, grip). The shaft runs up
 * toward the hands just below the eyes, so it leaves the bottom of the frame
 * the way a real putter does when you look down at it.
 *
 * The head is a plain blade with no sight line: its square face and long
 * top edge are the only alignment references, exactly as with a real
 * unmarked putter.
 */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});
  const C = MG.CONFIG;

  const HEAD = { len: 0.108, height: 0.027, depth: 0.026 };
  const SHAFT_LEN = 0.87;
  const GRIP_LEN = 0.27;

  MG.Putter = function (scene, col) {
    const metal = new THREE.MeshStandardMaterial({ color: col('#b9bcc0'), metalness: 0.85, roughness: 0.32 });
    const faceMat = new THREE.MeshStandardMaterial({ color: col('#8e9297'), metalness: 0.8, roughness: 0.55 });
    const chrome = new THREE.MeshStandardMaterial({ color: col('#d4d7da'), metalness: 0.95, roughness: 0.18 });
    const gripMat = new THREE.MeshStandardMaterial({ color: col('#1d1f22'), roughness: 0.85 });

    // Head in its own frame: −Z = face normal (aim), +X = right, sole on y = 0.
    const head = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(HEAD.len, HEAD.height, HEAD.depth), metal);
    body.position.set(0, HEAD.height / 2, 0);
    const face = new THREE.Mesh(new THREE.BoxGeometry(HEAD.len * 0.96, HEAD.height * 0.86, 0.0016), faceMat);
    face.position.set(0, HEAD.height / 2, -HEAD.depth / 2 - 0.0007);
    const hosel = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0055, 0.04, 14), chrome);
    head.add(body, face, hosel);
    [body, face, hosel].forEach((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
    });
    scene.add(head);

    const unitCyl = (r1, r2, mat) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, 1, 16), mat);
      m.castShadow = true;
      scene.add(m);
      return m;
    };
    const shaft = unitCyl(0.0045, 0.0045, chrome);
    const grip = unitCyl(0.0125, 0.0105, gripMat);

    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
    function placeBetween(mesh, a, b) {
      _d.subVectors(b, a);
      const len = _d.length();
      mesh.position.addVectors(a, b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(_up, _d.normalize());
      mesh.scale.set(1, len, 1);
    }

    /*
     * pose: {
     *   ball: [x, z], faceYaw, back (m behind address), lateral (m, + = right of aim line),
     *   heelSide (−1 heel on the left / right-handed, +1 left-handed),
     *   handsBase: THREE.Vector3 (where the grip runs to, just below the player's eyes)
     * }
     */
    const handsPos = new THREE.Vector3();
    function update(p) {
      const ax = Math.sin(p.faceYaw), az = -Math.cos(p.faceYaw); // aim
      const rx = Math.cos(p.faceYaw), rz = Math.sin(p.faceYaw); // right
      const r = C.ball.radius;
      const gap = 0.003 + p.back;
      const L = C.putter.pendulumLength;
      const lift = L - Math.sqrt(Math.max(0, L * L - p.back * p.back));
      const hx = p.ball[0] - ax * (r + gap + HEAD.depth / 2) + rx * p.lateral;
      const hz = p.ball[1] - az * (r + gap + HEAD.depth / 2) + rz * p.lateral;
      head.position.set(hx, lift + 0.0008, hz);
      head.rotation.set(0, -p.faceYaw, 0);
      // a little loft-free tilt as the head rises on the backswing
      head.rotateX(-Math.min(0.25, p.back * 0.5));

      // Hosel near the heel, shaft leaning up toward the hands.
      const heelX = p.heelSide * (HEAD.len / 2 - 0.012);
      hosel.position.set(heelX, HEAD.height + 0.016, HEAD.depth * 0.15);
      head.updateMatrixWorld(true);
      _a.set(heelX, HEAD.height + 0.034, HEAD.depth * 0.15).applyMatrix4(head.matrixWorld);

      // Hands start from the player's address position and travel with the stroke.
      handsPos.set(
        p.handsBase.x - ax * p.back * (p.back > 0 ? 0.45 : 0.2) + rx * p.lateral * 0.45,
        p.handsBase.y + lift * 0.4,
        p.handsBase.z - az * p.back * (p.back > 0 ? 0.45 : 0.2) + rz * p.lateral * 0.45
      );
      // The shaft runs through the hands and the grip carries on toward the
      // body, so its butt end stays below the frame even in the follow-through.
      const toHands = _d.subVectors(handsPos, _a).length();
      _d.normalize();
      const len = Math.max(SHAFT_LEN, toHands + 0.4);
      _b.copy(_a).addScaledVector(_d, len);
      placeBetween(shaft, _a, _b);
      const gripStart = _a.clone().addScaledVector(_d, len - GRIP_LEN);
      placeBetween(grip, gripStart, _b);
    }

    function setVisible(v) {
      [head, shaft, grip].forEach((m) => (m.visible = v));
    }

    return { update, setVisible, HEAD };
  };
})(typeof window !== 'undefined' ? window : globalThis);

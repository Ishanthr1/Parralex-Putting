(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});

  PP.rng = function (seed) {
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
     t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      seed,
      next,
       range: (a, b) => a + (b - a) * next(),
      int: (a,b) => Math.floor(a + (b - a + 1) * next()),
     sign: () => (next() < 0.5 ? -1 : 1),
      chance: (p) => next() < p,
      pick(w) {
       const keys = Object.keys(w).filter((k) => w[k] > 0);
        const total = keys.reduce((acc, k) => acc + w[k], 0);
        let x = next() * total;
        for (const k of keys) {
          x -= w[k];
          if (x <= 0) return k;
        }
         return keys[keys.length - 1];
     }
    };
  };

  PP.newSeed = () => Math.floor(Math.random() * 2147483647);
})(typeof window !== 'undefined' ? window : globalThis);

(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});

  PP.cfg = {
    g: 9.81,

    ball: { r: 0.021335, kg: 0.04593 },

    turf: { vStop: 0.004, maxSlopeStick: 1.4 },

    surf: {
      green:  { crr: 0.08, skid: 0.25 },
      fringe: { crr: 0.15, skid: 0.32 },
      rough:  { crr: 0.34, skid: 0.55 },
      sand:   { crr: 0.95, skid: 1.15 },
      wood:   { crr: 0.045, skid: 0.18 }
    },

    rail: {
      e: 0.62,
      mu: 0.22,
      h: 0.09,
      t: 0.07
    },

    cup: {
      depth: 0.102,
      rimE: 0.05,
      rimMu: 0.5,
      sideE: 0.35,
      floorE: 0.3,
      dropFactor: 0.6
    },

    pipe: { mu: 0.055, mouth: 0.075, stallV: 0.12 },

    putter: {
      mass: 0.35,
      cor: 0.8,
      faceShare: 0.83,
      omega: 6.0,
      armLen: 1.0,
      maxBack: 0.72,
      maxPathDeg: 12
    },

    sim: { dt: 1/2000, solveDt: 1/500, maxTravel: 0.006 },

    golfer: {
      eyeY: 1.55,
      eyeBack: 0.55,
      eyeOff: 0.3,
      neckToEye: [0, 0.08, -0.09],
      fov: 66,
      restPitch: -45,
      yawLimit: 80,
      pitchMin: -86,
      pitchMax: 10
    },

    ctl: {
      turnPerPx: 0.09,
      turnFine: 0.02,
      turnPerSec: 6,
      backPerPx: 0.0011,
      latPerPx: 0.00035,
      lookPerPx: 0.15,
      lookPerSec: 70
    },

    play: { strokeCap: 8, walkMs: 900, handoverHold: true, stanceOffDeg: 14, clubOffDeg: [20, 62] },

    levels: {
      easy: {
        label: 'Easy',
        cupR: 0.07,
        dist: [1.0, 3.0],
        lane: [1.1, 1.5],
        stanceOff: [0, 9],
        cues: 'full',
        kinds: { straight: 2, slightLeft: 2, slightRight: 2, short: 2, long: 0.6 }
      },
      medium: {
        label: 'Medium',
        cupR: 0.054,
        dist: [1.8, 5.0],
        lane: [0.9, 1.3],
        stanceOff: [3, 18],
        cues: 'full',
        kinds: { straight: 1, slightLeft: 1.4, slightRight: 1.4, short: 0.8, long: 1, obscured: 0.8, awkward: 1, bank: 0.4 }
      },
      hard: {
        label: 'Hard',
        cupR: 0.054,
        dist: [3.0, 8.0],
        lane: [0.7, 1.0],
        stanceOff: [7, 28],
        cues: 'full',
        kinds: { straight: 0.6, slightLeft: 1, slightRight: 1, short: 0.4, long: 1.4, obscured: 1.4, awkward: 1.4, bank: 1.6 }
      },
      expert: {
        label: 'Expert',
        cupR: 0.045,
        dist: [4.0, 12.0],
        lane: [0.7, 1.0],
        stanceOff: [12, 38],
        cues: 'minimal',
        kinds: { straight: 0.5, slightLeft: 1, slightRight: 1, short: 0.3, long: 1.6, obscured: 1.2, awkward: 1.6, bank: 1.4, open: 2 }
      }
    },

    kindText: {
      straight: 'Straight putt',
      slightLeft: 'Slight left offset',
      slightRight: 'Slight right offset',
      long: 'Long straight putt',
      short: 'Short putt',
      obscured: 'Hole partly hidden by an obstacle',
      bank: 'Bank shot',
      awkward: 'Awkward angle to your stance',
      open: 'Open green, long alignment'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

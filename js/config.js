/*
 * config.js — every tunable number in one place.
 * Units: metres, kilograms, seconds, radians (unless a name says "Deg").
 */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});

  MG.CONFIG = {
    g: 9.81,

    // Regulation golf ball (USGA): 42.67 mm diameter, 45.93 g.
    ball: { radius: 0.021335, mass: 0.04593 },

    surface: {
      // Sliding (skid) friction between ball and felt/carpet.
      slideFriction: 0.25,
      // Rolling-resistance coefficient. Rolling deceleration = (5/7)·Crr·g
      // (the 5/7 comes from the ball's rotational inertia, I = 2/5·m·r²).
      // 0.08 → ≈0.56 m/s², i.e. a Stimpmeter reading of roughly 10 ft.
      rollingResistance: 0.08,
      stopSpeed: 0.003
    },

    wall: {
      restitution: 0.62, // normal coefficient of restitution of the border
      friction: 0.22, // ball–border friction during the impact
      height: 0.09,
      thickness: 0.07
    },

    hole: {
      depth: 0.102,
      rimRestitution: 0.05, // impact against the rim edge (a dead, lined cup edge)
      rimFriction: 0.5, // ball ↔ rim edge friction (tuned so a centred putt drops up to ≈1.65 m/s)
      wallRestitution: 0.35, // impact against the inside of the cup
      bottomRestitution: 0.3,
      captureDepthFactor: 0.6 // ball counts as holed once its centre is this many radii below the rim
    },

    putter: {
      headMass: 0.35, // kg
      cor: 0.8, // putter face ↔ ball coefficient of restitution
      // Start direction = faceWeight·face angle + (1 − faceWeight)·path angle
      // (putting research puts the face's share at roughly 80–90 %).
      faceWeight: 0.83,
      // The stroke is modelled as a pendulum: impact speed = ω · backswing length.
      pendulumOmega: 6.0,
      pendulumLength: 1.0, // used only for the visual lift of the head on the backswing
      maxBackswing: 0.55,
      maxPathDeg: 12
    },

    sim: {
      dt: 1 / 2000, // live simulation step
      analysisDt: 1 / 500, // step for the hidden line solver
      maxStepTravel: 0.006 // never move more than 6 mm in one step (prevents tunnelling)
    },

    player: {
      eyeHeight: 1.55, // eye height while bent over the ball at address
      eyeBehind: 0.55, // eyes behind the ball along the stance line
      eyeSide: 0.3, // eyes to the side of the ball (right-handers stand left of the line)
      neckToEye: [0, 0.08, -0.09], // head pivot → eyes, in head space (up, forward)
      fovDeg: 66,
      defaultPitchDeg: -45,
      maxLookYawDeg: 80,
      minPitchDeg: -86,
      maxPitchDeg: 10
    },

    controls: {
      clubDegPerPx: 0.09,
      clubFineDegPerPx: 0.02,
      clubKeyDegPerSec: 6,
      backswingMPerPx: 0.0011,
      pathMPerPx: 0.00035,
      lookDegPerPx: 0.15,
      lookKeyDegPerSec: 70
    },

    // Difficulty presets. Ranges are [min, max].
    difficulty: {
      easy: {
        label: 'Easy',
        holeRadius: 0.07,
        dist: [1.0, 3.0],
        laneWidth: [1.1, 1.5],
        stanceOffsetDeg: [0, 9],
        cues: 'full',
        kinds: { straight: 2, slightLeft: 2, slightRight: 2, short: 2, long: 0.6 }
      },
      medium: {
        label: 'Medium',
        holeRadius: 0.054,
        dist: [1.8, 5.0],
        laneWidth: [0.9, 1.3],
        stanceOffsetDeg: [3, 18],
        cues: 'full',
        kinds: { straight: 1, slightLeft: 1.4, slightRight: 1.4, short: 0.8, long: 1, obscured: 0.8, awkward: 1, bank: 0.4 }
      },
      hard: {
        label: 'Hard',
        holeRadius: 0.054,
        dist: [3.0, 8.0],
        laneWidth: [0.7, 1.0],
        stanceOffsetDeg: [7, 28],
        cues: 'full',
        kinds: { straight: 0.6, slightLeft: 1, slightRight: 1, short: 0.4, long: 1.4, obscured: 1.4, awkward: 1.4, bank: 1.6 }
      },
      expert: {
        label: 'Expert',
        holeRadius: 0.045,
        dist: [4.0, 12.0],
        laneWidth: [0.7, 1.0],
        stanceOffsetDeg: [12, 38],
        cues: 'minimal',
        kinds: { straight: 0.5, slightLeft: 1, slightRight: 1, short: 0.3, long: 1.6, obscured: 1.2, awkward: 1.6, bank: 1.4, open: 2 }
      }
    },

    // Names revealed only after the shot.
    kindLabels: {
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

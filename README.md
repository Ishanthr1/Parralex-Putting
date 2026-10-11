# Parralex-Putting

A web based realistic mini golf game and putting alignment trainer.

<img width="1512" height="823" alt="Screenshot 2026-10-10 at 7 04 00 PM" src="https://github.com/user-attachments/assets/812d29f4-db77-4feb-9485-03cb8e9b5e0d" />

**[Play it here](https://parralexputting.vercel.app/)** - Runs in the browser.

## Quick start

It's a static site with no build step. Clone it and serve the folder:

```bash
git clone https://github.com/Ishanthr1/Parralex-Putting.git
cd Parralex-Putting
python3 -m http.server 8000
```

Then open `http://localhost:8000`.


## Features

- **8 hole mini golf course** with real stroke play and the camera walks to wherever your ball stopped and you putt again until it gets holed.
- **A physics engine written from scratch**: skid and roll, slope forces, sand and rough that changes how the ball behaves, and a 3D hole where lip outs emerge from the rim geometry instead of a close enough type rule.
- **Loops and tunnels**: The loop is lined into the hole with a single gap in it.
- **1v1 Mode**: You play your hole then the screen hands over to the next player.
- **Practice mode**: You are standing on the side off the ball and the program calculates how many degrees off you were and displays it.
- **Stats** All the stats are kept locally for all the putts you have made

## Running it locally

- **Requirements:** any browser with WebGL a python is only used above as a convenient static file server and any static server works (`npx serve`, `php -S`, VS Code Live Server).
- **Why a server and not `file://`:** the game stores profiles and stats in `localStorage`, which browsers restrict on `file://` origins.
- **Environment variables:** none.
- **Dependencies:** Three.js is vendored at `lib/three.min.js`.

The physics layer has no Three.js dependency so it also runs headless in Node for testing:

```bash
node -e "eval(require('fs').readFileSync('js/config.js','utf8')); /* ... */"
```


## Credits

### Libraries

- **[Three.js](https://threejs.org) r128**: for WebGL rendering. MIT License, © 2010–2021 Three.js Authors. Vendored at `lib/three.min.js`.
- **mulberry32**: a small public domain PRNG which is used for seeded course generation so a layout can be reproduced from its seed.

### Fonts

Loaded from Google Fonts at runtime all under the SIL Open Font License 1.1:

- **[Barlow](https://fonts.google.com/specimen/Barlow)** and **[Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed)** by Jeremy Tribby, body and numeric/data text.
- **[Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque)** by Mathieu Triay, display headings.

/*
 * ui.js — HUD, menu, result card and the statistics page (DOM only).
 * Before the shot the HUD shows nothing but the hole, the attempt and Restart.
 */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});
  const C = MG.CONFIG;
  const A = MG.Analysis;
  const $ = (id) => document.getElementById(id);

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ------------------------------------------------------------ HUD
  function setHud(hole, attempt, courseLen) {
    $('hud-hole').textContent = courseLen ? `Hole ${hole} of ${courseLen}` : `Hole ${hole}`;
    $('hud-attempt').textContent = `Attempt ${attempt}`;
  }
  function showHud(v) {
    $('hud').hidden = !v;
  }
  let hintTimer = 0;
  function hint(text, ms) {
    const h = $('hint');
    clearTimeout(hintTimer);
    if (!text) {
      h.hidden = true;
      return;
    }
    h.textContent = text;
    h.hidden = false;
    if (ms) hintTimer = setTimeout(() => (h.hidden = true), ms);
  }

  // ------------------------------------------------------------ menu
  const DIFF_KEYS = ['easy', 'medium', 'hard', 'expert'];
  function renderDifficulty(selected, onPick) {
    const tb = $('diff-rows');
    tb.innerHTML = '';
    for (const k of DIFF_KEYS) {
      const P = C.difficulty[k];
      const tr = document.createElement('tr');
      tr.setAttribute('role', 'radio');
      tr.setAttribute('aria-checked', String(k === selected));
      tr.tabIndex = k === selected ? 0 : -1;
      tr.dataset.key = k;
      const putts = k === 'expert' ? `${P.dist[0]}–${P.dist[1]} m` : `${P.dist[0]}–${P.dist[1]} m`;
      tr.innerHTML = `<td><span class="radio" aria-hidden="true"></span>${P.label}</td><td>${(P.holeRadius * 200).toFixed(1)} cm</td><td>${putts}</td><td>${P.stanceOffsetDeg[0]}–${P.stanceOffsetDeg[1]}°</td>`;
      tr.addEventListener('click', () => onPick(k));
      tr.addEventListener('keydown', (e) => {
        const i = DIFF_KEYS.indexOf(k);
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') onPick(DIFF_KEYS[Math.min(3, i + 1)], true);
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') onPick(DIFF_KEYS[Math.max(0, i - 1)], true);
        else if (e.key === ' ' || e.key === 'Enter') onPick(k, true);
        else return;
        e.preventDefault();
      });
      tb.appendChild(tr);
    }
  }
  function focusDifficulty(k) {
    const tr = document.querySelector(`#diff-rows tr[data-key="${k}"]`);
    if (tr) tr.focus();
  }

  function showMenu(v, inSession) {
    $('menu').hidden = !v;
    $('btn-start').textContent = inSession ? 'Start a new session' : 'Start putting';
    let resume = $('btn-resume');
    if (inSession && !resume) {
      resume = document.createElement('button');
      resume.className = 'btn';
      resume.id = 'btn-resume';
      resume.type = 'button';
      resume.textContent = 'Resume';
      $('btn-stats').before(resume);
    }
    if (resume) resume.hidden = !inSession;
  }

  // ------------------------------------------------------------ result card
  function row(label, value) {
    return `<dt>${esc(label)}</dt><dd>${value}</dd>`;
  }

  function showResult(res, ctx) {
    const v = A.verdict(Math.abs(res.alignDeg));
    $('r-eyebrow').textContent = `Shot result · ${ctx.holeLabel}`;
    const big = Math.abs(res.alignDeg) < 0.05 ? '0.0°' : `${Math.abs(res.alignDeg).toFixed(1)}°<small> ${A.side(res.alignDeg)}</small>`;
    $('r-big').innerHTML = big;
    const tag = $('r-tag');
    tag.textContent = res.holed ? 'Holed' : v.text;
    tag.className = 'tag ' + (res.holed ? 'good' : v.tone);

    let finished;
    if (res.holed) finished = 'In the hole';
    else {
      const lr = Math.abs(res.lateral) < 0.005 ? 'on line' : `${A.fmtCm(res.lateral)} ${A.side(res.lateral)}`;
      const sl = Math.abs(res.along) < 0.005 ? 'pin high' : `${A.fmtCm(res.along)} ${res.along < 0 ? 'short' : 'long'}`;
      finished = `${lr} · ${sl}${res.lipped ? ' (lipped out)' : ''}`;
    }
    let html = '';
    html += row('Club aimed', `${A.fmtDeg(res.alignDeg)} of the true line`);
    html += row('Ball started', `${A.fmtDeg(res.startDeg)}` + (Math.abs(res.startDeg - res.alignDeg) >= 0.3 ? ' <span style="color:var(--ink-3)">(stroke path)</span>' : ''));
    html += row('Finished', finished);
    html += row('From the hole', res.holed ? '0 cm' : A.fmtCm(res.finalDist));
    if (res.finishDeg != null) html += row('Finish direction', `${A.fmtDeg(res.finishDeg)} of the hole`);
    html += row('Situation', esc(res.label));
    html += row('Putt length', `${res.puttLength.toFixed(2)} m${res.lineKind === 'bank' ? ' (straight-line)' : ''}`);
    html += row('Your stance', `set ${A.fmtDeg(res.stanceDeg, 0)} of the line`);
    $('r-rows').innerHTML = html;
    $('r-session').textContent = ctx.sessionLine || '';
    $('btn-next').firstChild.textContent = ctx.nextLabel + ' ';
    $('btn-behind').firstChild.textContent = ctx.behind ? 'Your stance ' : 'Behind line ';
    $('result').hidden = false;
  }
  function hideResult() {
    $('result').hidden = true;
  }
  function setBehindLabel(on) {
    $('btn-behind').firstChild.textContent = on ? 'Your stance ' : 'Behind line ';
  }

  // ------------------------------------------------------------ statistics page
  let statsFilter = 'all';
  let chartState = null;

  function showStats(v) {
    $('stats').hidden = !v;
    if (v) renderStats();
  }

  function renderStats() {
    const all = MG.Stats.all();
    const keys = ['all', ...DIFF_KEYS];
    const fl = $('stats-filters');
    fl.innerHTML = keys
      .map((k) => {
        const n = k === 'all' ? all.length : all.filter((r) => r.difficulty === k).length;
        const label = k === 'all' ? 'All' : C.difficulty[k].label;
        return `<button type="button" data-k="${k}" aria-pressed="${k === statsFilter}">${label} ${n}</button>`;
      })
      .join('');
    fl.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        statsFilter = b.dataset.k;
        renderStats();
      })
    );

    const recs = statsFilter === 'all' ? all : all.filter((r) => r.difficulty === statsFilter);
    const S = MG.Stats.summary(recs);
    const body = $('stats-body');
    if (!S.n) {
      body.innerHTML = `<p class="empty">No putts recorded${statsFilter === 'all' ? '' : ' at this level'} yet. Every putt you finish is saved here with its alignment error, where it stopped and which situation it was, so you can see whether your eye is getting better.</p>`;
      chartState = null;
      renderReset(all.length);
      return;
    }
    const trend =
      S.firstAvg != null
        ? `First ${S.trendWindow}: ${S.firstAvg.toFixed(1)}° → last ${S.trendWindow}: ${S.lastAvg.toFixed(1)}°`
        : 'Trend shows after 10 putts';
    const kpi = (label, value, sub) => `<div class="kpi"><p class="eyebrow">${label}</p><p class="v">${value}</p><p class="s">${sub}</p></div>`;
    const lr = Math.abs(S.lrBias) < 0.05 ? 'None' : `${Math.abs(S.lrBias).toFixed(1)}°<small>${A.side(S.lrBias)}</small>`;
    const sl = !S.missed ? '—' : Math.abs(S.slBias) < 0.005 ? 'None' : `${A.fmtCm(S.slBias)}<small>${S.slBias < 0 ? 'short' : 'long'}</small>`;
    const holed = recs.filter((r) => r.holed).length;
    body.innerHTML = `
      <div class="kpis">
        ${kpi('Putts', S.n, `${holed} holed (${S.holedPct.toFixed(0)}%)`)}
        ${kpi('Avg alignment error', `${S.avgAbs.toFixed(1)}°`, trend)}
        ${kpi('Avg distance from hole', A.fmtCm(S.avgDist), 'Holed putts count as 0 cm')}
        ${kpi('Left / right bias', lr, `Mean signed error · ${S.leftPct.toFixed(0)}% left, ${S.rightPct.toFixed(0)}% right`)}
        ${kpi('Short / long bias', sl, S.missed ? `Missed putts · ${S.shortPct.toFixed(0)}% short, ${S.longPct.toFixed(0)}% long` : 'Every putt holed')}
        ${kpi('Best / worst alignment', `${Math.abs(S.best.alignDeg).toFixed(1)}°<small>/ ${Math.abs(S.worst.alignDeg).toFixed(1)}°</small>`, `Worst: ${esc(C.kindLabels[S.worst.kind] || S.worst.kind)}`)}
      </div>
      <div class="panel-grid">
        <section class="panel">
          <h3>Alignment error per putt</h3>
          <p class="sub">Size of the club's aim error on every putt, oldest first, with a 10-putt running average. Lower is better.</p>
          <div class="chart-box" id="chart-box"><canvas id="chart" role="img" aria-label="Alignment error per putt"></canvas><div class="tip" id="chart-tip" hidden></div></div>
        </section>
        <section class="panel">
          <h3>Where your misses go</h3>
          <div class="bias">
            <p class="eyebrow">Aim, left vs right</p>
            <div class="bias-bar" aria-hidden="true">
              <div class="l" style="flex:${S.leftPct}"></div><div class="n" style="flex:${Math.max(0, 100 - S.leftPct - S.rightPct)}"></div><div class="r" style="flex:${S.rightPct}"></div>
            </div>
            <div class="bias-labels"><span><i class="sw" style="background:var(--left)"></i>Left <b>${S.leftPct.toFixed(0)}%</b></span><span>Right <b>${S.rightPct.toFixed(0)}%</b><i class="sw" style="background:var(--right);margin:0 0 0 5px"></i></span></div>
          </div>
          <div class="bias">
            <p class="eyebrow">Pace on missed putts</p>
            ${
              S.missed
                ? `<div class="bias-bar" aria-hidden="true"><div class="sh" style="flex:${S.shortPct}"></div><div class="lo" style="flex:${S.longPct}"></div></div>
            <div class="bias-labels"><span><i class="sw" style="background:var(--ink-3)"></i>Short <b>${S.shortPct.toFixed(0)}%</b></span><span>Long <b>${S.longPct.toFixed(0)}%</b><i class="sw" style="background:var(--ink-2);margin:0 0 0 5px"></i></span></div>`
                : '<p class="note">No missed putts in this selection.</p>'
            }
          </div>
          <div class="within">
            <p class="eyebrow">Putts aimed within</p>
            ${S.within
              .map(
                (w) =>
                  `<div class="within-row"><span>±${w.t}°</span><div class="track"><div class="fill" style="width:${w.pct.toFixed(1)}%"></div></div><span>${w.pct.toFixed(0)}%</span></div>`
              )
              .join('')}
          </div>
        </section>
      </div>
      <section class="panel">
        <h3>By situation</h3>
        <p class="sub">Sorted by average error, hardest first. Bias is the mean signed alignment error.</p>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Situation</th><th>Putts</th><th>Avg error</th><th>Bias</th><th>Avg from hole</th><th>Holed</th></tr></thead>
            <tbody>${S.byKind
              .map(
                (k) =>
                  `<tr><td>${esc(C.kindLabels[k.kind] || k.kind)}</td><td>${k.n}</td><td>${k.avgAbs.toFixed(1)}°</td><td>${A.fmtDeg(k.bias)}</td><td>${A.fmtCm(k.avgDist)}</td><td>${k.holedPct.toFixed(0)}%</td></tr>`
              )
              .join('')}</tbody>
          </table>
        </div>
      </section>`;
    chartState = { series: S.series };
    drawChart();
    bindChartHover();
    renderReset(all.length);
  }

  function renderReset(total) {
    const area = $('reset-area');
    if (!total) {
      area.innerHTML = '';
      return;
    }
    area.innerHTML = `<button type="button" class="btn danger" id="btn-reset">Reset statistics</button>`;
    $('btn-reset').addEventListener('click', () => {
      area.innerHTML = `<span>Delete all ${total} saved putts? This cannot be undone.</span><button type="button" class="btn danger" id="btn-reset-yes">Delete</button><button type="button" class="btn" id="btn-reset-no">Keep them</button>`;
      $('btn-reset-yes').addEventListener('click', () => {
        MG.Stats.clear();
        renderStats();
      });
      $('btn-reset-no').addEventListener('click', () => renderReset(total));
    });
  }

  // Canvas chart: one series (|error| per putt) as dots plus a running-average line.
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function niceStep(max, count) {
    const raw = max / count, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  function chartGeom(w, h, n, yMax) {
    const pad = { l: 40, r: 16, t: 12, b: 28 };
    const x = (i) => pad.l + (n <= 1 ? (w - pad.l - pad.r) / 2 : ((i - 1) / (n - 1)) * (w - pad.l - pad.r));
    const y = (v) => pad.t + (1 - Math.min(v, yMax) / yMax) * (h - pad.t - pad.b);
    return { pad, x, y };
  }
  function drawChart() {
    if (!chartState) return;
    const cv = $('chart');
    if (!cv) return;
    const box = cv.parentElement;
    const w = box.clientWidth, h = box.clientHeight, dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = w * dpr;
    cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const s = chartState.series, n = s.length;
    const vmax = Math.max(5, ...s.map((p) => p.v));
    const step = niceStep(vmax, 4);
    const yMax = Math.ceil(vmax / step) * step;
    const G = chartGeom(w, h, n, yMax);
    chartState.G = G;
    const ink2 = cssVar('--ink-2'), ink3 = cssVar('--ink-3'), rule = cssVar('--rule'), felt = cssVar('--felt'), paper = cssVar('--paper');
    g.font = '500 12px ' + cssVar('--font-data');
    g.textBaseline = 'middle';
    // grid + y labels
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      const yy = Math.round(G.y(v)) + 0.5;
      g.strokeStyle = rule;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(G.pad.l, yy);
      g.lineTo(w - G.pad.r, yy);
      g.stroke();
      g.fillStyle = ink3;
      g.textAlign = 'right';
      g.fillText(`${+v.toFixed(1)}°`, G.pad.l - 8, yy);
    }
    // x labels
    const xs = niceStep(Math.max(1, n - 1), 5);
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (let i = 1; i <= n; i += Math.max(1, Math.round(xs))) g.fillText(String(i), G.x(i), h - G.pad.b + 8);
    if (n > 1 && (n - 1) % Math.max(1, Math.round(xs)) !== 0) g.fillText(String(n), G.x(n), h - G.pad.b + 8);
    // dots
    for (const p of s) {
      g.fillStyle = ink3;
      g.globalAlpha = 0.55;
      g.beginPath();
      g.arc(G.x(p.i), G.y(p.v), 4, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // running average
    if (n > 1) {
      g.strokeStyle = felt;
      g.lineWidth = 2;
      g.lineJoin = 'round';
      g.beginPath();
      s.forEach((p, k) => (k ? g.lineTo(G.x(p.i), G.y(p.roll)) : g.moveTo(G.x(p.i), G.y(p.roll))));
      g.stroke();
      const last = s[n - 1];
      g.fillStyle = felt;
      g.strokeStyle = paper;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(G.x(last.i), G.y(last.roll), 5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = ink2;
      g.textAlign = 'right';
      g.textBaseline = 'bottom';
      g.font = '600 12px ' + cssVar('--font-data');
      g.fillText(`10-putt average ${last.roll.toFixed(1)}°`, w - G.pad.r, Math.max(14, G.y(last.roll) - 9));
    }
  }
  function bindChartHover() {
    const box = $('chart-box'), tip = $('chart-tip');
    if (!box) return;
    box.addEventListener('pointermove', (e) => {
      if (!chartState || !chartState.G) return;
      const rect = box.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const G = chartState.G, s = chartState.series;
      let best = null, bd = Infinity;
      for (const p of s) {
        const d = Math.abs(G.x(p.i) - mx);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (!best || bd > 24) {
        tip.hidden = true;
        return;
      }
      const r = best.rec;
      tip.innerHTML = `Putt ${best.i} · aimed ${A.fmtDeg(r.alignDeg)}<br>${esc(C.kindLabels[r.kind] || r.kind)} · ${C.difficulty[r.difficulty] ? C.difficulty[r.difficulty].label : ''}`;
      tip.style.left = Math.min(Math.max(G.x(best.i), 90), rect.width - 90) + 'px';
      tip.style.top = G.y(best.v) + 'px';
      tip.hidden = false;
    });
    box.addEventListener('pointerleave', () => (tip.hidden = true));
  }
  root.addEventListener('resize', () => {
    if (!$('stats').hidden) drawChart();
  });
  try {
    root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => drawChart());
  } catch (e) {
    /* old browsers */
  }

  MG.UI = { setHud, showHud, hint, renderDifficulty, focusDifficulty, showMenu, showResult, hideResult, setBehindLabel, showStats, renderStats, $ };
})(typeof window !== 'undefined' ? window : globalThis);

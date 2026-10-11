(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});
  const cfg = PP.cfg;
  const sc = PP.score;
  const $ = (id) => document.getElementById(id);

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const LEVELS = ['easy', 'medium', 'hard', 'expert'];

  function setHud(o) {
    if (o.course) {
      const who = o.player ? esc(o.player) + ' · ' : '';
      $('hud-hole').textContent = `${who}Hole ${o.hole} of ${o.holes}`;
      $('hud-attempt').textContent = `Par ${o.par} · ${o.strokes} shot${o.strokes === 1 ? '' : 's'}`;
      $('btn-card').hidden = false;
      $('btn-restart').textContent = 'Replay';
    } else {
      $('hud-hole').textContent = `Hole ${o.hole}`;
      $('hud-attempt').textContent = `Attempt ${o.attempt}`;
      $('btn-card').hidden = true;
      $('btn-restart').textContent = 'Restart';
    }
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

  let cardTimer = 0;
  function holeCard(o) {
    const el = $('holecard');
    $('hc-top').textContent = (o.player ? o.player + ' · ' : '') + `Hole ${o.hole} of ${o.holes}`;
    $('hc-name').textContent = o.name;
    $('hc-par').textContent = 'Par ' + o.par;
    $('hc-blurb').textContent = o.blurb || '';
    el.hidden = false;
    el.classList.remove('out');
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => (el.hidden = true), 600);
    }, 2600);
  }

  function scoreWord(score, par) {
    const d = score - par;
    if (score === 1) return { t: 'Hole in one', k: 'good' };
    if (d <= -2) return { t: 'Eagle', k: 'good' };
    if (d === -1) return { t: 'Birdie', k: 'good' };
    if (d === 0) return { t: 'Par', k: 'ok' };
    if (d === 1) return { t: 'Bogey', k: 'warn' };
    return { t: '+' + d, k: 'bad' };
  }

  function cardTable(players, holes, upto) {
    let head = '<tr><th>Hole</th>';
    for (let i = 0; i < holes.length; i++) head += `<th>${i + 1}</th>`;
    head += '<th>Tot</th></tr>';
    let parRow = '<tr class="parrow"><td>Par</td>';
    let parSum = 0;
    for (const h of holes) {
      parRow += `<td>${h.par}</td>`;
      parSum += h.par;
    }
    parRow += `<td>${parSum}</td></tr>`;
    let body = '';
    for (const p of players) {
      body += `<tr><td class="who">${esc(p.name)}</td>`;
      for (let i = 0; i < holes.length; i++) {
        const v = p.scores[i];
        const cls = v == null ? '' : v < holes[i].par ? 'under' : v > holes[i].par ? 'over' : '';
        body += `<td class="${cls}">${v == null ? '–' : v}</td>`;
      }
      body += `<td class="tot">${p.total || 0}</td></tr>`;
    }
    return `<div class="table-wrap"><table class="tbl card-tbl"><thead>${head}</thead><tbody>${parRow}${body}</tbody></table></div>`;
  }

  function holeDone(o) {
    $('holecard').hidden = true;
    const w = scoreWord(o.score, o.par);
    $('hd-top').textContent = (o.player ? o.player + ' · ' : '') + `Hole ${o.hole} · ${o.name}`;
    $('hd-big').textContent = o.score;
    const tag = $('hd-tag');
    tag.textContent = o.capped ? 'Picked up' : w.t;
    tag.className = 'tag ' + (o.capped ? 'bad' : w.k);
    $('hd-note').textContent = o.capped
      ? `Stroke limit reached, scored ${o.score}.`
      : `Par ${o.par} · ${o.score} shot${o.score === 1 ? '' : 's'}`;
    $('hd-card').innerHTML = cardTable(o.scores, PP.layouts.defs, o.hole);
    $('btn-hole-next').firstChild.textContent = o.nextLabel + ' ';
    $('holedone').hidden = false;
  }

  function handover(o) {
    $('holecard').hidden = true;
    $('ho-title').textContent = `Pass to ${o.to}`;
    $('ho-sub').textContent = `${o.from} has finished hole ${o.hole}. Hand over the mouse — ${o.to} plays ${o.name} now.`;
    $('holedone').hidden = true;
    $('handover').hidden = false;
  }

  function roundDone(o) {
    $('holecard').hidden = true;
    $('re-title').textContent = o.verdict || 'Your card';
    $('re-card').innerHTML = cardTable(o.players, o.holes);
    const p = o.players[0];
    const d = p.total - o.par;
    $('re-note').textContent = `${p.total} strokes · par ${o.par} · ${d === 0 ? 'level par' : d > 0 ? '+' + d : d}`;
    $('roundend').hidden = false;
  }

  function closeCards() {
    $('holedone').hidden = true;
    $('handover').hidden = true;
    $('roundend').hidden = true;
    $('scorecard').hidden = true;
    $('holecard').hidden = true;
  }

  function toggleCard(st) {
    const el = $('scorecard');
    if (!el.hidden) {
      el.hidden = true;
      return;
    }
    if (!st.players || !st.players.length) return;
    $('holecard').hidden = true;
    $('sc-card').innerHTML = cardTable(st.players, PP.layouts.defs);
    el.hidden = false;
  }

  function drawLevels(selected, onPick) {
    const tb = $('diff-rows');
    tb.innerHTML = '';
    for (const k of LEVELS) {
      const P = cfg.levels[k];
      const tr = document.createElement('tr');
      tr.setAttribute('role', 'radio');
      tr.setAttribute('aria-checked', String(k === selected));
      tr.tabIndex = k === selected ? 0 : -1;
      tr.dataset.key = k;
      tr.innerHTML = `<td><span class="radio" aria-hidden="true"></span>${P.label}</td><td>${(P.cupR * 200).toFixed(1)} cm</td><td>${P.dist[0]}–${P.dist[1]} m</td><td>${P.stanceOff[0]}–${P.stanceOff[1]}°</td>`;
      tr.addEventListener('click', () => onPick(k));
      tr.addEventListener('keydown', (e) => {
        const i = LEVELS.indexOf(k);
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') onPick(LEVELS[Math.min(3, i + 1)], true);
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') onPick(LEVELS[Math.max(0, i - 1)], true);
        else if (e.key === ' ' || e.key === 'Enter') onPick(k, true);
        else return;
        e.preventDefault();
      });
      tb.appendChild(tr);
    }
  }
  function focusLevel(k) {
    const tr = document.querySelector(`#diff-rows tr[data-key="${k}"]`);
    if (tr) tr.focus();
  }

  function drawProfiles() {
    const sel = $('profile-pick');
    const list = PP.profiles.all();
    const act = PP.profiles.active();
    sel.innerHTML = list.map((p) => `<option value="${p.id}"${act && p.id === act.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    const who = $('stats-who');
    if (who) who.textContent = act ? `Training record · ${act.name}` : 'Training record';
    $('btn-profile-del').disabled = list.length <= 1;
  }

  function showMenu(v, inSession) {
    $('menu').hidden = !v;
    $('btn-start').textContent = inSession ? 'Start again' : 'Start putting';
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
    if (v) drawProfiles();
  }

  function row(label, value) {
    return `<dt>${esc(label)}</dt><dd>${value}</dd>`;
  }

  function drawResult(res, ctx) {
    const v = sc.rate(Math.abs(res.alignDeg));
    $('r-eyebrow').textContent = `Shot result · ${ctx.holeLabel}`;
    $('r-big').innerHTML = Math.abs(res.alignDeg) < 0.05 ? '0.0°' : `${Math.abs(res.alignDeg).toFixed(1)}°<small> ${sc.side(res.alignDeg)}</small>`;
    const tag = $('r-tag');
    tag.textContent = res.holed ? 'Holed' : v.text;
    tag.className = 'tag ' + (res.holed ? 'good' : v.tone);

    let finished;
    if (res.holed) finished = 'In the hole';
    else {
      const lr = Math.abs(res.lateral) < 0.005 ? 'on line' : `${sc.cmTxt(res.lateral)} ${sc.side(res.lateral)}`;
      const sl = Math.abs(res.along) < 0.005 ? 'pin high' : `${sc.cmTxt(res.along)} ${res.along < 0 ? 'short' : 'long'}`;
      finished = `${lr} · ${sl}${res.lipped ? ' (lipped out)' : ''}`;
    }
    let html = '';
    html += row('Club aimed', `${sc.degTxt(res.alignDeg)} of the true line`);
    html += row('Ball started', `${sc.degTxt(res.startDeg)}` + (Math.abs(res.startDeg - res.alignDeg) >= 0.3 ? ' <span style="color:var(--ink-3)">(stroke path)</span>' : ''));
    html += row('Finished', finished);
    html += row('From the hole', res.holed ? '0 cm' : sc.cmTxt(res.finalDist));
    if (res.finishDeg != null) html += row('Finish direction', `${sc.degTxt(res.finishDeg)} of the hole`);
    html += row('Situation', esc(res.label));
    html += row('Putt length', `${res.puttLength.toFixed(2)} m${res.lineKind === 'bank' ? ' (straight-line)' : ''}`);
    html += row('Your stance', `set ${sc.degTxt(res.stanceDeg, 0)} of the line`);
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

  let pickedLevel = 'all';
  let tab = 'align';
  let chart = null;

  function showStats(v) {
    $('stats').hidden = !v;
    if (v) {
      drawProfiles();
      drawStats();
    }
  }

  function bindTabs() {
    const tb = $('stats-tabs');
    if (!tb) return;
    tb.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.t;
        tb.querySelectorAll('button').forEach((q) => q.setAttribute('aria-selected', String(q.dataset.t === tab)));
        drawStats();
      })
    );
  }

  function drawStats() {
    $('stats-filters').hidden = tab !== 'align';
    if (tab === 'rounds') return drawRounds();
    drawAlign();
  }

  function drawRounds() {
    const S = PP.store.roundCrunch();
    const body = $('stats-body');
    if (!S.n) {
      body.innerHTML = `<p class="empty">No rounds finished yet. Play the 8-hole course and your card is saved here.</p>`;
      chart = null;
      drawReset(0, 'rounds');
      return;
    }
    const kpi = (l, v, s) => `<div class="kpi"><p class="eyebrow">${l}</p><p class="v">${v}</p><p class="s">${s}</p></div>`;
    const d = S.best - S.par;
    body.innerHTML = `
      <div class="kpis">
        ${kpi('Rounds', S.n, `${S.holesPlayed} holes played`)}
        ${kpi('Best round', S.best, `Par ${S.par} · ${d === 0 ? 'level' : d > 0 ? '+' + d : d}`)}
        ${kpi('Average round', S.avg.toFixed(1), `Over ${S.n} round${S.n === 1 ? '' : 's'}`)}
        ${kpi('Holes in one', S.aces, 'Across every round')}
      </div>
      <section class="panel">
        <h3>Hole by hole</h3>
        <p class="sub">Your average and best on each hole of the course.</p>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>#</th><th>Hole</th><th>Par</th><th>Average</th><th>Best</th><th>Played</th></tr></thead>
            <tbody>${S.byHole.map((h) =>
              `<tr><td>${h.i + 1}</td><td>${esc(h.name)}</td><td>${h.par}</td><td class="${h.avg > h.par ? 'over' : h.avg < h.par ? 'under' : ''}">${h.avg.toFixed(2)}</td><td>${h.best}</td><td>${h.n}</td></tr>`
            ).join('')}</tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <h3>Recent rounds</h3>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>When</th><th>Total</th><th>To par</th><th>Opponent</th></tr></thead>
            <tbody>${S.rounds.slice(-14).reverse().map((r) => {
              const dd = r.total - r.par;
              return `<tr><td>${new Date(r.ts).toLocaleDateString()}</td><td>${r.total}</td><td class="${dd > 0 ? 'over' : dd < 0 ? 'under' : ''}">${dd === 0 ? 'E' : dd > 0 ? '+' + dd : dd}</td><td>${r.vs ? esc(r.vs.name) + ' ' + r.vs.total : '—'}</td></tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </section>`;
    chart = null;
    drawReset(S.n, 'rounds');
  }

  function drawAlign() {
    const all = PP.store.all();
    const keys = ['all', ...LEVELS];
    const fl = $('stats-filters');
    fl.innerHTML = keys
      .map((k) => {
        const n = k === 'all' ? all.length : all.filter((r) => r.difficulty === k).length;
        const label = k === 'all' ? 'All' : cfg.levels[k].label;
        return `<button type="button" data-k="${k}" aria-pressed="${k === pickedLevel}">${label} ${n}</button>`;
      })
      .join('');
    fl.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        pickedLevel = b.dataset.k;
        drawAlign();
      })
    );

    const recs = pickedLevel === 'all' ? all : all.filter((r) => r.difficulty === pickedLevel);
    const S = PP.store.crunch(recs);
    const body = $('stats-body');
    if (!S.n) {
      body.innerHTML = `<p class="empty">No practice putts recorded${pickedLevel === 'all' ? '' : ' at this level'} yet. Every putt in Practice mode is saved here with its alignment error.</p>`;
      chart = null;
      drawReset(all.length, 'align');
      return;
    }
    const trend = S.firstAvg != null
      ? `First ${S.trendWindow}: ${S.firstAvg.toFixed(1)}° → last ${S.trendWindow}: ${S.lastAvg.toFixed(1)}°`
      : 'Trend shows after 10 putts';
    const kpi = (l, v, s) => `<div class="kpi"><p class="eyebrow">${l}</p><p class="v">${v}</p><p class="s">${s}</p></div>`;
    const lr = Math.abs(S.lrBias) < 0.05 ? 'None' : `${Math.abs(S.lrBias).toFixed(1)}°<small>${sc.side(S.lrBias)}</small>`;
    const sl = !S.missed ? '—' : Math.abs(S.slBias) < 0.005 ? 'None' : `${sc.cmTxt(S.slBias)}<small>${S.slBias < 0 ? 'short' : 'long'}</small>`;
    const holed = recs.filter((r) => r.holed).length;
    body.innerHTML = `
      <div class="kpis">
        ${kpi('Putts', S.n, `${holed} holed (${S.holedPct.toFixed(0)}%)`)}
        ${kpi('Avg alignment error', `${S.avgAbs.toFixed(1)}°`, trend)}
        ${kpi('Avg distance from hole', sc.cmTxt(S.avgDist), 'Holed putts count as 0 cm')}
        ${kpi('Left / right bias', lr, `Mean signed error · ${S.leftPct.toFixed(0)}% left, ${S.rightPct.toFixed(0)}% right`)}
        ${kpi('Short / long bias', sl, S.missed ? `Missed putts · ${S.shortPct.toFixed(0)}% short, ${S.longPct.toFixed(0)}% long` : 'Every putt holed')}
        ${kpi('Best / worst alignment', `${Math.abs(S.best.alignDeg).toFixed(1)}°<small>/ ${Math.abs(S.worst.alignDeg).toFixed(1)}°</small>`, `Worst: ${esc(cfg.kindText[S.worst.kind] || S.worst.kind)}`)}
      </div>
      <div class="panel-grid">
        <section class="panel">
          <h3>Alignment error per putt</h3>
          <p class="sub">Size of the club's aim error on every putt, oldest first, with a 10-putt running average.</p>
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
          <div class="within">
            <p class="eyebrow">Putts aimed within</p>
            ${S.within.map((w) =>
              `<div class="within-row"><span>±${w.t}°</span><div class="track"><div class="fill" style="width:${w.pct.toFixed(1)}%"></div></div><span>${w.pct.toFixed(0)}%</span></div>`
            ).join('')}
          </div>
        </section>
      </div>
      <section class="panel">
        <h3>By situation</h3>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Situation</th><th>Putts</th><th>Avg error</th><th>Bias</th><th>Avg from hole</th><th>Holed</th></tr></thead>
            <tbody>${S.byKind.map((k) =>
              `<tr><td>${esc(cfg.kindText[k.kind] || k.kind)}</td><td>${k.n}</td><td>${k.avgAbs.toFixed(1)}°</td><td>${sc.degTxt(k.bias)}</td><td>${sc.cmTxt(k.avgDist)}</td><td>${k.holedPct.toFixed(0)}%</td></tr>`
            ).join('')}</tbody>
          </table>
        </div>
      </section>`;
    chart = { series: S.series };
    paintChart();
    hookHover();
    drawReset(all.length, 'align');
  }

  function drawReset(total, which) {
    const area = $('reset-area');
    if (!total) {
      area.innerHTML = '';
      return;
    }
    const noun = which === 'rounds' ? 'rounds' : 'putts';
    area.innerHTML = `<button type="button" class="btn danger" id="btn-reset">Reset ${noun}</button>`;
    $('btn-reset').addEventListener('click', () => {
      area.innerHTML = `<span>Delete all ${total} saved ${noun} for this player? This cannot be undone.</span><button type="button" class="btn danger" id="btn-reset-yes">Delete</button><button type="button" class="btn" id="btn-reset-no">Keep them</button>`;
      $('btn-reset-yes').addEventListener('click', () => {
        if (which === 'rounds') PP.store.clearRounds();
        else PP.store.clear();
        drawStats();
      });
      $('btn-reset-no').addEventListener('click', () => drawReset(total, which));
    });
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function stepFor(max, count) {
    const raw = max / count, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  function geomFor(w, h, n, yMax) {
    const pad = { l: 40, r: 16, t: 12, b: 28 };
    const x = (i) => pad.l + (n <= 1 ? (w - pad.l - pad.r) / 2 : ((i - 1) / (n - 1)) * (w - pad.l - pad.r));
    const y = (v) => pad.t + (1 - Math.min(v, yMax) / yMax) * (h - pad.t - pad.b);
    return { pad, x, y };
  }
  function paintChart() {
    if (!chart) return;
    const cv = $('chart');
    if (!cv) return;
    const box = cv.parentElement;
    const w = box.clientWidth, h = box.clientHeight, dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = w * dpr;
    cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const s = chart.series, n = s.length;
    const vmax = Math.max(5, ...s.map((p) => p.v));
    const stp = stepFor(vmax, 4);
    const yMax = Math.ceil(vmax / stp) * stp;
    const G = geomFor(w, h, n, yMax);
    chart.G = G;
    const ink2 = cssVar('--ink-2'), ink3 = cssVar('--ink-3'), rule = cssVar('--rule'), felt = cssVar('--felt'), paper = cssVar('--paper');
    g.font = '500 12px ' + cssVar('--font-data');
    g.textBaseline = 'middle';
    for (let v = 0; v <= yMax + 1e-9; v += stp) {
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
    const xs = stepFor(Math.max(1, n - 1), 5);
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (let i = 1; i <= n; i += Math.max(1, Math.round(xs))) g.fillText(String(i), G.x(i), h - G.pad.b + 8);
    for (const p of s) {
      g.fillStyle = ink3;
      g.globalAlpha = 0.55;
      g.beginPath();
      g.arc(G.x(p.i), G.y(p.v), 4, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
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
  function hookHover() {
    const box = $('chart-box'), tip = $('chart-tip');
    if (!box) return;
    box.addEventListener('pointermove', (e) => {
      if (!chart || !chart.G) return;
      const rect = box.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const G = chart.G, s = chart.series;
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
      tip.innerHTML = `Putt ${best.i} · aimed ${sc.degTxt(r.alignDeg)}<br>${esc(cfg.kindText[r.kind] || r.kind)}`;
      tip.style.left = Math.min(Math.max(G.x(best.i), 90), rect.width - 90) + 'px';
      tip.style.top = G.y(best.v) + 'px';
      tip.hidden = false;
    });
    box.addEventListener('pointerleave', () => (tip.hidden = true));
  }
  root.addEventListener('resize', () => {
    if (!$('stats').hidden) paintChart();
  });
  try {
    root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => paintChart());
  } catch (e) {}

  function wireMenu() {
    const p2 = $('p2row');
    const sync = () => {
      const m = document.querySelector('input[name="mode"]:checked').value;
      p2.hidden = m !== 'vs';
      $('diff-field').hidden = m !== 'practice';
    };
    document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', sync));
    sync();

    $('profile-pick').addEventListener('change', (e) => {
      PP.profiles.setActive(e.target.value);
      PP.store.load();
      drawProfiles();
    });
    $('btn-profile-new').addEventListener('click', () => {
      const n = prompt('New player name');
      if (n === null) return;
      PP.profiles.create(n);
      PP.store.load();
      drawProfiles();
    });
    $('btn-profile-rename').addEventListener('click', () => {
      const a = PP.profiles.active();
      if (!a) return;
      const n = prompt('Rename player', a.name);
      if (n === null) return;
      PP.profiles.rename(a.id, n);
      drawProfiles();
    });
    $('btn-profile-del').addEventListener('click', () => {
      const a = PP.profiles.active();
      if (!a || PP.profiles.all().length <= 1) return;
      if (!confirm(`Delete ${a.name} and all their saved stats?`)) return;
      PP.profiles.remove(a.id);
      PP.store.load();
      drawProfiles();
    });
    bindTabs();
  }

  PP.ui = { setHud, showHud, hint, drawLevels, focusLevel, showMenu, drawResult, hideResult, setBehindLabel,
            showStats, drawStats, holeCard, holeDone, handover, roundDone, closeCards, toggleCard, drawProfiles, $ };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireMenu);
  else wireMenu();
})(typeof window !== 'undefined' ? window : globalThis);

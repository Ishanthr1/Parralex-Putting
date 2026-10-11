(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});
  let kept = [];
  let rounds = [];
  let bound = null;

  const shotKey = (id) => 'pputt.shots.' + id;
  const roundKey = (id) => 'pputt.rounds.' + id;

  function grab(k) {
    try {
      const raw = root.localStorage && root.localStorage.getItem(k);
      return raw ? JSON.parse(raw) || [] : [];
    } catch (e) {
      return [];
    }
  }
  function put(k, v) {
    try {
      if (root.localStorage) root.localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }

  function load() {
    const p = PP.profiles.active();
    bound = p ? p.id : null;
    kept = bound ? grab(shotKey(bound)) : [];
    rounds = bound ? grab(roundKey(bound)) : [];
    return kept;
  }

  function sync() {
    const p = PP.profiles.active();
    if (!p || p.id !== bound) load();
  }

  function add(rec) {
    sync();
    kept.push(rec);
    if (kept.length > 5000) kept = kept.slice(-5000);
    if (bound) put(shotKey(bound), kept);
  }

  function addRound(r) {
    sync();
    rounds.push(r);
    if (rounds.length > 500) rounds = rounds.slice(-500);
    if (bound) put(roundKey(bound), rounds);
  }

  function clear() {
    sync();
    kept = [];
    if (bound) put(shotKey(bound), kept);
  }
  function clearRounds() {
    sync();
    rounds = [];
    if (bound) put(roundKey(bound), rounds);
  }

  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

  function crunch(recs) {
    const n = recs.length;
    const out = { n };
    if (!n) return out;
    const abs = recs.map((r) => Math.abs(r.alignDeg));
    out.avgAbs = mean(abs);
    out.avgDist = mean(recs.map((r) => r.finalDist));
    out.holedPct = (recs.filter((r) => r.holed).length / n) * 100;
    out.lrBias = mean(recs.map((r) => r.alignDeg));
    out.leftPct = (recs.filter((r) => r.alignDeg < 0).length / n) * 100;
    out.rightPct = (recs.filter((r) => r.alignDeg > 0).length / n) * 100;
    const missed = recs.filter((r) => !r.holed);
    out.missed = missed.length;
    out.slBias = missed.length ? mean(missed.map((r) => r.along)) : 0;
    out.shortPct = missed.length ? (missed.filter((r) => r.along < 0).length / missed.length) * 100 : 0;
    out.longPct = missed.length ? (missed.filter((r) => r.along >= 0).length / missed.length) * 100 : 0;
    let bi = 0, wi = 0;
    abs.forEach((v, i) => {
      if (v < abs[bi]) bi = i;
      if (v > abs[wi]) wi = i;
    });
    out.best = recs[bi];
    out.worst = recs[wi];
    out.within = [1, 2, 5, 10].map((t) => ({ t, pct: (abs.filter((v) => v <= t).length / n) * 100 }));
    out.series = abs.map((v, i) => {
      const w = abs.slice(Math.max(0, i - 9), i + 1);
      return { i: i + 1, v, roll: mean(w), rec: recs[i] };
    });
    if (n >= 10) {
      const k = Math.min(20, Math.floor(n / 2));
      out.firstAvg = mean(abs.slice(0, k));
      out.lastAvg = mean(abs.slice(-k));
      out.trendWindow = k;
    }
    const by = {};
    for (const r of recs) (by[r.kind] = by[r.kind] || []).push(r);
    out.byKind = Object.keys(by).map((k) => ({
      kind: k,
      n: by[k].length,
      avgAbs: mean(by[k].map((r) => Math.abs(r.alignDeg))),
      bias: mean(by[k].map((r) => r.alignDeg)),
      avgDist: mean(by[k].map((r) => r.finalDist)),
      holedPct: (by[k].filter((r) => r.holed).length / by[k].length) * 100
    }));
    out.byKind.sort((a, b) => b.avgAbs - a.avgAbs);
    return out;
  }

  function roundCrunch() {
    sync();
    const n = rounds.length;
    const out = { n, rounds: rounds.slice() };
    if (!n) return out;
    const totals = rounds.map((r) => r.total);
    out.best = Math.min.apply(null, totals);
    out.avg = mean(totals);
    out.par = rounds[n-1].par;
    out.last = rounds[n-1];
    out.aces = rounds.reduce((s, r) => s + r.scores.filter((v) => v === 1).length, 0);
    out.holesPlayed = rounds.reduce((s, r) => s + r.scores.length, 0);
    const byHole = [];
    for (let i = 0; i < PP.layouts.count; i++) {
      const vals = rounds.map((r) => r.scores[i]).filter((v) => v != null);
      if (!vals.length) continue;
      byHole.push({
        i,
        name: PP.layouts.defs[i].name,
        par: PP.layouts.defs[i].par,
        avg: mean(vals),
        best: Math.min.apply(null, vals),
        n: vals.length
      });
    }
    out.byHole = byHole;
    out.series = totals.map((v, i) => ({ i: i + 1, v, roll: mean(totals.slice(Math.max(0, i - 9), i + 1)) }));
    return out;
  }

  PP.store = { load, add, clear, crunch, all: () => kept, addRound, clearRounds, rounds: () => rounds, roundCrunch };
})(typeof window !== 'undefined' ? window : globalThis);

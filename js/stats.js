/*
 * stats.js — shot history (kept in this browser's localStorage) and the
 * aggregate numbers shown on the statistics page.
 */
(function (root) {
  'use strict';
  const MG = (root.MG = root.MG || {});
  const KEY = 'parallaxPutting.shots.v1';
  let memory = []; // fallback when storage is unavailable

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) memory = JSON.parse(raw) || [];
    } catch (e) {
      /* storage blocked: keep the in-memory list */
    }
    return memory;
  }

  function save() {
    try {
      if (root.localStorage) root.localStorage.setItem(KEY, JSON.stringify(memory));
    } catch (e) {
      /* ignore */
    }
  }

  function add(rec) {
    memory.push(rec);
    if (memory.length > 5000) memory = memory.slice(-5000);
    save();
  }

  function clear() {
    memory = [];
    save();
  }

  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

  function summary(recs) {
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
    // Chronological series with a 10-shot rolling mean.
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
    for (const r of recs) {
      (by[r.kind] = by[r.kind] || []).push(r);
    }
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

  MG.Stats = { load, add, clear, summary, all: () => memory };
})(typeof window !== 'undefined' ? window : globalThis);

// Redline District — utilities: seeded RNG, math helpers, save/load.
(function (global) {
  'use strict';
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
  const SAVE_KEY = 'redline-district-save-v1';
  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (typeof s !== 'object' || !s) return null;
      return s;
    } catch (e) { return null; }
  }
  function storeSave(save) {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage off */ }
  }
  global.RD = global.RD || {};
  global.RD.util = { mulberry32, clamp, lerp, angleDiff, dist2, loadSave, storeSave, SAVE_KEY };
})(window);

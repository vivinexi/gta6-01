// Redline District — ?shot=start|play|chase|mission staged deterministic scenes.
// Each stages the real game (same seed) and sets window.__shotReady when the frame is set.
(function (global) {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return;
  const G = window.__game;
  if (!G) { window.__shotError = 'no game API'; return; }

  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function key(code, down) {
    window.dispatchEvent(new window.KeyboardEvent(down ? 'keydown' : 'keyup', { code: code, bubbles: true }));
  }
  function ready() {
    // let two frames paint, then signal the screenshot runner
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { window.__shotReady = true; });
    });
  }

  (async function stage() {
    try {
      if (shot === 'start') {
        // title screen over the live city orbit — nothing to start
        await sleep(900);
        ready();
        return;
      }
      G.start();
      await sleep(300);
      if (shot === 'play') {
        // Jax on foot at the Meridian Ave crossing, traffic rolling past
        G.teleport(0, 0);
        G.game.camYaw = Math.PI * 0.85;
        G.game.camPitch = 0.3;
        await sleep(1400);
        ready();
        return;
      }
      if (shot === 'mission') {
        // Mission 1 active: the gold sedan + marker, Jax beside it
        G.startMission();
        G.teleport(-96, 122);
        G.game.camYaw = Math.PI * 0.55;
        G.game.camPitch = 0.28;
        await sleep(1200);
        ready();
        return;
      }
      if (shot === 'chase') {
        // Jax steals the gold sedan, wanted 3, two PD units in pursuit
        G.teleport(-100, 120);
        await sleep(150);
        key('KeyE', true); key('KeyE', false);
        await sleep(150);
        G.setWanted(3);
        G.spawnPolice(2);
        key('KeyW', true); // hold the throttle; the loop drives east on Meridian Ave
        await sleep(4200);
        ready();
        return;
      }
      // unknown shot name: fall back to the title screen
      await sleep(600);
      ready();
    } catch (e) {
      window.__shotError = String(e && e.message || e);
    }
  })();
})(window);

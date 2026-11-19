// Redline District — the 4-mission arc vs Vera Solano. Payouts in $.
(function (global) {
  'use strict';
  const U = global.RD.util;

  const MISSIONS = [
    {
      id: 1, name: 'First Keys', payout: 500,
      brief: 'Wrench needs a car. Steal the gold sedan on Meridian Ave and bring it to his garage.',
      steps: [
        { label: 'Steal the gold sedan marked on the map', hint: 'Walk up to the gold car and press E to get in.' },
        { label: 'Deliver the sedan to Wrench\'s garage', hint: 'Drive into the gold marker outside the garage.' }
      ]
    },
    {
      id: 2, name: 'Smoke Run', payout: 800,
      brief: 'A package is waiting at the east docks. Grab it — the cops will be on you — and get it to Wrench.',
      steps: [
        { label: 'Pick up the package at the east docks', hint: 'Reach the gold marker. Any car will do.' },
        { label: 'Lose the heat and deliver the package to Wrench', hint: 'The cops want that package too. Drive it to the garage.' }
      ]
    },
    {
      id: 3, name: 'Highway Kings', payout: 1200,
      brief: 'Vera\'s courier runs the Meridian loop every night. Stop that car — ram it or shoot it out.',
      steps: [
        { label: 'Stop Vera\'s courier car', hint: 'Ram it at speed or shoot it. Its health is on the tracker.' }
      ]
    },
    {
      id: 4, name: 'Crown Heist', payout: 2500,
      brief: 'The Crown — Vera\'s ledger and her cash — sits in her tower. Take it, then run.',
      steps: [
        { label: 'Get inside Vera\'s tower plaza and grab the Crown', hint: 'On foot. Walk into the gold marker at the tower.' },
        { label: 'Escape with the Crown — bring it to Wrench\'s garage', hint: 'Wanted level 4. Lose them or outrun them.' }
      ]
    }
  ];

  function createMissions(game) {
    const marker = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 30;
    marker.add(beam);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd23f })
    );
    diamond.position.y = 7;
    marker.add(diamond);
    marker.visible = false;
    game.scene.add(marker);

    const state = {
      list: MISSIONS,
      index: -1,        // -1 = no mission yet; 0..3 active mission
      step: 0,
      active: false,
      done: [false, false, false, false],
      target: null,     // {x, z, radius}
      courier: null,
      hasPackage: false,
      grabTimer: 0
    };

    function setTarget(x, z, radius) {
      state.target = { x: x, z: z, radius: radius || 5 };
      marker.position.set(x, 0, z);
      marker.visible = true;
    }
    function clearTarget() { state.target = null; marker.visible = false; }

    function startNext() {
      const next = state.done.findIndex(function (d) { return !d; });
      if (next === -1) return 'All four jobs are done — Meridian City is yours. Free roam.';
      state.index = next;
      state.step = 0;
      state.active = true;
      const m = MISSIONS[next];
      game.toast(m.name + ' — ' + m.brief, 5200);
      game.audio.mission();
      if (next === 0) {
        const car = game.missionCar;
        setTarget(car.x, car.z, 4);
      } else if (next === 1) {
        setTarget(160, 160, 5); // east docks
      } else if (next === 2) {
        game.spawnCourier();
        setTarget(game.courier.x, game.courier.z, 6);
      } else if (next === 3) {
        setTarget(game.world.tower.x, game.world.tower.z - 20, 6);
      }
      return m.name + ' started.';
    }

    function complete() {
      const m = MISSIONS[state.index];
      state.done[state.index] = true;
      state.active = false;
      clearTarget();
      game.addCash(m.payout);
      game.toast('JOB DONE — ' + m.name + '  +$' + m.payout, 4200);
      game.audio.mission();
      game.save();
      if (state.index === 3) game.win();
      return m.name + ' complete. +$' + m.payout;
    }

    function update(dt) {
      // pulse the marker diamond
      if (marker.visible) {
        diamond.rotation.y += dt * 2.2;
        diamond.position.y = 7 + Math.sin(performance.now() / 350) * 0.7;
      }
      if (!state.active) return;
      const m = MISSIONS[state.index];
      const p = game.playerPos();
      const inCar = game.inCar();
      if (state.index === 0) {
        if (state.step === 0) {
          const car = game.missionCar;
          setTarget(car.x, car.z, 4);
          if (inCar && game.currentCar() === car) {
            state.step = 1;
            const g = game.world.garage;
            setTarget(g.x, g.z - 14, 9);
            game.toast('Good. Now deliver it to Wrench\'s garage.', 3600);
          }
        } else if (state.step === 1) {
          const g = game.world.garage;
          if (inCar && game.currentCar() === game.missionCar && U.dist2(p.x, p.z, g.x, g.z - 14) < 9 * 9) {
            game.missionCar.parked = true;
            complete();
          }
        }
      } else if (state.index === 1) {
        if (state.step === 0) {
          if (state.target && U.dist2(p.x, p.z, state.target.x, state.target.z) < 5 * 5) {
            state.step = 1;
            state.hasPackage = true;
            game.setWanted(2);
            game.spawnPolice(2);
            const g = game.world.garage;
            setTarget(g.x, g.z - 14, 9);
            game.toast('Package grabbed! The PD is on you — run!', 4000);
            game.audio.pickup();
          }
        } else if (state.step === 1) {
          const g = game.world.garage;
          if (U.dist2(p.x, p.z, g.x, g.z - 14) < 9 * 9) complete();
        }
      } else if (state.index === 2) {
        const c = game.courier;
        if (c) {
          setTarget(c.x, c.z, 6);
          if (c.health <= 0 && !c.dead) {
            c.dead = true;
            c.targetSpeed = 0;
            complete();
          }
        }
      } else if (state.index === 3) {
        if (state.step === 0) {
          if (!inCar && state.target && U.dist2(p.x, p.z, state.target.x, state.target.z) < 6 * 6) {
            state.grabTimer += dt;
            if (state.grabTimer > 1.0) {
              state.step = 1;
              game.setWanted(4);
              game.spawnPolice(3);
              const g = game.world.garage;
              setTarget(g.x, g.z - 14, 9);
              game.toast('THE CROWN IS YOURS! Run — Vera will send everyone!', 4200);
              game.audio.pickup();
            }
          } else state.grabTimer = 0;
        } else if (state.step === 1) {
          const g = game.world.garage;
          if (U.dist2(p.x, p.z, g.x, g.z - 14) < 9 * 9) complete();
        }
      }
    }

    function status() {
      if (!state.active) {
        const next = state.done.findIndex(function (d) { return !d; });
        if (next === -1) return { title: 'Meridian City Is Yours', obj: 'All four jobs done. Free roam — steal, drive, survive.', sub: 'Jax Moreno · $' + game.cash };
        return { title: 'Next job: ' + MISSIONS[next].name + '  ($' + MISSIONS[next].payout + ')', obj: MISSIONS[next].brief, sub: 'Press M or the button to start. ' + state.done.filter(Boolean).length + '/4 jobs done.' };
      }
      const m = MISSIONS[state.index];
      let obj = m.steps[state.step].label;
      if (state.index === 2 && game.courier) obj += '  — courier health ' + Math.max(0, Math.round(game.courier.health)) + '%';
      if (state.index === 3 && state.step === 0 && state.grabTimer > 0) obj += '  — grabbing… ' + Math.round(state.grabTimer * 100) + '%';
      return { title: 'Mission ' + m.id + '/4 — ' + m.name + '  ($' + m.payout + ')', obj: obj, sub: m.steps[state.step].hint };
    }

    return { state: state, MISSIONS: MISSIONS, startNext: startNext, update: update, status: status, setTarget: setTarget, clearTarget: clearTarget };
  }

  global.RD.missions = { createMissions: createMissions, MISSIONS: MISSIONS };
})(window);

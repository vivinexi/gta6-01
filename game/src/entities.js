// Redline District — entities: player, cars (drivable / traffic / police), pedestrians.
(function (global) {
  'use strict';
  const U = global.RD.util;
  const W = global.RD.world;

  const CAR_COLORS = [0xc0392b, 0x2e86c1, 0x28b463, 0xf1c40f, 0x7d3c98, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0x5d6d7e, 0x16a085];

  function makeCarMesh(color, isPolice) {
    const g = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({ color: color });
    const dark = new THREE.MeshLambertMaterial({ color: 0x11131a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
    body.position.y = 0.55; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), dark);
    cabin.position.set(0, 1.08, -0.25); g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
    const wheels = [];
    for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.36, wz);
      g.add(w); wheels.push(w);
    }
    if (isPolice) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      bar.position.set(0, 1.45, -0.25); g.add(bar);
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
      bar2.position.set(0.45, 1.45, -0.25); g.add(bar2);
      g.userData.lightBar = bar;
      g.userData.lightBar2 = bar2;
    }
    g.userData.wheels = wheels;
    return g;
  }

  function makeCar(x, z, heading, color, opts) {
    opts = opts || {};
    const mesh = makeCarMesh(color, !!opts.police);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    return {
      mesh: mesh, x: x, z: z, heading: heading, speed: 0,
      color: color, police: !!opts.police, traffic: !!opts.traffic,
      health: opts.health || 100, targetSpeed: opts.targetSpeed || 0,
      laneAxis: opts.laneAxis || 'x', laneFixed: opts.laneFixed || 0,
      dir: opts.dir || 1, parked: !!opts.parked, id: opts.id || ('car' + Math.floor(Math.random() * 1e9)),
      isMissionCar: !!opts.isMissionCar, dead: false, steer: 0
    };
  }

  function makePlayerMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0xd7263d });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc68863 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), jacket);
    body.position.y = 1.05; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.68; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshLambertMaterial({ color: 0x141414 }));
    hair.position.y = 1.72; g.add(hair);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), jeans);
    legL.position.set(-0.16, 0.35, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), jacket);
    armL.position.set(-0.42, 1.05, 0); g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
    g.userData = { legL: legL, legR: legR, armL: armL, armR: armR };
    return g;
  }

  function makePedMesh(color) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: color });
    const pants = new THREE.MeshLambertMaterial({ color: 0x333a44 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.32), shirt);
    body.position.y = 1.0; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
    head.position.y = 1.6; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), pants);
    legL.position.set(-0.14, 0.32, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
    g.userData = { legL: legL, legR: legR };
    return g;
  }

  // --- traffic: cars drive along road centrelines, turn at intersections ---
  function updateTraffic(car, dt, rng, buildings) {
    if (car.police || car.parked) return;
    const target = car.targetSpeed || 9;
    car.speed = U.lerp(car.speed, target, dt * 0.8);
    const step = car.speed * car.dir * dt;
    if (car.laneAxis === 'x') car.x += step; else car.z += step;
    // at an intersection, sometimes turn
    const nearX = Math.abs(car.x - Math.round(car.x / W.ROAD_EVERY) * W.ROAD_EVERY) < 1.2;
    const nearZ = Math.abs(car.z - Math.round(car.z / W.ROAD_EVERY) * W.ROAD_EVERY) < 1.2;
    if (nearX && nearZ && rng() < dt * 0.5) {
      if (car.laneAxis === 'x') { car.laneAxis = 'z'; car.laneFixed = Math.round(car.z / W.ROAD_EVERY) * W.ROAD_EVERY; car.dir = rng() < 0.5 ? 1 : -1; }
      else { car.laneAxis = 'x'; car.laneFixed = Math.round(car.x / W.ROAD_EVERY) * W.ROAD_EVERY; car.dir = rng() < 0.5 ? 1 : -1; }
    }
    if (car.laneAxis === 'x') { car.z = U.lerp(car.z, car.laneFixed, dt * 2); car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { car.x = U.lerp(car.x, car.laneFixed, dt * 2); car.heading = car.dir > 0 ? Math.PI : 0; }
    if (car.x > W.HALF - 8 || car.x < -W.HALF + 8 || car.z > W.HALF - 8 || car.z < -W.HALF + 8) {
      car.dir *= -1;
      car.x = U.clamp(car.x, -W.HALF + 10, W.HALF - 10);
      car.z = U.clamp(car.z, -W.HALF + 10, W.HALF - 10);
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }

  // --- pedestrians: stroll sidewalks, flee from danger ---
  function updatePed(ped, dt, danger, rng) {
    const d2 = danger ? U.dist2(ped.x, ped.z, danger.x, danger.z) : 1e9;
    if (d2 < 14 * 14) {
      // flee away from danger
      const dx = ped.x - danger.x, dz = ped.z - danger.z;
      const len = Math.hypot(dx, dz) || 1;
      ped.x += (dx / len) * 7 * dt;
      ped.z += (dz / len) * 7 * dt;
      ped.heading = Math.atan2(dx, dz);
      ped.panic = 1;
    } else {
      ped.panic = Math.max(0, (ped.panic || 0) - dt * 0.3);
      ped.x += Math.sin(ped.heading) * 1.6 * dt;
      ped.z += Math.cos(ped.heading) * 1.6 * dt;
      if (rng() < dt * 0.25) ped.heading += (rng() - 0.5) * 1.6;
      // stay on sidewalks: if on a road, steer back toward block centre
      if (W.isRoad(ped.x, ped.z)) {
        const s = W.snapToRoad(ped.x, ped.z);
        ped.heading = Math.atan2(s.x - ped.x, s.z - ped.z) + Math.PI / 2;
      }
    }
    const p = W.collideCircle(ped.buildings, ped.x, ped.z, 0.5);
    ped.x = p.x; ped.z = p.z;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    const swing = Math.sin(ped.walkPhase += dt * (ped.panic ? 14 : 7)) * 0.5;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
  }

  // --- police pursuit: steer toward the player, ram, flash light bar ---
  function updatePolice(car, dt, playerPos, playerSpeed) {
    const dx = playerPos.x - car.x, dz = playerPos.z - car.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    const dh = U.angleDiff(car.heading, wantHeading);
    car.heading += U.clamp(dh, -2.4 * dt, 2.4 * dt);
    const target = dist > 26 ? 24 : dist > 8 ? 19 : 12;
    car.speed = U.lerp(car.speed, target, dt * 1.2);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const p = W.collideCircle(car.buildings, car.x, car.z, 1.6);
    car.x = p.x; car.z = p.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const t = performance.now() / 280;
    const on = Math.floor(t) % 2 === 0;
    if (car.mesh.userData.lightBar) {
      car.mesh.userData.lightBar.material.color.setHex(on ? 0x3366ff : 0x112244);
      car.mesh.userData.lightBar2.material.color.setHex(on ? 0x441122 : 0xff2233);
    }
    return dist;
  }

  global.RD.entities = {
    makeCar: makeCar, makeCarMesh: makeCarMesh, makePlayerMesh: makePlayerMesh,
    makePedMesh: makePedMesh, updateTraffic: updateTraffic, updatePed: updatePed,
    updatePolice: updatePolice, CAR_COLORS: CAR_COLORS
  };
})(window);

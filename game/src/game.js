// Redline District — main game: input, third-person play, driving, wanted, combat, HUD, minimap.
(function (global) {
  'use strict';
  const U = global.RD.util;
  const E = global.RD.entities;
  const audio = global.RD.audio;

  const params = new URLSearchParams(window.location.search);
  const seedParam = Number.parseInt(params.get('seed') || '', 10);
  const SEED = Number.isInteger(seedParam) ? seedParam : 1;

  const SAVE = U.loadSave() || {};
  const STEP = 1 / 60;

  const canvas = document.getElementById('game');
  const hud = document.getElementById('hud');
  const statusEl = document.getElementById('status');
  const cashEl = document.getElementById('cash');
  const ammoEl = document.getElementById('ammo');
  const hpFill = document.getElementById('hpfill');
  const healthTxt = document.getElementById('healthTxt');
  const wantedEl = document.getElementById('wanted');
  const missionTitle = document.getElementById('missionTitle');
  const missionObj = document.getElementById('missionObj');
  const missionSub = document.getElementById('missionSub');
  const missionBtn = document.getElementById('missionBtn');
  const speedEl = document.getElementById('speed');
  const toastEl = document.getElementById('toast');
  const crossEl = document.getElementById('cross');
  const minimap = document.getElementById('minimap');
  const mm = minimap.getContext('2d');

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87a5c8);
  scene.fog = new THREE.Fog(0x87a5c8, 120, 340);
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x5a5f55, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
  sun.position.set(80, 140, 40);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 800);

  const city = global.RD.world.buildCity(scene, SEED);
  const rng = U.mulberry32(SEED * 7919 + 13);

  // ---------- state ----------
  const game = {
    scene: scene, world: city, cash: SAVE.cash || 0, health: 100, wanted: 0,
    screen: 'title', // title | play | paused | busted | win
    weapon: 'pistol', time: 0, lastCrime: -999, bustedTimer: 0, ramCooldown: 0,
    shootCooldown: 0, toastUntil: 0, camYaw: Math.PI * 0.75, camPitch: 0.32, camDist: 9,
    missionCar: null, courier: null, audio: audio
  };
  game.cash = Math.max(0, game.cash);

  // ---------- player ----------
  const playerMesh = E.makePlayerMesh();
  scene.add(playerMesh);
  const player = {
    mesh: playerMesh, x: -120, z: 100, heading: Math.PI, speed: 0,
    walkPhase: 0, inCar: null, vx: 0, vz: 0
  };
  playerMesh.position.set(player.x, 0, player.z);

  // ---------- cars ----------
  const cars = [];
  function addCar(car) {
    cars.push(car);
    scene.add(car.mesh);
    car.mesh.traverse(function (o) { o.userData.hitOwner = { kind: 'car', ref: car }; });
    return car;
  }
  // mission car: gold sedan on Meridian Ave (road z=120)
  game.missionCar = addCar(E.makeCar(-100, 120, Math.PI / 2, 0xf1c40f, { parked: true, isMissionCar: true, id: 'mission-sedan' }));
  // parked stealable cars
  const parkedSpots = [
    [-60, 120, 0], [-20, 80, 1], [40, 120, 0], [80, 40, 1], [120, 80, 0],
    [-120, 40, 1], [-40, -40, 0], [0, -80, 1], [60, -120, 0], [-80, -120, 1], [160, 0, 0]
  ];
  parkedSpots.forEach(function (s, i) {
    const lane = s[2] === 0 ? s[1] + 3.2 : s[0] + 3.2;
    const x = s[2] === 0 ? s[0] : lane, z = s[2] === 0 ? lane : s[1];
    addCar(E.makeCar(x, z, s[2] === 0 ? Math.PI / 2 : 0, E.CAR_COLORS[i % E.CAR_COLORS.length], { parked: true, id: 'parked-' + i }));
  });
  // AI traffic
  for (let i = 0; i < 10; i++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const fixed = (Math.floor(rng() * 9) - 4) * 40 + (rng() < 0.5 ? -2.5 : 2.5);
    const along = (rng() * 2 - 1) * 180;
    const car = E.makeCar(
      axis === 'x' ? along : fixed, axis === 'x' ? fixed : along,
      0, E.CAR_COLORS[Math.floor(rng() * E.CAR_COLORS.length)],
      { traffic: true, laneAxis: axis, laneFixed: fixed, dir: rng() < 0.5 ? 1 : -1, targetSpeed: 8 + rng() * 5, id: 'traffic-' + i }
    );
    car.buildings = city.buildings;
    addCar(car);
  }
  const police = [];
  function spawnPolice(n) {
    while (police.length < n) {
      const a = rng() * Math.PI * 2;
      const px = U.clamp(player.x + Math.cos(a) * 70, -190, 190);
      const pz = U.clamp(player.z + Math.sin(a) * 70, -190, 190);
      const snap = global.RD.world.snapToRoad(px, pz);
      const car = E.makeCar(snap.x, snap.z, 0, 0x1a1a1a, { police: true, id: 'police-' + police.length + '-' + Date.now() });
      car.buildings = city.buildings;
      police.push(car);
      scene.add(car.mesh);
    }
  }
  function removePolice() {
    police.forEach(function (c) { scene.remove(c.mesh); });
    police.length = 0;
  }

  // ---------- pedestrians ----------
  const peds = [];
  const pedColors = [0x3498db, 0xe67e22, 0x9b59b6, 0x1abc9c, 0xec7063, 0xf4d03f];
  for (let i = 0; i < 16; i++) {
    const x = (rng() * 2 - 1) * 180, z = (rng() * 2 - 1) * 180;
    const mesh = E.makePedMesh(pedColors[i % pedColors.length]);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({ mesh: mesh, x: x, z: z, heading: rng() * Math.PI * 2, walkPhase: rng() * 6, panic: 0, down: false, downTimer: 0, buildings: city.buildings });
  }

  // ---------- missions ----------
  const missions = global.RD.missions.createMissions(game);
  game.missions = missions;
  if (Array.isArray(SAVE.missionsDone)) SAVE.missionsDone.forEach(function (d, i) { if (d) missions.state.done[i] = true; });

  // ---------- helpers exposed to missions ----------
  game.playerPos = function () { return player.inCar ? { x: player.inCar.x, z: player.inCar.z } : { x: player.x, z: player.z }; };
  game.inCar = function () { return !!player.inCar; };
  game.currentCar = function () { return player.inCar; };
  game.setWanted = function (n) { game.wanted = U.clamp(n, 0, 5); game.lastCrime = game.time; };
  game.addCash = function (n) { game.cash += n; };
  game.spawnPolice = spawnPolice;
  game.save = function () {
    U.storeSave({ cash: game.cash, missionsDone: missions.state.done, savedAt: new Date().toISOString() });
  };
  game.win = function () {
    game.screen = 'win';
    document.getElementById('winScreen').style.display = 'flex';
    hud.classList.remove('on');
  };
  game.toast = function (text, ms) {
    toastEl.textContent = text;
    toastEl.style.display = 'block';
    game.toastUntil = performance.now() + (ms || 3000);
  };
  game.spawnCourier = function () {
    if (game.courier) return;
    const car = E.makeCar(-160, 0, Math.PI / 2, 0x8e0f2e, { traffic: true, laneAxis: 'x', laneFixed: 0, dir: 1, targetSpeed: 14, health: 100, id: 'courier' });
    car.buildings = city.buildings;
    game.courier = car;
    addCar(car);
  };

  // ---------- input ----------
  const keys = {};
  let dragging = false, lastMX = 0, lastMY = 0;
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'KeyM') missions.startNext();
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'Digit1') { game.weapon = 'fist'; }
    if (e.code === 'Digit2') { game.weapon = 'pistol'; }
    if (e.code === 'KeyE') tryEnterExit();
    if (e.code === 'Enter' && game.screen === 'title') startGame();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  canvas.addEventListener('mousedown', function (e) { dragging = true; lastMX = e.clientX; lastMY = e.clientY; });
  window.addEventListener('mouseup', function () { dragging = false; });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    game.camYaw -= (e.clientX - lastMX) * 0.005;
    game.camPitch = U.clamp(game.camPitch + (e.clientY - lastMY) * 0.004, 0.05, 1.1);
    lastMX = e.clientX; lastMY = e.clientY;
  });
  canvas.addEventListener('wheel', function (e) {
    game.camDist = U.clamp(game.camDist + Math.sign(e.deltaY) * 1.5, 5, 18);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('click', function () { if (game.screen === 'play') shoot(); });
  window.addEventListener('resize', resize);
  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  resize();

  document.getElementById('playBtn').addEventListener('click', startGame);
  document.getElementById('resumeBtn').addEventListener('click', togglePause);
  document.getElementById('bustedBtn').addEventListener('click', respawnAfterBusted);
  document.getElementById('winBtn').addEventListener('click', function () {
    document.getElementById('winScreen').style.display = 'none';
    game.screen = 'play';
    hud.classList.add('on');
  });
  missionBtn.addEventListener('click', function () { missions.startNext(); });

  function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    hud.classList.add('on');
    game.screen = 'play';
    audio.unlock();
    announce('Playing. Jax Moreno in Meridian City.');
  }
  function togglePause() {
    if (game.screen === 'play') {
      game.screen = 'paused';
      document.getElementById('pauseScreen').style.display = 'flex';
    } else if (game.screen === 'paused') {
      game.screen = 'play';
      document.getElementById('pauseScreen').style.display = 'none';
    }
  }
  function announce(msg) { statusEl.textContent = msg; }

  function nearestCar(maxD) {
    let best = null, bestD = maxD * maxD;
    cars.forEach(function (c) {
      if (c.police || c.traffic || c.dead) return;
      if (c === player.inCar) return;
      const d2 = U.dist2(player.x, player.z, c.x, c.z);
      if (d2 < bestD) { bestD = d2; best = c; }
    });
    return best;
  }
  function tryEnterExit() {
    if (game.screen !== 'play') return;
    if (player.inCar) {
      const car = player.inCar;
      player.inCar = null;
      player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
      player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
      player.heading = car.heading;
      playerMesh.visible = true;
      return;
    }
    const car = nearestCar(3.6);
    if (!car) return;
    player.inCar = car;
    car.parked = false;
    playerMesh.visible = false;
    if (car.isMissionCar || car.parked) { /* stealing */ }
    game.setWanted(Math.max(game.wanted, 1));
    game.toast('Car stolen — the PD has your plate. Wanted level 1.', 3200);
    audio.pickup();
  }

  // ---------- combat ----------
  const raycaster = new THREE.Raycaster();
  const muzzle = new THREE.PointLight(0xffcc66, 0, 18);
  scene.add(muzzle);
  function shoot() {
    if (game.shootCooldown > 0) return;
    game.shootCooldown = game.weapon === 'fist' ? 0.45 : 0.22;
    if (game.weapon === 'fist') {
      audio.punch();
      const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
      peds.forEach(function (p) {
        if (p.down) return;
        const dx = p.x - player.x, dz = p.z - player.z;
        if (dx * dx + dz * dz < 2.4 * 2.4 && dx * fx + dz * fz > 0) {
          p.down = true; p.downTimer = 6;
          p.mesh.rotation.x = -Math.PI / 2; p.mesh.position.y = 0.4;
          commitCrime(1);
        }
      });
      return;
    }
    audio.shot();
    muzzle.position.copy(camera.position).add(new THREE.Vector3(0, -0.4, 0));
    muzzle.intensity = 60;
    setTimeout(function () { muzzle.intensity = 0; }, 60);
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    raycaster.far = 90;
    const targets = [];
    peds.forEach(function (p) { if (!p.down) targets.push(p.mesh); });
    cars.forEach(function (c) { if (c !== player.inCar) targets.push(c.mesh); });
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && !obj.userData.hitOwner) obj = obj.parent;
      const owner = obj ? obj.userData.hitOwner : null;
      if (owner && owner.kind === 'ped') {
        const p = owner.ref;
        p.down = true; p.downTimer = 8;
        p.mesh.rotation.x = -Math.PI / 2; p.mesh.position.y = 0.4;
        commitCrime(1);
        game.toast('Pedestrian down — witnesses called it in.', 2200);
      } else if (owner && owner.kind === 'car') {
        const c = owner.ref;
        damageCar(c, 12);
        commitCrime(1);
      }
    }
  }
  // tag meshes for raycast ownership (peds; cars are tagged in addCar)
  peds.forEach(function (p) { p.mesh.traverse(function (o) { o.userData.hitOwner = { kind: 'ped', ref: p }; }); });
  function damageCar(car, amount) {
    car.health -= amount;
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      car.targetSpeed = 0;
      car.speed = 0;
      if (car === game.courier) game.toast('Courier stopped!', 3000);
      else game.toast('Car disabled.', 2200);
    }
  }
  function commitCrime(level) {
    game.setWanted(Math.max(game.wanted, level));
    if (game.wanted > 0) spawnPolice(Math.min(game.wanted, 4));
  }

  // ---------- update ----------
  function updatePlayer(dt) {
    if (player.inCar) {
      const car = player.inCar;
      const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 0.6 : 0);
      const steerIn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
      const maxSpeed = 27;
      car.speed = U.clamp(car.speed + fwd * 14 * dt, -8, maxSpeed);
      if (!fwd) car.speed = U.lerp(car.speed, 0, dt * 1.4);
      car.steer = U.lerp(car.steer, steerIn, dt * 6);
      if (Math.abs(car.speed) > 0.3) car.heading += car.steer * (car.speed > 0 ? 1 : -1) * dt * (0.9 + Math.min(1, Math.abs(car.speed) / 10) * 1.3);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const p = global.RD.world.collideCircle(city.buildings, car.x, car.z, 1.7);
      if (p.x !== car.x || p.z !== car.z) {
        if (Math.abs(car.speed) > 6) { audio.crash(); damageCar(car, 4); }
        car.speed *= 0.4;
        car.x = p.x; car.z = p.z;
      }
      // car vs car / ped collisions
      cars.forEach(function (o) {
        if (o === car || o.dead) return;
        const d2 = U.dist2(car.x, car.z, o.x, o.z);
        if (d2 < 3.4 * 3.4) {
          const d = Math.sqrt(d2) || 0.01;
          const push = (3.4 - d) / 2;
          const nx = (car.x - o.x) / d, nz = (car.z - o.z) / d;
          car.x += nx * push; car.z += nz * push;
          if (Math.abs(car.speed) > 5) {
            damageCar(o, 15);
            audio.crash();
            if (o.traffic) { o.targetSpeed = 0; }
            car.speed *= 0.55;
            commitCrime(1);
          } else if (!o.traffic && !o.police) { o.x -= nx * push; o.z -= nz * push; }
        }
      });
      peds.forEach(function (pd) {
        if (pd.down) return;
        if (U.dist2(car.x, car.z, pd.x, pd.z) < 2.6 * 2.6) {
          pd.down = true; pd.downTimer = 8;
          pd.mesh.rotation.x = -Math.PI / 2; pd.mesh.position.y = 0.4;
          audio.crash();
          commitCrime(1);
          game.toast('You hit a pedestrian — wanted level up.', 2600);
        }
      });
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      player.heading = car.heading;
      return;
    }
    // on foot
    let mx = 0, mz = 0;
    const sy = Math.sin(game.camYaw), cy = Math.cos(game.camYaw);
    if (keys.KeyW || keys.ArrowUp) { mx -= sy; mz -= cy; }
    if (keys.KeyS || keys.ArrowDown) { mx += sy; mz += cy; }
    if (keys.KeyA || keys.ArrowLeft) { mx -= cy; mz += sy; }
    if (keys.KeyD || keys.ArrowRight) { mx += cy; mz -= sy; }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      player.speed = 6.2;
      player.heading = Math.atan2(mx, mz);
      player.x += mx * player.speed * dt;
      player.z += mz * player.speed * dt;
      player.walkPhase += dt * 11;
    } else player.speed = 0;
    const p = global.RD.world.collideCircle(city.buildings, player.x, player.z, 0.6);
    player.x = p.x; player.z = p.z;
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
    const swing = len > 0 ? Math.sin(player.walkPhase) * 0.55 : 0;
    playerMesh.userData.legL.rotation.x = swing;
    playerMesh.userData.legR.rotation.x = -swing;
    playerMesh.userData.armL.rotation.x = -swing * 0.7;
    playerMesh.userData.armR.rotation.x = swing * 0.7;
  }

  function updateWanted(dt) {
    game.shootCooldown = Math.max(0, game.shootCooldown - dt);
    game.ramCooldown = Math.max(0, game.ramCooldown - dt);
    if (game.wanted === 0) return;
    // police pursuit
    const pp = game.playerPos();
    let nearest = 1e9;
    police.forEach(function (c) {
      const d = E.updatePolice(c, dt, pp, player.speed);
      if (d < nearest) nearest = d;
      // ram damage
      if (d < 3.6 && game.ramCooldown <= 0) {
        game.ramCooldown = 1.0;
        game.health -= 9;
        audio.crash();
        game.toast('PD rammed you!', 1800);
      }
    });
    // decay when hidden
    if (game.time - game.lastCrime > 18 && nearest > 45) {
      game.wanted -= 1;
      game.lastCrime = game.time;
      if (game.wanted === 0) removePolice();
    }
    // busted: on foot, police close, player slow
    if (!player.inCar && nearest < 4 && player.speed < 1.5) {
      game.bustedTimer += dt;
      if (game.bustedTimer > 1.5) doBusted('The Meridian City PD caught up with Jax Moreno on foot.');
    } else game.bustedTimer = 0;
    if (game.health <= 0) doBusted('Jax Moreno was beaten down by the Meridian City PD.');
  }
  function doBusted(text) {
    if (game.screen !== 'play') return;
    game.screen = 'busted';
    game.cash = Math.max(0, Math.floor(game.cash * 0.9));
    game.wanted = 0;
    removePolice();
    document.getElementById('bustedTxt').textContent = text + ' The PD took 10% of your cash.';
    document.getElementById('bustedScreen').style.display = 'flex';
    hud.classList.remove('on');
    audio.busted();
    game.save();
  }
  function respawnAfterBusted() {
    document.getElementById('bustedScreen').style.display = 'none';
    if (player.inCar) player.inCar = null;
    playerMesh.visible = true;
    player.x = city.garage.x; player.z = city.garage.z - 16;
    player.health = 100; game.health = 100;
    playerMesh.position.set(player.x, 0, player.z);
    game.screen = 'play';
    hud.classList.add('on');
  }

  function updateCamera(dt) {
    const target = player.inCar
      ? { x: player.inCar.x, z: player.inCar.z, y: 1.6 }
      : { x: player.x, z: player.z, y: 1.6 };
    const dist = player.inCar ? game.camDist + 2.5 : game.camDist;
    // camera follows behind the player's facing when driving; free orbit on foot
    const yaw = player.inCar ? player.heading + Math.PI : game.camYaw;
    const cx = target.x + Math.sin(yaw) * Math.cos(game.camPitch) * dist;
    const cz = target.z + Math.cos(yaw) * Math.cos(game.camPitch) * dist;
    const cy = target.y + Math.sin(game.camPitch) * dist + 1.2;
    camera.position.set(cx, cy, cz);
    camera.lookAt(target.x, target.y + 0.6, target.z);
  }

  // ---------- HUD ----------
  let lastHud = '';
  function updateHUD() {
    const st = missions.status();
    const hudText = game.cash + '|' + Math.round(game.health) + '|' + game.wanted + '|' + st.title + '|' + st.obj + '|' + game.weapon + '|' + (player.inCar ? Math.round(Math.abs(player.inCar.speed) * 3.6) : 0);
    if (hudText !== lastHud) {
      lastHud = hudText;
      cashEl.textContent = '$' + game.cash.toLocaleString('en-US');
      hpFill.style.width = Math.max(0, game.health) + '%';
      healthTxt.textContent = 'Health ' + Math.round(game.health);
      ammoEl.textContent = game.weapon === 'fist' ? 'Fists — press 2 for pistol' : 'Pistol · ∞ ammo — press 1 for fists';
      wantedEl.innerHTML = [1, 2, 3, 4, 5].map(function (i) {
        return '<span class="' + (i <= game.wanted ? '' : 'off') + '">★</span>';
      }).join('');
      missionTitle.textContent = st.title;
      missionObj.textContent = st.obj;
      missionSub.textContent = st.sub;
      missionBtn.textContent = missions.state.active ? 'Mission active — ' + MISSIONS_NAME() : 'Start mission (M)';
      crossEl.style.display = game.weapon === 'pistol' && !player.inCar ? 'block' : 'none';
    }
    speedEl.textContent = player.inCar ? Math.round(Math.abs(player.inCar.speed) * 3.6) + ' km/h' : '';
    if (game.toastUntil && performance.now() > game.toastUntil) { toastEl.style.display = 'none'; game.toastUntil = 0; }
    drawMinimap();
  }
  function MISSIONS_NAME() { return 'in progress'; }

  function drawMinimap() {
    const S = 164, scale = S / (global.RD.world.HALF * 2);
    mm.fillStyle = '#0d1420';
    mm.fillRect(0, 0, S, S);
    mm.strokeStyle = '#2c3547';
    mm.lineWidth = 4;
    for (let r = -200; r <= 200; r += 40) {
      mm.beginPath(); mm.moveTo(0, (r + 200) * scale); mm.lineTo(S, (r + 200) * scale); mm.stroke();
      mm.beginPath(); mm.moveTo((r + 200) * scale, 0); mm.lineTo((r + 200) * scale, S); mm.stroke();
    }
    // garage + tower
    mm.fillStyle = '#ffd23f';
    mm.fillRect((city.garage.x + 200) * scale - 4, (city.garage.z + 200) * scale - 4, 8, 8);
    mm.fillStyle = '#ff2d55';
    mm.fillRect((city.tower.x + 200) * scale - 4, (city.tower.z + 200) * scale - 4, 8, 8);
    // mission marker
    if (missions.state.target) {
      const t = missions.state.target;
      const pulse = 3 + Math.sin(performance.now() / 200) * 2;
      mm.fillStyle = '#ffd23f';
      mm.beginPath(); mm.arc((t.x + 200) * scale, (t.z + 200) * scale, pulse + 3, 0, Math.PI * 2); mm.fill();
    }
    // cars + police
    cars.forEach(function (c) {
      if (c === player.inCar) return;
      mm.fillStyle = c.police ? '#3b82f6' : '#9aa3b2';
      mm.fillRect((c.x + 200) * scale - 1.5, (c.z + 200) * scale - 1.5, 3, 3);
    });
    police.forEach(function (c) {
      mm.fillStyle = '#3b82f6';
      mm.fillRect((c.x + 200) * scale - 2, (c.z + 200) * scale - 2, 4, 4);
    });
    // player arrow
    const pp = game.playerPos();
    mm.save();
    mm.translate((pp.x + 200) * scale, (pp.z + 200) * scale);
    mm.rotate(Math.PI - player.heading);
    mm.fillStyle = '#ffffff';
    mm.beginPath(); mm.moveTo(0, -6); mm.lineTo(4, 5); mm.lineTo(-4, 5); mm.closePath(); mm.fill();
    mm.restore();
  }

  // ---------- main loop ----------
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (game.screen === 'play') {
      acc += dt;
      while (acc >= STEP) {
        game.time += STEP;
        updatePlayer(STEP);
        cars.forEach(function (c) { if (c.traffic && !c.dead) E.updateTraffic(c, STEP, rng, city.buildings); });
        const danger = game.playerPos();
        peds.forEach(function (p) {
          if (p.down) { p.downTimer -= STEP; if (p.downTimer <= 0) { p.down = false; p.mesh.rotation.x = 0; p.mesh.position.y = 0; } return; }
          E.updatePed(p, STEP, danger, rng);
        });
        updateWanted(STEP);
        missions.update(STEP);
        acc -= STEP;
      }
      audio.step(dt, player.inCar ? player.inCar.speed : player.speed, game.wanted);
      updateCamera(dt);
      updateHUD();
    } else if (game.screen === 'title') {
      // slow cinematic orbit behind the start screen
      game.time += dt;
      const t = game.time * 0.05;
      camera.position.set(Math.sin(t) * 90, 42, Math.cos(t) * 90);
      camera.lookAt(0, 4, 0);
      cars.forEach(function (c) { if (c.traffic && !c.dead) E.updateTraffic(c, dt, rng, city.buildings); });
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  // ---------- debug / verification API ----------
  window.__game = {
    game: game, player: player, cars: cars, police: police, peds: peds,
    start: startGame,
    state: function () {
      const pp = game.playerPos();
      return {
        screen: game.screen, cash: game.cash, health: Math.round(game.health), wanted: game.wanted,
        x: pp.x, z: pp.z, heading: player.heading, inCar: !!player.inCar,
        carSpeed: player.inCar ? player.inCar.speed : 0,
        missionIndex: missions.state.index, missionStep: missions.state.step,
        missionActive: missions.state.active, missionsDone: missions.state.done.slice(),
        target: missions.state.target, policeCount: police.length,
        missionCar: game.missionCar ? { x: game.missionCar.x, z: game.missionCar.z } : null,
        garage: { x: city.garage.x, z: city.garage.z },
        courier: game.courier ? { x: game.courier.x, z: game.courier.z, health: game.courier.health } : null
      };
    },
    startMission: function () { return missions.startNext(); },
    setWanted: function (n) { game.setWanted(n); },
    spawnPolice: spawnPolice,
    teleport: function (x, z) {
      if (player.inCar) { player.inCar.x = x; player.inCar.z = z; }
      else { player.x = x; player.z = z; }
    }
  };

  // save line on the start screen
  const saveLine = document.getElementById('saveLine');
  if (SAVE.cash || (SAVE.missionsDone && SAVE.missionsDone.some(Boolean))) {
    saveLine.textContent = 'Save found: $' + (SAVE.cash || 0) + ' · ' + (SAVE.missionsDone || []).filter(Boolean).length + '/4 jobs done.';
  }
})(window);

// Solmar Heat — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between title, play, paused, busted and story-complete screens.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import * as THREE from '../vendor/three.module.js';
import { CAR, PALETTE, PLAYER, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createCamera, createPlayer } from './player.js';
import { driveCar, updateChaseCamera } from './vehicles.js';
import { createParkedCars, createTraffic, nearestCar } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createWanted } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createSave } from './save.js';
import { ACTION_ENTER, ACTION_JUMP, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT, createInput } from './input.js';
import { runShotSteps, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// Renderer.
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.skyBottom);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

const random = createRandom(seed);
const world = createWorld(scene, random);
const player = createPlayer(scene);
const parkedCars = createParkedCars(scene, world, random, 8);
const traffic = createTraffic(scene, world, random);
const pedestrians = createPedestrians(scene, world, random);
const wanted = createWanted(scene, world, random);
const missions = createMissions();
const combat = createCombat(scene);
const hud = createHud(document);
const audio = createAudio();
const save = createSave();
const cam = createCamera(camera);

const G = {
  scene,
  camera,
  cam,
  world,
  player,
  playerCar: null,
  parkedCars,
  traffic,
  pedestrians,
  wanted,
  missions,
  combat,
  hud,
  audio,
  save,
  cash: 0,
  hasPackage: false,
  state: 'title',
  time: 0,
  shake: 0,
  get allCars() {
    return [...parkedCars, ...traffic.cars.map((e) => e.car), ...wanted.policeCars.map((e) => e.car)];
  },
};

function resetGame(fresh) {
  if (fresh) {
    G.cash = 0;
    save.clear();
  }
  player.reset(0, 10, 0);
  G.playerCar = null;
  G.hasPackage = false;
  G.shake = 0;
  wanted.reset();
  combat.clearEnemies();
  for (const car of parkedCars) {
    car.isPlayer = false;
    car.health = CAR.maxHealth;
  }
  missions.reset(G);
}

function ejectFromCar() {
  const car = G.playerCar;
  if (!car) return;
  car.isPlayer = false;
  player.x = car.x + Math.cos(car.heading) * 3;
  player.z = car.z - Math.sin(car.heading) * 3;
  player.y = 0;
  player.vy = 0;
  player.health = Math.max(20, player.health - 20);
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  G.playerCar = null;
  hud.showPhone('Your car is wrecked! Get out and find another ride.');
}

function enterCar() {
  if (G.playerCar) {
    ejectFromCar();
    return;
  }
  const candidates = [...parkedCars, ...traffic.cars.map((e) => e.car).filter((c) => Math.abs(c.speed) < 2)];
  const car = nearestCar(candidates, player.x, player.z, CAR.enterDistance);
  if (!car) return;
  // A stolen traffic car leaves the traffic flow.
  const tIndex = traffic.cars.findIndex((e) => e.car === car);
  if (tIndex >= 0) {
    traffic.cars.splice(tIndex, 1);
    if (!parkedCars.includes(car)) parkedCars.push(car);
  }
  car.isPlayer = true;
  car.parked = false;
  car.speed = 0;
  G.playerCar = car;
  player.mesh.visible = false;
  wanted.addCrime(1, G.time);
  pedestrians.scare(player.x, player.z, 40);
  hud.showPhone('Rico: Nice. That one is yours now — the heat is on you, though.');
}

function onBusted() {
  G.state = 'busted';
  hud.showScreen('busted');
  audio.busted();
  save.save(G);
}

/** One fixed step of the live game. `move`/`actions`/`orbit` come from input. */
function stepGame(dt, move, actions, orbit) {
  G.time += dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 2.5);

  if (G.state === 'title') {
    // Ambient city behind the title screen: traffic and pedestrians move.
    traffic.update(dt, null);
    pedestrians.update(dt, null, null);
    world.update(dt, G.time);
    return;
  }
  if (G.state !== 'play') return;

  if (actions & ACTION_MUTE) {
    const muted = audio.toggleMute();
    hud.showPhone(muted ? 'Sound off (M to turn back on).' : 'Sound on.');
  }
  if (actions & ACTION_PAUSE) {
    G.state = 'paused';
    hud.showScreen('pause');
    return;
  }

  // Enter / exit a car.
  if (actions & ACTION_ENTER) enterCar();

  // Drive or walk.
  if (G.playerCar) {
    const car = G.playerCar;
    driveCar(car, dt, move, world, audio, (strength) => {
      G.shake = Math.max(G.shake, strength * 0.9);
    });
    audio.engine(Math.abs(car.speed) / CAR.maxSpeed, true);
    if (pedestrians.hitByCar(car)) {
      wanted.addCrime(1, G.time);
      pedestrians.scare(car.x, car.z, 30);
      hud.showPhone('You hit a pedestrian! The cops are coming.');
    }
    if (car.health <= 0) ejectFromCar();
  } else {
    const fullMove = { ...move, jump: Boolean(actions & ACTION_JUMP) };
    player.update(dt, fullMove, cam.yaw, world, audio);
    audio.engine(0, false);
    if (actions & ACTION_SHOOT) {
      const shot = combat.shoot(camera, world, audio, new THREE.Vector3(player.x, 0, player.z));
      if (shot && shot.fired) {
        wanted.addCrime(1, G.time);
        pedestrians.scare(player.x, player.z, 35);
      }
    }
    if (actions & ACTION_PUNCH) combat.punch(player, audio, world);
  }

  // The rest of the city.
  traffic.update(dt, G.playerCar);
  const threat = G.playerCar && Math.abs(G.playerCar.speed) > 6
    ? { x: G.playerCar.x, z: G.playerCar.z, radius: 10 }
    : null;
  pedestrians.update(dt, threat, G.playerCar);
  wanted.update(dt, G.time, player, G.playerCar, world, audio, onBusted);
  audio.siren(wanted.sirenOn);
  combat.update(dt, player, G.playerCar, world, audio);
  missions.update(dt, G);
  world.update(dt, G.time);

  // Slow health regen when calm.
  if (wanted.stars === 0 && combat.enemies.length === 0 && player.health < PLAYER.maxHealth) {
    player.health = Math.min(PLAYER.maxHealth, player.health + 2.5 * dt);
  }

  // HUD.
  const hp = G.playerCar ? G.playerCar.health : player.health;
  hud.setHealth(hp, 100);
  hud.setCash(G.cash);
  hud.setStars(wanted.stars);
  hud.setObjective(missions.objective);
  hud.setSpeed(G.playerCar ? Math.abs(G.playerCar.speed) * 3.6 : null);
  if (!G.playerCar) {
    const near = nearestCar([...parkedCars, ...traffic.cars.map((e) => e.car)], player.x, player.z, CAR.enterDistance);
    if (near) hud.setHint('E — Steal car');
    else if (combat.enemies.length) hud.setHint('Click — Shoot    F — Punch');
    else hud.setHint('');
  } else {
    hud.setHint('E — Exit car');
  }
  hud.drawMinimap(G);

  // Camera.
  if (G.playerCar) {
    updateChaseCamera(camera, G.playerCar, dt, G.shake);
  } else {
    const orbitDelta = { dx: orbit.dx, dy: orbit.dy };
    cam.update(dt, { x: player.x, y: player.y, z: player.z }, orbitDelta, G.shake);
  }
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function startFresh() {
    audio.unlock();
    resetGame(true);
    G.state = 'play';
    hud.showScreen('play');
  }

  function startContinue() {
    audio.unlock();
    resetGame(false);
    G.state = 'play';
    hud.showScreen('play');
    if (!save.load(G)) missions.reset(G);
  }

  function resume() {
    G.state = 'play';
    hud.showScreen('play');
  }

  document.getElementById('start-button').addEventListener('click', startFresh);
  const continueButton = document.getElementById('continue-button');
  continueButton.style.display = save.hasSave() ? 'inline-block' : 'none';
  continueButton.addEventListener('click', startContinue);
  document.getElementById('resume-button').addEventListener('click', resume);
  document.getElementById('quit-button').addEventListener('click', () => {
    save.save(G);
    G.state = 'title';
    hud.showScreen('start');
  });
  document.getElementById('busted-restart').addEventListener('click', () => {
    audio.unlock();
    const mission = missions.index;
    resetGame(false);
    missions.start(G, mission);
    G.state = 'play';
    hud.showScreen('play');
  });
  document.getElementById('complete-again').addEventListener('click', () => {
    startFresh();
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    const orbit = input.takeOrbit();
    const move = input.move();
    if (G.state === 'paused' && (actions & ACTION_PAUSE)) {
      resume();
    } else {
      let pending = actions;
      while (accumulator >= STEP && (G.state === 'title' || G.state === 'play')) {
        stepGame(STEP, move, pending, orbit);
        accumulator -= STEP;
        // One-shot actions are only for the first step of the frame.
        pending &= ~(ACTION_ENTER | ACTION_JUMP | ACTION_PUNCH | ACTION_SHOOT);
      }
    }
    if (G.state === 'title') {
      // Slow cinematic orbit around downtown for the title backdrop.
      const t = now / 1000;
      camera.position.set(Math.sin(t * 0.05) * 150, 55, Math.cos(t * 0.05) * 150 + 40);
      camera.lookAt(0, 10, -20);
    }
    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === 'play') {
      G.state = 'paused';
      hud.showScreen('pause');
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Title backdrop: a parked player, one mission ready, city alive behind.
  // Boot with resetGame(false) so an existing save is not wiped.
  resetGame(false);
  G.state = 'title';
  hud.showScreen('start');
  window.__game = G;
  requestAnimationFrame(frame);
}

function runShot(name) {
  resetGame(true);
  // No save exists in a fresh shot run: hide the Continue button.
  document.getElementById('continue-button').style.display = 'none';
  const staging = stageShot(G, name);
  runShotSteps(G, staging, stepGame);
  // Camera for the shot (fixed angles use the staged position).
  if (staging.camera) {
    camera.position.copy(staging.camera.pos);
    camera.lookAt(staging.camera.look);
  }
  hud.setHealth(G.playerCar ? G.playerCar.health : player.health, 100);
  hud.setCash(G.cash);
  hud.setStars(wanted.stars);
  hud.setObjective(missions.objective);
  hud.setSpeed(G.playerCar ? Math.abs(G.playerCar.speed) * 3.6 : null);
  hud.drawMinimap(G);
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  window.__game = G;
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else runGame();

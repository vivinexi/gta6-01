// Neon Harbor — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and three.js paints what is there. The game
// moves between title, play, paused, busted, wasted and story-complete screens.
//
// ?seed=N fixes the city layout. ?shot=start|play|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it a few times and sets
// window.__shotReady for a screenshot. ?nofx=1 turns shadows off (headless).
import * as THREE from '../vendor/three.module.js';
import {
  CAR,
  CITY_HALF,
  COMBAT,
  GAME_TITLE,
  MISSIONS,
  PALETTE,
  PLAYER,
  POLICE,
  STEP,
} from './config.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWorld } from './world.js';
import { createPlayer, stepPlayer } from './player.js';
import { createCar, removeCar, speedKmh, stepCar, steerToward } from './vehicles.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createPedestrians, stepPedestrians } from './pedestrians.js';
import { createPolice, decayWanted, stepPolice, syncPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat, nearestRival, punch, shoot, spawnRivals, stepCombat } from './combat.js';
import { createHud } from './hud.js';
import { clearSave, readSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const nofx = params.has('nofx');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message || event.error));
});

const world = createWorld(canvas, seed, { shadows: !nofx && !shot });
world.scene.userData.world = world;
const random = createRandom(seed ^ 0x77aa);

// The game state. Everything the systems share lives here.
const G = {
  mode: 'title',
  time: 0,
  cash: 0,
  wanted: 0,
  health: PLAYER.health,
  player: createPlayer(world.scene, 10, 140),
  playerCar: null,
  cars: [],
  traffic: createTraffic(world.scene, seed),
  peds: createPedestrians(world.scene, seed),
  police: createPolice(world.scene, seed),
  combat: createCombat(world.scene, seed),
  cameraYaw: Math.PI,
  cameraPitch: 0.32,
  autopilot: null,
  autoStuck: 0,
  autoReverse: 0,
  marker: { x: 0, z: 0, visible: false },
  missionCar: null,
  titleAngle: 0,
};

function announce(message) {
  status.textContent = message;
}

// Parked cars Maya can steal, including the canary-yellow sedan for job one.
function spawnParkedCars() {
  const spots = [
    { x: 24, z: 128, heading: 0, color: 0x2e6fc2 },
    { x: -60, z: 84, heading: Math.PI / 2, color: 0x3aa655 },
    { x: 120, z: -60, heading: -Math.PI / 2, color: 0xe8e8e8 },
    { x: -120, z: 60, heading: 0, color: 0xc26a2e },
    { x: 60, z: -120, heading: Math.PI, color: 0x7a3aa6 },
    { x: 180, z: 120, heading: Math.PI / 2, color: 0x222831 },
  ];
  for (const spot of spots) {
    G.cars.push(createCar(world.scene, { ...spot, kind: 'parked', stealable: true }));
  }
  const sedan = createCar(world.scene, {
    x: -150,
    z: -205,
    heading: Math.PI,
    color: 0xe8c832,
    kind: 'parked',
    stealable: true,
  });
  sedan.missionCar = true;
  G.cars.push(sedan);
  G.missionCar = sedan;
}

spawnParkedCars();

const missions = createMissions({
  setMarker(x, z, visible) {
    G.marker = { x, z, visible };
    world.setMarker(x, z, visible);
  },
  setObjective(text) {
    hud.setObjective(text);
  },
  setTimer(seconds) {
    hud.setTimer(seconds);
  },
  toast(message, seconds) {
    hud.toast(message, seconds);
    announce(message);
  },
  addCash(amount) {
    G.cash += amount;
    hud.setCash(G.cash);
  },
  sfx(name) {
    audio[name] ? audio[name]() : null;
  },
  save() {
    saveGame();
  },
  spawnRivals(count, x, z) {
    spawnRivals(G.combat, count, x, z);
  },
  playerPos() {
    return playerPos();
  },
  isDriving() {
    return !!G.playerCar;
  },
  getWanted() {
    return G.wanted;
  },
  onStoryComplete() {
    G.mode = 'complete';
    hud.showScreen('complete');
    hud.setCompleteStats(`Cash earned: $${G.cash.toLocaleString('en-US')} · All 4 jobs done · Port Vela is yours.`);
    audio.cash();
  },
});

function playerPos() {
  if (G.playerCar) return { x: G.playerCar.x, z: G.playerCar.z };
  return { x: G.player.x, z: G.player.z };
}

function playerHeading() {
  if (G.playerCar) return G.playerCar.heading;
  return G.player.heading;
}

function saveGame() {
  const pos = playerPos();
  writeSave({ cash: G.cash, missionIndex: missions.state.index, health: Math.max(1, Math.ceil(G.health)), x: pos.x, z: pos.z });
}

function setWanted(level) {
  G.wanted = Math.max(0, Math.min(5, level));
  hud.setStars(G.wanted);
}

function addWanted(amount) {
  setWanted(G.wanted + amount);
}

function nearestStealableCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.removed) continue;
    const d = Math.hypot(car.x - G.player.x, car.z - G.player.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(car) {
  G.playerCar = car;
  car.kind = 'player';
  G.player.mesh.group.visible = false;
  const wasMissionCar = !!car.missionCar;
  // Stealing a car in the street is a crime — unless Maya already owns the heat.
  if (car.stealable) {
    addWanted(1);
    hud.toast('Car stolen! The police are on their way.', 3);
    audio.horn();
  }
  if (wasMissionCar && missions.state.index === 0 && missions.state.stepIndex === 1) {
    hud.toast('Otto: "That’s the one. Now bring it to my garage."', 4);
  }
  audio.engine(0, true);
}

function exitCar() {
  const car = G.playerCar;
  if (!car) return;
  car.speed = 0;
  const side = { x: car.x + Math.cos(car.heading) * 2.4, z: car.z - Math.sin(car.heading) * 2.4 };
  G.player.x = side.x;
  G.player.z = side.z;
  G.player.y = 0;
  G.player.vy = 0;
  G.player.heading = car.heading;
  G.player.mesh.group.visible = true;
  G.playerCar = null;
}

function respawn(fine, place) {
  G.cash = Math.max(0, G.cash - fine);
  hud.setCash(G.cash);
  setWanted(0);
  G.health = PLAYER.health;
  hud.setHealth(G.health);
  if (G.playerCar) {
    G.playerCar.speed = 0;
    G.playerCar = null;
  }
  G.player.x = place.x;
  G.player.z = place.z;
  G.player.y = 0;
  G.player.mesh.group.visible = true;
  G.player.heading = 0;
  missions.start(missions.state.index);
  G.mode = 'play';
  hud.showScreen(null);
}

function updateCamera(dt) {
  const target = G.playerCar
    ? { x: G.playerCar.x, z: G.playerCar.z, y: 1.4 }
    : { x: G.player.x, z: G.player.z, y: 1.6 + G.player.y };
  if (G.mode === 'title') {
    G.titleAngle += dt * 0.05;
    const cx = Math.sin(G.titleAngle) * 150;
    const cz = Math.cos(G.titleAngle) * 150;
    world.camera.position.set(cx, 55, cz);
    world.camera.lookAt(0, 10, 0);
    return;
  }
  // Driving pulls the camera behind the car; on foot it orbits freely.
  if (G.playerCar) {
    let diff = G.playerCar.heading - G.cameraYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.cameraYaw += diff * Math.min(1, 2.2 * dt);
  }
  // High enough that streetlights and building corners don't block the view.
  const dist = G.playerCar ? 14 : 8;
  const height = G.playerCar ? 7 : 3.6;
  const cx = target.x + Math.sin(G.cameraYaw) * dist;
  const cz = target.z + Math.cos(G.cameraYaw) * dist;
  const cy = target.y + height - G.cameraPitch * 6;
  world.camera.position.set(cx, Math.max(1.2, cy), cz);
  world.camera.lookAt(target.x, target.y + 0.6, target.z);
}

function updateHud() {
  hud.setHealth(G.health);
  hud.setCash(G.cash);
  hud.setStars(G.wanted);
  hud.setSpeed(G.playerCar ? speedKmh(G.playerCar) : 0, !!G.playerCar);
  hud.drawMinimap({
    playerX: playerPos().x,
    playerZ: playerPos().z,
    playerHeading: playerHeading(),
    markerX: G.marker.x,
    markerZ: G.marker.z,
    markerVisible: G.marker.visible,
    traffic: G.traffic,
    rivals: G.combat.rivals,
    police: G.police.cars,
  });
  let prompt = '';
  if (G.mode === 'play') {
    if (G.playerCar) {
      prompt = Math.abs(G.playerCar.speed) < 3 ? 'E — Exit car' : '';
    } else {
      const car = nearestStealableCar(4);
      if (car) prompt = 'E — Steal car';
      else if (nearestRival(G.combat, G.player.x, G.player.z, COMBAT.punchRange + 0.6)) prompt = 'F — Punch   ·   Click — Shoot';
    }
  }
  hud.setPrompt(prompt);
}

/** One fixed simulation step. Used by the live loop and by the shot stager. */
function stepFixed(dt) {
  G.time += dt;
  world.update(dt, G.time);

  if (G.mode === 'title') {
    stepTraffic(G.traffic, dt, world.resolveCircle, null);
    stepPedestrians(G.peds, dt, [], world.resolveCircle);
    return;
  }
  if (G.mode !== 'play') return;

  // Camera orbit from the pointer; the autopilot (shots and tests) overrides it.
  const orbit = input.takeOrbit();
  G.cameraYaw -= orbit.dx * 0.004;
  G.cameraPitch = Math.max(-0.4, Math.min(0.9, G.cameraPitch + orbit.dy * 0.003));

  const actions = input.takeActions();

  // Autopilot input (screenshots and the headless playtest drive through this).
  // Modes: 'point' (one target), 'route' (waypoints along the streets, in order),
  // 'mission' (the current mission step's target). A stuck car reverses out.
  let autoMove = null;
  if (G.autopilot) {
    let target = null;
    if (G.autopilot.mode === 'mission') target = missionTarget();
    else if (G.autopilot.mode === 'route') {
      const points = G.autopilot.points;
      while (G.autopilot.i < points.length) {
        const p = points[G.autopilot.i];
        const px = G.playerCar ? G.playerCar.x : G.player.x;
        const pz = G.playerCar ? G.playerCar.z : G.player.z;
        if (Math.hypot(p.x - px, p.z - pz) < 8) G.autopilot.i += 1;
        else break;
      }
      target = G.autopilot.i < points.length ? points[G.autopilot.i] : null;
    } else target = { x: G.autopilot.x, z: G.autopilot.z };
    if (target) {
      if (G.playerCar) {
        const steer = steerToward(G.playerCar, target.x, target.z);
        const diff = Math.abs(angleDiff(targetHeading(G.playerCar, target), G.playerCar.heading));
        autoMove = { throttle: diff > 1.4 ? 0.25 : 1, steer };
        if (Math.abs(G.playerCar.speed) < 1 && autoMove.throttle > 0) G.autoStuck += dt;
        else G.autoStuck = 0;
        if (G.autoStuck > 2) {
          G.autoReverse = 1;
          G.autoStuck = 0;
        }
        if (G.autoReverse > 0) {
          G.autoReverse -= dt;
          autoMove = { throttle: -0.7, steer: -steer };
        }
      } else {
        const dx = target.x - G.player.x;
        const dz = target.z - G.player.z;
        G.cameraYaw = Math.atan2(-dx, -dz);
        autoMove = { x: 0, y: 1, run: true };
      }
    } else if (G.autopilot.mode === 'route' && G.playerCar && Math.abs(G.playerCar.speed) > 0.5) {
      // The route is done: brake to a stop instead of coasting on.
      autoMove = { throttle: -1, steer: 0 };
    }
  }

  const moveX = autoMove ? autoMove.x : input.moveX();
  const moveY = autoMove ? autoMove.y : input.moveY();
  const running = autoMove ? !!autoMove.run : input.run();

  if (G.playerCar) {
    const car = G.playerCar;
    const drive = autoMove || {
      throttle: moveY,
      steer: -moveX * (car.speed < 0 ? -1 : 1),
    };
    stepCar(car, drive, dt, world.resolveCircle, [...G.traffic, ...G.police.cars, ...G.cars]);
    if (car.crash) {
      audio.crash();
      car.crash = false;
    }
    if (car.health <= 0) {
      hud.toast('Your car is wrecked! Bail out.', 4);
      exitCar();
    }
    // Running over a pedestrian is a crime — and the crowd sees it.
    for (const ped of [...G.peds]) {
      if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.2 && Math.abs(car.speed) > 3) {
        world.scene.remove(ped.mesh.group);
        G.peds.splice(G.peds.indexOf(ped), 1);
        addWanted(1);
        hud.toast('Pedestrian hit! +1 star.', 3);
        audio.crash();
      }
    }
    audio.engine(Math.min(1, Math.abs(car.speed) / CAR.maxSpeed), true);
  } else {
    const jump = input.jump();
    stepPlayer(G.player, { x: moveX, y: moveY }, G.cameraYaw, jump, running, dt, world.resolveCircle);
    audio.engine(0, false);
  }

  if (actions & ACTION_INTERACT) {
    if (G.playerCar) {
      if (Math.abs(G.playerCar.speed) < 3) exitCar();
    } else {
      const car = nearestStealableCar(4);
      if (car) enterCar(car);
    }
  }

  if (actions & ACTION_SHOOT && !G.playerCar) {
    audio.unlock();
    const dir = cameraForwardXZ();
    const hit = shoot(G.combat, { x: world.camera.position.x, z: world.camera.position.z }, dir);
    audio.shot();
    addWanted(0); // Shooting itself draws heat below; a hit is what the police notice.
    if (hit) {
      addWanted(1);
      hud.toast('Breaker down!', 2);
    }
  }
  if (actions & ACTION_PUNCH && !G.playerCar) {
    const hit = punch(G.combat, G.player.x, G.player.z, G.player.heading);
    audio.punch();
    if (hit) hud.toast('Nice hit!', 1);
  }

  // Traffic, pedestrians, police and rivals.
  stepTraffic(G.traffic, dt, world.resolveCircle, G.playerCar);
  const threats = [];
  if (G.playerCar && Math.abs(G.playerCar.speed) > 4) threats.push({ x: G.playerCar.x, z: G.playerCar.z, radius: 10 });
  stepPedestrians(G.peds, dt, threats, world.resolveCircle);

  syncPolice(G.police, G.wanted, playerPos().x, playerPos().z, world.resolveCircle);
  const policeEvents = stepPolice(G.police, dt, G.wanted, G.player, G.playerCar, world.resolveCircle, G.traffic);
  if (policeEvents.damage > 0 && G.playerCar) {
    G.playerCar.health -= policeEvents.damage;
  }
  if (policeEvents.busted) {
    audio.busted();
    G.mode = 'busted';
    hud.showScreen('busted');
    announce('Busted! The police caught Maya.');
    return;
  }
  const newWanted = decayWanted(G.police, dt, G.wanted);
  if (newWanted !== G.wanted) {
    setWanted(newWanted);
    if (newWanted === 0) hud.toast('You lost the heat.', 3);
  }
  audio.siren(G.wanted > 0 && G.police.cars.length > 0, G.time);

  const combatEvents = stepCombat(G.combat, dt, G.player, world.resolveCircle);
  if (combatEvents.damage > 0) {
    G.health -= combatEvents.damage;
    hud.toast('Taking fire!', 1);
  }
  if (combatEvents.killed > 0) addWanted(combatEvents.killed);

  if (G.health <= 0) {
    G.health = 0;
    audio.busted();
    G.mode = 'wasted';
    hud.showScreen('wasted');
    announce('Wasted! Maya is down.');
    return;
  }

  missions.update(dt);
  updateCamera(dt);
  updateHud();
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function targetHeading(car, target) {
  return Math.atan2(target.x - car.x, target.z - car.z);
}

function missionTarget() {
  const step = missions.currentStep();
  if (!step || !step.target) return null;
  return { x: step.target[0], z: step.target[1] };
}

function cameraForwardXZ() {
  const dir = new THREE.Vector3();
  world.camera.getWorldDirection(dir);
  const len = Math.hypot(dir.x, dir.z) || 1;
  return { x: dir.x / len, z: dir.z / len };
}

function newGame(fromSave = null) {
  G.cash = fromSave ? fromSave.cash : 0;
  G.health = fromSave ? fromSave.health : PLAYER.health;
  G.player.x = fromSave ? fromSave.x : 10;
  G.player.z = fromSave ? fromSave.z : 140;
  G.player.y = 0;
  G.player.vy = 0;
  G.player.heading = 0;
  G.player.mesh.group.visible = true;
  G.playerCar = null;
  setWanted(0);
  hud.setHealth(G.health);
  hud.setCash(G.cash);
  hud.setObjective('');
  hud.setTimer(0);
  G.mode = 'play';
  hud.showScreen(null);
  missions.start(fromSave ? fromSave.missionIndex : 0);
  announce(`${GAME_TITLE}. ${missions.objectiveLabel()}`);
}

function toTitle() {
  G.mode = 'title';
  hud.showScreen('title');
  const save = readSave();
  hud.setTitleStats(
    save
      ? `Continue: $${save.cash.toLocaleString('en-US')} · Job ${save.missionIndex + 1} of ${MISSIONS.length} — ${MISSIONS[save.missionIndex].name}`
      : 'A new story in Port Vela. No save yet.',
  );
  world.titleCamera();
}

// Buttons on the overlays.
function wireButton(id, fn) {
  const button = document.getElementById(id);
  if (button) button.addEventListener('click', () => {
    audio.unlock();
    audio.click();
    fn();
  });
}
wireButton('btn-new', () => {
  clearSave();
  newGame();
});
wireButton('btn-continue', () => {
  const save = readSave();
  newGame(save || undefined);
});
wireButton('btn-resume', () => {
  G.mode = 'play';
  hud.showScreen(null);
});
wireButton('btn-restart', () => {
  newGame();
});
wireButton('btn-quit', () => {
  saveGame();
  toTitle();
});
wireButton('btn-busted-ok', () => respawn(POLICE.bustFine, { x: 60, z: 160 }));
wireButton('btn-wasted-ok', () => respawn(150, { x: 0, z: 0 }));
wireButton('btn-complete-again', () => {
  G.mode = 'play';
  hud.showScreen(null);
  hud.toast('Free roam — Port Vela is yours.', 4);
});
wireButton('btn-complete-title', () => toTitle());

// The live loop: Enter/click starts from title, Space confirms on end screens.
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) {
    const muted = audio.toggleMute();
    hud.toast(muted ? 'Sound muted (M).' : 'Sound on (M).', 2);
  }
  if (G.mode === 'title' && (actions & ACTION_CONFIRM)) {
    const save = readSave();
    newGame(save || undefined);
  } else if (G.mode === 'play' && (actions & ACTION_PAUSE)) {
    G.mode = 'paused';
    hud.showScreen('pause');
    saveGame();
    announce('Paused.');
  } else if ((G.mode === 'busted' || G.mode === 'wasted') && (actions & ACTION_CONFIRM)) {
    respawn(G.mode === 'busted' ? POLICE.bustFine : 150, G.mode === 'busted' ? { x: 60, z: 160 } : { x: 0, z: 0 });
  } else if (G.mode === 'complete' && (actions & ACTION_CONFIRM)) {
    G.mode = 'play';
    hud.showScreen(null);
  } else if (G.mode === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
    G.mode = 'play';
    hud.showScreen(null);
  }
  // Re-queue the in-game one-shot actions for the fixed steps below; the
  // screen transitions above already consumed confirm, pause and mute.
  if (actions & ACTION_INTERACT) input.debugAction(ACTION_INTERACT);
  if (actions & ACTION_SHOOT) input.debugAction(ACTION_SHOOT);
  if (actions & ACTION_PUNCH) input.debugAction(ACTION_PUNCH);

  let accumulator = frameAccumulator + dt;
  while (accumulator >= STEP && (G.mode === 'play' || G.mode === 'title')) {
    stepFixed(STEP);
    accumulator -= STEP;
  }
  frameAccumulator = G.mode === 'play' || G.mode === 'title' ? accumulator : 0;
  if (G.mode === 'title') updateCamera(dt);
  world.renderer.render(world.scene, world.camera);
}

let last = performance.now();
let frameAccumulator = 0;

// Debug and test hooks: the headless playtest drives the real game through these.
window.__game = {
  G,
  missions,
  newGame,
  toTitle,
  stepFixed,
  teleport(x, z) {
    if (G.playerCar) {
      G.playerCar.x = x;
      G.playerCar.z = z;
      G.playerCar.speed = 0;
    } else {
      G.player.x = x;
      G.player.z = z;
    }
  },
  setCameraYaw(yaw) {
    G.cameraYaw = yaw;
  },
  forceEnterNearestCar() {
    if (G.playerCar) return G.playerCar;
    let best = null;
    let bestD = Infinity;
    for (const car of G.cars) {
      if (car.removed) continue;
      const d = Math.hypot(car.x - G.player.x, car.z - G.player.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best) {
      G.player.x = best.x - 3;
      G.player.z = best.z;
      enterCar(best);
    }
    return best;
  },
  setWanted(level) {
    setWanted(level);
  },
  startMission(i) {
    missions.start(i);
  },
  set autopilot(value) {
    G.autopilot = value;
  },
  get autopilot() {
    return G.autopilot;
  },
  getState() {
    const pos = playerPos();
    return {
      mode: G.mode,
      cash: G.cash,
      wanted: G.wanted,
      health: Math.round(G.health),
      missionIndex: missions.state.index,
      missionName: missions.current() ? missions.current().name : null,
      stepIndex: missions.state.stepIndex,
      stepLabel: missions.currentStep() ? missions.currentStep().label : null,
      objective: missions.objectiveLabel(),
      playerX: Math.round(pos.x * 10) / 10,
      playerZ: Math.round(pos.z * 10) / 10,
      driving: !!G.playerCar,
      speedKmh: G.playerCar ? Math.round(speedKmh(G.playerCar)) : 0,
      carHealth: G.playerCar ? Math.round(G.playerCar.health) : null,
      rivals: G.combat.rivals.length,
      rivalHealth: G.combat.rivals.map((r) => Math.round(r.health)),
      police: G.police.cars.length,
      traffic: G.traffic.length,
      peds: G.peds.length,
      timer: Math.round(missions.state.timer * 10) / 10,
      errors: window.__errors,
    };
  },
};

if (shot) {
  // Screenshot mode: stage the scene, paint it a few times, signal readiness.
  toTitle();
  const staged = stageShot(shot, window.__game);
  hud.showScreen(staged.screen === 'title' ? 'title' : null);
  if (staged.screen === 'title') world.titleCamera();
  else updateCamera(0);
  updateHud();
  let painted = 0;
  (function paint() {
    world.renderer.render(world.scene, world.camera);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  })();
} else {
  toTitle();
  requestAnimationFrame(frame);
}

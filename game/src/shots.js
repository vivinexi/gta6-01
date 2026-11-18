// The screenshot scenes behind ?shot=start|play|chase|mission. Each one sets
// up the real game from a fresh world with a fixed seed and plays it forward
// for a fixed number of steps with a scripted input, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import * as THREE from '../vendor/three.module.js';
import { STEP } from './config.js';

/**
 * Stage the named scene on the game object G and return how many fixed steps
 * to run with what scripted input, which screen to show and where to put the
 * camera (null = the normal follow camera).
 */
export function stageShot(G, name) {
  const shot = name === 'play' || name === 'chase' || name === 'mission' ? name : 'start';
  G.state = 'play';
  G.audio.unlock();
  if (shot === 'start') {
    G.player.reset(8, -8, Math.PI * 0.75);
    G.missions.reset(G);
    G.hud.showScreen('start');
    return {
      screen: 'start',
      steps: 3 * 60,
      move: { forward: 0, strafe: 0, run: false, jump: false },
      camera: {
        pos: new THREE.Vector3(90, 42, 150),
        look: new THREE.Vector3(-20, 12, -60),
      },
    };
  }
  if (shot === 'play') {
    // On foot on the road at z=0, walking west past a parked car, with
    // pedestrians on the sidewalk and traffic on the road.
    G.player.reset(80, 0, -Math.PI / 2);
    G.cam.yaw = Math.PI / 2;
    const parked = G.parkedCars[0];
    parked.x = 70;
    parked.z = 4;
    parked.heading = Math.PI / 2;
    parked.syncMesh();
    const p0 = G.pedestrians.peds[0];
    p0.x = 76;
    p0.z = 9;
    p0.heading = -Math.PI / 2;
    const p1 = G.pedestrians.peds[1];
    p1.x = 66;
    p1.z = -9;
    p1.heading = Math.PI / 2;
    G.missions.reset(G);
    G.hud.showScreen('play');
    return {
      screen: 'play',
      steps: 2 * 60,
      move: { forward: 1, strafe: 0, run: false, jump: false },
      camera: null,
    };
  }
  if (shot === 'chase') {
    // The player tears down the middle of the city in a red car, 3 stars,
    // two police cars on the bumper.
    const car = G.parkedCars[0];
    car.x = 0;
    car.z = 120;
    car.heading = Math.PI;
    car.speed = 30;
    car.isPlayer = true;
    car.parked = false;
    car.syncMesh();
    G.playerCar = car;
    G.player.mesh.visible = false;
    G.wanted.setStars(3, 0);
    G.missions.reset(G);
    G.hud.showScreen('play');
    // Police right behind.
    const p1 = G.wanted.policeCars[0];
    const p2 = G.wanted.policeCars[1];
    if (p1) {
      p1.car.x = -4;
      p1.car.z = 138;
      p1.car.heading = Math.PI;
      p1.car.speed = 32;
      p1.car.syncMesh();
    }
    if (p2) {
      p2.car.x = 5;
      p2.car.z = 148;
      p2.car.heading = Math.PI;
      p2.car.speed = 30;
      p2.car.syncMesh();
    }
    return {
      screen: 'play',
      steps: 90,
      move: { forward: 1, strafe: 0, run: false, jump: false },
      camera: null,
    };
  }
  // mission: the Sunset Run, first drop ahead, Vultures on the sidewalk.
  // The car sits ON the road x=-222 heading south, straight at the first
  // drop marker, so the beacon is visible down the road.
  const car = G.parkedCars[1] || G.parkedCars[0];
  car.x = -222;
  car.z = -180;
  car.heading = 0;
  car.speed = 12;
  car.isPlayer = true;
  car.parked = false;
  car.syncMesh();
  G.playerCar = car;
  G.player.mesh.visible = false;
  G.missions.reset(G);
  G.missions.start(G, 3);
  // The run starts as soon as the staged steps run (the player is already
  // in the car, so mission 4 moves to its timed stage on the first step).
  G.wanted.setStars(1, 0);
  G.combat.spawnEnemy(-212, -196, 'Vulture');
  G.combat.spawnEnemy(-210, -206, 'Vulture');
  G.hud.showScreen('play');
  return {
    screen: 'play',
    steps: 60,
    move: { forward: 1, strafe: 0, run: false, jump: false },
    camera: null,
  };
}

/** Run the staged scene's steps through the game's own step function. */
export function runShotSteps(G, staging, stepGame) {
  for (let i = 0; i < staging.steps; i += 1) {
    stepGame(STEP, staging.move, 0, { dx: 0, dy: 0 });
  }
}

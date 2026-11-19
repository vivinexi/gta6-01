// Cars: the mesh, the arcade driving model and the steal/exit rules.
// A car is a plain object the player, traffic and police all share; only the
// driver differs (human input, a waypoint loop, or a chase target).
import * as THREE from '../vendor/three.module.js';
import { CAR, PALETTE } from './config.js';

let carId = 0;

export function makeCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.65, 2.1),
    new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
  );
  cabin.position.set(0, 1.2, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and tail lights so a car reads at sunset.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (const hx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), headMat);
    head.position.set(hx, 0.6, 2.22);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), tailMat);
    tail.position.set(hx, 0.6, -2.22);
    group.add(tail);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.65, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.28, 1.65, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.5), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.28, 1.65, -0.2);
    group.add(blue);
  }
  return { group, wheels };
}

export function createCar(scene, { x, z, heading = 0, color = 0xc23b2e, kind = 'parked', isPolice = false, stealable = false }) {
  const { group, wheels } = makeCarMesh(isPolice ? PALETTE.police : color, isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  const car = {
    id: carId += 1,
    kind,
    group,
    wheels,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    health: CAR.health,
    color,
    isPolice,
    stealable,
    // Smoke puffs when the car is badly damaged; the renderer reads this flag.
    smoking: false,
    removed: false,
  };
  return car;
}

export function removeCar(scene, car) {
  if (car.removed) return;
  car.removed = true;
  scene.remove(car.group);
}

/**
 * One step of arcade driving. `drive` is { throttle: -1..1, steer: -1..1 }.
 * The car turns more at low speed, less at high speed, and slides a little.
 */
export function stepCar(car, drive, dt, resolveCircle, otherCars) {
  const maxFwd = car.isPolice ? 40 : CAR.maxSpeed;
  if (drive.throttle > 0) {
    car.speed += CAR.accel * drive.throttle * dt;
  } else if (drive.throttle < 0) {
    car.speed += (car.speed > 0.5 ? -CAR.brake : CAR.reverseAccel) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(maxFwd, car.speed));
  if (Math.abs(car.speed) < 0.05) car.speed = 0;

  const steerTarget = drive.steer * CAR.steer * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
  car.steer += (steerTarget - car.steer) * Math.min(1, CAR.grip * dt);
  car.heading += (car.steer * car.speed * 0.055) * dt * 3;

  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;

  // Buildings push the car out; a hard hit costs health and speed.
  // Collision damage has a short cooldown: scraping along one wall is one
  // crash, not sixty — otherwise a single kerb ends the car.
  car.hitCd = Math.max(0, (car.hitCd || 0) - dt);
  const before = { x: car.x, z: car.z };
  resolveCircle(car, CAR.radius);
  const pushed = Math.hypot(car.x - before.x, car.z - before.z);
  if (pushed > 0.01 && Math.abs(car.speed) > 6 && car.hitCd <= 0) {
    car.health -= Math.abs(car.speed) * 0.15;
    car.speed *= 0.45;
    car.crash = true;
    car.hitCd = 0.6;
  }

  // Soft car-to-car bumps: push apart and trade a little speed.
  if (otherCars) {
    for (const other of otherCars) {
      if (other === car || other.removed) continue;
      const dx = car.x - other.x;
      const dz = car.z - other.z;
      const d = Math.hypot(dx, dz);
      const min = CAR.radius * 2;
      if (d > 0.001 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        car.x += nx * push;
        car.z += nz * push;
        other.x -= nx * push;
        other.z -= nz * push;
        const rel = Math.abs(car.speed - other.speed);
        if (rel > 4 && car.hitCd <= 0) {
          car.health -= rel * 0.12;
          other.health -= rel * 0.12;
          car.crash = true;
          car.hitCd = 0.6;
        }
        car.speed *= 0.92;
      }
    }
  }

  car.smoking = car.health < 45;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.38;
}

/** Steering toward a point, as a -1..1 value: the autopilot and police share it. */
export function steerToward(car, tx, tz) {
  const dx = tx - car.x;
  const dz = tz - car.z;
  const targetHeading = Math.atan2(dx, dz);
  let diff = targetHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.max(-1, Math.min(1, diff * 1.6));
}

export function speedKmh(car) {
  return Math.abs(car.speed) * 3.6;
}

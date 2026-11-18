// Cars: a low-poly body built from boxes, arcade driving, building
// collision on two axle points, damage smoke and screen shake on hard hits.
import * as THREE from '../vendor/three.module.js';
import { CAR, CITY, PALETTE } from './config.js';
import { clamp, wrapAngle } from './random.js';

export const CAR_COLORS = [0xd23c3c, 0x2e86de, 0xf2c94c, 0x7a4fd0, 0x2fae6e, 0xe07b39, 0xd8d8d8, 0x22262b];

export function makeCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.2, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.62, CAR.length), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.3, 0.55, CAR.length * 0.45), darkMat);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  for (const hx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), lightMat);
    head.position.set(hx, 0.62, CAR.length / 2 + 0.01);
    group.add(head);
  }
  let lightBar = null;
  let lightL = null;
  let lightR = null;
  if (isPolice) {
    lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    lightBar.position.set(0, 1.45, -0.25);
    group.add(lightBar);
    lightL = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 2 }),
    );
    lightL.position.set(-0.28, 1.58, -0.25);
    group.add(lightL);
    lightR = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }),
    );
    lightR.position.set(0.28, 1.58, -0.25);
    group.add(lightR);
  }
  group.userData = { lightL, lightR };
  return group;
}

/** A car in the world: parked, traffic, police or the player's ride. */
export function makeCar(scene, x, z, heading, color, isPolice = false) {
  const mesh = makeCarMesh(color, isPolice);
  scene.add(mesh);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    mesh,
    x,
    z,
    heading,
    speed: 0,
    health: CAR.maxHealth,
    isPolice,
    isPlayer: false,
    parked: true,
    smokeTimer: 0,
    /** Axle points used for building collision. */
    axlePoints() {
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      return [
        { x: this.x + fx * 1.7, z: this.z + fz * 1.7 },
        { x: this.x - fx * 1.7, z: this.z - fz * 1.7 },
      ];
    },
    syncMesh() {
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
    },
  };
}

/**
 * Arcade driving for the player's car. Returns an event object:
 * { crashed: 0..1 } when a hard building hit happened this step.
 */
export function driveCar(car, dt, move, world, audio, onCrash) {
  const forward = move.forward;
  const steer = move.strafe;
  const speed01 = Math.abs(car.speed) / CAR.maxSpeed;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.6 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  car.speed = clamp(car.speed, -CAR.reverseSpeed, CAR.maxSpeed);
  const steerScale = clamp(1 - speed01 * 0.7, 0.3, 1);
  car.heading += steer * CAR.steer * steerScale * dt * (car.speed >= 0 ? 1 : -1) * (Math.abs(car.speed) > 0.2 ? 1 : 0);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // Building collision on the two axle points: stop and bounce a little.
  let crashed = 0;
  const before = car.speed;
  const test = { x: nx, z: nz, heading: car.heading };
  const fx = Math.sin(test.heading);
  const fz = Math.cos(test.heading);
  const hitFront = world.hitsBuilding(nx + fx * 1.7, nz + fz * 1.7, 1.1);
  const hitRear = world.hitsBuilding(nx - fx * 1.7, nz - fz * 1.7, 1.1);
  if (hitFront || hitRear || Math.abs(nx) > CITY.bounds || nz > CITY.seaZ - 8 || nz < -CITY.bounds) {
    const impact = Math.abs(before);
    if (impact > 6) {
      crashed = Math.min(1, impact / CAR.maxSpeed);
      car.health = Math.max(0, car.health - impact * 0.9);
      audio.crash(crashed);
      onCrash(crashed);
      world.sparks(car.x + fx * 2, 0.8, car.z + fz * 2, 8);
    }
    car.speed = -before * 0.25;
  } else {
    car.x = nx;
    car.z = nz;
  }
  // Skid dust when turning hard at speed.
  if (Math.abs(steer) > 0.5 && Math.abs(car.speed) > 14 && Math.random() < 0.4) {
    world.dust(car.x - fx * 1.5, 0.2, car.z - fz * 1.5, 2);
  }
  // Damage smoke.
  if (car.health < 45) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      world.smoke(car.x, 1.2, car.z, 2);
      car.smokeTimer = 0.12;
    }
  }
  car.syncMesh();
  return { crashed };
}

/** Chase camera behind a car: farther back and lower than the on-foot camera. */
export function updateChaseCamera(camera, car, dt, shake) {
  const dist = 13;
  const height = 5.2;
  const tx = car.x + Math.sin(car.heading) * 6;
  const tz = car.z + Math.cos(car.heading) * 6;
  const cx = car.x - Math.sin(car.heading) * dist;
  const cz = car.z - Math.cos(car.heading) * dist;
  const shX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  camera.position.set(cx + shX, height + shY, cz);
  camera.lookAt(tx, 1.5, tz);
  void dt;
}

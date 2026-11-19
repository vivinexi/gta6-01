// Harbour traffic: ordinary cars looping the street grid. Each one follows a
// rectangular loop of street centrelines, slows for the car ahead, and keeps
// Port Vela feeling alive while Maya works.
import { createCar, stepCar, steerToward } from './vehicles.js';
import { PALETTE, STREETS } from './config.js';
import { createRandom } from './random.js';

/** Rectangular loops around downtown blocks, on street centrelines. */
function makeLoops() {
  const loops = [];
  for (const a of [-120, -60, 0, 60]) {
    for (const b of [-120, -60, 0, 60]) {
      loops.push([
        { x: a, z: b },
        { x: a + 60, z: b },
        { x: a + 60, z: b + 60 },
        { x: a, z: b + 60 },
      ]);
    }
  }
  return loops;
}

export function createTraffic(scene, seed) {
  const random = createRandom(seed ^ 0x5eed);
  const loops = makeLoops();
  const cars = [];
  for (let i = 0; i < 10; i += 1) {
    const loop = loops[Math.floor(random() * loops.length)];
    const wp = Math.floor(random() * loop.length);
    const point = loop[wp];
    const next = loop[(wp + 1) % loop.length];
    const heading = Math.atan2(next.x - point.x, next.z - point.z);
    const car = createCar(scene, {
      x: point.x + (random() - 0.5) * 4,
      z: point.z + (random() - 0.5) * 4,
      heading,
      color: PALETTE.car[Math.floor(random() * PALETTE.car.length)],
      kind: 'traffic',
    });
    car.loop = loop;
    car.wp = (wp + 1) % loop.length;
    car.cruise = 9 + random() * 5;
    cars.push(car);
  }
  return cars;
}

export function stepTraffic(cars, dt, resolveCircle, playerCar) {
  const all = playerCar ? [...cars, playerCar] : cars;
  for (const car of cars) {
    if (car.removed) continue;
    const target = car.loop[car.wp];
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    if (Math.hypot(dx, dz) < 6) car.wp = (car.wp + 1) % car.loop.length;
    // Slow down for the car ahead on the same stretch.
    let throttle = 0.55;
    for (const other of all) {
      if (other === car || other.removed) continue;
      const ox = other.x - car.x;
      const oz = other.z - car.z;
      const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
      const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 12 && side < 3) throttle = 0;
    }
    const steer = steerToward(car, target.x, target.z);
    const want = throttle > 0 ? Math.min(car.cruise, 16) : 0;
    const drive = { throttle: car.speed < want ? throttle : 0, steer };
    stepCar(car, drive, dt, resolveCircle, all);
    // Traffic never speeds: clamp to its cruise.
    if (car.speed > car.cruise) car.speed = car.cruise;
  }
}

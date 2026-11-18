// Traffic: AI cars cruising the road grid. Each one drives along one road
// line; at an intersection it may turn onto the crossing road, and at the
// city edge it wraps to the other side. They slow for the player's car.
import { CITY, TRAFFIC } from './config.js';
import { CAR_COLORS, makeCar } from './vehicles.js';
import { ROAD_LINES } from './world.js';
import { pick } from './random.js';

export function createTraffic(scene, world, random) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const axis = random() < 0.5 ? 'x' : 'z';
    const line = pick(random, ROAD_LINES);
    const dir = random() < 0.5 ? 1 : -1;
    const along = (random() - 0.5) * (CITY.bounds * 2 - 40);
    const lane = (random() < 0.5 ? -3.2 : 3.2) * dir;
    const x = axis === 'x' ? along : line + lane;
    const z = axis === 'x' ? line + lane : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
    const car = makeCar(scene, x, z, heading, pick(random, CAR_COLORS));
    car.parked = false;
    car.speed = TRAFFIC.speedMin + random() * (TRAFFIC.speedMax - TRAFFIC.speedMin);
    cars.push({ car, axis, line, dir, cruise: car.speed, turnTimer: 1 + random() * 3 });
  }

  function respawn(entry) {
    const axis = random() < 0.5 ? 'x' : 'z';
    const line = pick(random, ROAD_LINES);
    const dir = random() < 0.5 ? 1 : -1;
    const along = -dir * (CITY.bounds - 10);
    const lane = (random() < 0.5 ? -3.2 : 3.2) * dir;
    entry.axis = axis;
    entry.line = line;
    entry.dir = dir;
    entry.car.x = axis === 'x' ? along : line + lane;
    entry.car.z = axis === 'x' ? line + lane : along;
    entry.car.heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
    entry.car.speed = entry.cruise;
    entry.car.syncMesh();
  }

  return {
    cars,
    update(dt, playerCar) {
      for (const entry of cars) {
        const { car } = entry;
        // Slow down for the player's car ahead.
        let target = entry.cruise;
        if (playerCar) {
          const dx = playerCar.x - car.x;
          const dz = playerCar.z - car.z;
          const dist = Math.hypot(dx, dz);
          const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
          if (dist < 12 && ahead > 0) target = Math.min(target, 3);
        }
        car.speed += (target - car.speed) * Math.min(1, dt * 2);
        const along = entry.axis === 'x' ? car.x : car.z;
        // At an intersection, sometimes turn onto the crossing road.
        entry.turnTimer -= dt;
        const nearLine = ROAD_LINES.find((l) => Math.abs(along - l) < 4);
        if (entry.turnTimer <= 0 && nearLine !== undefined && Math.random() < 0.3) {
          entry.turnTimer = 2 + Math.random() * 4;
          const oldAxis = entry.axis;
          entry.axis = oldAxis === 'x' ? 'z' : 'x';
          entry.line = nearLine;
          const newDir = Math.random() < 0.5 ? 1 : -1;
          entry.dir = newDir;
          if (entry.axis === 'x') {
            car.z = entry.line + (Math.random() < 0.5 ? -3.2 : 3.2) * newDir;
            car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            car.x = entry.line + (Math.random() < 0.5 ? -3.2 : 3.2) * newDir;
            car.heading = newDir > 0 ? 0 : Math.PI;
          }
        }
        const nx = car.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.z + Math.cos(car.heading) * car.speed * dt;
        // Stop at buildings (should not happen on roads) and wrap at the edge.
        if (world.hitsBuilding(nx, nz, 1.4)) {
          respawn(entry);
          continue;
        }
        car.x = nx;
        car.z = nz;
        if (Math.abs(car.x) > CITY.bounds + 10 || Math.abs(car.z) > CITY.bounds + 10 || car.z > CITY.seaZ) {
          respawn(entry);
          continue;
        }
        car.syncMesh();
      }
    },
  };
}

/** Parked cars the player can steal, placed along roads. */
export function createParkedCars(scene, world, random, count = 8) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < 200) {
    tries += 1;
    const line = pick(random, ROAD_LINES);
    const along = (random() - 0.5) * (CITY.bounds * 2 - 60);
    const side = random() < 0.5 ? -1 : 1;
    const x = line + side * 5.2;
    const z = along;
    if (world.hitsBuilding(x, z, 3)) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.z - z) < 12)) continue;
    const heading = side > 0 ? 0 : Math.PI;
    const car = makeCar(scene, x, z, heading, pick(random, CAR_COLORS));
    car.parked = true;
    cars.push(car);
  }
  return cars;
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

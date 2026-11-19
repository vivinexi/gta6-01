// The wanted system: stars, police pursuit, ramming, busts and heat decay.
// Police cars spawn on the streets around Maya, chase her position, and ram.
// On foot, a police car parked on top of her for long enough busts her.
import { createCar, removeCar, stepCar, steerToward } from './vehicles.js';
import { POLICE, STREETS, WANTED } from './config.js';
import { createRandom } from './random.js';

/** The nearest street intersection to a point (streets form a 7x7 grid). */
function nearestIntersection(x, z) {
  let bx = STREETS[0];
  let bz = STREETS[0];
  for (const s of STREETS) {
    if (Math.abs(x - s) < Math.abs(x - bx)) bx = s;
    if (Math.abs(z - s) < Math.abs(z - bz)) bz = s;
  }
  return { x: bx, z: bz };
}

/**
 * A street route between two intersections: breadth-first search over the
 * grid, so a police car drives around the blocks instead of through them.
 * Returns the intersections to drive through, in order (excluding the start).
 */
function streetRoute(from, to) {
  const ix = (v) => STREETS.indexOf(v);
  const start = [ix(from.x), ix(from.z)];
  const goal = [ix(to.x), ix(to.z)];
  const prev = new Map();
  const key = (x, z) => `${x},${z}`;
  const queue = [start];
  prev.set(key(start[0], start[1]), null);
  while (queue.length > 0) {
    const [cx, cz] = queue.shift();
    if (cx === goal[0] && cz === goal[1]) break;
    for (const [nx, nz] of [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]]) {
      if (nx < 0 || nz < 0 || nx >= STREETS.length || nz >= STREETS.length) continue;
      if (prev.has(key(nx, nz))) continue;
      prev.set(key(nx, nz), [cx, cz]);
      queue.push([nx, nz]);
    }
  }
  const path = [];
  let cur = goal;
  while (cur) {
    path.unshift({ x: STREETS[cur[0]], z: STREETS[cur[1]] });
    cur = prev.get(key(cur[0], cur[1]));
  }
  path.shift(); // The start intersection is where the car already is.
  return path;
}

export function createPolice(scene, seed) {
  const random = createRandom(seed ^ 0xba11);
  return {
    scene,
    random,
    cars: [],
    /** Seconds since any police car last saw Maya. */
    unseenTime: 0,
    decayTimer: 0,
    bustTimer: 0,
  };
}

/** Keep the fielded police cars equal to the wanted level. */
export function syncPolice(police, wanted, px, pz, resolveCircle) {
  const want = WANTED.carsForStars[Math.min(WANTED.max, wanted)] || 0;
  while (police.cars.length < want) {
    const angle = police.random() * Math.PI * 2;
    const dist = 70 + police.random() * 40;
    const spot = police.scene.userData.world
      ? police.scene.userData.world.snapToStreet(px + Math.sin(angle) * dist, pz + Math.cos(angle) * dist)
      : { x: px + Math.sin(angle) * dist, z: pz + Math.cos(angle) * dist };
    const car = createCar(police.scene, {
      x: spot.x,
      z: spot.z,
      heading: Math.atan2(px - spot.x, pz - spot.z),
      kind: 'police',
      isPolice: true,
    });
    police.cars.push(car);
  }
  while (police.cars.length > want) {
    const car = police.cars.pop();
    removeCar(police.scene, car);
  }
}

/**
 * One police step. Returns events: { busted, damage } — damage is health lost
 * this step from rams, busted is true when Maya is caught on foot.
 */
export function stepPolice(police, dt, wanted, player, playerCar, resolveCircle, otherCars) {
  const events = { busted: false, damage: 0 };
  if (wanted <= 0) {
    police.bustTimer = 0;
    return events;
  }
  const px = playerCar ? playerCar.x : player.x;
  const pz = playerCar ? playerCar.z : player.z;
  let anyNear = false;
  const all = [...police.cars, ...(otherCars || [])];
  for (const car of police.cars) {
    if (car.removed) continue;
    const dist = Math.hypot(px - car.x, pz - car.z);
    if (dist < 90) anyNear = true;
    // A ram lands, then the police car falls back for a couple of seconds
    // instead of grinding against the player's car every frame.
    car.ramCd = Math.max(0, (car.ramCd || 0) - dt);
    // Navigation: close in, drive straight at Maya; far away, follow the
    // street grid (BFS over the intersections) instead of through buildings.
    // The route is replanned every few seconds as Maya moves.
    car._routeT = (car._routeT || 0) + dt;
    let tx = px;
    let tz = pz;
    if (dist > 30) {
      if (!car._route || car._routeI >= car._route.length || car._routeT > 4) {
        car._routeT = 0;
        car._route = streetRoute(nearestIntersection(car.x, car.z), nearestIntersection(px, pz));
        car._routeI = 0;
      }
      const wp = car._route[car._routeI];
      if (wp) {
        if (Math.hypot(wp.x - car.x, wp.z - car.z) < 8) car._routeI += 1;
        else {
          tx = wp.x;
          tz = wp.z;
        }
      }
    } else {
      car._route = null;
    }
    const steer = steerToward(car, tx, tz);
    // On foot and right on top of Maya: brake to a stop on her instead of
    // circling — that is what a bust is.
    const throttle = !playerCar && dist < 5 ? -1 : car.ramCd > 0 ? 0.25 : dist > 10 ? 1 : 0.4;
    stepCar(car, { throttle, steer }, dt, resolveCircle, all);
    // Ramming: touching the player's car damages it; touching Maya hurts her.
    if (playerCar) {
      if (dist < 3.6 && car.ramCd <= 0) {
        // Instant damage (the caller applies it as-is, once per ram).
        events.damage += POLICE.ramDamage * 1.5;
        playerCar.speed *= 0.9;
        car.crash = true;
        car.ramCd = 2.5;
      }
    } else if (dist < 2.6) {
      police.bustTimer += dt;
      if (police.bustTimer >= POLICE.bustTime) {
        events.busted = true;
        police.bustTimer = 0;
      }
    }
  }
  if (!playerCar && !anyNear) police.bustTimer = Math.max(0, police.bustTimer - dt);
  police.unseenTime = anyNear ? 0 : police.unseenTime + dt;
  return events;
}

/** Heat decay: stars fade one at a time after a long stretch unseen. */
export function decayWanted(police, dt, wanted) {
  if (wanted <= 0) return 0;
  if (police.unseenTime > WANTED.decayAfter) {
    police.decayTimer += dt;
    if (police.decayTimer >= WANTED.decayEvery) {
      police.decayTimer = 0;
      return wanted - 1;
    }
  } else {
    police.decayTimer = 0;
  }
  return wanted;
}

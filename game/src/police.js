// The wanted system: crimes add stars, police cars spawn and chase, stars
// decay when the player stays out of sight, and getting caught means BUSTED.
import { CITY, POLICE, WANTED } from './config.js';
import { makeCar } from './vehicles.js';
import { angleDelta, clamp } from './random.js';
import { ROAD_LINES } from './world.js';

export function createWanted(scene, world, random) {
  const policeCars = [];
  let stars = 0;
  let lastCrimeAt = -999;
  let decayTimer = 0;
  let bustedTimer = 0;
  let sirenOn = false;

  function spawnPolice(x, z) {
    // Spawn on a nearby road, a little away from the player.
    const line = ROAD_LINES.reduce((best, l) => (Math.abs(l - x) < Math.abs(best - x) ? l : best), ROAD_LINES[0]);
    const px = line + (random() < 0.5 ? -3.2 : 3.2);
    const pz = z + (random() < 0.5 ? -1 : 1) * (40 + random() * 30);
    const car = makeCar(scene, px, clamp(pz, -CITY.bounds, CITY.bounds), 0, 0x1a1d22, true);
    car.parked = false;
    car.speed = 10;
    policeCars.push({ car, stuckTimer: 0, ramCooldown: 0, lastX: px, lastZ: pz });
  }

  function removePolice(index) {
    const entry = policeCars[index];
    entry.car.mesh.visible = false;
    scene.remove(entry.car.mesh);
    policeCars.splice(index, 1);
  }

  return {
    get stars() {
      return stars;
    },
    get sirenOn() {
      return sirenOn;
    },
    get busted() {
      return bustedTimer >= WANTED.bustedHold;
    },
    policeCars,
    addCrime(n, time) {
      stars = Math.min(WANTED.maxStars, stars + n);
      lastCrimeAt = time;
      decayTimer = 0;
    },
    setStars(n, time) {
      stars = clamp(n, 0, WANTED.maxStars);
      lastCrimeAt = time;
      decayTimer = 0;
    },
    reset() {
      stars = 0;
      lastCrimeAt = -999;
      bustedTimer = 0;
      while (policeCars.length) removePolice(0);
    },
    update(dt, time, player, playerCar, world, audio, onBusted) {
      const target = playerCar || player;
      const tx = target.x;
      const tz = target.z;
      // Spawn police to match the star level (one car per star, up to 5).
      sirenOn = stars > 0;
      while (policeCars.length < stars) spawnPolice(tx, tz);
      while (policeCars.length > stars) removePolice(policeCars.length - 1);
      // Wanted decays when hidden: no crime for a while and no police near.
      if (stars > 0) {
        const nearest = policeCars.reduce((m, e) => Math.min(m, Math.hypot(e.car.x - tx, e.car.z - tz)), Infinity);
        if (time - lastCrimeAt > WANTED.decayDelay && nearest > WANTED.hideDistance) {
          decayTimer += dt;
          if (decayTimer >= WANTED.decayInterval) {
            stars -= 1;
            decayTimer = 0;
          }
        } else {
          decayTimer = 0;
        }
      }
      // Each police car chases the player and rams.
      for (let i = policeCars.length - 1; i >= 0; i -= 1) {
        const entry = policeCars[i];
        const { car } = entry;
        const dx = tx - car.x;
        const dz = tz - car.z;
        const dist = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        car.heading += clamp(angleDelta(car.heading, wantHeading), -2.4 * dt, 2.4 * dt);
        car.speed = Math.min(POLICE.maxSpeed, car.speed + POLICE.accel * dt);
        const nx = car.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.z + Math.cos(car.heading) * car.speed * dt;
        if (world.hitsBuilding(nx, nz, 1.4)) {
          // Stuck on a building: back up and turn around.
          car.speed = -6;
          car.heading += 1.8 * dt;
          car.x += Math.sin(car.heading) * car.speed * dt;
          car.z += Math.cos(car.heading) * car.speed * dt;
        } else {
          car.x = nx;
          car.z = nz;
        }
        car.x = clamp(car.x, -CITY.bounds, CITY.bounds);
        car.z = clamp(car.z, -CITY.bounds, CITY.seaZ - 4);
        car.syncMesh();
        // Light bar flash.
        const on = Math.floor(time * 6) % 2 === 0;
        if (car.mesh.userData.lightL) car.mesh.userData.lightL.material.emissiveIntensity = on ? 3 : 0.2;
        if (car.mesh.userData.lightR) car.mesh.userData.lightR.material.emissiveIntensity = on ? 0.2 : 3;
        // Ram the player's car, or catch the player on foot.
        entry.ramCooldown -= dt;
        if (dist < 4.2 && entry.ramCooldown <= 0) {
          entry.ramCooldown = POLICE.ramCooldown;
          if (playerCar) {
            playerCar.health = Math.max(0, playerCar.health - POLICE.ramDamage);
            playerCar.speed *= 0.4;
            world.sparks(playerCar.x, 1, playerCar.z, 8);
            audio.crash(0.6);
            if (playerCar.health <= 0) {
              // Car wrecked: the player is thrown out on foot.
              playerCar.isPlayer = false;
              player.x = playerCar.x + 3;
              player.z = playerCar.z + 3;
              player.mesh.visible = true;
              player.reset(player.x, player.z, player.heading);
              player.health = Math.max(20, player.health - 20);
            }
          } else if (playerCar === null) {
            bustedTimer += POLICE.ramCooldown;
          }
        }
        // On foot, a police car touching the player counts toward BUSTED.
        if (!playerCar && dist < 3.2) {
          bustedTimer += dt;
          if (bustedTimer >= WANTED.bustedHold) {
            audio.busted();
            onBusted();
            return;
          }
        } else if (!playerCar) {
          bustedTimer = Math.max(0, bustedTimer - dt * 0.5);
        }
        // A police car that barely moves for a while is stuck: respawn it near the player.
        if (Math.hypot(car.x - entry.lastX, car.z - entry.lastZ) < 0.5) {
          entry.stuckTimer += dt;
          if (entry.stuckTimer > 4) {
            removePolice(i);
            spawnPolice(tx, tz);
          }
        } else {
          entry.stuckTimer = 0;
        }
        entry.lastX = car.x;
        entry.lastZ = car.z;
      }
    },
  };
}

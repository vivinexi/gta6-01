// Pedestrians: locals strolling the sidewalks. They walk a road line, turn
// at intersections, and flee when a crime happens, a gun goes off, or a car
// bears down on them. Hit one with a car and the wanted level goes up.
import { CITY, PEDESTRIANS } from './config.js';
import { makeHumanoid } from './player.js';
import { ROAD_LINES } from './world.js';
import { clamp, pick } from './random.js';

const SHIRTS = [0xe07b39, 0x2fae6e, 0xd8d8d8, 0xf2c94c, 0x7a4fd0, 0xe88aa0];
const PANTS = [0x22252a, 0x4a3a2a, 0x2a3a4a, 0x5a5a5a];

export function createPedestrians(scene, world, random) {
  const peds = [];
  for (let i = 0; i < PEDESTRIANS.count; i += 1) {
    const mesh = makeHumanoid(pick(random, SHIRTS), pick(random, PANTS));
    scene.add(mesh);
    const line = pick(random, ROAD_LINES);
    const along = (random() - 0.5) * (CITY.bounds * 2 - 40);
    const side = random() < 0.5 ? -1 : 1;
    const axis = random() < 0.5 ? 'x' : 'z';
    const x = axis === 'x' ? along : line + side * 9.5;
    const z = axis === 'x' ? line + side * 9.5 : along;
    const heading = axis === 'x' ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : random() < 0.5 ? 0 : Math.PI;
    peds.push({
      mesh, x, z, heading,
      axis, line, side,
      speed: PEDESTRIANS.walkSpeed * (0.8 + random() * 0.5),
      state: 'walk',
      downTimer: 0,
      fleeTimer: 0,
      walkPhase: random() * 6,
      respawnTimer: 0,
    });
  }

  function placeAtEdge(ped) {
    ped.line = pick(random, ROAD_LINES);
    ped.axis = random() < 0.5 ? 'x' : 'z';
    ped.side = random() < 0.5 ? -1 : 1;
    const along = (random() < 0.5 ? -1 : 1) * (CITY.bounds - 20);
    ped.x = ped.axis === 'x' ? along : ped.line + ped.side * 9.5;
    ped.z = ped.axis === 'x' ? ped.line + ped.side * 9.5 : along;
    ped.heading = ped.axis === 'x' ? Math.PI / 2 : 0;
    ped.state = 'walk';
    ped.downTimer = 0;
    ped.mesh.visible = true;
    ped.mesh.rotation.set(0, ped.heading, 0);
  }

  return {
    peds,
    /** A gunshot or a crime nearby: everyone in range runs. */
    scare(x, z, radius) {
      for (const ped of peds) {
        if (ped.state !== 'walk') continue;
        if (Math.hypot(ped.x - x, ped.z - z) < radius) {
          ped.state = 'flee';
          ped.fleeTimer = 3 + Math.random() * 2;
        }
      }
    },
    update(dt, threat, playerCar) {
      for (const ped of peds) {
        if (ped.state === 'down') {
          ped.downTimer -= dt;
          if (ped.downTimer <= 0) placeAtEdge(ped);
          continue;
        }
        // Flee from a fast car or a fresh threat.
        let fx = 0;
        let fz = 0;
        if (threat) {
          const dx = ped.x - threat.x;
          const dz = ped.z - threat.z;
          const d = Math.hypot(dx, dz);
          if (d < threat.radius && d > 0.01) {
            fx = dx / d;
            fz = dz / d;
            ped.state = 'flee';
            ped.fleeTimer = 2;
          }
        }
        if (playerCar && Math.abs(playerCar.speed) > 6) {
          const dx = ped.x - playerCar.x;
          const dz = ped.z - playerCar.z;
          const d = Math.hypot(dx, dz);
          if (d < 10 && d > 0.01) {
            fx = dx / d;
            fz = dz / d;
            ped.state = 'flee';
            ped.fleeTimer = 2;
          }
        }
        if (ped.state === 'flee') {
          ped.fleeTimer -= dt;
          if (ped.fleeTimer <= 0) ped.state = 'walk';
          ped.x += fx * PEDESTRIANS.runSpeed * dt;
          ped.z += fz * PEDESTRIANS.runSpeed * dt;
          ped.heading = Math.atan2(fx, fz);
        } else {
          // Stroll along the sidewalk; turn at an intersection sometimes.
          const along = ped.axis === 'x' ? ped.x : ped.z;
          const nearLine = ROAD_LINES.find((l) => Math.abs(along - l) < 3);
          if (nearLine !== undefined && Math.random() < dt * 0.15) {
            ped.axis = ped.axis === 'x' ? 'z' : 'x';
            ped.heading = ped.axis === 'x' ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : Math.random() < 0.5 ? 0 : Math.PI;
          }
          ped.x += Math.sin(ped.heading) * ped.speed * dt;
          ped.z += Math.cos(ped.heading) * ped.speed * dt;
        }
        ped.x = clamp(ped.x, -CITY.bounds, CITY.bounds);
        ped.z = clamp(ped.z, -CITY.bounds, CITY.seaZ - 4);
        const fixed = world.resolveCircle(ped.x, ped.z, 0.55);
        ped.x = fixed.x;
        ped.z = fixed.z;
        ped.walkPhase += dt * (ped.state === 'flee' ? 14 : 5);
        const swing = Math.sin(ped.walkPhase) * 0.55;
        ped.mesh.userData.legL.rotation.x = swing;
        ped.mesh.userData.legR.rotation.x = -swing;
        ped.mesh.userData.armL.rotation.x = -swing * 0.8;
        ped.mesh.userData.armR.rotation.x = swing * 0.8;
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.heading;
      }
    },
    /** Hit by the player's car: knock down, wanted goes up, respawn later. */
    hitByCar(car) {
      let hit = false;
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.4) {
          ped.state = 'down';
          ped.downTimer = 6;
          ped.mesh.rotation.x = -Math.PI / 2;
          ped.mesh.position.y = 0.4;
          hit = true;
        }
      }
      return hit;
    },
  };
}

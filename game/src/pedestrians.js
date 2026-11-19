// Port Vela on foot: pedestrians strolling the sidewalks, turning at
// intersections, and running away from gunfire, speeding cars and police chases.
import * as THREE from '../vendor/three.module.js';
import { CITY_HALF, PALETTE, PLAYER, STREETS } from './config.js';
import { createRandom } from './random.js';

function makePedMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3242 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.66, 0.3), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skin);
  head.position.y = 1.58;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), pants);
  legL.position.set(-0.14, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), pants);
  legR.position.set(0.14, 0.33, 0);
  group.add(legR);
  return { group, legL, legR };
}

export function createPedestrians(scene, seed, count = 16) {
  const random = createRandom(seed ^ 0x9e2d);
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const onVertical = random() < 0.5;
    const street = STREETS[Math.floor(random() * STREETS.length)];
    const along = (random() * 2 - 1) * (CITY_HALF - 20);
    const side = (random() < 0.5 ? -1 : 1) * 9.5;
    const x = onVertical ? street + side : along;
    const z = onVertical ? along : street + side;
    const mesh = makePedMesh(PALETTE.ped[Math.floor(random() * PALETTE.ped.length)]);
    mesh.group.position.set(x, 0, z);
    scene.add(mesh.group);
    peds.push({
      mesh,
      x,
      z,
      heading: random() * Math.PI * 2,
      speed: 1.1 + random() * 0.9,
      fleeing: 0,
      walkPhase: random() * 6,
      turnAt: 2 + random() * 6,
    });
  }
  return peds;
}

/** A ped flees from `threats`: [{x, z, radius}]. Returns how many are fleeing. */
export function stepPedestrians(peds, dt, threats, resolveCircle) {
  let fleeing = 0;
  for (const ped of peds) {
    let fleeX = 0;
    let fleeZ = 0;
    for (const threat of threats) {
      const dx = ped.x - threat.x;
      const dz = ped.z - threat.z;
      const d = Math.hypot(dx, dz);
      if (d < threat.radius && d > 0.01) {
        fleeX += (dx / d) * (threat.radius - d);
        fleeZ += (dz / d) * (threat.radius - d);
      }
    }
    if (fleeX !== 0 || fleeZ !== 0) {
      ped.fleeing = 1.5;
      ped.heading = Math.atan2(fleeX, fleeZ);
    } else if (ped.fleeing > 0) {
      ped.fleeing -= dt;
    } else {
      ped.turnAt -= dt;
      if (ped.turnAt <= 0) {
        ped.turnAt = 3 + Math.random() * 7;
        // Turn at an intersection: pick a street direction.
        ped.heading = (Math.floor(Math.random() * 4) * Math.PI) / 2;
      }
    }
    const speed = ped.fleeing > 0 ? 5.2 : ped.speed;
    if (ped.fleeing > 0) fleeing += 1;
    ped.x += Math.sin(ped.heading) * speed * dt;
    ped.z += Math.cos(ped.heading) * speed * dt;
    // Peds stay on the pavements: clamp them inside the city and out of buildings.
    const probe = { x: ped.x, z: ped.z };
    resolveCircle(probe, PLAYER.radius);
    ped.x = Math.max(-CITY_HALF, Math.min(CITY_HALF, probe.x));
    ped.z = Math.max(-CITY_HALF, Math.min(CITY_HALF, probe.z));
    ped.walkPhase += dt * speed * 2.4;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.mesh.legL.rotation.x = swing;
    ped.mesh.legR.rotation.x = -swing;
    ped.mesh.group.position.set(ped.x, 0, ped.z);
    ped.mesh.group.rotation.y = ped.heading;
  }
  return fleeing;
}

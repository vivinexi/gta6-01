// Combat: Maya's pistol (hitscan, camera-aimed) and punch, and the Breakers —
// armed rivals with health bars who shoot back when Maya is close enough.
// Rivals are simple figures with a floating health bar made of two thin boxes.
import * as THREE from '../vendor/three.module.js';
import { COMBAT, PALETTE } from './config.js';
import { createRandom } from './random.js';

function makeRivalMesh() {
  const group = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: PALETTE.rival });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a5a3a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), dark);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.68;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
  cap.position.y = 1.88;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), dark);
  legL.position.set(-0.17, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), dark);
  legR.position.set(0.17, 0.36, 0);
  group.add(legR);
  // Health bar: a dark backing and a green-to-red fill that shrinks with damage.
  const barBack = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.12, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x111111 }),
  );
  barBack.position.y = 2.15;
  group.add(barBack);
  const barFill = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 0.08, 0.03),
    new THREE.MeshBasicMaterial({ color: 0x37c24a }),
  );
  barFill.position.y = 2.15;
  group.add(barFill);
  return { group, barFill };
}

export function createCombat(scene, seed) {
  const random = createRandom(seed ^ 0x2eaf);
  return {
    scene,
    random,
    rivals: [],
    pistolCooldown: 0,
    punchCooldown: 0,
  };
}

export function spawnRivals(combat, count, x, z) {
  for (let i = 0; i < count; i += 1) {
    const mesh = makeRivalMesh();
    const rx = x + (combat.random() - 0.5) * 14;
    const rz = z + (combat.random() - 0.5) * 14;
    mesh.group.position.set(rx, 0, rz);
    combat.scene.add(mesh.group);
    combat.rivals.push({
      mesh,
      x: rx,
      z: rz,
      heading: combat.random() * Math.PI * 2,
      health: COMBAT.rivalHealth,
      shootCooldown: 1 + combat.random(),
      walkPhase: combat.random() * 6,
    });
  }
}

/** The nearest rival within `range` of a point, or null. */
export function nearestRival(combat, x, z, range) {
  let best = null;
  let bestD = range;
  for (const rival of combat.rivals) {
    const d = Math.hypot(rival.x - x, rival.z - z);
    if (d < bestD) {
      bestD = d;
      best = rival;
    }
  }
  return best;
}

/**
 * Fire the pistol from the camera through the crosshair. Hits the first rival
 * within range and a narrow cone of the aim ray; returns the rival hit or null.
 */
export function shoot(combat, origin, dir) {
  if (combat.pistolCooldown > 0) return null;
  combat.pistolCooldown = COMBAT.pistolCooldown;
  let best = null;
  let bestT = COMBAT.pistolRange;
  for (const rival of combat.rivals) {
    const rx = rival.x - origin.x;
    const rz = rival.z - origin.z;
    const t = rx * dir.x + rz * dir.z;
    if (t < 0 || t > COMBAT.pistolRange) continue;
    const perp = Math.abs(rx * dir.z - rz * dir.x);
    if (perp < 1.6 && t < bestT) {
      bestT = t;
      best = rival;
    }
  }
  if (best) {
    best.health -= COMBAT.pistolDamage;
    updateRivalBar(best);
  }
  return best;
}

/** Punch the nearest rival in front of Maya; returns the rival hit or null. */
export function punch(combat, px, pz, heading) {
  if (combat.punchCooldown > 0) return null;
  combat.punchCooldown = COMBAT.punchCooldown;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  let best = null;
  let bestD = COMBAT.punchRange;
  for (const rival of combat.rivals) {
    const dx = rival.x - px;
    const dz = rival.z - pz;
    const d = Math.hypot(dx, dz);
    const facing = (dx * fx + dz * fz) / (d || 1);
    if (d < bestD && facing > 0.3) {
      bestD = d;
      best = rival;
    }
  }
  if (best) {
    best.health -= COMBAT.punchDamage;
    updateRivalBar(best);
  }
  return best;
}

function updateRivalBar(rival) {
  const ratio = Math.max(0, rival.health / COMBAT.rivalHealth);
  rival.mesh.barFill.scale.x = ratio;
  rival.mesh.barFill.position.x = -(1 - ratio) * 0.52;
  rival.mesh.barFill.material.color.setHex(ratio > 0.5 ? 0x37c24a : ratio > 0.25 ? 0xe8a832 : 0xe83232);
}

function removeRival(combat, rival) {
  combat.scene.remove(rival.mesh.group);
  combat.rivals.splice(combat.rivals.indexOf(rival), 1);
}

/**
 * One combat step: cooldowns tick, rivals advance on Maya and shoot when close.
 * Returns { damage } — health Maya lost to rival fire this step — and raises
 * wanted by one when a rival dies (a body in the street draws the police).
 */
export function stepCombat(combat, dt, player, resolveCircle) {
  combat.pistolCooldown = Math.max(0, combat.pistolCooldown - dt);
  combat.punchCooldown = Math.max(0, combat.punchCooldown - dt);
  let damage = 0;
  let killed = 0;
  for (const rival of [...combat.rivals]) {
    const dx = player.x - rival.x;
    const dz = player.z - rival.z;
    const dist = Math.hypot(dx, dz);
    rival.heading = Math.atan2(dx, dz);
    if (dist > 14) {
      rival.x += Math.sin(rival.heading) * 3.4 * dt;
      rival.z += Math.cos(rival.heading) * 3.4 * dt;
      const probe = { x: rival.x, z: rival.z };
      resolveCircle(probe, 0.6);
      rival.x = probe.x;
      rival.z = probe.z;
    }
    rival.shootCooldown -= dt;
    if (dist < COMBAT.rivalRange && rival.shootCooldown <= 0) {
      rival.shootCooldown = COMBAT.rivalShotCooldown;
      // Rivals miss more at range; a hit still stings.
      if (Math.random() < 0.55) damage += COMBAT.rivalShotDamage;
    }
    rival.walkPhase += dt * 6;
    rival.mesh.group.position.set(rival.x, 0, rival.z);
    rival.mesh.group.rotation.y = rival.heading;
    if (rival.health <= 0) {
      removeRival(combat, rival);
      killed += 1;
    }
  }
  return { damage, killed };
}

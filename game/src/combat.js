// Combat: the pistol (hitscan from the camera, tracer + impact), the punch,
// and the Vultures — rival crew members with health bars who shoot back.
import * as THREE from '../vendor/three.module.js';
import { makeHumanoid } from './player.js';
import { PALETTE } from './config.js';

const ENEMY_HEALTH = 50;
const ENEMY_SHOT_DAMAGE = 8;
const ENEMY_SHOT_INTERVAL = 1.4;
const ENEMY_RANGE = 46;
const PISTOL_DAMAGE = 34;
const PISTOL_COOLDOWN = 0.28;
const PUNCH_DAMAGE = 25;
const PUNCH_RANGE = 2.4;

function makeHealthBar() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 10;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(2.2, 0.35, 1);
  sprite.position.y = 2.5;
  return { sprite, canvas, tex };
}

function drawHealthBar(bar, frac) {
  const ctx = bar.canvas.getContext('2d');
  ctx.fillStyle = '#401010';
  ctx.fillRect(0, 0, 64, 10);
  ctx.fillStyle = frac > 0.5 ? '#3fce62' : frac > 0.25 ? '#f2c94c' : '#e5534b';
  ctx.fillRect(1, 1, Math.max(0, 62 * frac), 8);
  bar.tex.needsUpdate = true;
}

export function createCombat(scene) {
  const enemies = [];
  const raycaster = new THREE.Raycaster();
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
  let pistolCooldown = 0;
  let punchCooldown = 0;

  function spawnEnemy(x, z, name) {
    const mesh = makeHumanoid(PALETTE.enemy, 0x22252a);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const bar = makeHealthBar();
    mesh.add(bar.sprite);
    drawHealthBar(bar, 1);
    const enemy = { mesh, bar, x, z, heading: 0, health: ENEMY_HEALTH, shootTimer: 1 + Math.random(), name, dead: false };
    enemies.push(enemy);
    return enemy;
  }

  function removeEnemy(enemy) {
    scene.remove(enemy.mesh);
    const i = enemies.indexOf(enemy);
    if (i >= 0) enemies.splice(i, 1);
  }

  return {
    enemies,
    spawnEnemy,
    removeEnemy,
    clearEnemies() {
      while (enemies.length) removeEnemy(enemies[0]);
    },
    /** Pistol shot from the camera through the crosshair. Returns what it hit. */
    shoot(camera, world, audio, playerPos) {
      if (pistolCooldown > 0) return { fired: false, hit: null };
      pistolCooldown = PISTOL_COOLDOWN;
      audio.gunshot();
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      raycaster.far = 120;
      const targets = [];
      for (const e of enemies) if (!e.dead) targets.push(e.mesh);
      const hits = raycaster.intersectObjects(targets, true);
      let end = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 90);
      let hitEnemy = null;
      if (hits.length) {
        const hit = hits[0];
        end = hit.point.clone();
        // Walk up to the enemy root (the mesh group carrying the health bar).
        let obj = hit.object;
        while (obj.parent && obj.parent !== scene) obj = obj.parent;
        hitEnemy = enemies.find((e) => e.mesh === obj) || null;
        if (hitEnemy) {
          hitEnemy.health -= PISTOL_DAMAGE;
          drawHealthBar(hitEnemy.bar, Math.max(0, hitEnemy.health / ENEMY_HEALTH));
          world.sparks(end.x, end.y, end.z, 6);
          if (hitEnemy.health <= 0) {
            hitEnemy.dead = true;
            hitEnemy.mesh.rotation.x = -Math.PI / 2;
            hitEnemy.mesh.position.y = 0.4;
            removeEnemy(hitEnemy);
          }
        }
      } else {
        world.dust(end.x, Math.max(0.3, end.y), end.z, 3);
      }
      // Tracer: a fading line from the muzzle to the hit point.
      const muzzle = playerPos.clone();
      muzzle.y += 1.4;
      const geo = new THREE.BufferGeometry().setFromPoints([muzzle, end]);
      const line = new THREE.Line(geo, tracerMat.clone());
      scene.add(line);
      window.setTimeout(() => {
        scene.remove(line);
        geo.dispose();
        line.material.dispose();
      }, 70);
      return { fired: true, hit: hitEnemy };
    },
    /** Punch: hits the nearest enemy in front, at arm's length. */
    punch(player, audio, world) {
      if (punchCooldown > 0) return null;
      punchCooldown = 0.45;
      audio.punch();
      const fx = Math.sin(player.heading);
      const fz = Math.cos(player.heading);
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - player.x;
        const dz = e.z - player.z;
        const d = Math.hypot(dx, dz);
        if (d < PUNCH_RANGE && dx * fx + dz * fz > 0) {
          e.health -= PUNCH_DAMAGE;
          drawHealthBar(e.bar, Math.max(0, e.health / ENEMY_HEALTH));
          world.sparks(e.x, 1.2, e.z, 6);
          if (e.health <= 0) {
            e.dead = true;
            e.mesh.rotation.x = -Math.PI / 2;
            e.mesh.position.y = 0.4;
            removeEnemy(e);
          }
          return e;
        }
      }
      return null;
    },
    update(dt, player, playerCar, world, audio) {
      pistolCooldown = Math.max(0, pistolCooldown - dt);
      punchCooldown = Math.max(0, punchCooldown - dt);
      const px = playerCar ? playerCar.x : player.x;
      const pz = playerCar ? playerCar.z : player.z;
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = px - e.x;
        const dz = pz - e.z;
        const dist = Math.hypot(dx, dz);
        // Close in to shooting range, then stand and fire.
        if (dist > 16) {
          const sp = 3.4;
          e.x += (dx / dist) * sp * dt;
          e.z += (dz / dist) * sp * dt;
          e.heading = Math.atan2(dx, dz);
          e.mesh.rotation.y = e.heading;
          e.mesh.position.set(e.x, 0, e.z);
          const swing = Math.sin(performance.now() / 120) * 0.5;
          e.mesh.userData.legL.rotation.x = swing;
          e.mesh.userData.legR.rotation.x = -swing;
        } else {
          e.heading = Math.atan2(dx, dz);
          e.mesh.rotation.y = e.heading;
          e.shootTimer -= dt;
          if (e.shootTimer <= 0 && dist < ENEMY_RANGE) {
            e.shootTimer = ENEMY_SHOT_INTERVAL;
            audio.gunshot();
            // Tracer from the enemy toward the player; a hit hurts.
            const from = new THREE.Vector3(e.x, 1.4, e.z);
            const to = new THREE.Vector3(px, 1.2, pz);
            const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
            const line = new THREE.Line(geo, tracerMat.clone());
            scene.add(line);
            window.setTimeout(() => {
              scene.remove(line);
              geo.dispose();
              line.material.dispose();
            }, 90);
            if (Math.random() < 0.55) {
              if (playerCar) {
                playerCar.health = Math.max(0, playerCar.health - ENEMY_SHOT_DAMAGE);
              } else {
                player.health = Math.max(0, player.health - ENEMY_SHOT_DAMAGE);
              }
              world.sparks(px, 1.2, pz, 4);
            }
          }
        }
      }
    },
  };
}

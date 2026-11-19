// Maya on foot: a simple articulated figure (no model file) that walks, runs,
// jumps and aims where the camera looks. Movement is relative to the camera yaw,
// so W always runs away from the camera.
import * as THREE from '../vendor/three.module.js';
import { PALETTE, PLAYER } from './config.js';

export function makePlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: PALETTE.player });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3242 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  // Hair: a dark cap on the back of the head.
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.38), new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
  hair.position.set(0, 1.82, -0.03);
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legL.position.set(-0.17, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legR.position.set(0.17, 0.36, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), jacket);
  armL.position.set(-0.42, 1.12, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), jacket);
  armR.position.set(0.42, 1.12, 0);
  group.add(armR);
  // The pistol, held out when Maya is armed.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.42, 1.05, 0.3);
  gun.visible = false;
  group.add(gun);
  return { group, legL, legR, armL, armR, gun };
}

export function createPlayer(scene, x, z) {
  const mesh = makePlayerMesh();
  mesh.group.position.set(x, 0, z);
  scene.add(mesh.group);
  return {
    mesh,
    x,
    z,
    y: 0,
    vy: 0,
    heading: 0,
    grounded: true,
    health: PLAYER.health,
    armed: true,
    walkPhase: 0,
  };
}

/**
 * One on-foot step. `move` is { x: strafe -1..1, y: forward -1..1 } in camera
 * space, `cameraYaw` is where the camera looks, `jump` is a fresh jump press.
 */
export function stepPlayer(player, move, cameraYaw, jump, run, dt, resolveCircle) {
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(move.x, move.y);
  let mx = 0;
  let mz = 0;
  if (len > 0.01) {
    const nx = move.x / len;
    const ny = move.y / len;
    // Camera-relative: forward is away from the camera.
    const fx = -Math.sin(cameraYaw);
    const fz = -Math.cos(cameraYaw);
    const rx = -fz;
    const rz = fx;
    mx = (fx * ny + rx * nx) * speed;
    mz = (fz * ny + rz * nx) * speed;
    player.heading = Math.atan2(mx, mz);
  }
  player.x += mx * dt;
  player.z += mz * dt;
  resolveCircle(player, PLAYER.radius);

  if (jump && player.grounded) {
    player.vy = PLAYER.jumpSpeed;
    player.grounded = false;
  }
  if (!player.grounded) {
    player.vy -= PLAYER.gravity * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
    }
  }

  const moving = len > 0.01;
  player.walkPhase += dt * (moving ? speed * 1.6 : 0);
  const swing = moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  player.mesh.legL.rotation.x = swing;
  player.mesh.legR.rotation.x = -swing;
  player.mesh.armL.rotation.x = -swing * 0.7;
  player.mesh.armR.rotation.x = swing * 0.7;
  player.mesh.group.position.set(player.x, player.y, player.z);
  player.mesh.group.rotation.y = player.heading;
}

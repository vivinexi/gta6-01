// Joey Marlow on foot: a low-poly box humanoid, WASD movement relative to
// the camera, run, jump, and a third-person orbit camera with screen shake.
import * as THREE from '../vendor/three.module.js';
import { CITY, PALETTE, PLAYER } from './config.js';
import { angleDelta, clamp, wrapAngle } from './random.js';

export function makeHumanoid(shirtColor, pantsColor, skinColor = PALETTE.playerSkin) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 1 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.82;
  head.castShadow = true;
  group.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), hair);
  hairTop.position.y = 2.06;
  group.add(hairTop);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), pants);
  legL.position.set(-0.19, 0.38, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), pants);
  legR.position.set(0.19, 0.38, 0);
  legR.castShadow = true;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt);
  armL.position.set(-0.48, 1.15, 0);
  armL.castShadow = true;
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt);
  armR.position.set(0.48, 1.15, 0);
  armR.castShadow = true;
  group.add(armR);
  group.userData = { legL, legR, armL, armR, torso };
  return group;
}

export function createPlayer(scene) {
  const mesh = makeHumanoid(PALETTE.playerShirt, PALETTE.playerPants);
  scene.add(mesh);
  return {
    mesh,
    x: 0,
    z: 0,
    y: 0,
    vy: 0,
    heading: 0,
    onGround: true,
    health: PLAYER.maxHealth,
    walkPhase: 0,
    stepTimer: 0,
    moving: false,
    reset(x, z, heading = 0) {
      this.x = x;
      this.z = z;
      this.y = 0;
      this.vy = 0;
      this.heading = heading;
      this.health = PLAYER.maxHealth;
      this.onGround = true;
      mesh.visible = true;
    },
    update(dt, move, camYaw, world, audio) {
      // Camera-relative movement.
      const fwdX = -Math.sin(camYaw);
      const fwdZ = -Math.cos(camYaw);
      const rightX = Math.cos(camYaw);
      const rightZ = -Math.sin(camYaw);
      let mx = fwdX * move.forward + rightX * move.strafe;
      let mz = fwdZ * move.forward + rightZ * move.strafe;
      const len = Math.hypot(mx, mz);
      this.moving = len > 0.01;
      if (this.moving) {
        mx /= len;
        mz /= len;
        const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
        this.x += mx * speed * dt;
        this.z += mz * speed * dt;
        const target = Math.atan2(mx, mz);
        this.heading += angleDelta(this.heading, target) * Math.min(1, dt * 12);
        this.walkPhase += dt * speed * 1.6;
        this.stepTimer -= dt;
        if (this.stepTimer <= 0 && this.onGround) {
          audio.step();
          this.stepTimer = move.run ? 0.28 : 0.42;
        }
      }
      // Gravity + jump.
      if (this.onGround && move.jump) {
        this.vy = PLAYER.jumpSpeed;
        this.onGround = false;
      }
      if (!this.onGround) {
        this.vy -= PLAYER.gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.onGround = true;
        }
      }
      // Stay in the city + out of buildings.
      this.x = clamp(this.x, -CITY.bounds, CITY.bounds);
      this.z = clamp(this.z, -CITY.bounds, CITY.seaZ - 6);
      const fixed = world.resolveCircle(this.x, this.z, PLAYER.radius);
      this.x = fixed.x;
      this.z = fixed.z;
      // Pose: swing limbs while walking, lean a little while running.
      const swing = this.moving && this.onGround ? Math.sin(this.walkPhase) * 0.6 : 0;
      mesh.userData.legL.rotation.x = swing;
      mesh.userData.legR.rotation.x = -swing;
      mesh.userData.armL.rotation.x = -swing * 0.8;
      mesh.userData.armR.rotation.x = swing * 0.8;
      mesh.position.set(this.x, this.y, this.z);
      mesh.rotation.y = this.heading;
    },
  };
}

/** Third-person orbit camera. `target` is {x, y, z}; shake adds a jolt. */
export function createCamera(camera) {
  return {
    yaw: Math.PI,
    pitch: 0.32,
    dist: 11,
    update(dt, target, orbit, shake) {
      this.yaw -= orbit.dx * 0.005;
      this.pitch = clamp(this.pitch + orbit.dy * 0.003, 0.08, 1.1);
      const cx = target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
      const cz = target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
      const cy = target.y + 1.8 + Math.sin(this.pitch) * this.dist;
      const shX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      const shY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      camera.position.set(cx + shX, cy + shY, cz);
      camera.lookAt(target.x, target.y + 1.6, target.z);
    },
  };
}

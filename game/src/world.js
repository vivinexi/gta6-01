// Solmar City: a procedural sunset grid — buildings with lit windows,
// roads with dashes, sidewalks, streetlights, palms, a beach and the sea.
// Everything is built from boxes and canvas textures, so the whole city is
// a few dozen draw calls and loads offline with no assets.
import * as THREE from '../vendor/three.module.js';
import { CITY, PALETTE } from './config.js';
import { clamp, pick, randInt } from './random.js';

export const ROAD_LINES = [-222, -148, -74, 0, 74, 148, 222];

/** Canvas texture of a building face: lit and dark windows on a wall colour. */
function buildingTexture(random, baseColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${baseColor.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 12;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = random() < 0.35;
      ctx.fillStyle = lit ? '#ffd27a' : '#2c3e50';
      ctx.fillRect(8 + c * 20, 10 + r * 20, 12, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Canvas texture of a road: asphalt with a dashed centre line. */
function roadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f3338';
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = '#f2d13c';
  ctx.fillRect(30, 8, 4, 48);
  ctx.fillRect(30, 72, 4, 48);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Canvas texture of paving: light slabs with darker joints, so the ground reads as city pavement. */
function pavingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#9a9a92';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#84847c';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(34, 34);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Canvas texture of a sunset sky gradient. */
function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2e6fb0');
  grad.addColorStop(0.55, '#e88a5a');
  grad.addColorStop(0.8, '#ffb36b');
  grad.addColorStop(1, '#ffcf8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm() {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: PALETTE.palm, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5.5, 6), trunkMat);
  trunk.position.y = 2.75;
  trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  group.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.2, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 5.6, Math.sin(a) * 1.1);
    leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

export function createWorld(scene, random) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Sky dome, sun and fog.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-260, 190, -620);
  sun.lookAt(0, 0, 0);
  group.add(sun);
  scene.fog = new THREE.Fog(PALETTE.fog, 180, 700);

  // Sun light (warm, low) + soft ambient.
  const sunLight = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sunLight.position.set(-180, 220, -140);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -260;
  sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260;
  sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.far = 900;
  sunLight.shadow.bias = -0.0004;
  group.add(sunLight);
  group.add(new THREE.AmbientLight(0xffb36b, 0.55));
  group.add(new THREE.HemisphereLight(0x8fb8dd, 0x8a6a4a, 0.5));

  // Ground: sidewalk grey for the city, sand at the south edge, sea beyond.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.bounds * 2 + 60, CITY.bounds * 2 + 60),
    new THREE.MeshStandardMaterial({ map: pavingTexture(), roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -20;
  ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.bounds * 2 + 60, 46),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CITY.beachZ + 16);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.bounds * 2 + 300, 300),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.1, CITY.seaZ + 130);
  group.add(sea);

  // Roads: dark strips with dashes along every grid line. The `h` build
  // (rotation.x then rotation.z) renders as a north-south strip, the `v`
  // build as an east-west strip — so each is placed on the line it runs on.
  const roadTex = roadTexture();
  const roadLen = CITY.bounds * 2 + 28;
  for (const line of ROAD_LINES) {
    const hTex = roadTex.clone();
    hTex.needsUpdate = true;
    hTex.repeat.set(roadLen / 14, 1);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, CITY.road), new THREE.MeshStandardMaterial({ map: hTex, roughness: 1 }));
    h.rotation.x = -Math.PI / 2;
    h.rotation.z = Math.PI / 2;
    h.position.set(line, 0.08, 0);
    h.receiveShadow = true;
    group.add(h);
    const vTex = roadTex.clone();
    vTex.needsUpdate = true;
    vTex.repeat.set(roadLen / 14, 1);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, CITY.road), new THREE.MeshStandardMaterial({ map: vTex, roughness: 1 }));
    v.rotation.x = -Math.PI / 2;
    v.position.set(0, 0.08, line);
    v.receiveShadow = true;
    group.add(v);
  }

  // Buildings: 1-3 per block, taller downtown, window textures per colour.
  const textures = PALETTE.building.map((c) => buildingTexture(random, c));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 1 });
  const cells = [-185, -111, -37, 37, 111, 185];
  for (const cx of cells) {
    for (const cz of cells) {
      const dist = Math.hypot(cx, cz);
      const maxH = dist < 80 ? randInt(random, 24, 64) : randInt(random, 8, 30);
      const n = randInt(random, 1, 3);
      for (let i = 0; i < n; i += 1) {
        const w = randInt(random, 14, 26);
        const d = randInt(random, 14, 26);
        const h = Math.max(8, maxH * (0.5 + random() * 0.6));
        const x = cx + (random() - 0.5) * (CITY.block - w - 8);
        const z = cz + (random() - 0.5) * (CITY.block - d - 8);
        const tex = pick(random, textures);
        const sideMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
        const mats = [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat];
        const mesh = new THREE.Mesh(boxGeo, mats);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Streetlights at intersections.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc94d, emissiveIntensity: 1.4 });
  for (const lx of ROAD_LINES) {
    for (const lz of ROAD_LINES) {
      if (random() < 0.45) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 6), poleMat);
      pole.position.set(lx + 8.5, 3.5, lz + 8.5);
      pole.castShadow = true;
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      lamp.position.set(lx + 8.5, 7.1, lz + 8.5);
      group.add(lamp);
    }
  }

  // Palms: a row along the beach and a few on sidewalks.
  for (let x = -CITY.bounds; x <= CITY.bounds; x += 18) {
    if (random() < 0.25) continue;
    const palm = makePalm();
    palm.position.set(x + (random() - 0.5) * 6, 0, CITY.beachZ + 8 + random() * 10);
    palm.rotation.y = random() * Math.PI * 2;
    group.add(palm);
  }
  for (let i = 0; i < 22; i += 1) {
    const palm = makePalm();
    const line = pick(random, ROAD_LINES);
    palm.position.set(line + 9 + random() * 2, 0, (random() - 0.5) * 420);
    palm.rotation.y = random() * Math.PI * 2;
    group.add(palm);
  }

  // Waypoint beacon: a glowing pillar + pulsing ring, moved by missions.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  beacon.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  beacon.visible = false;
  group.add(beacon);

  // Particles: one Points cloud for dust, smoke and sparks.
  const P_COUNT = 240;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P_COUNT * 3);
  const pCol = new Float32Array(P_COUNT * 3);
  for (let i = 0; i < P_COUNT; i += 1) pPos[i * 3 + 1] = -999;
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ size: 0.4, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  points.frustumCulled = false;
  group.add(points);
  const particles = [];
  for (let i = 0; i < P_COUNT; i += 1) particles.push({ life: 0, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0 });
  let pNext = 0;

  function spawnParticle(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = particles[pNext];
    pCol[pNext * 3] = r;
    pCol[pNext * 3 + 1] = g;
    pCol[pNext * 3 + 2] = b;
    pNext = (pNext + 1) % P_COUNT;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = life;
  }

  function burst(x, y, z, n, color, speed, up) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      const s = speed * (0.4 + random() * 0.8);
      spawnParticle(x, y, z, Math.cos(a) * s, up * (0.5 + random()), Math.sin(a) * s, 0.5 + random() * 0.5, color[0], color[1], color[2]);
    }
  }

  return {
    colliders,
    beacon,
    /** Push a circle (player, pedestrian) out of every building it overlaps. */
    resolveCircle(x, z, radius) {
      for (const c of colliders) {
        const nx = clamp(x, c.minX, c.maxX);
        const nz = clamp(z, c.minZ, c.maxZ);
        const dx = x - nx;
        const dz = z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            x = nx + (dx / d) * radius;
            z = nz + (dz / d) * radius;
          } else {
            x = c.maxX + radius;
          }
        }
      }
      return { x, z };
    },
    /** True when a circle overlaps any building. */
    hitsBuilding(x, z, radius) {
      for (const c of colliders) {
        const nx = clamp(x, c.minX, c.maxX);
        const nz = clamp(z, c.minZ, c.maxZ);
        const dx = x - nx;
        const dz = z - nz;
        if (dx * dx + dz * dz < radius * radius) return true;
      }
      return false;
    },
    dust(x, y, z, n = 6) {
      burst(x, y, z, n, [0.75, 0.68, 0.55], 1.6, 0.8);
    },
    smoke(x, y, z, n = 3) {
      burst(x, y, z, n, [0.25, 0.25, 0.25], 0.7, 1.6);
    },
    sparks(x, y, z, n = 10) {
      burst(x, y, z, n, [1.0, 0.8, 0.3], 5, 1.5);
    },
    setBeacon(x, z, visible) {
      beacon.position.set(x, 0, z);
      beacon.visible = visible;
    },
    update(dt, time) {
      // Beacon pulse and slow sea shimmer.
      const s = 1 + Math.sin(time * 3) * 0.18;
      ring.scale.set(s, s, 1);
      pillar.material.opacity = 0.22 + Math.sin(time * 3) * 0.08;
      sea.position.y = 0.1 + Math.sin(time * 0.7) * 0.06;
      for (let i = 0; i < P_COUNT; i += 1) {
        const p = particles[i];
        if (p.life <= 0) {
          pPos[i * 3 + 1] = -999;
          continue;
        }
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 1.5 * dt;
        if (p.y < 0.05) p.y = 0.05;
        pPos[i * 3] = p.x;
        pPos[i * 3 + 1] = p.y;
        pPos[i * 3 + 2] = p.z;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
    },
  };
}

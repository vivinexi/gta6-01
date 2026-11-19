// Port Vela itself: the three.js scene, the procedural sunset city, the docks,
// the beach and the sea, the marina, the lighthouse and Otto's garage.
// Everything is built from boxes, cylinders and canvas textures — no model files,
// no network. The world also owns collision: every building is an axis-aligned
// box the player and cars slide around.
import * as THREE from '../vendor/three.module.js';
import { CITY_HALF, PALETTE, STREETS, STREET_SPACING, ROAD_WIDTH } from './config.js';
import { createRandom } from './random.js';

function makeFacadeTexture(random, base, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // A darker base strip and a roof line so towers read at a distance.
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 236, 128, 20);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, 0, 128, 6);
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const lit = random() < litRatio;
      g.fillStyle = lit ? PALETTE.windowLit : PALETTE.windowDark;
      g.globalAlpha = lit ? 0.95 : 0.85;
      g.fillRect(10 + col * 23, 16 + row * 22, 14, 12);
    }
  }
  g.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSignTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = fg;
  g.font = 'bold 52px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWorld(canvas, seed, options = {}) {
  const random = createRandom(seed);
  const shadows = options.shadows !== false;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 140, 720);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

  // Sunset light: a low warm sun and a cool ambient fill.
  const sun = new THREE.DirectionalLight(0xffc07a, 2.4);
  sun.position.set(-180, 140, -120);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8a7bd8, 0x3a2a22, 0.9));

  // The setting sun itself, low over the sea.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sunDisc.position.set(420, 66, -60);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);

  // Ground: one big slab for the whole island, then the beach and the sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(225, 0.05, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 1400),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(470, 0.02, 0);
  scene.add(sea);

  // Roads: dark strips along every street centreline, with a dashed centre line.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const roadLen = CITY_HALF * 2 + 40;
  for (const s of STREETS) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, ROAD_WIDTH), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(horizontal ? 0 : s, 0.08, horizontal ? s : 0);
      if (!horizontal) road.rotation.z = Math.PI / 2;
      road.receiveShadow = true;
      scene.add(road);
      // Sidewalks flank the road.
      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 3), walkMat);
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(
          horizontal ? 0 : s + side * (ROAD_WIDTH / 2 + 1.5),
          0.09,
          horizontal ? s + side * (ROAD_WIDTH / 2 + 1.5) : 0,
        );
        if (!horizontal) walk.rotation.z = Math.PI / 2;
        scene.add(walk);
      }
      // Dashed centre line.
      for (let d = -CITY_HALF; d < CITY_HALF; d += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.5), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(horizontal ? d : s, 0.1, horizontal ? s : d);
        if (!horizontal) dash.rotation.z = Math.PI / 2;
        scene.add(dash);
      }
    }
  }

  // Downtown plaza: a fountain where the two middle streets cross.
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 24),
    new THREE.MeshLambertMaterial({ color: 0x8a8f98 }),
  );
  fountain.position.set(0, 0.6, 0);
  fountain.castShadow = true;
  scene.add(fountain);
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 0.4, 24),
    new THREE.MeshLambertMaterial({ color: 0x3a9ec2 }),
  );
  fountainWater.position.set(0, 1.2, 0);
  scene.add(fountainWater);

  // Buildings: one to three towers per downtown block, from shared facade textures.
  const colliders = [];
  const facadeTextures = PALETTE.building.map((base) => makeFacadeTexture(random, base, 0.55));
  const blockCentres = [-150, -90, -30, 30, 90, 150];
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      const count = 1 + Math.floor(random() * 3);
      for (let i = 0; i < count; i += 1) {
        const w = 14 + random() * 16;
        const d = 14 + random() * 16;
        const h = 10 + random() * random() * 42;
        const x = bx + (random() - 0.5) * (STREET_SPACING - w - 8);
        const z = bz + (random() - 0.5) * (STREET_SPACING - d - 8);
        const mat = new THREE.MeshLambertMaterial({ map: facadeTextures[Math.floor(random() * facadeTextures.length)] });
        const building = new THREE.Mesh(buildingGeo, mat);
        building.scale.set(w, h, d);
        building.position.set(x, h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        // A flat roof cap so towers don't look hollow from above.
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x2c2f36 }),
        );
        roof.position.set(x, h + 0.4, z);
        scene.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Streetlights at the intersections: pole plus a warm glowing head (no extra
  // point lights — the emissive head reads as lit at sunset).
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const sx of STREETS) {
    for (const sz of STREETS) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
      pole.position.set(sx + ROAD_WIDTH / 2 + 2, 3.5, sz + ROAD_WIDTH / 2 + 2);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(sx + ROAD_WIDTH / 2 + 2, 7.1, sz + ROAD_WIDTH / 2 + 2);
      scene.add(lamp);
    }
  }

  // Palms along the beach road.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7a4e });
  for (let z = -220; z <= 220; z += 28) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.set(208 + random() * 4, 3.5, z + random() * 6);
    trunk.castShadow = true;
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.4, 7), leafMat);
    leaves.position.set(trunk.position.x, 8, trunk.position.z);
    scene.add(leaves);
  }

  // The docks (north): piers, crates and containers over dark water.
  const dockWater = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 90),
    new THREE.MeshLambertMaterial({ color: PALETTE.seaDeep }),
  );
  dockWater.rotation.x = -Math.PI / 2;
  dockWater.position.set(0, 0.04, -262);
  scene.add(dockWater);
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x6b4e2e });
  const containerCols = [0xb03a2e, 0x2e6fb0, 0x3a9e5e, 0xc2a23a];
  for (const px of [-170, -60, 50, 160]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 34), pierMat);
    pier.position.set(px, 0.6, -232);
    pier.castShadow = true;
    pier.receiveShadow = true;
    scene.add(pier);
    colliders.push({ minX: px - 13, maxX: px + 13, minZ: -249, maxZ: -215 });
    for (let i = 0; i < 3; i += 1) {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(6, 5 + random() * 3, 6),
        new THREE.MeshLambertMaterial({ color: containerCols[Math.floor(random() * containerCols.length)] }),
      );
      crate.position.set(px - 8 + random() * 16, 3.5, -244 + random() * 20);
      crate.castShadow = true;
      scene.add(crate);
    }
  }
  // A dock crane, silhouetted against the sunset.
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xc2a23a });
  const craneBase = new THREE.Mesh(new THREE.BoxGeometry(6, 26, 6), craneMat);
  craneBase.position.set(-110, 13, -212);
  craneBase.castShadow = true;
  scene.add(craneBase);
  const craneArm = new THREE.Mesh(new THREE.BoxGeometry(34, 2, 2), craneMat);
  craneArm.position.set(-96, 25, -212);
  craneArm.rotation.z = 0.12;
  scene.add(craneArm);
  colliders.push({ minX: -113, maxX: -107, minZ: -215, maxZ: -209 });

  // The marina (south-east): a pier and moored boats that bob gently.
  const boats = [];
  const marinaPier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 60), pierMat);
  marinaPier.position.set(200, 0.6, 60);
  marinaPier.castShadow = true;
  scene.add(marinaPier);
  for (let i = 0; i < 4; i += 1) {
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.6, 12),
      new THREE.MeshLambertMaterial({ color: [0xe8e8e8, 0xc23b2e, 0x2e6fc2, 0xe8c832][i] }),
    );
    hull.position.set(190 + (i % 2) * 20, 0.8, 38 + i * 16);
    hull.castShadow = true;
    scene.add(hull);
    boats.push(hull);
  }

  // Otto's garage (south, just off the 180 street): a low wide shop with a sign.
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(26, 8, 16),
    new THREE.MeshLambertMaterial({ color: 0x4a3a55 }),
  );
  garage.position.set(60, 4, 200);
  garage.castShadow = true;
  garage.receiveShadow = true;
  scene.add(garage);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 4),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('OTTO’S GARAGE', '#241a2e', '#ffd98a') }),
  );
  sign.position.set(60, 7.5, 191.8);
  scene.add(sign);
  colliders.push({ minX: 47, maxX: 73, minZ: 192, maxZ: 208 });

  // The lighthouse (far south): white and red bands, a lamp room, a slow beam.
  const lighthouse = new THREE.Group();
  const lhBands = [0xe8e8e8, 0xc23b2e, 0xe8e8e8, 0xc23b2e];
  lhBands.forEach((color, i) => {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4 - i * 0.25, 3.6 - i * 0.25, 6, 12),
      new THREE.MeshLambertMaterial({ color }),
    );
    band.position.y = 3 + i * 6;
    lighthouse.add(band);
  });
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 3, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lampRoom.position.y = 26;
  lighthouse.add(lampRoom);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(5, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(30, 26, 0);
  lighthouse.add(beam);
  lighthouse.position.set(0, 0, 232);
  scene.add(lighthouse);
  colliders.push({ minX: -4, maxX: 4, minZ: 228, maxZ: 236 });

  // The mission beacon: a light pillar and a ground ring, moved by the missions.
  const beaconGroup = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.beacon, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  pillar.position.y = 30;
  beaconGroup.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.6, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beaconGroup.add(ring);
  beaconGroup.visible = false;
  scene.add(beaconGroup);

  function setMarker(x, z, visible) {
    beaconGroup.visible = visible !== false;
    beaconGroup.position.set(x, 0, z);
  }

  /** Push a circle (x, z, radius) out of every building collider and the city edge. */
  function resolveCircle(pos, radius) {
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // Dead centre of a box: push out along the smallest penetration.
          const pushLeft = pos.x - c.minX;
          const pushRight = c.maxX - pos.x;
          const pushUp = pos.z - c.minZ;
          const pushDown = c.maxZ - pos.z;
          const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
          if (min === pushLeft) pos.x = c.minX - radius;
          else if (min === pushRight) pos.x = c.maxX + radius;
          else if (min === pushUp) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
      }
    }
    pos.x = Math.max(-CITY_HALF - 5, Math.min(CITY_HALF + 8, pos.x));
    pos.z = Math.max(-CITY_HALF - 28, Math.min(CITY_HALF + 2, pos.z));
  }

  /** The nearest point on a street centreline — police spawn on roads, not in blocks. */
  function snapToStreet(x, z) {
    let bestX = STREETS[0];
    let bestZ = STREETS[0];
    let bestDx = Infinity;
    let bestDz = Infinity;
    for (const s of STREETS) {
      if (Math.abs(x - s) < bestDx) {
        bestDx = Math.abs(x - s);
        bestX = s;
      }
      if (Math.abs(z - s) < bestDz) {
        bestDz = Math.abs(z - s);
        bestZ = s;
      }
    }
    return bestDx <= bestDz ? { x: bestX, z } : { x, z: bestZ };
  }

  function update(dt, t) {
    // The sea breathes and the boats bob; the lighthouse beam sweeps the harbour.
    sea.position.y = 0.02 + Math.sin(t * 0.6) * 0.08;
    for (let i = 0; i < boats.length; i += 1) {
      boats[i].position.y = 0.8 + Math.sin(t * 0.9 + i * 1.7) * 0.15;
      boats[i].rotation.z = Math.sin(t * 0.7 + i) * 0.03;
    }
    beam.rotation.y = t * 0.25;
    const pulse = 1 + Math.sin(t * 3) * 0.08;
    ring.scale.set(pulse, pulse, 1);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return {
    scene,
    camera,
    renderer,
    colliders,
    setMarker,
    resolveCircle,
    snapToStreet,
    update,
    /** Where the title camera looks from, above the plaza at sunset. */
    titleCamera() {
      camera.position.set(-70, 55, 150);
      camera.lookAt(40, 8, -40);
    },
  };
}

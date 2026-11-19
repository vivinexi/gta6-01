// Redline District — Meridian City: procedural grid city, seeded and deterministic.
(function (global) {
  'use strict';
  const U = global.RD.util;
  const HALF = 200;          // city extends -200..200 on x and z
  const ROAD_EVERY = 40;     // roads at multiples of 40
  const ROAD_HALF = 5;       // half-width of a road

  function isRoad(x, z) {
    const mx = Math.abs(((x % ROAD_EVERY) + ROAD_EVERY) % ROAD_EVERY - ROAD_EVERY / 2);
    const mz = Math.abs(((z % ROAD_EVERY) + ROAD_EVERY) % ROAD_EVERY - ROAD_EVERY / 2);
    return mx > ROAD_EVERY / 2 - ROAD_HALF || mz > ROAD_EVERY / 2 - ROAD_HALF;
  }
  // Nearest point on a road centreline (for spawning / snapping).
  function snapToRoad(x, z) {
    const rx = Math.round(x / ROAD_EVERY) * ROAD_EVERY;
    const rz = Math.round(z / ROAD_EVERY) * ROAD_EVERY;
    return Math.abs(x - rx) < Math.abs(z - rz) ? { x: rx, z: z } : { x: x, z: rz };
  }

  function groundTexture() {
    const S = 1024, c = document.createElement('canvas');
    c.width = S; c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#3a3f35'; g.fillRect(0, 0, S, S); // sidewalk / block base
    const scale = S / (HALF * 2);
    // blocks
    g.fillStyle = '#2e2b26';
    for (let bx = -HALF; bx < HALF; bx += ROAD_EVERY) {
      for (let bz = -HALF; bz < HALF; bz += ROAD_EVERY) {
        g.fillRect((bx + ROAD_HALF) * scale + S / 2, (bz + ROAD_HALF) * scale + S / 2,
          (ROAD_EVERY - ROAD_HALF * 2) * scale, (ROAD_EVERY - ROAD_HALF * 2) * scale);
      }
    }
    // roads
    g.fillStyle = '#17181c';
    for (let r = -HALF; r <= HALF; r += ROAD_EVERY) {
      g.fillRect(0, (r - ROAD_HALF) * scale + S / 2, S, ROAD_HALF * 2 * scale);
      g.fillRect((r - ROAD_HALF) * scale + S / 2, 0, ROAD_HALF * 2 * scale, S);
    }
    // lane dashes
    g.fillStyle = '#c8a84a';
    for (let r = -HALF; r <= HALF; r += ROAD_EVERY) {
      for (let d = -HALF; d < HALF; d += 12) {
        g.fillRect((d) * scale + S / 2, (r - 0.4) * scale + S / 2, 5 * scale, 0.8 * scale);
        g.fillRect((r - 0.4) * scale + S / 2, (d) * scale + S / 2, 0.8 * scale, 5 * scale);
      }
    }
    // crosswalks at intersections
    g.fillStyle = 'rgba(230,230,220,0.75)';
    for (let rx = -HALF; rx <= HALF; rx += ROAD_EVERY) {
      for (let rz = -HALF; rz <= HALF; rz += ROAD_EVERY) {
        for (let k = -2; k <= 2; k++) {
          g.fillRect((rx + k * 2 - 0.7) * scale + S / 2, (rz - ROAD_HALF) * scale + S / 2, 1.4 * scale, ROAD_HALF * 2 * scale);
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function windowsTexture(seed) {
    const rng = U.mulberry32(seed);
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#4a4f5e'; g.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 248; y += 16) {
      for (let x = 8; x < 120; x += 16) {
        const lit = rng() < 0.42;
        g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#2a2e3a';
        g.fillRect(x, y, 10, 10);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function buildCity(scene, seed) {
    const rng = U.mulberry32(seed);
    const group = new THREE.Group();
    scene.add(group);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF * 2, HALF * 2),
      new THREE.MeshLambertMaterial({ map: groundTexture() })
    );
    ground.rotation.x = -Math.PI / 2;
    group.add(ground);

    const buildings = []; // {minX,maxX,minZ,maxZ,h}
    const winTex = windowsTexture(seed + 7);
    const palette = [0x4a5568, 0x5b4a68, 0x68584a, 0x3f5a52, 0x5a4a3f, 0x464e63, 0x6b5a6e];
    const geoBox = new THREE.BoxGeometry(1, 1, 1);
    for (let bx = -HALF + ROAD_HALF; bx < HALF - 10; bx += ROAD_EVERY) {
      for (let bz = -HALF + ROAD_HALF; bz < HALF - 10; bz += ROAD_EVERY) {
        // leave the garage block and the tower plaza open (blocks are bx/bz loop values)
        if (bx === -155 && bz === 125) continue; // Wrench's garage block
        if (bx === 125 && bz === -155) continue; // Vera's tower plaza
        if (rng() < 0.08) continue; // empty lot / park
        const w = 13 + rng() * 7, d = 13 + rng() * 7;
        const h = 10 + rng() * rng() * 46;
        const mat = new THREE.MeshLambertMaterial({ color: palette[Math.floor(rng() * palette.length)], map: winTex });
        const m = new THREE.Mesh(geoBox, mat);
        const cx = bx + ROAD_EVERY / 2, cz = bz + ROAD_EVERY / 2;
        m.scale.set(w, h, d);
        m.position.set(cx, h / 2, cz);
        group.add(m);
        buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h: h });
        // rooftop box
        if (rng() < 0.5) {
          const roof = new THREE.Mesh(geoBox, new THREE.MeshLambertMaterial({ color: 0x2a2e38 }));
          roof.scale.set(w * 0.3, 2, d * 0.3);
          roof.position.set(cx + (rng() - 0.5) * w * 0.4, h + 1, cz + (rng() - 0.5) * d * 0.4);
          group.add(roof);
        }
      }
    }

    // Street lamps along roads.
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
    const bulbGeo = new THREE.SphereGeometry(0.45, 8, 6);
    for (let r = -HALF + 20; r <= HALF - 20; r += ROAD_EVERY) {
      for (let d = -HALF + 20; d <= HALF - 20; d += 80) {
        for (const [lx, lz] of [[r + 6, d], [r, d + 6]]) {
          const pole = new THREE.Mesh(poleGeo, lampMat);
          pole.position.set(lx, 3, lz);
          group.add(pole);
          const bulb = new THREE.Mesh(bulbGeo, lampGlow);
          bulb.position.set(lx, 6.2, lz);
          group.add(bulb);
        }
      }
    }

    // Trees in empty lots.
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e5d33 });
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6);
    const leafGeo = new THREE.ConeGeometry(2.2, 5, 8);
    for (let i = 0; i < 40; i++) {
      const x = (rng() * 2 - 1) * (HALF - 20), z = (rng() * 2 - 1) * (HALF - 20);
      if (isRoad(x, z)) continue;
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 1.2, z); group.add(trunk);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(x, 4.4, z); group.add(leaf);
    }

    // Wrench's garage (mission hub) at block (-160, 120).
    const garage = { x: -140, z: 140 };
    const garageMat = new THREE.MeshLambertMaterial({ color: 0x8a6d1f });
    const garageMesh = new THREE.Mesh(geoBox, garageMat);
    garageMesh.scale.set(22, 7, 16);
    garageMesh.position.set(garage.x, 3.5, garage.z);
    group.add(garageMesh);
    const doorMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), doorMat);
    door.position.set(garage.x, 2.5, garage.z - 8.1);
    door.rotation.y = Math.PI;
    group.add(door);
    buildings.push({ minX: garage.x - 11, maxX: garage.x + 11, minZ: garage.z - 8, maxZ: garage.z + 8, h: 7 });

    // Vera Solano's tower (mission 4) at plaza (120, -160).
    const tower = { x: 140, z: -140 };
    const towerMat = new THREE.MeshLambertMaterial({ color: 0x1c1f2e, map: winTex, emissive: 0x331122 });
    const towerMesh = new THREE.Mesh(geoBox, towerMat);
    towerMesh.scale.set(26, 78, 26);
    towerMesh.position.set(tower.x, 39, tower.z);
    group.add(towerMesh);
    buildings.push({ minX: tower.x - 13, maxX: tower.x + 13, minZ: tower.z - 13, maxZ: tower.z + 13, h: 78 });
    // red beacon on top
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2d55 }));
    beacon.position.set(tower.x, 79.5, tower.z);
    group.add(beacon);

    return { group: group, buildings: buildings, garage: garage, tower: tower };
  }

  // Circle (player) vs building AABBs: push out.
  function collideCircle(buildings, x, z, r) {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) {
        const dxl = x - (b.minX - r), dxr = (b.maxX + r) - x;
        const dzl = z - (b.minZ - r), dzr = (b.maxZ + r) - z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) x = b.minX - r;
        else if (m === dxr) x = b.maxX + r;
        else if (m === dzl) z = b.minZ - r;
        else z = b.maxZ + r;
      }
    }
    x = U.clamp(x, -HALF + 2, HALF - 2);
    z = U.clamp(z, -HALF + 2, HALF - 2);
    return { x: x, z: z };
  }

  global.RD.world = { buildCity: buildCity, collideCircle: collideCircle, isRoad: isRoad, snapToRoad: snapToRoad, HALF: HALF, ROAD_EVERY: ROAD_EVERY };
})(window);

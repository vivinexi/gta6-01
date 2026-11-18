// The HUD: DOM panels for health, cash, wanted stars, the mission objective,
// speed and the phone, plus a live 2D minimap drawn on a canvas.
import { CITY } from './config.js';
import { ROAD_LINES } from './world.js';

const MAP_SIZE = 180;
const MAP_SCALE = MAP_SIZE / (CITY.bounds * 2 + 80);

function toMap(x, z) {
  return {
    x: (x + CITY.bounds + 40) * MAP_SCALE,
    y: (z + CITY.bounds + 40) * MAP_SCALE,
  };
}

export function createHud(doc) {
  const el = (id) => doc.getElementById(id);
  const hud = el('hud');
  const healthFill = el('health-fill');
  const healthText = el('health-text');
  const cashText = el('cash');
  const starsEl = el('stars');
  const objectiveEl = el('objective');
  const speedEl = el('speed');
  const phoneEl = el('phone');
  const hintEl = el('hint');
  const mapCanvas = el('minimap');
  const mapCtx = mapCanvas.getContext('2d');
  const crosshair = el('crosshair');
  let phoneTimer = null;
  let lastStars = -1;
  let lastCash = -1;

  const screens = {
    start: el('start-screen'),
    pause: el('pause-screen'),
    busted: el('busted-screen'),
    complete: el('complete-screen'),
  };

  return {
    showScreen(name) {
      for (const [key, node] of Object.entries(screens)) {
        if (node) node.style.display = key === name ? 'flex' : 'none';
      }
      hud.style.display = name === 'play' ? 'block' : 'none';
      if (crosshair) crosshair.style.display = name === 'play' ? 'block' : 'none';
    },
    setHealth(hp, max) {
      const pct = Math.max(0, Math.round((hp / max) * 100));
      healthFill.style.width = `${pct}%`;
      healthFill.style.background = pct > 50 ? '#3fce62' : pct > 25 ? '#f2c94c' : '#e5534b';
      healthText.textContent = `${pct}`;
    },
    setCash(cash) {
      if (cash === lastCash) return;
      lastCash = cash;
      cashText.textContent = `$${cash.toLocaleString('en-US')}`;
    },
    setStars(stars) {
      if (stars === lastStars) return;
      lastStars = stars;
      starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      starsEl.style.color = stars >= 3 ? '#ff5252' : '#ffd23c';
      starsEl.style.visibility = stars > 0 ? 'visible' : 'hidden';
    },
    setObjective(text) {
      objectiveEl.textContent = text;
    },
    setSpeed(kmh) {
      if (kmh === null) {
        speedEl.style.display = 'none';
        return;
      }
      speedEl.style.display = 'block';
      speedEl.textContent = `${Math.round(kmh)} km/h`;
    },
    showPhone(text) {
      phoneEl.textContent = text;
      phoneEl.style.display = 'block';
      if (phoneTimer) clearTimeout(phoneTimer);
      phoneTimer = window.setTimeout(() => {
        phoneEl.style.display = 'none';
      }, 7000);
    },
    setHint(text) {
      if (text) {
        hintEl.textContent = text;
        hintEl.style.display = 'block';
      } else {
        hintEl.style.display = 'none';
      }
    },
    /** Top-down map: roads, sea, player arrow, cars, police, enemies, marker. */
    drawMinimap(G) {
      const ctx = mapCtx;
      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
      ctx.fillStyle = '#20242a';
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
      // Sea strip at the bottom (south).
      const sea = toMap(0, CITY.seaZ - 20);
      ctx.fillStyle = '#1d7fa8';
      ctx.fillRect(0, sea.y, MAP_SIZE, MAP_SIZE - sea.y);
      // Roads.
      ctx.strokeStyle = '#4a4f55';
      ctx.lineWidth = 4;
      for (const line of ROAD_LINES) {
        const a = toMap(line, -CITY.bounds);
        const b = toMap(line, CITY.bounds);
        ctx.beginPath();
        ctx.moveTo(a.x, 0);
        ctx.lineTo(b.x, MAP_SIZE);
        ctx.stroke();
        const c = toMap(-CITY.bounds, line);
        const d = toMap(CITY.bounds, line);
        ctx.beginPath();
        ctx.moveTo(0, c.y);
        ctx.lineTo(MAP_SIZE, d.y);
        ctx.stroke();
      }
      // Mission marker.
      const beacon = G.world.beacon;
      if (beacon.visible) {
        const m = toMap(beacon.position.x, beacon.position.z);
        const pulse = 5 + Math.sin(G.time * 4) * 2;
        ctx.fillStyle = '#ffd23c';
        ctx.beginPath();
        ctx.arc(m.x, m.y, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#20242a';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Enemies.
      ctx.fillStyle = '#ff5252';
      for (const e of G.combat.enemies) {
        const p = toMap(e.x, e.z);
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      // Cars (traffic + parked).
      ctx.fillStyle = '#d8d8d8';
      for (const car of G.allCars) {
        if (car.isPlayer) continue;
        const p = toMap(car.x, car.z);
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      // Police, flashing.
      if (Math.floor(G.time * 3) % 2 === 0) ctx.fillStyle = '#2244ff';
      else ctx.fillStyle = '#ff2222';
      for (const entry of G.wanted.policeCars) {
        const p = toMap(entry.car.x, entry.car.z);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Player arrow.
      const px = G.playerCar ? G.playerCar.x : G.player.x;
      const pz = G.playerCar ? G.playerCar.z : G.player.z;
      const heading = G.playerCar ? G.playerCar.heading : G.player.heading;
      const p = toMap(px, pz);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(heading);
      ctx.fillStyle = '#3fce62';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.5, 5);
      ctx.lineTo(-4.5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  };
}

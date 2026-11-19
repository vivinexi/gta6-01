// The HUD: health, cash, wanted stars, objective, speed, toasts, the timer and
// a live 2D minimap of Port Vela. All of it is plain DOM over the WebGL canvas,
// so it costs nothing to render and stays readable at any window size.
import { CITY_HALF, STREETS } from './config.js';

const MAP_SIZE = 190;

export function createHud() {
  const el = (id) => document.getElementById(id);
  const healthFill = el('hud-health-fill');
  const healthText = el('hud-health-text');
  const cashText = el('hud-cash');
  const starsText = el('hud-stars');
  const objectiveText = el('hud-objective');
  const speedText = el('hud-speed');
  const messageBox = el('hud-message');
  const timerText = el('hud-timer');
  const promptText = el('hud-prompt');
  const map = el('minimap');
  const mapCtx = map.getContext('2d');
  const screens = {
    title: el('screen-title'),
    pause: el('screen-pause'),
    busted: el('screen-busted'),
    wasted: el('screen-wasted'),
    complete: el('screen-complete'),
  };
  let messageTimer = null;

  function showScreen(name) {
    for (const key of Object.keys(screens)) {
      if (screens[key]) screens[key].classList.toggle('hidden', key !== name);
    }
    const hud = el('hud');
    if (hud) hud.classList.toggle('hidden', name === 'title');
  }

  function toast(message, seconds = 4) {
    messageBox.textContent = message;
    messageBox.classList.remove('hidden');
    if (messageTimer) clearTimeout(messageTimer);
    messageTimer = setTimeout(() => messageBox.classList.add('hidden'), seconds * 1000);
  }

  function toMap(x, z) {
    const s = MAP_SIZE / (CITY_HALF * 2 + 60);
    return [(x + CITY_HALF + 30) * s, (z + CITY_HALF + 30) * s];
  }

  function drawMinimap(state) {
    const g = mapCtx;
    g.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    g.fillStyle = '#23262e';
    g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // The sea, east of the beach.
    const [seaX] = toMap(240, 0);
    g.fillStyle = '#1d5f7a';
    g.fillRect(seaX, 0, MAP_SIZE - seaX, MAP_SIZE);
    g.fillStyle = '#d9b380';
    const [sandX] = toMap(208, 0);
    g.fillRect(sandX, 0, seaX - sandX, MAP_SIZE);
    // Streets.
    g.strokeStyle = '#565b66';
    g.lineWidth = 2;
    for (const s of STREETS) {
      const [x1, z1] = toMap(s, -CITY_HALF);
      const [x2, z2] = toMap(s, CITY_HALF);
      g.beginPath();
      g.moveTo(x1, z1);
      g.lineTo(x2, z2);
      g.stroke();
      const [hx1, hz1] = toMap(-CITY_HALF, s);
      const [hx2, hz2] = toMap(CITY_HALF, s);
      g.beginPath();
      g.moveTo(hx1, hz1);
      g.lineTo(hx2, hz2);
      g.stroke();
    }
    const dot = (x, z, color, r) => {
      const [mx, mz] = toMap(x, z);
      g.fillStyle = color;
      g.beginPath();
      g.arc(mx, mz, r, 0, Math.PI * 2);
      g.fill();
    };
    if (state.markerVisible) dot(state.markerX, state.markerZ, '#ffe14d', 5);
    for (const car of state.traffic || []) dot(car.x, car.z, '#8b93a3', 2);
    for (const rival of state.rivals || []) dot(rival.x, rival.z, '#ff2a1a', 3);
    for (const car of state.police || []) dot(car.x, car.z, '#3a6cff', 3.5);
    // Maya: a rotated arrow so the player can see which way she faces.
    const [px, pz] = toMap(state.playerX, state.playerZ);
    g.save();
    g.translate(px, pz);
    g.rotate(state.playerHeading);
    g.fillStyle = '#ff7a1a';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(0, 2.5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.restore();
    // North marker.
    g.fillStyle = '#eef1f5';
    g.font = 'bold 11px system-ui, sans-serif';
    g.fillText('N', MAP_SIZE / 2 - 4, 12);
  }

  return {
    showScreen,
    toast,
    setHealth(health) {
      healthFill.style.width = `${Math.max(0, Math.min(100, health))}%`;
      healthFill.style.background = health > 50 ? '#37c24a' : health > 25 ? '#e8a832' : '#e83232';
      healthText.textContent = `${Math.ceil(Math.max(0, health))}`;
    },
    setCash(cash) {
      cashText.textContent = `$${cash.toLocaleString('en-US')}`;
    },
    setStars(stars) {
      starsText.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      starsText.classList.toggle('hot', stars > 0);
    },
    setObjective(text) {
      objectiveText.textContent = text;
    },
    setSpeed(kmh, driving) {
      speedText.textContent = driving ? `${Math.round(kmh)} km/h` : '';
    },
    setTimer(seconds) {
      if (seconds > 0) {
        timerText.textContent = `⏱ ${Math.ceil(seconds)}s`;
        timerText.classList.remove('hidden');
      } else {
        timerText.classList.add('hidden');
      }
    },
    setPrompt(text) {
      if (text) {
        promptText.textContent = text;
        promptText.classList.remove('hidden');
      } else {
        promptText.classList.add('hidden');
      }
    },
    drawMinimap,
    setTitleStats(text) {
      const stats = el('title-stats');
      if (stats) stats.textContent = text;
    },
    setCompleteStats(text) {
      const stats = el('complete-stats');
      if (stats) stats.textContent = text;
    },
  };
}

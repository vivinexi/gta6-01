// Keyboard and pointer input. Held keys are read every step; one-shot
// presses (enter car, jump, punch, pause, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. Mouse drag orbits the camera; a click shoots.
export const ACTION_ENTER = 1;
export const ACTION_JUMP = 2;
export const ACTION_PUNCH = 4;
export const ACTION_PAUSE = 8;
export const ACTION_MUTE = 16;
export const ACTION_SHOOT = 32;

const ENTER = new Set(['KeyE']);
const JUMP = new Set(['Space']);
const PUNCH = new Set(['KeyF']);
const PAUSE = new Set(['Escape', 'KeyP']);
const MUTE = new Set(['KeyM']);

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let orbitDX = 0;
  let orbitDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS.includes(event.code)) held.add(event.code);
    else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (JUMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_JUMP;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      held.add(event.code);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    dragging = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    if (event.button === 0) actions |= ACTION_SHOOT;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    orbitDX += event.clientX - lastX;
    orbitDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  const has = (...codes) => codes.some((c) => held.has(c));

  return {
    /** Forward/back/strafe as -1, 0 or 1 each (camera-relative, read by player/vehicles). */
    move() {
      return {
        forward: (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0),
        strafe: (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0),
        run: held.has('ShiftLeft') || held.has('ShiftRight'),
      };
    },
    /** Mouse drag since the last call, in pixels. */
    takeOrbit() {
      const out = { dx: orbitDX, dy: orbitDY };
      orbitDX = 0;
      orbitDY = 0;
      return out;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

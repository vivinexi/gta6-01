// Keyboard and pointer input for a third-person open world. Held keys are read
// every frame; one-shot presses (confirm, pause, interact, punch, mute) are queued
// as bit flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. The camera orbits while the pointer is dragged;
// a click (press and release without dragging) fires the pistol.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_SHOOT = 32;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const JUMP = new Set(['Space']);
const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let orbitDX = 0;
  let orbitDY = 0;
  let dragging = false;
  let downX = 0;
  let downY = 0;
  let moved = 0;

  function press(code) {
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (INTERACT.has(code)) actions |= ACTION_INTERACT;
    else if (PUNCH.has(code)) actions |= ACTION_PUNCH;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    press(event.code);
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || JUMP.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    moved = 0;
    downX = event.clientX;
    downY = event.clientY;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already-released pointers have nothing to capture.
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.movementX || 0;
    const dy = event.movementY || 0;
    orbitDX += dx;
    orbitDY += dy;
    moved += Math.abs(dx) + Math.abs(dy);
  });
  canvas.addEventListener('pointerup', (event) => {
    dragging = false;
    // A click without a drag is a pistol shot; a drag was a camera orbit.
    if (moved < 6) actions |= ACTION_SHOOT;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Forward/back strafe in [-1, 1]: W/S (or arrows). */
    moveY() {
      return (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0);
    },
    /** Left/right strafe in [-1, 1]: A/D (or arrows). */
    moveX() {
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    run() {
      return has(RUN);
    },
    jump() {
      return has(JUMP);
    },
    /** Pointer-drag deltas since the last call, in pixels. */
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
    /** Test and debug helpers: pretend a key is held, or queue an action. */
    debugHold(code, on) {
      if (on) held.add(code);
      else held.delete(code);
    },
    debugAction(flag) {
      actions |= flag;
    },
  };
}

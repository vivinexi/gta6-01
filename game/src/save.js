// localStorage save: cash, mission progress, health and where Maya stands.
// A save never stores a car — Maya keeps her money and her story, not her ride.
import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return {
      cash: Math.max(0, Math.floor(data.cash)),
      missionIndex: Math.min(3, Math.max(0, Math.floor(data.missionIndex))),
      health: typeof data.health === 'number' ? Math.min(100, Math.max(1, data.health)) : 100,
      x: typeof data.x === 'number' ? data.x : 0,
      z: typeof data.z === 'number' ? data.z : 140,
    };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cash: data.cash,
        missionIndex: data.missionIndex,
        health: data.health,
        x: data.x,
        z: data.z,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}

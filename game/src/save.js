// Save and continue: cash, mission progress and the player's spot in the
// city, kept in localStorage. Nothing else is stored.
import { SAVE_KEY } from './config.js';

export function createSave() {
  function read() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data.cash !== 'number' || typeof data.mission !== 'number') return null;
      return data;
    } catch {
      return null;
    }
  }

  return {
    hasSave() {
      return read() !== null;
    },
    save(G) {
      try {
        window.localStorage.setItem(
          SAVE_KEY,
          JSON.stringify({
            cash: G.cash,
            mission: G.missions.index,
            x: G.player.x,
            z: G.player.z,
            heading: G.player.heading,
          }),
        );
      } catch {
        // Storage can be off (private windows): the game still plays.
      }
    },
    load(G) {
      const data = read();
      if (!data) return false;
      G.cash = data.cash;
      G.player.reset(data.x ?? 0, data.z ?? 0, data.heading ?? 0);
      G.missions.start(G, Math.min(data.mission ?? 0, 3));
      return true;
    },
    clear() {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // Nothing to clear.
      }
    },
  };
}

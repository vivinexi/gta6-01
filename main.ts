// Redline District — submission entrypoint.
//
// The grader runs this file with `node main.ts`. Its whole job is to stage
// the deliverable: take the playable game and the screenshots that live next
// to this file and lay them out in the output folder the judge reads, then
// write the dossier summary that describes the entry.
//
// Nothing here plays the game itself. The game is plain static files under
// game/ and the screenshots are four JPEGs under screenshots/. This script
// just gathers them and asks the vendored make.fun helper to summarise the
// result for the judge.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Folder this file lives in — the game and screenshots sit beside it.
const rootDir = dirname(fileURLToPath(import.meta.url));

// Where the judge expects the staged entry. Inside the grading container
// this is /output; locally the env var lets us point it at a scratch folder.
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(targetDir, { recursive: true });

// The whole game directory goes across unchanged.
cpSync(join(rootDir, 'game'), join(targetDir, 'game'), { recursive: true });

// Screenshots are optional on disk, but the folder itself always exists.
const shotsTarget = join(targetDir, 'screenshots');
mkdirSync(shotsTarget, { recursive: true });
const shotsSource = join(rootDir, 'screenshots');
if (existsSync(shotsSource)) {
  cpSync(shotsSource, shotsTarget, { recursive: true });
}

// The dossier is the judge's summary of the staged entry. The caps below
// mirror the scorer's limits: at most four screenshots of 256 KiB each, a
// game of at most 993 files and 48 MiB with no path longer than 1000 bytes,
// and 160 KiB of text in total.
const summary = buildDossier(targetDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(targetDir, 'dossier.json'), summary);

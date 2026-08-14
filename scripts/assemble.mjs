#!/usr/bin/env node
/**
 * Assembles the deployable site into _site/: the single-file frontend plus the
 * generated database it fetches at runtime. Used by `npm run serve` locally and
 * by the Pages workflow in CI.
 */

import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, '_site');

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(resolve(ROOT, 'site/index.html'), resolve(OUT, 'index.html'));
await cp(resolve(ROOT, 'data/games.json'), resolve(OUT, 'games.json'));

console.log('Assembled _site/ (index.html + games.json)');

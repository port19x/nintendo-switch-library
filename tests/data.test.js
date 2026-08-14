import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../games.json', import.meta.url)));

test('ships the complete library catalogue', () => {
  assert.ok(data.games.length >= 500);
  assert.equal(new Set(data.games.map(game => game.id)).size, data.games.length);
});

test('most catalogue entries have useful enrichment', () => {
  assert.ok(data.games.filter(game => game.hours != null).length >= 330);
  assert.ok(data.games.filter(game => game.score != null).length >= 300);
  assert.ok(data.games.filter(game => game.density != null).length >= 290);
});

test('enriched values and links are valid', () => {
  for (const game of data.games) {
    if (game.score != null) assert.ok(game.score >= 0 && game.score <= 100, game.title);
    if (game.hours != null) assert.ok(game.hours > 0, game.title);
    assert.match(game.libraryUrl, /^https:\/\/opac\.karlsruhe\.de\//);
    assert.match(game.metacriticUrl, /^https:\/\/www\.metacritic\.com\//);
    assert.match(game.hltbUrl, /^https:\/\/howlongtobeat\.com\//);
  }
});

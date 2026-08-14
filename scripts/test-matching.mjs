#!/usr/bin/env node
/**
 * Offline checks for title matching — the fragile part of this pipeline.
 *
 * Every case here is a real pair seen while building against the live
 * catalogue. Matching has no ground truth to test against, so this file *is* the
 * ground truth: when a mismatch turns up in a build, add it here first, then fix
 * the metric until this passes.
 *
 *   npm test
 */

import { similarity, cleanTitle, searchVariants, aliasFor, bestMatch, matchTargets } from './lib/normalize.mjs';
import { searchTerms } from './lib/hltb.mjs';
import { densityScore } from './lib/density.mjs';
import { classifyParty } from './lib/firstparty.mjs';

const THRESHOLD = 0.62;
let failures = 0;

function check(condition, description, detail = '') {
  if (!condition) {
    failures++;
    console.log(`  FAIL  ${description}${detail ? `  — ${detail}` : ''}`);
  }
}

/* ---------- title matching ---------- */

/** [catalogue title, database candidate, should they be considered the same game] */
const PAIRS = [
  // Same game, textual drift
  ['Splatoon 3', 'Splatoon 3', true],
  ['Atomicrops', 'Atomicrops', true],
  ['Old school rally', 'Old School Rally', true],
  ['Bendy - Lone wolf', 'Bendy: Lone Wolf', true],
  ['Sonic Racing - CrossWorlds', 'Sonic Racing: CrossWorlds', true],
  ['The Legend of Zelda - Tears of the Kingdom', 'The Legend of Zelda: Tears of the Kingdom', true],
  ['Mario Party Superstar', 'Mario Party Superstars', true],
  ['Lego - The Ninjago Movie Videogame', 'The LEGO NINJAGO Movie Video Game', true],
  ['Naruto Shippuden - Ultimate Ninja Storm 4', 'Naruto Shippuden: Ultimate Ninja Storm 4', true],
  ["Luigi's Mansion 2 HD", "Luigi's Mansion 2 HD", true],
  ['Minecraft: Story Mode 2', 'Minecraft: Story Mode - Season Two', true],

  // Same game, candidate carries extra subtitle or publisher prefix
  ['Mario Kart 8', 'Mario Kart 8 Deluxe', true],
  ['Civilization VII', "Sid Meier's Civilization VII", true],
  ['Guilty Gear Strive', 'Guilty Gear -Strive- Nintendo Switch Edition', true],
  ['Call of Cthulhu', 'Call of Cthulhu: The Official Video Game', true],
  ['Street Fighter', 'Street Fighter 30th Anniversary Collection', true],
  ['Nintendo World Championships', 'Nintendo World Championships: NES Edition', true],

  // Different games — the failures that motivated each guard
  ['Minecraft: Story Mode 2', 'Minecraft', false],
  ['Street Fighter', 'Street Fighter 6', false],
  ['Nintendo World Championships', 'Nintendo World Championships 1990', false],
  ['Splatoon 3', 'Splatoon 2', false],
  ['Xenoblade Chronicles 2', 'Xenoblade Chronicles 3', false],
  ['Pikmin 4', 'Pikmin 3 Deluxe', false],
  ['Pokémon Scarlet', 'Pokémon Violet', false],
  ['Mario Kart 8', 'Mario Kart 7', false],
];

console.log('Title matching');
for (const [catalogueTitle, candidate, shouldMatch] of PAIRS) {
  const score = similarity(catalogueTitle, candidate);
  check(
    (score >= THRESHOLD) === shouldMatch,
    `${shouldMatch ? 'should match' : 'should reject'}: "${catalogueTitle}" vs "${candidate}"`,
    `scored ${score.toFixed(3)} against threshold ${THRESHOLD}`,
  );
}

/* ---------- title cleaning ---------- */

console.log('Title cleaning');
const CLEANED = [
  // German spellings-out of a numeral are always noise.
  ['Xenoblade Chronicles 2 [zwei]', 'Xenoblade Chronicles 2'],
  ['The Elder Scrolls V [fünf] - Skyrim', 'The Elder Scrolls V - Skyrim'],
  // Statement of responsibility and platform suffixes go.
  ['Super Mario Odyssey / Nintendo', 'Super Mario Odyssey'],
  ['Mario Kart 8 - Nintendo Switch', 'Mario Kart 8'],
  // ...but a hyphen inside the name must survive.
  ['1-2-Switch', '1-2-Switch'],
  ['Nintendo Switch Sport', 'Nintendo Switch Sport'],
];
for (const [input, expected] of CLEANED) {
  const actual = cleanTitle(input);
  check(actual === expected, `cleanTitle("${input}")`, `got "${actual}", expected "${expected}"`);
}

console.log('HowLongToBeat query terms');
// HLTB requires every whitespace-separated term to appear in the title, so the
// catalogue's " - " subtitle separator must never become a search term: the only
// "Trine 4" entries containing a hyphen are its DLCs.
check(!searchTerms('Trine 4 - The Nightmare Prince').includes('-'), 'lone hyphen is dropped from query terms');
check(searchTerms('Trine 4 - The Nightmare Prince').length === 5, 'remaining terms are kept',
  JSON.stringify(searchTerms('Trine 4 - The Nightmare Prince')));
check(searchTerms("Mario & Luigi - Brothership").join(' ') === 'Mario Luigi Brothership',
  'standalone ampersand is dropped too', JSON.stringify(searchTerms('Mario & Luigi - Brothership')));
check(searchTerms("Luigi's Mansion 2 HD").length === 4, 'punctuation inside a word is preserved');

console.log('Verbose records');
{
  // Sales copy appended to the real title must not sink the correct entry...
  const verbose = 'Just Dance 2018 40 neue Hits & Zugang zu über 300 Songs';
  const candidates = [{ name: 'Just Dance 2018' }, { name: 'Just Dance 2019' }];
  const hit = bestMatch(verbose, candidates, (item) => item.name);
  check(hit?.match?.name === 'Just Dance 2018', 'verbose record matches on its opening words',
    `got ${hit?.match?.name ?? 'no match'}`);

  // ...but the leniency is gated on length, so short titles stay strict.
  check(bestMatch('Minecraft: Story Mode 2', [{ name: 'Minecraft' }], (item) => item.name) === null,
    'short title still rejects a generic prefix candidate');
  check(matchTargets('Minecraft: Story Mode 2').length === 1, 'short title gets no prefix target');
}

console.log('Search variants');
// Localised titles must offer their English name as the first query tried.
check(searchVariants('Pokémon - Karmesin')[0] === 'Pokémon Scarlet', 'alias leads the variant list');
check(aliasFor('BRATZ - Rhythmus & stil') === 'Bratz: Rhythm & Style', 'alias keys fold "&" like canonical does');
check(aliasFor("Pui Pui Molcar Let's ! Molcar Party") != null, 'alias keys fold apostrophes like canonical does');
// An acute accent standing in for an apostrophe must produce a plain variant.
check(
  searchVariants('Sid Meier´s Civilization VII').some((variant) => !/´/.test(variant)),
  'apostrophe-normalised variant is offered',
);

/* ---------- density ---------- */

console.log('Density');
check(densityScore(83, 14.5) === 5.1, 'Splatoon 3 density', `got ${densityScore(83, 14.5)}`);
check(densityScore(50, 5) === 0, 'a game at the quality floor scores 0');
check(densityScore(40, 2) === 0, 'a game below the floor scores 0, however short');
check(densityScore(null, 5) === null, 'missing score yields null, not 0');
check(densityScore(80, null) === null, 'missing playtime yields null, not 0');
check(densityScore(80, 0) === null, 'zero playtime yields null rather than dividing by zero');
check(densityScore(85, 3) > densityScore(85, 30), 'shorter beats longer at equal quality');
check(densityScore(90, 10) > densityScore(70, 10), 'better beats worse at equal length');

/* ---------- first-party classification ---------- */

console.log('First-party classification');
const PARTY = [
  ['Splatoon 3', ['Nintendo'], true],
  ['Pokémon Scarlet', ['The Pokemon Company', 'Nintendo'], true],
  ['Bayonetta 3', ['Nintendo'], true],
  // Metacritic's credit overrules the franchise list...
  ['Cuphead', ['Studio MDHR', 'Microsoft'], false],
  ['Tunic', ['Finji'], false],
  // ...and Ubisoft's Mario game stays third-party despite the Nintendo credit.
  ['Mario + Rabbids - Sparks of Hope', ['Ubisoft', 'Nintendo'], false],
  // Fall back to the franchise list only when Metacritic knows nothing.
  ['Super Mario Bros. Wonder', [], true],
  ['The Legend of Zelda - Echoes of Wisdom', [], true],
  ['Some Unknown Indie Game', [], false],
];
for (const [title, publishers, expected] of PARTY) {
  const actual = classifyParty({ title, metacriticPublishers: publishers }).firstParty;
  check(actual === expected, `${title} should be ${expected ? 'first' : 'third'}-party`, `got ${actual ? 'first' : 'third'}`);
}

console.log(failures ? `\n${failures} failing check(s)` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

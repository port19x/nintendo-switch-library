#!/usr/bin/env node
/**
 * Builds data/games.json: the library's Switch shelf enriched with Metacritic
 * scores and HowLongToBeat playtimes.
 *
 *   npm run build                 full refresh (uses the on-disk lookup cache)
 *   npm run build -- --limit 25   quick smoke run over the first 25 titles
 *   npm run build -- --no-cache   ignore cached lookups
 *   npm run build -- --retry-misses  re-attempt titles that previously missed
 *
 * Lookup results are cached in data/cache.json and committed, so a scheduled
 * rebuild only pays for newly acquired games — and a temporary outage at
 * Metacritic or HLTB degrades to "keep yesterday's data" instead of blanking it.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchLibraryCatalogue, LIBRARY_RSS_URL } from './lib/rss.mjs';
import * as metacritic from './lib/metacritic.mjs';
import * as hltb from './lib/hltb.mjs';
import { classifyParty } from './lib/firstparty.mjs';
import { densityScore, DENSITY_FORMULA, SCORE_FLOOR, TIME_EXPONENT } from './lib/density.mjs';
import { canonical } from './lib/normalize.mjs';
import { pool, sleep } from './lib/http.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(ROOT, 'data');
const GAMES_PATH = resolve(DATA_DIR, 'games.json');
const CACHE_PATH = resolve(DATA_DIR, 'cache.json');

// Bump when matching logic changes, so stale results are re-resolved rather than
// carried forward. v2: Switch-platform and release-year plausibility filters.
// v3: directional token coverage and the sequel-numeral guard.
// v4: punctuation-only terms dropped from HLTB queries.
const CACHE_VERSION = 4;
const POSITIVE_TTL_DAYS = 45;
const NEGATIVE_TTL_DAYS = 7;
const CONCURRENCY = Number(process.env.LOOKUP_CONCURRENCY || 4);

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const useCache = !flag('no-cache');
const retryMisses = flag('retry-misses');
const limit = Number(option('limit', 0)) || 0;

const log = (...parts) => console.log(...parts);
const isFresh = (entry, ttlDays) =>
  entry?.fetchedAt && Date.now() - Date.parse(entry.fetchedAt) < ttlDays * 86_400_000;

async function loadCache() {
  try {
    const parsed = JSON.parse(await readFile(CACHE_PATH, 'utf8'));
    if (parsed?.version === CACHE_VERSION && parsed.entries) return parsed.entries;
  } catch {
    /* first run, or cache is unreadable — rebuild it */
  }
  return {};
}

/**
 * A failed lookup means one of two very different things, and only one of them
 * is worth remembering:
 *   "no match"      — the game genuinely isn't in that database.
 *   a request error — rate limiting or an outage; the game may well be there.
 * Caching the second kind records hundreds of titles as "not on HowLongToBeat"
 * after a rate limit, and the negative TTL then keeps them wrong for a week.
 */
const TRANSIENT_ERROR = /HTTP (403|408|429|5\d\d)|search failed|fetch failed|timeout|abort|ECONN|socket|network/i;
const isTransientFailure = (entry) =>
  Boolean(entry) && !entry.ok && (entry.transient || TRANSIENT_ERROR.test(entry.error ?? ''));

/** Reuse a cached lookup when it is still fresh, otherwise call `fetcher`. */
async function cached(cache, key, provider, fetcher) {
  const entry = cache[key]?.[provider];
  const ttl = entry?.ok ? POSITIVE_TTL_DAYS : NEGATIVE_TTL_DAYS;
  const reusable =
    entry && isFresh(entry, ttl) && (entry.ok || !retryMisses) && !isTransientFailure(entry);
  if (useCache && reusable) return { ...entry, fromCache: true };

  const result = await fetcher();
  cache[key] ??= {};
  if (isTransientFailure(result)) {
    // Leave no trace, so the next run treats this title as never attempted.
    delete cache[key][provider];
    if (!Object.keys(cache[key]).length) delete cache[key];
  } else {
    cache[key][provider] = { ...result, fetchedAt: new Date().toISOString() };
  }
  return result;
}

async function enrich(item, cache, counters) {
  const key = canonical(item.title);

  // The imprint year bounds how new a matching release can plausibly be.
  const lookup = { maxYear: item.year ?? null };

  const mc = await cached(cache, key, 'metacritic', async () => {
    const found = await metacritic.findGame(item.title, lookup);
    if (!found.ok) return found;
    const credits = await metacritic.fetchCredits(found.slug);
    return { ...found, ...credits };
  });

  const times = await cached(cache, key, 'hltb', () => hltb.findGame(item.title, lookup));

  if (!mc.fromCache || !times.fromCache) await sleep(120);

  if (mc.ok) counters.metacriticHits++;
  else if (isTransientFailure(mc)) counters.metacriticErrors++;
  else counters.metacriticMisses.push(item.title);

  if (times.ok) counters.hltbHits++;
  else if (isTransientFailure(times)) counters.hltbErrors++;
  else counters.hltbMisses.push(item.title);

  const party = classifyParty({ title: item.title, metacriticPublishers: mc.publishers ?? [] });
  const metascore = mc.ok ? mc.score ?? null : null;
  const hoursMainExtra = times.ok ? times.mainExtra ?? null : null;

  return {
    title: item.title,
    libraryUrl: item.link,
    biblionumber: item.biblionumber,
    copies: item.copies,
    acquiredYear: item.year,
    firstParty: party.firstParty,
    partySource: party.source,
    partyEvidence: party.evidence,
    publishers: mc.publishers ?? [],
    developers: mc.developers ?? [],
    metascore,
    metascoreIsSwitch: mc.ok ? Boolean(mc.scoreIsSwitch) : false,
    metacriticTitle: mc.ok ? mc.title : null,
    metacriticUrl: mc.ok ? mc.url : null,
    metacriticMatchScore: mc.ok ? mc.matchScore : null,
    hoursMain: times.ok ? times.main ?? null : null,
    hoursMainExtra,
    hoursCompletionist: times.ok ? times.completionist ?? null : null,
    hltbTitle: times.ok ? times.title : null,
    hltbUrl: times.ok ? times.url : null,
    hltbMatchScore: times.ok ? times.matchScore : null,
    releaseYear: (mc.ok ? mc.releaseYear : null) ?? (times.ok ? times.releaseYear : null) ?? null,
    genres: mc.ok ? mc.genres ?? [] : [],
    density: densityScore(metascore, hoursMainExtra),
  };
}

async function main() {
  const startedAt = Date.now();

  log(`Fetching library catalogue…\n  ${LIBRARY_RSS_URL}`);
  const { items, unique } = await fetchLibraryCatalogue();
  log(`  ${items.length} records -> ${unique.length} distinct titles`);

  const targets = limit ? unique.slice(0, limit) : unique;
  if (limit) log(`  --limit ${limit}: processing ${targets.length}`);

  const cache = useCache ? await loadCache() : {};
  const cacheEntriesBefore = Object.keys(cache).length;
  log(`Cache: ${cacheEntriesBefore} titles known${useCache ? '' : ' (bypassed)'}`);

  const counters = {
    metacriticHits: 0, hltbHits: 0,
    metacriticMisses: [], hltbMisses: [],
    metacriticErrors: 0, hltbErrors: 0,
  };
  let done = 0;

  const games = await pool(targets, CONCURRENCY, async (item) => {
    const game = await enrich(item, cache, counters);
    done++;
    if (done % 25 === 0 || done === targets.length) {
      log(`  ${done}/${targets.length} — MC ${counters.metacriticHits}, HLTB ${counters.hltbHits}`);
    }
    return game;
  });

  games.sort((a, b) => (b.density ?? -1) - (a.density ?? -1) || a.title.localeCompare(b.title));

  const complete = games.filter((game) => game.density != null);
  const database = {
    generatedAt: new Date().toISOString(),
    source: { library: LIBRARY_RSS_URL, records: items.length, titles: unique.length },
    density: { formula: DENSITY_FORMULA, scoreFloor: SCORE_FLOOR, timeExponent: TIME_EXPONENT },
    stats: {
      titles: games.length,
      withMetascore: games.filter((game) => game.metascore != null).length,
      withPlaytime: games.filter((game) => game.hoursMainExtra != null).length,
      complete: complete.length,
      firstParty: games.filter((game) => game.firstParty).length,
    },
    games,
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(GAMES_PATH, `${JSON.stringify(database, null, 2)}\n`);
  await writeFile(CACHE_PATH, `${JSON.stringify({ version: CACHE_VERSION, entries: cache }, null, 2)}\n`);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  log('\n' + '='.repeat(60));
  log(`Wrote ${games.length} titles to data/games.json in ${seconds}s`);
  log(`  Metacritic score : ${database.stats.withMetascore}/${games.length}`);
  log(`  HLTB playtime    : ${database.stats.withPlaytime}/${games.length}`);
  log(`  Both (ranked)    : ${complete.length}/${games.length}`);
  log(`  First-party      : ${database.stats.firstParty}`);

  const errors = counters.metacriticErrors + counters.hltbErrors;
  if (errors) {
    log(
      `\n⚠ ${errors} lookup(s) failed for transient reasons ` +
      `(Metacritic ${counters.metacriticErrors}, HowLongToBeat ${counters.hltbErrors}) — ` +
      'usually rate limiting. These titles were NOT cached as missing; re-run to fill them in.',
    );
  }

  if (counters.metacriticMisses.length) {
    log(`\nNo Metacritic match (${counters.metacriticMisses.length}):`);
    for (const title of counters.metacriticMisses.slice(0, 40)) log(`  - ${title}`);
    if (counters.metacriticMisses.length > 40) log(`  … ${counters.metacriticMisses.length - 40} more`);
  }
  if (counters.hltbMisses.length) {
    log(`\nNo HowLongToBeat match (${counters.hltbMisses.length}):`);
    for (const title of counters.hltbMisses.slice(0, 40)) log(`  - ${title}`);
    if (counters.hltbMisses.length > 40) log(`  … ${counters.hltbMisses.length - 40} more`);
  }
  log('\nLocalised titles that miss can be mapped in scripts/lib/aliases.mjs');
}

main().catch((error) => {
  console.error('\nBuild failed:', error);
  process.exit(1);
});

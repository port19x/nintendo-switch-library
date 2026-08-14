/**
 * HowLongToBeat lookup.
 *
 * HLTB's search sits behind a short anti-bot handshake (verified against the
 * live site):
 *   1. GET  /api/bleed/init?t=<ms>  -> { token, hpKey, hpVal }
 *   2. POST /api/bleed              headers x-auth-token / x-hp-key / x-hp-val,
 *                                   body = search payload + { [hpKey]: hpVal }
 *   3. a 403 means either a stale token or rate limiting — re-issue the token and
 *      retry behind a growing backoff.
 *
 * The token encodes the client IP and User-Agent, so every request in a session
 * must use the same User-Agent (see http.mjs).
 */

import { request, requestJson, sleep } from './http.mjs';
import { searchVariants, bestMatch, YEAR_GRACE } from './normalize.mjs';

const BASE = 'https://howlongtobeat.com';

const browserHeaders = {
  referer: `${BASE}/`,
  origin: BASE,
  accept: '*/*',
};

let session = null;
let sessionInFlight = null;

/**
 * Single-flight init: a security token is bound to one client, and concurrent
 * handshakes invalidate each other. Without this guard, parallel callers each
 * mint a token, all but the last become stale, and searches start 403-ing.
 */
async function initSession(force = false) {
  if (session && !force) return session;
  sessionInFlight ??= (async () => {
    try {
      const fresh = await requestJson(`${BASE}/api/bleed/init?t=${Date.now()}`, {
        headers: browserHeaders,
        timeout: 30_000,
        retries: 3,
      });
      if (!fresh?.token) throw new Error('HLTB init returned no token');
      session = fresh;
      return session;
    } finally {
      sessionInFlight = null;
    }
  })();
  return sessionInFlight;
}

/**
 * HLTB rejects concurrent searches sharing a token, so requests are queued and
 * spaced regardless of how much parallelism the caller uses.
 */
const REQUEST_GAP_MS = Number(process.env.HLTB_GAP_MS || 400);
let queue = Promise.resolve();

function enqueue(task) {
  const result = queue.then(task, task);
  queue = result.then(() => sleep(REQUEST_GAP_MS), () => sleep(REQUEST_GAP_MS));
  return result;
}

function buildPayload(terms, security) {
  const payload = {
    searchType: 'games',
    searchTerms: terms,
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { min: '', max: '' },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  };
  if (security?.hpKey) payload[security.hpKey] = security.hpVal;
  return payload;
}

/**
 * HLTB splits the query on whitespace and requires every term to appear.
 *
 * The catalogue writes subtitles as "Trine 4 - The Nightmare Prince", so a naive
 * split sends "-" as its own term — and the only Trine 4 entries containing a
 * hyphen are the DLCs ("… - Toby's Dream", 0.4h). The base game is filtered out
 * of its own search. Terms with no alphanumerics are therefore dropped.
 */
export function searchTerms(query) {
  return query.split(/\s+/).filter((term) => /[\p{L}\p{N}]/u.test(term));
}

/**
 * A 403 means either a stale token or rate limiting, and they are
 * indistinguishable from the response. Re-issuing the token fixes the first;
 * only waiting fixes the second, so the delay grows with consecutive refusals
 * and decays once requests succeed again. Without this, a rate limit part-way
 * through a run turns into hundreds of titles recorded as "not on HowLongToBeat".
 */
const MAX_403_ATTEMPTS = 4;
const BACKOFF_START_MS = 5_000;
const BACKOFF_CEILING_MS = 90_000;
let backoffMs = 0;

async function searchDirect(query, attempt = 0) {
  if (backoffMs) await sleep(backoffMs);
  const security = await initSession();
  const terms = searchTerms(query);

  const res = await request(`${BASE}/api/bleed`, {
    method: 'POST',
    timeout: 30_000,
    retries: 2,
    headers: {
      ...browserHeaders,
      'content-type': 'application/json',
      'x-auth-token': security.token,
      'x-hp-key': security.hpKey,
      'x-hp-val': security.hpVal,
    },
    body: JSON.stringify(buildPayload(terms, security)),
  });

  if (res.status === 403) {
    if (attempt >= MAX_403_ATTEMPTS) throw new Error('HLTB search HTTP 403 (rate limited)');
    backoffMs = Math.min(backoffMs ? backoffMs * 2 : BACKOFF_START_MS, BACKOFF_CEILING_MS);
    await initSession(true);
    return searchDirect(query, attempt + 1);
  }
  if (!res.ok) throw new Error(`HLTB search HTTP ${res.status}`);

  backoffMs = backoffMs > BACKOFF_START_MS ? Math.floor(backoffMs / 2) : 0;
  const payload = await res.json();
  return payload?.data ?? [];
}

const searchOnce = (query) => enqueue(() => searchDirect(query));

const toHours = (seconds) => (typeof seconds === 'number' && seconds > 0 ? Number((seconds / 3600).toFixed(1)) : null);

/**
 * Look up playtimes for a catalogue title.
 * `mainExtra` (HLTB's "Main + Extra") is what the site ranks on.
 */
export async function findGame(title, { maxYear = null } = {}) {
  const tried = [];
  for (const variant of searchVariants(title)) {
    tried.push(variant);
    let candidates;
    try {
      candidates = await searchOnce(variant);
    } catch (error) {
      // Transient: the game may well be there, we just could not ask.
      return { ok: false, transient: true, error: `search failed: ${error.message}`, tried };
    }
    if (!candidates?.length) continue;

    // A library copy cannot predate the game. Without this, "Nintendo World
    // Championships" (acquired 2024) matches the 1990 NES competition cart and
    // inherits its 12-minute playtime.
    let plausible = candidates;
    if (maxYear) {
      const withinYear = candidates.filter(
        (game) => !game.release_world || game.release_world <= maxYear + YEAR_GRACE,
      );
      if (withinYear.length) plausible = withinYear;
    }

    const hit = bestMatch(title, plausible, (game) => game.game_name);
    if (!hit) continue;

    const game = hit.match;
    return {
      ok: true,
      matchScore: hit.score,
      matchedVariant: variant,
      id: game.game_id,
      title: game.game_name,
      main: toHours(game.comp_main),
      mainExtra: toHours(game.comp_plus),
      completionist: toHours(game.comp_100),
      releaseYear: game.release_world ?? null,
      url: game.game_id ? `${BASE}/game/${game.game_id}` : null,
      tried,
    };
  }
  return { ok: false, error: 'no match', tried };
}

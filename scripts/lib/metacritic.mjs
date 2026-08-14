/**
 * Metacritic lookup via the public backend that powers metacritic.com itself.
 *
 *   search: /finder/metacritic/search/<query>/web  -> title, slug, score, platforms
 *   detail: /composer/metacritic/pages/games/<slug>/web -> production.companies
 *
 * The API key below is the one embedded in Metacritic's own web client. Override
 * with METACRITIC_API_KEY if it ever rotates.
 */

import { requestJson } from './http.mjs';
import { searchVariants, bestMatch, similarity, YEAR_GRACE } from './normalize.mjs';

const API_KEY = process.env.METACRITIC_API_KEY || '1MOZgmNFxvmljaQR1X9KAij9Mo4xAY3u';
const BACKEND = 'https://backend.metacritic.com';

const searchUrl = (query) =>
  `${BACKEND}/finder/metacritic/search/${encodeURIComponent(query)}/web` +
  `?apiKey=${API_KEY}&offset=0&limit=20&mcoTypeId=13` +
  `&componentName=search&componentDisplayName=Search&componentType=SearchResults`;

const detailUrl = (slug) =>
  `${BACKEND}/composer/metacritic/pages/games/${encodeURIComponent(slug)}/web?apiKey=${API_KEY}`;

/**
 * Metacritic reports 0 for a title with no critic reviews yet. That is "unrated",
 * not "terrible" — collapse it to null so unrated games sort as unknown rather
 * than beating nothing.
 */
const realScore = (value) => (typeof value === 'number' && value > 0 ? value : null);

/** Prefer the Switch entry when a title exists on several platforms. */
function switchScore(item) {
  const platforms = item?.platforms ?? [];
  const nintendo = platforms.find((platform) => /nintendo switch/i.test(platform?.name ?? ''));
  return realScore(nintendo?.criticScoreSummary?.score);
}

function isSwitchRelease(item) {
  return (item?.platforms ?? []).some((platform) => /nintendo switch/i.test(platform?.name ?? ''));
}

async function searchOnce(query) {
  const payload = await requestJson(searchUrl(query), { timeout: 30_000, retries: 3 });
  const items = payload?.data?.items ?? [];
  return items.filter((item) => item?.type === 'game-title' && item?.title);
}

/**
 * Find the Metacritic record for a catalogue title.
 * Tries progressively looser query variants; prefers Switch releases and, among
 * equally-good title matches, the one that actually has a critic score.
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
    if (!candidates.length) continue;

    // Every game on this shelf is a Switch release, so when the search offers any
    // Switch candidate, ignore the rest — that is what stops a bare "Street
    // Fighter" from resolving to a non-Switch entry in the series. When no
    // candidate reports Switch (Metacritic's platform data is patchy), keep all
    // of them rather than losing the title.
    const onSwitch = candidates.filter(isSwitchRelease);
    let plausible = onSwitch.length ? onSwitch : candidates;

    // A candidate released well after the shelf catalogued its copy is the wrong
    // entry in a long-running series (see YEAR_GRACE for why it is not exact).
    if (maxYear) {
      const withinYear = plausible.filter(
        (item) => !item.premiereYear || item.premiereYear <= maxYear + YEAR_GRACE,
      );
      if (withinYear.length) plausible = withinYear;
    }

    const hit = bestMatch(title, plausible, (item) => item.title);
    if (!hit) continue;

    const item = hit.match;
    return {
      ok: true,
      matchScore: hit.score,
      matchedVariant: variant,
      title: item.title,
      slug: item.slug,
      score: switchScore(item) ?? realScore(item?.criticScoreSummary?.score),
      scoreIsSwitch: switchScore(item) != null,
      releaseYear: item?.premiereYear ?? null,
      genres: (item?.genres ?? []).map((genre) => genre?.name).filter(Boolean),
      platforms: (item?.platforms ?? []).map((platform) => platform?.name).filter(Boolean),
      url: item.slug ? `https://www.metacritic.com/game/${item.slug}/` : null,
      tried,
    };
  }
  return { ok: false, error: 'no match', tried };
}

/** Publisher/developer credits — the authoritative first-party signal. */
export async function fetchCredits(slug) {
  try {
    const payload = await requestJson(detailUrl(slug), { timeout: 30_000, retries: 2 });
    const item = payload?.components?.find((component) => component?.data?.item)?.data?.item;
    const companies = item?.production?.companies ?? [];
    const pick = (typeName) =>
      companies.filter((company) => company?.typeName === typeName).map((company) => company.name).filter(Boolean);
    return {
      publishers: [...new Set(pick('Publisher'))],
      developers: [...new Set(pick('Developer'))],
      franchises: (item?.gameTaxonomy?.franchises ?? []).map((franchise) => franchise?.name).filter(Boolean),
    };
  } catch {
    return { publishers: [], developers: [], franchises: [] };
  }
}

export { similarity };

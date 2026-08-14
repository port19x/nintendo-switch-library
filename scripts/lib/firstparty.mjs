/**
 * First-party (Nintendo-published) vs third-party classification.
 *
 * Deliberately does NOT trust the library's publisher field: Nintendo of Europe
 * distributes many third-party physical carts in Germany, so the catalogue
 * credits "Frankfurt Nintendo" for games like Cuphead, Tunic and Bugsnax. Using
 * it would mislabel ~50 third-party games as first-party.
 *
 * Order of evidence:
 *   1. Metacritic's Publisher credit  — authoritative
 *   2. Nintendo-owned franchise names — for titles Metacritic could not resolve
 *   3. default: third-party
 */

import { canonical } from './normalize.mjs';

/** Publishers that make a game first-party. */
const FIRST_PARTY_PUBLISHER = /\b(nintendo|the pok[eé]mon company|pokemon company)\b/i;

/**
 * Nintendo-owned franchises. Used only when Metacritic has no publisher credit,
 * so it is intentionally conservative — franchise names that Nintendo does not
 * own (Rabbids, Yo-kai Watch, Layton…) must never appear here.
 */
const FIRST_PARTY_FRANCHISE = new RegExp(
  [
    'super mario', 'mario kart', 'mario party', 'mario tennis', 'mario golf', 'mario strikers',
    'paper mario', 'dr mario', 'mario vs donkey kong', 'luigis mansion', 'new super mario',
    'the legend of zelda', 'hyrule', 'zelda',
    'pokemon', 'pokken', 'detective pikachu',
    'splatoon', 'kirby', 'metroid', 'xenoblade', 'fire emblem', 'animal crossing',
    'pikmin', 'donkey kong', 'yoshi', 'wario', 'star fox', 'f zero', 'smash bros',
    'advance wars', 'endless ocean', 'another code', 'princess peach', 'game builder garage',
    'big brain academy', 'brain training', 'clubhouse games', 'nintendo switch sports',
    'ring fit', '1 2 switch', 'nintendo world championships', 'miitopia', 'tomodachi',
    'bayonetta', 'astral chain', 'daemon x machina', 'snipperclips', 'nintendo labo',
    'captain toad', 'part time ufo', 'good job', 'emio',
  ].join('|'),
  'i',
);

/** Franchises that look Nintendo-ish but are published by someone else. */
const THIRD_PARTY_OVERRIDE = /\b(rabbids?|nickelodeon kart|mario and sonic at the olympic)\b/i;

/**
 * @param {{title: string, metacriticPublishers?: string[]}} input
 * @returns {{firstParty: boolean, source: string, evidence: string}}
 */
export function classifyParty({ title, metacriticPublishers = [] }) {
  const canonicalTitle = canonical(title);

  if (THIRD_PARTY_OVERRIDE.test(canonicalTitle)) {
    return { firstParty: false, source: 'override', evidence: 'known third-party franchise' };
  }

  const nintendoPublisher = metacriticPublishers.find((publisher) => FIRST_PARTY_PUBLISHER.test(publisher));
  if (nintendoPublisher) {
    return { firstParty: true, source: 'metacritic', evidence: nintendoPublisher };
  }
  if (metacriticPublishers.length) {
    return { firstParty: false, source: 'metacritic', evidence: metacriticPublishers.join(', ') };
  }

  const franchise = canonicalTitle.match(FIRST_PARTY_FRANCHISE);
  if (franchise) {
    return { firstParty: true, source: 'franchise', evidence: franchise[0] };
  }

  return { firstParty: false, source: 'default', evidence: 'no Nintendo signal' };
}

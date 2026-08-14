/**
 * Library catalogue records are bibliographic, not commercial: titles carry ISBD
 * punctuation, statements of responsibility, media designators and German
 * boilerplate. This module turns them into something you can search a games
 * database with, and scores candidate matches.
 */

import { TITLE_ALIASES } from './aliases.mjs';

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', ecirc: 'ê', uacute: 'ú', oacute: 'ó', aacute: 'á',
  iacute: 'í', ntilde: 'ñ', ccedil: 'ç', deg: '°', hellip: '…', mdash: '—', ndash: '–',
};

export function decodeEntities(input = '') {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name] ?? match);
}

/** Words that mark a parenthesised segment as a media/platform designator, not part of the title. */
const MEDIA_HINT =
  /nintendo|switch|konsolenspiel|computerspiel|videospiel|spiel|software|dvd|blu-?ray|cd-?rom|medienkombination|elektronische ressource|game|usk|pegi/i;

/**
 * Trailing noise commonly appended to catalogue titles.
 *
 * Each pattern requires whitespace before the separator, so a hyphen that is
 * part of the name survives: "1-2-Switch" must not become "1-2", while
 * "Mario Kart 8 - Nintendo Switch" still loses its suffix.
 */
const TRAILING_NOISE = [
  /\s+[-–—:]?\s*(f[üu]r\s+)?nintendo\s+switch(\s*2)?\s*$/i,
  /\s+[-–—:]?\s*switch(\s*2)?\s*$/i,
  /\s+[-–—:]?\s*(konsolen|video|computer)spiel\s*$/i,
  /\s+[-–—:]?\s*(deutsche?|englische?)\s+(version|fassung)\s*$/i,
  /\s+[-–—:]?\s*(standard|d[ei]gital|physical)\s+(edition|version)\s*$/i,
];

/** Acute accents and typographic quotes stand in for apostrophes in this catalogue. */
const APOSTROPHES = /[´`‘’ʼ']/g;

/**
 * Reduce a catalogue title to the commercial game title.
 * "Zelda : tears of the kingdom [Konsolenspiel] / Nintendo" -> "Zelda: tears of the kingdom"
 */
export function cleanTitle(raw = '') {
  let title = decodeEntities(String(raw)).replace(/\s+/g, ' ').trim();

  // Statement of responsibility: everything after " / " is author/publisher.
  title = title.split(/\s+\/\s+/)[0];

  // Square brackets in this catalogue always hold a German spelling-out of the
  // preceding numeral ("Xenoblade Chronicles 2 [zwei]", "Skyrim V [fünf]"), so
  // they are always noise.
  title = title.replace(/\s*\[[^\]]*\]/g, '');
  // Parentheses can be part of a real title, so only drop media designators.
  title = title.replace(/\s*\(([^)]*)\)/g, (match, inner) => (MEDIA_HINT.test(inner) ? '' : match));

  // ISBD punctuation: " : " subtitle separator, " ; " series separator.
  title = title.replace(/\s+;\s+.*$/, '');
  title = title.replace(/\s+:\s+/g, ': ');

  for (const pattern of TRAILING_NOISE) title = title.replace(pattern, '');

  // Dangling ISBD punctuation left behind by the strips above.
  title = title.replace(/[\s.,:;/–—-]+$/, '').replace(/^[\s.,:;/–—-]+/, '');

  return title.replace(/\s+/g, ' ').trim();
}

/** Fold to a comparable form: lowercase, accent-free, punctuation-free tokens. */
export function canonical(input = '') {
  return decodeEntities(String(input))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Alias table keyed by canonical form, built lazily so `canonical` is defined by
 * the time it runs. Canonicalising the keys here means aliases.mjs can spell
 * them naturally ("BRATZ Rhythmus & stil") without having to predict how
 * `canonical` folds punctuation.
 */
let aliasIndex = null;

export function aliasFor(title) {
  aliasIndex ??= new Map(
    Object.entries(TITLE_ALIASES).map(([german, english]) => [canonical(german), english]),
  );
  return aliasIndex.get(canonical(title));
}

/** Filler words that should not drive a title match. */
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'for', 'das', 'der', 'die', 'ein', 'eine', 'und']);

/**
 * Sequel indices show up as digits, roman numerals and spelled-out words across
 * the three sources ("Xenoblade Chronicles 2", "Civilization VII", "Story Mode -
 * Season Two"), so they are all folded to digits before comparison.
 */
const NUMERALS = {
  i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6',
  vii: '7', viii: '8', ix: '9', x: '10', xi: '11', xii: '12',
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
  seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
  // German forms arrive accent-stripped by `canonical` ("fünf" -> "funf").
  eins: '1', zwei: '2', drei: '3', vier: '4', funf: '5', sechs: '6',
  sieben: '7', acht: '8', neun: '9', zehn: '10', elf: '11', zwolf: '12',
};

function tokens(input) {
  return canonical(input)
    .split(' ')
    .filter(Boolean)
    .map((token) => NUMERALS[token] ?? token)
    .filter((token) => !STOPWORDS.has(token));
}

/**
 * How far past the library's imprint year a release may still be the same game.
 * Imprint years lag: Skyward Sword sits under a 2019 record though the Switch
 * remaster is from 2021. Two years still rejects Street Fighter 6 (2023) for a
 * record catalogued in 2018.
 */
export const YEAR_GRACE = 2;

/** Purely numeric tokens — the ones that carry sequel/edition identity. */
function numerals(tokenList) {
  return new Set(tokenList.filter((token) => /^\d+$/.test(token)));
}

/**
 * True when the candidate introduces a number our title never mentions — the
 * signature of a different entry in the same series ("Splatoon 3" offered
 * "Splatoon 2", a bare "Street Fighter" offered "Street Fighter 6").
 *
 * Deliberately one-directional. Catalogue titles trail marketing copy full of
 * numbers ("Just Dance 2018 40 neue Hits ... 300 Songs"), and penalising those
 * for numbers the real title simply does not carry rejects correct matches.
 */
function introducesNumeral(targetTokens, candidateTokens) {
  const ours = numerals(targetTokens);
  return [...numerals(candidateTokens)].some((value) => !ours.has(value));
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Similarity in [0,1] between a catalogue title `a` and a database candidate `b`.
 *
 * Token coverage is deliberately *asymmetric*, because the two directions mean
 * different things:
 *
 *   - Tokens of ours the candidate is missing are damning. "Minecraft: Story
 *     Mode 2" against plain "Minecraft" drops three distinguishing tokens, and a
 *     symmetric measure would score it 1.0 because every token of the shorter
 *     side matched.
 *   - Extra tokens in the candidate are usually harmless — a subtitle or a
 *     publisher prefix ("Civilization VII" -> "Sid Meier's Civilization VII",
 *     "Mario Kart 8" -> "Mario Kart 8 Deluxe").
 *
 * So coverage of *our* tokens carries most of the weight, and edit distance
 * carries the rest to absorb spelling variants ("Pokemon"/"Pokémon",
 * "Superstar"/"Superstars").
 */
export function similarity(a, b) {
  const canonicalA = canonical(a);
  const canonicalB = canonical(b);
  if (!canonicalA || !canonicalB) return 0;
  if (canonicalA === canonicalB) return 1;

  const tokensA = tokens(a);
  const tokensB = tokens(b);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (!setA.size || !setB.size) return 0;

  const shared = [...setA].filter((token) => setB.has(token)).length;
  const coverageOfTarget = shared / setA.size;
  const coverageOfCandidate = shared / setB.size;
  const coverage = 0.7 * coverageOfTarget + 0.3 * coverageOfCandidate;

  const edit = 1 - levenshtein(canonicalA, canonicalB) / Math.max(canonicalA.length, canonicalB.length);
  const score = 0.6 * coverage + 0.4 * Math.max(0, edit);

  // Sequel numbers are identity, not decoration: Splatoon 2 is not Splatoon 3,
  // and a bare "Street Fighter" is not "Street Fighter 6". Textually these pairs
  // are near-identical, so only an explicit numeral check separates them.
  // Edition words ("30th Anniversary") are not bare numerals and stay unaffected.
  return introducesNumeral(tokensA, tokensB) ? score * 0.55 : score;
}

/**
 * Query variants, most specific first. Databases index commercial titles, so we
 * progressively shed subtitles and edition markers until something hits.
 */
export function searchVariants(title) {
  const variants = [];
  const push = (value) => {
    const trimmed = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (trimmed.length >= 2 && !variants.some((existing) => canonical(existing) === canonical(trimmed))) {
      variants.push(trimmed);
    }
  };

  const base = cleanTitle(title);

  // A known localised title beats every derived variant.
  const alias = aliasFor(base);
  if (alias) push(alias);

  push(base);
  push(base.replace(/[™®©]/g, ''));

  // "Sid Meier´s" / "Let´s Sing" — the databases index a plain apostrophe, and
  // some of their search backends tokenise the accented form badly.
  push(base.replace(APOSTROPHES, "'"));
  push(base.replace(APOSTROPHES, ''));

  // Drop edition/DLC markers.
  const withoutEdition = base.replace(
    /\s*[-–—:,]?\s*\b(deluxe|definitive|complete|remastered?|remake|gold|special|standard|limited|collector'?s?|anniversary|hd|switch)\s+(edition|version)\b/gi,
    '',
  );
  push(withoutEdition);

  // Leading article moved to the front ("Legend of Zelda, The").
  const inverted = base.match(/^(.*),\s*(the|a|an|das|der|die)$/i);
  if (inverted) push(`${inverted[2]} ${inverted[1]}`);

  // Main title only (before the first colon / dash subtitle).
  const colonSplit = base.split(/\s*:\s*/)[0];
  push(colonSplit);
  const dashSplit = base.split(/\s+[-–—]\s+/)[0];
  push(dashSplit);

  // Accent-free spelling ("Pokémon" -> "Pokemon").
  push(base.normalize('NFD').replace(/[̀-ͯ]/g, ''));

  // Last resort for verbose records: just the opening words.
  const prefix = leadingPhrase(base);
  if (prefix) push(prefix);

  return variants;
}

/**
 * Long catalogue records append sales copy to the real title — "Just Dance 2018
 * 40 neue Hits & Zugang zu über 300 Songs" is one record. Since coverage of our
 * tokens is what carries a match, that copy makes the true entry ("Just Dance
 * 2018") look wrong. For records long enough to be carrying such a tail, the
 * opening words are offered as an additional acceptable form.
 *
 * Gated on length so it never loosens a short title: "Minecraft: Story Mode 2"
 * is four words and keeps rejecting plain "Minecraft".
 */
const MARKETING_TAIL_TOKENS = 6;
const TITLE_PREFIX_WORDS = 4;

function leadingPhrase(title) {
  // Gate on *significant* tokens, not raw words. "The Legend of Zelda - Skyward
  // Sword" is seven words but only four real tokens; offering "The Legend of
  // Zelda" as a target would match the 1986 original at 1.0.
  if (tokens(title).length <= MARKETING_TAIL_TOKENS) return null;
  const words = title.split(/\s+/).filter(Boolean);
  return words.slice(0, TITLE_PREFIX_WORDS).join(' ').replace(/[\s.,:;/–—-]+$/, '');
}

/**
 * Every title form we would accept a match against: the cleaned catalogue title,
 * its localised English name when we know one, and — for verbose records — its
 * opening words. A German title like "Pokémon - Karmesin" scores ~0 against
 * "Pokémon Scarlet", so without the alias as an accepted target the correct hit
 * would be rejected.
 */
export function matchTargets(title) {
  const base = cleanTitle(title);
  const targets = [base];
  const alias = aliasFor(base);
  if (alias) targets.push(alias);
  const prefix = leadingPhrase(base);
  if (prefix) targets.push(prefix);
  return targets;
}

/**
 * Pick the best candidate above `threshold`, or null.
 * `target` may be a single title or several acceptable forms (see matchTargets).
 */
export function bestMatch(target, candidates, getTitle, threshold = 0.62) {
  const targets = Array.isArray(target) ? target : matchTargets(target);
  let winner = null;
  let winnerScore = 0;
  for (const candidate of candidates) {
    const candidateTitle = getTitle(candidate);
    if (!candidateTitle) continue;
    const score = Math.max(...targets.map((form) => similarity(form, candidateTitle)));
    if (score > winnerScore) {
      winnerScore = score;
      winner = candidate;
    }
  }
  return winnerScore >= threshold ? { match: winner, score: Number(winnerScore.toFixed(3)) } : null;
}

/**
 * Koha OPAC RSS reader for the Stadtbibliothek Karlsruhe Switch shelf.
 *
 * Real feed shape (verified against live data):
 *   <item>
 *     <title> Super Mario Bros. Wonder       </title>
 *     <dc:identifier>ISBN:  </dc:identifier>
 *     <link>https://opac.karlsruhe.de/cgi-bin/koha/opac-detail.pl?biblionumber=12345</link>
 *     <description> <p>Frankfurt Nintendo 2023 . 1 Cartridge</p>
 *                   <p><a href="...opac-reserve.pl?...">Place hold on <em>...</em></a></p>
 *     </description>
 *     <guid>...</guid>
 *   </item>
 *
 * The description's first paragraph is "<City> <Publisher> <Year> . <extent>",
 * optionally followed by ", Enthält: <bundled titles>".
 */

import { requestText } from './http.mjs';
import { decodeEntities, cleanTitle } from './normalize.mjs';

export const LIBRARY_RSS_URL =
  'https://opac.karlsruhe.de/cgi-bin/koha/opac-search.pl?&limit=mc-itype%2Cphr%3A17&limit=ccode%3A7507&count=1000&sort_by=acqdate_dsc&format=rss';

function stripCdata(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decodeEntities(stripCdata(match[1])).replace(/\s+/g, ' ').trim() : '';
}

function biblionumberFrom(link) {
  const match = String(link).match(/biblionumber=(\d+)/i);
  return match ? match[1] : null;
}

/**
 * Pull imprint details out of the rendered citation.
 *
 * NOTE: the publisher recorded here is the *distributor* of the physical cart.
 * Nintendo of Europe distributes many third-party Switch releases in Germany,
 * so this field says "Nintendo" for games like Cuphead and Tunic. It is kept
 * for reference but deliberately NOT used to decide first-party status —
 * see firstparty.mjs.
 */
function parseImprint(description) {
  const empty = { libraryPublisher: '', year: null, contains: '' };
  if (!description) return empty;

  // Keep only the first paragraph; the second is the "Place hold" link.
  const firstParagraph = description.split(/<p>\s*<a\s/i)[0];
  const text = firstParagraph.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return empty;

  const match = text.match(/^(.*?)\s(\d{4})\b(.*)$/);
  if (!match) return { ...empty, libraryPublisher: text.slice(0, 120) };

  const [, imprint, year, tail] = match;
  const contains = tail.match(/Enth[äa]lt:\s*(.+)$/i)?.[1]?.trim() ?? '';
  return { libraryPublisher: imprint.trim(), year: Number(year), contains };
}

export function parseRss(xml) {
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
  return blocks.map((block) => {
    const rawTitle = tag(block, 'title');
    const link = tag(block, 'link') || tag(block, 'guid');
    const description = tag(block, 'description');
    const imprint = parseImprint(description);
    return {
      rawTitle,
      title: cleanTitle(rawTitle),
      link,
      biblionumber: biblionumberFrom(link),
      ...imprint,
    };
  });
}

/** The shelf holds multiple copies/editions of the same game; collapse them. */
export function dedupe(items) {
  const seen = new Map();
  for (const item of items) {
    const key = item.title.toLowerCase();
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...item, copies: 1 });
      continue;
    }
    existing.copies += 1;
    // Prefer the most recent acquisition's metadata.
    if ((item.year ?? 0) > (existing.year ?? 0)) {
      existing.year = item.year;
      existing.link = item.link;
      existing.biblionumber = item.biblionumber;
    }
    if (!existing.libraryPublisher) existing.libraryPublisher = item.libraryPublisher;
  }
  return [...seen.values()];
}

export async function fetchLibraryCatalogue(url = LIBRARY_RSS_URL) {
  const xml = await requestText(url, { timeout: 90_000, retries: 4 });
  const items = parseRss(xml);
  if (!items.length) throw new Error('library RSS returned no <item> elements — feed format may have changed');
  return { xml, items, unique: dedupe(items) };
}

# Switch Shelf

A static browser for the ~500 Nintendo Switch games on the shelf at
[Stadtbibliothek Karlsruhe](https://stadtbibliothek.karlsruhe.de/), enriched with
Metacritic scores and HowLongToBeat playtimes so you can find **short games that
are actually good** before walking over to borrow one.

Two pieces, both hostable on GitHub Pages:

- **`data/games.json`** — a pregenerated database, rebuilt weekly by CI.
- **`site/index.html`** — a single self-contained page (no build step, no
  dependencies, no external requests) that fetches that JSON.

## The table

| Column | Meaning |
| --- | --- |
| Title | Library title, linking to its catalogue entry |
| Publisher | First-party (Nintendo-published) or third-party |
| Metacritic | Critic score, preferring the Switch release |
| Main + Extra | HowLongToBeat's "Main + Extra" playtime, in hours |
| Density | Quality per hour — see below |
| Open | Direct links to the library, Metacritic and HowLongToBeat |

Sort by clicking any column header; filter by title, publisher, minimum score,
maximum length, or "only fully rated". Filters and sort are mirrored into the
URL, so a view like *first-party games under 15 hours* is linkable.

### Density

```
density = (metascore − 50) / hours ^ 0.7
```

The brief is "short games that are at least decent", which is really two rules: a
quality floor, and diminishing tolerance for length. The floor at 50 means a
badly-reviewed game scores 0 however short it is. The exponent below 1 damps the
division so a 90-minute curiosity doesn't bury every excellent 10-hour game — at
0.7, a game twice as long needs about 1.6× the quality-above-floor to tie.

Real rows from the current database:

| Game | Score | Main + Extra | Density |
| --- | --- | --- | --- |
| Neva | 87 | 4.5 h | 12.9 |
| Untitled Goose Game | 81 | 4.1 h | 11.5 |
| Splatoon 3 | 83 | 14.5 h | 5.1 |
| Mario Kart 8 Deluxe | 92 | 22.7 h | 4.7 |
| Tears of the Kingdom | 96 | 117.2 h | 1.6 |

It is a ranking aid for this shelf, not an absolute rating. Both constants live
in `scripts/lib/density.mjs` if you want a different taste.

## Running it

```bash
npm run smoke     # first 20 titles, ~40s — good for checking the scrapers
npm run build     # full catalogue, ~15 min cold, seconds when cached
npm run serve     # assemble _site/ and serve at http://localhost:8080
```

`npm run build` sets `NODE_USE_ENV_PROXY=1`, which makes Node's `fetch` honour
`HTTPS_PROXY`. It's harmless when no proxy is set.

Useful flags: `--limit N`, `--no-cache`, `--retry-misses`.

## How it works

```
opac.karlsruhe.de RSS  ─┐
metacritic.com API     ─┼─> scripts/build.mjs ─> data/games.json ─> site/index.html
howlongtobeat.com API  ─┘                        data/cache.json
```

`scripts/lib/`:

| File | Responsibility |
| --- | --- |
| `rss.mjs` | Fetch and parse the Koha OPAC feed |
| `normalize.mjs` | Turn bibliographic titles into searchable ones; score matches |
| `aliases.mjs` | German → English title map for localised releases |
| `metacritic.mjs` | Score and publisher lookup |
| `hltb.mjs` | Playtime lookup |
| `firstparty.mjs` | First- vs third-party classification |
| `density.mjs` | The density formula |
| `http.mjs` | Retries, timeouts, bounded concurrency |

Some details worth knowing, all learned from the live data:

- **Library titles are bibliographic.** They carry statements of responsibility
  (`/ Nintendo`), ISBD punctuation, and German spellings-out of numerals
  (`Xenoblade Chronicles 2 [zwei]`). `normalize.mjs` strips these, then tries
  progressively looser query variants until a database matches.
- **The library's publisher field is the distributor.** Nintendo of Europe
  distributes many third-party physical carts in Germany, so the catalogue
  credits "Frankfurt Nintendo" for Cuphead, Tunic and Bugsnax. Using it would
  mislabel ~50 third-party games, so first-party status comes from Metacritic's
  publisher credit instead, falling back to a conservative list of
  Nintendo-owned franchises.
- **Metacritic reports `0` for unrated games.** That means "no reviews yet", not
  "terrible", so it is stored as `null` and those games sort as unknown.
- **Bare titles need guarding.** A shelf record reading just `Street Fighter`
  will happily fuzzy-match the wrong entry in a long series. Two filters fix
  this generically: candidates must be Switch releases when the database says so
  (everything on this shelf is), and a candidate cannot be released materially
  later than the year the library catalogued its copy. Together these are what
  keep `Street Fighter` (2018) off *Street Fighter 6*, and `Nintendo World
  Championships` (2024) off the 1990 NES competition cart and its 12-minute
  playtime. `metacriticMatchScore` / `hltbMatchScore` are kept in the JSON so
  remaining matches stay auditable.
- **HowLongToBeat requires a handshake.** `GET /api/bleed/init` yields a token
  bound to your IP and User-Agent, which `POST /api/bleed` then requires. Tokens
  don't survive concurrent use, so HLTB requests are queued and spaced
  internally — a caller can be as parallel as it likes.
- **Lookups are cached** in `data/cache.json` (45 days for hits, 7 for misses)
  and committed. A weekly rebuild only pays for newly acquired games, and an
  outage at Metacritic or HLTB degrades to "keep yesterday's data" rather than
  blanking the table.

Games that neither database covers stay in the table with blank cells rather
than being dropped — the shelf is the point, not the ranking.

### Unmatched titles

The build prints every title it couldn't match. Localised names are the usual
cause; add them to `scripts/lib/aliases.mjs` (keys are canonicalised, so write
them naturally) and rebuild. The rest are genuinely absent from the databases —
mostly licensed children's games.

## Deploying

`.github/workflows/build.yml` rebuilds the database on every push, weekly on
Mondays, and on demand, commits any changes, and deploys the site to Pages.

**One-time setup:** Settings → Pages → Source → **GitHub Actions**. Until that's
done the workflow checks for Pages, skips the deploy job with a notice, and
still builds and commits the database — no red builds while you decide. It
starts publishing on its own once the switch is flipped.

Two caveats worth knowing:

- Pages on a **private** repository requires a paid GitHub plan. On the free
  plan, make the repository public to publish it.
- The deploy job only runs on the **default branch**, so merge this branch to
  `main` to publish.

# Shortlist

A zero-dependency, static catalogue for discovering short, well-reviewed Nintendo Switch games available from Stadtbibliothek Karlsruhe. It can be hosted directly on GitHub Pages.

## Update the catalogue

```bash
npm run build:data
```

The generator downloads the library RSS feed, combines it with the curated ratings in `data/enrichment.json`, and writes `games.json`. The checked-in enrichment currently matches **336 titles to HowLongToBeat** and **306 titles to Metacritic**. Each entry retains the matched source title and direct source URL so questionable matches can be reviewed instead of becoming opaque numbers.

The playtime snapshot was matched against the March 2026 [HLTB Dataset Plugin export](https://github.com/johagan94/hltb-dataset-plugin). Metacritic values were matched from the [Metacritic games dataset](https://github.com/naufalzaid17/metacritic_games_2023_dataset) and its [2021–2025 supplement](https://github.com/Tijesunimi004/metacritic-games-stats-2021-2025), preferring Nintendo Switch-specific records. Metacritic and HowLongToBeat do not provide these values in the library feed, so missing or uncertain matches deliberately remain “Not rated.” Density is the Metacritic score divided by Main + Extras hours.

Serve the repository with any static server, for example `python3 -m http.server 8000`, then open <http://localhost:8000>.

## Tests

```bash
npm test
```

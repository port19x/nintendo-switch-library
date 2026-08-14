Initial version lives on the [arena-ai](https://github.com/port19x/nintendo-switch-library/tree/arena-ai) branch.\
The Claude code version is the default served, it lives on the [claude-code](https://github.com/port19x/nintendo-switch-library/tree/claude-code) branch.\
[Codex](https://github.com/port19x/nintendo-switch-library/tree/codex) also has a branch.

<details>
  <summary><i>left is Claude Code, right is Codex</i></summary>
  <img width="2048" height="1153" alt="image" src="https://github.com/user-attachments/assets/fe10580f-9d48-4789-87fb-7831c5820dca" /></details>
<details>
  <summary>Initial Version</summary>
  <img width="1263" height="748" alt="image" src="https://github.com/user-attachments/assets/63f45485-d9b2-4614-9f65-a344d3f8c3d5" />
</details>

## Prompt

```
## Application

I have a Nintendo Switch 2 and my [local library](https://stadtbibliothek.karlsruhe.de/) has a large catalogue of ca 500 Nintendo Switch games that are accessible via a [RSS file](https://opac.karlsruhe.de/cgi-bin/koha/opac-search.pl?&limit=mc-itype%2Cphr%3A17&limit=ccode%3A7507&count=1000&sort_by=acqdate_dsc&format=rss).

Before playing a game, I like to look it up on [Metacritic](https://www.metacritic.com/) as well as [Howlongtobeat](https://howlongtobeat.com/) as I like short games that are at least decent.

The goal of the website is to have a pregenerated static JSON database as well as a small self-contained web frontend that I can both host on GitHub pages.
The user interface should resemble a table with titles, first or third-party distinction, Metacritic score, Howlongtobeat playtime (main+extra), a density score, and a link to my local library index.
It should have filters and be sortable by column.
```

## Verdict

Regarding Claude Code vs Codex I can say the following:
Codex did a dirty two shot working for 15 minutes total using a clever shortcut by pulling open data sets.
Claude did an elegant one shot working for 2 hours, bunch of normalizations (spelling, german/english, editions), and thorough scraping.
Throughout all that Claude consumed 80% of it's 5 hour usage window.

The Claude version is superior, but Codex might still be better if you need a cheaper model and/or prefer interactive usage.

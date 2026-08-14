#!/usr/bin/env python3
"""Build the static game database from Karlsruhe library's RSS catalogue."""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FEED = ("https://opac.karlsruhe.de/cgi-bin/koha/opac-search.pl?"
        "limit=mc-itype%2Cphr%3A17&limit=ccode%3A7507&count=1000&"
        "sort_by=acqdate_dsc&format=rss")


def clean(value: str | None) -> str:
    return " ".join((value or "").split())


def slug(value: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.casefold()))


def parse_feed(raw: bytes, enrichment: dict) -> list[dict]:
    root = ET.fromstring(raw)
    games = []
    for item in root.findall("./channel/item"):
        title, link = clean(item.findtext("title")), clean(item.findtext("link"))
        if not title or not link:
            continue
        override = enrichment.get(title.casefold(), {})
        hours, score = override.get("hours"), override.get("score")
        games.append({
            "id": link.rsplit("=", 1)[-1], "title": title,
            "party": override.get("party", "third"), "score": score,
            "hours": hours, "density": round(score / hours, 1) if score and hours else None,
            "libraryUrl": link,
            "metacriticUrl": override.get("metacriticUrl", f"https://www.metacritic.com/search/{slug(title)}/"),
            "hltbUrl": override.get("hltbUrl", f"https://howlongtobeat.com/?q={urllib.parse.quote_plus(title)}"),
        })
    return list({game["id"]: game for game in games}.values())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, help="Use a local RSS file instead of downloading")
    parser.add_argument("--output", type=Path, default=ROOT / "games.json")
    args = parser.parse_args()
    enrichment = json.loads((ROOT / "data/enrichment.json").read_text())
    raw = args.input.read_bytes() if args.input else urllib.request.urlopen(FEED, timeout=30).read()
    games = parse_feed(raw, enrichment)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": FEED,
        "enrichmentSources": {
            "metacritic": "https://www.metacritic.com/",
            "howlongtobeat": "https://howlongtobeat.com/",
        },
        "densityDefinition": "Metacritic score divided by Main + Extras hours",
        "games": games,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(games)} games to {args.output}")


if __name__ == "__main__":
    main()

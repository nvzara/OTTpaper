# Attribution & licensing checklist

OTTpaper source code is **MIT** (see `LICENSE`). Everything below is third-party and is **not** covered by that license.

| What | Source | How it is used | Required credit (shown in-app) |
|---|---|---|---|
| Titles, overviews, cast, posters | [TMDB](https://www.themoviedb.org/) API | Fetched in the visitor's browser with the visitor's own API key; never redistributed or stored in this repo | "This product uses the TMDB API but is not endorsed or certified by TMDB." — footer, home notice, settings |
| Where-to-watch data | [JustWatch](https://www.justwatch.com/) via TMDB | Displayed only; link to TMDB watch page | "Streaming availability: JustWatch (via TMDB)" — footer, title page, settings |
| News headlines | Publishers' public RSS feeds (`news/feeds.json`) | Build step stores **headline, ≤220-char excerpt, link, source, date** only; always links to the original; no article text/images | Source name on every item + notice on the news page + settings |
| Streaming service names | Their owners | Text names only; **no logos**; links go to official home pages | "Not affiliated with any streaming service" — footer, settings |
| Icons | Drawn for this project | Inline SVG in `js/icons.js` | — |
| Fonts | Visitor's system fonts | No webfonts loaded, no third-party requests for fonts | — |

## Rules for contributors / the improvement loop

1. Never commit API keys, tokens, or personal data. The TMDB key lives only in the visitor's browser.
2. No third-party code, fonts, icons, images or text may be added without recording it here with its license; only MIT/BSD/ISC/Apache-2.0/CC0/OFL-compatible assets, and keep their notices.
3. Do not copy article bodies, images or full summaries from news sources; do not add a feed without checking that its terms allow headline syndication.
4. Do not use TMDB or streaming-service logos without checking their brand guidelines first.
5. Keep non-commercial: no ads, trackers, analytics or affiliate links.
6. Everything shown to the user from a third party carries its credit on the same screen or the footer.

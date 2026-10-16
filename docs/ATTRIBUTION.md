# Attribution & licensing checklist

OTTpaper source code is **MIT** (see `LICENSE`). Everything below is third-party and is **not** covered by that license.

| What | Source | How it is used | Required credit (shown in-app) |
|---|---|---|---|
| Titles, overviews, cast, posters | [TMDB](https://www.themoviedb.org/) API | Fetched in the visitor's browser with the visitor's own API key; never redistributed or stored in this repo | "This product uses the TMDB API but is not endorsed or certified by TMDB." — footer, home notice, settings |
| Where-to-watch data | [JustWatch](https://www.justwatch.com/) via TMDB | Displayed only; link to TMDB watch page | "Streaming availability: JustWatch (via TMDB)" — footer, title page, settings |
| News headlines | Publishers' public RSS feeds (`news/feeds.json`) | Build step stores **headline, ≤220-char excerpt, link, source, date** only; always links to the original; no article text/images | Source name on every item + notice on the news page + settings |
| Streaming service names | Their owners | Text names only; **no logos**; links go to official home pages | "Not affiliated with any streaming service" — footer, settings |
| Icons | Drawn for this project | Inline SVG in `js/icons.js`; app icon `icons/icon.svg` (original artwork, MIT) | — |
| Fonts (default "Newspaper" typeface) | Playfair Display © The Playfair Display Project Authors; Source Serif 4 © Adobe Systems Incorporated — both SIL OFL 1.1 | Self-hosted unmodified WOFF2 in `fonts/` with license texts (`fonts/OFL-*.txt`, `fonts/README.md`); no font CDN | Credits in Settings (cr6) + `fonts/` |
| Fonts (other choices) | Visitor's system fonts (serif / sans / mono, CJK) | Only named via CSS font stacks; nothing is shipped | — |

## API key safety (TMDB key = the only secret)

- Entered by the visitor, stored only in their browser (localStorage, or sessionStorage if "remember" is off); never in the repo, URL, logs or backups unless the box is ticked (off by default).
- CSP + `no-referrer` + `credentials: omit`; network only to `api.themoviedb.org`; no third-party scripts/fonts/analytics. Enforced by `tests/security.mjs`.

## Offline / PWA

`sw.js` caches only this site's own static files (network first, cache as offline fallback) and ignores all cross-origin requests, so TMDB calls and the API key never go through or into the cache. When adding a file under `js/`, `css/` or `fonts/`, list it in `SHELL` in `sw.js` and bump `CACHE` if old copies must be dropped (`tests/security.mjs` checks this).

## Rules for contributors / the improvement loop

1. Never commit API keys, tokens, or personal data. The TMDB key lives only in the visitor's browser.
2. No third-party code, fonts, icons, images or text may be added without recording it here with its license; only MIT/BSD/ISC/Apache-2.0/CC0/OFL-compatible assets, and keep their notices.
3. Do not copy article bodies, images or full summaries from news sources; do not add a feed without checking that its terms allow headline syndication.
4. Do not use TMDB or streaming-service logos without checking their brand guidelines first.
5. Keep non-commercial: no ads, trackers, analytics or affiliate links.
6. Everything shown to the user from a third party carries its credit on the same screen or the footer.

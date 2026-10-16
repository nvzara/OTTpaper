# OTTpaper roadmap

**Core:** OTT unified search — where-to-watch must stay fast, correct and easy.
**Identity:** a newspaper (paper tones, serif type, rules, columns). Polish over feature count.
**Rules:** see `docs/ATTRIBUTION.md` (licensing, credits, API-key safety). Before pushing, run
`node tests/i18n.mjs && node tests/news.mjs && node tests/security.mjs && node tests/advisor.mjs && node tests/tonight.mjs && node tests/filters.mjs && node tests/contrast.mjs && NODE_PATH=$(npm root -g) node tests/smoke.mjs`.
Keep en/ko/ja in sync; list new files under `js/`, `css/`, `fonts/` in `sw.js`.

## Implemented
- Unified search with "on my services" badge/filter, decade + sort filters, recent-search suggestions
- Newspaper design system across all screens (masthead + folio line, section index, section heads, kickers/decks/bylines, review stars, editor's-note empty states, quiet loading blocks, colophon, print edition)
- Title page laid out as a newspaper article: headline, deck, byline, "streaming in" line, photo + caption, fact sheet, where-to-watch listings by type, worldwide availability, trailer link, related titles
- Country editions of the news wire (per-country files; local-language and worldwide sections)
- Home front page: today's lead story, secondary stories, right rail (publisher's note, inside index, recently viewed, latest headlines), trending / popular / upcoming listings
- Tonight picker (type, mood, length; filtered to my services)
- Clippings (local watchlist) with subscription advisor and print edition
- Welcome onboarding, settings (country, language, services, theme, font, size), validated backup/restore
- Languages: English, Korean, Japanese (UI and TMDB content)
- Themes: ivory, white, black; bundled OFL fonts
- PWA: installable, offline app shell
- API key kept in the browser only; CSP; automated security, license and contrast checks

## Open items
- **Local-language news sources** (Korean, Japanese, …): the edition mechanism is ready (`editions` in `news/feeds.json`); sources must be added only after their terms permit headline syndication. Korean newspapers state that unlicensed reproduction is not allowed, so each outlet needs confirmation or permission first. Alternatives: official/open-licence sources.
- Voice search: not planned (browser speech APIs send audio to third parties).
- TMDB-backed search suggestions: not planned (would send keystrokes to TMDB).

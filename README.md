# OTTpaper

## Overview

OTTpaper is a personal, serverless web app for searching streaming (OTT) titles. Search a movie or TV show and see
which services offer it in your country (subscription / free / ad-supported / rent / buy). Hosted as a static site
on GitHub Pages.

**Bring your own token:** on first visit, open Settings and enter your own free
[TMDB API key or read-access token](https://www.themoviedb.org/settings/api). It is stored only in your browser
(localStorage) and sent only to TMDB. No key is committed to this repository, and no data is collected.

---

(한국어) OTT 통합 검색 웹앱 (개인용). 작품을 검색하면 국가별로 어느 OTT에서 볼 수 있는지(구독/무료/광고/대여/구매) 보여줍니다.
계획: [docs/PLAN.md](docs/PLAN.md)

## 사용
1. 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정, `main`에 푸시하면 자동 배포.
2. 사이트의 설정에서 [TMDB 무료 API 키](https://www.themoviedb.org/settings/api)를 입력(브라우저에만 저장).
3. 로컬 실행: `python3 -m http.server` 후 http://localhost:8000

## 출처
- This product uses the TMDB API but is not endorsed or certified by TMDB.
- 시청 제공 정보: JustWatch (TMDB watch providers 경유).

## Project layout

```
index.html           page shell (masthead with folio line, section index, colophon footer, CSP)
css/style.css        all styles: colour tokens per theme, type, newspaper components, responsive layout, print
sw.js, manifest.webmanifest, icons/   PWA: offline shell, install metadata, original app icon
fonts/               bundled OFL fonts (Playfair Display, Source Serif 4) + license texts
js/app.js            entry: page chrome text, router, service worker, shortcuts
js/ui.js             shared helpers: DOM, escaping, toast, theme, newspaper blocks (cards, section heads, stars, notes, loading)
js/views/            one file per screen: home, search, detail, tonight, clippings, news, settings
js/tmdb.js           TMDB API client + localStorage cache (the only place that builds API requests)
js/store.js          settings, history, clippings, backup/restore (validated), OTT/country lists
js/i18n.js           UI translations (en/ko/ja) + language detection
js/advisor.js        subscription advisor, "on my services", worldwide table, today's lead (pure logic)
js/tonight.js        "Tonight" picker logic     js/filters.js  search/news filters, trailer pick
js/icons.js          original inline SVG icons
scripts/             build-time tools: fetch-news.mjs (RSS -> news.json), rss.mjs (parser)
news/feeds.json      news sources + OTT keywords
docs/                PLAN.md, ROADMAP.md, ATTRIBUTION.md (third-party credits & licensing rules)
tests/               smoke (browser), i18n, news, security, advisor, tonight, filters, contrast
```

Pure-logic modules (advisor, tonight, filters, rss) have no DOM/network access and are unit-tested in Node.
After moving code between modules, run an `eslint` `no-undef`/`no-unused-vars` check (e.g. `npx eslint --no-config-lookup`-style temp config) to catch missing imports.

## Features

- First visit: welcome screen guides you through entering your own TMDB key, country and your OTT services; later visits open the main screen directly.
- Settings can be changed anytime; everything is stored in your browser only.
- Languages: English / 한국어 / 日本語. Defaults to the browser language (English if unsupported); can be changed in Settings. Titles, overviews and cast info are requested from TMDB in the selected language (English overview as fallback). Translations may contain awkward expressions.
- The Wire (News) by country edition: `news/news.<CC>.json` per country; local-language sources can be added per country in `news/feeds.json` (`editions`) once their terms are confirmed.
- The Wire is built by a GitHub Action every 3 hours from public RSS feeds (headline, short excerpt and link only) and is empty locally until the first deployment. Open it at `#/news`.
- Newspaper design on every screen: masthead with ears and a folio line (volume/issue, date, country edition), section index with a slim sticky bar, section heads with double rules, kickers / headlines / decks / bylines, review-style stars, photos printed in grey until hover, editor's-note empty states, colophon footer and a print stylesheet; dark mode is the night edition.
- Front page: today's lead with photo and lede, three secondary stories, a right rail (publisher's note — open on the first visit, then folded to one line — an "Inside" index, recently viewed titles, latest headlines from the Wire) and the listings tabs.
- Title page as an article: a "streaming in" line under the headline answers where to watch first; then photo + fact sheet, the story with a drop cap (Latin text) and end mark, a where-to-watch listings box, worldwide table and related titles.
- Settings as a printed form: country and services save as soon as they change; the API key is saved only with the Save button.
- Clippings: save titles from the title page; stored locally, included in backups, kept when you delete history. Press `/` anywhere to jump to search.
- Title pages: trailer link (opens YouTube in a new tab — no embeds, nothing loaded from YouTube until you click) and a "You may also like" row of TMDB recommendations.
- Tonight (`#/tonight`): choose type, mood and length; OTTpaper asks TMDB for popular titles available on *your* services (TMDB's own provider filter) and picks one; "Another one" re-rolls.
- Today's lead: a front-page story on Home, one pick per day from trending titles, preferring ones on your own services.
- Accessibility: contrast of every theme is checked automatically (WCAG AA), keyboard skip link, labelled section links, selected options marked by underline or check (not colour alone), reduced-motion support; friendly offline / rate-limit messages.
- Search suggestions from your own recent searches (browser datalist), "skip to content" link, and a print edition of your clippings (print stylesheet).
- Search filters: decade and sort (relevance / newest / top rated) on top of the "on my services" filter; the Wire has per-service chips.
- Search shows an "on my services" badge (and a filter) on results available via your own services; title pages include a worldwide availability table.
- Subscription advisor (on Clippings): checks where your clipped titles stream in your country and shows which services cover the most, how many your own services cover, and the best one to add. Uses cached availability data; no prices.
- Installable & offline: add OTTpaper to your home screen; the app shell works offline (own files only; API data is never cached by the service worker).
- Themes: Ivory / White / Black (or follow system). Fonts: bundled Newspaper typeface (default, SIL OFL, self-hosted) or system serif / sans / mono; four text sizes.
- API key safety: stored only in your browser (optionally only for the current tab), masked input, never in URLs or backups by default, CSP + no-referrer, network only to TMDB.
- Backup/restore: download all settings (optionally including the API key) as one JSON file and restore it later.

## Tests

Run before every push: `node tests/i18n.mjs && node tests/news.mjs && node tests/security.mjs && node tests/advisor.mjs && node tests/tonight.mjs && node tests/filters.mjs && node tests/contrast.mjs && NODE_PATH=$(npm root -g) node tests/smoke.mjs` (requires `playwright` and Chromium; no network needed).

## License

Code: MIT (see LICENSE). TMDB data, JustWatch availability data, posters and streaming-service names belong to their respective owners and are not covered by this license.

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
index.html        page shell (header, footer with attributions)
css/style.css     all styles (light/dark themes via CSS variables)
js/app.js         router + views (welcome, home, search, detail, settings)
js/tmdb.js        TMDB API client + localStorage cache
js/i18n.js        UI translations (en/ko/ja) + language detection
js/advisor.js      subscription advisor logic (coverage of clippings per service)
js/store.js       settings, history, backup/restore (validated), OTT/country lists
js/icons.js       original inline SVG icons (no third-party icon set)
docs/PLAN.md      development plan
tests/smoke.mjs   browser smoke test with a mocked TMDB API
scripts/          build-time tools: fetch-news.mjs (RSS -> news.json), rss.mjs (parser)
news/feeds.json   news sources + OTT keywords
docs/ATTRIBUTION.md  third-party credits & licensing rules
docs/ROADMAP.md   what's done / next
fonts/            bundled OFL fonts (Playfair Display, Source Serif 4) + license texts
tests/security.mjs  static security/licensing checks (CSP, key handling, fonts, secrets)
tests/advisor.mjs advisor unit test
tests/news.mjs    RSS parser unit test
tests/i18n.mjs    checks en/ko/ja translation keys stay in sync
```

## Features

- First visit: welcome screen guides you through entering your own TMDB key, country and your OTT services; later visits open the main screen directly.
- Settings can be changed anytime; everything is stored in your browser only.
- Languages: English / 한국어 / 日本語. Defaults to the browser language (English if unsupported); can be changed in Settings. Titles, overviews and cast info are requested from TMDB in the selected language (English overview as fallback). Translations may contain awkward expressions.
- The Wire (News): a GitHub Action fetches public RSS feeds every 3 hours at build time and publishes `news/news.json` (headline, short excerpt and link only). Open it at `#/news`. It is empty locally and until the first deployment.
- Newspaper design: masthead, serif type, column layout, print stylesheet; dark mode is the night edition.
- Clippings: save titles from the title page; stored locally, included in backups, kept when you delete history. Press `/` anywhere to jump to search.
- Today's lead: a front-page story on Home, one pick per day from trending titles, preferring ones on your own services.
- Search shows an "on my services" badge (and a filter) on results available via your own services; title pages include a worldwide availability table.
- Subscription advisor (on Clippings): checks where your clipped titles stream in your country and shows which services cover the most, how many your own services cover, and the best one to add. Uses cached availability data; no prices.
- Themes: Ivory / White / Black (or follow system). Fonts: bundled Newspaper typeface (default, SIL OFL, self-hosted) or system serif / sans / mono; four text sizes.
- API key safety: stored only in your browser (optionally only for the current tab), masked input, never in URLs or backups by default, CSP + no-referrer, network only to TMDB.
- Backup/restore: download all settings (optionally including the API key) as one JSON file and restore it later.

## Tests

Run before every push: `node tests/i18n.mjs && node tests/news.mjs && node tests/security.mjs && node tests/advisor.mjs && NODE_PATH=$(npm root -g) node tests/smoke.mjs` (requires `playwright` and Chromium; no network needed).

## License

Code: MIT (see LICENSE). TMDB data, JustWatch availability data, posters and streaming-service names belong to their respective owners and are not covered by this license.

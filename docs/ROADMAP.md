# OTTpaper roadmap (read by the improvement loop)

**Core:** OTT unified search is the main feature — every iteration must keep search/where-to-watch fast, correct and easy.
**Identity:** a newspaper (paper tones, serif, rules, columns) + original features that only a static GitHub Pages site can do.
**Hard rules:** see `docs/ATTRIBUTION.md`. Keep MIT + credits correct. Run all tests before every push (`node tests/i18n.mjs && node tests/news.mjs && node tests/security.mjs && node tests/advisor.mjs && NODE_PATH=$(npm root -g) node tests/smoke.mjs`). Keep the three languages in sync. Small, verified, well-organized changes; update README/ATTRIBUTION when behaviour or third-party use changes.

## Done
- [x] Search, detail with where-to-watch (per type, my OTT first), tabs, history
- [x] Welcome onboarding, settings, backup/restore, en/ko/ja, content language
- [x] Newspaper look + masthead; The Wire (news via scheduled GitHub Action → news.json) — verified live: 4 feeds ok, 12 items
- [x] Themes (ivory/white/black), bundled OFL fonts + font/size settings, API-key hardening (CSP, session-only option, forget key, backup excludes key by default)
- [x] Clippings (local watchlist, in backups, kept by 'delete history') + `/` focuses search

## Ideas (pick the most valuable next; reorder freely)
1. ~~Clippings~~ (done)
2. ~~Best subscription for my clippings~~ (done: Subscription advisor)
3. **Search upgrades** — done: "on my services" badge + filter, `/` shortcut. Left: year/type filters, suggestions, voice search (Web Speech API; CSP/permissions check first).
4. ~~Worldwide availability~~ (done)
5. **Today's front page** — deterministic daily lead story + "what to watch tonight" picker by mood/length.
6. **PWA** — manifest + service worker for offline front page and install.
7. **Print edition** — print stylesheet polish ("print my clippings").
8. **Share** — copyable deep links; Open Graph meta.
9. **News**: verify feeds in Actions logs; add ko/ja sources only after confirming terms + URL; per-service filter chips.
10. Accessibility pass (contrast, focus, screen-reader labels), performance pass (image sizes, lazy loading).

## Iteration log
- v1: newspaper theme, masthead, The Wire, attribution doc, roadmap.
- v5: search results badged/filterable by my services; worldwide availability table on title pages; fixed poster-placeholder overflow.
- v4: subscription advisor (js/advisor.js + clippings page), deploys 1-9 all green incl. CSP/fonts.
- v3: themes + fonts + key security (tests/security.mjs guards CSP, secrets, fonts licenses).
- v2: clippings page + backup/restore, `/` search shortcut; news feeds verified in Actions (more feeds / keyword tuning possible: only 12 items pass the OTT filter).

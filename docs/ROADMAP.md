# OTTpaper roadmap (read by the improvement loop)

**Core:** OTT unified search is the main feature — every iteration must keep search/where-to-watch fast, correct and easy.
**Identity:** a newspaper (paper tones, serif, rules, columns) + original features that only a static GitHub Pages site can do.
**Hard rules:** see `docs/ATTRIBUTION.md`. Keep MIT + credits correct. Run all tests before every push (`node tests/i18n.mjs && node tests/news.mjs && node tests/security.mjs && node tests/advisor.mjs && node tests/tonight.mjs && node tests/filters.mjs && node tests/contrast.mjs && NODE_PATH=$(npm root -g) node tests/smoke.mjs`). Keep the three languages in sync. Small, verified, well-organized changes; update README/ATTRIBUTION when behaviour or third-party use changes.

## Done
- [x] Search, detail with where-to-watch (per type, my OTT first), tabs, history
- [x] Welcome onboarding, settings, backup/restore, en/ko/ja, content language
- [x] Newspaper look + masthead; The Wire (news via scheduled GitHub Action → news.json) — verified live: 4 feeds ok, 12 items
- [x] Themes (ivory/white/black), bundled OFL fonts + font/size settings, API-key hardening (CSP, session-only option, forget key, backup excludes key by default)
- [x] Clippings (local watchlist, in backups, kept by 'delete history') + `/` focuses search

## Ideas (pick the most valuable next; reorder freely)
1. ~~Clippings~~ (done)
2. ~~Best subscription for my clippings~~ (done: Subscription advisor)
3. **Search upgrades** — done: "on my services" badge + filter, `/` shortcut. Also done: decade + sort filters, news service chips. Suggestions from recent searches done. Left: TMDB-backed suggestions (would send keystrokes to TMDB — decide), voice search (NOTE: Chrome's Web Speech API sends audio to Google servers — conflicts with our no-third-party/privacy stance; skip unless a fully on-device option exists).
4. ~~Worldwide availability~~ (done)
5. ~~Today's front page~~ (done: lead story + Tonight picker)
6. ~~PWA~~ (done: manifest, sw.js offline shell, original icon)
7. ~~Print edition~~ (done: print button on Clippings + print CSS)
8. **Share** — copyable deep links; Open Graph meta.
9. **News**: verify feeds in Actions logs; add ko/ja sources only after confirming terms + URL; per-service filter chips.
10. ~~Accessibility pass~~ (contrast test for all themes, labels, skip link). Performance: posters already lazy + w342; nothing heavy left.

## Iteration log
- v1: newspaper theme, masthead, The Wire, attribution doc, roadmap.
- v11: contrast test (48 checks, all themes pass), friendly offline/429 errors. Deploy 16 green.
- v10: search suggestions (datalist from recent searches), skip link, print edition of clippings. Deploy 15 green.
- v9: search decade/sort filters (js/filters.js), news per-service chips; search re-render keeps availability badges. Deploy 14 green.
- v8: Tonight picker (js/tonight.js; uses TMDB discover + provider filter), nav labels for a11y. Deploy 13 (PWA) green.
- v7: PWA (installable, offline shell; CSP gained manifest-src/worker-src 'self'; sw ignores cross-origin). Lesson: a silent string-replace missed the register call — tests now assert it.
- v6: Today's lead story on Home (pickLead in advisor.js, unit-tested). Deploys 1-11 green.
- v5: search results badged/filterable by my services; worldwide availability table on title pages; fixed poster-placeholder overflow.
- v4: subscription advisor (js/advisor.js + clippings page), deploys 1-9 all green incl. CSP/fonts.
- v3: themes + fonts + key security (tests/security.mjs guards CSP, secrets, fonts licenses).
- v2: clippings page + backup/restore, `/` search shortcut; news feeds verified in Actions (more feeds / keyword tuning possible: only 12 items pass the OTT filter).

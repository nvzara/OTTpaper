# OTTpaper

## Overview

CApaper is a personal, serverless web app for searching streaming (OTT) titles. Search a movie or TV show and see
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

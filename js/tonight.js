// "Tonight": pick something to watch by type / mood / length, restricted to MY services. Pure logic (no DOM/network).
import { ottKey } from './store.js';

// TMDB genre ids per media type (mood -> id). TV has no romance/horror/thriller genres, so those moods are movie-only.
export const MOODS = {
  movie: { comedy: 35, drama: 18, thriller: 53, action: 28, romance: 10749, scifi: 878, horror: 27, animation: 16, documentary: 99, family: 10751, mystery: 9648 },
  tv: { comedy: 35, drama: 18, crime: 80, action: 10759, scifi: 10765, animation: 16, documentary: 99, family: 10751, mystery: 9648 },
};
export const LENGTHS = { movie: [90, 120], tv: [30, 50] };   // max minutes (movie runtime / TV episode runtime)

// providerList: TMDB /watch/providers/{type} results ([{provider_id, provider_name}]); returns ids of providers matching my services
export function resolveProviderIds(providerList, myKeys) {
  return [...new Set((providerList || []).filter(p => myKeys.has(ottKey(p.provider_name))).map(p => p.provider_id))];
}

// Taste options beyond type / mood / length.
export const ERAS = ['any', '2020', '2010', '2000', 'old'];
export const RATINGS = [0, 6, 7, 8];                 // minimum TMDB score (0 = any)
export const ORIGINS = ['', 'ko', 'ja', 'en'];       // original language ('' = any)
export const ORDERS = ['pop', 'top', 'new'];
const ERA_RANGE = { 2020: ['2020-01-01', ''], 2010: ['2010-01-01', '2019-12-31'], 2000: ['2000-01-01', '2009-12-31'], old: ['', '1999-12-31'] };
export const DEFAULT_TASTE = { type: 'movie', moods: [], exclude: [], len: 0, era: 'any', rating: 0, lang: '', order: 'pop', skipSeen: false, mine: true };

// A taste profile as stored: anything unknown, mistyped or from the other media type is dropped.
export function cleanTaste(v) {
  const o = v && typeof v === 'object' ? v : {};
  const type = o.type === 'tv' ? 'tv' : 'movie';
  const ids = a => [...new Set(Array.isArray(a) ? a.filter(k => typeof k === 'string' && MOODS[type][k]) : [])];
  const moods = ids(o.moods), exclude = ids(o.exclude).filter(k => !moods.includes(k));
  return {
    type, moods, exclude,
    len: LENGTHS[type].includes(o.len) ? o.len : 0,
    era: ERAS.includes(o.era) ? o.era : 'any',
    rating: RATINGS.includes(o.rating) ? o.rating : 0,
    lang: ORIGINS.includes(o.lang) ? o.lang : '',
    order: ORDERS.includes(o.order) ? o.order : 'pop',
    skipSeen: o.skipSeen === true,
    mine: o.mine !== false,
  };
}
// How many of the fine-tuning options differ from "no preference".
export const fineCount = t => (t.exclude.length ? 1 : 0) + (t.era !== 'any') + (t.rating > 0) + (t.lang !== '') + (t.order !== 'pop') + (t.skipSeen ? 1 : 0);

export function buildDiscoverParams({ type, mood, moods, exclude, maxRuntime, region, providerIds, era, minRating, lang, order, today = new Date().toISOString().slice(0, 10) }) {
  const p = { sort_by: 'popularity.desc', 'vote_count.gte': '150', include_adult: 'false', watch_region: region, page: '1' };
  const ids = k => MOODS[type]?.[k];
  const want = (moods || (mood ? [mood] : [])).filter(ids);
  const g = want.map(ids);
  if (g.length) p.with_genres = g.join('|');          // any of the chosen moods
  const no = (exclude || []).filter(k => ids(k) && !want.includes(k)).map(ids);
  if (no.length) p.without_genres = no.join(',');
  if (maxRuntime) p['with_runtime.lte'] = String(maxRuntime);
  const dateKey = type === 'tv' ? 'first_air_date' : 'primary_release_date';
  const [from, to] = ERA_RANGE[era] || ['', ''];
  if (from) p[`${dateKey}.gte`] = from;
  if (to) p[`${dateKey}.lte`] = to;
  if (minRating) p['vote_average.gte'] = String(minRating);
  if (lang) p.with_original_language = lang;
  if (order === 'top') { p.sort_by = 'vote_average.desc'; p['vote_count.gte'] = '300'; }
  else if (order === 'new') {
    p.sort_by = `${dateKey}.desc`; p['vote_count.gte'] = '50';
    if (!p[`${dateKey}.lte`] || p[`${dateKey}.lte`] > today) p[`${dateKey}.lte`] = today;   // nothing unreleased
  }
  if (providerIds?.length) { p.with_watch_providers = providerIds.join('|'); p.with_watch_monetization_types = 'flatrate|free|ads'; }
  return p;
}

// Choose one item from results, avoiding ids already shown when possible. rnd: () => [0,1)
export function pickOne(results, seen, rnd = Math.random) {
  const fresh = results.filter(r => !seen.has(r.id));
  const pool = fresh.length ? fresh : results;
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
}

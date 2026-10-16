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

export function buildDiscoverParams({ type, mood, maxRuntime, region, providerIds }) {
  const p = { sort_by: 'popularity.desc', 'vote_count.gte': '150', include_adult: 'false', watch_region: region, page: '1' };
  const g = MOODS[type]?.[mood];
  if (g) p.with_genres = String(g);
  if (maxRuntime) p['with_runtime.lte'] = String(maxRuntime);
  if (providerIds?.length) { p.with_watch_providers = providerIds.join('|'); p.with_watch_monetization_types = 'flatrate|free|ads'; }
  return p;
}

// Choose one item from results, avoiding ids already shown when possible. rnd: () => [0,1)
export function pickOne(results, seen, rnd = Math.random) {
  const fresh = results.filter(r => !seen.has(r.id));
  const pool = fresh.length ? fresh : results;
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
}

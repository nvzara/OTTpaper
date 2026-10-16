// Client-side search filters/sorting and news filtering. Pure logic (no DOM/network).
export const DECADES = ['any', '2020', '2010', '2000', 'old'];
export const SORTS = ['rel', 'new', 'top'];

export const yearOf = it => { const y = parseInt((it.release_date || it.first_air_date || '').slice(0, 4), 10); return Number.isFinite(y) ? y : null; };
export function inDecade(it, d) {
  if (d === 'any') return true;
  const y = yearOf(it);
  if (y === null) return false;
  return d === '2020' ? y >= 2020 : d === 'old' ? y < 2000 : y >= +d && y < +d + 10;
}
// items: TMDB results; returns a filtered + sorted copy ('rel' keeps TMDB's relevance order)
export function filterSearch(items, { decade = 'any', sort = 'rel' } = {}) {
  const out = items.filter(it => inDecade(it, decade));
  if (sort === 'new') out.sort((a, b) => (b.release_date || b.first_air_date || '').localeCompare(a.release_date || a.first_air_date || ''));
  else if (sort === 'top') out.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  return out;
}

// News service chips: key -> lowercase keywords searched in headline + excerpt
export const NEWS_SERVICES = {
  netflix: ['netflix'], disney: ['disney'], max: ['hbo', 'max '], apple: ['apple tv'], prime: ['prime video', 'amazon'],
  paramount: ['paramount'], hulu: ['hulu'], peacock: ['peacock'], crunchyroll: ['crunchyroll'],
};
export const newsMatches = (n, key) => key === 'all' || (NEWS_SERVICES[key] || []).some(k => `${n.title} ${n.summary || ''} `.toLowerCase().includes(k));

// Best YouTube trailer key from TMDB `videos.results` (official trailers first, then any trailer/teaser); null if none or key looks unsafe.
export function pickTrailer(videos) {
  const yt = (videos || []).filter(v => v.site === 'YouTube' && /^[\w-]{6,20}$/.test(v.key || ''));
  const rank = v => (v.type === 'Trailer' ? 0 : v.type === 'Teaser' ? 2 : 4) + (v.official ? 0 : 1);
  return yt.sort((a, b) => rank(a) - rank(b))[0]?.key || null;
}

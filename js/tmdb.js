// TMDB v3 client with localStorage TTL cache. Key comes from user settings (never committed).
import { getSettings } from './store.js';
import { tmdbLang } from './i18n.js';

const BASE = 'https://api.themoviedb.org/3';
export const IMG = 'https://image.tmdb.org/t/p/';
const DAY = 864e5;

function cacheGet(k) {
  try {
    const v = JSON.parse(localStorage.getItem('c:' + k));
    if (v && v.exp > Date.now()) return v.d;
  } catch {}
  return null;
}
function cacheSet(k, d, ttl) {
  const s = JSON.stringify({ exp: Date.now() + ttl, d });
  try { localStorage.setItem('c:' + k, s); }
  catch { // quota: drop all cache entries and retry once
    Object.keys(localStorage).filter(x => x.startsWith('c:')).forEach(x => localStorage.removeItem(x));
    try { localStorage.setItem('c:' + k, s); } catch {}
  }
}

async function api(path, params = {}, ttl = DAY) {
  const { apiKey } = getSettings();
  if (!apiKey) throw new Error('NO_KEY');
  const p = new URLSearchParams({ language: tmdbLang(), ...params });
  const headers = {};
  if (apiKey.length > 40) headers.Authorization = 'Bearer ' + apiKey; // v4 read token
  else p.set('api_key', apiKey);
  const ck = path + '?' + new URLSearchParams({ language: tmdbLang(), ...params });
  const hit = cacheGet(ck);
  if (hit) return hit;
  // No cookies, no Referer: the key (v3: query string) only ever goes to api.themoviedb.org.
  let r;
  try { r = await fetch(`${BASE}${path}?${p}`, { headers, credentials: 'omit', referrerPolicy: 'no-referrer' }); }
  catch { throw new Error('NETWORK'); }   // unreachable network (fetch rejects); other errors keep their own message
  if (r.status === 401) throw new Error('BAD_KEY');
  if (!r.ok) throw new Error('HTTP_' + r.status);
  const d = await r.json();
  if (ttl) cacheSet(ck, d, ttl);
  return d;
}

export const trending = () => api('/trending/all/day', {}, DAY);
export const popular = t => api(`/${t}/popular`, { region: getSettings().country }, DAY);
export const upcoming = () => api('/movie/upcoming', { region: getSettings().country }, DAY);
export const search = (q, page = 1) => api('/search/multi', { query: q, page }, DAY / 4);
export const detail = (type, id) =>
  api(`/${type}/${id}`, { append_to_response: 'credits,release_dates,content_ratings,recommendations,videos', include_video_language: `${tmdbLang().slice(0, 2)},en,null` }, 7 * DAY);
export const providers = (type, id) => api(`/${type}/${id}/watch/providers`, {}, 3 * DAY);
// English overview, used when a title has no overview in the selected language.
export const overviewEn = async (type, id) => (await api(`/${type}/${id}`, { language: 'en-US' }, 7 * DAY)).overview || '';
export const discover = (type, params) => api(`/discover/${type}`, params, DAY / 4);
export const providerList = (type, region) => api(`/watch/providers/${type}`, { watch_region: region }, 7 * DAY);
// For "Picked for you": what TMDB recommends after a title, and the title's genres (a light call, cached a week).
export const recommendations = (type, id) => api(`/${type}/${id}/recommendations`, {}, 3 * DAY);
export const basic = (type, id) => api(`/${type}/${id}`, {}, 7 * DAY);

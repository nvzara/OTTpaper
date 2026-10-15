// TMDB v3 client with localStorage TTL cache. Key comes from user settings (never committed).
import { getSettings } from './store.js';

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
  const p = new URLSearchParams({ language: 'ko-KR', ...params });
  const headers = {};
  if (apiKey.length > 40) headers.Authorization = 'Bearer ' + apiKey; // v4 read token
  else p.set('api_key', apiKey);
  const ck = path + '?' + new URLSearchParams({ language: 'ko-KR', ...params });
  const hit = cacheGet(ck);
  if (hit) return hit;
  const r = await fetch(`${BASE}${path}?${p}`, { headers });
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
  api(`/${type}/${id}`, { append_to_response: 'credits,release_dates,content_ratings' }, 7 * DAY);
export const providers = (type, id) => api(`/${type}/${id}/watch/providers`, {}, 3 * DAY);

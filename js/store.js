// Settings + local history, all in localStorage (never leaves the device except TMDB requests).
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const OTTS = [
  { key: 'netflix', name: '넷플릭스', en: 'Netflix', url: 'https://www.netflix.com/' },
  { key: 'disney', name: '디즈니+', en: 'Disney+', url: 'https://www.disneyplus.com/' },
  { key: 'wavve', name: '웨이브', en: 'Wavve', url: 'https://www.wavve.com/' },
  { key: 'tving', name: '티빙', en: 'TVING', url: 'https://www.tving.com/' },
  { key: 'watcha', name: '왓챠', en: 'Watcha', url: 'https://watcha.com/' },
  { key: 'coupang', name: '쿠팡플레이', en: 'Coupang Play', url: 'https://www.coupangplay.com/' },
  { key: 'apple', name: '애플 TV+', en: 'Apple TV+', url: 'https://tv.apple.com/' },
  { key: 'prime', name: '프라임 비디오', en: 'Prime Video', url: 'https://www.primevideo.com/' },
  { key: 'youtube', name: '유튜브', en: 'YouTube', url: 'https://www.youtube.com/' },
];
// Supported countries: Korea, Japan and English-speaking countries. Display names come from Intl.DisplayNames.
export const COUNTRIES = ['KR', 'JP', 'US', 'GB', 'CA', 'AU', 'NZ', 'IE'];
// First-visit default from the browser's language/region (ko -> KR, ja -> JP, en-GB -> GB ..., other English -> US).
export function defaultCountry() {
  const tags = (typeof navigator !== 'undefined' && (navigator.languages?.length ? navigator.languages : [navigator.language])) || [];
  for (const raw of tags) {
    const [lang, region] = String(raw || '').split('-');
    if (region && COUNTRIES.includes(region.toUpperCase())) return region.toUpperCase();
    if (lang === 'ko') return 'KR';
    if (lang === 'ja') return 'JP';
    if (lang === 'en') return 'US';
  }
  return 'US';
}
export const LANG_CODES = ['en', 'ko', 'ja'];
// Display name of a streaming service: Korean name for ko, brand name otherwise.
export const ottName = (o, lang) => lang === 'ko' ? o.name : o.en;
export const THEMES = ['auto', 'ivory', 'white', 'black'];
export const FONTS = ['paper', 'serif', 'sans', 'mono'];
export const SIZES = ['s', 'm', 'l', 'xl'];

// Match TMDB provider names to our keys (substring, lowercase).
const MATCH = { netflix: ['netflix'], disney: ['disney'], wavve: ['wavve'], tving: ['tving'], watcha: ['watcha'],
  coupang: ['coupang'], apple: ['apple tv'], prime: ['amazon prime', 'prime video'], youtube: ['youtube'] };
export function ottKey(name) {
  const n = String(name || '').toLowerCase();
  return OTTS.find(o => MATCH[o.key].some(m => n.includes(m)))?.key ?? null;
}

const DEF = { apiKey: '', rememberKey: true, country: '', theme: 'auto', font: 'paper', size: 'm', lang: 'auto', myOtts: [], onboarded: false };
const SESSION_KEY = 'ottpaper.session-key';
const LEGACY_THEME = { light: 'ivory', dark: 'black' };

// The API key is the only secret. It lives in this browser only: localStorage ("remember") or sessionStorage (cleared when the tab closes).
export function getSettings() {
  const raw = get('settings', {});
  const s = { ...DEF, ...raw };
  if (!COUNTRIES.includes(s.country)) s.country = defaultCountry();   // unset, or a country that is no longer supported
  s.theme = LEGACY_THEME[s.theme] || (THEMES.includes(s.theme) ? s.theme : 'auto');
  if (!s.apiKey) { try { s.apiKey = sessionStorage.getItem(SESSION_KEY) || ''; } catch {} }
  // Users who saved a key before the welcome screen existed are treated as onboarded.
  if (s.apiKey && !('onboarded' in raw)) s.onboarded = true;
  return s;
}
export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  const { apiKey, ...rest } = next;
  try {
    if (!next.rememberKey && apiKey) sessionStorage.setItem(SESSION_KEY, apiKey); else sessionStorage.removeItem(SESSION_KEY);
  } catch {}
  return set('settings', { ...rest, apiKey: next.rememberKey ? apiKey : '' });
}
export function forgetApiKey() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  const raw = get('settings', {});
  set('settings', { ...raw, apiKey: '' });
}

const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
// A saved title as stored/exported: only well-formed fields survive (anything hand-edited or corrupted is dropped).
export const cleanTitle = v => v && typeof v === 'object' && Number.isInteger(v.id) && (v.media_type === 'movie' || v.media_type === 'tv') ? {
  id: v.id, media_type: v.media_type, title: str(v.title, 200),
  poster_path: /^\/[\w.-]{1,80}$/.test(v.poster_path || '') ? v.poster_path : null,
  release_date: str(v.release_date, 10), first_air_date: str(v.first_air_date, 10),
} : null;
const cleanQuery = v => typeof v === 'string' && v.trim() ? v.slice(0, 100) : null;
// Lists live in localStorage; whatever is read back is validated so one bad entry can never blank a screen.
const hist = (k, max, clean) => {
  const list = () => { const a = get(k, []); return Array.isArray(a) ? a.map(clean).filter(Boolean) : []; };
  return {
    list,
    add(v, same) { set(k, [v, ...list().filter(x => !same(x, v))].slice(0, max)); },
    remove(same) { set(k, list().filter(x => !same(x))); },
    clear: () => set(k, []),
  };
};
const sameQuery = (a, b) => a.toLowerCase() === b.toLowerCase();
const sameTitle = (a, b) => a.id === b.id && a.media_type === b.media_type;
const uniq = (a, same) => a.filter((x, i) => a.findIndex(y => same(x, y)) === i);
const rsBase = hist('rs', 10, cleanQuery);
// "Dune" and "dune " are the same search: one entry, the latest spelling.
export const recentSearch = { ...rsBase, add: q => { const c = cleanQuery(q); if (c) rsBase.add(c.trim(), sameQuery); } };
export const recentViews = hist('rv', 20, cleanTitle);
// The publisher's note is open on the first visit to the front page, then folded to one line.
export const noticeSeen = { get: () => get('ns', false), set: () => set('ns', true) };

// Clippings: titles the user saved (kept by "delete history", included in backups).
const clipList = () => { const a = get('cl', []); return Array.isArray(a) ? a.map(cleanTitle).filter(Boolean) : []; };
export const clippings = {
  list: clipList,
  has: v => clipList().some(x => sameTitle(x, v)),
  toggle(v) {
    const l = clipList();
    const has = l.some(x => sameTitle(x, v));
    set('cl', has ? l.filter(x => !sameTitle(x, v)) : [cleanTitle(v), ...l].filter(Boolean).slice(0, 300));
    return !has;
  },
};

// Ask the browser not to evict our data under storage pressure (best effort).
export async function requestPersistence() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}

// ---- Backup / restore (single JSON file) ----
export function buildBackup({ includeKey }) {
  const s = getSettings();
  if (!includeKey) s.apiKey = '';
  return {
    app: 'OTTpaper', version: 1, exportedAt: new Date().toISOString(), includesApiKey: !!(includeKey && s.apiKey),
    settings: s, recentSearch: recentSearch.list(), recentViews: recentViews.list(), clippings: clippings.list(),
  };
}

// Validate and sanitize an untrusted backup file; throws on a file that is not an OTTpaper backup.
export function restoreBackup(raw) {
  if (!raw || raw.app !== 'OTTpaper' || typeof raw.settings !== 'object' || raw.settings === null) {
    throw new Error('NOT_BACKUP');
  }
  const s = raw.settings, cur = getSettings();
  const apiKey = str(s.apiKey, 200).trim();
  saveSettings({
    apiKey: apiKey || cur.apiKey, // a key-less backup keeps the key already in this browser
    country: COUNTRIES.includes(s.country) ? s.country : cur.country,
    lang: s.lang === 'auto' || LANG_CODES.includes(s.lang) ? s.lang : cur.lang,
    theme: THEMES.includes(LEGACY_THEME[s.theme] || s.theme) ? (LEGACY_THEME[s.theme] || s.theme) : cur.theme,
    font: FONTS.includes(s.font) ? s.font : cur.font,
    size: SIZES.includes(s.size) ? s.size : cur.size,
    myOtts: Array.isArray(s.myOtts) ? s.myOtts.filter(k => OTTS.some(o => o.key === k)) : cur.myOtts,
    onboarded: true,
  });
  // Lists from a file are cleaned like stored ones: malformed entries dropped, duplicates merged, size limits applied.
  if (Array.isArray(raw.recentSearch)) set('rs', uniq(raw.recentSearch.map(cleanQuery).filter(Boolean).map(x => x.trim()).filter(Boolean), sameQuery).slice(0, 10));
  if (Array.isArray(raw.clippings)) set('cl', uniq(raw.clippings.map(cleanTitle).filter(Boolean), sameTitle).slice(0, 300));
  if (Array.isArray(raw.recentViews)) set('rv', uniq(raw.recentViews.map(cleanTitle).filter(Boolean), sameTitle).slice(0, 20));
}

export function clearUserData() {
  const keep = localStorage.getItem('settings');
  const clips = localStorage.getItem('cl');
  Object.keys(localStorage).forEach(k => localStorage.removeItem(k));
  if (keep) localStorage.setItem('settings', keep);
  if (clips) localStorage.setItem('cl', clips);
}

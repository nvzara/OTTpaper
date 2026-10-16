// Settings + local history, all in localStorage (never leaves the device except TMDB requests).
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const OTTS = [
  { key: 'netflix', name: '넷플릭스', url: 'https://www.netflix.com/' },
  { key: 'disney', name: '디즈니+', url: 'https://www.disneyplus.com/' },
  { key: 'wavve', name: '웨이브', url: 'https://www.wavve.com/' },
  { key: 'tving', name: '티빙', url: 'https://www.tving.com/' },
  { key: 'watcha', name: '왓챠', url: 'https://watcha.com/' },
  { key: 'coupang', name: '쿠팡플레이', url: 'https://www.coupangplay.com/' },
  { key: 'apple', name: '애플 TV+', url: 'https://tv.apple.com/' },
  { key: 'prime', name: '프라임 비디오', url: 'https://www.primevideo.com/' },
  { key: 'youtube', name: '유튜브', url: 'https://www.youtube.com/' },
];
export const COUNTRIES = { KR: '한국', US: '미국', JP: '일본', GB: '영국', CA: '캐나다', AU: '오스트레일리아', DE: '독일', FR: '프랑스' };
export const THEMES = ['auto', 'light', 'dark'];

// Match TMDB provider names to our keys (substring, lowercase).
const MATCH = { netflix: ['netflix'], disney: ['disney'], wavve: ['wavve'], tving: ['tving'], watcha: ['watcha'],
  coupang: ['coupang'], apple: ['apple tv'], prime: ['amazon prime', 'prime video'], youtube: ['youtube'] };
export function ottKey(name) {
  const n = name.toLowerCase();
  return OTTS.find(o => MATCH[o.key].some(m => n.includes(m)))?.key ?? null;
}

const DEF = { apiKey: '', country: 'KR', theme: 'auto', myOtts: [], onboarded: false };
export function getSettings() {
  const s = { ...DEF, ...get('settings', {}) };
  // Users who saved a key before the welcome screen existed are treated as onboarded.
  if (s.apiKey && !('onboarded' in get('settings', {}))) s.onboarded = true;
  return s;
}
export const saveSettings = s => set('settings', { ...getSettings(), ...s });

const hist = (k, max) => ({
  list: () => get(k, []),
  add(v, same) { set(k, [v, ...get(k, []).filter(x => !same(x, v))].slice(0, max)); },
  clear: () => set(k, []),
});
export const recentSearch = hist('rs', 10);
export const recentViews = hist('rv', 20);

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
    settings: s, recentSearch: recentSearch.list(), recentViews: recentViews.list(),
  };
}

const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
// Validate and sanitize an untrusted backup file; throws on a file that is not an OTTpaper backup.
export function restoreBackup(raw) {
  if (!raw || raw.app !== 'OTTpaper' || typeof raw.settings !== 'object' || raw.settings === null) {
    throw new Error('OTTpaper 백업 파일이 아닙니다.');
  }
  const s = raw.settings, cur = getSettings();
  const apiKey = str(s.apiKey, 200).trim();
  saveSettings({
    apiKey: apiKey || cur.apiKey, // a key-less backup keeps the key already in this browser
    country: s.country in COUNTRIES ? s.country : cur.country,
    theme: THEMES.includes(s.theme) ? s.theme : cur.theme,
    myOtts: Array.isArray(s.myOtts) ? s.myOtts.filter(k => OTTS.some(o => o.key === k)) : cur.myOtts,
    onboarded: true,
  });
  const cleanView = v => v && Number.isInteger(v.id) && (v.media_type === 'movie' || v.media_type === 'tv') ? {
    id: v.id, media_type: v.media_type, title: str(v.title, 200),
    poster_path: /^\/[\w.-]{1,80}$/.test(v.poster_path || '') ? v.poster_path : null,
    release_date: str(v.release_date, 10), first_air_date: str(v.first_air_date, 10),
  } : null;
  if (Array.isArray(raw.recentSearch)) set('rs', raw.recentSearch.map(x => str(x, 100)).filter(Boolean).slice(0, 10));
  if (Array.isArray(raw.recentViews)) set('rv', raw.recentViews.map(cleanView).filter(Boolean).slice(0, 20));
}

export function clearUserData() {
  const keep = localStorage.getItem('settings');
  Object.keys(localStorage).filter(k => k !== 'settings').forEach(k => localStorage.removeItem(k));
  if (keep) localStorage.setItem('settings', keep);
}

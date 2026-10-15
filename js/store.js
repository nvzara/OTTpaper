// Settings + local history, all in localStorage (never leaves the device).
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

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
// Match TMDB provider names to our keys (substring, lowercase).
const MATCH = { netflix: ['netflix'], disney: ['disney'], wavve: ['wavve'], tving: ['tving'], watcha: ['watcha'],
  coupang: ['coupang'], apple: ['apple tv'], prime: ['amazon prime', 'prime video'], youtube: ['youtube'] };
export function ottKey(name) {
  const n = name.toLowerCase();
  return OTTS.find(o => MATCH[o.key].some(m => n.includes(m)))?.key ?? null;
}

const DEF = { apiKey: '', country: 'KR', theme: 'auto', myOtts: [] };
export const getSettings = () => ({ ...DEF, ...get('settings', {}) });
export const saveSettings = s => set('settings', { ...getSettings(), ...s });

const hist = (k, max) => ({
  list: () => get(k, []),
  add(v, same) {
    const l = [v, ...get(k, []).filter(x => !same(x, v))].slice(0, max);
    set(k, l);
  },
  clear: () => set(k, []),
});
export const recentSearch = hist('rs', 10);
export const recentViews = hist('rv', 20);

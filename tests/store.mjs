// Unit tests for country defaults and settings fallbacks. Run: node tests/store.mjs
const mem = {};
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const setLang = (...l) => Object.defineProperty(globalThis, 'navigator', { value: { languages: l, language: l[0] }, configurable: true });
setLang('en-US');
const { COUNTRIES, defaultCountry, getSettings, recentSearch } = await import('../js/store.js');
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
ok(COUNTRIES.join() === 'KR,JP,US,GB,CA,AU,NZ,IE', 'supported countries: Korea, Japan, English-speaking');
for (const [langs, want] of [[['ko-KR'], 'KR'], [['ko'], 'KR'], [['ja-JP'], 'JP'], [['en-GB'], 'GB'], [['en-AU'], 'AU'], [['en-NZ'], 'NZ'], [['en-IE'], 'IE'], [['en-US'], 'US'], [['en'], 'US'], [['fr-FR', 'en-CA'], 'CA'], [['de-DE'], 'US'], [['zh-CN', 'ko'], 'KR']]) {
  setLang(...langs); ok(defaultCountry() === want, `default country for ${langs.join(' / ')} is ${want}`);
}
setLang('ko-KR');
ok(getSettings().country === 'KR', 'unset country falls back to the browser default');
mem.settings = JSON.stringify({ country: 'DE' });
ok(getSettings().country === 'KR', 'a stored unsupported country (DE) is replaced by the default');
mem.settings = JSON.stringify({ country: 'JP' });
ok(getSettings().country === 'JP', 'a stored supported country is kept');
recentSearch.add('a', (x, y) => x === y); recentSearch.add('b', (x, y) => x === y); recentSearch.add('a', (x, y) => x === y);
ok(recentSearch.list().join() === 'a,b', 'recent searches: newest first, no duplicates');
recentSearch.remove(x => x === 'a');
ok(recentSearch.list().join() === 'b', 'recent searches: remove one');
recentSearch.clear();
ok(recentSearch.list().length === 0, 'recent searches: clear all');
process.exit(bad ? 1 : 0);

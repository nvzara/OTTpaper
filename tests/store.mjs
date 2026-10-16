// Unit tests for country defaults and settings fallbacks. Run: node tests/store.mjs
const mem = {};
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const setLang = (...l) => Object.defineProperty(globalThis, 'navigator', { value: { languages: l, language: l[0] }, configurable: true });
setLang('en-US');
const { COUNTRIES, defaultCountry, getSettings, recentSearch, recentViews, clippings } = await import('../js/store.js');
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
// corrupted / hand-edited storage must never break the lists
mem.cl = JSON.stringify([null, 3, 'x', { id: 'a' }, { id: 5, media_type: 'movie', title: 'T', poster_path: '/ok.jpg' }, { id: 6, media_type: 'person' }]);
ok(clippings.list().length === 1 && clippings.list()[0].id === 5, 'clippings: malformed entries are dropped when read');
mem.cl = '{"a":1}'; ok(clippings.list().length === 0, 'clippings: a non-array value reads as empty');
mem.cl = 'not json'; ok(clippings.list().length === 0, 'clippings: unparseable JSON reads as empty');
ok(clippings.toggle({ id: 9, media_type: 'tv', title: 'N', poster_path: '/<script>' }) === true && clippings.list()[0].poster_path === null, 'clippings: toggle works on corrupted storage and sanitizes the saved entry');
ok(clippings.toggle({ id: 9, media_type: 'tv' }) === false && clippings.list().length === 0, 'clippings: toggle removes it again');
mem.rv = JSON.stringify([null, 3, { id: 1 }, { id: 2, media_type: 'tv' }]); ok(recentViews.list().length === 1, 'recent views: malformed entries are dropped');
mem.rs = JSON.stringify(['ok', '', 5, null, '   ', 'x'.repeat(300)]); ok(recentSearch.list().length === 2 && recentSearch.list()[1].length === 100, 'recent searches: non-strings/empty dropped, long entries cut to 100');
process.exit(bad ? 1 : 0);

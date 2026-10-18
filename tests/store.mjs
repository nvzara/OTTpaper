// Unit tests for country defaults and settings fallbacks. Run: node tests/store.mjs
const mem = {};
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const setLang = (...l) => Object.defineProperty(globalThis, 'navigator', { value: { languages: l, language: l[0] }, configurable: true });
setLang('en-US');
const { COUNTRIES, defaultCountry, getSettings, recentSearch, recentViews, clippings, restoreBackup, buildBackup, ottKey, tonightTaste } = await import('../js/store.js');
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
recentSearch.add('a'); recentSearch.add('b'); recentSearch.add('a');
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
// recent searches: case/spacing duplicates merge, newest spelling wins, at most 10 kept
recentSearch.clear(); recentSearch.add('Dune'); recentSearch.add('  dune '); recentSearch.add('   ');
ok(recentSearch.list().join('|') === 'dune', 'recent searches: "Dune" and "dune " are one entry (latest spelling); blank ignored');
for (let i = 0; i < 15; i++) recentSearch.add('q' + i);
ok(recentSearch.list().length === 10 && recentSearch.list()[0] === 'q14', 'recent searches: newest 10 kept');
// clippings: capped at 300 (newest first)
mem.cl = '[]'; for (let i = 1; i <= 305; i++) clippings.toggle({ id: i, media_type: 'movie', title: 'T' + i });
ok(clippings.list().length === 300 && clippings.list()[0].id === 305, 'clippings: newest 300 kept');
// restoring backups: old/partial files and duplicates
const tv = (id, title) => ({ id, media_type: 'tv', title });
restoreBackup({ app: 'OTTpaper', settings: { country: 'JP', unknownField: 1, myOtts: ['netflix', 'nope'] },
  recentSearch: ['Dune', 'dune', 'Alien', 5, ''], clippings: [tv(1, 'A'), tv(1, 'A again'), tv(2, 'B'), { id: 3, media_type: 'movie' }, null], recentViews: [tv(7, 'V'), tv(7, 'V')] });
ok(getSettings().country === 'JP' && getSettings().myOtts.join() === 'netflix', 'restore: old backup with unknown fields keeps only known ones');
ok(recentSearch.list().join() === 'Dune,Alien', 'restore: recent searches deduped (case-insensitive) and cleaned');
ok(clippings.list().map(c => c.id).join() === '1,2,3' && clippings.list()[0].title === 'A', 'restore: duplicate clippings merged, malformed dropped');
ok(recentViews.list().length === 1, 'restore: duplicate recent views merged');
restoreBackup({ app: 'OTTpaper', settings: {} });
ok(clippings.list().length === 3 && getSettings().country === 'JP', 'restore: a backup without lists/fields leaves existing data alone');
ok(!('apiKey' in buildBackup({ includeKey: false }).settings) || buildBackup({ includeKey: false }).settings.apiKey === '', 'backup without key has no key');
let threw = false; try { restoreBackup({ app: 'Other', settings: {} }); } catch { threw = true; }
ok(threw, 'restore: a file that is not an OTTpaper backup is refused');
ok(ottKey(undefined) === null && ottKey(null) === null && ottKey('Netflix') === 'netflix' && ottKey('Amazon Prime Video') === 'prime', 'ottKey: provider without a name never throws; known names still match');
mem.tp = '[1,2]'; ok(Object.keys(tonightTaste.get()).length === 0, 'tonight taste: a non-object reads as empty');
mem.tp = 'not json'; ok(Object.keys(tonightTaste.get()).length === 0, 'tonight taste: unparseable JSON reads as empty');
tonightTaste.set({ type: 'tv', era: '2010' }); ok(tonightTaste.get().era === '2010', 'tonight taste: saved and read back');
ok(buildBackup({ includeKey: false }).tonight.era === '2010', 'backup includes the tonight taste');
tonightTaste.set({}); restoreBackup({ app: 'OTTpaper', settings: {}, tonight: { type: 'movie', rating: 7 } });
ok(tonightTaste.get().rating === 7, 'restore brings the tonight taste back');
restoreBackup({ app: 'OTTpaper', settings: {}, tonight: 'junk' }); ok(tonightTaste.get().rating === 7, 'restore ignores a malformed taste');
process.exit(bad ? 1 : 0);

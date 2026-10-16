// Unit test for the subscription advisor. Run: node tests/advisor.mjs
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { computeCoverage } = await import('../js/advisor.js');
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const clips = [1, 2, 3, 4, 5].map(id => ({ id, media_type: 'movie', title: 'T' + id }));
const f = (...n) => ({ flatrate: n.map(provider_name => ({ provider_name })) });
const pv = new Map([['movie:1', f('Netflix', 'Wavve')], ['movie:2', f('Netflix')], ['movie:3', f('Disney Plus')],
  ['movie:4', { rent: [{ provider_name: 'Apple TV' }] }], ['movie:5', null]]);
const r = computeCoverage(clips, pv, new Set(['wavve']));
ok(r.total === 5 && r.withData === 4, 'counts total and titles with data');
ok(r.covered === 1, 'my service (Wavve) covers 1 title');
ok(r.ranking[0].name === 'Netflix' && r.ranking[0].count === 2, 'ranking sorted by coverage');
ok(r.best?.name === 'Netflix' && r.best.gain === 1, 'best add-on counts only titles not already covered (Netflix: #2)');
ok(r.noSub.length === 1 && r.noSub[0].id === 4, 'rent/buy-only titles listed separately');
ok(r.noData.length === 1 && r.noData[0].id === 5, 'titles without data listed separately');
ok(r.ranking.find(s => s.name === 'Wavve').mine === true, 'mine flag set');
const none = computeCoverage([], new Map(), new Set());
ok(none.total === 0 && none.best === null, 'empty clippings safe');
process.exit(bad ? 1 : 0);

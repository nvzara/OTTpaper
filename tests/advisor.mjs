// Unit test for the subscription advisor. Run: node tests/advisor.mjs
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { computeCoverage, onMyServices, worldwideRows } = await import('../js/advisor.js');
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
// onMyServices / worldwideRows
const kr = { flatrate: [{ provider_name: 'Netflix' }], ads: [{ provider_name: 'YouTube' }], rent: [{ provider_name: 'Apple TV' }] };
ok(onMyServices(kr, new Set(['netflix'])).join() === 'netflix', 'onMyServices: subscription match');
ok(onMyServices(kr, new Set(['youtube'])).join() === 'youtube', 'onMyServices: ad-supported counts');
ok(onMyServices(kr, new Set(['apple'])).length === 0, 'onMyServices: rent/buy does not count as "on my services"');
ok(onMyServices(null, new Set(['netflix'])).length === 0 && onMyServices(kr, new Set()).length === 0, 'onMyServices: safe on empty input');
const ww = worldwideRows({ US: { flatrate: [{ provider_name: 'A' }, { provider_name: 'B' }] }, JP: { flatrate: [{ provider_name: 'A' }] }, FR: { rent: [{ provider_name: 'X' }] }, DE: {} });
ok(ww.map(r => r.code).join() === 'US,JP,FR', 'worldwideRows: sorted by subscription count, empty countries dropped');
ok(ww[2].rentBuy === 1, 'worldwideRows: counts rent/buy-only countries');
process.exit(bad ? 1 : 0);

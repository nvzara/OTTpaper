// Unit test for the "Picked for you" ranking. Run: node tests/recommend.mjs
const { seedWeight, tasteGenres, recencyScore, qualityScore, rankPicks, diversify, keyOf, SEEDS_MAX } = await import('../js/recommend.js');
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const NOW = Date.parse('2026-10-18');
const yearsAgo = y => new Date(NOW - y * 365.25 * 864e5).toISOString().slice(0, 10);
const A = { id: 1, media_type: 'movie', title: 'A' }, B = { id: 2, media_type: 'movie', title: 'B' }, C = { id: 3, media_type: 'movie', title: 'C' };

ok(seedWeight(0) === 1 && seedWeight(1) < 1 && seedWeight(5) < seedWeight(1), 'newer clippings weigh more');
ok(SEEDS_MAX >= 5 && SEEDS_MAX <= 20, 'a sensible number of clippings shapes the picks');

const info = new Map([[keyOf('movie', 1), { genres: [{ id: 35 }, { id: 18 }] }], [keyOf('movie', 2), { genres: [{ id: 35 }] }]]);
const tg = tasteGenres([A, B], info);
ok(tg.get(35) === 1 && tg.get(18) > 0 && tg.get(18) < 1, 'taste: the genre shared by most (and newest) clippings is strongest');
ok(tasteGenres([], new Map()).size === 0 && tasteGenres([A], new Map()).size === 0, 'taste: no data gives an empty profile');

ok(Math.abs(recencyScore({ release_date: yearsAgo(0) }, NOW) - 1) < 0.01 && recencyScore({ release_date: yearsAgo(1) }, NOW) > recencyScore({ release_date: yearsAgo(5) }, NOW), 'recency: newer is better, smoothly');
ok(recencyScore({ first_air_date: yearsAgo(3) }, NOW) > 0.45 && recencyScore({ first_air_date: yearsAgo(3) }, NOW) < 0.55, 'recency: about .5 at three years (TV uses the first air date)');
ok(recencyScore({}, NOW) === 0.3 && recencyScore({ release_date: '2099-01-01' }, NOW) === 0.6 && recencyScore(null, NOW) === 0.3, 'recency: unknown date and not-yet-released are handled');
ok(qualityScore({ vote_average: 9, vote_count: 3 }) < qualityScore({ vote_average: 8, vote_count: 5000 }), 'quality: a few votes do not beat many');
ok(qualityScore({}) > 0.6 && qualityScore({}) < 0.7 && qualityScore(undefined) === qualityScore({}), 'quality: no votes means neutral');

// ranking
const TVSEED = { id: 7, media_type: 'tv', title: 'TV' };
const mk = (id, extra = {}) => ({ id, title: 'T' + id, release_date: yearsAgo(1), vote_average: 7, vote_count: 500, genre_ids: [35], ...extra });
const recs = new Map([
  [keyOf('movie', 1), [mk(10), mk(11), mk(12, { release_date: yearsAgo(20) })]],
  [keyOf('movie', 2), [mk(10), mk(13, { genre_ids: [99] })]],
]);
const r = rankPicks({ seeds: [A, B], recsBySeed: recs, infoBySeed: info, now: NOW });
ok(r[0].item.id === 10 && r[0].n === 2, 'a title recommended from two clippings ranks first');
ok(r[0].seed.id === 1, 'its reason is the newest (strongest) clipping');
ok(r.findIndex(x => x.item.id === 12) > r.findIndex(x => x.item.id === 11), 'same fit but 20 years older ranks lower (recency counts)');
ok(r.findIndex(x => x.item.id === 13) > r.findIndex(x => x.item.id === 11), 'a genre the reader does not follow ranks lower');
const tvr = rankPicks({ seeds: [TVSEED], recsBySeed: new Map([[keyOf('tv', 7), [{ id: 70, name: 'N', first_air_date: yearsAgo(1) }]]]), now: NOW });
ok(tvr[0].item.media_type === 'tv', 'a TV clipping yields TV picks (media type inherited)');
ok(r.every(x => x.item.media_type === 'movie' || x.item.media_type === 'tv'), 'every pick has a media type (inherited from the clipping when missing)');
const keys = r.map(x => keyOf(x.item.media_type, x.item.id));
ok(new Set(keys).size === keys.length, 'no title appears twice');

const ex = rankPicks({ seeds: [A, B], recsBySeed: recs, infoBySeed: info, excludeKeys: new Set([keyOf('movie', 10)]), now: NOW });
ok(!ex.some(x => x.item.id === 10), 'already clipped titles are never suggested');
const op = rankPicks({ seeds: [A, B], recsBySeed: recs, infoBySeed: info, openedKeys: new Set([keyOf('movie', 11)]), now: NOW });
const base = r.find(x => x.item.id === 11).score, opened = op.find(x => x.item.id === 11).score;
ok(opened < base && opened > 0, 'opened titles are still suggested but lower');
const mine = rankPicks({ seeds: [A, B], recsBySeed: recs, infoBySeed: info, onMine: new Set([keyOf('movie', 12)]), now: NOW });
ok(mine.find(x => x.item.id === 12).score > r.find(x => x.item.id === 12).score, 'a title on my services gets a bonus');
ok(rankPicks({ seeds: [], recsBySeed: new Map(), now: NOW }).length === 0 && rankPicks({ seeds: [A], recsBySeed: new Map(), now: NOW }).length === 0, 'no clippings or no recommendations: nothing to rank');
ok(rankPicks({ seeds: [A], recsBySeed: new Map([[keyOf('movie', 1), [null, {}, { id: 'x' }, mk(5)]]]), now: NOW }).length === 1, 'malformed recommendation entries are skipped');
const same = rankPicks({ seeds: [A], recsBySeed: new Map([[keyOf('movie', 1), [mk(30), mk(20)]]]), now: NOW });
ok(same[0].item.id === 20, 'ties break by id: the order is stable');

// adult titles and picture-less titles
const adult = rankPicks({ seeds: [A], recsBySeed: new Map([[keyOf('movie', 1), [mk(40, { adult: true }), mk(41)]]]), now: NOW });
ok(adult.length === 1 && adult[0].item.id === 41, 'adult titles are never suggested');
const pic = rankPicks({ seeds: [A], recsBySeed: new Map([[keyOf('movie', 1), [mk(50), mk(51, { poster_path: '/p.jpg' })]]]), now: NOW });
ok(pic[0].item.id === 51, 'with everything else equal, a title with a poster comes first');

// diversity
const many = new Map([[keyOf('movie', 1), Array.from({ length: 12 }, (_, i) => mk(100 + i, { vote_average: 9 }))], [keyOf('movie', 2), Array.from({ length: 4 }, (_, i) => mk(200 + i, { vote_average: 5 }))]]);
const rr = rankPicks({ seeds: [A, B], recsBySeed: many, infoBySeed: info, now: NOW });
const dv = diversify(rr, { head: 6, perSeed: 3 });
const head = dv.slice(0, 6);
ok(head.filter(x => x.seed.id === 1).length === 3 && head.filter(x => x.seed.id === 2).length === 3, 'diversify: no clipping fills the head alone');
ok(dv.length === rr.length && new Set(dv.map(x => x.item.id)).size === dv.length, 'diversify keeps every pick exactly once');
const one = diversify(rankPicks({ seeds: [A], recsBySeed: many, infoBySeed: info, now: NOW }), { head: 6, perSeed: 3 });
ok(one.slice(0, 6).length === 6 && one.length === 12, 'diversify: with a single clipping the head is still filled');
process.exit(bad ? 1 : 0);

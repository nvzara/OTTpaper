// Unit test for the "Picked for you" ranking. Run: node tests/recommend.mjs
const { seedWeight, posWeight, tasteGenres, recencyScore, qualityScore, trustScore, rankPicks, diversify, leadFirst, keyOf, SEEDS_MAX } = await import('../js/recommend.js');
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
const order = rankPicks({ seeds: [A], recsBySeed: new Map([[keyOf('movie', 1), [mk(30), mk(20)]]]), now: NOW });
ok(order[0].item.id === 30, "TMDB's own order counts: its first recommendation beats its second (all else equal)");
ok(posWeight(0) === 1 && posWeight(5) === 0.5 && posWeight(19) < posWeight(5), 'position weight falls along the list');
ok(trustScore({ vote_count: 0 }) < 0.4 && trustScore({ vote_count: 40 }) > 0.6 && trustScore({ vote_count: 40 }) < 0.7 && trustScore({ vote_count: 600 }) === 1 && trustScore({}) === trustScore({ vote_count: 0 }), 'trust: few votes count for little, 500+ votes for full');
const empty = rankPicks({ seeds: [A, { id: 9, media_type: 'movie', title: 'Nothing' }], recsBySeed: new Map([[keyOf('movie', 1), [mk(60)]]]), infoBySeed: info, now: NOW });
const alone = rankPicks({ seeds: [A], recsBySeed: new Map([[keyOf('movie', 1), [mk(60)]]]), infoBySeed: info, now: NOW });
ok(Math.abs(empty[0].score - alone[0].score) < 1e-9, 'a clipping TMDB knows nothing about does not weaken the others');

// keywords and language
const kwSeed = new Map([[keyOf('movie', 1), [500, 501]]]);
const kwRecs = new Map([[keyOf('movie', 1), [mk(70, { genre_ids: [35] }), mk(71, { genre_ids: [35] })]]]);
const kw1 = rankPicks({ seeds: [A], recsBySeed: kwRecs, keywords: new Map([...kwSeed, [keyOf('movie', 70), [900]], [keyOf('movie', 71), [500, 501]]]), now: NOW });
ok(kw1[0].item.id === 71, 'candidates that share the clipping\'s keywords come first (same position and genres)');
const lg = rankPicks({ seeds: [A], recsBySeed: new Map([[keyOf('movie', 1), [mk(80, { original_language: 'en' }), mk(81, { original_language: 'ja' })]]]), infoBySeed: new Map([[keyOf('movie', 1), { genres: [{ id: 35 }], language: 'ja' }]]), now: NOW });
ok(lg[0].item.id === 81 || lg[0].item.id === 80 && lg[0].score - lg[1].score < 0.2, 'the clipping\'s original language is a (small) plus');
ok(lg.find(x => x.item.id === 81).score > lg.find(x => x.item.id === 80).score * 0.9, 'language fit lifts the matching title');

// the reported failure: two niche clippings have no recommendations, one has a long list; a brand-new obscure title far down the list must not lead
const tv = (id, name, date, vc, g) => ({ id, name, first_air_date: date, vote_average: 7.5, vote_count: vc, genre_ids: g, original_language: 'ja' });
const S3 = [{ id: 1, media_type: 'tv', title: 'Niche One' }, { id: 2, media_type: 'movie', title: 'Niche Two' }, { id: 3, media_type: 'tv', title: 'Fantasy Cooking' }];
const info3 = new Map(S3.map(x => [keyOf(x.media_type, x.id), { genres: [{ id: 16 }, { id: 35 }], language: 'ja' }]));
const list3 = [tv(20, 'Well Known Fit', '2023-09-01', 3000, [16, 10765, 18]), tv(21, 'Also Good', '2022-01-01', 1500, [16, 10765]), ...Array.from({ length: 10 }, (_, i) => tv(30 + i, 'Filler ' + i, '2020-01-01', 200, [16, 10765])), tv(99, 'Brand New Obscure', '2025-10-01', 40, [16, 10765, 35])];
const r3 = rankPicks({ seeds: S3, recsBySeed: new Map([[keyOf('tv', 1), []], [keyOf('movie', 2), []], [keyOf('tv', 3), list3]]), infoBySeed: info3, now: NOW });
ok(r3[0].item.id === 20 && r3.findIndex(x => x.item.id === 99) > 1, 'a well-known title at the top of TMDB\'s list beats a brand-new obscure one far down it');

// lead story: prefer one enough people rated well
const L = [{ item: { id: 1, vote_count: 12, vote_average: 8 } }, { item: { id: 2, vote_count: 900, vote_average: 7.4 } }, { item: { id: 3, vote_count: 900, vote_average: 7 } }];
ok(leadFirst(L).map(x => x.item.id).join() === '2,1,3', 'leadFirst: a well-rated, widely voted title moves ahead of an obscure first place');
ok(leadFirst([L[1], L[0], L[2]]).map(x => x.item.id).join() === '2,1,3', 'leadFirst: leaves the order alone when the first already qualifies');
ok(leadFirst([L[0], { item: { id: 4, vote_count: 5, vote_average: 9 } }]).map(x => x.item.id).join() === '1,4' && leadFirst([]).length === 0, 'leadFirst: unchanged when nothing qualifies, safe on empty');

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

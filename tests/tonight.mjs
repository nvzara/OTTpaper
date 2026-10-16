// Unit test for the "Tonight" picker logic. Run: node tests/tonight.mjs
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { MOODS, resolveProviderIds, buildDiscoverParams, pickOne } = await import('../js/tonight.js');
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const list = [{ provider_id: 8, provider_name: 'Netflix' }, { provider_id: 356, provider_name: 'Wavve' }, { provider_id: 9, provider_name: 'Amazon Prime Video' }, { provider_id: 1, provider_name: 'Other' }];
ok(resolveProviderIds(list, new Set(['netflix', 'wavve'])).join() === '8,356', 'resolves provider ids for my services by name');
ok(resolveProviderIds(list, new Set()).length === 0 && resolveProviderIds(null, new Set(['netflix'])).length === 0, 'no ids for empty input');
const p = buildDiscoverParams({ type: 'movie', mood: 'comedy', maxRuntime: 90, region: 'KR', providerIds: [8, 356] });
ok(p.with_genres === '35' && p['with_runtime.lte'] === '90' && p.watch_region === 'KR', 'discover params: genre, runtime, region');
ok(p.with_watch_providers === '8|356' && p.with_watch_monetization_types === 'flatrate|free|ads', 'discover params: my providers (OR) and monetization types');
const q = buildDiscoverParams({ type: 'tv', mood: 'horror', region: 'US', providerIds: [] });
ok(!('with_genres' in q) && !('with_watch_providers' in q) && !('with_runtime.lte' in q), 'unknown mood / no providers add no filters');
ok(!('horror' in MOODS.tv) && 'horror' in MOODS.movie, 'TV has no horror mood (TMDB genre missing)');
const res = [{ id: 1 }, { id: 2 }, { id: 3 }];
ok(pickOne(res, new Set([1, 2]), () => 0).id === 3, 'pickOne avoids already-shown titles');
ok(pickOne(res, new Set([1, 2, 3]), () => 0.99).id === 3, 'pickOne reuses list when all shown');
ok(pickOne([], new Set()) === null, 'pickOne safe on empty');
process.exit(bad ? 1 : 0);

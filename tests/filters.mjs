// Unit test for search/news filters. Run: node tests/filters.mjs
const { filterSearch, inDecade, yearOf, newsMatches } = await import('../js/filters.js');
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const items = [
  { id: 1, release_date: '2024-05-01', vote_average: 6 }, { id: 2, release_date: '2012-01-01', vote_average: 9 },
  { id: 3, first_air_date: '2005-09-09', vote_average: 7 }, { id: 4, release_date: '1994-01-01', vote_average: 8.5 }, { id: 5, vote_average: 5 }];
ok(yearOf(items[2]) === 2005 && yearOf(items[4]) === null, 'yearOf reads movie and TV dates');
ok(filterSearch(items, { decade: '2020' }).map(i => i.id).join() === '1', '2020s filter');
ok(filterSearch(items, { decade: '2010' }).map(i => i.id).join() === '2', '2010s filter');
ok(filterSearch(items, { decade: '2000' }).map(i => i.id).join() === '3', '2000s filter');
ok(filterSearch(items, { decade: 'old' }).map(i => i.id).join() === '4', 'before-2000 filter');
ok(filterSearch(items, {}).length === 5 && filterSearch(items, { decade: 'any' }).length === 5, 'any keeps everything (incl. unknown year)');
ok(!inDecade(items[4], '2020'), 'unknown year excluded from decade filters');
ok(filterSearch(items, { sort: 'new' }).map(i => i.id).join() === '1,2,3,4,5', 'sort newest (unknown last)');
ok(filterSearch(items, { sort: 'top' }).map(i => i.id).join() === '2,4,3,1,5', 'sort top rated');
ok(filterSearch(items, { sort: 'rel' }).map(i => i.id).join() === '1,2,3,4,5', 'relevance keeps TMDB order');
ok(items[0].id === 1 && items.length === 5, 'does not mutate input');
const n = { title: 'Netflix renews hit', summary: 'Streaming news' };
ok(newsMatches(n, 'all') && newsMatches(n, 'netflix') && !newsMatches(n, 'disney'), 'news chip matching by keyword');
ok(newsMatches({ title: 'HBO Max price', summary: '' }, 'max') && newsMatches({ title: 'x', summary: 'Disney+ bundle' }, 'disney'), 'news keywords: HBO/Max, Disney+');
process.exit(bad ? 1 : 0);

// Country editions of the news wire (pure logic). A feed lists the editions it belongs to: ["*"] = every country (worldwide),
// or country codes such as ["KR"] for a local-language source. Items from local feeds are flagged `local: true`.
export const feedEditions = f => (Array.isArray(f.editions) && f.editions.length ? f.editions : ['*']);
export const inEdition = (f, country) => f.enabled !== false && (feedEditions(f).includes('*') || feedEditions(f).includes(country));

// results: [{ feed, items }] (items already filtered by OTT keywords); returns the newest `max` unique items for one country.
export function assembleEdition(results, country, max = 60) {
  const seen = new Set();
  return results.filter(r => inEdition(r.feed, country))
    .flatMap(r => r.items.map(i => ({ ...i, local: !feedEditions(r.feed).includes('*') })))
    .sort((a, b) => (b.published || '').localeCompare(a.published || ''))
    .filter(i => !seen.has(i.link) && seen.add(i.link)).slice(0, max);
}
export const localSourceCount = (feeds, country) => feeds.filter(f => inEdition(f, country) && !feedEditions(f).includes('*')).length;

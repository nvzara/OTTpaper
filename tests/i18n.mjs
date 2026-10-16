// Checks that ko/en/ja define exactly the same keys and that function entries behave. Run: node tests/i18n.mjs
globalThis.localStorage = { getItem: () => null, setItem() {} };
Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en'] }, configurable: true });
const { D } = await import('../js/i18n.js');
let bad = 0;
const base = Object.keys(D.en).sort();
for (const l of ['ko', 'ja']) {
  const k = Object.keys(D[l]).sort();
  const miss = base.filter(x => !k.includes(x)), extra = k.filter(x => !base.includes(x));
  if (miss.length || extra.length) { bad++; console.log(`FAIL ${l}: missing=${miss} extra=${extra}`); }
  for (const key of base) if (typeof D.en[key] !== typeof D[l][key]) { bad++; console.log(`FAIL ${l}.${key}: type differs from en`); }
  for (const key of base) if (typeof D[l][key] === 'string' && !D[l][key].trim() && key !== 'err_open') { bad++; console.log(`FAIL ${l}.${key}: empty`); }
}
console.log(bad ? 'i18n FAILED' : `PASS i18n: ${base.length} keys identical across en/ko/ja`);
process.exit(bad ? 1 : 0);

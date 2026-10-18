// "Clip a few titles you liked": the invitation on the front page that seeds "Picked for you".
// Tiles are toggle buttons; pressing one clips (or un-clips) that title in the reader's clippings.
import * as T from '../tmdb.js';
import { I } from '../icons.js';
import { clippings, tasteIntro } from '../store.js';
import { t } from '../i18n.js';
import { $, esc, poster, typeLabel, yearOfItem, scriptCls } from '../ui.js';

const keyOf = it => `${it.media_type}:${Number(it.id)}`;
// A title as it is stored in the clippings (the store keeps only well-formed fields).
const clipOf = it => ({ id: it.id, media_type: it.media_type, title: it.title || it.name || '', poster_path: it.poster_path, release_date: it.release_date, first_air_date: it.first_air_date });

export const tasteHtml = () => `<section class="taste" aria-labelledby="tasteH">
  <p class="kicker">${esc(t('taste_k'))}</p>
  <h2 id="tasteH" class="taste-h">${esc(t('taste_h'))}</h2>
  <p class="deck">${esc(t('taste_p'))}</p>
  <form class="tsearch" id="tForm" role="search"><input type="search" id="tQ" maxlength="100" autocomplete="off" placeholder="${esc(t('taste_ph'))}" aria-label="${esc(t('taste_ph'))}"><button class="btn" type="submit">${esc(t('nav_search'))}</button></form>
  <div id="tGrid" class="grid tgrid"><p class="note">${esc(t('loading'))}</p></div>
  <p class="actions taste-act"><span id="tCount" role="status"></span>
    <button class="btn primary" type="button" id="tDone" disabled>${esc(t('taste_done'))}</button>
    <button class="btn" type="button" id="tLater">${esc(t('taste_later'))}</button></p>
</section>`;

const tile = (it, on) => {
  const title = it.title || it.name || '', y = yearOfItem(it);
  return `<button type="button" class="card tile" data-k="${keyOf(it)}" aria-pressed="${on}" aria-label="${esc(`${title}${y ? ' (' + y + ')' : ''}`)}">
    <div class="p">${poster(it.poster_path)}<span class="avail">${I.check()} ${esc(t('taste_clipped'))}</span></div>
    <span class="k">${typeLabel(it.media_type)}${y ? ' · ' + esc(y) : ''}</span><span class="t${scriptCls(title)}">${esc(title)}</span></button>`;
};

// Today's popular titles (trending first, then this country's popular films and series), interleaved and de-duplicated.
async function suggestions() {
  const safe = p => p.then(d => d.results || []).catch(() => []);
  const [tr, mv, tv] = await Promise.all([safe(T.trending()), safe(T.popular('movie')), safe(T.popular('tv'))]);
  const lists = [tr, mv.map(x => ({ ...x, media_type: 'movie' })), tv.map(x => ({ ...x, media_type: 'tv' }))];
  const seen = new Set(), out = [];
  for (let i = 0; out.length < 14 && i < 20; i++) for (const l of lists) {
    const it = l[i];
    if (it && (it.media_type === 'movie' || it.media_type === 'tv') && it.poster_path && !seen.has(keyOf(it))) { seen.add(keyOf(it)); out.push(it); }
  }
  return out.slice(0, 14);
}

// Wires the panel inside `root`. `finished()` is called when the reader is done or postpones.
export function bindTaste(root, { alive, finished }) {
  const grid = $('#tGrid', root), count = $('#tCount', root), done = $('#tDone', root);
  let shown = [], run = 0;
  const refreshCount = () => {
    const n = clippings.list().length;
    count.textContent = n ? t('taste_count', n) : t('taste_none_yet');
    done.disabled = !n;
    grid.querySelectorAll('.tile').forEach(b => b.setAttribute('aria-pressed', clippings.has({ id: +b.dataset.k.split(':')[1], media_type: b.dataset.k.split(':')[0] })));
  };
  const paint = items => {
    shown = items;
    grid.innerHTML = items.length ? items.map(it => tile(it, clippings.has(it))).join('') : `<p class="note">${esc(t('taste_nomatch'))}</p>`;
    refreshCount();
  };
  grid.addEventListener('click', e => {
    const b = e.target.closest('.tile'); if (!b) return;
    const it = shown.find(x => keyOf(x) === b.dataset.k); if (!it) return;
    clippings.toggle(clipOf(it));
    refreshCount();
  });
  const load = async q => {
    const me = ++run;
    grid.innerHTML = `<p class="note">${esc(t(q ? 'searching' : 'loading'))}</p>`;
    try {
      const items = q ? ((await T.search(q)).results || []).filter(x => (x.media_type === 'movie' || x.media_type === 'tv') && x.id).slice(0, 14) : await suggestions();
      if (me === run && alive()) paint(items);
    } catch (e) {
      if (me === run && alive()) grid.innerHTML = `<p class="note">${esc(e.message === 'NO_KEY' || e.message === 'BAD_KEY' ? t('err_nokey') : t('err_load', e.message))}</p>`;
    }
  };
  $('#tForm', root).onsubmit = e => { e.preventDefault(); load($('#tQ', root).value.trim()); };
  done.onclick = () => { tasteIntro.skip(); finished(true); };
  $('#tLater', root).onclick = () => { tasteIntro.skip(); finished(false); };
  refreshCount();
  load('');
}

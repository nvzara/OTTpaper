// View: Clippings + subscription advisor
import * as T from '../tmdb.js';
import { I } from '../icons.js';
import { OTTS, ottName, getSettings, clippings } from '../store.js';
import { computeCoverage } from '../advisor.js';
import { t, getLang, countryName } from '../i18n.js';
import { $, $app, esc, grid, errView } from '../ui.js';

// ---- Clippings (+ subscription advisor) ----
export function clippingsView() {
  const l = clippings.list();
  $app.innerHTML = `<h1 class="page-h">${I.bookmark()} ${t('clips_title')}</h1><p class="note">${t('clips_sub')}</p>` +
    (l.length ? `<p class="actions"><button class="btn primary" id="adv">${I.sparkle()} ${t('adv_btn')}</button><button class="btn" id="print">${I.download()} ${t('print_btn')}</button></p><p class="print-only">${esc(t('print_title', l.length))}</p><div id="advOut" aria-live="polite"></div>${grid(l)}`
      : `<div class="err">${I.info()} ${t('clips_empty')}</div>`);
  if (l.length) { $('#adv').onclick = () => advise(l); $('#print').onclick = () => window.print(); }
}
async function advise(clips) {
  const s = getSettings(), out = $('#advOut'), list = clips.slice(0, 60); // cap requests; provider data is cached 3 days
  const pv = new Map();
  let done = 0, next = 0;
  out.innerHTML = `<p class="note">${esc(t('adv_running', 0, list.length))}</p>`;
  const worker = async () => {
    while (next < list.length) {
      const c = list[next++];
      try { pv.set(`${c.media_type}:${c.id}`, (await T.providers(c.media_type, c.id)).results?.[s.country] || null); }
      catch (e) { if (e.message === 'NO_KEY' || e.message === 'BAD_KEY') throw e; pv.set(`${c.media_type}:${c.id}`, null); }
      out.innerHTML = `<p class="note">${esc(t('adv_running', ++done, list.length))}</p>`;
    }
  };
  try { await Promise.all([worker(), worker(), worker(), worker()]); } catch (e) { out.innerHTML = errView(e); return; }
  const r = computeCoverage(list, pv, new Set(s.myOtts));
  const names = Object.fromEntries(OTTS.map(o => [o.key, ottName(o, getLang())]));
  out.innerHTML = `<section class="panel advisor"><h2>${I.sparkle()} ${t('adv_title')}</h2>
    <p><strong>${esc(t('adv_summary', r.covered, r.withData, r.total - r.withData))}</strong></p>
    <p>${esc(r.best ? t('adv_best', r.best.name, r.best.gain) : t('adv_nobest'))}</p>
    <h3>${t('adv_ranking')}</h3>
    <ol class="rank">${r.ranking.slice(0, 12).map(x => `<li${x.mine ? ' class="mine"' : ''}>
      <span class="rname">${esc(x.key ? names[x.key] : x.name)}${x.mine ? ` <em>(${t('adv_mine')})</em>` : ''}</span>
      <progress value="${x.count}" max="${r.withData || 1}"></progress><span class="rcount">${t('adv_count', x.count, r.withData)}</span>
      <details><summary>${x.titles.length}</summary><div class="rtitles">${x.titles.map(c => `<a href="#/title/${c.media_type}/${Number(c.id)}">${esc(c.title)}</a>`).join(', ')}</div></details></li>`).join('')}</ol>
    ${r.noSub.length ? `<h3>${t('adv_nosub')}</h3><p class="note">${r.noSub.map(c => `<a href="#/title/${c.media_type}/${Number(c.id)}">${esc(c.title)}</a>`).join(', ')}</p>` : ''}
    <p class="note">${esc(t('adv_note', countryName(s.country)))}</p></section>`;
}

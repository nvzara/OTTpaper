// View: Front page (today's lead, right rail, listings tabs)
import * as T from '../tmdb.js';
import { I } from '../icons.js';
import { OTTS, ottName, getSettings, recentViews, clippings, noticeSeen, tasteIntro } from '../store.js';
import { loadPicks } from '../picks.js';
import { tasteHtml, bindTaste } from './taste.js';
import { onMyServices, pickLead } from '../advisor.js';
import { t, getLang } from '../i18n.js';
import { $app, esc, typeLabel, notice, poster, grid, card, errView, $, sec, stars, lede, clip, scriptCls, skGrid, skStory, yearOfItem, httpUrl, viewGuard } from '../ui.js';

let homeTab = 'trending';
const TABS = ['trending', 'movie', 'tv', 'upcoming'];
export function home(forceTaste = false) {
  const rv = recentViews.list().slice(0, 5), clips = clippings.list().length;
  const showTaste = forceTaste || (!tasteIntro.skipped() && clips < 3);   // invite the reader to clip titles they liked
  const open = !noticeSeen.get();
  noticeSeen.set();
  $app.innerHTML = `<h1 class="vh">${t('nav_home')} — OTTpaper</h1>${showTaste ? `<div id="taste">${tasteHtml()}</div>` : ''}<div class="front">
      <div id="lead">${skStory()}</div>
      <aside class="rail">
        ${notice(open)}
        <section class="box inside"><h2 class="box-h">${t('rail_inside')}</h2><ul>
          <li><a href="#/news">${t('nav_news')}</a><span>${t('in_wire')}</span></li>
          <li><a href="#/tonight">${t('nav_tonight')}</a><span>${t('in_tonight')}</span></li>
          <li><a href="#/clippings">${t('nav_clips')}</a><span>${esc(t('in_clips', clips))}</span></li>
          <li><a href="#/settings">${t('nav_settings')}</a><span>${t('in_set')}</span></li></ul></section>
        ${rv.length ? `<section class="box"><h2 class="box-h">${t('recent_views')}</h2><ol class="toc">${rv.map(x => {
          const y = yearOfItem(x);
          return `<li><a href="#/title/${x.media_type}/${Number(x.id)}">${esc(x.title)}</a><span class="k">${typeLabel(x.media_type)}${y ? ' · ' + esc(y) : ''}</span></li>`;
        }).join('')}</ol></section>` : ''}
        <section class="box" id="railWire" hidden></section>
      </aside>
    </div>
    <section class="picks" id="picks" hidden></section>
    <section class="listings">${sec(t('listings'))}
      <div class="tabs" role="tablist">${TABS.map(k => `<button role="tab" data-t="${k}" aria-controls="list" aria-selected="${k === homeTab}">${t('tab_' + k)}</button>`).join('')}</div>
      <div id="list" role="tabpanel"></div></section>`;
  const tabs = [...$app.querySelectorAll('[data-t]')];
  const choose = b => { homeTab = b.dataset.t; tabs.forEach(x => x.setAttribute('aria-selected', x === b)); loadList(); };
  tabs.forEach((b, i) => {
    b.onclick = () => choose(b);
    // Left/right arrows move between tabs (WAI-ARIA tabs pattern)
    b.onkeydown = e => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); choose(n); } };
  });
  loadList();
  renderFront();
  renderWire();
  if (showTaste) bindTaste($('#taste'), { alive: viewGuard(), finished: () => {
    $('#taste').remove();
    if (forceTaste) history.replaceState(null, '', '#/');
    $('#lead').innerHTML = skStory(); $('#picks').hidden = true;
    renderFront();   // the new clippings now shape the front page
  } });
}

async function loadList() {
  const $l = $('#list'), tab = homeTab, alive = viewGuard();
  $l.innerHTML = skGrid(12);
  try {
    const d = tab === 'trending' ? await T.trending() : tab === 'upcoming' ? await T.upcoming() : await T.popular(tab);
    const kind = tab === 'movie' || tab === 'upcoming' ? 'movie' : tab === 'tv' ? 'tv' : null;
    if (tab === homeTab && alive()) $l.innerHTML = grid(d.results, kind);
  } catch (e) { if (tab === homeTab && alive()) $l.innerHTML = errView(e); }
}

// ---- The front page story: markup shared by "Picked for you" and the trending fallback ----
// seconds: [{ x: item, mine: bool, why: string }] shown in columns under the lead.
function frontHtml({ it, d, kicker, on, seconds }) {
  const title = it.title || it.name, href = `#/title/${it.media_type}/${Number(it.id)}`, y = yearOfItem(it);
  const over = clip(d.overview || it.overview || '', 520);
  return `<article class="lead-story">
      <div class="kicker">${esc(kicker)}</div>
      <h2 class="lead-h${scriptCls(title)}"><a href="${href}">${esc(title)}</a></h2>
      ${d.tagline ? `<p class="deck">${esc(d.tagline)}</p>` : ''}
      <p class="byline">${esc(typeLabel(it.media_type))}${y ? ' · ' + esc(y) : ''}${it.vote_average ? ' · ' + stars(it.vote_average) : ''}${on.length ? ` · <b>${esc(t('lead_stream', on.join(', ')))}</b>` : ''}</p>
      <div class="lead-body">
        <figure class="lp"><a href="${href}" tabindex="-1" aria-hidden="true">${poster(it.poster_path, 'w500')}</a><figcaption><span class="credit">${esc(t('photo_credit'))}</span></figcaption></figure>
        ${over ? lede(over) : ''}
        <p class="jump"><a href="${href}">${esc(t('lead_open'))}&nbsp;→</a></p>
      </div></article>
      <div class="seconds">${seconds.map(({ x, mine, why }) => {
        const xt = x.title || x.name, xy = yearOfItem(x);
        return `<article class="second"><p class="kicker">${esc(typeLabel(x.media_type))}${xy ? ' · ' + esc(xy) : ''}</p>
          <h3 class="${scriptCls(xt).trim()}"><a href="#/title/${x.media_type}/${Number(x.id)}">${esc(xt)}</a></h3>${stars(x.vote_average)}${mine ? ` <span class="mine-tag">${I.check()}${esc(t('badge_mine'))}</span>` : ''}${why ? `<p class="why">${esc(why)}</p>` : ''}${x.overview ? `<p>${esc(clip(x.overview, 150))}</p>` : ''}</article>`;
      }).join('')}</div>`;
}
const ottNames = keys => keys.map(k => ottName(OTTS.find(o => o.key === k), getLang()));

// ---- Picked for you: based on the reader's clippings (most relevant + newest first); falls back to today's trending lead ----
let frontNo = 0;   // a newer front page draw (e.g. after the reader finished clipping) supersedes an older one
async function renderFront() {
  const view = viewGuard(), no = ++frontNo, alive = () => view() && no === frontNo;
  let picks = null;
  try { picks = await loadPicks(alive); } catch { /* fall back below */ }
  if (!alive()) return;
  if (!picks) { renderLead(alive); return; }
  try {
    const [top, ...rest] = picks.list;
    const d = await T.detail(top.item.media_type, top.item.id).catch(() => ({}));
    if (!alive() || !$('#lead')) return;
    const why = r => r.n > 1 ? t('rec_because_n', r.seed.title, r.n - 1) : t('rec_because', r.seed.title);
    $('#lead').innerHTML = frontHtml({ it: top.item, d, kicker: `${t('rec_kicker')} · ${why(top)}`, on: ottNames(top.mine),
      seconds: rest.slice(0, 3).map(r => ({ x: r.item, mine: r.mine.length > 0, why: why(r) })) });
    const more = rest.slice(3, 15);
    const box = $('#picks');
    if (box && more.length) {
      box.innerHTML = sec(t('rec_title')) + `<div class="grid">${more.map(r => card({ ...r.item, _why: why(r) })).join('')}</div>`;
      box.hidden = false;
    }
  } catch { renderLead(alive); }
}

// ---- Fallback: today's lead from the trending list, one pick per day (prefers titles on my services) ----
async function renderLead(alive) {
  const el = $('#lead');
  try {
    const s = getSettings(), mine = new Set(s.myOtts);
    const items = (await T.trending()).results.filter(x => x.media_type === 'movie' || x.media_type === 'tv').slice(0, 12);
    const avail = new Map(), names = new Map();
    if (mine.size) {
      let next = 0;
      const worker = async () => { while (next < items.length) { const it = items[next++];
        try { const keys = onMyServices((await T.providers(it.media_type, it.id)).results?.[s.country], mine); avail.set(`${it.media_type}:${it.id}`, keys.length); names.set(`${it.media_type}:${it.id}`, keys); } catch {} } };
      await Promise.all([worker(), worker(), worker(), worker()]);
    }
    if (!alive()) return;
    const day = new Date().toLocaleDateString('en-CA');
    const pick = pickLead(items, avail, day);
    if (!pick || !$('#lead')) { el.innerHTML = ''; return; }
    const it = pick.item, d = await T.detail(it.media_type, it.id);
    if (!alive()) return;
    // Three more stories under the lead: titles on my services first, then the rest of today's trending list.
    const rest = items.filter(x => x !== it), onMine = x => avail.get(`${x.media_type}:${x.id}`) > 0;
    const seconds = [...rest.filter(onMine), ...rest.filter(x => !onMine(x))].slice(0, 3).map(x => ({ x, mine: onMine(x), why: '' }));
    if (!$('#lead')) return;
    $('#lead').innerHTML = frontHtml({ it, d, kicker: `${t('lead_kicker')} · ${pick.onMine ? t('lead_on') : t('lead_any')}`, on: ottNames(names.get(`${it.media_type}:${it.id}`) || []), seconds });
  } catch { if (alive()) el.innerHTML = ''; }
}

// ---- Rail: the latest headlines from this country's edition of The Wire (same-origin file, may be absent) ----
async function renderWire() {
  const alive = viewGuard();
  try {
    const r = await fetch(`news/news.${encodeURIComponent(getSettings().country)}.json`);
    const items = r.ok ? (await r.json())?.items : null;
    const el = $('#railWire');
    if (!alive() || !el || !Array.isArray(items) || !items.length) return;
    el.innerHTML = `<h2 class="box-h">${t('rail_wire')}</h2><ul class="heads">${items.slice(0, 4).map(n => `<li><span class="kicker">${esc(n.source)}</span>
      <a href="${esc(httpUrl(n.link))}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a></li>`).join('')}</ul>
      <p class="jump"><a href="#/news">${t('nav_news')}&nbsp;→</a></p>`;
    el.hidden = false;
  } catch {}
}

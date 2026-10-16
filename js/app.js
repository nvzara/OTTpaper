// OTTpaper entry: page chrome (header/footer text), router, service worker, global shortcuts. Views live in js/views/.
import { I } from './icons.js';
import { getSettings } from './store.js';
import { t, getLang, countryName } from './i18n.js';
import { $, $app, esc, hooks, applyTheme, fmtDate } from './ui.js';
import { home } from './views/home.js';
import { searchView, refreshSuggest } from './views/search.js';
import { detailView } from './views/detail.js';
import { tonightView } from './views/tonight.js';
import { clippingsView } from './views/clippings.js';
import { newsView } from './views/news.js';
import { welcomeView, settingsView } from './views/settings.js';

// ---- Static page chrome (masthead, section index, colophon, title) in the current language ----
const FIRST_ISSUE = Date.UTC(2026, 9, 15);   // No. 1 of the paper
const roman = n => [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
function applyLang() {
  document.documentElement.lang = getLang();
  document.title = t('page_title');
  $('#q').placeholder = t('search_ph');
  $('#q').setAttribute('aria-label', t('nav_search'));
  for (const [id, k] of [['navHome', 'nav_home'], ['navNews', 'nav_news'], ['navTonight', 'nav_tonight'], ['navClips', 'nav_clips'], ['navSet', 'nav_settings']]) {
    const a = $('#' + id); a.textContent = t(k); a.setAttribute('aria-label', t(k));
  }
  $('#skip').textContent = t('skip');
  refreshSuggest();
  // Folio line: volume and issue number, date, and the country edition the reader chose.
  const now = new Date(), issue = Math.max(1, Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - FIRST_ISSUE) / 864e5) + 1);
  const vol = Math.max(1, now.getFullYear() - 2025);
  $('#volno').textContent = t('vol_no', roman(vol), vol, issue);
  $('#dateline').textContent = fmtDate(Date.now(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  $('#edition').textContent = t('edition', countryName(getSettings().country));
  $('#earL').textContent = t('motto');
  $('#earR').innerHTML = `${esc(t('ear_price_l'))}<b>${esc(t('ear_price'))}</b>${esc(t('ear_r'))}`;
  $('#f1').innerHTML = t('f1'); $('#f2').textContent = t('f2'); $('#f3').textContent = t('f3');
}

// ---- Router ----
function route() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  window.scrollTo(0, 0);
  document.title = t('page_title');
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + (parts[0] || '')));
  const first = !getSettings().onboarded;
  if (parts[0] === 'settings') settingsView();
  else if (parts[0] === 'welcome' || first) welcomeView();
  else if (parts[0] === 'search') searchView(new URLSearchParams(qs).get('q'));
  else if (parts[0] === 'news') newsView();
  else if (parts[0] === 'clippings') clippingsView();
  else if (parts[0] === 'tonight') tonightView();
  else if (parts[0] === 'title') detailView(parts[1], parts[2]);
  else home();
}
hooks.applyLang = applyLang;
hooks.route = route;
$('#skip').onclick = e => { e.preventDefault(); $app.focus(); };
$('#searchForm').onsubmit = e => {
  e.preventDefault();
  const q = $('#q').value.trim();
  location.hash = '/search' + (q ? '?q=' + encodeURIComponent(q) : '');
};
$('#searchForm').insertAdjacentHTML('afterbegin', `<span class="si">${I.search()}</span>`);
// Once the masthead scrolls away, the sticky bar shows a small nameplate.
if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => document.documentElement.classList.toggle('stuck', !e.isIntersecting)).observe($('#mast'));
// Offline app shell (same-origin files only; see sw.js)
if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
applyTheme();
applyLang();
// "/" focuses the search box (like many newspaper-style sites and dev tools)
addEventListener('keydown', e => {
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) { e.preventDefault(); $('#q').focus(); }
});
addEventListener('hashchange', route);
route();

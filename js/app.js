// OTTpaper entry: page chrome (header/footer text), router, service worker, global shortcuts. Views live in js/views/.
import { I } from './icons.js';
import { getSettings } from './store.js';
import { t, getLang } from './i18n.js';
import { $, $app, hooks, applyTheme, fmtDate } from './ui.js';
import { home } from './views/home.js';
import { searchView, refreshSuggest } from './views/search.js';
import { detailView } from './views/detail.js';
import { tonightView } from './views/tonight.js';
import { clippingsView } from './views/clippings.js';
import { newsView } from './views/news.js';
import { welcomeView, settingsView } from './views/settings.js';

// ---- Static page chrome (header, footer, title) in the current language ----
function applyLang() {
  document.documentElement.lang = getLang();
  document.title = t('page_title');
  $('#q').placeholder = t('search_ph');
  $('#navHome').innerHTML = I.home() + `<span>${t('nav_home')}</span>`;
  $('#navTonight').innerHTML = I.moon() + `<span>${t('nav_tonight')}</span>`;
  $('#navClips').innerHTML = I.bookmark() + `<span>${t('nav_clips')}</span>`;
  $('#navNews').innerHTML = I.news() + `<span>${t('nav_news')}</span>`;
  $('#navSet').innerHTML = I.settings() + `<span>${t('nav_settings')}</span>`;
  for (const [id, k] of [['navHome', 'nav_home'], ['navNews', 'nav_news'], ['navTonight', 'nav_tonight'], ['navClips', 'nav_clips'], ['navSet', 'nav_settings']]) { $('#' + id).setAttribute('aria-label', t(k)); $('#' + id).title = t(k); }
  $('#skip').textContent = t('skip');
  refreshSuggest();
  $('#dateline').textContent = fmtDate(Date.now(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  $('#edition').textContent = t('edition');
  $('#motto').textContent = t('motto');
  $('#f1').innerHTML = t('f1'); $('#f2').textContent = t('f2'); $('#f3').textContent = t('f3');
}

// ---- Router ----
function route() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  window.scrollTo(0, 0);
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

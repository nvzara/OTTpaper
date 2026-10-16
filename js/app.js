import * as T from './tmdb.js';
import { IMG } from './tmdb.js';
import { OTTS, ottKey, getSettings, saveSettings, recentSearch, recentViews } from './store.js';

const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPE_LABEL = { movie: '영화', tv: 'TV' };
const COUNTRIES = { KR: '한국', US: '미국', JP: '일본', GB: '영국', CA: '캐나다', AU: '오스트레일리아', DE: '독일', FR: '프랑스' };
const KINDS = [['flatrate', '구독'], ['free', '무료'], ['ads', '광고형'], ['rent', '대여'], ['buy', '구매']];

function applyTheme() {
  const t = getSettings().theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

const poster = (p, size = 'w342') => p ? `<img loading="lazy" src="${IMG}${size}${esc(p)}" alt="">` : '';
function card(it) {
  const type = it.media_type || it._type;
  if (type !== 'movie' && type !== 'tv') return '';
  const title = it.title || it.name || '';
  const date = (it.release_date || it.first_air_date || '').slice(0, 4);
  return `<a class="card" href="#/title/${type}/${it.id}"><div class="p">${poster(it.poster_path)}</div>
    <div class="t">${esc(title)}</div><div class="s">${TYPE_LABEL[type]}${date ? ' · ' + esc(date) : ''}</div></a>`;
}
const grid = (items, t) => {
  const h = items.map(i => card(t ? { ...i, _type: t } : i)).join('');
  return h ? `<div class="grid">${h}</div>` : '<p class="note">결과가 없습니다.</p>';
};

function errView(e) {
  if (e.message === 'NO_KEY' || e.message === 'BAD_KEY') {
    const m = e.message === 'NO_KEY' ? 'TMDB API 키가 필요합니다.' : 'API 키가 올바르지 않습니다.';
    return `<div class="err">${m} <a href="#/settings">설정</a>에서 입력해 주세요.</div>`;
  }
  return `<div class="err">불러오지 못했습니다 (${esc(e.message)}). 잠시 후 다시 시도해 주세요.</div>`;
}

// ---- Home ----
const ABOUT = `<details class="about"><summary>About this site</summary>
  <p><b>OTTpaper</b> is a personal search tool for streaming (OTT) titles. Search for a movie or TV show and see
  which services offer it in your country, grouped by subscription, free, ad-supported, rent and buy.</p>
  <p><b>Bring your own token:</b> this site has no server and ships no API key. On your first visit, open
  <a href="#/settings">Settings</a> and enter your own free <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer">TMDB API key or read-access token</a>.
  It is stored only in your browser (localStorage) and sent only to TMDB.</p>
  <p>Your settings, search history and viewing history also stay in your browser. Nothing is collected.
  Data: TMDB; availability: JustWatch via TMDB. No streaming or playback is provided.</p></details>`;
let homeTab = 'trending';
async function home() {
  const tabs = [['trending', '트렌딩'], ['movie', '인기 영화'], ['tv', '인기 TV'], ['upcoming', '공개 예정']];
  const rv = recentViews.list();
  $app.innerHTML = `${ABOUT}<div class="tabs" role="tablist">${tabs.map(([k, l]) =>
    `<button data-t="${k}" aria-pressed="${k === homeTab}">${l}</button>`).join('')}</div>
    <div id="list"><p class="note">불러오는 중…</p></div>
    ${rv.length ? `<h2>최근 조회</h2><div class="grid">${rv.map(card).join('')}</div>` : ''}`;
  $app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { homeTab = b.dataset.t; home(); });
  const $l = document.getElementById('list');
  try {
    const d = homeTab === 'trending' ? await T.trending()
      : homeTab === 'upcoming' ? await T.upcoming() : await T.popular(homeTab);
    const t = homeTab === 'movie' || homeTab === 'upcoming' ? 'movie' : homeTab === 'tv' ? 'tv' : null;
    $l.innerHTML = grid(d.results, t);
  } catch (e) { $l.innerHTML = errView(e); }
}

// ---- Search ----
async function searchView(q) {
  q = (q || '').trim();
  document.getElementById('q').value = q;
  if (!q) {
    const rs = recentSearch.list();
    $app.innerHTML = `<h2>최근 검색어</h2>` + (rs.length
      ? `<div class="chips">${rs.map(s => `<a class="btn" href="#/search?q=${encodeURIComponent(s)}">${esc(s)}</a>`).join('')}</div>`
      : '<p class="note">검색 기록이 없습니다.</p>');
    return;
  }
  recentSearch.add(q, (a, b) => a === b);
  $app.innerHTML = `<h2>“${esc(q)}” 검색 결과</h2><div id="list"><p class="note">검색 중…</p></div>`;
  try {
    const d = await T.search(q);
    const r = d.results.filter(x => x.media_type === 'movie' || x.media_type === 'tv');
    const by = t => r.filter(x => x.media_type === t);
    document.getElementById('list').innerHTML =
      `<h2>영화</h2>${grid(by('movie'))}<h2>TV</h2>${grid(by('tv'))}`;
  } catch (e) { document.getElementById('list').innerHTML = errView(e); }
}

// ---- Detail ----
let kindFilter = 'all';
function certification(d, type, country) {
  if (type === 'movie') {
    const r = d.release_dates?.results?.find(x => x.iso_3166_1 === country);
    return r?.release_dates?.find(x => x.certification)?.certification || '';
  }
  return d.content_ratings?.results?.find(x => x.iso_3166_1 === country)?.rating || '';
}
function provHtml(p, s) {
  if (!p) return '<p class="note">이 국가의 제공 정보가 없습니다.</p>';
  const mine = new Set(s.myOtts);
  const sections = KINDS.filter(([k]) => kindFilter === 'all' || kindFilter === k).map(([k, label]) => {
    const list = (p[k] || []).slice().sort((a, b) => (mine.has(ottKey(b.provider_name)) - mine.has(ottKey(a.provider_name))) || a.display_priority - b.display_priority);
    if (!list.length) return '';
    return `<h3>${label}</h3>` + list.map(x => {
      const key = ottKey(x.provider_name);
      const own = key && mine.has(key);
      const url = key ? OTTS.find(o => o.key === key).url : p.link;
      return `<a class="pill${own ? ' mine' : ''}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(x.provider_name)}${own ? ' ✓' : ''}</a>`;
    }).join('');
  }).join('');
  return (sections || '<p class="note">해당 유형의 제공처가 없습니다.</p>') +
    (p.link ? `<p class="note"><a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">TMDB 시청 페이지에서 작품별 링크 보기</a> (JustWatch 제공)</p>` : '');
}
async function detailView(type, id) {
  if (type !== 'movie' && type !== 'tv' || !/^\d+$/.test(id)) { $app.innerHTML = '<p>잘못된 주소입니다.</p>'; return; }
  $app.innerHTML = '<p class="note">불러오는 중…</p>';
  const s = getSettings();
  try {
    const [d, pv] = await Promise.all([T.detail(type, id), T.providers(type, id)]);
    const title = d.title || d.name;
    recentViews.add({ id: d.id, media_type: type, title, poster_path: d.poster_path,
      release_date: d.release_date, first_air_date: d.first_air_date }, (a, b) => a.id === b.id && a.media_type === b.media_type);
    const cert = certification(d, type, s.country);
    const run = type === 'movie' ? d.runtime : d.episode_run_time?.[0];
    const cast = (d.credits?.cast || []).slice(0, 8).map(c => esc(c.name)).join(', ');
    const meta = [TYPE_LABEL[type], (d.release_date || d.first_air_date || '').slice(0, 4), cert, run ? run + '분' : '',
      d.vote_average ? '★ ' + d.vote_average.toFixed(1) : '',
      type === 'tv' ? `시즌 ${d.number_of_seasons} · ${d.number_of_episodes}화` : '',
      d.status].filter(Boolean).map(esc).join(' · ');
    const pr = pv.results?.[s.country];
    $app.innerHTML = `<div class="detail"><div class="p">${poster(d.poster_path, 'w500')}</div><div>
      <h1>${esc(title)}</h1><div class="meta">${meta}</div>
      <p class="meta">${esc((d.genres || []).map(g => g.name).join(', '))}</p>
      <p>${esc(d.overview) || '<span class="note">줄거리 정보가 없습니다.</span>'}</p>
      ${cast ? `<p class="meta">출연: ${cast}</p>` : ''}
      <h2>볼 수 있는 곳 (${esc(COUNTRIES[s.country] || s.country)})</h2>
      <div class="chips" id="kf">${[['all', '전체'], ...KINDS].map(([k, l]) =>
        `<button data-k="${k}" aria-pressed="${k === kindFilter}">${l}</button>`).join('')}</div>
      <div class="prov" id="prov">${provHtml(pr, s)}</div>
      <p class="note">✓ 초록색은 설정에서 고른 내 OTT입니다. 제공 정보는 JustWatch 기준이며 변동·오류가 있을 수 있고, 구독 여부는 확인하지 않습니다.</p>
      </div></div>`;
    document.querySelectorAll('#kf [data-k]').forEach(b => b.onclick = () => {
      kindFilter = b.dataset.k;
      document.querySelectorAll('#kf [data-k]').forEach(x => x.setAttribute('aria-pressed', x === b));
      document.getElementById('prov').innerHTML = provHtml(pr, s);
    });
  } catch (e) { $app.innerHTML = errView(e); }
}

// ---- Settings ----
function settingsView() {
  const s = getSettings();
  $app.innerHTML = `<div class="set"><h2>설정 / Settings</h2>
    <p class="note">Enter your own TMDB token below. It is stored only in this browser and used only for requests to TMDB.</p>
    <label>TMDB API 키 (v3 키 또는 v4 읽기 토큰)<br><input id="key" type="password" autocomplete="off" value="${esc(s.apiKey)}"></label>
    <p class="note">키는 이 브라우저에만 저장되며 저장소에는 올라가지 않습니다. <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer">TMDB에서 무료 발급</a></p>
    <label>국가<br><select id="country">${Object.entries(COUNTRIES).map(([k, v]) =>
      `<option value="${k}"${k === s.country ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>테마<br><select id="theme">${[['auto', '시스템'], ['light', '라이트'], ['dark', '다크']].map(([k, v]) =>
      `<option value="${k}"${k === s.theme ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <h2>내 OTT</h2>
    ${OTTS.map(o => `<label><input type="checkbox" class="ott" value="${o.key}"${s.myOtts.includes(o.key) ? ' checked' : ''}> ${esc(o.name)}</label>`).join('')}
    <p><button class="btn" id="save">저장</button> <button class="btn" id="clr">기록·캐시 삭제</button> <span id="msg" class="note"></span></p></div>`;
  const msg = t => document.getElementById('msg').textContent = t;
  document.getElementById('save').onclick = () => {
    saveSettings({
      apiKey: document.getElementById('key').value.trim(), country: document.getElementById('country').value,
      theme: document.getElementById('theme').value,
      myOtts: [...document.querySelectorAll('.ott:checked')].map(x => x.value),
    });
    applyTheme(); msg('저장했습니다.');
  };
  document.getElementById('clr').onclick = () => {
    const keep = localStorage.getItem('settings');
    localStorage.clear(); if (keep) localStorage.setItem('settings', keep);
    msg('기록과 캐시를 삭제했습니다.');
  };
}

// ---- Router ----
function route() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  window.scrollTo(0, 0);
  if (parts[0] === 'search') searchView(new URLSearchParams(qs).get('q'));
  else if (parts[0] === 'title') detailView(parts[1], parts[2]);
  else if (parts[0] === 'settings') settingsView();
  else home();
}
document.getElementById('searchForm').onsubmit = e => {
  e.preventDefault();
  const q = document.getElementById('q').value.trim();
  location.hash = '/search' + (q ? '?q=' + encodeURIComponent(q) : '');
};
applyTheme();
addEventListener('hashchange', route);
if (!getSettings().apiKey && !location.hash) location.hash = '/settings';
route();

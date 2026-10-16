import * as T from './tmdb.js';
import { IMG } from './tmdb.js';
import { I } from './icons.js';
import {
  OTTS, COUNTRIES, ottKey, getSettings, saveSettings, recentSearch, recentViews,
  buildBackup, restoreBackup, clearUserData, requestPersistence,
} from './store.js';

const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPE_LABEL = { movie: '영화', tv: 'TV' };
const KINDS = [['flatrate', '구독'], ['free', '무료'], ['ads', '광고형'], ['rent', '대여'], ['buy', '구매']];
const $ = (sel, root = document) => root.querySelector(sel);

function applyTheme() {
  const t = getSettings().theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const NOTICE = `<aside class="notice" aria-label="About and credits">
  <div class="notice-h">${I.heart()}<strong>Free, non-commercial &amp; private</strong></div>
  <p>OTTpaper is a personal hobby project. It earns <b>no revenue</b>, shows <b>no ads</b>, and collects <b>no data</b> —
  your API key, settings and history stay in your own browser. It does not stream, host or download any video.</p>
  <p>Titles, posters and metadata: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>.
  Streaming availability: <a href="https://www.justwatch.com/" target="_blank" rel="noopener noreferrer">JustWatch</a> (via TMDB).
  All trademarks, posters and images belong to their respective owners.
  <em>This product uses the TMDB API but is not endorsed or certified by TMDB.</em></p>
</aside>`;

// ---- Cards ----
const SAFE_IMG = /^\/[\w.-]{1,80}$/;
const poster = (p, size = 'w342') => SAFE_IMG.test(p || '') ? `<img loading="lazy" src="${IMG}${size}${esc(p)}" alt="">` : `<div class="noimg">${I.film()}</div>`;
function card(it) {
  const type = it.media_type || it._type;
  if (type !== 'movie' && type !== 'tv') return '';
  const title = it.title || it.name || '';
  const date = (it.release_date || it.first_air_date || '').slice(0, 4);
  const score = it.vote_average ? `<span class="score">${I.star()}${it.vote_average.toFixed(1)}</span>` : '';
  return `<a class="card" href="#/title/${type}/${Number(it.id)}"><div class="p">${poster(it.poster_path)}${score}</div>
    <div class="t">${esc(title)}</div><div class="s">${TYPE_LABEL[type]}${date ? ' · ' + esc(date) : ''}</div></a>`;
}
const grid = (items, t) => {
  const h = items.map(i => card(t ? { ...i, _type: t } : i)).join('');
  return h ? `<div class="grid">${h}</div>` : '<p class="note">결과가 없습니다.</p>';
};

function errView(e) {
  if (e.message === 'NO_KEY' || e.message === 'BAD_KEY') {
    const m = e.message === 'NO_KEY' ? 'TMDB API 키가 필요합니다.' : 'API 키가 올바르지 않습니다.';
    return `<div class="err">${I.info()} ${m} <a href="#/settings">설정</a>에서 입력해 주세요.</div>`;
  }
  return `<div class="err">${I.info()} 불러오지 못했습니다 (${esc(e.message)}). 잠시 후 다시 시도해 주세요.</div>`;
}

// ---- Settings form (shared by welcome + settings) ----
function formHtml(s) {
  return `
  <section class="panel"><h2>${I.key()} TMDB API 키</h2>
    <label class="fld"><span>API 키 또는 v4 읽기 토큰</span>
      <input id="key" type="password" autocomplete="off" spellcheck="false" value="${esc(s.apiKey)}" placeholder="여기에 붙여넣기"></label>
    <p class="note">키는 이 브라우저에만 저장되며 TMDB로 요청을 보낼 때만 사용됩니다.
      <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer">TMDB에서 무료 발급 ${I.external()}</a></p></section>
  <section class="panel"><h2>${I.globe()} 국가</h2>
    <label class="fld"><span>시청 제공 정보를 볼 국가</span>
      <select id="country">${Object.entries(COUNTRIES).map(([k, v]) =>
        `<option value="${k}"${k === s.country ? ' selected' : ''}>${v}</option>`).join('')}</select></label></section>
  <section class="panel"><h2>${I.tvbox()} 내 OTT</h2>
    <p class="note">구독 중인 서비스를 고르면 상세 화면에서 먼저 표시됩니다.</p>
    <div class="chk">${OTTS.map(o => `<label class="chip"><input type="checkbox" class="ott" value="${o.key}"${s.myOtts.includes(o.key) ? ' checked' : ''}><span>${esc(o.name)}</span></label>`).join('')}</div></section>
  <section class="panel"><h2>${I.palette()} 테마</h2>
    <div class="seg" role="radiogroup" aria-label="테마">${[['auto', '시스템'], ['light', '라이트'], ['dark', '다크']].map(([k, v]) =>
      `<label><input type="radio" name="theme" value="${k}"${k === s.theme ? ' checked' : ''}><span>${v}</span></label>`).join('')}</div></section>`;
}
function readForm() {
  return {
    apiKey: $('#key').value.trim(), country: $('#country').value,
    theme: ($('input[name=theme]:checked') || {}).value || 'auto',
    myOtts: [...document.querySelectorAll('.ott:checked')].map(x => x.value),
  };
}
// Live theme preview while choosing.
const previewTheme = () => document.querySelectorAll('input[name=theme]').forEach(r =>
  r.addEventListener('change', () => { saveSettings({ theme: r.value }); applyTheme(); }));

// ---- Welcome (first visit) ----
function welcomeView() {
  const s = getSettings();
  $app.innerHTML = `<div class="welcome">
    <div class="hero">${I.logo('big')}<h1>Welcome to OTTpaper</h1>
      <p>영화·드라마를 검색하면 <b>어느 OTT에서 볼 수 있는지</b> 한눈에 보여 드려요.</p></div>
    <ol class="steps">
      <li><b>1</b><span>TMDB에서 무료 API 키를 발급받아요.</span></li>
      <li><b>2</b><span>아래에 키와 국가, 내 OTT를 입력해요.</span></li>
      <li><b>3</b><span>저장하면 끝! 다음부터는 바로 메인 화면이 열려요.</span></li></ol>
    ${formHtml(s)}
    <p class="actions"><button class="btn primary" id="start">${I.check()} 시작하기</button></p>
    <p class="note center">설정은 이 브라우저에 저장되고 나중에 <a href="#/settings">설정</a>에서 바꿀 수 있어요.</p>
    ${NOTICE}</div>`;
  previewTheme();
  $('#start').onclick = () => {
    const f = readForm();
    if (!f.apiKey) { toast('API 키를 입력해 주세요.'); $('#key').focus(); return; }
    saveSettings({ ...f, onboarded: true });
    requestPersistence();
    location.hash = '/';
  };
}

// ---- Home ----
let homeTab = 'trending';
async function home() {
  const tabs = [['trending', '트렌딩', I.trending()], ['movie', '인기 영화', I.film()], ['tv', '인기 TV', I.tv()], ['upcoming', '공개 예정', I.calendar()]];
  const rv = recentViews.list();
  $app.innerHTML = `${NOTICE}
    <div class="tabs" role="tablist">${tabs.map(([k, l, ic]) =>
      `<button role="tab" data-t="${k}" aria-pressed="${k === homeTab}">${ic}${l}</button>`).join('')}</div>
    <div id="list"><p class="note">불러오는 중…</p></div>
    ${rv.length ? `<h2 class="sec">${I.clock()} 최근 조회</h2><div class="grid">${rv.map(card).join('')}</div>` : ''}`;
  $app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { homeTab = b.dataset.t; home(); });
  const $l = $('#list');
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
  $('#q').value = q;
  if (!q) {
    const rs = recentSearch.list();
    $app.innerHTML = `<h2 class="sec">${I.clock()} 최근 검색어</h2>` + (rs.length
      ? `<div class="chips">${rs.map(s => `<a class="btn" href="#/search?q=${encodeURIComponent(s)}">${esc(s)}</a>`).join('')}</div>`
      : '<p class="note">검색 기록이 없습니다.</p>');
    return;
  }
  recentSearch.add(q, (a, b) => a === b);
  $app.innerHTML = `<h2 class="sec">${I.search()} “${esc(q)}” 검색 결과</h2><div id="list"><p class="note">검색 중…</p></div>`;
  try {
    const d = await T.search(q);
    const r = d.results.filter(x => x.media_type === 'movie' || x.media_type === 'tv');
    const by = t => r.filter(x => x.media_type === t);
    $('#list').innerHTML = `<h2 class="sec">${I.film()} 영화</h2>${grid(by('movie'))}<h2 class="sec">${I.tv()} TV</h2>${grid(by('tv'))}`;
  } catch (e) { $('#list').innerHTML = errView(e); }
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
    return `<h3>${label}</h3><div class="pills">` + list.map(x => {
      const key = ottKey(x.provider_name);
      const own = key && mine.has(key);
      const url = key ? OTTS.find(o => o.key === key).url : p.link;
      return `<a class="pill${own ? ' mine' : ''}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${own ? I.check() : ''}${esc(x.provider_name)}</a>`;
    }).join('') + '</div>';
  }).join('');
  return (sections || '<p class="note">해당 유형의 제공처가 없습니다.</p>') +
    (p.link ? `<p class="note"><a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">TMDB 시청 페이지에서 작품별 링크 보기 ${I.external()}</a> (JustWatch 제공)</p>` : '');
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
      type === 'tv' ? `시즌 ${d.number_of_seasons} · ${d.number_of_episodes}화` : '', d.status].filter(Boolean).map(esc).join(' · ');
    const pr = pv.results?.[s.country];
    $app.innerHTML = `<div class="detail"><div class="p">${poster(d.poster_path, 'w500')}</div><div>
      <h1>${esc(title)}</h1>
      <div class="meta">${d.vote_average ? `<span class="score inline">${I.star()}${d.vote_average.toFixed(1)}</span> ` : ''}${meta}</div>
      <p class="meta">${esc((d.genres || []).map(g => g.name).join(', '))}</p>
      <p>${esc(d.overview) || '<span class="note">줄거리 정보가 없습니다.</span>'}</p>
      ${cast ? `<p class="meta">출연: ${cast}</p>` : ''}
      <h2 class="sec">${I.tvbox()} 볼 수 있는 곳 (${esc(COUNTRIES[s.country] || s.country)})</h2>
      <div class="chips" id="kf">${[['all', '전체'], ...KINDS].map(([k, l]) =>
        `<button data-k="${k}" aria-pressed="${k === kindFilter}">${l}</button>`).join('')}</div>
      <div class="prov" id="prov">${provHtml(pr, s)}</div>
      <p class="note">${I.check()} 초록색은 설정에서 고른 내 OTT입니다. 제공 정보는 JustWatch 기준이며 변동·오류가 있을 수 있고, 구독 여부는 확인하지 않습니다.</p>
      </div></div>`;
    document.querySelectorAll('#kf [data-k]').forEach(b => b.onclick = () => {
      kindFilter = b.dataset.k;
      document.querySelectorAll('#kf [data-k]').forEach(x => x.setAttribute('aria-pressed', x === b));
      $('#prov').innerHTML = provHtml(pr, s);
    });
  } catch (e) { $app.innerHTML = errView(e); }
}

// ---- Settings ----
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function settingsView() {
  const s = getSettings();
  $app.innerHTML = `<div class="set"><h1>${I.settings()} 설정</h1>
    ${formHtml(s)}
    <p class="actions"><button class="btn primary" id="save">${I.check()} 저장</button></p>
    <section class="panel"><h2>${I.download()} 백업 / 복원</h2>
      <p class="note">브라우저 데이터를 지우면 설정이 사라질 수 있어요. 설정과 기록을 파일 하나로 내려받아 보관하세요.</p>
      <label class="chip inline"><input type="checkbox" id="inclKey" checked><span>API 키 포함</span></label>
      <p class="note warn">백업 파일에 API 키가 들어가면 파일을 타인과 공유하지 마세요.</p>
      <p class="actions"><button class="btn" id="exp">${I.download()} 백업 파일 받기</button>
      <button class="btn" id="imp">${I.upload()} 백업 파일 불러오기</button>
      <input type="file" id="file" accept="application/json,.json" hidden></p></section>
    <section class="panel"><h2>${I.trash()} 기록 삭제</h2>
      <p class="note">최근 검색·조회 기록과 캐시를 지웁니다. 설정과 API 키는 유지됩니다.</p>
      <p class="actions"><button class="btn danger" id="clr">${I.trash()} 기록·캐시 삭제</button></p></section>
    <section class="panel"><h2>${I.info()} 출처 및 라이선스</h2>
      <ul class="credits">
        <li>영화·TV 정보와 이미지: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a> — This product uses the TMDB API but is not endorsed or certified by TMDB.</li>
        <li>시청 제공 정보: <a href="https://www.justwatch.com/" target="_blank" rel="noopener noreferrer">JustWatch</a> (TMDB 경유)</li>
        <li>OTT 이름·상표는 각 소유자의 것이며 로고는 사용하지 않습니다. 이 사이트는 어느 서비스와도 제휴·후원 관계가 아닙니다.</li>
        <li>아이콘은 이 프로젝트를 위해 직접 그렸습니다. 소스 코드는 MIT 라이선스입니다.</li></ul></section></div>`;
  previewTheme();
  $('#save').onclick = () => {
    const f = readForm();
    if (!f.apiKey) { toast('API 키를 입력해 주세요.'); return; }
    saveSettings({ ...f, onboarded: true });
    applyTheme(); requestPersistence(); toast('저장했습니다.');
  };
  $('#exp').onclick = () => {
    const b = buildBackup({ includeKey: $('#inclKey').checked });
    download(`ottpaper-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, null, 2));
    toast('백업 파일을 내려받았습니다.');
  };
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      if (f.size > 1e6) throw new Error('파일이 너무 큽니다.');
      restoreBackup(JSON.parse(await f.text()));
      applyTheme(); toast('복원했습니다.'); settingsView();
    } catch (err) { toast(err instanceof SyntaxError ? '올바른 JSON 파일이 아닙니다.' : err.message); }
  };
  $('#clr').onclick = () => { if (confirm('검색·조회 기록과 캐시를 삭제할까요?')) { clearUserData(); toast('삭제했습니다.'); } };
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
  else if (parts[0] === 'title') detailView(parts[1], parts[2]);
  else home();
}
$('#searchForm').onsubmit = e => {
  e.preventDefault();
  const q = $('#q').value.trim();
  location.hash = '/search' + (q ? '?q=' + encodeURIComponent(q) : '');
};
// Icons for static chrome
$('.brand').insertAdjacentHTML('afterbegin', I.logo());
$('#navHome').innerHTML = I.home() + '<span>홈</span>';
$('#navSet').innerHTML = I.settings() + '<span>설정</span>';
$('#searchForm').insertAdjacentHTML('afterbegin', `<span class="si">${I.search()}</span>`);
applyTheme();
addEventListener('hashchange', route);
route();

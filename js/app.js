// Iqra — UI, routing and views.
import {
  S, $, $$, esc, toAr, todayKey, levelOf, xpFor, streakNow, sr, statusOf, reqLevel, unlocked, day, QUESTS, BADGES, Auth, probe, restore, register, login, logout,
  updateAccount, changePassword, deleteAccount, save, getSurahList, getSurah, getAyahByGlobal, playAyah, playList, stopAudio, bus, toast, sheet, closeSheet, sfx,
  hijri, TOTAL_AYAHS, learnedTotal, masteredTotal, applyTheme, reward, checkBadges,
} from './core.js';
import { PATH, HADITH, ADVICE, DHIKR, LETTERS, THEMES, AVATARS, TITLES, FAST_TYPES } from './content.js';
import { startLesson, openRecite } from './learn.js';
import { openArcade } from './games.js';

let surahList = [], timers = [], rtok = 0, qFilter = 'all', qSearch = '', chartMetric = 'xp', fastMonth = new Date(), shopTab = 'themes';
const app = $('#app');
const title = lv => TITLES[Math.min(TITLES.length - 1, Math.floor((lv - 1) / 5))];
const getErr = e => esc(e && e.message ? e.message : 'Something went wrong');

// =====================================================================
// Auth / onboarding
// =====================================================================
let step = 'welcome', draft = { gender: '', level: '', goalMin: 10 };
const val = id => ($('#' + id)?.value || '').trim();
const logo = `<div class="logo"><svg viewBox="0 0 64 64"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--ac)"/><stop offset="1" stop-color="var(--gold)"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#lg)"/><path d="M40 14a18 18 0 1 0 0 36 14 14 0 1 1 0-36z" fill="#06130f" opacity=".9"/><path d="M22 44h20M32 44V30" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg></div>`;
const chips = (key, opts) => `<div class="chips-row">${opts.map(o => `<button class="pick ${draft[key] === o[0] ? 'on' : ''}" data-act="a-pick" data-k="${key}" data-v="${esc(o[0])}">${esc(o[1])}</button>`).join('')}</div>`;
const AUTH = {
  welcome: () => `${logo}<h1 class="hero-t">Iqra</h1><p class="lead">Learn the Quran like a game.<br>Level up, earn prizes, and master every surah.</p>
    <div class="col-gap"><button class="btn primary" data-act="a-go" data-s="s1">Get started</button><button class="btn" data-act="a-go" data-s="login">I already have an account</button></div>
    ${Auth.remote ? '' : '<p class="muted small center">Cloud sync is not connected, so your account will live on this device.</p>'}`,
  login: () => `<h2>Welcome back</h2><label>Username or email<input id="l-id" autocomplete="username" autocapitalize="none"></label><label>Password<input id="l-pw" type="password" autocomplete="current-password"></label><p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary" data-act="a-login">Sign in</button><button class="btn ghost" data-act="a-go" data-s="welcome">Back</button></div>`,
  s1: () => `<div class="dots"><i class="on"></i><i></i><i></i></div><h2>Let's get to know you</h2><label>Your name<input id="p-name" value="${esc(draft.name || '')}" autocomplete="given-name"></label>
    <label>Age<input id="p-age" type="number" inputmode="numeric" min="5" max="110" value="${esc(draft.age || '')}"></label><label>Gender</label>${chips('gender', [['male', 'Male'], ['female', 'Female'], ['na', 'Prefer not to say']])}<p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary" data-act="a-next1">Next</button><button class="btn ghost" data-act="a-go" data-s="welcome">Back</button></div>`,
  s2: () => `<div class="dots"><i class="on"></i><i class="on"></i><i></i></div><h2>Your Quran journey</h2><label>Where are you now?</label>
    ${chips('level', [['new', '🌱 Brand new to Arabic'], ['letters', '🔤 I know the letters'], ['slow', '📖 I read slowly'], ['fluent', '🚀 I read fluently']])}
    <label>Daily goal</label>${chips('goalMin', [[5, '5 min'], [10, '10 min'], [20, '20 min'], [30, '30 min']])}<p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary" data-act="a-next2">Next</button><button class="btn ghost" data-act="a-go" data-s="s1">Back</button></div>`,
  s3: () => `<div class="dots"><i class="on"></i><i class="on"></i><i class="on"></i></div><h2>Create your account</h2><p class="muted">So your progress follows you on every device.</p>
    <label>Username<input id="r-user" autocomplete="username" autocapitalize="none" placeholder="letters, numbers, _"></label><label>Email<input id="r-email" type="email" autocomplete="email"></label>
    <label>Password<input id="r-pw" type="password" autocomplete="new-password" placeholder="8+ characters"></label><p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary" data-act="a-create">Create account</button><button class="btn ghost" data-act="a-go" data-s="s2">Back</button></div>`,
};
function renderAuth() { document.body.classList.add('authing'); app.innerHTML = `<div class="auth"><div class="auth-card">${AUTH[step]()}</div></div>`; }
const authErr = m => { const e = $('#err'); if (e) e.textContent = m; };

// =====================================================================
// Shell + routing
// =====================================================================
const NAV = [
  ['home', 'Home', '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
  ['quran', 'Quran', '<path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6zM12 6v13"/>'],
  ['progress', 'Progress', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
  ['more', 'More', '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'],
];
async function boot() {
  document.body.classList.remove('authing'); applyTheme();
  app.innerHTML = `<main id="view" class="view"></main><nav class="nav" aria-label="Main"><span class="pill"></span>${NAV.map(n => `<a href="#/${n[0]}" data-tab="${n[0]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${n[2]}</svg><span>${n[1]}</span></a>`).join('')}</nav>`;
  try { surahList = await getSurahList(); } catch { surahList = []; }
  route();
}
function setNav(tab) { const i = NAV.findIndex(n => n[0] === tab); $('.nav .pill')?.style.setProperty('transform', `translateX(${i * 100}%)`); $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab)); }
const VIEWS = {
  home: viewHome, quran: viewQuran, surah: viewSurah, progress: viewProgress, more: viewMore, account: viewAccount, settings: viewSettings, shop: viewShop,
  fasting: viewFasting, hadith: viewHadith, advice: viewAdvice, prayer: viewPrayer, dhikr: viewDhikr, alphabet: viewAlphabet, about: viewAbout,
};
async function route(keep = false) {
  if (!$('#view')) return;
  timers.forEach(clearInterval); timers = [];
  let [a = 'home', b] = (location.hash.slice(2) || 'home').split('/');
  if (a === 'more' && b && VIEWS[b]) { a = b; b = undefined; }
  const tab = { home: 'home', quran: 'quran', surah: 'quran', progress: 'progress' }[a] || 'more'; setNav(tab);
  const tok = ++rtok, y = window.scrollY;
  const fn = VIEWS[a] || viewHome; $('#view').dataset.v = a;
  try {
    const out = await fn(b); if (tok !== rtok) return;
    $('#view').innerHTML = out.html; out.after && out.after();
    window.scrollTo(0, keep ? y : 0);
  } catch (e) { if (tok === rtok) $('#view').innerHTML = `<div class="card center"><h3>Couldn't load</h3><p class="muted">${getErr(e)}</p><p class="muted small">Check your connection, then retry.</p><button class="btn primary" data-act="retry">Retry</button></div>`; }
}
window.addEventListener('hashchange', () => { closeSheet(); route(); });
window.addEventListener('iqra-refresh', () => { if ($('#view')) route(true); });

// =====================================================================
// Shared bits
// =====================================================================
function ring(p, size = 96, label = '', sub = '') {
  const r = size / 2 - 8, c = 2 * Math.PI * r;
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="rb"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="rf" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, p))}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><div class="rl"><b>${label}</b><small>${sub}</small></div></div>`;
}
const back = (to = '#/more', t = 'More') => `<a class="back" href="${to}">‹ ${t}</a>`;
const stIcon = s => ({ mastered: '🏅', learned: '✅', learning: '◐', new: '' }[s]);

// =====================================================================
// Home
// =====================================================================
function nextSurah() {
  if (!surahList.length) return null;
  const started = surahList.find(s => { const r = S.surahs[s.n]; return r && r.learned.length && !r.done; });
  if (started) return { s: started, mode: 'learn' };
  const toMaster = surahList.find(s => statusOf(s.n) === 'learned');
  if (toMaster) return { s: toMaster, mode: 'master' };
  for (const n of PATH) { const s = surahList[n - 1]; if (s && statusOf(n) === 'new' && unlocked(s)) return { s, mode: 'learn' }; }
  return null;
}
async function viewHome() {
  const p = S.profile || {}, lv = levelOf(S.xp), lo = xpFor(lv), hi = xpFor(lv + 1), d = day(), goal = (p.goalMin || 10) * 10, hj = hijri(), nx = nextSurah();
  const beginner = p.level === 'new' && !S.alphabetDone;
  let cont = '';
  if (nx) {
    const r = S.surahs[nx.s.n], l = r ? r.learned.length : 0, pc = Math.round(l / nx.s.count * 100);
    cont = `<section class="card continue"><small class="eyebrow">${nx.mode === 'master' ? 'Ready for mastery' : l ? 'Continue learning' : 'Up next'}</small><div class="row-between"><div><h3>${esc(nx.s.en)}</h3><p class="muted">${esc(nx.s.tr)} · ${nx.s.count} ayahs</p></div><div class="ar sname">${esc(nx.s.ar)}</div></div>
      <div class="progress"><i style="width:${nx.mode === 'master' ? 100 : pc}%"></i></div><div class="row-gap"><button class="btn primary grow" data-act="${nx.mode === 'master' ? 'recite' : 'learn'}" data-n="${nx.s.n}">${nx.mode === 'master' ? '🎙️ Recite for mastery' : l ? 'Continue lesson' : 'Start lesson'}</button><a class="btn" href="#/surah/${nx.s.n}">Open</a></div></section>`;
  } else cont = `<section class="card continue"><h3>Start your journey</h3><p class="muted">Pick any surah from the Quran tab.</p><a class="btn primary" href="#/quran">Browse the Quran</a></section>`;
  return {
    html: `<header class="top"><div class="who"><div class="avatar">${S.settings.avatar}</div><div><small class="muted">${hj ? esc(hj.text) : ''}</small><h1>Assalamu alaykum, ${esc(p.name || 'friend')}</h1></div></div><div class="chips"><span class="chip">🔥 ${streakNow()}</span><span class="chip gold">🪙 ${S.coins}</span></div></header>
    <section class="card hero"><div class="hero-l"><small class="eyebrow">Level ${lv} · ${title(lv)}</small><div class="xpbar"><i style="width:${Math.round((S.xp - lo) / (hi - lo) * 100)}%"></i></div><small class="muted">${S.xp - lo} / ${hi - lo} XP to level ${lv + 1}</small></div>${ring(d.xp / goal, 92, Math.min(100, Math.round(d.xp / goal * 100)) + '%', 'daily goal')}</section>
    ${cont}
    ${beginner ? `<a class="card tip" href="#/more/alphabet"><span>🔤</span><div><b>New to Arabic? Start with the alphabet</b><small class="muted">28 letters, 5 minutes. Then play the letter games.</small></div></a>` : ''}
    <section class="card"><div class="row-between"><h3>Daily quests</h3><small class="muted">resets at midnight</small></div>${QUESTS.map(q => { const v = Math.min(q.g, d[q.k]); return `<div class="quest ${v >= q.g ? 'done' : ''}"><span>${v >= q.g ? '✅' : '🎯'}</span><div class="grow"><b>${q.t}</b><div class="progress thin"><i style="width:${v / q.g * 100}%"></i></div></div><small>🪙 ${q.c}</small></div>`; }).join('')}</section>
    <section class="tiles"><button class="tile" data-act="arcade"><span>🎮</span><b>Break Room</b><small>3 arcade games</small></button><a class="tile" href="#/more/dhikr"><span>📿</span><b>Dhikr</b><small>Tasbih counter</small></a><a class="tile" href="#/more/prayer"><span>🕌</span><b>Prayer times</b><small>Next prayer</small></a></section>
    <section class="card daily" id="daily"><small class="eyebrow">Ayah of the day</small><div class="skeleton"></div></section>`,
    after: loadDaily,
  };
}
async function loadDaily() {
  const box = $('#daily'); if (!box) return;
  try {
    const g = 1 + (Math.floor(Date.now() / 864e5) * 997) % TOTAL_AYAHS, a = await getAyahByGlobal(g); if (!$('#daily')) return;
    box.innerHTML = `<small class="eyebrow">Ayah of the day · ${esc(a.surah)} ${a.n}</small><div class="ar daily-ar" dir="rtl">${esc(a.ar)}</div><p class="en">${esc(a.en)}</p><div class="row-gap"><button class="btn small" data-act="play-ayah" data-g="${a.g}">🔊 Listen</button><a class="btn small ghost" href="#/surah/${a.sn}">Open surah</a></div>`;
  } catch { box.innerHTML = `<small class="eyebrow">Ayah of the day</small><p class="muted">Connect to the internet to load today's ayah.</p>`; }
}

// =====================================================================
// Quran list + surah page
// =====================================================================
function surahRow(s) {
  const st = statusOf(s.n), lock = !unlocked(s), r = S.surahs[s.n], pc = r ? Math.round(r.learned.length / s.count * 100) : 0;
  return `<a class="srow ${st} ${lock ? 'locked' : ''}" href="#/surah/${s.n}"><span class="snum"><b>${s.n}</b></span><div class="sinfo"><b>${esc(s.en)}</b><small>${esc(s.tr)} · ${s.count} ayahs · ${esc(s.type)}</small>${st === 'learning' ? `<div class="progress thin"><i style="width:${pc}%"></i></div>` : ''}</div><div class="sright"><span class="ar sname">${esc(s.ar)}</span>${lock ? `<small class="lockt">🔒 Lv ${reqLevel(s.count)}</small>` : `<i class="stat">${stIcon(st)}</i>`}</div></a>`;
}
function filteredSurahs() {
  let l = surahList; const q = qSearch.toLowerCase().trim();
  if (qFilter === 'path') l = PATH.map(n => surahList[n - 1]).filter(Boolean); else if (qFilter !== 'all') l = l.filter(s => statusOf(s.n) === qFilter);
  if (q) l = l.filter(s => s.en.toLowerCase().includes(q) || s.tr.toLowerCase().includes(q) || String(s.n) === q || s.ar.includes(q));
  return l;
}
async function viewQuran() {
  if (!surahList.length) surahList = await getSurahList();
  const F = [['all', 'All'], ['path', 'Path'], ['learning', 'Learning'], ['learned', 'Learned'], ['mastered', 'Mastered']];
  return {
    html: `<header class="top"><h1>Quran</h1><span class="chip">${learnedTotal()} / ${TOTAL_AYAHS} ayahs</span></header>
    <input class="search" id="qsearch" placeholder="Search 114 surahs…" value="${esc(qSearch)}" type="search"><div class="chips-row scroll">${F.map(f => `<button class="pick ${qFilter === f[0] ? 'on' : ''}" data-act="filter" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
    <div class="slist" id="qlist">${listHTML()}</div>`,
  };
}
const listHTML = () => filteredSurahs().map(surahRow).join('') || '<p class="muted center">Nothing here yet.</p>';
const ayahHTML = (a, learned) => `<article class="ayah ${learned ? 'learned' : ''}" data-g="${a.g}"><div class="ayah-top"><span class="num">${a.n}</span><button class="icon-btn sm" data-act="play-ayah" data-g="${a.g}" aria-label="Play">▶</button>${learned ? '<span class="chk">✓</span>' : ''}</div><p class="ar" dir="rtl">${esc(a.ar)}</p>${S.settings.translit ? `<p class="tl">${esc(a.tr)}</p>` : ''}${S.settings.translation ? `<p class="en">${esc(a.en)}</p>` : ''}</article>`;
async function viewSurah(n) {
  n = +n; if (!surahList.length) surahList = await getSurahList();
  const s = surahList[n - 1]; if (!s) return { html: `${back('#/quran', 'Quran')}<p class="muted">Surah not found.</p>` };
  const ayahs = await getSurah(n), r = S.surahs[n], st = statusOf(n), l = r ? r.learned.length : 0, lock = !unlocked(s);
  const lessons = Math.ceil(s.count / 20), lessonNo = Math.min(lessons, Math.floor(l / 20) + 1), parts = r ? Object.keys(r.parts).length : 0;
  const act = lock ? `<div class="banner">🔒 Reach <b>level ${reqLevel(s.count)}</b> to unlock (you're level ${levelOf(S.xp)}). You can also turn on <a href="#/more/settings">Explorer mode</a>.</div>`
    : `<div class="col-gap">${st === 'learned' || st === 'mastered' ? `<button class="btn primary" data-act="recite" data-n="${n}">🎙️ ${st === 'mastered' ? 'Recite again' : 'Recite for mastery'}</button>` : `<button class="btn primary" data-act="learn" data-n="${n}">${l ? `Continue · lesson ${lessonNo}/${lessons}` : 'Start learning'}</button>`}<button class="btn" data-act="play-surah" data-n="${n}">▶ Listen to the surah</button></div>`;
  return {
    html: `${back('#/quran', 'Quran')}<section class="card surah-head ${st}"><div class="ar big-name">${esc(s.ar)}</div><h2>${esc(s.en)}</h2><p class="muted">${esc(s.tr)} · ${esc(s.type)} · ${s.count} ayahs</p>
      <div class="progress"><i style="width:${l / s.count * 100}%"></i></div><p class="muted small">${st === 'mastered' ? '🏅 Mastered' : st === 'learned' ? '✅ Learned — recite it to master it' : `${l} of ${s.count} ayahs learned`}${parts && st !== 'mastered' ? ` · ${parts} part(s) passed` : ''}</p>${act}</section>
      ${n !== 1 && n !== 9 ? '<div class="bismillah ar">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>' : ''}<div class="ayahs">${ayahs.map(a => ayahHTML(a, r && r.learned.includes(a.n))).join('')}</div>`,
  };
}
bus.addEventListener('audio', e => { $$('.ayah.playing, .playing-now').forEach(x => x.classList.remove('playing', 'playing-now')); if (e.detail) $$(`.ayah[data-g="${e.detail}"]`).forEach(x => { x.classList.add('playing'); x.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }); });

// =====================================================================
// Progress
// =====================================================================
function barChart(vals, labels) {
  const W = 320, H = 130, bw = 28, gap = (W - 7 * bw) / 8, max = Math.max(1, ...vals);
  return `<svg viewBox="0 0 ${W} ${H + 24}" class="chart">${vals.map((v, i) => { const h = Math.round(v / max * H), x = gap + i * (bw + gap); return `<rect x="${x}" y="${H - h}" width="${bw}" height="${h || 3}" rx="8" class="cbar ${i === 6 ? 'today' : ''}"/><text x="${x + bw / 2}" y="${H + 17}" text-anchor="middle">${labels[i]}</text>${v ? `<text x="${x + bw / 2}" y="${H - h - 5}" text-anchor="middle" class="val">${v}</text>` : ''}`; }).join('')}</svg>`;
}
async function viewProgress() {
  if (!surahList.length) surahList = await getSurahList();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); return { k: todayKey(d), l: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()] }; });
  const vals = days.map(d => (S.daily[d.k] || {})[chartMetric] || 0), lv = levelOf(S.xp), lt = learnedTotal(), mt = masteredTotal();
  const doneN = surahList.filter(s => ['learned', 'mastered'].includes(statusOf(s.n))).length, mastered = surahList.filter(s => statusOf(s.n) === 'mastered');
  const M = [['xp', 'XP'], ['ayahs', 'Ayahs'], ['minutes', 'Minutes']];
  return {
    html: `<header class="top"><h1>Progress</h1><span class="chip">Lv ${lv} · ${title(lv)}</span></header>
    <section class="stats4"><div class="card stat"><b>${S.xp}</b><small>total XP</small></div><div class="card stat"><b>🔥 ${streakNow()}</b><small>day streak</small></div><div class="card stat"><b>${lt}</b><small>ayahs learned</small></div><div class="card stat"><b>${mt}</b><small>surahs mastered</small></div></section>
    <section class="card"><div class="row-between"><h3>This week</h3><div class="chips-row tight">${M.map(m => `<button class="pick sm ${chartMetric === m[0] ? 'on' : ''}" data-act="metric" data-m="${m[0]}">${m[1]}</button>`).join('')}</div></div>${barChart(vals, days.map(d => d.l))}</section>
    <section class="card rings"><div>${ring(lt / TOTAL_AYAHS, 104, (lt / TOTAL_AYAHS * 100).toFixed(1) + '%', 'of the Quran')}</div><div>${ring(doneN / 114, 104, doneN + '/114', 'learned')}</div><div>${ring(mt / 114, 104, mt + '/114', 'mastered')}</div></section>
    <section class="card"><h3>All 114 surahs</h3><div class="legend"><span><i class="c new"></i>new</span><span><i class="c learning"></i>learning</span><span><i class="c learned"></i>learned</span><span><i class="c mastered"></i>mastered</span></div><div class="grid114">${surahList.map(s => `<a class="cell ${statusOf(s.n)}" href="#/surah/${s.n}" title="${esc(s.en)}">${s.n}</a>`).join('')}</div></section>
    <section class="card"><h3>Mastery</h3>${mastered.length ? mastered.map(s => `<a class="mrow" href="#/surah/${s.n}"><span>🏅</span><div class="grow"><b>${esc(s.en)}</b><small class="muted">${new Date(S.surahs[s.n].masteredAt || Date.now()).toLocaleDateString()}</small></div><b class="ok-t">${S.surahs[s.n].best || 100}%</b></a>`).join('') : '<p class="muted">No surah mastered yet. Learn one, then recite it perfectly to the AI coach.</p>'}</section>
    <section class="card"><h3>Badges <small class="muted">${Object.keys(S.badges).length}/${BADGES.length}</small></h3><div class="badges">${BADGES.map(b => `<div class="badge ${S.badges[b.id] ? 'got' : ''}" title="${esc(b.d)}"><span>${S.badges[b.id] ? b.i : '🔒'}</span><b>${esc(b.n)}</b><small>${esc(b.d)}</small></div>`).join('')}</div></section>`,
  };
}

// =====================================================================
// More + sub pages
// =====================================================================
function viewMore() {
  const rows = [['account', '👤', 'Account', 'Profile & sign-in details'], ['shop', '🛍️', 'Rewards shop', `${S.coins} coins to spend`], ['fasting', '🌙', 'Fasting log', 'Track your fasts'], ['hadith', '📜', 'Hadith', 'Daily wisdom'], ['advice', '💡', 'Learning advice', 'Memorization tips'],
    ['prayer', '🕌', 'Prayer times', 'Next prayer countdown'], ['dhikr', '📿', 'Dhikr counter', 'Tasbih'], ['alphabet', '🔤', 'Arabic alphabet', 'Letters & sounds'], ['settings', '⚙️', 'Settings', 'Reciter, text, sound'], ['about', 'ℹ️', 'About Iqra', 'Tips & the AI coach']];
  return { html: `<header class="top"><h1>More</h1></header><div class="card list">${rows.map(r => `<a class="lrow" href="#/more/${r[0]}"><span class="ico">${r[1]}</span><div class="grow"><b>${r[2]}</b><small class="muted">${r[3]}</small></div><i>›</i></a>`).join('')}</div>` };
}

function viewAccount() {
  const p = S.profile || {};
  return {
    html: `${back()}<h2>Account</h2><p class="muted small">${Auth.remote ? '☁️ Synced across your devices' : '📱 Stored on this device only (cloud sync not connected)'}</p>
    <section class="card form"><h3>About you</h3><label>Name<input id="a-name" value="${esc(p.name || '')}"></label><label>Age<input id="a-age" type="number" value="${esc(p.age || '')}"></label>
    <label>Gender<select id="a-gender"><option value="male" ${p.gender === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.gender === 'female' ? 'selected' : ''}>Female</option><option value="na" ${p.gender === 'na' ? 'selected' : ''}>Prefer not to say</option></select></label>
    <label>Daily goal<select id="a-goal">${[5, 10, 20, 30].map(g => `<option value="${g}" ${(p.goalMin || 10) === g ? 'selected' : ''}>${g} minutes</option>`).join('')}</select></label><button class="btn primary" data-act="save-profile">Save</button></section>
    <section class="card form"><div class="row-between"><h3>Sign-in details</h3><button class="btn small" data-act="toggle-secret" id="tg">Show</button></div><p class="muted small">Hidden by default for privacy.</p>
    <div id="secret" hidden><label>Username<input id="s-user" value="${esc(Auth.username)}" autocapitalize="none"></label><label>Email<input id="s-email" type="email" value="${esc(Auth.email)}"></label><button class="btn" data-act="save-signin">Update username &amp; email</button>
    <hr><label>Current password<input id="s-cur" type="password" autocomplete="current-password"></label><label>New password<input id="s-new" type="password" autocomplete="new-password" placeholder="8+ characters"></label><button class="btn" data-act="save-pw">Change password</button></div></section>
    <section class="card form"><h3>Your data</h3><div class="col-gap"><button class="btn" data-act="export">⬇️ Export my progress</button><button class="btn" data-act="logout">Sign out</button><button class="btn danger-o" data-act="delete-acct">Delete account</button></div></section>`,
  };
}
function viewSettings() {
  const s = S.settings, tg = (k, t, d) => `<label class="switch-row"><span><b>${t}</b><small class="muted">${d}</small></span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
  return {
    html: `${back()}<h2>Settings</h2><section class="card form">${tg('translation', 'English translation', 'Show meaning under each ayah')}${tg('translit', 'Transliteration', 'Show Latin letters to help reading')}${tg('sound', 'Sound effects', 'Game sounds')}${tg('openAll', 'Explorer mode', 'Unlock every surah regardless of level')}
    <label>Arabic text size <output id="fso">${s.fontSize}px</output><input type="range" min="22" max="48" value="${s.fontSize}" data-set="fontSize"></label>
    <label>Reciter<select data-set="reciter">${[['ar.alafasy', 'Mishary Alafasy'], ['ar.husary', 'Mahmoud Khalil Al-Husary'], ['ar.minshawi', 'Mohamed Siddiq El-Minshawi'], ['ar.abdulbasitmurattal', 'Abdul Basit (Murattal)']].map(r => `<option value="${r[0]}" ${s.reciter === r[0] ? 'selected' : ''}>${r[1]}</option>`).join('')}</select></label></section>
    <p class="ar preview" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>`,
  };
}
function viewShop() {
  const lv = levelOf(S.xp), items = shopTab === 'themes' ? THEMES : AVATARS, own = shopTab === 'themes' ? S.owned.themes : S.owned.avatars, cur = shopTab === 'themes' ? S.settings.theme : S.settings.avatar;
  const card = it => { const owned = own.includes(it.id), eq = cur === it.id, lock = lv < it.lvl;
    return `<div class="shopi ${eq ? 'eq' : ''}"><div class="prev">${shopTab === 'themes' ? `<i class="sw" data-theme="${it.id}"></i>` : it.id}</div><b>${shopTab === 'themes' ? it.name : ''}</b>${owned ? `<button class="btn small ${eq ? '' : 'primary'}" data-act="equip" data-id="${esc(it.id)}" ${eq ? 'disabled' : ''}>${eq ? 'Equipped' : 'Equip'}</button>` : lock ? `<small class="muted">🔒 Level ${it.lvl}</small>` : `<button class="btn small gold" data-act="buy" data-id="${esc(it.id)}" ${S.coins < it.cost ? 'disabled' : ''}>🪙 ${it.cost}</button>`}</div>`; };
  return { html: `${back()}<header class="top"><h2>Rewards shop</h2><span class="chip gold">🪙 ${S.coins}</span></header><p class="muted">Earn coins from lessons, quests and break games. Items unlock as you level up.</p><div class="chips-row"><button class="pick ${shopTab === 'themes' ? 'on' : ''}" data-act="shop-tab" data-t="themes">Themes</button><button class="pick ${shopTab === 'avatars' ? 'on' : ''}" data-act="shop-tab" data-t="avatars">Avatars</button></div><div class="shopgrid">${items.map(card).join('')}</div>` };
}

// ----- fasting -----
function fastHint(d) {
  const h = hijri(d), out = []; if (!h) return out;
  if (h.m === 9) out.push('Ramadan'); if (h.d >= 13 && h.d <= 15 && h.m !== 9) out.push('White day'); if (h.m === 12 && h.d === 9) out.push('Day of Arafah'); if (h.m === 1 && (h.d === 9 || h.d === 10)) out.push('Ashura season');
  if ([1, 4].includes(d.getDay()) && h.m !== 9) out.push(d.getDay() === 1 ? 'Monday' : 'Thursday'); return out;
}
function viewFasting() {
  const y = fastMonth.getFullYear(), m = fastMonth.getMonth(), first = new Date(y, m, 1), n = new Date(y, m + 1, 0).getDate(), pad = first.getDay(), tk = todayKey();
  const cells = []; for (let i = 0; i < pad; i++) cells.push('<span></span>');
  for (let d = 1; d <= n; d++) { const k = todayKey(new Date(y, m, d)), f = S.fasts[k]; cells.push(`<button class="day ${f ? 'f' : ''} ${k === tk ? 'today' : ''}" data-act="fast-day" data-d="${k}">${d}${f ? '<i></i>' : ''}</button>`); }
  const total = Object.keys(S.fasts).length, inMonth = Object.keys(S.fasts).filter(k => k.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).length;
  let streak = 0; for (let i = 0; i < 400; i++) { const k = todayKey(new Date(Date.now() - i * 864e5)); if (S.fasts[k]) streak++; else if (i > 0) break; }
  const hints = fastHint(new Date()), hj = hijri();
  return { html: `${back()}<h2>Fasting log</h2><section class="card"><small class="eyebrow">${hj ? esc(hj.text) : ''}</small><p>${hints.length ? `Today: <b>${hints.join(' · ')}</b> — a recommended day to fast.` : 'No special fasting day today.'}</p></section>
    <section class="stats3"><div class="card stat"><b>${inMonth}</b><small>this month</small></div><div class="card stat"><b>${total}</b><small>all time</small></div><div class="card stat"><b>${streak}</b><small>day streak</small></div></section>
    <section class="card"><div class="row-between"><button class="icon-btn" data-act="fast-prev">‹</button><b>${first.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</b><button class="icon-btn" data-act="fast-next">›</button></div><div class="cal-h">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<span>${x}</span>`).join('')}</div><div class="cal">${cells.join('')}</div><p class="muted small center">Tap a day to log or clear a fast.</p></section>` };
}

function viewHadith() {
  const dayN = Math.floor(Date.now() / 864e5), h = HADITH[dayN % HADITH.length];
  return { html: `${back()}<h2>Hadith</h2><section class="card hadith-today"><small class="eyebrow">Hadith of the day</small><p class="quote">“${esc(h.t)}”</p><small class="muted">${esc(h.s)}</small></section>
    <p class="muted small">Plain-English summaries of well-known hadith. Always check exact wording in the cited collection.</p>${HADITH.map((x, i) => `<article class="card hadith"><p>${esc(x.t)}</p><div class="row-between"><small class="muted">${esc(x.s)}</small><button class="icon-btn sm ${S.favs.includes(i) ? 'fav' : ''}" data-act="fav" data-i="${i}" aria-label="Favourite">${S.favs.includes(i) ? '♥' : '♡'}</button></div></article>`).join('')}` };
}
function viewAdvice() {
  const cats = [...new Set(ADVICE.map(a => a.c))];
  return { html: `${back()}<h2>Learning advice</h2>${cats.map(c => `<h3 class="sec">${c}</h3>${ADVICE.filter(a => a.c === c).map(a => `<article class="card advice"><span>${a.i}</span><div><b>${esc(a.t)}</b><p class="muted">${esc(a.d)}</p></div></article>`).join('')}`).join('')}` };
}
function viewAbout() {
  return { html: `${back()}<h2>About Iqra</h2><section class="card"><h3>How it works</h3><p>Learn a surah in lessons of up to 20 ayahs. Finish a lesson (or the surah, whichever comes first) and unlock a quick arcade break. When a surah is fully learned, recite it to the AI coach to earn <b>Mastery</b>.</p></section>
    <section class="card"><h3>About the AI coach</h3><p>Your recording is transcribed, compared word-by-word with the mushaf, and reviewed by an AI for pronunciation and tajweed. It is a helpful practice partner: it catches wrong, missing or mispronounced words, and reminds you of tajweed rules. Fine details like exact madd length need a qualified teacher.</p><p class="muted small">AI coach: ${Auth.groq ? '🟢 connected' : '⚪ not connected'} · Cloud sync: ${Auth.remote ? '🟢 on' : '⚪ off'}</p></section>
    <section class="card"><h3>Credits</h3><p class="muted small">Quran text, translation (Sahih International) and audio via alquran.cloud and Islamic Network CDN.</p></section>` };
}

// ----- prayer times -----
async function viewPrayer() {
  return { html: `${back()}<h2>Prayer times</h2><section class="card" id="pt"><p class="muted">Loading…</p></section>`, after: loadPrayer };
}
async function loadPrayer(force) {
  const box = $('#pt'); if (!box) return;
  let loc = null; try { loc = JSON.parse(localStorage.getItem('iqra_loc')); } catch { /* none */ }
  if (!loc) { box.innerHTML = `<p>Show prayer times for your location.</p><div class="col-gap"><button class="btn primary" data-act="prayer-locate">📍 Use my location</button></div><p class="muted center">or</p><div class="form"><label>City<input id="pc-city"></label><label>Country<input id="pc-country"></label><button class="btn" data-act="prayer-city">Use city</button></div>`; return; }
  try {
    const now = new Date(), dd = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const url = loc.lat != null ? `https://api.aladhan.com/v1/timings/${dd}?latitude=${loc.lat}&longitude=${loc.lng}&method=2` : `https://api.aladhan.com/v1/timingsByCity/${dd}?city=${encodeURIComponent(loc.city)}&country=${encodeURIComponent(loc.country)}&method=2`;
    const j = await (await fetch(url)).json(); const t = j.data.timings, names = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const at = k => { const [h, m] = t[k].split(' ')[0].split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d; };
    const draw = () => { const n = new Date(); let nx = names.find(k => at(k) > n); const tomorrow = !nx; if (!nx) nx = 'Fajr'; const target = at(nx); if (tomorrow) target.setDate(target.getDate() + 1); const diff = Math.max(0, target - n), hh = Math.floor(diff / 36e5), mm = Math.floor(diff % 36e5 / 6e4), ss = Math.floor(diff % 6e4 / 1e3);
      const el = $('#pt'); if (!el) return; el.innerHTML = `<small class="eyebrow">Next prayer</small><h2>${nx}</h2><div class="countdown">${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}</div>${names.map(k => `<div class="lrow ${k === nx ? 'cur' : ''}"><b class="grow">${k}</b><span>${t[k].split(' ')[0]}</span></div>`).join('')}<button class="btn ghost small" data-act="prayer-reset">Change location</button>`; };
    draw(); timers.push(setInterval(draw, 1000));
  } catch { box.innerHTML = `<p class="muted">Couldn't load prayer times.</p><button class="btn" data-act="prayer-reset">Change location</button>`; }
  void force;
}

// ----- dhikr -----
function viewDhikr() {
  const d = S.dhikr, p = DHIKR[d.idx] || DHIKR[0];
  return { html: `${back()}<h2>Dhikr counter</h2><div class="chips-row scroll">${DHIKR.map((x, i) => `<button class="pick ${d.idx === i ? 'on' : ''}" data-act="dhikr-pick" data-i="${i}">${x.en}</button>`).join('')}</div>
    <div class="dhikr"><p class="ar big" dir="rtl">${p.ar}</p><button class="dbtn" data-act="dhikr-tap" aria-label="Count">${ring(d.count / p.goal, 220, `<span id="dc">${d.count}</span>`, `of ${p.goal}`)}</button></div>
    <p class="muted center">Total all time: <b id="dt">${d.total}</b></p><div class="center"><button class="btn ghost" data-act="dhikr-reset">Reset count</button></div>` };
}

// ----- alphabet -----
function viewAlphabet() {
  return { html: `${back()}<h2>Arabic alphabet</h2><p class="muted">Tap a letter to see its sound and shapes. Arabic reads right to left.</p><div class="alpha" dir="rtl">${LETTERS.map((l, i) => `<button class="letter" data-act="alpha" data-i="${i}"><span class="ar">${l.c}</span><small>${l.n}</small></button>`).join('')}</div>
    <div class="col-gap"><button class="btn gold" data-act="arcade">🎮 Practice in the Letter Games</button><button class="btn ${S.alphabetDone ? '' : 'primary'}" data-act="alpha-done" ${S.alphabetDone ? 'disabled' : ''}>${S.alphabetDone ? '✅ Alphabet completed' : 'I know all the letters!'}</button></div>` };
}
function letterSheet(i) {
  const l = LETTERS[i], Z = '\u200D'; const forms = l.j ? [['Alone', l.c], ['Start', l.c + Z], ['Middle', Z + l.c + Z], ['End', Z + l.c]] : [['Alone', l.c], ['End', Z + l.c]];
  sheet(`<div class="ar giant center">${l.c}</div><h3 class="center">${l.n}</h3><p class="center muted">${esc(l.h)}</p><div class="forms" dir="rtl">${forms.map(f => `<div><span class="ar">${f[1]}</span><small>${f[0]}</small></div>`).join('')}</div>${l.j ? '' : '<p class="muted small center">This letter does not connect to the next one.</p>'}<button class="btn" data-act="close-sheet">Close</button>`);
}

// =====================================================================
// Actions (event delegation)
// =====================================================================
const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
const ACT = {
  retry: () => route(),
  'close-sheet': () => closeSheet(),
  arcade: () => openArcade(),
  filter: t => { qFilter = t.dataset.f; route(true); },
  metric: t => { chartMetric = t.dataset.m; route(true); },
  'play-ayah': t => playAyah(+t.dataset.g),
  'play-surah': async t => { const a = await getSurah(+t.dataset.n); playList(a.map(x => x.g)); toast('Playing… tap an ayah ▶ to switch', '🔊'); },
  learn: async t => { const n = +t.dataset.n, s = surahList[n - 1]; if (!unlocked(s)) return toast(`Reach level ${reqLevel(s.count)} to unlock`, '🔒'); try { startLesson(s, await getSurah(n)); } catch (e) { toast('Could not load the surah. Check your connection.', '⚠️'); } },
  recite: async t => { const n = +t.dataset.n; try { openRecite(surahList[n - 1], await getSurah(n)); } catch { toast('Could not load the surah.', '⚠️'); } },
  'toggle-secret': t => { const s = $('#secret'); s.hidden = !s.hidden; t.textContent = s.hidden ? 'Show' : 'Hide'; },
  'save-profile': () => { const p = S.profile || (S.profile = {}); p.name = val('a-name') || p.name; p.age = +val('a-age') || p.age; p.gender = val('a-gender'); p.goalMin = +val('a-goal'); save(); toast('Profile saved', '✅'); },
  'save-signin': async () => { try { await updateAccount({ username: val('s-user'), email: val('s-email') }); toast('Sign-in details updated', '✅'); } catch (e) { toast(e.message, '⚠️'); } },
  'save-pw': async () => { try { await changePassword(val('s-cur'), val('s-new')); toast('Password changed', '✅'); $('#s-cur').value = $('#s-new').value = ''; } catch (e) { toast(e.message, '⚠️'); } },
  export: () => download('iqra-progress.json', JSON.stringify({ profile: S.profile, ...S }, null, 2)),
  logout: async () => { if (!confirm('Sign out?')) return; await logout(); step = 'login'; draft = { gender: '', level: '', goalMin: 10 }; location.hash = ''; renderAuth(); },
  'delete-acct': async () => { const pw = prompt('This permanently deletes your account and progress. Enter your password to confirm:'); if (!pw) return; try { await deleteAccount(pw); step = 'welcome'; location.hash = ''; renderAuth(); } catch (e) { toast(e.message, '⚠️'); } },
  'shop-tab': t => { shopTab = t.dataset.t; route(true); },
  buy: t => { const it = [...THEMES, ...AVATARS].find(x => x.id === t.dataset.id); if (!it || S.coins < it.cost || levelOf(S.xp) < it.lvl) return; S.coins -= it.cost; (shopTab === 'themes' ? S.owned.themes : S.owned.avatars).push(it.id); save(); sfx('ok'); toast('Unlocked!', '🎁'); ACT.equip(t); },
  equip: t => { if (shopTab === 'themes') { S.settings.theme = t.dataset.id; applyTheme(); } else S.settings.avatar = t.dataset.id; save(); route(true); },
  'fast-prev': () => { fastMonth = new Date(fastMonth.getFullYear(), fastMonth.getMonth() - 1, 1); route(true); },
  'fast-next': () => { fastMonth = new Date(fastMonth.getFullYear(), fastMonth.getMonth() + 1, 1); route(true); },
  'fast-day': t => { const k = t.dataset.d; sheet(`<h3 class="center">${new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3><div class="opts col">${FAST_TYPES.map(f => `<button class="opt ${S.fasts[k] === f.id ? 'right' : ''}" data-act="fast-set" data-d="${k}" data-f="${f.id}">${f.i} ${f.l}</button>`).join('')}${S.fasts[k] ? `<button class="opt" data-act="fast-set" data-d="${k}" data-f="">✖ Clear</button>` : ''}</div>`); },
  'fast-set': t => { const k = t.dataset.d; if (t.dataset.f) S.fasts[k] = t.dataset.f; else delete S.fasts[k]; const nb = reward({ streak: false }).badges; void nb; closeSheet(); sfx('pop'); route(true); },
  fav: t => { const i = +t.dataset.i, k = S.favs.indexOf(i); if (k >= 0) S.favs.splice(k, 1); else S.favs.push(i); save(); route(true); },
  'prayer-locate': () => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => { localStorage.setItem('iqra_loc', JSON.stringify({ lat: +p.coords.latitude.toFixed(3), lng: +p.coords.longitude.toFixed(3) })); loadPrayer(); }, () => toast('Location blocked. Enter your city instead.', '📍')) : toast('Location not supported', '📍'),
  'prayer-city': () => { const city = val('pc-city'), country = val('pc-country'); if (!city || !country) return toast('Enter city and country', '📍'); localStorage.setItem('iqra_loc', JSON.stringify({ city, country })); loadPrayer(); },
  'prayer-reset': () => { localStorage.removeItem('iqra_loc'); timers.forEach(clearInterval); loadPrayer(); },
  'dhikr-pick': t => { S.dhikr.idx = +t.dataset.i; S.dhikr.count = 0; save(); route(true); },
  'dhikr-tap': () => {
    const d = S.dhikr, p = DHIKR[d.idx]; d.count++; d.total++; navigator.vibrate && navigator.vibrate(12);
    if (d.count >= p.goal) { sfx('win'); navigator.vibrate && navigator.vibrate([60, 40, 60]); toast(`${p.en} complete`, '📿'); d.count = 0; }
    save(); const nb = checkBadges(); if (nb.length) { save(); nb.forEach(b => toast(`Badge: ${b.n}`, b.i)); }
    const rf = $('.dhikr .rf'), c = 2 * Math.PI * (220 / 2 - 8); if (rf) rf.setAttribute('stroke-dashoffset', c * (1 - d.count / p.goal));
    if ($('#dc')) $('#dc').textContent = d.count; if ($('#dt')) $('#dt').textContent = d.total;
  },
  'dhikr-reset': () => { S.dhikr.count = 0; save(); route(true); },
  alpha: t => letterSheet(+t.dataset.i),
  'alpha-done': () => { S.alphabetDone = true; const r = reward({ xp: 50, coins: 20 }); sfx('win'); toast('Alphabet complete! +50 XP', '🔤'); void r; route(true); },
};

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t) return; const a = t.dataset.act;
  if (ACT[a]) return ACT[a](t, e);
  // auth actions
  if (a === 'a-go') { step = t.dataset.s; renderAuth(); }
  else if (a === 'a-pick') { draft[t.dataset.k] = t.dataset.k === 'goalMin' ? +t.dataset.v : t.dataset.v; $$(`[data-act="a-pick"][data-k="${t.dataset.k}"]`).forEach(b => b.classList.toggle('on', b === t)); }
  else if (a === 'a-next1') { draft.name = val('p-name'); draft.age = +val('p-age'); if (!draft.name) return authErr('Please enter your name.'); if (!(draft.age >= 5 && draft.age <= 110)) return authErr('Please enter a valid age.'); if (!draft.gender) return authErr('Please choose an option.'); step = 's2'; renderAuth(); }
  else if (a === 'a-next2') { if (!draft.level) return authErr('Pick where you are now.'); step = 's3'; renderAuth(); }
  else if (a === 'a-create') {
    const username = val('r-user').toLowerCase(), email = val('r-email'), password = $('#r-pw').value;
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return authErr('Username: 3–20 letters, numbers or underscores.'); if (!/^\S+@\S+\.\S{2,}$/.test(email)) return authErr('Enter a valid email.'); if (password.length < 8) return authErr('Password needs 8+ characters.');
    t.disabled = true; t.textContent = 'Creating…';
    try { S.profile = { name: draft.name, age: draft.age, gender: draft.gender, level: draft.level, goalMin: draft.goalMin || 10 }; S.updatedAt = Date.now(); await register({ username, email, password }); save(); await boot(); toast(`Welcome, ${draft.name}!`, '🌙'); }
    catch (er) { S.profile = null; t.disabled = false; t.textContent = 'Create account'; authErr(er.message); }
  } else if (a === 'a-login') {
    t.disabled = true; try { await login({ id: val('l-id'), password: $('#l-pw').value }); if (!S.profile) throw new Error('No profile found for this account on this device.'); await boot(); } catch (er) { t.disabled = false; authErr(er.message); }
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'qsearch') { qSearch = e.target.value; $('#qlist').innerHTML = listHTML(); }
});
document.addEventListener('change', e => {
  const k = e.target.dataset.set; if (!k) return; const el = e.target;
  S.settings[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value; if (k === 'fontSize') { $('#fso').textContent = el.value + 'px'; applyTheme(); } save();
});
document.addEventListener('input', e => { if (e.target.dataset.set === 'fontSize') { S.settings.fontSize = +e.target.value; $('#fso').textContent = e.target.value + 'px'; applyTheme(); } });

// =====================================================================
// Init
// =====================================================================
(async function init() {
  applyTheme(); await probe();
  if (await restore() && S.profile) boot(); else { step = 'welcome'; renderAuth(); }
})();

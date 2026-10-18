// Iqra: shell, routing, home, Quran, progress, glass navigation and the mini player.
import {
  S, $, $$, esc, toAr, todayKey, levelOf, xpFor, streakNow, sr, statusOf, reqLevel, unlocked, day, dayMinutes, questsNow, BADGES, Auth, probe, restore, register, login,
  save, getSurahList, getSurah, getAyahByGlobal, playQueue, togglePlayer, nextAyah, prevAyah, stopPlayer, seekPlayer, Player, bus, toast, sheet, closeSheet, feel, haptic, sfx,
  hijri, TOTAL_AYAHS, learnedTotal, masteredTotal, applyTheme, trackFor, setLevel, nextItem, planItems, itemDone, lessonDone, dueReviews, setRate,
} from './core.js';
import { ic } from './icons.js';
import { LEVELS, TRACKS, FOUNDATION_SURAHS } from './content.js';
import { UNITS, lessonMeta } from './curriculum.js';
import { startLesson, startSurah, startReview, resumeSession, hasSession, sessionInfo } from './lesson.js';
import { openRecite, gradeOf } from './recite.js';
import { openNur } from './nur.js';
import { openArcade } from './games.js';
import { back, ring, val, title, getErr, timers, clearTimers, refresh, lrow } from './ui.js';
import * as P from './pages.js';

let surahList = [], rtok = 0, qFilter = 'all', qSearch = '', chartMetric = 'xp';
const app = $('#app');

// =====================================================================
// Mobile lockdown: no pinch zoom, no browser gestures, no text selection outside inputs
// =====================================================================
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });
document.addEventListener('contextmenu', e => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
document.addEventListener('dragstart', e => e.preventDefault());

// =====================================================================
// Auth and onboarding
// =====================================================================
let step = 'welcome', draft = { gender: '', level: '', goalMin: 10 };
const logo = `<svg class="logo" viewBox="0 0 64 64" aria-label="Iqra"><path d="M14 58V30C14 18 24 11 32 4c8 7 18 14 18 26v28" fill="none" stroke="var(--gold)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><text x="32" y="46" text-anchor="middle" class="a-ar" font-size="22" fill="var(--ink)">اقرأ</text></svg>`;
const pickRow = (key, opts) => `<div class="chips-row">${opts.map(o => `<button class="pick ${draft[key] === o[0] ? 'on' : ''}" data-act="a-pick" data-k="${key}" data-v="${esc(o[0])}">${esc(o[1])}</button>`).join('')}</div>`;
const AUTH = {
  welcome: () => `${logo}<h1 class="hero-t">Iqra</h1><p class="lead">Learn to read, recite and memorise the Quran with lessons that adapt to you.</p>
    <div class="col-gap"><button class="btn primary big" data-act="a-go" data-s="s1">Get started</button><button class="btn" data-act="a-go" data-s="login">I already have an account</button></div>
    ${Auth.remote ? '' : '<p class="muted small center">Cloud sync is not connected, so your account will live on this device.</p>'}`,
  login: () => `<h2>Welcome back</h2><label>Username or email<input id="l-id" autocomplete="username" autocapitalize="none"></label><label>Password<input id="l-pw" type="password" autocomplete="current-password"></label><p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary big" data-act="a-login">Sign in</button><button class="btn ghost" data-act="a-go" data-s="welcome">Back</button></div>`,
  s1: () => `<div class="dots"><i class="on"></i><i></i><i></i></div><h2>Let's get to know you</h2><label>Your name<input id="p-name" value="${esc(draft.name || '')}" autocomplete="given-name"></label>
    <label>Age<input id="p-age" type="number" inputmode="numeric" min="5" max="110" value="${esc(draft.age || '')}"></label><label>Gender</label>${pickRow('gender', [['male', 'Male'], ['female', 'Female'], ['na', 'Prefer not to say']])}<p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary big" data-act="a-next1">Next</button><button class="btn ghost" data-act="a-go" data-s="welcome">Back</button></div>`,
  s2: () => `<div class="dots"><i class="on"></i><i class="on"></i><i></i></div><h2>Where are you now?</h2><p class="muted">Be honest, this shapes your lessons and daily tasks. You can change it later.</p>
    <div class="levels">${LEVELS.map(l => `<button class="lv ${draft.level === l.id ? 'on' : ''}" data-act="a-level" data-l="${l.id}"><span class="ico">${ic(l.icon, 22)}</span><div><b>${l.t}</b><small>${l.d}</small></div>${draft.level === l.id ? ic('check', 20) : ''}</button>`).join('')}</div>
    <label>Daily goal</label>${pickRow('goalMin', [[5, '5 min'], [10, '10 min'], [20, '20 min'], [30, '30 min']])}<p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary big" data-act="a-next2">Next</button><button class="btn ghost" data-act="a-go" data-s="s1">Back</button></div>`,
  s3: () => `<div class="dots"><i class="on"></i><i class="on"></i><i class="on"></i></div><h2>Create your account</h2><p class="muted">So your progress follows you on every device.</p>
    <label>Username<input id="r-user" autocomplete="username" autocapitalize="none" placeholder="letters, numbers, _"></label><label>Email<input id="r-email" type="email" autocomplete="email"></label>
    <label>Password<input id="r-pw" type="password" autocomplete="new-password" placeholder="8+ characters"></label><p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary big" data-act="a-create">Create account</button><button class="btn ghost" data-act="a-go" data-s="s2">Back</button></div>`,
};
function renderAuth() { document.body.classList.add('authing'); app.innerHTML = `<div class="auth"><div class="auth-card enter">${AUTH[step]()}</div></div>`; }
P.resetAuthFlow.fn = s => { step = s; draft = { gender: '', level: '', goalMin: 10 }; renderAuth(); };
const authErr = m => { const e = $('#err'); if (e) e.textContent = m; };

// =====================================================================
// Shell
// =====================================================================
const NAV = [['home', 'Home', 'home'], ['quran', 'Quran', 'book'], ['progress', 'Progress', 'chart'], ['more', 'More', 'more']];

async function boot() {
  document.body.classList.remove('authing'); applyTheme();
  app.innerHTML = `<main id="view" class="view"></main><div id="mini" class="mini" hidden></div>
    <nav class="nav" aria-label="Main"><span class="nav-glass"></span><span class="nav-pill"></span>${NAV.map(n => `<a href="#/${n[0]}" data-tab="${n[0]}"><span class="ni">${ic(n[2], 22)}</span><span class="nl">${n[1]}</span></a>`).join('')}</nav>`;
  initNav(); renderMini();
  try { surahList = await getSurahList(); } catch { surahList = []; }
  window.__surahList = surahList;
  route();
}

// ---------- the liquid glass bar: drag the bubble, the page only changes when you let go
let navApi = null;
function initNav() {
  const nav = $('.nav'), pill = $('.nav-pill'), links = $$('.nav a'), icons = $$('.nav .ni');
  const pad = 6; let cw = 0, W = 0, active = 0, x = 0, v = 0, tx = 0, pressed = false, raf = 0, ws = 1, hs = 1, bulge = 0, bv = 0, lastCell = -1, glare = 0;
  const center = i => pad + cw * (i + .5), cellAt = px => Math.max(0, Math.min(3, Math.floor((px - pad) / cw)));
  const measure = () => { const r = nav.getBoundingClientRect(); W = r.width; cw = (W - 2 * pad) / 4; pill.style.width = cw + 'px'; if (!pressed) { x = tx = center(active); } paint(); };
  function paint() {
    const sx = ws * (1 + bulge * .42), sy = hs * (1 - bulge * .26);
    pill.style.transform = `translate3d(${x - cw / 2}px,0,0) scale(${sx},${sy})`;
    icons.forEach((el, i) => { const d = (center(i) - x) / (cw * .85), mag = pressed ? .3 * Math.exp(-d * d * 1.6) : 0; el.style.transform = `translateY(${-mag * 7}px) scale(${1 + mag})`; });
    nav.style.setProperty('--gx', glare + 'px');
  }
  function frame() {
    const k = pressed ? .24 : .17, damp = pressed ? .7 : .76;
    v += (tx - x) * k; v *= damp; x += v;
    const bt = Math.min(1, Math.abs(v) / 12); bv += (bt - bulge) * .3; bv *= .68; bulge += bv;
    const wt = pressed ? .64 : 1, ht = pressed ? .88 : 1; ws += (wt - ws) * .22; hs += (ht - hs) * .22; glare += (x - glare) * .3;
    paint();
    if (pressed || Math.abs(tx - x) > .15 || Math.abs(v) > .08 || Math.abs(bulge) > .004 || Math.abs(ws - wt) > .004 || Math.abs(hs - ht) > .004) raf = requestAnimationFrame(frame);
    else { x = tx; v = 0; bulge = 0; ws = wt; hs = ht; raf = 0; paint(); }
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const clampX = px => Math.max(center(0) - cw * .2, Math.min(center(3) + cw * .2, px));
  const hover = c => links.forEach((a, i) => a.classList.toggle('hot', pressed && i === c));
  nav.addEventListener('pointerdown', e => {
    if (e.button > 0) return; pressed = true; try { nav.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    nav.classList.add('press'); tx = clampX(e.clientX - nav.getBoundingClientRect().left); lastCell = cellAt(tx); hover(lastCell); feel('tick', 'tick'); kick();
  });
  nav.addEventListener('pointermove', e => {
    if (!pressed) return; tx = clampX(e.clientX - nav.getBoundingClientRect().left); const c = cellAt(tx);
    if (c !== lastCell) { lastCell = c; hover(c); feel('nav', 'tick'); } kick();
  });
  const release = (go) => {
    if (!pressed) return; pressed = false; nav.classList.remove('press'); hover(-1);
    const idx = go ? cellAt(tx) : active; tx = center(idx); kick();
    if (go) { const target = '#/' + NAV[idx][0]; if (idx !== active || location.hash !== target) { feel('tap', 'tap'); location.hash = target; } }
  };
  nav.addEventListener('pointerup', () => release(true)); nav.addEventListener('pointercancel', () => release(false));
  nav.addEventListener('click', e => { if (e.detail > 0) e.preventDefault(); });
  window.addEventListener('resize', measure);
  navApi = { set(i) { active = i; links.forEach((a, j) => a.classList.toggle('on', j === i)); if (!pressed) { tx = center(i); kick(); } } };
  measure(); requestAnimationFrame(measure);
}

// ---------- mini player
function renderMini() {
  const m = $('#mini'); if (!m) return; const it = Player.q[Player.i];
  if (!it) { m.hidden = true; document.body.classList.remove('has-mini'); return; }
  document.body.classList.add('has-mini'); m.hidden = false;
  m.innerHTML = `<button class="mp-play" data-mp="toggle" aria-label="${Player.playing ? 'Pause' : 'Play'}">${Player.loading ? '<span class="spinner sm"></span>' : ic(Player.playing ? 'pause' : 'play', 22)}</button>
    <button class="mp-info" data-mp="open"><span class="mp-eq ${Player.playing ? 'on' : ''}"><i></i><i></i><i></i></span><span class="mp-t"><b>${esc(it.label || 'Quran')}</b><small>${esc(it.sub || '')}</small></span></button>
    <button class="mp-b" data-mp="prev" aria-label="Previous">${ic('prev', 18)}</button><button class="mp-b" data-mp="next" aria-label="Next" ${Player.i + 1 >= Player.q.length ? 'disabled' : ''}>${ic('next', 18)}</button><button class="mp-b" data-mp="stop" aria-label="Close player">${ic('x', 18)}</button><i class="mp-bar"><b id="mpb"></b></i>`;
}
bus.addEventListener('player', renderMini);
bus.addEventListener('ptime', e => { const b = $('#mpb'); if (b && e.detail.d) b.style.width = (e.detail.t / e.detail.d * 100) + '%'; });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-mp]'); if (!b) return; const k = b.dataset.mp; feel('tick', 'tick');
  if (k === 'toggle') togglePlayer(); else if (k === 'next') nextAyah(); else if (k === 'prev') prevAyah(); else if (k === 'stop') stopPlayer();
  else if (k === 'open') { const it = Player.q[Player.i]; if (it && it.n) location.hash = '#/surah/' + it.n; }
});
bus.addEventListener('audio', e => { $$('.ayah.playing').forEach(x => x.classList.remove('playing')); if (e.detail) $$(`.ayah[data-g="${e.detail}"]`).forEach(x => { x.classList.add('playing'); x.scrollIntoView({ block: 'center', behavior: 'smooth' }); }); });

// ---------- router
const VIEWS = {
  home: viewHome, path: viewPath, quran: viewQuran, surah: viewSurah, progress: viewProgress, more: viewMore,
  account: P.viewAccount, settings: P.viewSettings, shop: P.viewShop, fasting: P.viewFasting, hadith: P.viewHadith, advice: P.viewAdvice, prayer: P.viewPrayer, dhikr: P.viewDhikr, alphabet: P.viewAlphabet, about: P.viewAbout,
};
async function route(keep = false) {
  const view = $('#view'); if (!view) return;
  clearTimers();
  let [a = 'home', b] = (location.hash.slice(2) || 'home').split('/');
  if (a === 'more' && b && VIEWS[b]) { a = b; b = undefined; }
  const tab = { home: 0, path: 0, quran: 1, surah: 1, progress: 2 }[a] ?? 3; navApi && navApi.set(tab);
  const tok = ++rtok, y = view.scrollTop || window.scrollY;
  const fn = VIEWS[a] || viewHome; view.dataset.v = a;
  try {
    const out = await fn(b); if (tok !== rtok) return;
    view.classList.remove('enter'); view.innerHTML = out.html; if (!keep) { void view.offsetWidth; view.classList.add('enter'); } out.after && out.after();
    window.scrollTo(0, keep ? y : 0);
  } catch (e) { if (tok === rtok) view.innerHTML = `<div class="card center"><h3>Couldn't load</h3><p class="muted">${getErr(e)}</p><p class="muted small">Check your connection, then retry.</p><button class="btn primary" data-act="retry">Retry</button></div>`; }
}
window.addEventListener('hashchange', () => { closeSheet(); route(); });
window.addEventListener('iqra-refresh', () => { if ($('#view')) route(true); });
window.addEventListener('iqra-next', () => ACT['start-next']());

// =====================================================================
// Home
// =====================================================================
const ARCH = 'M24 196V96C24 56 60 34 80 6C100 34 136 56 136 96V196';
const stIcon = s => ({ mastered: ic('award', 18), learned: ic('check', 18), learning: ic('circle', 18) }[s] || '');
function archHTML(p) {
  return `<svg class="arch" viewBox="0 0 160 204" role="img" aria-label="Today's progress ${Math.round(p * 100)}%"><path class="a-track" d="${ARCH}" pathLength="100"/><path class="a-prog" id="aprog" d="${ARCH}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" data-p="${p}"/><text x="80" y="128" text-anchor="middle" class="a-ar">اقرأ</text></svg>`;
}
function upNext() {
  const it = nextItem(surahList);
  if (!it) return `<section class="card up"><h3>You finished your path</h3><p class="muted">Pick any surah from the Quran tab, or revise what you know.</p><a class="btn primary" href="#/quran">Browse the Quran</a></section>`;
  if (it.k === 'lesson') {
    const m = lessonMeta(it.id);
    return `<section class="card up"><div class="up-h"><span class="ico big">${ic(m.icon, 24)}</span><div><small class="muted">Up next</small><h3>${esc(m.title)}</h3><p class="muted">${esc(m.sub)}</p></div>${m.short ? `<span class="ar up-ar" dir="rtl">${esc(m.short)}</span>` : ''}</div><div class="row-gap"><button class="btn primary grow big" data-act="start-lesson" data-id="${it.id}">Start lesson</button><a class="btn" href="#/path">Path</a></div></section>`;
  }
  const s = surahList[it.n - 1], r = S.surahs[it.n], l = r ? r.learned.length : 0;
  return `<section class="card up"><div class="up-h"><span class="ico big">${ic('book', 24)}</span><div><small class="muted">${l ? 'Continue learning' : 'Up next'}</small><h3>${esc(s.en)}</h3><p class="muted">${esc(s.tr)} · ${s.count} ayahs</p></div><span class="ar up-ar">${esc(s.ar)}</span></div><div class="progress"><i style="width:${Math.round(l / s.count * 100)}%"></i></div><div class="row-gap"><button class="btn primary grow big" data-act="learn" data-n="${s.n}">${l ? 'Continue' : 'Start learning'}</button><a class="btn" href="#/surah/${s.n}">Open</a></div></section>`;
}
async function viewHome() {
  if (!surahList.length) { try { surahList = await getSurahList(); window.__surahList = surahList; } catch { /* offline */ } }
  const p = S.profile || {}, lv = levelOf(S.xp), lo = xpFor(lv), hi = xpFor(lv + 1), d = day(), goalS = (p.goalMin || 10) * 60, hj = hijri();
  const prog = Math.min(1, d.secs / goalS), ses = sessionInfo(), due = dueReviews().length, tr = TRACKS[S.track];
  return {
    html: `<header class="top"><div class="who"><span class="avatar">${ic(S.settings.avatar, 22)}</span><div><small class="muted">${hj ? esc(hj.text) : ''}</small><h1>Assalamu alaykum, ${esc(p.name || 'friend')}</h1></div></div><div class="chips"><span class="chip">${ic('flame', 14)} ${streakNow()}</span><span class="chip gold">${ic('coin', 14)} ${S.coins}</span></div></header>
    <section class="hero"><div class="hero-l"><small class="muted">Level ${lv} · ${title(lv)}</small><h2 class="mins">${dayMinutes(d)}<span> of ${p.goalMin || 10} min today</span></h2><div class="xpbar"><i style="width:${Math.round((S.xp - lo) / (hi - lo) * 100)}%"></i></div><small class="muted">${S.xp - lo} / ${hi - lo} XP to level ${lv + 1}</small><button class="trk" data-act="level">${ic(tr.icon, 16)}<span>${tr.n} plan</span>${ic('chevR', 14)}</button></div>${archHTML(prog)}</section>
    ${ses ? `<section class="card resume"><div class="up-h"><span class="ico big">${ic('play', 22)}</span><div><small class="muted">Pick up where you left off</small><h3>${esc(ses.title)}</h3><p class="muted">${esc(ses.sub || '')} · ${ses.pct}% done</p></div></div><div class="progress"><i style="width:${ses.pct}%"></i></div><button class="btn primary big" data-act="resume">Resume</button></section>` : ''}
    ${upNext()}
    ${due >= 4 ? `<section class="card up"><div class="up-h"><span class="ico big">${ic('repeat', 22)}</span><div><small class="muted">Revision</small><h3>${due} ayahs ready to refresh</h3><p class="muted">A quick session keeps them from fading.</p></div></div><button class="btn big" data-act="review">Revise now</button></section>` : ''}
    <section class="tiles"><button class="tile" data-act="recite-pick"><span class="ico">${ic('mic', 22)}</span><b>Recite</b><small>Get graded</small></button><button class="tile" data-act="nur"><span class="ico">${ic('message', 22)}</span><b>Ask Nur</b><small>Your coach</small></button><button class="tile" data-act="arcade"><span class="ico">${ic('dice', 22)}</span><b>Break room</b><small>Calm games</small></button></section>
    <section class="card"><div class="row-between"><h3>Today's tasks</h3><small class="muted">resets at midnight</small></div>${questsNow().map(q => { const v = Math.min(q.g, d[q.k] || 0); return `<div class="quest ${v >= q.g ? 'done' : ''}"><span class="qi">${ic(v >= q.g ? 'check' : 'target', 16)}</span><div class="grow"><b>${q.t}</b><div class="progress thin"><i style="width:${v / q.g * 100}%"></i></div></div><small>${ic('coin', 12)} ${q.c}</small></div>`; }).join('')}</section>
    <section class="card daily" id="daily"><small class="muted">Ayah of the day</small><div class="skeleton"></div></section>`,
    after: () => { loadDaily(); requestAnimationFrame(() => requestAnimationFrame(() => { const a = $('#aprog'); if (a) a.setAttribute('stroke-dashoffset', 100 * (1 - +a.dataset.p)); })); },
  };
}
bus.addEventListener('secs', e => { const a = $('#aprog'); if (!a) return; const p = S.profile || {}; a.dataset.p = Math.min(1, e.detail / ((p.goalMin || 10) * 60)); if (e.detail % 5 === 0) a.setAttribute('stroke-dashoffset', 100 * (1 - +a.dataset.p)); });
async function loadDaily() {
  const box = $('#daily'); if (!box) return;
  try {
    const g = 1 + (Math.floor(Date.now() / 864e5) * 997) % TOTAL_AYAHS, a = await getAyahByGlobal(g); if (!$('#daily')) return;
    box.innerHTML = `<small class="muted">Ayah of the day · ${esc(a.surah)} ${a.n}</small><div class="ar daily-ar" dir="rtl">${esc(a.ar)}</div><p class="en">${esc(a.en)}</p><div class="row-gap"><button class="btn small" data-act="play-daily" data-g="${a.g}" data-n="${a.sn}" data-l="${esc(a.surah)}" data-a="${a.n}">${ic('play', 16)} Listen</button><a class="btn small ghost" href="#/surah/${a.sn}">Open surah</a></div>`;
  } catch { box.innerHTML = `<small class="muted">Ayah of the day</small><p class="muted">Connect to the internet to load today's ayah.</p>`; }
}

// =====================================================================
// Path
// =====================================================================
async function viewPath() {
  if (!surahList.length) surahList = await getSurahList();
  const items = planItems(), nx = nextItem(surahList), tr = TRACKS[S.track];
  const row = it => {
    const done = itemDone(it), cur = nx && nx.k === it.k && (it.k === 'lesson' ? nx.id === it.id : nx.n === it.n);
    if (it.k === 'lesson') { const m = lessonMeta(it.id); return `<button class="prow ${done ? 'done' : ''} ${cur ? 'cur' : ''}" data-act="start-lesson" data-id="${it.id}"><span class="pn">${done ? ic('check', 16) : ic(m.icon, 16)}</span><div class="grow"><b>${esc(m.title)}</b><small class="muted">${esc(m.sub)}</small></div>${cur ? '<em>Next</em>' : ''}</button>`; }
    const s = surahList[it.n - 1], l = S.surahs[it.n] ? S.surahs[it.n].learned.length : 0;
    return `<button class="prow ${done ? 'done' : ''} ${cur ? 'cur' : ''}" data-act="learn" data-n="${it.n}"><span class="pn">${done ? ic('check', 16) : ic('book', 16)}</span><div class="grow"><b>${esc(s.en)}</b><small class="muted">${s.count} ayahs${l && !done ? ` · ${l} learned` : ''}</small></div>${cur ? '<em>Next</em>' : ''}<span class="ar sname">${esc(s.ar)}</span></button>`;
  };
  return { html: `${back('#/home', 'Home')}<header class="top"><h2>Your path</h2></header><button class="card lrow plain" data-act="level"><span class="ico">${ic(tr.icon, 20)}</span><div class="grow"><b>${tr.n} plan</b><small class="muted">${tr.d}. Tap to change your level.</small></div>${ic('chevR', 18, 'dim')}</button>
    <div class="plist">${items.map(row).join('')}</div>
    <h3 class="sec">Library</h3><p class="muted small">Every lesson is open any time, whatever your plan.</p>${UNITS.map(u => `<section class="card"><div class="row-between"><div><h3>${u.title}</h3><small class="muted">${u.sub}</small></div><span class="ico">${ic(u.icon, 20)}</span></div>${u.ids.map(id => { const m = lessonMeta(id), d = lessonDone(id); return `<button class="prow slim ${d ? 'done' : ''}" data-act="start-lesson" data-id="${id}"><span class="pn">${d ? ic('check', 14) : ''}</span><div class="grow"><b>${esc(m.title)}</b></div>${ic('chevR', 16, 'dim')}</button>`; }).join('')}</section>`).join('')}` };
}

// =====================================================================
// Quran list and surah page
// =====================================================================
function surahRow(s) {
  const st = statusOf(s.n), lock = !unlocked(s), r = S.surahs[s.n], pc = r ? Math.round(r.learned.length / s.count * 100) : 0;
  return `<a class="srow ${st} ${lock ? 'locked' : ''}" href="#/surah/${s.n}"><span class="snum"><b>${s.n}</b></span><div class="sinfo"><b>${esc(s.en)}</b><small>${esc(s.tr)} · ${s.count} ayahs · ${esc(s.type)}</small>${st === 'learning' ? `<div class="progress thin"><i style="width:${pc}%"></i></div>` : ''}</div><div class="sright"><span class="ar sname">${esc(s.ar)}</span>${lock ? `<small class="lockt">${ic('lock', 12)} Lv ${reqLevel(s.count)}</small>` : `<i class="stat">${stIcon(st)}</i>`}</div></a>`;
}
function filteredSurahs() {
  let l = surahList; const q = qSearch.toLowerCase().trim();
  if (qFilter === 'path') { const ns = planItems().filter(i => i.k === 'surah').map(i => i.n); l = ns.map(n => surahList[n - 1]).filter(Boolean); } else if (qFilter !== 'all') l = l.filter(s => statusOf(s.n) === qFilter);
  if (q) l = l.filter(s => s.en.toLowerCase().includes(q) || s.tr.toLowerCase().includes(q) || String(s.n) === q || s.ar.includes(q));
  return l;
}
const listHTML = () => filteredSurahs().map(surahRow).join('') || '<p class="muted center">Nothing here yet.</p>';
async function viewQuran() {
  if (!surahList.length) surahList = await getSurahList();
  const F = [['all', 'All'], ['path', 'My path'], ['learning', 'Learning'], ['learned', 'Learned'], ['mastered', 'Mastered']];
  return { html: `<header class="top"><h1>Quran</h1><span class="chip">${learnedTotal()} / ${TOTAL_AYAHS} ayahs</span></header>
    <label class="search">${ic('search', 18)}<input id="qsearch" placeholder="Search 114 surahs" value="${esc(qSearch)}" type="search" aria-label="Search surahs"></label><div class="chips-row scroll">${F.map(f => `<button class="pick ${qFilter === f[0] ? 'on' : ''}" data-act="filter" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
    <div class="slist" id="qlist">${listHTML()}</div>` };
}
const ayahHTML = (a, learned) => `<article class="ayah ${learned ? 'learned' : ''}" data-g="${a.g}"><div class="ayah-top"><span class="num">${a.n}</span><button class="icon-btn sm" data-act="play-from" data-a="${a.n}" aria-label="Play from ayah ${a.n}">${ic('play', 16)}</button>${learned ? `<span class="chk">${ic('check', 14)}</span>` : ''}</div><p class="ar" dir="rtl">${esc(a.ar)}</p>${S.settings.translit ? `<p class="tl">${esc(a.tr)}</p>` : ''}${S.settings.translation ? `<p class="en">${esc(a.en)}</p>` : ''}</article>`;
async function viewSurah(n) {
  n = +n; if (!surahList.length) surahList = await getSurahList();
  const s = surahList[n - 1]; if (!s) return { html: `${back('#/quran', 'Quran')}<p class="muted">Surah not found.</p>` };
  const ayahs = await getSurah(n), r = S.surahs[n], st = statusOf(n), l = r ? r.learned.length : 0, lock = !unlocked(s), ses = sessionInfo();
  const resume = ses && ses.kind === 'surah' && ses.n === n;
  const act = lock ? `<div class="banner">${ic('lock', 16)} Reach <b>level ${reqLevel(s.count)}</b> to unlock (you're level ${levelOf(S.xp)}). Or turn on <a href="#/more/settings">Explorer mode</a>.</div>`
    : `<div class="col-gap">${resume ? `<button class="btn primary big" data-act="resume">Resume lesson · ${ses.pct}%</button>` : st === 'learned' || st === 'mastered' ? `<button class="btn primary big" data-act="recite-surah" data-n="${n}" data-m="${st === 'learned' ? 1 : ''}">${ic('mic', 18)} ${st === 'mastered' ? 'Recite again' : 'Recite for mastery'}</button>` : `<button class="btn primary big" data-act="learn" data-n="${n}">${l ? 'Continue learning' : 'Start learning'}</button>`}
      <div class="row-gap"><button class="btn grow" data-act="recite-surah" data-n="${n}">${ic('mic', 16)} Practise</button><button class="btn grow" data-act="play-surah" data-n="${n}">${ic('headphones', 16)} Listen</button><button class="btn grow" data-act="nur-surah" data-n="${n}">${ic('message', 16)} Nur</button></div></div>`;
  return {
    html: `${back('#/quran', 'Quran')}<section class="card surah-head ${st}"><div class="ar big-name">${esc(s.ar)}</div><h2>${esc(s.en)}</h2><p class="muted">${esc(s.tr)} · ${esc(s.type)} · ${s.count} ayahs</p>
      <div class="progress"><i style="width:${l / s.count * 100}%"></i></div><p class="muted small">${st === 'mastered' ? 'Mastered' : st === 'learned' ? 'Learned. Recite it to master it.' : `${l} of ${s.count} ayahs learned`}</p>${act}</section>
      ${n !== 1 && n !== 9 ? '<div class="bismillah ar">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>' : ''}<div class="ayahs">${ayahs.map(a => ayahHTML(a, r && r.learned.includes(a.n))).join('')}</div>`,
  };
}

// =====================================================================
// Progress
// =====================================================================
function barChart(vals, labels) {
  const W = 320, H = 130, bw = 28, gap = (W - 7 * bw) / 8, max = Math.max(1, ...vals);
  return `<svg viewBox="0 0 ${W} ${H + 24}" class="chart" role="img" aria-label="Last 7 days">${vals.map((v, i) => { const h = Math.round(v / max * H), x = gap + i * (bw + gap); return `<rect x="${x}" y="${H - h}" width="${bw}" height="${h || 3}" rx="9" class="cbar ${i === 6 ? 'today' : ''}"/><text x="${x + bw / 2}" y="${H + 17}" text-anchor="middle">${labels[i]}</text>${v ? `<text x="${x + bw / 2}" y="${H - h - 5}" text-anchor="middle" class="val">${v}</text>` : ''}`; }).join('')}</svg>`;
}
async function viewProgress() {
  if (!surahList.length) surahList = await getSurahList();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); return { k: todayKey(d), l: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()] }; });
  const val_ = k => { const r = S.daily[k]; if (!r) return 0; return chartMetric === 'minutes' ? Math.round((r.secs || 0) / 60) : r[chartMetric] || 0; };
  const vals = days.map(d => val_(d.k)), lv = levelOf(S.xp), lt = learnedTotal(), mt = masteredTotal();
  const doneN = surahList.filter(s => ['learned', 'mastered'].includes(statusOf(s.n))).length, mastered = surahList.filter(s => statusOf(s.n) === 'mastered');
  const M = [['xp', 'XP'], ['ayahs', 'Ayahs'], ['minutes', 'Minutes']], lessonsDone = Object.keys(S.lessons).length;
  return {
    html: `<header class="top"><h1>Progress</h1><span class="chip">Lv ${lv} · ${title(lv)}</span></header>
    <section class="stats4"><div class="card stat"><b>${S.xp}</b><small>total XP</small></div><div class="card stat"><b>${streakNow()}</b><small>day streak</small></div><div class="card stat"><b>${lt}</b><small>ayahs learned</small></div><div class="card stat"><b>${lessonsDone}</b><small>lessons done</small></div></section>
    <section class="card"><div class="row-between"><h3>This week</h3><div class="seg sm">${M.map(m => `<button class="${chartMetric === m[0] ? 'on' : ''}" data-act="metric" data-m="${m[0]}">${m[1]}</button>`).join('')}</div></div>${barChart(vals, days.map(d => d.l))}</section>
    <section class="card rings"><div>${ring(lt / TOTAL_AYAHS, 104, (lt / TOTAL_AYAHS * 100).toFixed(1) + '%', 'of the Quran')}</div><div>${ring(doneN / 114, 104, doneN + '/114', 'learned')}</div><div>${ring(mt / 114, 104, mt + '/114', 'mastered')}</div></section>
    <section class="card"><h3>Recitations</h3>${S.recites.length ? S.recites.slice(0, 6).map(r => { const g = gradeOf(r.score); return `<div class="mrow"><span class="ico">${ic('mic', 18)}</span><div class="grow"><b>${esc(r.name)} · ${r.from}${r.to > r.from ? '–' + r.to : ''}</b><small class="muted">${new Date(r.at).toLocaleDateString()} · ${g[0]}${r.mastery ? ' · mastery attempt' : ''}</small></div><b class="${g[1] === 'good' ? 'ok-t' : ''}">${r.score}%</b></div>`; }).join('') : '<p class="muted">Recite any surah to see your graded history here.</p>'}</section>
    <section class="card"><h3>All 114 surahs</h3><div class="legend"><span><i class="c new"></i>new</span><span><i class="c learning"></i>learning</span><span><i class="c learned"></i>learned</span><span><i class="c mastered"></i>mastered</span></div><div class="grid114">${surahList.map(s => `<a class="cell ${statusOf(s.n)}" href="#/surah/${s.n}" title="${esc(s.en)}">${s.n}</a>`).join('')}</div></section>
    <section class="card"><h3>Mastery</h3>${mastered.length ? mastered.map(s => `<a class="mrow" href="#/surah/${s.n}"><span class="ico">${ic('award', 18)}</span><div class="grow"><b>${esc(s.en)}</b><small class="muted">${new Date(S.surahs[s.n].masteredAt || Date.now()).toLocaleDateString()}</small></div><b class="ok-t">${S.surahs[s.n].best || 100}%</b></a>`).join('') : '<p class="muted">No surah mastered yet. Learn one, then recite it with no real mistakes.</p>'}</section>
    <section class="card"><h3>Badges <small class="muted">${Object.keys(S.badges).length}/${BADGES.length}</small></h3><div class="badges">${BADGES.map(b => `<div class="badge ${S.badges[b.id] ? 'got' : ''}" title="${esc(b.d)}"><span>${ic(S.badges[b.id] ? b.i : 'lock', 22)}</span><b>${esc(b.n)}</b><small>${esc(b.d)}</small></div>`).join('')}</div></section>`,
  };
}

// =====================================================================
// More
// =====================================================================
function viewMore() {
  const rows = [['account', 'user', 'Account', 'Profile, level and sign-in'], ['path', 'route', 'Your path', 'Lessons and library'], ['shop', 'bag', 'Rewards', `${S.coins} coins to spend`], ['fasting', 'moon', 'Fasting log', 'Track your fasts'], ['hadith', 'quote', 'Hadith', 'Daily wisdom'], ['advice', 'bulb', 'Learning advice', 'Memorisation tips'],
    ['prayer', 'dome', 'Prayer times', 'Next prayer countdown'], ['dhikr', 'beads', 'Dhikr counter', 'Tasbih'], ['alphabet', 'type', 'Arabic alphabet', 'Letters and sounds'], ['settings', 'settings', 'Settings', 'Appearance, sound, reciter'], ['about', 'info', 'About Iqra', 'How it works']];
  return { html: `<header class="top"><h1>More</h1></header><button class="card nur-card" data-act="nur"><span class="ico big">${ic('sparkle', 22)}</span><div class="grow"><b>Chat with Nur</b><small class="muted">Ask about letters, tajweed or your next step</small></div>${ic('chevR', 18, 'dim')}</button>
    <div class="card list">${rows.map(r => lrow(r[1], r[2], r[3], r[0] === 'path' ? '#/path' : `#/more/${r[0]}`)).join('')}</div>` };
}

// =====================================================================
// Actions
// =====================================================================
const ACT = {
  ...P.PAGE_ACT,
  retry: () => route(),
  'close-sheet': () => closeSheet(),
  arcade: () => openArcade(),
  nur: () => openNur(),
  'nur-surah': t => { const s = surahList[+t.dataset.n - 1]; openNur({ ask: `Give me a short overview of Surah ${s.en}: its theme and one tip for learning it.`, extra: `Looking at Surah ${s.en} (${s.count} ayahs)` }); },
  filter: t => { qFilter = t.dataset.f; refresh(); },
  metric: t => { chartMetric = t.dataset.m; refresh(); },
  resume: () => resumeSession(),
  review: () => startReview(),
  'play-daily': t => playQueue([{ g: +t.dataset.g, n: +t.dataset.n, label: t.dataset.l, sub: `Ayah ${t.dataset.a}` }]),
  'play-surah': async t => { const n = +t.dataset.n, a = await getSurah(n), s = surahList[n - 1]; playQueue(a.map(x => ({ g: x.g, n, label: s.en, sub: `Ayah ${x.n} of ${s.count}` }))); },
  'play-from': async t => { const n = +location.hash.split('/')[2], a = await getSurah(n), s = surahList[n - 1], start = a.findIndex(x => x.n === +t.dataset.a); playQueue(a.map(x => ({ g: x.g, n, label: s.en, sub: `Ayah ${x.n} of ${s.count}` })), Math.max(0, start)); },
  learn: async t => { const n = +t.dataset.n, s = surahList[n - 1]; if (!unlocked(s)) return toast(`Reach level ${reqLevel(s.count)} to unlock`, 'lock'); try { startSurah(s, await getSurah(n)); } catch { toast('Could not load the surah. Check your connection.', 'info'); } },
  'start-next': async () => { const it = nextItem(surahList); if (!it) return; if (it.k === 'lesson') startLesson(it.id); else ACT.learn({ dataset: { n: it.n } }); },
  'recite-surah': async t => { const n = +t.dataset.n; try { const ays = await getSurah(n), s = surahList[n - 1]; if (t.dataset.m) openRecite(s, ays, { from: 1, to: Math.min(ays.length, 20), mastery: true }); else openRecite(s, ays); } catch { toast('Could not load the surah.', 'info'); } },
  'recite-pick': () => {
    const recent = Object.entries(S.surahs).filter(([, r]) => r.learned.length).map(([n]) => +n).slice(0, 5), ids = [...new Set([...recent, 1, 112, 114])].slice(0, 7);
    const el = sheet(`<h3>Recite which surah?</h3><p class="muted">You will be graded on any range you choose.</p><div class="opts col">${ids.map(n => { const s = surahList[n - 1]; return s ? `<button class="opt" data-act="recite-surah" data-n="${n}"><span>${esc(s.en)} <small class="muted">${s.count} ayahs</small></span><span class="ar sname">${esc(s.ar)}</span></button>` : ''; }).join('')}</div><a class="btn ghost" href="#/quran" data-act="close-sheet">Browse all surahs</a>`);
    el.addEventListener('click', () => setTimeout(closeSheet, 0));
  },
};
document.addEventListener('click', async e => {
  const seg = e.target.closest('.seg[data-seg] button');
  if (seg) { const k = seg.parentElement.dataset.seg; S.settings[k] = k === 'rate' ? +seg.dataset.v : seg.dataset.v; if (k === 'rate') setRate(S.settings.rate); applyTheme(); save(); feel('tap'); refresh(); return; }
  const t = e.target.closest('[data-act]'); if (!t) return; const a = t.dataset.act;
  if (ACT[a]) { if (!['filter', 'metric', 'close-sheet'].includes(a)) feel('tap', 'tap'); return ACT[a](t, e); }
  if (a === 'a-go') { step = t.dataset.s; renderAuth(); }
  else if (a === 'a-pick') { draft[t.dataset.k] = t.dataset.k === 'goalMin' ? +t.dataset.v : t.dataset.v; $$(`[data-act="a-pick"][data-k="${t.dataset.k}"]`).forEach(b => b.classList.toggle('on', b === t)); feel('tick'); }
  else if (a === 'a-level') { draft.level = t.dataset.l; $$('.lv').forEach(b => { b.classList.toggle('on', b === t); const c = b.querySelector('.ic.chk'); if (c) c.remove(); }); t.insertAdjacentHTML('beforeend', ic('check', 20, 'chk')); feel('tick'); }
  else if (a === 'a-next1') { draft.name = val('p-name'); draft.age = +val('p-age'); if (!draft.name) return authErr('Please enter your name.'); if (!(draft.age >= 5 && draft.age <= 110)) return authErr('Please enter a valid age.'); if (!draft.gender) return authErr('Please choose an option.'); step = 's2'; renderAuth(); }
  else if (a === 'a-next2') { if (!draft.level) return authErr('Pick where you are now.'); step = 's3'; renderAuth(); }
  else if (a === 'a-create') {
    const username = val('r-user').toLowerCase(), email = val('r-email'), password = $('#r-pw').value;
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return authErr('Username: 3 to 20 letters, numbers or underscores.'); if (!/^\S+@\S+\.\S{2,}$/.test(email)) return authErr('Enter a valid email.'); if (password.length < 8) return authErr('Password needs 8+ characters.');
    t.disabled = true; t.textContent = 'Creating…';
    try { S.profile = { name: draft.name, age: draft.age, gender: draft.gender, level: draft.level, goalMin: draft.goalMin || 10 }; S.track = trackFor(draft.level); if (draft.level === 'fluent') S.settings.openAll = true; S.updatedAt = Date.now(); await register({ username, email, password }); save(); await boot(); toast(`Welcome, ${draft.name}`, 'moon'); }
    catch (er) { S.profile = null; t.disabled = false; t.textContent = 'Create account'; authErr(er.message); }
  } else if (a === 'a-login') {
    t.disabled = true; try { await login({ id: val('l-id'), password: $('#l-pw').value }); if (!S.profile) throw new Error('No profile found for this account on this device.'); await boot(); } catch (er) { t.disabled = false; authErr(er.message); }
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'qsearch') { qSearch = e.target.value; $('#qlist').innerHTML = listHTML(); }
  if (e.target.dataset.set === 'fontSize') { S.settings.fontSize = +e.target.value; $('#fso').textContent = e.target.value + 'px'; applyTheme(); }
});
document.addEventListener('change', e => {
  const k = e.target.dataset.set; if (!k) return; const el = e.target;
  S.settings[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value; if (k === 'sound' && el.checked) sfx('ok'); if (k === 'haptics' && el.checked) haptic('ok'); save();
});

// =====================================================================
// Init
// =====================================================================
(async function init() {
  applyTheme(); await probe();
  if (await restore() && S.profile) boot(); else { step = 'welcome'; renderAuth(); }
})();
void FOUNDATION_SURAHS;

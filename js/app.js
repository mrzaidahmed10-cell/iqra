// Iqra: shell, routing, home, Quran, progress, glass navigation and the mini player.
import {
  S, $, $$, esc, toAr, api, logout, todayKey, levelOf, xpFor, streakNow, sr, statusOf, reqLevel, unlocked, day, dayMinutes, questsNow, BADGES, Auth, probe, restore, register, login,
  save, getSurahList, getSurah, getAyahByGlobal, playQueue, togglePlayer, nextAyah, prevAyah, stopPlayer, seekPlayer, Player, bus, toast, sheet, closeSheet, feel, haptic, sfx,
  surahItems, listenState, setSleep, sleepLeft, hijri, TOTAL_AYAHS, learnedTotal, masteredTotal, applyTheme, trackFor, setLevel, nextItem, planItems, itemDone, lessonDone, dueReviews, setRate,
} from './core.js';
import { ic } from './icons.js';
import { LEVELS, TRACKS, FOUNDATION_SURAHS, RECITERS } from './content.js';
import { UNITS, lessonMeta } from './curriculum.js';
import { startLesson, startSurah, startReview, resumeSession, hasSession, sessionInfo } from './lesson.js';
import { openRecite, gradeOf, weakList, weakCount } from './recite.js';
import * as HL from './halal.js';
import * as EX from './extras.js';
import { viewPrayerTab, startAthan } from './prayer.js';
import { openNur } from './nur.js';
import { searchSurahs } from './search.js';
import { openArcade } from './games.js';
import { back, ring, val, title, getErr, timers, clearTimers, refresh, lrow } from './ui.js';
import * as P from './pages.js';
import { runPlacement } from './placement.js';

let surahList = [], rtok = 0, qFilter = 'all', qSearch = '', chartMetric = 'minutes', progTab = 'overview', lFilter = 'all', lSearch = '';
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
let step = 'welcome', draft = { gender: '', level: '', goalMin: 10, leniency: '', placed: null };
const logo = `<svg class="logo" viewBox="0 0 64 64" aria-label="Iqra"><path d="M14 58V30C14 18 24 11 32 4c8 7 18 14 18 26v28" fill="none" stroke="var(--gold)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><text x="32" y="46" text-anchor="middle" class="a-ar" font-size="22" fill="var(--ink)">اقرأ</text></svg>`;
const pickRow = (key, opts) => `<div class="chips-row">${opts.map(o => `<button class="pick ${draft[key] === o[0] ? 'on' : ''}" data-act="a-pick" data-k="${key}" data-v="${esc(o[0])}">${esc(o[1])}</button>`).join('')}</div>`;
const AUTH = {
  welcome: () => `${logo}<h1 class="hero-t">Iqra</h1><p class="lead">Learn to read, recite and memorize the Quran with lessons that adapt to you.</p>
    <div class="col-gap"><button class="btn primary big" data-act="a-go" data-s="s1">Get started</button><button class="btn" data-act="a-go" data-s="login">I already have an account</button></div>
    ${Auth.remote ? '' : '<p class="muted small center">Cloud sync is not connected, so your account will live on this device.</p>'}
    <p class="muted small center legal-links"><a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> · <a href="terms.html" target="_blank" rel="noopener">Terms of Use</a></p>`,
  login: () => `<h2>Welcome back</h2><label>Username or email<input id="l-id" autocomplete="username" autocapitalize="none"></label><label>Password<input id="l-pw" type="password" autocomplete="current-password"></label><p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary big" data-act="a-login">Sign in</button><button class="btn ghost" data-act="a-go" data-s="welcome">Back</button></div>`,
  s1: () => `<div class="dots"><i class="on"></i><i></i><i></i></div><h2>Let's get to know you</h2><label>Your name<input id="p-name" value="${esc(draft.name || '')}" autocomplete="given-name"></label>
    <label>Age<input id="p-age" type="number" inputmode="numeric" min="1" max="120" value="${esc(draft.age || '')}"></label><label>Gender</label>${pickRow('gender', [['male', 'Male'], ['female', 'Female'], ['na', 'Prefer not to say']])}<p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary big" data-act="a-next1">Next</button><button class="btn ghost" data-act="a-go" data-s="welcome">Back</button></div>`,
  s2: () => `<div class="dots"><i class="on"></i><i class="on"></i><i></i></div><h2>Where are you now?</h2><p class="muted">This shapes your lessons, daily tasks and how strict your recitation coach is. You can change it any time.</p>
    <button class="lv plc-card" data-act="a-placement"><span class="ico">${ic('compass', 22)}</span><div><b>${draft.placed ? 'Retake the placement quiz' : 'Take the placement quiz'}</b><small>${draft.placed ? 'Result saved. Tap to redo it.' : 'Recommended. An in-depth check of your Arabic, about 5 minutes.'}</small></div>${ic('chevR', 18)}</button>
    <p class="muted small center">or choose yourself</p><div class="levels">${LEVELS.map(l => `<button class="lv ${draft.level === l.id ? 'on' : ''}" data-act="a-level" data-l="${l.id}"><span class="ico">${ic(l.icon, 22)}</span><div><b>${l.t}</b><small>${l.d}</small></div>${draft.level === l.id ? ic('check', 20) : ''}</button>`).join('')}</div>
    <label>Daily goal</label>${pickRow('goalMin', [[5, '5 min'], [10, '10 min'], [20, '20 min'], [30, '30 min']])}<p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary big" data-act="a-next2">Next</button><button class="btn ghost" data-act="a-go" data-s="s1">Back</button></div>`,
  s3: () => `<div class="dots"><i class="on"></i><i class="on"></i><i class="on"></i></div><h2>Create your account</h2><p class="muted">So your progress follows you on every device.</p>
    <label>Username<input id="r-user" autocomplete="username" autocapitalize="none" placeholder="letters, numbers, _"></label><label>Email<input id="r-email" type="email" autocomplete="email"></label>
    <label>Password<input id="r-pw" type="password" autocomplete="new-password" placeholder="8+ characters"></label>
    <label class="check-row card"><input type="checkbox" id="r-agree" data-agree><span>I agree to the <a href="terms.html" target="_blank" rel="noopener">Terms of Use</a> and the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</span></label><p class="err" id="err"></p>
    <div class="col-gap"><button class="btn primary big" data-act="a-create" id="r-go" disabled>Create account</button><button class="btn ghost" data-act="a-go" data-s="s2">Back</button></div>`,
};
function renderAuth() { document.body.classList.add('authing'); app.innerHTML = `<div class="auth"><div class="auth-card enter">${AUTH[step]()}</div></div>`; }
P.resetAuthFlow.fn = s => { step = s; draft = { gender: '', level: '', goalMin: 10, leniency: '', placed: null }; renderAuth(); };
// The placement quiz opens automatically after the first questions; skipping it is one tap.
function startQuiz() {
  runPlacement($('.auth-card'), {
    onCancel: () => { draft.quizSkipped = true; step = 's2'; renderAuth(); },
    onDone: r => { draft.level = r.level; draft.leniency = r.leniency; draft.placed = r.scores; step = 's2'; renderAuth(); toast('Level set. You can still change it.', 'check'); },
  });
}
const authErr = m => { const e = $('#err'); if (e) e.textContent = m; };

// =====================================================================
// Shell
// =====================================================================
const NAV = [['home', 'Home', 'home'], ['quran', 'Quran', 'book'], ['prayer', 'Prayer', 'dome'], ['progress', 'Progress', 'chart'], ['more', 'More', 'more']];

async function boot() {
  document.body.classList.remove('authing'); applyTheme();
  app.innerHTML = `<header class="appbar" id="appbar"><div class="ab-l"></div><div class="ab-t" aria-hidden="true"></div><div class="ab-r"></div><button class="ab-nur" data-act="nur" aria-label="Ask Nur">${ic('sparkle', 20)}</button></header><div id="offline" class="offline" hidden role="status">You're offline. Reading and saved lessons still work.</div><main id="view" class="view"></main><div id="mini" class="mini" hidden></div>
    <nav class="nav" aria-label="Main"><span class="nav-glass"></span><span class="nav-pill"></span>${NAV.map(n => `<a href="#/${n[0]}" data-tab="${n[0]}"><span class="ni">${ic(n[2], 20)}</span><span class="nl">${n[1]}</span></a>`).join('')}</nav>`;
  initNav(); renderMini(); const off = () => { const o = $('#offline'); if (o) o.hidden = navigator.onLine; }; window.addEventListener('online', off); window.addEventListener('offline', off); off();
  try { surahList = await getSurahList(); } catch { surahList = []; }
  window.__surahList = surahList;
  startAthan(); EX.loadBanner().then(() => { if ($('#view') && /^#\/(home)?$/.test(location.hash || '#/')) route(true); }); EX.refreshCommunity();
  route(); legalGate();
}

// Everyone must accept the Terms and Privacy Policy once, including people who signed up before they existed.
function legalGate() {
  if (!S.profile || S.profile.agreedAt || $('.legal-gate')) return;
  const g = document.createElement('div'); g.className = 'legal-gate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true');
  g.innerHTML = `<div class="legal-card"><span class="ico big">${ic('shield', 26)}</span><h2>Before you continue</h2><p class="muted">We added a Privacy Policy and Terms of Use. Take a look and accept to keep going.</p><p><a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> · <a href="terms.html" target="_blank" rel="noopener">Terms of Use</a></p><label class="check-row"><input type="checkbox" id="lg-ok"><span>I have read and agree to the Terms of Use and Privacy Policy.</span></label><button class="btn primary big" id="lg-go" disabled>Accept and continue</button></div>`;
  document.body.append(g); requestAnimationFrame(() => g.classList.add('in'));
  $('#lg-ok', g).onchange = e => { $('#lg-go', g).disabled = !e.target.checked; };
  $('#lg-go', g).onclick = () => { S.profile.agreedAt = Date.now(); if (draft.quizSkipped && !draft.placed) S.profile.placementLater = Date.now(); save(); g.classList.remove('in'); setTimeout(() => g.remove(), 260); };
}

// ---------- the tab bar: slide the highlight, the page only changes when you let go
let navApi = null;
function initNav() {
  const nav = $('.nav'), pill = $('.nav-pill'), links = $$('.nav a'), icons = $$('.nav .ni');
  const pad = 8; let cw = 0, W = 0, active = 0, x = 0, v = 0, tx = 0, pressed = false, raf = 0, ws = 1, hs = 1, bulge = 0, bv = 0, lastCell = -1, glare = 0;
  const center = i => pad + cw * (i + .5), cellAt = px => Math.max(0, Math.min(links.length - 1, Math.floor((px - pad) / cw)));
  const measure = () => { const r = nav.getBoundingClientRect(); W = r.width; cw = (W - 2 * pad) / links.length; pill.style.width = cw + 'px'; if (!pressed) { x = tx = center(active); } paint(); };
  function paint() {
    const sx = ws * (1 + bulge * .2), sy = hs * (1 - bulge * .1);
    pill.style.transform = `translate3d(${x - cw / 2}px,0,0) scale(${sx},${sy})`;
    icons.forEach((el, i) => { const d = (center(i) - x) / (cw * .85), mag = pressed ? .16 * Math.exp(-d * d * 1.6) : 0; el.style.transform = `translateY(${-mag * 8}px) scale(${1 + mag})`; });
    nav.style.setProperty('--gx', glare + 'px');
  }
  function frame() {
    const k = pressed ? .24 : .17, damp = pressed ? .7 : .76;
    v += (tx - x) * k; v *= damp; x += v;
    const bt = Math.min(1, Math.abs(v) / 12); bv += (bt - bulge) * .3; bv *= .68; bulge += bv;
    const wt = pressed ? .86 : 1, ht = pressed ? .92 : 1; ws += (wt - ws) * .22; hs += (ht - hs) * .22; glare += (x - glare) * .3;
    paint();
    if (pressed || Math.abs(tx - x) > .15 || Math.abs(v) > .08 || Math.abs(bulge) > .004 || Math.abs(ws - wt) > .004 || Math.abs(hs - ht) > .004) raf = requestAnimationFrame(frame);
    else { x = tx; v = 0; bulge = 0; ws = wt; hs = ht; raf = 0; paint(); }
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const clampX = px => Math.max(center(0) - cw * .2, Math.min(center(links.length - 1) + cw * .2, px));
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
bus.addEventListener('player', () => { renderMini(); const l = $('#llist'); if (l) l.innerHTML = listenRows(); });
bus.addEventListener('ptime', e => { const b = $('#mpb'); if (b && e.detail.d) b.style.width = (e.detail.t / e.detail.d * 100) + '%'; });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-mp]'); if (!b) return; const k = b.dataset.mp; feel('tick', 'tick');
  if (k === 'toggle') togglePlayer(); else if (k === 'next') nextAyah(); else if (k === 'prev') prevAyah(); else if (k === 'stop') stopPlayer();
  else if (k === 'open') { const it = Player.q[Player.i]; if (it && it.n) location.hash = '#/surah/' + it.n; }
});
bus.addEventListener('audio', e => { $$('.ayah.playing').forEach(x => x.classList.remove('playing')); if (e.detail) $$(`.ayah[data-g="${e.detail}"]`).forEach(x => { x.classList.add('playing'); x.scrollIntoView({ block: 'center', behavior: 'smooth' }); }); });

// ---------- app bar: back link or wordmark on the left, Nur on the right, page title fades in on scroll
function fillBar(view, a) {
  const bar = $('#appbar'); if (!bar) return; const L = $('.ab-l', bar), bk = view.querySelector('.back');
  L.replaceChildren(); if (bk) L.append(bk); else L.innerHTML = `<a class="wordmark" href="#/home" aria-label="Iqra home"><span class="wm-dot"></span>Iqra</a>`;
  const t = view.querySelector('h1,h2'); $('.ab-t', bar).textContent = t && !/^Assalamu/.test(t.textContent) ? t.textContent : ''; bar.classList.toggle('scrolled', window.scrollY > 40); bar.dataset.v = a; $('.ab-r', bar).innerHTML = a === 'home' && streakNow() > 0 ? `<span class="streak-t">${streakNow()}-day streak</span>` : '';
}
window.addEventListener('scroll', () => { const b = $('#appbar'); if (b) b.classList.toggle('scrolled', window.scrollY > 40); }, { passive: true });
function nurHere() {
  const a = (location.hash.slice(2) || 'home').split('/')[0], h = location.hash.slice(2).split('/');
  const C = {
    home: ['Planning my learning', ['What should I learn next?', 'Quiz me on what I know', 'How do I build a daily habit?']],
    path: ['Looking at my learning path', ['Why this order?', 'Can I skip ahead?', 'What should I review?']],
    quran: ['Browsing the Quran list', ['Which surah should I memorize first?', 'What are the shortest surahs?', 'Help me make a plan']],
    listen: ['In the listening section', ['Which reciter is best for learning?', 'How do I memorize by listening?']],
    prayer: ['On the prayer page', ['How do I pray Fajr step by step?', 'What do I say in the sitting?', 'Which method should I choose?']],
    progress: ['Looking at my progress', ['How am I doing?', 'What should I focus on this week?']],
    more: ['In the More menu', ['What can Iqra do?', 'How does grading work?']],
    surah: ['Reading a surah', ['Give me an overview of this surah', 'Tajweed tips for this surah', 'How do I memorize it?']],
  }[a] || ['', []];
  let extra = C[0] + (weakCount() ? '. Words the student keeps missing: ' + weakSummary() : ''); if (a === 'surah' && h[1]) { const s = surahList[+h[1] - 1]; if (s) extra = `Looking at Surah ${s.en} (${s.count} ayahs)` + (weakCount() ? '. Words the student keeps missing: ' + weakSummary() : ''); }
  openNur({ extra, sug: C[1] });
}
// ---------- router
const VIEWS = {
  home: viewHome, path: viewPath, quran: viewQuran, listen: viewListen, surah: viewSurah, progress: viewProgress, more: viewMore,
  account: P.viewAccount, settings: P.viewSettings, shop: P.viewShop, fasting: P.viewFasting, hadith: P.viewHadith, advice: P.viewAdvice, prayer: viewPrayerTab, dhikr: P.viewDhikr, alphabet: P.viewAlphabet, about: P.viewAbout, halal: HL.viewHalal, community: EX.viewCommunity,
};
async function route(keep = false) {
  const view = $('#view'); if (!view) return;
  clearTimers();
  let [a = 'home', b] = (location.hash.slice(2) || 'home').split('/');
  if (a === 'more' && b && VIEWS[b]) { a = b; b = undefined; }
  const tab = { home: 0, path: 0, quran: 1, listen: 1, surah: 1, prayer: 2, progress: 3 }[a] ?? 4; navApi && navApi.set(tab);
  const tok = ++rtok, y = view.scrollTop || window.scrollY;
  const fn = VIEWS[a] || viewHome; view.dataset.v = a;
  try {
    const out = await fn(b); if (tok !== rtok) return;
    view.classList.remove('enter'); view.innerHTML = (['home', 'path', 'quran', 'listen', 'progress', 'more'].includes(a) ? EX.bannerHTML() : '') + out.html; if (!keep) { void view.offsetWidth; view.classList.add('enter'); } out.after && out.after();
    window.scrollTo(0, keep ? y : 0); fillBar(view, a);
  } catch (e) { if (tok === rtok) view.innerHTML = `<div class="card center"><h3>Couldn't load</h3><p class="muted">${getErr(e)}</p><p class="muted small">Check your connection, then retry.</p><button class="btn primary" data-act="retry">Retry</button></div>`; }
}
window.addEventListener('hashchange', () => { closeSheet(); route(); });
window.addEventListener('iqra-refresh', () => { if ($('#view')) route(true); });
window.addEventListener('iqra-next', () => ACT['start-next']());

// =====================================================================
// Home
// =====================================================================
const weakCard = () => { const n = weakCount(); return n ? `<button class="card lrow plain weak-card" data-act="weak"><span class="ico">${ic('target', 20)}</span><div class="grow"><b>${n} word${n > 1 ? 's' : ''} to revisit</b><small class="muted">Words you missed before</small></div>${ic('chevR', 18, 'dim')}</button>` : ''; };
const weakSummary = () => weakList().sort((a, b) => b.c - a.c).slice(0, 8).map(w => `${w.w} (Surah ${(surahList[w.n - 1] || {}).en || w.n}, ayah ${w.a})`).join('; ');
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
const nudge = () => { const n = streakNow(), d = day(); if (n > 0 && dayMinutes(d) < 1 && new Date().getHours() >= 17) return `<p class="nudge">${ic('flame', 16)}<span>Your ${n}-day streak ends tonight. A 5-minute lesson keeps it.</span></p>`; return ''; };
const goalRing = (p, mins, goal) => `<div class="gring2" role="img" aria-label="${mins} of ${goal} minutes today"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" class="g-t"/><circle cx="22" cy="22" r="19" class="g-p" id="gp" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" data-p="${p}" transform="rotate(-90 22 22)"/></svg><b>${mins}</b><small>of ${goal}m</small></div>`;
function todayCard(p, d, ses, tr) {
  const goal = p.goalMin || 10, prog = Math.min(1, d.secs / (goal * 60)), it = nextItem(surahList), mins = dayMinutes(d);
  let kick = 'Up next', title = 'You finished your path', sub = 'Pick any surah or revise what you know', cta = `<a class="btn primary big grow" href="#/quran">Browse the Quran</a>`, ar = '', ico = 'book';
  if (ses) { kick = 'Pick up where you left off'; title = ses.title; sub = `${ses.sub ? ses.sub + ' · ' : ''}${ses.pct}% done`; cta = `<button class="btn primary big grow" data-act="resume">Resume</button>`; ico = 'play'; }
  else if (it && it.k === 'lesson') { const m = lessonMeta(it.id); title = m.title; sub = m.sub; ar = m.short || ''; ico = m.icon; cta = `<button class="btn primary big grow" data-act="start-lesson" data-id="${it.id}">Start lesson</button>`; }
  else if (it) { const s = surahList[it.n - 1], l = (S.surahs[it.n] || { learned: [] }).learned.length; kick = l ? 'Continue learning' : 'Up next'; title = s.en; sub = `${s.tr} · ${l}/${s.count} ayahs`; ar = s.ar; cta = `<button class="btn primary big grow" data-act="learn" data-n="${s.n}">${l ? 'Continue' : 'Start learning'}</button>`; }
  const left = Math.max(0, goal - mins);
  return `<section class="card hero2"><div class="h2-top"><div class="h2-l"><small class="kick">Today</small><h2 class="mins">${mins}<span> of ${goal} min</span></h2><p class="muted">${left ? `${left} min to reach your goal` : 'Daily goal reached. Well done.'}</p></div>${archHTML(prog)}</div>
    <div class="h2-next"><span class="ico">${ic(ico, 20)}</span><div class="grow"><small class="muted">${esc(kick)}</small><b>${esc(title)}</b><small class="muted">${esc(sub)}</small></div>${ar ? `<span class="ar h2-ar" dir="rtl">${esc(ar)}</span>` : ''}</div>
    <div class="row-gap">${cta}<a class="btn" href="#/path">${ic(tr.icon, 16)} Path</a></div></section>`;
}
async function viewHome() {
  if (!surahList.length) { try { surahList = await getSurahList(); window.__surahList = surahList; } catch { /* offline */ } }
  const p = S.profile || {}, d = day(), hj = hijri();
  const ses = sessionInfo(), due = dueReviews().length, tr = TRACKS[S.track], wk = weakCount(), qs = questsNow(), qDone = qs.filter(q => (d[q.k] || 0) >= q.g).length;
  const row = (act, icon, t, sub, v = '') => `<button class="hrow" data-act="${act}"><span class="ico">${ic(icon, 20)}</span><div class="grow"><b>${t}</b><small class="muted">${sub}</small></div>${v ? `<b class="hrow-v">${v}</b>` : ''}${ic('chevR', 16, 'dim')}</button>`;
  const foryou = [EX.prayerWidget(), due >= 4 ? row('review', 'repeat', `${due} ayahs to refresh`, 'Keeps them from fading') : '', wk ? row('weak', 'target', `${wk} word${wk > 1 ? 's' : ''} to revisit`, 'Words you missed before') : ''].filter(Boolean).join('');
  return {
    html: `<header class="hhead"><span class="avatar">${ic(S.settings.avatar, 22)}</span><div><small class="muted">${hj ? esc(hj.text) : ''}</small><h1>Assalamu alaykum, ${esc(p.name || 'friend')}</h1></div></header>
    ${nudge()}
    ${!p.placement && !p.placementLater ? `<section class="card up plc-nudge"><div class="up-h"><span class="ico big">${ic('compass', 22)}</span><div><small class="muted">Recommended</small><h3>Find your level</h3><p class="muted">A 5 minute quiz tunes your lessons and how strict your coach is.</p></div></div><div class="row-gap"><button class="btn primary grow" data-act="placement">Take the quiz</button><button class="btn ghost" data-act="plc-later">Not now</button></div></section>` : ''}
    ${todayCard(p, d, ses, tr)}
    <section class="card rl-list">${foryou}</section>
    <section class="qa" aria-label="Quick actions"><button data-act="recite-pick"><span class="ico">${ic('mic', 22)}</span><b>Recite</b></button><a href="#/listen"><span class="ico">${ic('headphones', 22)}</span><b>Listen</b></a><button data-act="nur"><span class="ico">${ic('sparkle', 22)}</span><b>Ask Nur</b></button><a href="#/more/halal"><span class="ico">${ic('scan', 22)}</span><b>Halal</b></a></section>
    <details class="card tasks"><summary><div class="grow"><h3>Today's goals</h3><div class="seg-dots">${qs.map(q => `<i class="${(d[q.k] || 0) >= q.g ? 'on' : ''}"></i>`).join('')}</div></div><span class="pill ${qDone === qs.length ? 'gold' : ''}">${qDone}/${qs.length}</span>${ic('chevD', 18, 'dim')}</summary>${qs.map(q => { const v = Math.min(q.g, d[q.k] || 0); return `<div class="quest ${v >= q.g ? 'done' : ''}"><span class="qi">${ic(v >= q.g ? 'check' : 'target', 16)}</span><div class="grow"><b>${q.t}</b><div class="progress thin"><i style="width:${v / q.g * 100}%"></i></div></div></div>`; }).join('')}<small class="muted">Resets at midnight</small></details>
    <section class="card daily" id="daily"><small class="muted">Ayah of the day</small><div class="skeleton"></div></section>`,
    after: () => { loadDaily(); EX.startPrayerWidget(); requestAnimationFrame(() => requestAnimationFrame(() => { const a = $('#aprog'); if (a) a.setAttribute('stroke-dashoffset', 100 * (1 - +a.dataset.p)); })); },
  };
}
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
  return `<a class="srow ${st} ${lock ? 'locked' : ''}" href="#/surah/${s.n}"><span class="snum"><b>${s.n}</b></span><div class="sinfo"><b>${esc(s.en)}</b><small>${esc(s.tr)} · ${s.count} ayahs</small>${st === 'learning' ? `<div class="progress thin"><i style="width:${pc}%"></i></div>` : ''}</div><div class="sright"><span class="ar sname">${esc(s.ar)}</span>${lock ? `<small class="lockt">${ic('lock', 12)} Lv ${reqLevel(s.count)}</small>` : `<i class="stat">${stIcon(st)}</i>`}</div></a>`;
}
function filteredSurahs() {
  let l = surahList; const q = qSearch.trim();
  if (qFilter === 'path') { const ns = planItems().filter(i => i.k === 'surah').map(i => i.n); l = ns.map(n => surahList[n - 1]).filter(Boolean); } else if (qFilter !== 'all') l = l.filter(s => statusOf(s.n) === qFilter);
  if (q) l = searchSurahs(l, q);
  return l;
}
const listHTML = () => filteredSurahs().map(surahRow).join('') || '<p class="muted center">Nothing here yet.</p>';
const rlSeg = on => `<div class="seg rdls"><a class="${on === 'read' ? 'on' : ''}" href="#/quran">${ic('book', 16)} Read</a><a class="${on === 'listen' ? 'on' : ''}" href="#/listen">${ic('headphones', 16)} Listen</a></div>`;
const recName = id => (RECITERS.find(r => r.id === id) || RECITERS[0]).n;
function listenRows() {
  const L = listenState(), q = lSearch.trim(); let l = surahList;
  if (lFilter === 'short') l = l.filter(x => x.count <= 25); else if (lFilter === 'meccan') l = l.filter(x => /mecc/i.test(x.type)); else if (lFilter === 'medinan') l = l.filter(x => /medin/i.test(x.type)); else if (lFilter === 'favs') l = l.filter(x => L.favs.includes(x.n));
  if (q) l = searchSurahs(l, q);
  const cur = Player.q[Player.i], now = cur && cur.n;
  return l.map(x => `<div class="lrow2 ${now === x.n ? 'now' : ''}"><a class="lr-info" href="#/surah/${x.n}"><span class="num">${x.n}</span><div class="grow"><b>${esc(x.en)}</b><small class="muted">${esc(x.tr)} · ${x.count} ayahs</small></div><span class="ar lr-ar">${esc(x.ar)}</span></a><button class="icon-btn sm fav ${L.favs.includes(x.n) ? 'on' : ''}" data-act="listen-fav" data-n="${x.n}" aria-label="Favorite">${ic('heart', 18)}</button><button class="icon-btn play" data-act="listen-play" data-n="${x.n}" aria-label="Play ${esc(x.en)}">${ic(now === x.n && Player.playing ? 'pause' : 'play', 18)}</button></div>`).join('') || '<p class="muted center">Nothing here yet.</p>';
}
async function viewListen() {
  if (!surahList.length) surahList = await getSurahList();
  const L = listenState(), last = L.last && surahList[L.last.n - 1], F = [['all', 'All'], ['favs', 'Favorites'], ['short', 'Short'], ['meccan', 'Meccan'], ['medinan', 'Medinan']];
  const sl = sleepLeft(), seg = (items, on, act) => `<div class="seg">${items.map(i => `<button class="${String(on) === String(i[0]) ? 'on' : ''}" data-act="${act}" data-v="${i[0]}">${i[1]}</button>`).join('')}</div>`;
  return { html: `<header class="top"><h1>Quran</h1></header>${rlSeg('listen')}
    <button class="card nur-card" data-act="reciter-pick"><span class="ico big">${ic('mic', 22)}</span><div class="grow"><small class="muted">Reciter</small><b>${esc(recName(S.settings.reciter))}</b></div>${ic('chevR', 18, 'dim')}</button>
    ${last ? `<section class="card resume"><div class="up-h"><span class="ico big">${ic('play', 22)}</span><div><small class="muted">Continue listening</small><h3>${esc(last.en)}</h3><p class="muted">Ayah ${L.last.a} of ${last.count}</p></div></div><button class="btn primary big" data-act="listen-resume">${ic('play', 18)} Resume</button></section>` : ''}
    ${L.recents.length ? `<h3 class="sec">Recently played</h3><div class="chips-row scroll">${L.recents.map(n => surahList[n - 1]).filter(Boolean).map(x => `<button class="pick" data-act="listen-play" data-n="${x.n}">${ic('play', 14)} ${esc(x.en)}</button>`).join('')}</div>` : ''}
    <details class="card form pbopts"><summary><span>Playback options</span><small class="muted">Repeat, speed, sleep timer</small></summary>
      <label class="switch-row"><span><b>Play the next surah automatically</b><small class="muted">Keeps going when a surah ends</small></span><input type="checkbox" data-set="autoNext" ${S.settings.autoNext !== false ? 'checked' : ''}></label>
      <label>Repeat</label>${seg([['off', 'Off'], ['ayah', 'Ayah'], ['surah', 'Surah']], S.settings.repeat || 'off', 'listen-repeat')}
      <label>Speed</label>${seg([[0.75, '0.75×'], [1, '1×'], [1.25, '1.25×']], S.settings.rate || 1, 'listen-rate')}
      <label>Sleep timer ${sl ? `<small class="muted">· stops in ${Math.ceil(sl / 6e4)} min</small>` : ''}</label>${seg([[0, 'Off'], [15, '15 min'], [30, '30 min'], [60, '1 hr']], sl ? '' : 0, 'listen-sleep')}</details>
    <label class="search">${ic('search', 18)}<input id="lsearch" placeholder="Search surahs to listen" value="${esc(lSearch)}" type="search" aria-label="Search surahs"></label>
    <div class="chips-row scroll">${F.map(f => `<button class="pick ${lFilter === f[0] ? 'on' : ''}" data-act="lfilter" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
    <div class="slist" id="llist">${listenRows()}</div>` };
}
async function viewQuran() {
  if (!surahList.length) surahList = await getSurahList();
  const F = [['all', 'All'], ['path', 'My path'], ['learning', 'Learning'], ['learned', 'Learned'], ['mastered', 'Mastered']];
  return { html: `<header class="top"><h1>Quran</h1><span class="chip">${learnedTotal()} / ${TOTAL_AYAHS} ayahs</span></header>${rlSeg('read')}
    <label class="search">${ic('search', 18)}<input id="qsearch" placeholder="Search 114 surahs" value="${esc(qSearch)}" type="search" aria-label="Search surahs"></label><div class="chips-row scroll">${F.map(f => `<button class="pick ${qFilter === f[0] ? 'on' : ''}" data-act="filter" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
    <div class="slist" id="qlist">${listHTML()}</div>` };
}
const ayahHTML = (a, learned) => `<article class="ayah ${learned ? 'learned' : ''}" data-g="${a.g}"><div class="ayah-top"><span class="num">${a.n}</span><button class="icon-btn sm" data-act="play-from" data-a="${a.n}" aria-label="Play from ayah ${a.n}">${ic('play', 16)}</button>${learned ? `<span class="chk">${ic('check', 14)}</span>` : ''}</div><p class="ar" dir="rtl">${esc(a.ar)}</p>${S.settings.translit ? `<p class="tl">${esc(a.tr)}</p>` : ''}${S.settings.translation ? `<p class="en">${esc(a.en)}</p>` : ''}</article>`;
async function viewSurah(n) {
  n = +n; if (!surahList.length) surahList = await getSurahList();
  const s = surahList[n - 1]; if (!s) return { html: `${back('#/quran', 'Quran')}<p class="muted">Surah not found.</p>` };
  const ayahs = await getSurah(n), r = S.surahs[n], st = statusOf(n), l = r ? r.learned.length : 0, lock = !unlocked(s), ses = sessionInfo();
  const resume = ses && ses.kind === 'surah' && ses.n === n;
  const act = lock ? `<div class="banner">${ic('lock', 16)} Opens at <b>stage ${reqLevel(s.count)}</b> as you keep learning (you're at stage ${levelOf(S.xp)}). Or turn on <a href="#/more/settings">Explorer mode</a>.</div>`
    : `<div class="col-gap">${resume ? `<button class="btn primary big" data-act="resume">Resume lesson · ${ses.pct}%</button>` : st === 'learned' || st === 'mastered' ? `<button class="btn primary big" data-act="recite-surah" data-n="${n}" data-m="${st === 'learned' ? 1 : ''}">${ic('mic', 18)} ${st === 'mastered' ? 'Recite again' : 'Recite for mastery'}</button>` : `<button class="btn primary big" data-act="learn" data-n="${n}">${l ? 'Continue learning' : 'Start learning'}</button>`}
      <div class="row-gap"><button class="btn grow" data-act="recite-surah" data-n="${n}">${ic('mic', 16)} Practice</button><button class="btn grow" data-act="play-surah" data-n="${n}">${ic('headphones', 16)} Listen</button><button class="btn grow" data-act="nur-surah" data-n="${n}">${ic('message', 16)} Nur</button></div></div>`;
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
  const W = 320, H = 84, bw = 28, gap = (W - 7 * bw) / 8, max = Math.max(1, ...vals);
  return `<svg viewBox="0 0 ${W} ${H + 24}" class="chart" role="img" aria-label="Last 7 days">${vals.map((v, i) => { const h = Math.round(v / max * H), x = gap + i * (bw + gap); return `<rect x="${x}" y="${H - h}" width="${bw}" height="${h || 3}" rx="9" class="cbar ${i === 6 ? 'today' : ''}"/><text x="${x + bw / 2}" y="${H + 17}" text-anchor="middle">${labels[i]}</text>${v ? `<text x="${x + bw / 2}" y="${H - h - 5}" text-anchor="middle" class="val">${v}</text>` : ''}`; }).join('')}</svg>`;
}
async function viewProgress() {
  if (!surahList.length) surahList = await getSurahList();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); return { k: todayKey(d), l: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()] }; });
  const val_ = k => { const r = S.daily[k]; if (!r) return 0; return chartMetric === 'minutes' ? Math.round((r.secs || 0) / 60) : r[chartMetric] || 0; };
  const vals = days.map(d => val_(d.k)), lv = levelOf(S.xp), lt = learnedTotal(), mt = masteredTotal();
  const doneN = surahList.filter(s => ['learned', 'mastered'].includes(statusOf(s.n))).length, mastered = surahList.filter(s => statusOf(s.n) === 'mastered');
  const M = [['minutes', 'Minutes'], ['ayahs', 'Ayahs']], lessonsDone = Object.keys(S.lessons).length;
  const stat = (v, l) => `<div class="st"><b>${v}</b><small>${l}</small></div>`;
  const over = `<section class="card statband">${stat(lessonsDone, 'lessons done')}${stat(streakNow(), 'day streak')}${stat(lt, 'ayahs learned')}</section>
    <section class="card"><div class="row-between"><h3>This week</h3><div class="seg sm">${M.map(m => `<button class="${chartMetric === m[0] ? 'on' : ''}" data-act="metric" data-m="${m[0]}">${m[1]}</button>`).join('')}</div></div>${vals.some(v => v > 0) ? barChart(vals, days.map(d => d.l)) : `<p class="muted center empty-c">Nothing yet this week. A short lesson starts your chart.</p>`}</section>
    <section class="card quranbar"><div class="row-between"><h3>The Quran</h3><b>${(lt / TOTAL_AYAHS * 100).toFixed(1)}%</b></div><div class="progress"><i style="width:${Math.max(lt ? 1 : 0, lt / TOTAL_AYAHS * 100)}%"></i></div><div class="qb-row"><span><b>${doneN}</b>/114 surahs learned</span><span><b>${mt}</b>/114 mastered</span><span><b>${S.recites.length}</b> recitations</span></div></section>
    ${weakCard()}
    <section class="card"><h3>Recitations</h3>${S.recites.length ? S.recites.slice(0, 6).map(r => { const g = gradeOf(r.score); return `<div class="mrow"><span class="ico">${ic('mic', 18)}</span><div class="grow"><b>${esc(r.name)} · ${r.from}${r.to > r.from ? '–' + r.to : ''}</b><small class="muted">${new Date(r.at).toLocaleDateString()} · ${g[0]}${r.mastery ? ' · mastery attempt' : ''}</small></div><b class="${g[1] === 'good' ? 'ok-t' : ''}">${r.score}%</b></div>`; }).join('') : '<p class="muted">Recite any surah to see your graded history here.</p>'}</section>`;
  const surs = `<section class="card"><h3>All 114 surahs</h3><div class="legend"><span><i class="c new"></i>new</span><span><i class="c learning"></i>learning</span><span><i class="c learned"></i>learned</span><span><i class="c mastered"></i>mastered</span></div><div class="grid114">${surahList.map(s => `<a class="cell ${statusOf(s.n)}" href="#/surah/${s.n}" title="${esc(s.en)}">${s.n}</a>`).join('')}</div></section>
    <section class="card"><h3>Mastery</h3>${mastered.length ? mastered.map(s => `<a class="mrow" href="#/surah/${s.n}"><span class="ico">${ic('award', 18)}</span><div class="grow"><b>${esc(s.en)}</b><small class="muted">${new Date(S.surahs[s.n].masteredAt || Date.now()).toLocaleDateString()}</small></div><b class="ok-t">${S.surahs[s.n].best || 100}%</b></a>`).join('') : '<p class="muted">No surah mastered yet. Learn one, then recite it with no real mistakes.</p>'}</section>`;
  const got = BADGES.filter(b => S.badges[b.id]), lockedB = BADGES.filter(b => !S.badges[b.id]);
  const bdg = `<section class="card"><h3>Milestones <small class="muted">${got.length}/${BADGES.length}</small></h3><div class="badges">${got.concat(lockedB).map(b => `<div class="badge ${S.badges[b.id] ? 'got' : ''}" title="${esc(b.d)}"><span>${ic(S.badges[b.id] ? b.i : 'lock', 22)}</span><b>${esc(b.n)}</b><small>${esc(b.d)}</small></div>`).join('')}</div></section>`;
  return {
    html: `<header class="top"><h1>Progress</h1></header>
    <div class="seg" role="tablist">${[['overview', 'Overview'], ['surahs', 'Surahs'], ['badges', 'Milestones']].map(t => `<button role="tab" aria-selected="${progTab === t[0]}" class="${progTab === t[0] ? 'on' : ''}" data-act="ptab" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>
    ${progTab === 'surahs' ? surs : progTab === 'badges' ? bdg : over}`,
  };
}

// =====================================================================
// More
// =====================================================================
function viewMore() {
  const G = [
    ['Learn', [['path', 'route', 'Your path', 'Lessons and library'], ['alphabet', 'type', 'Arabic alphabet', 'Letters and sounds'], ['advice', 'bulb', 'Learning advice', 'Memorization tips'], ['games', 'dice', 'Break games', 'Short letter games to rest your mind']]],
    ['Daily life', [['community', 'users', 'Community', 'News from the Iqra team'], ['halal', 'scan', 'Halal scanner', 'Scan a barcode to check ingredients'], ['dhikr', 'beads', 'Dhikr counter', 'Tasbih'], ['fasting', 'moon', 'Fasting log', 'Track your fasts'], ['hadith', 'quote', 'Hadith', 'Daily wisdom']]],
    ['You', [['account', 'user', 'Account', 'Profile and sign-in'], ['shop', 'bag', 'Appearance', 'Accent color and avatar'], ['settings', 'settings', 'Settings', 'Appearance, sound, reciter']]],
    ['About', [['about', 'info', 'About Iqra', 'How it works'], ['privacy', 'shield', 'Privacy policy', 'How your data is used'], ['terms', 'file', 'Terms of use', 'The rules of the app']]],
  ];
  const href = k => k === 'path' ? '#/path' : k === 'privacy' || k === 'terms' ? `${k}.html` : `#/more/${k}`;
  return { html: `<header class="top"><h1>More</h1></header><a class="card profile" href="#/more/account"><span class="avatar big">${ic(S.settings.avatar, 26)}</span><div class="grow"><b>${esc((S.profile && S.profile.name) || 'Your account')}</b><small class="muted">${esc(TRACKS[S.track].n)} track${streakNow() ? ' · ' + streakNow() + '-day streak' : ''}</small></div>${ic('chevR', 18, 'dim')}</a>
    ${G.map(g => `<h3 class="grp">${g[0]}</h3><div class="card list">${g[1].map(r => r[0] === 'games' ? `<button class="lrow" data-act="arcade"><span class="ico">${ic(r[1], 20)}</span><div class="grow"><b>${r[2]}</b><small class="muted">${r[3]}</small></div>${ic('chevR', 18, 'dim')}</button>` : lrow(r[1], r[2], r[3], href(r[0]), r[0] === 'community' && EX.unreadCount() ? `<span class="badge-n">${EX.unreadCount()}</span>` : '')).join('')}</div>`).join('')}` };
}

// =====================================================================
// Actions
// =====================================================================
const ACT = {
  ...P.PAGE_ACT,
  ...HL.HALAL_ACT,
  'plc-later': () => { S.profile.placementLater = Date.now(); save(); refresh(); },
  retry: () => route(),
  'close-sheet': () => closeSheet(),
  arcade: () => openArcade(),
  nur: () => nurHere(),
  weak: () => {
    const by = {}; weakList().sort((a, b) => b.c - a.c).forEach(w => (by[w.n] = by[w.n] || []).push(w));
    const el = sheet(`<h3>Words to revisit</h3><p class="muted">Get a word right twice in a row and it leaves this list.${S.cleared ? ` You have cleared ${S.cleared} so far.` : ''}</p><div class="weak-list">${Object.entries(by).map(([n, ws]) => `<div class="weak-g"><small class="sec2">${esc((surahList[n - 1] || {}).en || 'Surah ' + n)}</small>${ws.slice(0, 12).map(w => `<div class="weak-r"><span class="ar">${esc(w.w)}</span><div class="grow"><b>Ayah ${w.a}</b><small class="muted">Missed ${w.c}×${w.issue ? ' · ' + esc(w.issue) : ''}</small></div><button class="btn sm" data-act="weak-drill" data-n="${n}" data-a="${w.a}">Practice</button></div>`).join('')}</div>`).join('')}</div><button class="btn primary wide" data-act="weak-nur">${ic('sparkle', 18)} Ask Nur for tips</button>`, 'weak-sheet');
    void el;
  },
  'weak-drill': async t => { const n = +t.dataset.n, a = +t.dataset.a; try { const ays = await getSurah(n), s = surahList[n - 1]; closeSheet(); setTimeout(() => openRecite(s, ays, { from: Math.max(1, a), to: a }), 220); } catch { toast('Could not load that surah. Check your connection.', 'info'); } },
  'weak-nur': () => { closeSheet(); setTimeout(() => openNur({ ask: 'Give me practical tips for the words I keep missing.', extra: 'Words the student keeps missing: ' + weakSummary() }), 220); },
  'nur-surah': t => { const s = surahList[+t.dataset.n - 1]; openNur({ ask: `Give me a short overview of Surah ${s.en}: its theme and one tip for learning it.`, extra: `Looking at Surah ${s.en} (${s.count} ayahs)` }); },
  filter: t => { qFilter = t.dataset.f; refresh(); },
  metric: t => { chartMetric = t.dataset.m; refresh(); },
  ptab: t => { progTab = t.dataset.v; refresh(); },
  resume: () => resumeSession(),
  review: () => startReview(),
  'play-daily': t => playQueue([{ g: +t.dataset.g, n: +t.dataset.n, label: t.dataset.l, sub: `Ayah ${t.dataset.a}` }]),
  'play-surah': t => { const n = +t.dataset.n; playQueue(surahItems(n, surahList), 0, { cont: n }); },
  'listen-play': t => { const n = +t.dataset.n, cur = Player.q[Player.i]; if (cur && cur.n === n && Player.q.length) { togglePlayer(); } else playQueue(surahItems(n, surahList), 0, { cont: n }); setTimeout(() => $('#llist') && ($('#llist').innerHTML = listenRows()), 150); },
  'listen-resume': () => { const L = listenState().last; if (L) playQueue(surahItems(L.n, surahList), Math.max(0, L.a - 1), { cont: L.n }); },
  'listen-fav': t => { const L = listenState(), n = +t.dataset.n; L.favs = L.favs.includes(n) ? L.favs.filter(x => x !== n) : [...L.favs, n]; save(); t.classList.toggle('on', L.favs.includes(n)); if (lFilter === 'favs') $('#llist').innerHTML = listenRows(); },
  lfilter: t => { lFilter = t.dataset.f; $$('[data-act=lfilter]').forEach(b => b.classList.toggle('on', b === t)); $('#llist').innerHTML = listenRows(); },
  'listen-repeat': t => { S.settings.repeat = t.dataset.v; save(); $$('[data-act=listen-repeat]').forEach(b => b.classList.toggle('on', b === t)); },
  'listen-rate': t => { setRate(+t.dataset.v); $$('[data-act=listen-rate]').forEach(b => b.classList.toggle('on', b === t)); },
  'listen-sleep': t => { const m = +t.dataset.v; setSleep(m); $$('[data-act=listen-sleep]').forEach(b => b.classList.toggle('on', b === t)); toast(m ? `Sleep timer: ${m} min` : 'Sleep timer off', 'moon'); },
  'reciter-pick': () => { const el = sheet(`<h3>Choose a reciter</h3><div class="opts col">${RECITERS.map(r => `<button class="opt ${S.settings.reciter === r.id ? 'right' : ''}" data-r="${r.id}"><span>${esc(r.n)}</span>${S.settings.reciter === r.id ? ic('check', 18) : ''}</button>`).join('')}</div>`); el.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; S.settings.reciter = b.dataset.r; save(); closeSheet(); refresh(); }); },
  'play-from': t => { const n = +location.hash.split('/')[2]; playQueue(surahItems(n, surahList), Math.max(0, +t.dataset.a - 1), { cont: n }); },
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
  else if (a === 'a-next1') { draft.name = val('p-name'); draft.age = +val('p-age'); if (!draft.name) return authErr('Please enter your name.'); if (!(draft.age >= 1 && draft.age <= 120)) return authErr('Please enter a valid age.'); if (!draft.gender) return authErr('Please choose an option.'); step = 's2'; renderAuth(); if (!draft.placed && !draft.quizSkipped) startQuiz(); }
  else if (a === 'a-placement') startQuiz();
  else if (a === 'a-next2') { if (!draft.level) return authErr('Pick where you are now.'); step = 's3'; renderAuth(); }
  else if (a === 'a-create') {
    const username = val('r-user').toLowerCase(), email = val('r-email'), password = $('#r-pw').value;
    if (!$('#r-agree').checked) return authErr('Please accept the Terms and Privacy Policy to continue.');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return authErr('Username: 3 to 20 letters, numbers or underscores.'); if (!/^\S+@\S+\.\S{2,}$/.test(email)) return authErr('Enter a valid email.'); if (password.length < 8) return authErr('Password needs 8+ characters.');
    t.disabled = true; t.textContent = 'Creating…';
    try { S.profile = { name: draft.name, age: draft.age, gender: draft.gender, level: draft.level, goalMin: draft.goalMin || 10 }; S.track = trackFor(draft.level); if (draft.level === 'fluent') S.settings.openAll = true; if (draft.leniency) S.settings.leniency = draft.leniency; if (draft.placed) S.profile.placement = { at: Date.now(), scores: draft.placed }; S.profile.agreedAt = Date.now(); S.updatedAt = Date.now(); await register({ username, email, password }); save(); await boot(); toast(`Welcome, ${draft.name}`, 'moon'); }
    catch (er) { S.profile = null; t.disabled = false; t.textContent = 'Create account'; authErr(er.message); }
  } else if (a === 'a-login') {
    t.disabled = true; try { await login({ id: val('l-id'), password: $('#l-pw').value }); if (!S.profile) throw new Error('No profile found for this account on this device.'); await boot(); } catch (er) { t.disabled = false; authErr(er.message); }
  }
});
document.addEventListener('change', e => { if (e.target.dataset && 'agree' in e.target.dataset) { const g = $('#r-go'); if (g) g.disabled = !e.target.checked; } });
document.addEventListener('input', e => {
  if (e.target.id === 'lsearch') { lSearch = e.target.value; $('#llist').innerHTML = listenRows(); }
  if (e.target.id === 'qsearch') { qSearch = e.target.value; $('#qlist').innerHTML = listHTML(); }
  if (e.target.dataset.set === 'fontSize') { S.settings.fontSize = +e.target.value; $('#fso').textContent = e.target.value + 'px'; applyTheme(); }
});
document.addEventListener('change', e => {
  const k = e.target.dataset.set; if (!k) return; const el = e.target;
  S.settings[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value; save();
});

// =====================================================================
// Init
// =====================================================================
// ---------- suspended / removed accounts
function showBan(d = {}) {
  try { localStorage.setItem('iqra_ban', JSON.stringify(d)); } catch { /* ignore */ }
  let g = $('.ban'); if (!g) { g = document.createElement('div'); g.className = 'ban'; g.setAttribute('role', 'alertdialog'); g.setAttribute('aria-modal', 'true'); document.body.append(g); document.body.classList.add('noscroll'); requestAnimationFrame(() => g.classList.add('in')); }
  const until = d.until ? new Date(d.until).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '';
  g.innerHTML = `<div class="ban-card"><span class="ico big">${ic('shield', 28)}</span><h2>Account suspended</h2><p class="muted">${until ? `Your access is paused until <b>${esc(until)}</b>.` : 'Your access has been paused.'}${d.reason ? ` Reason: ${esc(d.reason)}` : ''}</p><p class="muted small">If you think this is a mistake, reach out through the project's issues page.</p><div class="col-gap"><button class="btn primary" id="ban-re">Check again</button><button class="btn" id="ban-out">Sign out</button></div></div>`;
  $('#ban-re', g).onclick = async e => { const b = e.currentTarget; b.disabled = true; try { await api('me'); try { localStorage.removeItem('iqra_ban'); } catch { /* ignore */ } g.classList.remove('in'); setTimeout(() => { g.remove(); document.body.classList.remove('noscroll'); route(true); }, 250); } catch (er) { b.disabled = false; if (!(er.data && er.data.suspended)) toast(er.message || 'Could not check right now'); } };
  $('#ban-out', g).onclick = async () => { try { localStorage.removeItem('iqra_ban'); } catch { /* ignore */ } try { await logout(); } catch { /* ignore */ } location.hash = ''; location.reload(); };
}
window.addEventListener('iqra-banned', e => showBan(e.detail));
window.addEventListener('iqra-gone', async () => { try { localStorage.setItem('iqra_notice', 'That account was removed.'); } catch { /* ignore */ } try { await logout(); } catch { /* ignore */ } location.hash = ''; location.reload(); });
let lastCheck = 0;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Auth.token && Date.now() - lastCheck > 60000) { lastCheck = Date.now(); api('me').catch(() => {}); } });

(async function init() {
  applyTheme(); await probe();
  const ok = await restore() && S.profile, note = (() => { try { const n = localStorage.getItem('iqra_notice'); localStorage.removeItem('iqra_notice'); return n; } catch { return ''; } })();
  if (ok) { boot(); let bn = null; try { bn = JSON.parse(localStorage.getItem('iqra_ban')); } catch { /* none */ } if (bn && !$('.ban')) { showBan(bn); if (Auth.token) api('me').then(() => { try { localStorage.removeItem('iqra_ban'); } catch { /* ignore */ } $('.ban')?.remove(); document.body.classList.remove('noscroll'); }).catch(() => {}); } } else { step = 'welcome'; renderAuth(); }
  if (note) setTimeout(() => toast(note, 'info'), 400);
})();
void FOUNDATION_SURAHS;

// ---------- back to top: shows on any long scroll, in pages and in full-screen lists
(() => {
  const b = document.createElement('button'); b.className = 'totop'; b.setAttribute('aria-label', 'Back to top'); b.innerHTML = ic('chevU', 22); document.body.append(b);
  let cur = null; const root = () => document.scrollingElement || document.documentElement;
  const hide = () => { b.classList.remove('on'); cur = null; };
  document.addEventListener('scroll', e => {
    const t = e.target === document ? root() : e.target; if (!t || t.scrollTop === undefined) return;
    if (t.scrollTop > 480 && t.scrollHeight - t.clientHeight > 700) { cur = t; b.classList.add('on'); } else if (t === cur) hide();
  }, true);
  b.addEventListener('click', () => { const t = cur && cur.isConnected ? cur : root(); t.scrollTo({ top: 0, behavior: 'smooth' }); feel('tick'); });
  window.addEventListener('hashchange', hide);
  setInterval(() => { if (cur && (!cur.isConnected || cur.scrollTop <= 480)) hide(); }, 500);
})();

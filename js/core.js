// Core: helpers, state, tracks and quests, sound, audio player, Quran data, accounts and sync.
import { THEMES, LEVELS, AYAH_COUNTS, LENIENCY } from './content.js';
import { planOf, allLessonIds, UNITS } from './curriculum.js';

export const TOTAL_AYAHS = 6236;
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
export const todayKey = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const bus = new EventTarget();
export const emitBus = (n, d) => bus.dispatchEvent(new CustomEvent(n, { detail: d }));

// ---------- Arabic helpers ----------
export const strip = s => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ـ/g, '');
export const nrm = s => strip(s).replace(/[ءؤئ]/g, '').replace(/ة/g, 'ه').replace(/[^ء-ي]/g, '');
export function wordsOf(ar) {
  const out = [];
  for (const t of ar.split(/\s+/).filter(Boolean)) {
    if (!strip(t) && out.length) out[out.length - 1] += ' ' + t; else out.push(t);
  }
  return out;
}

// ---------- State ----------
const KEY = 'iqra_state_v2', OLD = 'iqra_state_v1';
const THEME_MAP = { emerald: 'malachite', midnight: 'lapis', rose: 'madder', sand: 'saffron', violet: 'amethyst' };
export const trackFor = level => (LEVELS.find(l => l.id === level) || LEVELS[0]).track;
export const defaultState = () => ({
  updatedAt: 0, profile: null, track: 'foundations',
  settings: { autoNext: true, repeat: 'off', translation: true, translit: false, fontSize: 30, reciter: 'ar.alafasy', sound: true, haptics: true, openAll: false, theme: 'lapis', avatar: 'moon', mode: 'auto', rate: 1, leniency: 'balanced' },
  xp: 0, coins: 0, streak: 0, bestStreak: 0, lastActive: '', daily: {}, surahs: {}, badges: {}, lessons: {}, session: null, recites: [], nur: [],
  owned: { themes: ['lapis'], avatars: ['moon'] }, fasts: {}, prayer: { log: {}, athan: {}, paid: {}, method: 2, school: 0, url: '' }, dhikr: { total: 0, idx: 0, count: 0 },
  favs: [], listen: { last: null, recents: [], favs: [] }, sessions: 0, perfects: 0, gamesPlayed: 0,
});
export const S = {};
function merge(base, n) {
  n = n || {};
  const m = { ...base, ...n, settings: { ...base.settings, ...n.settings }, owned: { ...base.owned, ...n.owned }, dhikr: { ...base.dhikr, ...n.dhikr } };
  if (!THEMES.find(t => t.id === m.settings.theme)) m.settings.theme = THEME_MAP[m.settings.theme] || 'lapis';
  m.owned.themes = [...new Set((m.owned.themes || []).map(t => THEME_MAP[t] || t).concat('lapis'))];
  if (!/^[a-z]+$/i.test(m.settings.avatar || '')) m.settings.avatar = 'moon';
  m.owned.avatars = [...new Set((m.owned.avatars || []).filter(a => /^[a-z]+$/i.test(a)).concat('moon'))];
  if (!m.track || !TRACK_IDS.includes(m.track)) m.track = trackFor(m.profile && m.profile.level);
  Object.values(m.surahs || {}).forEach(r => { r.rv = r.rv || {}; });
  return m;
}
const TRACK_IDS = ['foundations', 'reading', 'tajweed', 'hifz'];
function load() {
  try { const j = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD)); if (j) return merge(defaultState(), j); } catch { /* ignore */ }
  return defaultState();
}
Object.assign(S, load());
export function replaceState(n) { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, merge(defaultState(), n || {})); persist(); }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ } }
let timer = null;
export function save() { S.updatedAt = Date.now(); persist(); clearTimeout(timer); timer = setTimeout(pushRemote, 1500); }
export const day = () => {
  const k = todayKey(), d = S.daily[k] || (S.daily[k] = {});
  for (const f of ['xp', 'ayahs', 'secs', 'lessons', 'reviews', 'recites', 'listens', 'breaks']) d[f] = d[f] || 0;
  d.claimed = d.claimed || {}; return d;
};
export const dayMinutes = d => Math.round((d.secs || 0) / 60);
export const sr = n => { const r = S.surahs[n] || (S.surahs[n] = { learned: [], done: false, mastered: false, parts: {}, count: 0, rv: {} }); r.rv = r.rv || {}; return r; };
export function statusOf(n) { const r = S.surahs[n]; if (!r) return 'new'; if (r.mastered) return 'mastered'; if (r.done) return 'learned'; return r.learned.length ? 'learning' : 'new'; }
export const learnedTotal = (s = S) => Object.values(s.surahs).reduce((a, r) => a + r.learned.length, 0);
export const masteredTotal = (s = S) => Object.values(s.surahs).filter(r => r.mastered).length;
/** Record ayahs as learned. Returns how many were new. */
export function markLearned(n, count, ayahs) {
  const r = sr(n); r.count = count; let fresh = 0;
  for (const a of ayahs) { if (!r.learned.includes(a)) { r.learned.push(a); fresh++; } r.rv[a] = Date.now(); }
  r.learned.sort((a, b) => a - b); if (r.learned.length >= count) r.done = true;
  day().ayahs += fresh; return fresh;
}

// ---------- Tracks and plan ----------
export const track = () => S.track || 'foundations';
export const lessonDone = id => !!S.lessons[id];
export const alphabetDone = (s = S) => UNITS[0].ids.every(id => s.lessons && s.lessons[id]);
export const itemDone = it => it.k === 'lesson' ? lessonDone(it.id) : !!(S.surahs[it.n] && S.surahs[it.n].done);
export const planItems = () => planOf(track());
export function nextItem(list) {
  const items = planItems();
  for (const it of items) {
    if (itemDone(it)) continue;
    if (it.k === 'surah' && list && list.length && !unlocked(list[it.n - 1])) continue;
    return it;
  }
  return null;
}
export function setLevel(levelId) {
  S.profile = S.profile || {}; S.profile.level = levelId; S.track = trackFor(levelId);
  if (levelId === 'fluent') S.settings.openAll = true;
  save();
}
export const dueReviews = () => {
  const out = [], cut = Date.now() - 20 * 36e5;
  for (const [n, r] of Object.entries(S.surahs)) for (const a of r.learned) { const t = r.rv[a] || 0; if (t < cut) out.push({ n: +n, a, t }); }
  return out.sort((x, y) => x.t - y.t);
};

// ---------- Levels, rewards ----------
export const levelOf = xp => Math.floor(Math.sqrt(xp / 50)) + 1;
export const xpFor = lv => 50 * (lv - 1) * (lv - 1);
export const reqLevel = count => Math.max(1, Math.ceil(count / 12));
export const unlocked = s => !s || S.settings.openAll || levelOf(S.xp) >= reqLevel(s.count) || !!(S.surahs[s.n] && S.surahs[s.n].learned.length);
export const streakNow = () => { const t = todayKey(), y = todayKey(new Date(Date.now() - 864e5)); return (S.lastActive === t || S.lastActive === y) ? S.streak : 0; };
function touchStreak() {
  const t = todayKey(); if (S.lastActive === t) return;
  const y = todayKey(new Date(Date.now() - 864e5));
  S.streak = S.lastActive === y ? S.streak + 1 : 1; S.bestStreak = Math.max(S.bestStreak, S.streak); S.lastActive = t;
}
const Q = (id, t, g, c, k) => ({ id, t, g, c, k });
const QUESTS_BY = {
  foundations: [Q('lesson', 'Finish a lesson', 1, 15, 'lessons'), Q('xp', 'Earn 60 XP', 60, 15, 'xp'), Q('listen', 'Listen to 5 ayahs', 5, 10, 'listens')],
  reading: [Q('lesson', 'Finish a lesson', 1, 15, 'lessons'), Q('learn5', 'Learn 5 ayahs', 5, 20, 'ayahs'), Q('listen', 'Listen to 10 ayahs', 10, 10, 'listens')],
  tajweed: [Q('lesson', 'Finish a lesson', 1, 15, 'lessons'), Q('learn5', 'Learn 5 ayahs', 5, 20, 'ayahs'), Q('recite', 'Recite once and get graded', 1, 20, 'recites')],
  hifz: [Q('learn10', 'Learn 10 ayahs', 10, 25, 'ayahs'), Q('revise', 'Revise past ayahs', 1, 15, 'reviews'), Q('recite', 'Recite and get graded', 1, 20, 'recites')],
};
export const questsNow = () => QUESTS_BY[track()] || QUESTS_BY.foundations;
function claimQuests() {
  const d = day(); let got = 0;
  for (const q of questsNow()) if (d[q.k] >= q.g && !d.claimed[q.id]) { d.claimed[q.id] = 1; S.coins += q.c; got += q.c; }
  if (got) setTimeout(() => { toast(`Quest complete. +${got} coins`, 'target'); sfx('done'); }, 500);
}
export const BADGES = [
  { id: 'first', i: 'leaf', n: 'First steps', d: 'Finish your first lesson', ok: s => s.sessions >= 1 },
  { id: 's3', i: 'flame', n: 'On fire', d: '3-day streak', ok: s => s.bestStreak >= 3 },
  { id: 's7', i: 'zap', n: 'Week warrior', d: '7-day streak', ok: s => s.bestStreak >= 7 },
  { id: 's30', i: 'trophy', n: 'Unstoppable', d: '30-day streak', ok: s => s.bestStreak >= 30 },
  { id: 'a20', i: 'book', n: 'Twenty ayahs', d: 'Learn 20 ayahs', ok: s => learnedTotal(s) >= 20 },
  { id: 'a100', i: 'layers', n: 'Hundred club', d: 'Learn 100 ayahs', ok: s => learnedTotal(s) >= 100 },
  { id: 'a500', i: 'gem', n: 'Light keeper', d: 'Learn 500 ayahs', ok: s => learnedTotal(s) >= 500 },
  { id: 'surah1', i: 'dome', n: 'Surah complete', d: 'Finish learning a surah', ok: s => Object.values(s.surahs).some(r => r.done) },
  { id: 'm1', i: 'award', n: 'Mastery', d: 'Master your first surah', ok: s => masteredTotal(s) >= 1 },
  { id: 'm5', i: 'crown', n: 'Five mastered', d: 'Master 5 surahs', ok: s => masteredTotal(s) >= 5 },
  { id: 'perfect', i: 'star', n: 'Flawless', d: 'Get 3 stars on a lesson', ok: s => s.perfects >= 1 },
  { id: 'l5', i: 'compass', n: 'Level 5', d: 'Reach level 5', ok: s => levelOf(s.xp) >= 5 },
  { id: 'l10', i: 'sunrise', n: 'Level 10', d: 'Reach level 10', ok: s => levelOf(s.xp) >= 10 },
  { id: 'gamer', i: 'dice', n: 'Break master', d: 'Play 5 break games', ok: s => s.gamesPlayed >= 5 },
  { id: 'alpha', i: 'type', n: 'Letter learner', d: 'Complete the Arabic alphabet', ok: s => alphabetDone(s) },
  { id: 'recite', i: 'mic', n: 'Reciter', d: 'Get a recitation graded', ok: s => (s.recites || []).length >= 1 },
  { id: 'nur', i: 'message', n: 'Curious mind', d: 'Ask Nur 5 questions', ok: s => (s.nur || []).filter(m => m.r === 'user').length >= 5 },
  { id: 'fast7', i: 'moon', n: 'Faithful faster', d: 'Log 7 fasts', ok: s => Object.keys(s.fasts).length >= 7 },
  { id: 'dhikr', i: 'beads', n: 'Rememberer', d: 'Reach 100 dhikr', ok: s => s.dhikr.total >= 100 },
];
export function checkBadges() {
  const out = [];
  for (const b of BADGES) if (!S.badges[b.id] && b.ok(S)) { S.badges[b.id] = Date.now(); out.push(b); }
  return out;
}
/** Give XP and coins, update streak, quests and badges. Returns {leveled, badges}. */
export function reward({ xp = 0, coins = 0, streak = true } = {}) {
  const before = levelOf(S.xp);
  if (streak) touchStreak();
  S.xp += xp; day().xp += xp; S.coins += coins;
  claimQuests();
  const badges = checkBadges();
  save();
  const after = levelOf(S.xp);
  if (after > before) { sfx('lvl'); burst(); setTimeout(() => toast(`Level ${after}`, 'trophy'), 300); }
  badges.forEach((b, i) => setTimeout(() => { toast(`Badge: ${b.n}`, b.i); sfx('badge'); haptic('badge'); }, 900 + i * 700));
  return { leveled: after > before ? after : 0, badges };
}

// ---------- UI helpers ----------
import { ic } from './icons.js';
export function toast(msg, icon = 'sparkle') {
  let w = $('#toasts'); if (!w) { w = document.createElement('div'); w.id = 'toasts'; document.body.appendChild(w); }
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `<span class="t-ic">${ic(icon, 18)}</span><b>${esc(msg)}</b>`; w.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100);
}
/** A calm expanding ring, used for level-ups instead of confetti. */
export function burst() {
  const b = document.createElement('div'); b.className = 'burst'; b.innerHTML = '<i></i><i></i>'; document.body.appendChild(b); setTimeout(() => b.remove(), 1800);
}
export function sheet(html, cls = '') {
  closeSheet(true); const w = document.createElement('div'); w.className = 'sheet-wrap';
  w.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  const sh = w.firstElementChild; let armed = false, y0 = 0, dy = 0, drag = false;
  // A tap outside closes the sheet when the tap finishes. The wrap stays in place until then, so the tap can never land on the page below.
  w.addEventListener('pointerdown', e => { armed = e.target === w; });
  w.addEventListener('click', e => { if (e.target === w && armed) { e.stopPropagation(); e.preventDefault(); closeSheet(); } armed = false; });
  sh.addEventListener('pointerdown', e => { if (e.target.closest('input,textarea,button,a,select,canvas') || sh.scrollTop > 0) return; drag = true; y0 = e.clientY; dy = 0; sh.style.transition = 'none'; try { sh.setPointerCapture(e.pointerId); } catch { /* ignore */ } });
  sh.addEventListener('pointermove', e => { if (!drag) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
  const end = () => { if (!drag) return; drag = false; sh.style.transition = ''; if (dy > 90) { closeSheet(); } else sh.style.transform = ''; };
  sh.addEventListener('pointerup', end); sh.addEventListener('pointercancel', end);
  document.body.appendChild(w); requestAnimationFrame(() => w.classList.add('in')); sfx('open'); return sh;
}
export function closeSheet(now) {
  $$('.sheet-wrap').forEach(x => { if (now) x.remove(); else if (!x.classList.contains('out')) { x.classList.remove('in'); x.classList.add('out'); const g = ev => { ev.stopPropagation(); ev.preventDefault(); }; document.addEventListener('click', g, true); setTimeout(() => { x.remove(); document.removeEventListener('click', g, true); }, 380); } });
}
/** Promise-based replacement for confirm()/prompt(). Resolves to true/false, or the typed text when `input` is set. */
export function ask({ title, body = '', ok = 'OK', cancel = 'Cancel', danger = false, input = '' }) {
  return new Promise(res => {
    const el = sheet(`<h3>${esc(title)}</h3>${body ? `<p class="muted">${body}</p>` : ''}${input ? `<input id="ask-in" type="${input}" autocomplete="off">` : ''}<div class="col-gap"><button class="btn ${danger ? 'danger' : 'primary'}" data-ask="1">${esc(ok)}</button><button class="btn ghost" data-ask="0">${esc(cancel)}</button></div>`);
    const wrap = el.parentElement; let done = false;
    const fin = v => { if (done) return; done = true; closeSheet(); res(v); };
    el.addEventListener('click', e => { const b = e.target.closest('[data-ask]'); if (b) fin(b.dataset.ask === '1' ? (input ? ($('#ask-in', el).value || '') : true) : false); });
    new MutationObserver((_, o) => { if (!wrap.isConnected) { o.disconnect(); fin(false); } }).observe(document.body, { childList: true });
    if (input) setTimeout(() => $('#ask-in', el)?.focus(), 300);
  });
}
export const isDark = () => S.settings.mode === 'dark' || (S.settings.mode !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
export function applyTheme() {
  const t = THEMES.find(x => x.id === S.settings.theme) || THEMES[0], r = document.documentElement;
  r.style.setProperty('--h', t.h); r.style.setProperty('--fs', S.settings.fontSize + 'px');
  if (S.settings.mode === 'auto') r.removeAttribute('data-mode'); else r.dataset.mode = S.settings.mode;
  const m = $('meta[name=theme-color]'); if (m) m.content = isDark() ? `hsl(${t.h} 38% 7%)` : `hsl(${t.h} 40% 97%)`;
}
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
export function hijri(d = new Date()) {
  try {
    const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
    const g = t => +p.find(x => x.type === t).value;
    return { d: g('day'), m: g('month'), y: g('year'), text: new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(d) };
  } catch { return null; }
}

// ---------- Sound: quiet synthesised glass and wood tones, with a touch of reverb ----------
let ac = null, master = null;
function impulse(c, sec, decay) {
  const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}
function audioCtx() {
  if (!ac) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ac = new C(); const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
    master = ac.createGain(); master.gain.value = .9;
    const verb = ac.createConvolver(); verb.buffer = impulse(ac, 1.5, 2.8); const wet = ac.createGain(); wet.gain.value = .3;
    master.connect(comp); master.connect(verb); verb.connect(wet); wet.connect(comp); comp.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(f, t0, dur, { type = 'sine', gain = .07, glass = 0, lp = 6000, attack = .006, to = 0 } = {}) {
  const c = ac, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
  fl.type = 'lowpass'; fl.frequency.value = lp; o.type = type; o.frequency.setValueAtTime(f, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(fl).connect(master); o.start(t0); o.stop(t0 + dur + .05);
  if (glass) { // an inharmonic partial gives the "glass" ring
    const o2 = c.createOscillator(), g2 = c.createGain(); o2.frequency.value = f * 2.76; g2.gain.setValueAtTime(0.0001, t0); g2.gain.linearRampToValueAtTime(gain * glass, t0 + attack); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * .45);
    o2.connect(g2).connect(fl); o2.start(t0); o2.stop(t0 + dur);
  }
}
const SFX = {
  tick: t => tone(2100, t, .04, { gain: .028, lp: 4500 }),
  tap: t => tone(980, t, .07, { gain: .04, type: 'triangle', lp: 3500 }),
  nav: t => tone(1500, t, .05, { gain: .032, lp: 4000 }),
  open: t => tone(520, t, .22, { gain: .028, to: 700, lp: 2500, attack: .03 }),
  ok: t => { tone(659.25, t, .55, { gain: .06, glass: .3 }); tone(987.77, t + .09, .8, { gain: .055, glass: .3 }); },
  bad: t => tone(170, t, .2, { gain: .12, to: 82, lp: 500, attack: .004 }),
  done: t => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * .09, .9, { gain: .05, glass: .25 })),
  lvl: t => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * .1, 1.1, { gain: .05, glass: .3 })),
};
SFX.right = SFX.ok; SFX.win = SFX.done;
SFX.badge = t => { [392, 587.33, 783.99].forEach((f, i) => tone(f, t + i * .12, 1.2, { gain: .045, glass: .35 })); tone(1567.98, t + .4, 1.4, { gain: .03, glass: .5 }); };
const VOICED = new Set(['right', 'done', 'lvl', 'badge', 'win']); // only achievements and correct answers make a sound SFX.close = t => tone(700, t, .2, { gain: .025, to: 500, lp: 2500, attack: .02 });
export function sfx(kind) {
  if (!S.settings.sound || !VOICED.has(kind)) return;
  try { const c = audioCtx(); if (c && SFX[kind]) SFX[kind](c.currentTime + .005); } catch { /* audio blocked */ }
}
const BUZZ = { right: [12, 40, 18], bad: [30, 40, 30], done: [15, 50, 15, 50, 30], lvl: [20, 40, 20, 40, 40], badge: [15, 50, 15, 50, 30] };
export function haptic(kind = 'tap') { if (S.settings.haptics !== false && navigator.vibrate && BUZZ[kind]) { try { navigator.vibrate(BUZZ[kind]); } catch { /* ignore */ } } }
export const feel = (kind, h) => { sfx(kind); haptic(h || kind); };
document.addEventListener('pointerdown', () => { if (S.settings.sound) audioCtx(); }, { once: true, capture: true });

// ---------- Quran audio player (one queue, survives page changes) ----------
export function surahAyah(g) { let n = 1, r = g; for (const c of AYAH_COUNTS) { if (r <= c) return [n, r]; r -= c; n++; } return [114, 6]; }
export const audioUrl = (g, reciter = S.settings.reciter) => {
  if (reciter && reciter.startsWith('ea:')) { const [s, a] = surahAyah(g), p = x => String(x).padStart(3, '0'); return `https://everyayah.com/data/${reciter.slice(3)}/${p(s)}${p(a)}.mp3`; }
  return `https://cdn.islamic.network/quran/audio/128/${reciter}/${g}.mp3`;
};
export const Player = { q: [], i: -1, playing: false, loading: false, cont: 0 };
export const listenState = () => (S.listen = S.listen || { last: null, recents: [], favs: [] });
export const surahStart = n => 1 + AYAH_COUNTS.slice(0, n - 1).reduce((a, b) => a + b, 0);
/** Queue items for a whole surah, built offline from ayah counts. */
export function surahItems(n, names) {
  const nm = (names && names[n - 1] && names[n - 1].en) || (list && list[n - 1] && list[n - 1].en) || 'Surah ' + n, c = AYAH_COUNTS[n - 1], g0 = surahStart(n);
  return Array.from({ length: c }, (_, i) => ({ g: g0 + i, n, a: i + 1, label: nm, sub: `Ayah ${i + 1} of ${c}` }));
}
function noteListen(it) {
  if (!it || !it.n) return; const L = listenState(); L.last = { n: it.n, a: it.a || 1, at: Date.now() };
  if (L.recents[0] !== it.n) { L.recents = [it.n, ...L.recents.filter(x => x !== it.n)].slice(0, 8); }
  save();
}
let sleepT = null, sleepEnd = 0;
export const sleepLeft = () => (sleepEnd ? Math.max(0, sleepEnd - Date.now()) : 0);
export function setSleep(min) {
  clearTimeout(sleepT); sleepT = null; sleepEnd = 0;
  if (min > 0) { sleepEnd = Date.now() + min * 6e4; sleepT = setTimeout(() => { sleepEnd = 0; sleepT = null; if (pel && !pel.paused) pel.pause(); emitBus('sleep', 0); }, min * 6e4); }
  emitBus('sleep', min);
}
let pel = null, pf = null, perr = 0, clip = null, clipDone = null;
const snap = () => ({ playing: Player.playing, loading: Player.loading, i: Player.i, len: Player.q.length, cur: Player.q[Player.i] || null });
const pemit = () => { emitBus('player', snap()); emitBus('audio', Player.playing || Player.loading ? (Player.q[Player.i] || {}).g || null : null); updateMedia(); };
function playerEl() {
  if (pel) return pel;
  pel = new Audio(); pel.preload = 'auto';
  pel.addEventListener('ended', () => {
    perr = 0; day().listens++; save();
    const mode = S.settings.repeat || 'off';
    if (mode === 'ayah') return loadAt(Player.i);
    if (Player.i + 1 < Player.q.length) return loadAt(Player.i + 1);
    if (Player.cont) { // keep listening: repeat this surah or roll into the next one
      if (mode === 'surah') return loadAt(0);
      if (S.settings.autoNext !== false && Player.cont < 114) { Player.cont++; const more = surahItems(Player.cont); Player.q = Player.q.concat(more); return loadAt(Player.i + 1); }
    }
    stopPlayer(true);
  });
  pel.addEventListener('error', () => { if (!Player.q.length) return; if (++perr > 2) { stopPlayer(); toast('Audio could not be loaded. Check your connection.', 'volumeOff'); } else if (Player.i + 1 < Player.q.length) loadAt(Player.i + 1); else stopPlayer(); });
  pel.addEventListener('playing', () => { Player.playing = true; Player.loading = false; pemit(); });
  pel.addEventListener('pause', () => { if (Player.q.length) { Player.playing = false; pemit(); } });
  pel.addEventListener('waiting', () => { Player.loading = true; pemit(); });
  pel.addEventListener('timeupdate', () => emitBus('ptime', { t: pel.currentTime, d: pel.duration || 0 }));
  return pel;
}
function loadAt(i) {
  const it = Player.q[i]; if (!it) return stopPlayer(true);
  Player.i = i; Player.loading = true; const el = playerEl(); noteListen(it);
  el.src = audioUrl(it.g); el.playbackRate = S.settings.rate || 1; el.play().catch(() => { Player.loading = false; Player.playing = false; pemit(); });
  pemit();
  const nx = Player.q[i + 1]; if (nx) { pf = pf || new Audio(); pf.preload = 'auto'; pf.src = audioUrl(nx.g); }
}
/** items: [{g, label, sub}] */
export function playQueue(items, start = 0, opts = {}) { stopClip(); Player.q = items.slice(); Player.cont = opts.cont || 0; perr = 0; loadAt(start); }
export const playAyah = (g, label = '', sub = '') => playQueue([{ g, label, sub }]);
export function togglePlayer() { const el = playerEl(); if (!Player.q.length) return; if (el.paused) el.play().catch(() => {}); else el.pause(); }
export const nextAyah = () => { if (Player.i + 1 < Player.q.length) loadAt(Player.i + 1); };
export const prevAyah = () => { const el = playerEl(); if (el.currentTime > 3 || Player.i === 0) el.currentTime = 0; else loadAt(Player.i - 1); };
export function seekPlayer(f) { const el = playerEl(); if (el.duration) el.currentTime = el.duration * Math.max(0, Math.min(1, f)); }
export function setRate(r) { S.settings.rate = r; save(); if (pel) pel.playbackRate = r; }
export function stopPlayer() {
  Player.q = []; Player.i = -1; Player.playing = false; Player.loading = false; Player.cont = 0;
  if (pel) { pel.pause(); pel.removeAttribute('src'); pel.load(); }
  pemit();
}
export const stopAudio = stopPlayer;
function updateMedia() {
  if (!('mediaSession' in navigator)) return;
  const it = Player.q[Player.i];
  try {
    if (!it) { navigator.mediaSession.metadata = null; return; }
    navigator.mediaSession.metadata = new MediaMetadata({ title: it.label || 'Quran', artist: it.sub || '', album: 'Iqra' });
    navigator.mediaSession.playbackState = Player.playing ? 'playing' : 'paused';
    const set = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch { /* unsupported */ } };
    set('play', togglePlayer); set('pause', togglePlayer); set('nexttrack', Player.i + 1 < Player.q.length ? nextAyah : null); set('previoustrack', prevAyah); set('stop', stopPlayer);
  } catch { /* ignore */ }
}
// Short clips used inside lessons. They take over from the player, and stopClip() silences them.
export function playClip(url, rate = 1) {
  togglePausePlayer(); stopClip();
  return new Promise(res => {
    const a = new Audio(url); clip = a; clipDone = res; a.playbackRate = rate;
    const fin = v => { if (clip === a) { clip = null; clipDone = null; } res(v); emitBus('clip', false); };
    a.onended = () => fin(true); a.onerror = () => fin(false); a.play().then(() => emitBus('clip', true)).catch(() => fin(false));
  });
}
function togglePausePlayer() { if (pel && !pel.paused) pel.pause(); }
export function stopClip() {
  if (clip) { clip.onended = clip.onerror = null; clip.pause(); clip = null; }
  if (clipDone) { const d = clipDone; clipDone = null; d(false); }
  emitBus('clip', false);
}
export const stopAllAudio = () => { stopClip(); stopPlayer(); };

// ---------- Study timer: counts seconds spent learning, playing or chatting ----------
setInterval(() => {
  if (document.visibilityState !== 'visible' || !S.profile) return;
  if (document.body.classList.contains('studying') || Player.playing) { day().secs++; if (day().secs % 15 === 0) save(); emitBus('secs', day().secs); }
}, 1000);

// ---------- Quran data (alquran.cloud and quran.com: free, no key) ----------
const QAPI = 'https://api.alquran.cloud/v1';
const dbp = new Promise(res => { try { const r = indexedDB.open('iqra', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch { res(null); } });
const mem = new Map();
async function idbGet(k) { const db = await dbp; if (!db) return mem.get(k); return new Promise(r => { try { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(undefined); } catch { r(undefined); } }); }
async function idbSet(k, v) { const db = await dbp; if (!db) { mem.set(k, v); return; } return new Promise(r => { try { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = r; t.onerror = r; } catch { r(); } }); }
async function qfetch(path) { const r = await fetch(QAPI + path); const j = await r.json(); if (j.code !== 200) throw new Error('Quran service error'); return j.data; }
let list = null;
export async function getSurahList() {
  if (list) return list; let c = await idbGet('list');
  if (!c) { const d = await qfetch('/surah'); c = d.map(s => ({ n: s.number, ar: s.name, en: s.englishName, tr: s.englishNameTranslation, count: s.numberOfAyahs, type: s.revelationType })); await idbSet('list', c); }
  return (list = c);
}
function cleanBismillah(n, a) {
  if (n === 1 || n === 9 || a.numberInSurah !== 1) return a.text;
  const w = a.text.split(' ');
  return strip(w.slice(0, 4).join(' ')) === 'بسم الله الرحمن الرحيم' ? w.slice(4).join(' ') : a.text;
}
export async function getSurah(n) {
  const k = 's' + n; let c = await idbGet(k); if (c) return c;
  const [a, e, t] = await qfetch(`/surah/${n}/editions/quran-uthmani,en.sahih,en.transliteration`);
  c = a.ayahs.map((x, i) => ({ n: x.numberInSurah, g: x.number, ar: cleanBismillah(n, x), en: e.ayahs[i].text, tr: t.ayahs[i].text }));
  await idbSet(k, c); return c;
}
export async function getAyahByGlobal(g) {
  const k = 'g' + g; let c = await idbGet(k); if (c) return c;
  const [a, e] = await qfetch(`/ayah/${g}/editions/quran-uthmani,en.sahih`);
  c = { g, ar: cleanBismillah(a.surah.number, a), en: e.text, surah: a.surah.englishName, sn: a.surah.number, n: a.numberInSurah };
  await idbSet(k, c); return c;
}
/** Word-by-word data for one ayah: [{ar, en, tr, au}] or null if the service is unreachable. */
export async function getWords(n, a) {
  try {
    const page = Math.ceil(a / 50), k = `w${n}:${page}`; let c = await idbGet(k);
    if (!c) {
      const r = await fetch(`https://api.quran.com/api/v4/verses/by_chapter/${n}?language=en&words=true&word_fields=text_uthmani&per_page=50&page=${page}`);
      const j = await r.json(); c = {};
      for (const v of j.verses || []) c[v.verse_number] = (v.words || []).filter(w => w.char_type_name === 'word').map(w => ({ ar: w.text_uthmani || w.text || '', en: (w.translation && w.translation.text) || '', tr: (w.transliteration && w.transliteration.text) || '', au: w.audio_url ? (/^http/.test(w.audio_url) ? w.audio_url : 'https://audio.qurancdn.com/' + w.audio_url) : '' }));
      if (Object.keys(c).length) await idbSet(k, c); else return null;
    }
    const w = c[a]; return w && w.length ? w : null;
  } catch { return null; }
}

// ---------- Accounts and sync ----------
export const Auth = { remote: false, groq: false, token: localStorage.getItem('iqra_token') || '', username: '', email: '' };
export async function probe() {
  try { const r = await fetch('/api/health', { cache: 'no-store' }); const j = await r.json(); Auth.remote = !!j.kv; Auth.groq = !!j.groq; } catch { Auth.remote = false; Auth.groq = false; }
}
export async function api(path, method = 'GET', body) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const r = await fetch('/api/' + path, {
    method, keepalive: !isForm && method === 'PUT',
    headers: { ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...(Auth.token ? { Authorization: 'Bearer ' + Auth.token } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  let j = {}; try { j = await r.json(); } catch { /* non-json */ }
  if (!r.ok) {
    const e = new Error(j.error || `Request failed (${r.status})`); e.status = r.status; e.data = j;
    if (r.status === 403 && j.suspended) window.dispatchEvent(new CustomEvent('iqra-banned', { detail: j })); else if (r.status === 401 && j.gone) window.dispatchEvent(new CustomEvent('iqra-gone'));
    throw e;
  }
  return j;
}
function pushRemote() { if (Auth.remote && Auth.token && Auth.username) api('sync', 'PUT', { state: S }).catch(() => {}); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { persist(); clearTimeout(timer); pushRemote(); } });
window.addEventListener('pagehide', () => { persist(); pushRemote(); });

const LK = 'iqra_local_acct';
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const localAcct = () => { try { return JSON.parse(localStorage.getItem(LK)); } catch { return null; } };
function setToken(token, username, email) { Auth.token = token || ''; Auth.username = username; Auth.email = email || ''; if (token) localStorage.setItem('iqra_token', token); else localStorage.removeItem('iqra_token'); }
function adopt(st) { if (st && ((st.updatedAt || 0) >= S.updatedAt || !S.profile)) replaceState(st); }

export async function register({ username, email, password }) {
  if (Auth.remote) { const j = await api('register', 'POST', { username, email, password, state: S }); setToken(j.token, j.username, email); return; }
  const salt = crypto.getRandomValues(new Uint8Array(8)).join('');
  localStorage.setItem(LK, JSON.stringify({ username: username.toLowerCase(), email, salt, hash: await sha(salt + password) }));
  localStorage.setItem('iqra_local_in', '1'); Auth.username = username.toLowerCase(); Auth.email = email;
}
export async function login({ id, password }) {
  if (Auth.remote) { const j = await api('login', 'POST', { id, password }); setToken(j.token, j.username, j.email); adopt(j.state); return; }
  const a = localAcct(); const q = id.trim().toLowerCase();
  if (!a || (a.username !== q && a.email.toLowerCase() !== q) || a.hash !== await sha(a.salt + password)) throw new Error('Wrong username or password.');
  localStorage.setItem('iqra_local_in', '1'); Auth.username = a.username; Auth.email = a.email;
}
export async function restore() {
  if (Auth.remote) {
    if (!Auth.token) return false;
    try { const j = await api('me'); setToken(Auth.token, j.username, j.email); adopt(j.state); return true; } catch (e) { if (e.status === 403 && e.data && e.data.suspended) return !!S.profile; if (e.status === 401) { setToken('', '', ''); if (e.data && e.data.gone) { try { localStorage.setItem('iqra_notice', 'That account was removed.'); } catch { /* ignore */ } } } return !!Auth.username; }
  }
  const a = localAcct();
  if (a && localStorage.getItem('iqra_local_in') && S.profile) { Auth.username = a.username; Auth.email = a.email; return true; }
  return false;
}
export async function logout() {
  if (Auth.remote) { try { await api('logout', 'POST'); } catch { /* ignore */ } setToken('', '', ''); replaceState(defaultState()); }
  else { localStorage.removeItem('iqra_local_in'); Auth.username = ''; }
}
export async function updateAccount({ username, email }) {
  if (Auth.remote) { const j = await api('account', 'PUT', { username, email }); Auth.username = j.username; Auth.email = j.email; return; }
  const a = localAcct(); if (!a) return; a.username = username.toLowerCase(); a.email = email; localStorage.setItem(LK, JSON.stringify(a)); Auth.username = a.username; Auth.email = email;
}
export async function changePassword(current, next) {
  if (Auth.remote) { await api('password', 'POST', { current, next }); return; }
  const a = localAcct(); if (!a || a.hash !== await sha(a.salt + current)) throw new Error('Current password is wrong.');
  a.hash = await sha(a.salt + next); localStorage.setItem(LK, JSON.stringify(a));
}
export async function deleteAccount(password) {
  if (Auth.remote) { await api('delete', 'POST', { password }); setToken('', '', ''); }
  else { const a = localAcct(); if (!a || a.hash !== await sha(a.salt + password)) throw new Error('Password is wrong.'); localStorage.removeItem(LK); localStorage.removeItem('iqra_local_in'); Auth.username = ''; }
  replaceState(defaultState());
}
export { allLessonIds };

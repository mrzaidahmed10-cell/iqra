// Core: helpers, state, accounts/sync, Quran data, audio, rewards.
import { THEMES } from './content.js';

export const TOTAL_AYAHS = 6236;
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
export const todayKey = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const bus = new EventTarget();

// ---------- Arabic helpers ----------
export const strip = s => s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ـ/g, '');
export const nrm = s => strip(s).replace(/[ءؤئ]/g, '').replace(/ة/g, 'ه').replace(/[^\u0621-\u064A]/g, '');
export function wordsOf(ar) {
  const out = [];
  for (const t of ar.split(/\s+/).filter(Boolean)) {
    if (!strip(t) && out.length) out[out.length - 1] += ' ' + t; else out.push(t);
  }
  return out;
}

// ---------- State ----------
const KEY = 'iqra_state_v1';
export const defaultState = () => ({
  updatedAt: 0, profile: null,
  settings: { translation: true, translit: false, fontSize: 30, reciter: 'ar.alafasy', sound: true, openAll: false, theme: 'emerald', avatar: '🌙' },
  xp: 0, coins: 0, streak: 0, bestStreak: 0, lastActive: '', daily: {}, surahs: {}, badges: {},
  owned: { themes: ['emerald'], avatars: ['🌙'] }, fasts: {}, dhikr: { total: 0, idx: 0, count: 0 },
  favs: [], alphabetDone: false, sessions: 0, perfects: 0, gamesPlayed: 0,
});
export const S = {};
function merge(base, n) { return { ...base, ...n, settings: { ...base.settings, ...(n && n.settings) }, owned: { ...base.owned, ...(n && n.owned) }, dhikr: { ...base.dhikr, ...(n && n.dhikr) } }; }
function load() { try { const j = JSON.parse(localStorage.getItem(KEY)); if (j) return merge(defaultState(), j); } catch { /* ignore */ } return defaultState(); }
Object.assign(S, load());
export function replaceState(n) { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, merge(defaultState(), n || {})); persist(); }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ } }
let timer = null;
export function save() { S.updatedAt = Date.now(); persist(); clearTimeout(timer); timer = setTimeout(pushRemote, 1500); }
export const day = () => { const k = todayKey(); return S.daily[k] || (S.daily[k] = { xp: 0, ayahs: 0, minutes: 0, breaks: 0, claimed: {} }); };
export const sr = n => S.surahs[n] || (S.surahs[n] = { learned: [], done: false, mastered: false, parts: {}, count: 0 });
export function statusOf(n) { const r = S.surahs[n]; if (!r) return 'new'; if (r.mastered) return 'mastered'; if (r.done) return 'learned'; return r.learned.length ? 'learning' : 'new'; }
export const learnedTotal = (s = S) => Object.values(s.surahs).reduce((a, r) => a + r.learned.length, 0);
export const masteredTotal = (s = S) => Object.values(s.surahs).filter(r => r.mastered).length;

// ---------- Levels, rewards ----------
export const levelOf = xp => Math.floor(Math.sqrt(xp / 50)) + 1;
export const xpFor = lv => 50 * (lv - 1) * (lv - 1);
export const reqLevel = count => Math.max(1, Math.ceil(count / 12));
export const unlocked = s => S.settings.openAll || levelOf(S.xp) >= reqLevel(s.count) || !!(S.surahs[s.n] && S.surahs[s.n].learned.length);
export const streakNow = () => { const t = todayKey(), y = todayKey(new Date(Date.now() - 864e5)); return (S.lastActive === t || S.lastActive === y) ? S.streak : 0; };
function touchStreak() {
  const t = todayKey(); if (S.lastActive === t) return;
  const y = todayKey(new Date(Date.now() - 864e5));
  S.streak = S.lastActive === y ? S.streak + 1 : 1; S.bestStreak = Math.max(S.bestStreak, S.streak); S.lastActive = t;
}
export const QUESTS = [
  { id: 'ayahs', t: 'Learn 5 ayahs', g: 5, c: 15, k: 'ayahs' },
  { id: 'xp', t: 'Earn 100 XP', g: 100, c: 20, k: 'xp' },
  { id: 'break', t: 'Play a break game', g: 1, c: 10, k: 'breaks' },
];
function claimQuests() {
  const d = day(); let got = 0;
  for (const q of QUESTS) if (d[q.k] >= q.g && !d.claimed[q.id]) { d.claimed[q.id] = 1; S.coins += q.c; got += q.c; }
  if (got) setTimeout(() => toast(`Quest complete! +${got} coins`, '🎯'), 400);
}
export const BADGES = [
  { id: 'first', i: '🌱', n: 'First Steps', d: 'Finish your first lesson', ok: s => s.sessions >= 1 },
  { id: 's3', i: '🔥', n: 'On Fire', d: '3-day streak', ok: s => s.bestStreak >= 3 },
  { id: 's7', i: '⚡', n: 'Week Warrior', d: '7-day streak', ok: s => s.bestStreak >= 7 },
  { id: 's30', i: '🏆', n: 'Unstoppable', d: '30-day streak', ok: s => s.bestStreak >= 30 },
  { id: 'a20', i: '📗', n: 'Twenty Ayahs', d: 'Learn 20 ayahs', ok: s => learnedTotal(s) >= 20 },
  { id: 'a100', i: '📘', n: 'Hundred Club', d: 'Learn 100 ayahs', ok: s => learnedTotal(s) >= 100 },
  { id: 'a500', i: '📙', n: 'Light Keeper', d: 'Learn 500 ayahs', ok: s => learnedTotal(s) >= 500 },
  { id: 'surah1', i: '🕌', n: 'Surah Complete', d: 'Finish learning a surah', ok: s => Object.values(s.surahs).some(r => r.done) },
  { id: 'm1', i: '🏅', n: 'Mastery', d: 'Master your first surah', ok: s => masteredTotal(s) >= 1 },
  { id: 'm5', i: '🥇', n: 'Five Mastered', d: 'Master 5 surahs', ok: s => masteredTotal(s) >= 5 },
  { id: 'perfect', i: '⭐', n: 'Flawless', d: 'Get 3 stars on a lesson', ok: s => s.perfects >= 1 },
  { id: 'l5', i: '🚀', n: 'Level 5', d: 'Reach level 5', ok: s => levelOf(s.xp) >= 5 },
  { id: 'l10', i: '👑', n: 'Level 10', d: 'Reach level 10', ok: s => levelOf(s.xp) >= 10 },
  { id: 'gamer', i: '🎮', n: 'Break Master', d: 'Play 5 break games', ok: s => s.gamesPlayed >= 5 },
  { id: 'alpha', i: '🔤', n: 'Letter Learner', d: 'Complete the Arabic alphabet', ok: s => s.alphabetDone },
  { id: 'fast7', i: '🌙', n: 'Faithful Faster', d: 'Log 7 fasts', ok: s => Object.keys(s.fasts).length >= 7 },
  { id: 'dhikr', i: '📿', n: 'Rememberer', d: 'Reach 100 dhikr', ok: s => s.dhikr.total >= 100 },
];
export function checkBadges() {
  const out = [];
  for (const b of BADGES) if (!S.badges[b.id] && b.ok(S)) { S.badges[b.id] = Date.now(); out.push(b); }
  return out;
}
/** Give XP/coins, update streak + quests + badges. Returns {leveled, badges}. */
export function reward({ xp = 0, coins = 0, streak = true } = {}) {
  const before = levelOf(S.xp);
  if (streak) touchStreak();
  S.xp += xp; day().xp += xp; S.coins += coins;
  claimQuests();
  const badges = checkBadges();
  save();
  const after = levelOf(S.xp);
  if (after > before) { sfx('lvl'); confetti(); setTimeout(() => toast(`Level ${after} reached!`, '🚀'), 300); }
  badges.forEach((b, i) => setTimeout(() => toast(`Badge: ${b.n}`, b.i), 900 + i * 700));
  return { leveled: after > before ? after : 0, badges };
}

// ---------- UI helpers ----------
export function toast(msg, icon = '✨') {
  let w = $('#toasts'); if (!w) { w = document.createElement('div'); w.id = 'toasts'; document.body.appendChild(w); }
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `<span>${icon}</span><b>${esc(msg)}</b>`; w.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3000);
}
export function confetti(n = 70) {
  const c = ['#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa'], f = document.createElement('div'); f.className = 'confetti';
  for (let i = 0; i < n; i++) { const p = document.createElement('i'); p.style.cssText = `left:${Math.random() * 100}%;background:${c[i % 5]};animation-delay:${Math.random() * .5}s;--dx:${(Math.random() - .5) * 240}px;--r:${Math.random() * 720}deg`; f.appendChild(p); }
  document.body.appendChild(f); setTimeout(() => f.remove(), 3000);
}
export function sheet(html, cls = '') {
  closeSheet(); const w = document.createElement('div'); w.className = 'sheet-wrap';
  w.innerHTML = `<div class="sheet ${cls}"><div class="grab"></div>${html}</div>`;
  w.addEventListener('click', e => { if (e.target === w) closeSheet(); });
  document.body.appendChild(w); requestAnimationFrame(() => w.classList.add('in')); return w.firstElementChild;
}
export function closeSheet() { $$('.sheet-wrap').forEach(x => x.remove()); }
export function applyTheme() {
  const t = THEMES.find(x => x.id === S.settings.theme) ? S.settings.theme : 'emerald';
  document.documentElement.dataset.theme = t; document.documentElement.style.setProperty('--fs', S.settings.fontSize + 'px');
}
export function hijri(d = new Date()) {
  try {
    const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
    const g = t => +p.find(x => x.type === t).value;
    return { d: g('day'), m: g('month'), y: g('year'), text: new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(d) };
  } catch { return null; }
}

// ---------- Sound ----------
let ac;
export function sfx(kind) {
  if (!S.settings.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const seq = { ok: [[660, .08], [880, .12]], bad: [[200, .2]], win: [[523, .1], [659, .1], [784, .1], [1047, .25]], pop: [[780, .05]], lvl: [[392, .1], [523, .1], [659, .1], [784, .1], [1047, .3]] }[kind] || [];
    let t = ac.currentTime;
    for (const [f, d] of seq) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = kind === 'bad' ? 'sawtooth' : 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(.1, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); t += d * .9;
    }
  } catch { /* audio blocked */ }
}

// ---------- Quran audio ----------
let audioEl = null, pending = null, seq = 0;
export const audioUrl = g => `https://cdn.islamic.network/quran/audio/128/${S.settings.reciter}/${g}.mp3`;
const emit = g => bus.dispatchEvent(new CustomEvent('audio', { detail: g }));
export function stopAudio() {
  seq++; if (audioEl) { audioEl.pause(); audioEl = null; }
  if (pending) { const p = pending; pending = null; p(false); }
  emit(null);
}
function playOne(g) {
  return new Promise(res => {
    const a = new Audio(audioUrl(g)); audioEl = a; pending = res;
    const done = v => { if (pending === res) pending = null; res(v); };
    a.onended = () => done(true); a.onerror = () => done(false); a.play().catch(() => done(false));
  });
}
export async function playAyah(g) { stopAudio(); const my = seq; emit(g); const ok = await playOne(g); if (my === seq) emit(null); return ok; }
export async function playList(list) {
  stopAudio(); const my = seq;
  for (const g of list) { if (my !== seq) return; emit(g); const ok = await playOne(g); if (!ok || my !== seq) break; }
  if (my === seq) emit(null);
}

// ---------- Quran data (alquran.cloud — free, no key) ----------
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

// ---------- Accounts & sync ----------
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
  if (!r.ok) { const e = new Error(j.error || `Request failed (${r.status})`); e.status = r.status; throw e; }
  return j;
}
function pushRemote() { if (Auth.remote && Auth.token && Auth.username) api('sync', 'PUT', { state: S }).catch(() => {}); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); pushRemote(); } });

const LK = 'iqra_local_acct';
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const localAcct = () => { try { return JSON.parse(localStorage.getItem(LK)); } catch { return null; } };
function setSession(token, username, email) { Auth.token = token || ''; Auth.username = username; Auth.email = email || ''; if (token) localStorage.setItem('iqra_token', token); else localStorage.removeItem('iqra_token'); }
function adopt(st) { if (st && ((st.updatedAt || 0) >= S.updatedAt || !S.profile)) replaceState(st); }

export async function register({ username, email, password }) {
  if (Auth.remote) { const j = await api('register', 'POST', { username, email, password, state: S }); setSession(j.token, j.username, email); return; }
  const salt = crypto.getRandomValues(new Uint8Array(8)).join('');
  localStorage.setItem(LK, JSON.stringify({ username: username.toLowerCase(), email, salt, hash: await sha(salt + password) }));
  localStorage.setItem('iqra_local_in', '1'); Auth.username = username.toLowerCase(); Auth.email = email;
}
export async function login({ id, password }) {
  if (Auth.remote) { const j = await api('login', 'POST', { id, password }); setSession(j.token, j.username, j.email); adopt(j.state); return; }
  const a = localAcct(); const q = id.trim().toLowerCase();
  if (!a || (a.username !== q && a.email.toLowerCase() !== q) || a.hash !== await sha(a.salt + password)) throw new Error('Wrong username or password.');
  localStorage.setItem('iqra_local_in', '1'); Auth.username = a.username; Auth.email = a.email;
}
export async function restore() {
  if (Auth.remote) {
    if (!Auth.token) return false;
    try { const j = await api('me'); setSession(Auth.token, j.username, j.email); adopt(j.state); return true; } catch (e) { if (e.status === 401) setSession('', '', ''); return !!Auth.username; }
  }
  const a = localAcct();
  if (a && localStorage.getItem('iqra_local_in') && S.profile) { Auth.username = a.username; Auth.email = a.email; return true; }
  return false;
}
export async function logout() {
  if (Auth.remote) { try { await api('logout', 'POST'); } catch { /* ignore */ } setSession('', '', ''); replaceState(defaultState()); }
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
  if (Auth.remote) { await api('delete', 'POST', { password }); setSession('', '', ''); }
  else { const a = localAcct(); if (!a || a.hash !== await sha(a.salt + password)) throw new Error('Password is wrong.'); localStorage.removeItem(LK); localStorage.removeItem('iqra_local_in'); Auth.username = ''; }
  replaceState(defaultState());
}

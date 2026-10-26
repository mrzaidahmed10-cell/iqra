// Prayer tab: times for your location, a signed daily checklist, and the Athan while the app is open.
import { $, esc, S, save, sheet, closeSheet, toast, feel, haptic, reward, todayKey, hijri } from './core.js';
import { ic } from './icons.js';
import { timers } from './ui.js';

export const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
export const NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const AR = { Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };
const METHODS = [[2, 'ISNA (North America)'], [3, 'Muslim World League'], [4, 'Umm al-Qura (Makkah)'], [5, 'Egyptian Authority'], [1, 'Karachi'], [15, 'Moonsighting Committee'], [13, 'Diyanet (Turkey)']];
export const ATHAN_URL = 'https://cdn.aladhan.com/audio/adhans/a1.mp3';

const P = () => (S.prayer = Object.assign({ log: {}, athan: {}, paid: {}, method: 2, school: 0, url: '' }, S.prayer || {}));

// ---------- times (cached per day, location and method) ----------
export async function timingsFor(loc) {
  const p = P(), now = new Date(), dd = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const lk = (loc.lat != null ? `${(+loc.lat).toFixed(2)},${(+loc.lng).toFixed(2)}` : `${loc.city},${loc.country}`) + `|${p.method}|${p.school}`;
  const c = lsGet('iqra_pt', null); if (c && c.day === dd && c.lk === lk) return c.t;
  const q = `method=${p.method}&school=${p.school}`;
  const url = loc.lat != null ? `https://api.aladhan.com/v1/timings/${dd}?latitude=${loc.lat}&longitude=${loc.lng}&${q}` : `https://api.aladhan.com/v1/timingsByCity/${dd}?city=${encodeURIComponent(loc.city)}&country=${encodeURIComponent(loc.country)}&${q}`;
  const r = await fetch(url); if (!r.ok) throw new Error('times');
  const j = await r.json(), t = {}; ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(k => { t[k] = String(j.data.timings[k]).split(' ')[0]; });
  lsSet('iqra_pt', { day: dd, lk, t }); return t;
}
export const at = (t, k, plus = 0) => { const [h, m] = t[k].split(':').map(Number), d = new Date(); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + plus); return d; };
export const fmt = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export function nextOf(t) { const n = new Date(); for (const k of NAMES) if (at(t, k) > n) return [k, at(t, k)]; return ['Fajr', at(t, 'Fajr', 1)]; }
export const left = ms => { const m = Math.max(0, Math.round(ms / 6e4)), h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m}m`; };
const clock = ms => { const s = Math.max(0, Math.floor(ms / 1e3)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`; };

// ---------- log helpers ----------
const dayLog = (k = todayKey()) => { const l = P().log; return l[k] || (l[k] = {}); };
const count = k => NAMES.filter(n => (P().log[k] || {})[n]).length;
function streak() { let n = 0, d = new Date(); if (count(todayKey(d)) < 5) d = new Date(d.getTime() - 864e5); while (count(todayKey(d)) === 5 && n < 999) { n++; d = new Date(d.getTime() - 864e5); } return n; }
function prune() { const p = P(), l = p.log, keys = Object.keys(l).sort(); while (keys.length > 60) delete l[keys.shift()]; const lo = keys[0] || ''; Object.keys(p.paid).forEach(x => { if (x.slice(0, 10) < lo) delete p.paid[x]; }); }

// ---------- signature ----------
const packSig = strokes => strokes.slice(0, 4).map(s => { const step = Math.max(1, Math.ceil(s.length / 24)); return s.filter((_, i) => i % step === 0 || i === s.length - 1).map(p => p.join(',')).join(' '); }).join('|').slice(0, 600);
const sigPath = str => !str ? '' : str.split('|').map(s => { const pts = s.split(' ').map(p => p.split(',').map(Number)); return pts.length < 2 ? `M${pts[0][0]} ${pts[0][1]}h.1` : 'M' + pts.map(p => p.join(' ')).join(' L'); }).join(' ');
const sigSvg = (str, cls = '') => `<svg class="sig ${cls}" viewBox="0 0 100 40" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="${sigPath(str)}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function signSheet(name, done) {
  const el = sheet(`<h3>Did you pray ${name}?</h3><p class="muted">Sign below to confirm. This is between you and Allah, so be honest with yourself.</p><div class="pad"><canvas id="sg" aria-label="Signature pad"></canvas><span class="pad-h" id="sgh">Sign here</span></div><div class="row-gap"><button class="btn" id="sg-c">Clear</button><button class="btn primary" id="sg-ok" disabled>I prayed ${name}</button></div>`, 'sign-sheet');
  const cv = $('#sg', el), ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1); let strokes = [], cur = null, W = 0, H = 0, busy = false;
  const size = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineWidth = 2.6; ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = getComputedStyle(cv).color; redraw(); };
  const redraw = () => { ctx.clearRect(0, 0, W, H); strokes.forEach(s => { ctx.beginPath(); s.forEach((p, i) => { const x = p[0] / 100 * W, y = p[1] / 40 * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (s.length === 1) ctx.lineTo(s[0][0] / 100 * W + .1, s[0][1] / 40 * H); ctx.stroke(); }); };
  const pt = e => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(100, Math.round((e.clientX - r.left) / r.width * 100))), Math.max(0, Math.min(40, Math.round((e.clientY - r.top) / r.height * 40)))]; };
  const upd = () => { $('#sg-ok', el).disabled = strokes.reduce((a, s) => a + s.length, 0) < 4; $('#sgh', el).style.opacity = strokes.length ? 0 : 1; };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ } cur = [pt(e)]; strokes.push(cur); redraw(); upd(); });
  cv.addEventListener('pointermove', e => { if (!cur) return; const p = pt(e), l = cur[cur.length - 1]; if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) < 1) return; cur.push(p); redraw(); });
  const up = () => { if (cur) { cur = null; upd(); } }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  $('#sg-c', el).onclick = () => { strokes = []; redraw(); upd(); feel('tick', 'tick'); };
  $('#sg-ok', el).onclick = () => { if (busy) return; busy = true; done(packSig(strokes)); };
  requestAnimationFrame(size);
}

function markPrayed(name, sig) {
  const l = dayLog(), k = todayKey(), pd = P().paid, first = !pd[k + name]; l[name] = { at: Date.now(), sig }; prune();
  if (first) { pd[k + name] = 1; reward({ xp: 8, coins: 1 }); if (count(k) === 5 && !pd[k + 'all']) { pd[k + 'all'] = 1; reward({ xp: 25, coins: 5, streak: false }); toast('All five prayers. May Allah accept them.', 'sparkle'); } else toast(`${name} done. May Allah accept it.`, 'check'); }
  else toast(`${name} updated`, 'check');
  save(); feel('done', 'done');
}

// ---------- art ----------
function phase(t, now = new Date()) {
  const a = k => at(t, k), n = +now;
  if (n < +a('Fajr') || n >= +a('Isha')) return 'night'; if (n < +a('Sunrise')) return 'dawn'; if (n < +a('Dhuhr')) return 'morning'; if (n < +a('Asr')) return 'noon'; if (n < +a('Maghrib')) return 'afternoon'; return 'dusk';
}
const SKY = { night: ['#070b24', '#1a2a66'], dawn: ['#2a3470', '#f0a58c'], morning: ['#3f86d6', '#bfe4f6'], noon: ['#2b78d4', '#86cdf2'], afternoon: ['#d98a2f', '#f5d28b'], dusk: ['#3e2468', '#e46f57'] };
function arc(t, ph, now = new Date()) {
  const dayPh = ph !== 'night', a = dayPh ? at(t, 'Sunrise') : at(t, 'Maghrib'); let b = dayPh ? at(t, 'Maghrib') : at(t, 'Fajr');
  if (!dayPh) { if (now < at(t, 'Fajr')) a.setDate(a.getDate() - 1); else b.setDate(b.getDate() + 1); }
  const f = Math.max(0, Math.min(1, (now - a) / (b - a))), P0 = [20, 96], P1 = [160, -44], P2 = [300, 96], u = 1 - f;
  const x = u * u * P0[0] + 2 * u * f * P1[0] + f * f * P2[0], y = u * u * P0[1] + 2 * u * f * P1[1] + f * f * P2[1];
  const body = dayPh ? `<circle cx="${x}" cy="${y}" r="26" fill="#fff6c8" opacity=".25"/><circle cx="${x}" cy="${y}" r="13" fill="#fff3b0"/>` : `<circle cx="${x}" cy="${y}" r="20" fill="#dfe7ff" opacity=".16"/><circle cx="${x}" cy="${y}" r="11" fill="#eef2ff"/><circle cx="${x + 5}" cy="${y - 3}" r="10" fill="${SKY.night[1]}"/>`;
  return `<svg class="p-arc" viewBox="0 0 320 110" aria-hidden="true"><path d="M20 96Q160 -44 300 96" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.5" stroke-dasharray="3 5"/><path d="M0 98H320" stroke="#fff" stroke-opacity=".22"/>${body}</svg>`;
}
const stars = () => [...Array(16)].map((_, i) => `<i style="left:${(i * 37 + 11) % 97}%;top:${(i * 23 + 7) % 55}%;animation-delay:${(i % 5) * .6}s"></i>`).join('');

// ---------- page ----------
export function viewPrayerTab() { return { html: `<div id="pr"></div>`, after: startPage }; }
let draw = null;
async function startPage() {
  const root = $('#pr'); if (!root) return; const loc = lsGet('iqra_loc', null);
  if (!loc) { root.innerHTML = setupHTML(); bindSetup(root); return; }
  root.innerHTML = `<section class="p-hero sk-night"><div class="p-in"><small>Prayer</small><h1>Loading…</h1></div></section>`;
  let t; try { t = await timingsFor(loc); } catch { root.innerHTML = `<section class="card center"><span class="ico big">${ic('dome', 24)}</span><h3>Couldn't load prayer times</h3><p class="muted">Check your connection and try again.</p><div class="row-gap"><button class="btn primary" id="rt">Retry</button><button class="btn" id="st">Settings</button></div></section>`; $('#rt').onclick = startPage; $('#st').onclick = () => settings(startPage); return; }
  const render = () => {
    const now = new Date(), ph = phase(t, now), [nx, nd] = nextOf(t), sky = SKY[ph], log = dayLog(), done = count(todayKey());
    const days = [...Array(7)].map((_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5), c = count(todayKey(d)); return `<div class="wk ${i === 6 ? 'today' : ''}"><span class="wk-d">${d.toLocaleDateString([], { weekday: 'narrow' })}</span><span class="wk-b" style="--p:${c / 5}"><b>${c}</b></span></div>`; }).join('');
    const cur = NAMES.filter(k => at(t, k) <= now).pop();
    root.innerHTML = `<section class="p-hero" style="--s1:${sky[0]};--s2:${sky[1]}">${ph === 'night' || ph === 'dawn' || ph === 'dusk' ? `<div class="stars ${ph}">${stars()}</div>` : ''}${arc(t, ph, now)}
      <div class="p-in"><div class="p-top"><small>${esc(loc.city || 'Your location')}${loc.country && loc.city ? ', ' + esc(loc.country) : ''}</small><button class="p-gear" id="pset" aria-label="Prayer settings">${ic('settings', 20)}</button></div>
      <small class="p-lab">Next · ${nx}</small><div class="p-count" id="pcd">${clock(nd - now)}</div><div class="p-sub">${fmt(nd)} · ${AR[nx]}</div><small class="p-hj">${esc((hijri() || {}).text || '')}</small></div></section>
    <section class="card p-sum"><div class="ring" style="--p:${done / 5}"><b>${done}<small>/5</small></b></div><div class="grow"><h3>${done === 5 ? 'All prayers done' : done ? `${5 - done} to go today` : 'Start your day with prayer'}</h3><p class="muted">${streak() ? `${streak()}-day streak of all five` : 'Pray all five to start a streak'}</p></div></section>
    <section class="card p-list" id="pl">${NAMES.map(k => { const d = at(t, k), open = d <= now, ok = log[k], isNext = k === nx, an = P().athan[k] !== false;
      return `<div class="p-row ${ok ? 'ok' : ''} ${isNext ? 'next' : ''} ${k === cur && !ok ? 'cur' : ''}"><button class="chk ${ok ? 'on' : ''}" data-chk="${k}" ${!open && !ok ? 'disabled' : ''} aria-label="${ok ? 'Undo ' + k : 'Mark ' + k + ' as prayed'}" aria-pressed="${!!ok}">${ok ? ic('check', 20) : ''}</button><div class="p-n"><b>${k}</b><small class="muted">${AR[k]}${k === cur && !ok ? ' · now' : ''}${!open ? ' · upcoming' : ''}</small></div><div class="p-t">${ok ? sigSvg(ok.sig, 'mini') : ''}<b>${fmt(d)}</b></div><button class="bell ${an ? 'on' : ''}" data-bell="${k}" aria-pressed="${an}" aria-label="Athan for ${k}">${ic(an ? 'bell' : 'bellOff', 20)}</button></div>`; }).join('')}
      <div class="p-row sun"><span class="chk ghost">${ic('sunrise', 18)}</span><div class="p-n"><b>Sunrise</b><small class="muted">${AR.Sunrise}</small></div><div class="p-t"><b>${fmt(at(t, 'Sunrise'))}</b></div><span class="bell"></span></div></section>
    <section class="card"><h3>This week</h3><div class="wk-row">${days}</div></section>
    <p class="muted center small p-note">Athan plays while Iqra is open. Times from Aladhan.</p>`;
    $('#pset').onclick = () => settings(startPage);
  };
  render(); draw = render;
  const tick = () => { const el = $('#pcd'); if (!el) return; const [, nd] = nextOf(t); el.textContent = clock(nd - new Date()); if (new Date() >= nd) render(); };
  timers.push(setInterval(tick, 1000)); timers.push(setInterval(render, 60000));
  root.onclick = e => {
    const c = e.target.closest('[data-chk]'), b = e.target.closest('[data-bell]'); if (b) { const k = b.dataset.bell, a = P().athan; a[k] = a[k] === false; save(); feel('tick', 'tick'); if (a[k]) askNotify(); render(); return; }
    if (!c || c.disabled) return; const k = c.dataset.chk;
    if (dayLog()[k]) { const old = dayLog()[k]; delete dayLog()[k]; save(); feel('tap', 'tick'); render(); toast(`${k} unchecked`, 'undo', () => { dayLog()[k] = old; save(); render(); }); return; }
    signSheet(k, sig => { markPrayed(k, sig); closeSheet(); render(); });
  };
}
function setupHTML() { return `<section class="p-hero" style="--s1:${SKY.night[0]};--s2:${SKY.night[1]}"><div class="stars night">${stars()}</div><div class="p-in"><small class="p-lab">Prayer</small><div class="p-count s">Prayer times for where you are</div><div class="p-sub">Athan, a daily checklist and a streak.</div></div></section>
  <section class="card"><button class="btn primary wide" id="loc-g">${ic('compass', 18)} Use my location</button><p class="muted center">or enter a city</p><div class="form"><label>City<input id="pc-city" autocomplete="address-level2" enterkeyhint="next"></label><label>Country<input id="pc-country" autocomplete="country-name" enterkeyhint="done"></label></div><button class="btn wide" id="loc-c">Show prayer times</button></section>`; }
function bindSetup(root) {
  $('#loc-g', root).onclick = e => locate(e.currentTarget, startPage);
  $('#loc-c', root).onclick = () => { const city = $('#pc-city', root).value.trim(), country = $('#pc-country', root).value.trim(); if (!city || !country) return toast('Enter city and country', 'compass'); lsSet('iqra_loc', { city, country }); startPage(); };
}
function locate(btn, done) {
  if (!navigator.geolocation) return toast('Location not supported. Enter your city.', 'compass'); if (btn.disabled) return; btn.disabled = true; const old = btn.innerHTML; btn.textContent = 'Finding you…';
  navigator.geolocation.getCurrentPosition(async p => {
    const loc = { lat: +p.coords.latitude.toFixed(3), lng: +p.coords.longitude.toFixed(3) };
    try { const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${loc.lat}&longitude=${loc.lng}&localityLanguage=en`), j = await r.json(); if (j.city || j.locality) { loc.city = j.city || j.locality; loc.country = j.countryName || ''; } } catch { /* name is optional */ }
    lsSet('iqra_loc', loc); localStorage.removeItem('iqra_pt'); closeSheet(); done();
  }, () => { btn.disabled = false; btn.innerHTML = old; toast('Location blocked. Enter your city instead.', 'compass'); }, { timeout: 12000, maximumAge: 6e5 });
}
function settings(done) {
  const p = P(), loc = lsGet('iqra_loc', {}), el = sheet(`<h3>Prayer settings</h3>
    <label class="fld">Location<div class="row-gap"><button class="btn grow" id="s-g">${ic('compass', 18)} Use my location</button></div><small class="muted">${esc(loc.city ? loc.city + (loc.country ? ', ' + loc.country : '') : loc.lat != null ? 'Your coordinates' : 'Not set')}</small></label>
    <div class="form"><label>City<input id="s-city" value="${esc(loc.city || '')}"></label><label>Country<input id="s-country" value="${esc(loc.country || '')}"></label></div><button class="btn wide" id="s-c">Use this city</button>
    <label class="fld">Calculation method<select id="s-m">${METHODS.map(m => `<option value="${m[0]}" ${p.method === m[0] ? 'selected' : ''}>${m[1]}</option>`).join('')}</select></label>
    <label class="fld">Asr<select id="s-s"><option value="0" ${!p.school ? 'selected' : ''}>Standard (Shafi'i, Maliki, Hanbali)</option><option value="1" ${p.school ? 'selected' : ''}>Hanafi</option></select></label>
    <label class="fld">Athan audio link (optional)<input id="s-u" inputmode="url" placeholder="Default Athan" value="${esc(p.url || '')}"></label>
    <div class="row-gap"><button class="btn" id="s-p">${ic('play', 18)} Preview Athan</button><button class="btn primary" id="s-ok">Done</button></div>`);
  const reload = () => { localStorage.removeItem('iqra_pt'); closeSheet(); done(); };
  $('#s-g', el).onclick = e => locate(e.currentTarget, done);
  $('#s-c', el).onclick = () => { const city = $('#s-city', el).value.trim(), country = $('#s-country', el).value.trim(); if (!city || !country) return toast('Enter city and country', 'compass'); lsSet('iqra_loc', { city, country }); reload(); };
  $('#s-m', el).onchange = e => { p.method = +e.target.value; save(); };
  $('#s-s', el).onchange = e => { p.school = +e.target.value; save(); };
  $('#s-u', el).onchange = e => { const v = e.target.value.trim(); if (v && !/^https:\/\//i.test(v)) { toast('Use an https link', 'info'); e.target.value = p.url || ''; return; } p.url = v; save(); };
  $('#s-p', el).onclick = () => { const b = $('#s-p', el); if (playing()) { stopAthan(); b.innerHTML = `${ic('play', 18)} Preview Athan`; } else { playAthan(true); b.innerHTML = `${ic('stop', 18)} Stop`; } };
  $('#s-ok', el).onclick = () => { stopAthan(); reload(); };
  askNotify();
}

// ---------- Athan ----------
const au = new Audio(); au.preload = 'none'; let unlocked = false;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
export const playing = () => !au.paused && !au.ended;
export function stopAthan() { try { au.pause(); au.currentTime = 0; } catch { /* ignore */ } }
function chime() { try { const C = window.AudioContext || window.webkitAudioContext, c = new C(); [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; o.type = 'sine'; o.connect(g); g.connect(c.destination); const s = c.currentTime + i * .45; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.22, s + .04); g.gain.exponentialRampToValueAtTime(.001, s + 1.4); o.start(s); o.stop(s + 1.5); }); } catch { /* no audio */ } }
export async function playAthan(preview) {
  if (!preview && S.settings.sound === false) return false;
  au.src = P().url || ATHAN_URL; au.volume = 1;
  try { await au.play(); return true; } catch { chime(); toast(preview ? "Couldn't load the Athan audio. Paste your own link in settings." : 'Time for prayer', 'bell'); return false; }
}
document.addEventListener('pointerdown', () => { if (unlocked) return; unlocked = true; au.src = SILENT; au.play().then(() => au.pause()).catch(() => { unlocked = false; }); }, { once: false, passive: true });
function askNotify() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* unsupported */ } }

let started = false;
export function startAthan() {
  if (started) return; started = true; let t = null, tday = '';
  const bar = (name, d) => {
    let b = $('#athan-bar'); if (b) b.remove(); b = document.createElement('div'); b.id = 'athan-bar'; b.className = 'athan-bar'; b.setAttribute('role', 'alert');
    b.innerHTML = `<span class="ico">${ic('bell', 20)}</span><div class="grow"><b>${name}</b><small>${fmt(d)} · time to pray</small></div><button class="btn" data-a="pray">Pray</button><button class="btn" data-a="stop" aria-label="Stop Athan">${ic('stop', 18)}</button>`;
    b.onclick = e => { const a = e.target.closest('[data-a]'); if (!a) return; stopAthan(); b.remove(); if (a.dataset.a === 'pray') location.hash = '#/prayer'; }; document.body.appendChild(b);
    setTimeout(() => b.isConnected && b.remove(), 300000); au.onended = () => b.isConnected && b.remove();
  };
  const check = async () => {
    const loc = lsGet('iqra_loc', null); if (!loc) return; const k = todayKey();
    if (tday !== k || !t) { try { t = await timingsFor(loc); tday = k; } catch { return; } }
    const n = new Date();
    for (const name of NAMES) {
      const d = at(t, name), diff = n - d; if (diff < 0 || diff > 90e3 || P().athan[name] === false) continue;
      const key = k + name; if (lsGet('iqra_athan', '') === key) continue; lsSet('iqra_athan', key);
      bar(name, d); playAthan(false); haptic('ok');
      try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(`${name} · ${fmt(d)}`, { body: 'Time to pray', tag: 'iqra-athan' }); } catch { /* ignore */ }
    }
  };
  setInterval(check, 5000); check();
}
export const _redraw = () => draw && draw();

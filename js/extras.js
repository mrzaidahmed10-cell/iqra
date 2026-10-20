// Home prayer widget, the read-only Community tab, and the announcement banner set from the dev portal.
import { $, esc } from './core.js';
import { ic } from './icons.js';
import { back, timers } from './ui.js';

const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// ---------- prayer times (cached per day so the Home widget is instant) ----------
async function timingsFor(loc) {
  const now = new Date(), dd = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`, lk = loc.lat != null ? `${(+loc.lat).toFixed(2)},${(+loc.lng).toFixed(2)}` : `${loc.city},${loc.country}`;
  const c = lsGet('iqra_pt', null); if (c && c.day === dd && c.lk === lk) return c.t;
  const url = loc.lat != null ? `https://api.aladhan.com/v1/timings/${dd}?latitude=${loc.lat}&longitude=${loc.lng}&method=2` : `https://api.aladhan.com/v1/timingsByCity/${dd}?city=${encodeURIComponent(loc.city)}&country=${encodeURIComponent(loc.country)}&method=2`;
  const j = await (await fetch(url)).json(), t = {}; ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(k => { t[k] = String(j.data.timings[k]).split(' ')[0]; });
  lsSet('iqra_pt', { day: dd, lk, t }); return t;
}
const at = (t, k, plus = 0) => { const [h, m] = t[k].split(':').map(Number), d = new Date(); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + plus); return d; };
const fmt = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function nextOf(t) { const n = new Date(); for (const k of NAMES) if (at(t, k) > n) return [k, at(t, k)]; return ['Fajr', at(t, 'Fajr', 1)]; }
const left = ms => { const m = Math.max(0, Math.round(ms / 6e4)), h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m}m`; };

export const prayerWidget = () => `<a class="card pw" id="pw" href="#/more/prayer"><span class="ico">${ic('dome', 20)}</span><div class="grow"><small class="muted">Next prayer</small><b id="pw-n">Set up prayer times</b></div><div class="pw-r"><b id="pw-t"></b><small class="muted" id="pw-l"></small></div></a>`;
export async function startPrayerWidget() {
  const loc = lsGet('iqra_loc', null), box = $('#pw'); if (!box) return; if (!loc) { $('#pw-l').textContent = 'Tap to start'; return; }
  let t = null; try { t = await timingsFor(loc); } catch { $('#pw-n').textContent = 'Prayer times'; $('#pw-l').textContent = 'Offline'; return; }
  const draw = () => { if (!$('#pw')) return; const [k, d] = nextOf(t); $('#pw-n').textContent = k; $('#pw-t').textContent = fmt(d); $('#pw-l').textContent = 'in ' + left(d - new Date()); };
  draw(); timers.push(setInterval(draw, 20000));
}

// ---------- community (read only) ----------
const KIND = { news: 'News', update: 'Update', reminder: 'Reminder', dua: 'Dua', event: 'Event' };
export async function refreshCommunity() {
  try {
    const r = await fetch('/api/community', { cache: 'no-store' }); if (!r.ok) return; const { posts } = await r.json(); lsSet('iqra_comm', posts.map(p => p.id));
    const seen = lsGet('iqra_comm_seen', []), n = posts.filter(p => !seen.includes(p.id)).length; dot(n); return posts;
  } catch { /* offline */ }
}
export const unreadCount = () => { const seen = lsGet('iqra_comm_seen', []); return lsGet('iqra_comm', []).filter(id => !seen.includes(id)).length; };
export const dot = n => { document.querySelector('.nav a[data-tab=more]')?.classList.toggle('dot', n > 0); };
export async function viewCommunity() {
  let posts = null; try { const r = await fetch('/api/community', { cache: 'no-store' }); if (r.ok) posts = (await r.json()).posts; } catch { /* offline */ }
  if (posts) { lsSet('iqra_comm', posts.map(p => p.id)); lsSet('iqra_comm_seen', posts.map(p => p.id)); dot(0); }
  const card = p => `<article class="card post ${p.pinned ? 'pin' : ''}"><div class="post-h"><span class="pill">${KIND[p.kind] || 'News'}</span>${p.pinned ? `<span class="pill gold">${ic('star', 12)} Pinned</span>` : ''}<small class="muted">${new Date(p.at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</small></div><h3>${esc(p.title)}</h3><p>${esc(p.body).replace(/\n/g, '<br>')}</p>${p.link ? `<a class="btn" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">Open link</a>` : ''}</article>`;
  return { html: `${back()}<h2>Community</h2><p class="muted">News and reminders from the Iqra team.</p>${posts === null ? `<section class="card center"><p class="muted">Couldn't load posts. Check your connection.</p></section>` : posts.length ? posts.map(card).join('') : `<section class="card center"><span class="ico big">${ic('users', 24)}</span><h3>Nothing here yet</h3><p class="muted">Announcements from the Iqra team will show up here.</p></section>`}` };
}

// ---------- announcement banner ----------
export async function loadBanner() {
  try { const c = await (await fetch('/api/config', { cache: 'no-store' })).json(); window.__cfg = c; return c; } catch { return null; }
}
export const bannerHTML = () => { const b = window.__cfg && window.__cfg.banner; return b && b.text ? `<div class="sbanner ${esc(b.tone || 'info')}" role="status">${esc(b.text)}</div>` : ''; };

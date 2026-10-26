// Home prayer widget, the read-only Community tab, and the announcement banner set from the dev portal.
import { $, esc, api, Auth, sheet, closeSheet, toast, feel, haptic } from './core.js';
import { ic } from './icons.js';
import { back, timers } from './ui.js';
import { lsGet, timingsFor, nextOf, fmt, left } from './prayer.js';

const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
export const prayerWidget = () => `<a class="card pw" id="pw" href="#/prayer"><span class="ico">${ic('dome', 20)}</span><div class="grow"><small class="muted">Next prayer</small><b id="pw-n">Set up prayer times</b></div><div class="pw-r"><b id="pw-t"></b><small class="muted" id="pw-l"></small></div></a>`;
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
const ago = t => { const m = Math.floor((Date.now() - t) / 6e4); return m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.floor(m / 60) + 'h' : m < 10080 ? Math.floor(m / 1440) + 'd' : new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }); };
const imgGrid = l => l && l.length ? `<div class="post-imgs n${Math.min(l.length, 4)}">${l.map(id => `<img src="/api/img/${esc(id)}" alt="" loading="lazy" decoding="async">`).join('')}</div>` : '';
const card = p => `<article class="card post ${p.pinned ? 'pin' : ''}" data-id="${esc(p.id)}"><div class="post-h"><span class="pill">${KIND[p.kind] || 'News'}</span>${p.pinned ? `<span class="pill gold">${ic('star', 12)} Pinned</span>` : ''}<small class="muted">${new Date(p.at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</small></div><h3>${esc(p.title)}</h3><p>${esc(p.body).replace(/\n/g, '<br>')}</p>${imgGrid(p.imgs)}${p.link ? `<a class="btn" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">Open link</a>` : ''}
  <div class="post-bar"><button class="act like ${p.liked ? 'on' : ''}" data-k="like" aria-pressed="${!!p.liked}" aria-label="Like"><span class="hrt">${ic(p.liked ? 'heartFill' : 'heart', 20)}</span><b>${p.likes || 0}</b></button><button class="act" data-k="cm" aria-label="Comments">${ic('message', 20)}<b>${p.cc || 0}</b></button></div></article>`;
let posts = [];
function bind() {
  const root = $('#cm-list'); if (!root) return; const busy = new Set();
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-k]'), art = e.target.closest('.post'); if (!b || !art) return; const p = posts.find(x => x.id === art.dataset.id); if (!p) return;
    if (b.dataset.k === 'like') {
      if (!Auth.token) { toast('Sign in to like posts', 'heart'); return; } if (busy.has(p.id)) return; busy.add(p.id);
      p.liked = !p.liked; p.likes = Math.max(0, (p.likes || 0) + (p.liked ? 1 : -1)); art.querySelector('.like').outerHTML = card(p).match(/<button class="act like[\s\S]*?<\/button>/)[0]; const nb = art.querySelector('.like'); nb.classList.add('pop'); haptic('tick'); feel('tick', 'tick');
      try { const j = await api('community/like', 'POST', { id: p.id }); p.liked = j.liked; p.likes = j.likes; } catch (er) { p.liked = !p.liked; p.likes = Math.max(0, p.likes + (p.liked ? 1 : -1)); toast(er.message || 'Could not like that', 'info'); }
      art.querySelector('.like').outerHTML = card(p).match(/<button class="act like[\s\S]*?<\/button>/)[0]; busy.delete(p.id);
    } else openComments(p, art);
  });
}
async function openComments(p, art) {
  const el = sheet(`<div class="cm-head"><h3>Comments</h3><small class="muted" id="cm-n"></small></div><div class="cm-list" id="cm-items"><p class="muted center">Loading…</p></div>${p.closed ? `<p class="muted center small">Comments are closed on this post.</p>` : Auth.token ? `<form class="cm-form" id="cm-form" autocomplete="off"><input id="cm-in" maxlength="300" placeholder="Add a comment" enterkeyhint="send" aria-label="Add a comment"><button class="btn primary" id="cm-send" type="submit">Send</button></form>` : `<p class="muted center small">Sign in to join the conversation.</p>`}`, 'cm-sheet');
  let me = '', list = []; const draw = () => { $('#cm-n', el).textContent = list.length; $('#cm-items', el).innerHTML = list.length ? list.map(c => `<div class="cm" data-c="${esc(c.id)}"><div class="cm-top"><b>${esc(c.user)}</b><small class="muted">${ago(c.at)}</small>${c.mine ? `<button class="cm-x" data-x="${esc(c.id)}" aria-label="Delete comment">${ic('x', 14)}</button>` : ''}</div><p>${esc(c.text)}</p></div>`).join('') : `<p class="muted center">No comments yet. Be the first.</p>`; const box = $('#cm-items', el); box.scrollTop = box.scrollHeight; };
  try { const j = await api('community/comments?id=' + encodeURIComponent(p.id)); list = j.comments; me = j.me; } catch { $('#cm-items', el).innerHTML = '<p class="muted center">Could not load comments.</p>'; return; } draw();
  const sync = () => { p.cc = list.length; const b = art.querySelector('[data-k=cm] b'); if (b) b.textContent = p.cc; };
  el.addEventListener('click', async e => { const x = e.target.closest('[data-x]'); if (!x) return; const id = x.dataset.x, keep = list; list = list.filter(c => c.id !== id); draw(); sync(); try { await api('community/comment-delete', 'POST', { id: p.id, cid: id }); } catch (er) { list = keep; draw(); sync(); toast(er.message, 'info'); } });
  const f = $('#cm-form', el); if (f) f.addEventListener('submit', async e => {
    e.preventDefault(); const inp = $('#cm-in', el), t = inp.value.trim(), btn = $('#cm-send', el); if (!t || btn.disabled) return; btn.disabled = true;
    try { const j = await api('community/comment', 'POST', { id: p.id, text: t }); list.push(j.comment); inp.value = ''; draw(); sync(); feel('tick', 'tick'); } catch (er) { toast(er.message || 'Could not post that', 'info'); }
    btn.disabled = false; inp.focus();
  });
}
export async function viewCommunity() {
  let ok = true; try { const j = await api('community'); posts = j.posts; } catch { ok = false; posts = []; }
  if (ok) { lsSet('iqra_comm', posts.map(p => p.id)); lsSet('iqra_comm_seen', posts.map(p => p.id)); dot(0); }
  return { html: `${back()}<h2>Community</h2><p class="muted">News and reminders from the Iqra team.</p><div id="cm-list">${!ok ? `<section class="card center"><p class="muted">Couldn't load posts. Check your connection.</p></section>` : posts.length ? posts.map(card).join('') : `<section class="card center"><span class="ico big">${ic('users', 24)}</span><h3>Nothing here yet</h3><p class="muted">Announcements from the Iqra team will show up here.</p></section>`}</div>`, after: bind };
}

// ---------- announcement banner ----------
export async function loadBanner() {
  try { const c = await (await fetch('/api/config', { cache: 'no-store' })).json(); window.__cfg = c; return c; } catch { return null; }
}
export const bannerHTML = () => { const b = window.__cfg && window.__cfg.banner; return b && b.text ? `<div class="sbanner ${esc(b.tone || 'info')}" role="status">${esc(b.text)}</div>` : ''; };

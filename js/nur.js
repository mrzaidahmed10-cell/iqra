// Nur: a back-and-forth chat with your Quran coach.
import { S, $, $$, esc, api, Auth, save, sheet, closeSheet, ask, learnedTotal, masteredTotal, levelOf, feel, toast } from './core.js';
import { ic } from './icons.js';
import { TRACKS } from './content.js';

const SUGGEST = ['What should I learn next?', 'Quiz me on what I know', 'How do I memorize faster?', 'Explain noon sakinah simply', 'What are the five pillars of Islam?'];

// Escape first, then add a little formatting. Arabic runs get their own font and direction.
export function md(t) {
  let h = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,!?])/g, '$1<i>$2</i>');
  h = h.replace(/([؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿][؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿\s،۔]*)/g, (m, run) => { const t = run.replace(/\s+$/, ''); return `<span class="ar" dir="rtl">${t}</span>${run.slice(t.length)}`; });
  const lines = h.split('\n'); let out = '', list = false;
  for (const l of lines) {
    const m = l.match(/^\s*(?:[-•]|\d+[.)])\s+(.*)/);
    if (m) { if (!list) { out += '<ul>'; list = true; } out += `<li>${m[1]}</li>`; } else { if (list) { out += '</ul>'; list = false; } out += l.trim() ? `<p>${l}</p>` : ''; }
  }
  return out + (list ? '</ul>' : '');
}

export function openNur({ ask: first, extra } = {}) {
  if ($('.nur')) { $('.nur').remove(); }
  document.body.classList.add('noscroll', 'studying');
  const ov = document.createElement('div'); ov.className = 'nur'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Chat with Nur');
  ov.innerHTML = `<header class="n-top"><button class="icon-btn" data-k="close" aria-label="Close">${ic('chevD', 22)}</button><div class="n-id"><span class="n-orb">${ic('sparkle', 18)}</span><div><b>Nur</b><small>Your Quran coach</small></div></div><button class="icon-btn" data-k="clear" aria-label="Clear chat">${ic('trash', 18)}</button></header>
    <main class="n-list" id="nl" aria-live="polite"></main>
    <div class="n-sug" id="ns"></div>
    <form class="n-in" id="nf"><textarea id="nt" rows="1" placeholder="Ask Nur about the Quran, tajweed or Islam" maxlength="1000"></textarea><button class="send" type="submit" aria-label="Send">${ic('send', 20)}</button></form>`;
  document.body.append(ov); requestAnimationFrame(() => ov.classList.add('in'));
  const list = $('#nl', ov), ta = $('#nt', ov), sug = $('#ns', ov); let busy = false;

  const DISC = "I'm an AI, not a scholar, and I can make mistakes. For rulings that affect you, check with a qualified scholar.";
  const bubble = m => `<div class="msg ${m.r}"><div class="bub">${m.r === 'ai' ? md(m.t) : esc(m.t).replace(/\n/g, '<br>')}${m.d ? `<small class="disc">${DISC}</small>` : ''}</div></div>`;
  const scroll = () => list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  function paint() {
    const hello = `Assalamu alaykum${S.profile && S.profile.name ? ', ' + esc(S.profile.name) : ''}. I'm Nur. Ask me about letters, tajweed, a surah you're learning, or any Islamic question.`;
    list.innerHTML = (S.nur.length ? '' : `<div class="msg ai"><div class="bub"><p>${hello}</p></div></div>`) + S.nur.map(bubble).join('');
    sug.innerHTML = S.nur.length ? '' : SUGGEST.map(s => `<button type="button" data-s="${esc(s)}">${esc(s)}</button>`).join('');
    list.scrollTop = list.scrollHeight;
  }
  const context = () => ({
    name: S.profile && S.profile.name, level: S.profile && S.profile.level, track: TRACKS[S.track] && TRACKS[S.track].n, appLevel: levelOf(S.xp),
    ayahsLearned: learnedTotal(), surahsMastered: masteredTotal(), lessonsDone: Object.keys(S.lessons).length, extra: extra || '',
  });
  async function send(text) {
    text = (text || '').trim(); if (!text || busy) return;
    busy = true; ta.value = ''; fit(); sug.innerHTML = '';
    S.nur.push({ r: 'user', t: text, at: Date.now() }); list.insertAdjacentHTML('beforeend', bubble({ r: 'user', t: text }));
    list.insertAdjacentHTML('beforeend', `<div class="msg ai" id="typing"><div class="bub typing"><i></i><i></i><i></i></div></div>`); scroll(); feel('tick');
    let reply, disc = false;
    try {
      if (!Auth.groq) throw new Error('Nur is unavailable right now. Please try again later.');
      const msgs = S.nur.slice(-14).map(m => ({ role: m.r === 'user' ? 'user' : 'assistant', content: m.t.slice(0, 1500) }));
      const j = await api('nur', 'POST', { messages: msgs, context: context() }); reply = j.reply; disc = !!j.disclaimer;
    } catch (e) { reply = e.message || 'I could not reach the server. Try again in a moment.'; }
    $('#typing', ov)?.remove();
    S.nur.push({ r: 'ai', t: reply, d: disc, at: Date.now() }); S.nur = S.nur.slice(-40); save();
    list.insertAdjacentHTML('beforeend', bubble({ r: 'ai', t: reply, d: disc })); scroll(); feel('ok'); busy = false;
  }
  const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
  ta.addEventListener('input', fit);
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover:hover)').matches) { e.preventDefault(); send(ta.value); } });
  $('#nf', ov).addEventListener('submit', e => { e.preventDefault(); send(ta.value); });
  ov.addEventListener('click', async e => {
    const s = e.target.closest('[data-s]'); if (s) return send(s.dataset.s);
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (k === 'close') { ov.classList.remove('in'); setTimeout(() => ov.remove(), 280); if (!$('.lesson')) document.body.classList.remove('studying'); if (!$('.lesson,.game,.recite')) document.body.classList.remove('noscroll'); }
    else if (k === 'clear') { if (await ask({ title: 'Clear this conversation?', ok: 'Clear', danger: true })) { S.nur = []; save(); paint(); } }
  });
  paint(); if (first) setTimeout(() => send(first), 350);
  void sheet; void closeSheet; void toast;
}

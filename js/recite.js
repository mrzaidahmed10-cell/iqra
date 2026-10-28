// Recitation grading: record, transcribe, align with the mushaf, review tajweed, show a graded result.
// Practice mode grades any range. Mastery mode records a pass toward mastering the surah.
import { S, $, $$, esc, toAr, api, Auth, nrm, wordsOf, sr, day, save, reward, sheet, closeSheet, toast, feel, sfx, haptic, stopAllAudio, getWords, audioUrl } from './core.js';
import { ic } from './icons.js';
import { openNur } from './nur.js';
import { LENIENCY } from './content.js';
import { prepare, wavOf, to16k, mfcc, dtw, median } from './audioprep.js';

const CHUNK = 20, MAX = 30;
const partsOf = count => { if (count <= MAX) return [[1, count]]; const p = []; for (let s = 1; s <= count; s += CHUNK) p.push([s, Math.min(count, s + CHUNK - 1)]); return p; };
function lev(a, b) {
  if (a === b) return 0; let p = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[b.length];
}
const sim0 = (a, b) => { if (a === b) return 1; const L = Math.max(a.length, b.length); return !L || Math.abs(a.length - b.length) > 3 ? 0 : 1 - lev(a, b) / L; };
// The mushaf writes some long alefs as a small mark that speech models spell out in full, so words that differ only by alef count as a near match.
const sim = (a, b) => { const s = sim0(a, b); return s === 1 ? 1 : Math.max(s, a.replace(/ا/g, '') === b.replace(/ا/g, '') && a.length > 1 ? .95 : 0); };
// Word alignment (edit-distance DP) that also understands the speech model merging or splitting words:
// one heard word can cover two expected words, and two heard words can cover one expected word.
function align(E, H) {
  const m = E.length, n = H.length, GAP = -.7, pts = s => s >= .75 ? 1 : s >= .5 ? .2 : -1;
  const dp = Array.from({ length: m + 1 }, () => new Float32Array(n + 1)), bt = Array.from({ length: m + 1 }, () => new Uint8Array(n + 1));
  for (let i = 1; i <= m; i++) dp[i][0] = i * GAP; for (let j = 1; j <= n; j++) dp[0][j] = j * GAP;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    let best = dp[i - 1][j - 1] + pts(sim(E[i - 1], H[j - 1])), op = 0;
    const u = dp[i - 1][j] + GAP, l = dp[i][j - 1] + GAP;
    if (u > best) { best = u; op = 1; } if (l > best) { best = l; op = 2; }
    if (i >= 2 && j >= 1 && sim(E[i - 2] + E[i - 1], H[j - 1]) >= .8) { const v = dp[i - 2][j - 1] + 1.9; if (v > best) { best = v; op = 3; } }
    if (j >= 2 && i >= 1 && sim(E[i - 1], H[j - 2] + H[j - 1]) >= .8) { const v = dp[i - 1][j - 2] + 1; if (v > best) { best = v; op = 4; } }
    dp[i][j] = best; bt[i][j] = op;
  }
  const lo = new Array(m).fill(-1), hi = new Array(m).fill(-1), sc = new Array(m).fill(0), sp = new Array(m).fill(null); let i = m, j = n;
  while (i > 0 || j > 0) {
    const op = i === 0 ? 2 : j === 0 ? 1 : bt[i][j];
    if (op === 0) { lo[i - 1] = hi[i - 1] = j - 1; sc[i - 1] = sim(E[i - 1], H[j - 1]); i--; j--; }
    else if (op === 3) { const s = sim(E[i - 2] + E[i - 1], H[j - 1]), f = E[i - 2].length / (E[i - 2].length + E[i - 1].length); lo[i - 1] = hi[i - 1] = lo[i - 2] = hi[i - 2] = j - 1; sc[i - 1] = sc[i - 2] = s; sp[i - 2] = { k: 0, f }; sp[i - 1] = { k: 1, f }; i -= 2; j--; }
    else if (op === 4) { lo[i - 1] = j - 2; hi[i - 1] = j - 1; sc[i - 1] = sim(E[i - 1], H[j - 2] + H[j - 1]); i--; j -= 2; }
    else if (op === 1) i--; else j--;
  }
  return { lo, hi, sc, sp };
}
export const gradeOf = s => s >= 98 ? ['Flawless', 'good'] : s >= 95 ? ['Mastery level', 'good'] : s >= 85 ? ['Very good', 'good'] : s >= 70 ? ['Passed', 'mid'] : ['Keep practicing', 'low'];
// ---- coach memory: words you missed stay on a watch list until you get them right twice in a row ----
const wkey = (n, a, k) => `${n}:${a}:${k}`;
export const weakList = () => Object.values(S.weak || {});
export const weakCount = () => weakList().length;
export function remember(surahN, W, marks, L, incomplete) {
  const out = { fixed: [], still: [], fresh: [] }; if (incomplete) return out; const w = S.weak = S.weak || {};
  W.forEach((x, i) => {
    const k = wkey(surahN, x.a, x.pos), m = marks[i], bad = m && m.type !== 'taj' && !(L.passPron && m.type === 'pron'), old = w[k];
    if (bad) { w[k] = { n: surahN, a: x.a, p: x.pos, w: x.w, c: (old ? old.c : 0) + 1, ok: 0, t: m.type, issue: m.issue || '', at: Date.now() }; (old ? out.still : out.fresh).push(i); }
    else if (old) { old.ok = (old.ok || 0) + 1; out.fixed.push(i); if (old.ok >= 2) { delete w[k]; S.cleared = (S.cleared || 0) + 1; } }
  });
  const keys = Object.keys(w); if (keys.length > 150) keys.sort((a, b) => w[a].at - w[b].at).slice(0, keys.length - 150).forEach(k => delete w[k]);
  return out;
}
const lenOf = () => LENIENCY[S.settings.leniency] || LENIENCY.balanced;
// Letters that are easy to swap when reciting (and that the speech model often writes as it hears them)
const CONF = ['صس', 'ضد', 'ظذ', 'طت', 'قك', 'غخ', 'ثس', 'ذز', 'حه', 'شس', 'عا', 'خح', 'ظز', 'ضظ'];
function confusable(e, h) {
  if (e.length !== h.length) return false; let d = 0;
  for (let i = 0; i < e.length; i++) if (e[i] !== h[i]) { if (!CONF.some(p => (p[0] === e[i] && p[1] === h[i]) || (p[1] === e[i] && p[0] === h[i]))) return false; d++; }
  return d > 0;
}
const LAB = { wrong: 'Wrong word', missing: 'Missing word', pron: 'Pronunciation', taj: 'Tajweed reminder' };

/** opts: {from, to, mastery}. Without a range, a picker is shown. */
export function openRecite(surah, ayahs, opts = {}) {
  const rec = sr(surah.n), parts = partsOf(surah.count);
  stopAllAudio();
  const ov = document.createElement('div'); ov.className = 'recite'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Recite ' + surah.en);
  document.body.append(ov); document.body.classList.add('noscroll', 'studying'); requestAnimationFrame(() => ov.classList.add('in'));
  let mr = null, stream = null, tick = null, actx = null, raf = 0, W = [], hard = false, result = null, range = { from: 1, to: Math.min(surah.count, MAX), mastery: false }, blobUrl = '', tipLog = {}, replay = null, recBlob = null, dctx = null, dbuf = null, wsrc = null, wtoken = 0, wref = null, env = null;
  const cleanup = () => { clearInterval(tick); cancelAnimationFrame(raf); try { if (mr && mr.state !== 'inactive') { mr.onstop = null; mr.stop(); } } catch { /* ignore */ } if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; mr = null; try { actx && actx.close(); } catch { /* ignore */ } actx = null; if (replay) { replay.pause(); replay = null; } };
  const close = () => { cleanup(); if (blobUrl) URL.revokeObjectURL(blobUrl); ov.classList.remove('in'); setTimeout(() => ov.remove(), 280); if (!$('.lesson,.nur')) document.body.classList.remove('studying'); if (!$('.lesson,.game,.nur')) document.body.classList.remove('noscroll'); window.dispatchEvent(new Event('iqra-refresh')); };
  const top = t => `<header class="ov-top"><button class="icon-btn" data-k="close" aria-label="Close">${ic('x', 20)}</button><b>${esc(t)}</b><span></span></header>`;

  function picker() {
    cleanup(); const canMaster = rec.done && !rec.mastered;
    ov.innerHTML = `${top('Recite · ' + surah.en)}<div class="ov-body"><section class="card"><h3>Choose what to recite</h3><p class="muted">Recite from memory or from the text. The coach grades you and shows exactly what to fix. Up to ${MAX} ayahs at a time.</p>
      <div class="range"><label>From ayah<div class="step"><button data-k="dn" data-f="from" aria-label="Lower">${ic('minus', 16)}</button><b id="rf">${range.from}</b><button data-k="up" data-f="from" aria-label="Higher">${ic('plus', 16)}</button></div></label>
      <label>To ayah<div class="step"><button data-k="dn" data-f="to" aria-label="Lower">${ic('minus', 16)}</button><b id="rt">${range.to}</b><button data-k="up" data-f="to" aria-label="Higher">${ic('plus', 16)}</button></div></label></div>
      <button class="btn primary big" data-k="go">Practice this range</button></section>
      ${rec.done ? `<section class="card"><h3>Mastery</h3><p class="muted">${rec.mastered ? 'You have mastered this surah. Recite it again any time.' : 'Score 95% or higher on every part to master this surah. 70% or higher counts as a pass.'}</p><div class="opts col">${parts.map((p, k) => `<button class="opt" data-k="part" data-n="${k}"><span>${parts.length > 1 ? `Part ${k + 1} · ` : ''}ayahs ${p[0]} to ${p[1]}</span>${rec.parts[k] ? `<b class="ok-t">${rec.parts[k].score}%</b>` : ''}</button>`).join('')}</div></section>` : `<p class="muted center small">Learn the whole surah to unlock mastery. Practice grading works any time.</p>`}</div>`;
    void canMaster;
  }
  function clampRange(f, d) {
    let { from, to } = range; if (f === 'from') from = Math.max(1, Math.min(surah.count, from + d)); else to = Math.max(1, Math.min(surah.count, to + d));
    if (from > to) { if (f === 'from') to = from; else from = to; } if (to - from + 1 > MAX) { if (f === 'from') to = from + MAX - 1; else from = to - MAX + 1; }
    range.from = from; range.to = to; $('#rf', ov).textContent = from; $('#rt', ov).textContent = to; haptic('tick');
  }
  function ready() {
    cleanup(); result = null; const sel = ayahs.filter(a => a.n >= range.from && a.n <= range.to); W = [];
    sel.forEach(a => { const ws = wordsOf(a.ar); ws.forEach((w, i) => W.push({ w, a: a.n, pos: i, last: i === ws.length - 1 })); });
    ov.innerHTML = `${top((range.mastery ? 'Mastery · ' : '') + surah.en)}<div class="ov-body"><p class="coach-note">${ic('mic', 18)}<span>Recite <b>ayah ${range.from}${range.to > range.from ? ' to ' + range.to : ''}</b> in one go, at a steady pace. ${range.mastery ? 'Scoring 95% or higher counts toward mastery.' : 'You will get a grade and a list of things to fix.'}</span></p>
      ${(() => { const hw = W.filter(x => (S.weak || {})[wkey(surah.n, x.a, x.pos)]); return hw.length ? `<p class="coach-note">${ic('target', 18)}<span><b>Watch these words</b> that tripped you up before:<br><span class="ar wlist" dir="rtl">${hw.slice(0, 12).map(x => esc(x.w)).join(' · ')}</span></span></p>` : ''; })()}
      <label class="switch-row"><span><b>Hide the text</b><small class="muted">Recite from memory</small></span><input type="checkbox" id="hard" ${hard ? 'checked' : ''}></label>
      <div class="rtext ar" id="rtext" dir="rtl">${textHTML()}</div></div>
      <footer class="ov-foot"><button class="btn primary big" data-k="rec">${ic('mic', 20)} Start recording</button></footer>`;
  }
  function textHTML(marks = {}) {
    let out = ''; W.forEach((x, i) => { const m = marks[i], fx = m && result && result.fixed && result.fixed[i]; out += `<span class="w ${m ? (fx ? 'fixed' : m.type) : ''}" data-i="${i}">${esc(x.w)}</span> `; if (x.last) out += `<span class="aend">﴿${toAr(x.a)}﴾</span> `; });
    return out;
  }
  async function startRec() {
    if (!Auth.groq) { const el = sheet(`<h3>The coach is unavailable</h3><p class="muted">Please try again in a little while.</p><button class="btn primary" data-c="1">OK</button>`); el.addEventListener('click', e => { if (e.target.closest('[data-c]')) closeSheet(); }); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { toast('Microphone permission is needed', 'mic'); return; }
    hard = $('#hard', ov)?.checked || false;
    const mt = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const chunks = []; mr = new MediaRecorder(stream, mt ? { mimeType: mt } : {});
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = () => { const type = mr.mimeType || mt || 'audio/webm'; stream.getTracks().forEach(t => t.stop()); analyze(new Blob(chunks, { type })); };
    tipLog = {}; mr.start(); let s = 0; feel('tap');
    $('#rtext', ov).classList.toggle('hidden-text', hard);
    $('.ov-foot', ov).innerHTML = `<div class="rtip" id="rtip" aria-live="polite"></div><div class="recbar"><div class="meter" id="meter"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><b id="rtm">0:00</b></div><button class="btn danger big" data-k="stop">${ic('stop', 18)} Stop and check</button>`;
    try { // live level meter
      const C = window.AudioContext || window.webkitAudioContext; actx = new C(); const an = actx.createAnalyser(); an.fftSize = 1024; actx.createMediaStreamSource(stream).connect(an); const buf = new Uint8Array(an.frequencyBinCount), td = new Uint8Array(an.fftSize), bars = $$('#meter i', ov), tp = liveTips($('#rtip', ov));
      const loop = () => { an.getByteFrequencyData(buf); bars.forEach((b, i) => { const v = buf[2 + i * 5] / 255; b.style.transform = `scaleY(${.15 + v * .95})`; }); an.getByteTimeDomainData(td); let q = 0, pk = 0; for (let k = 0; k < td.length; k++) { const x = (td[k] - 128) / 128; q += x * x; pk = Math.max(pk, Math.abs(x)); } tp.feed(Math.sqrt(q / td.length), pk, performance.now()); raf = requestAnimationFrame(loop); }; loop();
    } catch { /* meter is optional */ }
    tick = setInterval(() => { s++; const e = $('#rtm', ov); if (e) e.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (s >= 900) stopRec(); }, 1000);
  }
  // Live coaching while you recite: watches loudness, background noise, pace (bursts of sound per second) and pauses.
  function liveTips(el) {
    const T0 = performance.now(), hist = []; let floor = 1, lastShow = 0, hideAt = 0, last = '', lastAt = 0, ema = 0, above = false, ons = [], lastCheck = 0, okAt = T0;
    const show = (msg, now, good) => { if (msg === last && now - lastAt < 15000) return; last = msg; lastAt = now; lastShow = now; hideAt = now + 3800; if (!good) tipLog[msg] = (tipLog[msg] || 0) + 1; el.textContent = msg; el.className = 'rtip on' + (good ? ' good' : ''); };
    return { feed(v, pk, now) {
      ema += (v - ema) * .35; floor = Math.min(floor * 1.0008 + 1e-5, Math.max(1e-4, ema)); hist.push({ t: now, v: ema, pk }); while (hist.length && now - hist[0].t > 3000) hist.shift();
      if (hideAt && now > hideAt) { hideAt = 0; el.className = 'rtip'; }
      const w = hist.map(x => x.v), top = [...w].sort((a, b) => a - b)[Math.floor(w.length * .95)] || 0, hi = floor + (top - floor) * .5, lo = floor + (top - floor) * .28;
      if (!above && ema > hi && top > floor * 2.2 && top > .02) { above = true; ons.push(now); } else if (above && ema < lo) above = false; while (ons.length && now - ons[0] > 3000) ons.shift();
      if (now - lastCheck < 500 || now - T0 < 3000 || now - lastShow < 7000) return; lastCheck = now;
      const rate = ons.length / 3, voiced = w.filter(x => x > floor + (top - floor) * .2).length / (w.length || 1), peak = Math.max(...hist.map(x => x.pk), 0);
      const mean = w.reduce((a, b) => a + b, 0) / (w.length || 1), sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / (w.length || 1)), cv = mean ? sd / mean : 0;
      if (top < .015) return show('Speak up or move closer to the mic', now);
      if (peak > .97) return show('Too loud. Move back a little', now);
      if (floor > top * .4 && top > .02) return show('Background noise. Find a quieter spot', now);
      if (rate > 7.5) return show('Go slower', now);
      if (voiced < .3) return show('Keep a steady flow between words', now);
      if (cv < .3 && rate < 4.5 && voiced > .7) return show('Be clearer. Pronounce every letter', now);
      if (rate && rate < 1.6 && voiced > .35) return show('A little smoother. Let the words flow', now);
      if (now - okAt > 25000) { okAt = now; show('Nice, steady pace', now, true); }
    } };
  }
  function stopRec() { clearInterval(tick); cancelAnimationFrame(raf); if (mr && mr.state !== 'inactive') mr.stop(); }

  async function analyze(blob) {
    if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = URL.createObjectURL(blob); recBlob = blob; dbuf = null; env = null; if (replay) { replay.pause(); replay = null; }
    ov.innerHTML = `${top('Checking your recitation')}<div class="ov-body"><div class="working"><div class="spinner"></div><h3 id="ph">Listening to your recitation…</h3><p class="muted">This takes a few seconds.</p></div></div>`;
    try {
      const up = await prepare(blob), nm = x => 'rec.' + (/wav/.test(x.type) ? 'wav' : /mp4|m4a/.test(x.type) ? 'm4a' : 'webm');
      const send = (model, x) => { const fd = new FormData(); fd.append('audio', up, nm(up)); fd.append('model', model); return api('transcribe' + (x ? '?x=1' : ''), 'POST', fd); };
      const secondP = send('whisper-large-v3-turbo', true).catch(() => null); // a second opinion from another model
      const t = await send('whisper-large-v3');
      const ph = $('#ph', ov); if (ph) ph.textContent = 'Comparing with the mushaf…';
      const parse = t0 => { const H = [], Hr = [], Ht = []; if (!t0) return { H, Hr, Ht };
        if (Array.isArray(t0.words) && t0.words.length >= 2) t0.words.forEach(x => { const r = String(x.w || '').replace(/[^؀-ۿ]/g, ''), n = nrm(r); if (n) { H.push(n); Hr.push(r); Ht.push({ s: x.s, e: x.e }); } });
        else (t0.text || '').replace(/[^؀-ۿ\s]/g, ' ').split(/\s+/).filter(Boolean).forEach(r => { const n = nrm(r); if (n) { H.push(n); Hr.push(r); Ht.push(null); } });
        return { H, Hr, Ht }; };
      const L = lenOf(), { H, Hr, Ht } = parse(t), p2 = parse(await secondP);
      if (H.length < 2) throw new Error("I couldn't hear a recitation. Check your microphone and try again.");
      const E = W.map(x => nrm(x.w)), al = align(E, H), m = W.length, strict = S.settings.leniency === 'strict', al2 = p2.H.length >= 2 ? align(E, p2.H) : null;
      // Two models, one verdict: gentle/balanced trust the better reading (transcription noise is forgiven), strict needs both to agree.
      const info = W.map((x, i) => {
        const j = al.lo[i], jh = al.hi[i], s1 = j < 0 ? 0 : al.sc[i], h1 = j < 0 ? null : Hr.slice(j, jh + 1).join(' ');
        let s = s1, heard = h1, alt = null, present = j >= 0;
        if (al2) { const k = al2.lo[i]; if (k >= 0) { const s2 = al2.sc[i], h2 = p2.Hr.slice(k, al2.hi[i] + 1).join(' '); if (!present && !strict) { present = true; s = s2; heard = h2; } else if (present) { if (strict ? s2 < s1 : s2 > s1) { s = s2; alt = h1; heard = h2; } else alt = h2; } } }
        return { i, j, jh, s, alt, heard, conf: present && s < 1 && confusable(E[i], (heard ? nrm(heard) : '')), st: !present ? 'missing' : s >= L.ok ? 'ok' : s >= L.wrong ? 'close' : 'wrong' };
      });
      const r0 = { hidx: info.map(x => x.j), hhi: info.map(x => x.jh), sp: al.sp, ht: Ht, hl: Hr.map(x => x.length), noTs: !Ht.some(Boolean), hn: H.length, fixed: {}, refined: {}, rp: {} };
      const ph3 = $('#ph', ov); if (ph3) ph3.textContent = 'Comparing how each word sounds…';
      const ac = await acousticCheck(info, E, r0);
      info.forEach(x => { const z = ac.z[x.i]; if (z == null) return; x.z = z;
        if (!strict && ((x.st === 'close' && x.s >= L.ok - .1 && z < .5) || (x.st === 'ok' && x.conf && z < .5))) { x.st = 'ok'; x.conf = false; } // sounds just like the reference, so the text difference was transcription noise
        else if (x.st === 'ok' && !x.conf && x.s < 1 && z > 3.2 && !L.passPron) x.conf = true; // the text matched but the sound is off
      });
      const missing = info.filter(x => x.st === 'missing').length;
      const used = new Set(); info.forEach(x => { if (x.j >= 0) for (let k = x.j; k <= x.jh; k++) used.add(k); });
      const extras = H.length - used.size;
      const near = i => { let a = i - 1; while (a >= 0 && info[a].j < 0) a--; let b = i + 1; while (b < m && info[b].j < 0) b++; const lo = a >= 0 ? info[a].jh + 1 : 0, hi = b < m ? info[b].j : H.length; return Hr.slice(lo, hi).slice(0, 4); };
      // Words that sounded right to the aligner but show a classic letter swap (ص/س, ق/ك, ...) are sent to the coach too
      const cands = info.filter(x => x.st !== 'ok' || x.conf).slice(0, 120);
      let coach = null;
      if (missing / m <= .35) {
        const p2 = $('#ph', ov); if (p2) p2.textContent = 'Your coach is reviewing tajweed…';
        try { coach = await api('coach', 'POST', { leniency: S.settings.leniency || 'balanced', surah: surah.en, history: W.map((x, i) => { const o = (S.weak || {})[wkey(surah.n, x.a, x.pos)]; return o ? { i, expected: x.w, misses: o.c, issue: o.issue } : null; }).filter(Boolean).slice(0, 40), transcript: t.text, words: m <= 250 ? W.map(x => x.w) : null, candidates: cands.map(c => ({ i: c.i, expected: W[c.i].w, heard: c.heard, near: c.heard ? null : near(c.i), sim: +c.s.toFixed(2), alt: c.alt || undefined, ac: c.z != null ? +c.z.toFixed(1) : undefined, suspect: c.st === 'ok' ? true : undefined })) }); } catch { coach = null; }
      }
      const marks = {};
      for (const c of cands) {
        const v = coach && (coach.verdicts || []).find(x => x.i === c.i);
        const suspect = c.st === 'ok', fallback = c.st === 'missing' ? 'missing' : c.st === 'wrong' ? 'wrong' : 'pron';
        if (v && !v.real) continue;
        if (suspect && !v && (L.passPron || !(c.conf || c.z > 3.5))) continue;
        const type = v ? ({ wrong: 'wrong', missing: 'missing', pronunciation: 'pron' }[v.type] || fallback) : fallback;
        marks[c.i] = { type, conf: c.conf, heard: c.heard, issue: v?.issue || (type === 'missing' ? 'This word was not heard.' : type === 'wrong' ? 'This sounded like a different word.' : 'Pronunciation looks slightly off.'), tip: v?.tip || '' };
      }
      (coach?.tajweed_watch || []).forEach(x => { if (Number.isInteger(x.i) && x.i >= 0 && x.i < m && !marks[x.i]) marks[x.i] = { type: 'taj', heard: null, issue: x.rule || 'Tajweed reminder', tip: x.tip || '' }; });
      const errors = Object.values(marks).filter(x => x.type !== 'taj' && !(L.passPron && x.type === 'pron')).length, incomplete = missing / m > .35;
      // Word credit: clean = 1, pronunciation slip = half, wrong or missing = 0
      const credit = W.reduce((a, _, i) => { const k = marks[i]; return a + (!k || k.type === 'taj' ? 1 : k.type === 'pron' ? L.pron : 0); }, 0);
      const score = Math.max(0, Math.min(errors ? 99 : 100, Math.round(100 * credit / m)));
      const per = {}; W.forEach((x, i) => { const k = marks[i], c = !k || k.type === 'taj' ? 1 : k.type === 'pron' ? .5 : 0; (per[x.a] = per[x.a] || { s: 0, n: 0 }); per[x.a].s += c; per[x.a].n++; });
      const clips = info.map(x => (x.j >= 0 && Ht[x.j]) || null);
      const timed = Ht.filter(Boolean), span = timed.length > 3 ? timed[timed.length - 1].e - timed[0].s : 0, wps = span > 2 ? H.length / span : 0;
      const pace = wps > 3.6 ? 'fast' : wps && wps < .7 ? 'slow' : '';
      result = Object.assign(r0, { clips, base: ac.base, credit, m, extras, pace, marks, errors, score, per, pass: score >= 95 && !incomplete, adj: score, moveOn: score >= 70 && !incomplete, incomplete, summary: coach?.summary || '', strengths: coach?.strengths || '', hasCoach: !!coach  });
      showResult();
    } catch (e) {
      ov.innerHTML = `${top('Could not check')}<div class="ov-body"><div class="working">${ic('info', 36)}<h3>${esc(e.message || 'Something went wrong')}</h3></div></div><footer class="ov-foot"><button class="btn primary big" data-k="retry">Try again</button></footer>`;
    }
  }
  // Extra credit: re-reciting a flagged word correctly earns back part of its credit. It can lift a result to a pass (70%),
  // never to mastery: mastery (95%+) always comes from the score of the whole recitation.
  function adjust() {
    const r = result; const fx = Object.keys(r.fixed).filter(i => r.fixed[i]); if (!fx.length) { r.adj = r.score; r.ec = 0; return; }
    const L = lenOf(); let extra = 0;
    fx.forEach(i => { const k = r.marks[i]; if (!k) return; const have = k.type === 'pron' ? L.pron : 0; extra += .75 * (1 - have); });
    r.adj = Math.min(94, Math.max(r.score, Math.round(100 * (r.credit + extra) / r.m))); r.ec = r.adj - r.score;
    r.moveOn = !r.incomplete && r.adj >= 70;
  }
  function payMove() {
    const r = result; if (r.paidMove || !r.moveOn || r.incomplete || (range.mastery && r.pass)) return;
    r.paidMove = true; const g = { xp: Math.max(0, 15 + Math.round(r.adj / 10) - (r.gain ? r.gain.xp : 0)), coins: 5 }; r.gain = { xp: (r.gain ? r.gain.xp : 0) + g.xp, coins: (r.gain ? r.gain.coins : 0) + 5 };
    rec.best = Math.max(rec.best || 0, r.adj); reward(g);
  }
  function showResult() {
    const r = result; let gain = null, mastered = false;
    day().recites++; r.mem = remember(surah.n, W, r.marks, lenOf(), r.incomplete); r.mem.cleared = r.mem.fixed.filter(i => !(S.weak || {})[wkey(surah.n, W[i].a, W[i].pos)]);
    S.recites.unshift({ at: Date.now(), n: surah.n, name: surah.en, from: range.from, to: range.to, score: r.score, errors: r.errors, mastery: range.mastery });
    S.recites = S.recites.slice(0, 60);
    if (range.mastery && r.pass) {
      const k = parts.findIndex(p => p[0] === range.from);
      gain = { xp: 100 + (hard ? 50 : 0), coins: 30 }; if (k >= 0) rec.parts[k] = { score: r.score, at: Date.now(), hard }; rec.best = Math.max(rec.best || 0, r.score);
      if (parts.every((_, j) => rec.parts[j]) && !rec.mastered) { rec.mastered = true; rec.masteredAt = Date.now(); gain.xp += 300; gain.coins += 100; mastered = true; }
    } else if (!r.incomplete) { gain = r.moveOn ? { xp: 15 + Math.round(r.score / 10), coins: 5 } : { xp: 5, coins: 0 }; if (r.moveOn) { rec.best = Math.max(rec.best || 0, r.score); r.paidMove = true; } }
    r.gain = gain; r.mastered = mastered;
    if (gain) { reward(gain); } else save();
    feel(r.pass ? 'done' : r.moveOn ? 'right' : 'bad', r.pass ? 'done' : r.moveOn ? 'right' : 'bad');
    renderResult();
  }
  function renderResult(keep) {
    const r = result, [grade, tone] = gradeOf(r.adj), gain = r.gain, mastered = r.mastered, body0 = $('.ov-body', ov), y0 = keep && body0 ? body0.scrollTop : 0;
    const list = Object.entries(r.marks).sort((a, b) => a[0] - b[0]);
    const circ = 2 * Math.PI * 54, sorted = Object.entries(r.per).sort((a, b) => a[0] - b[0]);
    ov.innerHTML = `${top('Your result')}<div class="ov-body">
      <section class="card rsum"><div class="grade ${tone}"><svg viewBox="0 0 128 128" class="gring"><circle cx="64" cy="64" r="54" class="gb"/><circle cx="64" cy="64" r="54" class="gf" stroke-dasharray="${circ}" stroke-dashoffset="${circ}" transform="rotate(-90 64 64)" data-to="${circ * (1 - r.adj / 100)}"/></svg><div class="gt"><b>${r.adj}%</b></div></div>
        <div class="rs-info"><b class="rs-title">${r.incomplete ? 'Incomplete' : mastered ? esc(surah.en) + ' mastered' : grade}</b><p class="muted">${r.incomplete ? 'It sounds like you stopped early or skipped a lot. Recite the whole range and try again.' : r.pass ? (range.mastery ? 'Part passed.' : 'Clean recitation.') : r.moveOn ? (range.mastery ? 'Passed, but mastery needs 95% or higher.' : 'Passed. Reach 95% or higher for mastery.') : 'Below 70%. Listen once more and try again.'}</p></div></section>
      ${(() => { const L = [], m = r.mem, tp = Object.entries(tipLog).sort((a, b) => b[1] - a[1])[0];
        if (r.ec) L.push(`Extra credit +${r.ec}% for words you re-recited (${r.score}% on the full recitation). It counts toward passing only.`);
        if (m && (m.fixed.length || m.still.length)) { const f = m.fixed.length, st = m.still.length; L.push(`${f ? `<b>Progress:</b> ${f} word${f > 1 ? 's' : ''} you missed before ${f > 1 ? 'were' : 'was'} clean${m.cleared.length ? ` (${m.cleared.length} cleared from your watch list)` : ''}. ` : ''}${st ? `${st} still need${st > 1 ? '' : 's'} work: <span class="ar">${m.still.slice(0, 6).map(i => esc(W[i].w)).join(' · ')}</span>` : ''}`); }
        if (tp && tp[1] >= 2) L.push(`Live tip you got most: <b>${esc(tp[0])}</b>`);
        if (r.pace) L.push(r.pace === 'fast' ? 'You were reciting quickly. Slow down so every letter lands.' : 'Your pace was very slow. Try a smoother, steadier flow.');
        if (r.extras >= 3 && r.extras / r.hn > .08) L.push('Some extra words were heard (repeats or additions). Recite only what is written.');
        return L.length ? `<ul class="card ins">${L.map(x => `<li>${x}</li>`).join('')}</ul>` : ''; })()}
      ${r.summary ? `<p class="coach-note">${ic('message', 18)}<span>${esc(r.summary)}${r.strengths ? `<br><span class="muted">${esc(r.strengths)}</span>` : ''}</span></p>` : ''}
      ${sorted.length > 1 ? `<details class="card byayah"><summary><h3>By ayah</h3>${ic('chevD', 18, 'dim')}</summary><div class="abars">${sorted.map(([a, v]) => { const p = Math.round(v.s / v.n * 100); return `<div class="ab"><span>${a}</span><div class="progress thin ${p >= 95 ? 'good' : p >= 70 ? 'mid' : 'low'}"><i style="width:${p}%"></i></div><b>${p}%</b></div>`; }).join('')}</div></details>` : ''}
      <div class="legend"><span class="w wrong">wrong</span><span class="w missing">missing</span><span class="w pron">pronunciation</span><span class="w taj">tajweed reminder</span></div>
      <div class="rtext ar" dir="rtl" id="rtext">${textHTML(r.marks)}</div><p class="muted center small">Tap any word to hear yourself, then the correct recitation. You can re-recite a flagged word for extra credit toward passing.</p>
      ${list.length ? `<h3>Things to work on</h3><div class="issues">${list.map(([i, m]) => `<div class="issue-row"><button class="issue ${r.fixed[i] ? 'fixed' : m.type}" data-k="word" data-i="${i}"><span class="ar">${esc(W[i].w)}</span><div><b>${r.fixed[i] ? 'Corrected' : LAB[m.type]}</b><small>${r.fixed[i] ? 'You re-recited this word correctly. Extra credit earned.' : esc(m.issue)}</small></div></button><button class="icon-btn hear" data-k="hear" data-i="${i}" aria-label="Hear yours, then the correct recitation">${ic('volume', 18)}</button></div>`).join('')}</div>` : '<p class="muted center">Nothing to fix. Beautiful.</p>'}
      ${!r.hasCoach ? `<p class="muted center small">The tajweed coach was unavailable, so only word checks ran.</p>` : ''}
      </div>
      <footer class="ov-foot"><div class="col-gap"><div class="row-gap"><button class="btn grow" data-k="replay" id="rp">${rpHTML()}</button><button class="btn grow" data-k="nur">${ic('message', 16)} Ask Nur</button></div><div class="row-gap"><button class="btn grow" data-k="retry">${ic('repeat', 16)} Try again</button><button class="btn primary grow" data-k="close">Done</button></div></div></footer>`;
    preload();
    const nb = $('.ov-body', ov); if (nb && y0) nb.scrollTop = y0;
    requestAnimationFrame(() => requestAnimationFrame(() => { const f = $('.gf', ov); if (f) f.setAttribute('stroke-dashoffset', f.dataset.to); }));
  }
  // ---- Whole-recording replay: pause keeps your place, play resumes from it ----
  const rpHTML = () => replay && !replay.paused ? `${ic('pause', 16)} Pause` : replay && replay.currentTime > .1 ? `${ic('play', 16)} Resume` : `${ic('play', 16)} My recording`;
  const rpSync = () => { const b = $('#rp', ov); if (b) b.innerHTML = rpHTML(); };
  function toggleReplay() {
    stopWord();
    if (!replay) { replay = new Audio(blobUrl); replay.playsInline = true; replay.onended = () => { replay.currentTime = 0; rpSync(); }; replay.onpause = rpSync; replay.onplay = rpSync; }
    if (replay.paused) { stopAllAudio(); replay.play().catch(() => toast('Could not play your recording', 'mic')); } else replay.pause();
    rpSync();
  }
  // ---- Word playback: your own voice for that word, then the correct pronunciation ----
  // Phones only allow sound that starts from a tap, so everything is unlocked synchronously in the tap handler
  // and then played through one AudioContext (reference audio is fetched and decoded; an <audio> element is the fallback).
  const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  let refEl = null; const refBuf = new Map();
  const stopWord = () => { wtoken++;  try { wsrc && wsrc.stop(); } catch { /* already stopped */ } wsrc = null; if (refEl) { try { refEl.pause(); } catch { /* ignore */ } } };
  function unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { dctx = dctx || new AC(); if (dctx.state === 'suspended') dctx.resume().catch(() => {}); }
    if (!refEl) { refEl = new Audio(); refEl.preload = 'auto'; refEl.playsInline = true; }
    try { refEl.src = SILENT; refEl.play().catch(() => {}); } catch { /* ignore */ }
  }
  async function decoded() {
    if (dbuf) return dbuf; if (!dctx || !recBlob) return null;
    try { dbuf = await dctx.decodeAudioData(await recBlob.arrayBuffer()); } catch { dbuf = null; }
    return dbuf;
  }
  // ---- Precise cutting ----
  // Whisper's word timestamps drift by a few hundred ms and neighboring words touch each other, so a raw slice lets other
  // letters leak in. Every cut is snapped to the quietest point between neighbors, then trimmed to where the word really sounds.
  function envelope(buf) {
    const d = buf.getChannelData(0), hop = Math.max(1, Math.round(buf.sampleRate * .005)), n = Math.floor(d.length / hop), raw = new Float32Array(n);
    for (let k = 0; k < n; k++) { let a = 0; const o = k * hop; for (let t = 0; t < hop; t++) { const x = d[o + t]; a += x * x; } raw[k] = Math.sqrt(a / hop); }
    const v = new Float32Array(n); for (let k = 0; k < n; k++) { let a = 0, c = 0; for (let q = -2; q <= 2; q++) { const x = raw[k + q]; if (x !== undefined) { a += x; c++; } } v[k] = a / c; }
    const sorted = Float32Array.from(v).sort(); return { dt: hop / buf.sampleRate, v, floor: sorted[Math.floor(n * .1)] || 0, peak: sorted[Math.floor(n * .95)] || 0, n };
  }
  const idx = (e, t) => Math.max(0, Math.min(e.n - 1, Math.round(t / e.dt)));
  function valley(e, t0, t1) { // quietest moment between t0 and t1 (centered when the signal is flat)
    let a = idx(e, Math.min(t0, t1)), b = idx(e, Math.max(t0, t1)), best = a, bv = Infinity;
    for (let k = a; k <= b; k++) { const pen = Math.abs(k - (a + b) / 2) * 1e-6; if (e.v[k] + pen < bv) { bv = e.v[k] + pen; best = k; } }
    return best * e.dt;
  }
  function trim(e, lo, hi) { // pull both edges in to where the word actually sounds
    const a = idx(e, lo), b = idx(e, hi); let pk = 0; for (let k = a; k <= b; k++) pk = Math.max(pk, e.v[k]);
    const thr = Math.max(e.floor * 1.8, pk * .12); let x = a, y = b; while (x < b && e.v[x] < thr) x++; while (y > x && e.v[y] < thr) y--;
    const s = Math.max(lo, (x - 3) * e.dt), t = Math.min(hi, (y + 6) * e.dt); return t - s >= .2 ? [s, t] : [lo, hi];
  }
  // With no timestamps from the speech model, spread the heard words over the voiced part of the recording by letter count, then snap each edge to a pause.
  function pseudoTimes(e, dur, r) {
    const n = r.hn, thr = Math.max(e.floor * 2, e.peak * .1); let a = 0, b = e.n - 1; while (a < b && e.v[a] < thr) a++; while (b > a && e.v[b] < thr) b--;
    const t0 = a * e.dt, t1 = Math.min(dur, (b + 1) * e.dt), tot = r.hl.reduce((x, y) => x + y, 0) || n, cuts = [t0]; let acc = 0;
    for (let j = 0; j < n - 1; j++) { acc += r.hl[j]; const c = t0 + (t1 - t0) * acc / tot; cuts.push(Math.max(cuts[cuts.length - 1] + .05, valley(e, c - .18, c + .18))); }
    cuts.push(t1); r.ht = r.hl.map((_, j) => ({ s: cuts[j], e: cuts[j + 1], est: true })); r.noTs = false;
  }
  const clipFor = (i, dur, r = result) => {
    const j = r.hidx[i]; if (j == null || j < 0) return null; if (!env) return null;
    if (r.noTs && !r.ht.every(Boolean)) pseudoTimes(env, dur, r);
    const jh = r.hhi[i] ?? j, A = r.ht[j], B = r.ht[jh]; if (!A || !B) return null;
    let s = A.s, e = B.e; const prev = r.ht[j - 1], next = r.ht[jh + 1], sp = r.sp && r.sp[i];
    let lo = s - .1, hi = e + .1;
    if (prev) lo = prev.e > s - .3 ? valley(env, Math.min(prev.e, s) - .1, Math.max(prev.e, s) + .1) : s - .1;
    if (next) hi = next.s < e + .3 ? valley(env, Math.min(e, next.s) - .1, Math.max(e, next.s) + .1) : e + .1;
    if (sp) { const mid = valley(env, s + (e - s) * sp.f - .12, s + (e - s) * sp.f + .12); if (sp.k === 0) hi = mid; else lo = mid; } // two words heard as one: cut between them
    lo = Math.max(0, Math.min(lo, s)); hi = Math.min(dur, Math.max(hi, e)); if (sp) { lo = Math.max(0, lo); }
    const [ts, te] = trim(env, Math.max(0, lo), hi); return { s: Math.max(0, ts - .015), e: Math.min(dur, te + .02) };
  };
  // ---- Comparing how words sound ----
  const trimPcm = x => { let pk = 0; for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i])); const thr = pk * .06; let a = 0, b = x.length - 1; while (a < b && Math.abs(x[a]) < thr) a++; while (b > a && Math.abs(x[b]) < thr) b--; return x.subarray(Math.max(0, a - 320), Math.min(x.length, b + 480)); };
  async function refFeat(i) { const url = await refUrl(i, true).catch(() => ''); if (!url) return null; const rb = await refBuffer(url); return rb ? mfcc(trimPcm(await to16k(rb))) : null; }
  async function acousticCheck(info, E, r0) {
    const out = { z: {}, base: null };
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!dctx && AC) dctx = new AC(); const buf = await decoded(); if (!buf) return out; env = env || envelope(buf);
      const pickN = (a, n) => a.length <= n ? a : Array.from({ length: n }, (_, k) => a[Math.floor(k * a.length / n)]);
      const base = pickN(info.filter(x => x.st === 'ok' && x.s === 1 && x.j >= 0 && E[x.i].length >= 3), 10), targ = pickN(info.filter(x => x.j >= 0 && (x.st !== 'ok' || x.conf || x.s < 1)), 30), dl = Date.now() + 9000, dist = {};
      const run = async list => { for (let k = 0; k < list.length && Date.now() < dl; k += 4) await Promise.all(list.slice(k, k + 4).map(async x => { try { const c = clipFor(x.i, buf.duration, r0); if (!c || c.e - c.s < .2) return; const rf = await refFeat(x.i); if (!rf) return; const d = dtw(mfcc(trimPcm(await to16k(buf, c.s, c.e))), rf); if (isFinite(d)) dist[x.i] = d; } catch { /* skip this word */ } })); };
      await run(base); await run(targ.filter(x => !(x.i in dist)));
      const bd = base.map(x => dist[x.i]).filter(v => v != null); if (bd.length < 6) return out;
      const med = median(bd), mad = median(bd.map(v => Math.abs(v - med))), sc = Math.max(1.4826 * mad, .15 * med, 1e-3);
      out.base = { med, sc, n: bd.length }; targ.forEach(x => { if (dist[x.i] != null) out.z[x.i] = (dist[x.i] - med) / sc; });
    } catch { /* the sound check is a bonus */ }
    return out;
  }
  // Ask the speech model to find the word inside a short slice of your recording, so the replay is cut exactly around it.
  function refineClip(i) {
    const r = result; if (!r.rp[i]) r.rp[i] = (async () => {
      const buf = await decoded(); if (!buf) return null; if (!env) env = envelope(buf); const c = clipFor(i, buf.duration); if (!c) return null;
      const s0 = Math.max(0, c.s - .4), e0 = Math.min(buf.duration, c.e + .4); let pcm = await to16k(buf, s0, e0), pk = 0; for (let k = 0; k < pcm.length; k++) pk = Math.max(pk, Math.abs(pcm[k])); if (pk > .002) { const g = Math.min(20, .9 / pk); pcm = pcm.map(v => v * g); }
      const fd = new FormData(); fd.append('audio', wavOf(pcm), 'w.wav'); fd.append('model', 'whisper-large-v3');
      const t = await api('transcribe?x=1', 'POST', fd), want = nrm(W[i].w), hn = r.marks[i] && r.marks[i].heard ? nrm(r.marks[i].heard) : '';
      let best = null; (t.words || []).forEach(w => { const n = nrm(String(w.w || '').replace(/[^؀-ۿ]/g, '')); if (!n) return; const sc = Math.max(sim(want, n), hn ? sim(hn, n) : 0); if (!best || sc > best.sc) best = { sc, s: w.s, e: w.e }; });
      if (!best || best.sc < .6) return null; const rs = Math.max(0, s0 + best.s - .03), re2 = Math.min(buf.duration, s0 + best.e + .05); return re2 - rs >= .15 && re2 - rs <= 3 ? { s: rs, e: re2 } : null;
    })().catch(() => null); return r.rp[i];
  }
  const hasMine = i => result.hidx[i] != null && result.hidx[i] >= 0;
  const playMine = async i => {
    const buf = await decoded(); if (!buf) return false; if (!env) env = envelope(buf); let c = null; try { c = await Promise.race([refineClip(i), new Promise(r => setTimeout(() => r(null), 4500))]); } catch { /* use the sound-based cut */ } c = c || clipFor(i, buf.duration); if (!c) return false;
    const my = wtoken, len = Math.max(.2, c.e - c.s);
    return new Promise(res => {
      const src = dctx.createBufferSource(), g = dctx.createGain(), t = dctx.currentTime; src.buffer = buf; src.connect(g); g.connect(dctx.destination); wsrc = src;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .012); g.gain.setValueAtTime(1, t + Math.max(.012, len - .03)); g.gain.linearRampToValueAtTime(0, t + len);
      src.onended = () => res(my === wtoken); src.start(0, c.s, len);
    });
  };
  async function refUrl(i, wordOnly = false) {
    const x = W[i]; const idx = W.slice(0, i).filter(y => y.a === x.a).length, n = W.filter(y => y.a === x.a).length;
    let ws = null; try { ws = await getWords(surah.n, x.a); } catch { /* offline */ }
    if (ws && ws.length === n && ws[idx] && ws[idx].au) return ws[idx].au;
    if (wordOnly) return ''; const g = ayahs.find(a => a.n === x.a)?.g; return g ? audioUrl(g) : '';
  }
  async function refBuffer(url) {
    if (refBuf.has(url)) return refBuf.get(url);
    try { const r = await fetch(url); if (!r.ok) throw 0; const b = await dctx.decodeAudioData(await r.arrayBuffer()); refBuf.set(url, b); return b; } catch { return null; }
  }
  const playRef = async i => {
    const my = wtoken; let url = ''; try { url = await refUrl(i); } catch { /* none */ } if (!url || my !== wtoken) return false;
    const buf = dctx ? await refBuffer(url) : null; if (my !== wtoken) return false;
    if (buf) return new Promise(res => { const src = dctx.createBufferSource(); src.buffer = buf; src.connect(dctx.destination); wsrc = src; src.onended = () => res(my === wtoken); src.start(0); });
    if (!refEl) return false;
    return new Promise(res => { refEl.onended = () => res(my === wtoken); refEl.onerror = () => res(false); refEl.src = url; refEl.playbackRate = 1; refEl.play().catch(() => res(false)); });
  };
  async function hear(i, which, ui) {
    stopWord(); stopAllAudio(); if (replay && !replay.paused) replay.pause(); const my = wtoken;
    const set = (t, on) => { if (!ui) return; ui.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === on)); const st = ui.querySelector('.pst'); if (st) st.textContent = t; };
    let ok = true;
    if (which !== 'ref') { set('Your recitation', which === 'both' ? 'both' : 'mine'); ok = await playMine(i); if (my !== wtoken) return; if (!ok) { set('', ''); toast(hasMine(i) ? 'Could not play your recording' : 'Your recording of this word was not captured', 'mic'); if (which === 'mine') return; } }
    if (which !== 'mine') {
      set('Correct pronunciation', which === 'both' ? 'both' : 'ref'); if (which === 'both' && ok) await new Promise(r => setTimeout(r, 250)); if (my !== wtoken) return;
      const done = await playRef(i); if (my !== wtoken) return; if (!done) toast('Could not load the correct audio. Check your connection.', 'volumeOff');
    }
    set('', '');
  }
  // Warm the cache so the correct audio starts instantly
  function preload() { if (!dctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) dctx = new AC(); } Object.keys(result.marks).slice(0, 8).forEach(async i => { try { const u = await refUrl(+i); if (u) refBuffer(u); } catch { /* ignore */ } }); (async () => { for (const i of Object.keys(result.marks).filter(k => result.marks[k].type !== 'taj').slice(0, 6)) { if (!result) return; await refineClip(+i); } })(); }
  // ---- Re-recite one flagged word (extra credit toward passing) ----
  let fixing = false;
  async function fixWord(i, el) {
    if (fixing) return; const st = el.querySelector('.fst'), btn = el.querySelector('[data-fix]'), say = t => { if (st) st.textContent = t; };
    let fs; try { fs = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { toast('Microphone permission is needed', 'mic'); return; }
    fixing = true; btn.disabled = true; btn.innerHTML = `${ic('mic', 16)} Listening… say the word`; say('Say just this word, then pause.');
    const mt = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '', chunks = [], rc = new MediaRecorder(fs, mt ? { mimeType: mt } : {});
    rc.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => { rc.onstop = r; }); rc.start();
    let ac = null, timer = 0;
    const stop = () => { clearInterval(timer); if (rc.state !== 'inactive') rc.stop(); };
    try { // stop on its own once you have spoken and gone quiet
      const C = window.AudioContext || window.webkitAudioContext; ac = new C(); const an = ac.createAnalyser(); an.fftSize = 1024; ac.createMediaStreamSource(fs).connect(an); const d = new Uint8Array(an.fftSize); let spoke = 0, quiet = 0, t0 = performance.now(), base = 0, n = 0;
      timer = setInterval(() => { an.getByteTimeDomainData(d); let a = 0; for (let k = 0; k < d.length; k++) { const x = (d[k] - 128) / 128; a += x * x; } const v = Math.sqrt(a / d.length), el2 = performance.now() - t0;
        if (el2 < 400) { base = (base * n + v) / ++n; return; } if (v > Math.max(.03, base * 2.5)) { spoke++; quiet = 0; } else if (spoke > 3) quiet++;
        if ((spoke > 3 && quiet > 14) || el2 > 6000) stop(); }, 50);
    } catch { setTimeout(stop, 3000); }
    btn.onclick = stop; btn.disabled = false; btn.innerHTML = `${ic('stop', 16)} Done`;
    await done; fs.getTracks().forEach(t => t.stop()); try { ac && ac.close(); } catch { /* ignore */ }
    btn.disabled = true; btn.innerHTML = `${ic('mic', 16)} Checking…`; say('');
    try {
      const blob = new Blob(chunks, { type: rc.mimeType || mt || 'audio/webm' }), up = await prepare(blob), fd = new FormData(); fd.append('audio', up, 'w.' + (/wav/.test(up.type) ? 'wav' : /mp4|m4a/.test(up.type) ? 'm4a' : 'webm')); fd.append('model', 'whisper-large-v3');
      const t = await api('transcribe?x=1', 'POST', fd), L = lenOf(), want = nrm(W[i].w);
      const toks = (t.text || '').replace(/[^؀-ۿ\s]/g, ' ').split(/\s+/).map(nrm).filter(Boolean);
      let best = 0, heard = toks.join(' '); toks.forEach((x, k) => { best = Math.max(best, sim(want, x)); if (toks[k + 1]) best = Math.max(best, sim(want, x + toks[k + 1])); });
      const need = result.marks[i].conf ? 1 : Math.max(L.ok, .85);
      let off = false; // the sound must also match the reference as well as your own correct words did
      if (best >= need && result.base) { try { const AC = window.AudioContext || window.webkitAudioContext; if (!dctx && AC) dctx = new AC(); const nb = await dctx.decodeAudioData(await blob.arrayBuffer()), rf = await refFeat(i); if (rf) { const d = dtw(mfcc(trimPcm(await to16k(nb))), rf); off = isFinite(d) && (d - result.base.med) / result.base.sc > 3.5; } } catch { /* skip the sound check */ } }
      if (best >= need && !off) {
        result.fixed[i] = true; adjust(); const was = result.moveOn; payMove(); feel('right', 'right'); toast(result.ec ? `Corrected. Extra credit +${result.ec}%` : 'Corrected', 'check'); closeSheet(); renderResult(true); void was;
      } else { feel('bad', 'bad'); say(off ? 'Close, but it sounded a little different. Listen to the correct one and try again.' : heard ? `Heard "${heard}". Listen to the correct one and try again.` : 'Nothing was heard. Try again a little louder.'); btn.disabled = false; btn.innerHTML = `${ic('mic', 16)} Try again`; btn.onclick = null; }
    } catch (e) { say(e.message || 'Could not check that. Try again.'); btn.disabled = false; btn.innerHTML = `${ic('mic', 16)} Try again`; btn.onclick = null; }
    fixing = false;
  }
  const wordInfo = i => {
    const m = result.marks[i] || { type: 'ok' }, good = m.type === 'ok', canFix = !good && m.type !== 'taj' && !result.fixed[i] && !result.incomplete;
    const el = sheet(`<div class="ar big center" dir="rtl">${esc(W[i].w)}</div><h3 class="center">${good ? 'Sounded good' : LAB[m.type]}</h3>
      <div class="wplay"><button class="btn" data-p="mine" ${hasMine(i) ? '' : 'disabled'}>${ic('mic', 16)} You</button><button class="btn" data-p="ref">${ic('volume', 16)} Correct</button><button class="btn primary" data-p="both">${ic('play', 16)} Hear both</button></div><p class="muted center small pst" aria-live="polite"></p>
      ${canFix ? `<button class="btn gold-b" data-fix="1">${ic('mic', 16)} Say it correctly for extra credit</button><p class="muted center small fst" aria-live="polite">Extra credit counts toward passing only. Mastery needs a clean full recitation.</p>` : result.fixed[i] ? `<p class="ok-t center"><b>Corrected.</b> Extra credit earned.</p>` : ''}
      ${m.heard ? `<p><b>I heard:</b> <span class="ar">${esc(m.heard)}</span></p>` : ''}${m.issue ? `<p>${esc(m.issue)}</p>` : ''}${m.tip ? `<p class="muted">${esc(m.tip)}</p>` : ''}<button class="btn" data-c="1">Close</button>`);
    el.addEventListener('click', e => { if (e.target.closest('[data-fix]')) { stopWord(); return fixWord(i, el); } const p = e.target.closest('[data-p]'); if (p && !p.disabled) { unlock(); return hear(i, p.dataset.p, el); } if (e.target.closest('[data-c]')) { stopWord(); closeSheet(); } });
    if (!good && m.type !== 'taj') { unlock(); hear(i, hasMine(i) ? 'both' : 'ref', el); }
  };

  ov.addEventListener('click', e => {
    const t = e.target.closest('[data-k]'), w = e.target.closest('.w[data-i]');
    if (!t && w && result && !w.classList.contains('aend')) return wordInfo(+w.dataset.i);
    if (!t) return; const k = t.dataset.k;
    if (k === 'close') { stopWord(); close(); }
    else if (k === 'dn' || k === 'up') clampRange(t.dataset.f, k === 'up' ? 1 : -1);
    else if (k === 'go') { range.mastery = false; ready(); }
    else if (k === 'part') { const p = parts[+t.dataset.n]; range = { from: p[0], to: p[1], mastery: true }; ready(); }
    else if (k === 'rec') startRec();
    else if (k === 'stop') stopRec();
    else if (k === 'retry') ready();
    else if (k === 'word') { unlock(); wordInfo(+t.dataset.i); }
    else if (k === 'hear') { unlock(); hear(+t.dataset.i, hasMine(+t.dataset.i) ? 'both' : 'ref', null); }
    else if (k === 'replay') toggleReplay();
    else if (k === 'nur') {
      const bad = Object.entries(result.marks).filter(([, m]) => m.type !== 'taj').slice(0, 6).map(([i, m]) => `${W[i].w} (${LAB[m.type].toLowerCase()}: ${m.issue})`).join('; ');
      openNur({ ask: `I just recited ${surah.en} ayahs ${range.from} to ${range.to} and scored ${result.score}%.${bad ? ' Issues: ' + bad + '.' : ' No mistakes found.'} What should I work on?`, extra: `Recitation result for ${surah.en} ${range.from}-${range.to}: ${result.score}%` });
    }
  });
  ov.addEventListener('change', e => { if (e.target.id === 'hard') hard = e.target.checked; });

  if (opts.from) { range = { from: opts.from, to: Math.min(opts.to || opts.from, opts.from + MAX - 1), mastery: !!opts.mastery }; if (range.mastery) { const p = parts.find(x => x[0] === range.from); if (p) range.to = p[1]; } ready(); } else picker();
}

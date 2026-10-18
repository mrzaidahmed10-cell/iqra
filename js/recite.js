// Recitation grading: record, transcribe (Groq Whisper), align with the mushaf, review tajweed (Groq), show a graded result.
// Practice mode grades any range. Mastery mode records a pass toward mastering the surah.
import { S, $, $$, esc, toAr, api, Auth, nrm, wordsOf, sr, day, save, reward, sheet, closeSheet, toast, feel, sfx, haptic, stopAllAudio } from './core.js';
import { ic } from './icons.js';
import { openNur } from './nur.js';

const CHUNK = 20, MAX = 30;
const partsOf = count => { if (count <= MAX) return [[1, count]]; const p = []; for (let s = 1; s <= count; s += CHUNK) p.push([s, Math.min(count, s + CHUNK - 1)]); return p; };
function lev(a, b) {
  if (a === b) return 0; let p = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[b.length];
}
const sim = (a, b) => { if (a === b) return 1; const L = Math.max(a.length, b.length); return !L || Math.abs(a.length - b.length) > 3 ? 0 : 1 - lev(a, b) / L; };
function align(E, H) {
  const m = E.length, n = H.length, GAP = -.7, sc = (a, b) => { const s = sim(a, b); return s >= .75 ? 1 : s >= .5 ? .2 : -1; };
  const dp = Array.from({ length: m + 1 }, () => new Float32Array(n + 1)), bt = Array.from({ length: m + 1 }, () => new Uint8Array(n + 1));
  for (let i = 1; i <= m; i++) dp[i][0] = i * GAP; for (let j = 1; j <= n; j++) dp[0][j] = j * GAP;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const d = dp[i - 1][j - 1] + sc(E[i - 1], H[j - 1]), u = dp[i - 1][j] + GAP, l = dp[i][j - 1] + GAP;
    if (d >= u && d >= l) { dp[i][j] = d; bt[i][j] = 0; } else if (u >= l) { dp[i][j] = u; bt[i][j] = 1; } else { dp[i][j] = l; bt[i][j] = 2; }
  }
  const res = new Array(m).fill(-1); let i = m, j = n;
  while (i > 0 || j > 0) { const b = i === 0 ? 2 : j === 0 ? 1 : bt[i][j]; if (b === 0) { res[i - 1] = j - 1; i--; j--; } else if (b === 1) i--; else j--; }
  return res;
}
export const gradeOf = s => s >= 98 ? ['Flawless', 'good'] : s >= 90 ? ['Excellent', 'good'] : s >= 80 ? ['Very good', 'good'] : s >= 65 ? ['Good progress', 'mid'] : ['Keep practising', 'low'];
const LAB = { wrong: 'Wrong word', missing: 'Missing word', pron: 'Pronunciation', taj: 'Tajweed reminder' };

/** opts: {from, to, mastery}. Without a range, a picker is shown. */
export function openRecite(surah, ayahs, opts = {}) {
  const rec = sr(surah.n), parts = partsOf(surah.count);
  stopAllAudio();
  const ov = document.createElement('div'); ov.className = 'recite'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Recite ' + surah.en);
  document.body.append(ov); document.body.classList.add('noscroll', 'studying'); requestAnimationFrame(() => ov.classList.add('in'));
  let mr = null, stream = null, tick = null, actx = null, raf = 0, W = [], hard = false, result = null, range = { from: 1, to: Math.min(surah.count, MAX), mastery: false }, blobUrl = '', replay = null;
  const cleanup = () => { clearInterval(tick); cancelAnimationFrame(raf); try { if (mr && mr.state !== 'inactive') { mr.onstop = null; mr.stop(); } } catch { /* ignore */ } if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; mr = null; try { actx && actx.close(); } catch { /* ignore */ } actx = null; if (replay) { replay.pause(); replay = null; } };
  const close = () => { cleanup(); if (blobUrl) URL.revokeObjectURL(blobUrl); ov.classList.remove('in'); setTimeout(() => ov.remove(), 280); if (!$('.lesson,.nur')) document.body.classList.remove('studying'); if (!$('.lesson,.game,.nur')) document.body.classList.remove('noscroll'); window.dispatchEvent(new Event('iqra-refresh')); };
  const top = t => `<header class="ov-top"><button class="icon-btn" data-k="close" aria-label="Close">${ic('x', 20)}</button><b>${esc(t)}</b><span></span></header>`;

  function picker() {
    cleanup(); const canMaster = rec.done && !rec.mastered;
    ov.innerHTML = `${top('Recite · ' + surah.en)}<div class="ov-body"><section class="card"><h3>Choose what to recite</h3><p class="muted">Recite from memory or from the text. The coach grades you and shows exactly what to fix. Up to ${MAX} ayahs at a time.</p>
      <div class="range"><label>From ayah<div class="step"><button data-k="dn" data-f="from" aria-label="Lower">${ic('minus', 16)}</button><b id="rf">${range.from}</b><button data-k="up" data-f="from" aria-label="Higher">${ic('plus', 16)}</button></div></label>
      <label>To ayah<div class="step"><button data-k="dn" data-f="to" aria-label="Lower">${ic('minus', 16)}</button><b id="rt">${range.to}</b><button data-k="up" data-f="to" aria-label="Higher">${ic('plus', 16)}</button></div></label></div>
      <button class="btn primary big" data-k="go">Practise this range</button></section>
      ${rec.done ? `<section class="card"><h3>Mastery</h3><p class="muted">${rec.mastered ? 'You have mastered this surah. Recite it again any time.' : 'Pass every part with no real mistakes to master this surah.'}</p><div class="opts col">${parts.map((p, k) => `<button class="opt" data-k="part" data-n="${k}"><span>${parts.length > 1 ? `Part ${k + 1} · ` : ''}ayahs ${p[0]} to ${p[1]}</span>${rec.parts[k] ? `<b class="ok-t">${rec.parts[k].score}%</b>` : ''}</button>`).join('')}</div></section>` : `<p class="muted center small">Learn the whole surah to unlock mastery. Practice grading works any time.</p>`}</div>`;
    void canMaster;
  }
  function clampRange(f, d) {
    let { from, to } = range; if (f === 'from') from = Math.max(1, Math.min(surah.count, from + d)); else to = Math.max(1, Math.min(surah.count, to + d));
    if (from > to) { if (f === 'from') to = from; else from = to; } if (to - from + 1 > MAX) { if (f === 'from') to = from + MAX - 1; else from = to - MAX + 1; }
    range.from = from; range.to = to; $('#rf', ov).textContent = from; $('#rt', ov).textContent = to; haptic('tick');
  }
  function ready() {
    cleanup(); result = null; const sel = ayahs.filter(a => a.n >= range.from && a.n <= range.to); W = [];
    sel.forEach(a => { const ws = wordsOf(a.ar); ws.forEach((w, i) => W.push({ w, a: a.n, last: i === ws.length - 1 })); });
    ov.innerHTML = `${top((range.mastery ? 'Mastery · ' : '') + surah.en)}<div class="ov-body"><p class="coach-note">${ic('mic', 18)}<span>Recite <b>ayah ${range.from}${range.to > range.from ? ' to ' + range.to : ''}</b> in one go, at a steady pace. ${range.mastery ? 'A perfect recitation counts toward mastery.' : 'You will get a grade and a list of things to fix.'}</span></p>
      <label class="switch-row"><span><b>Hide the text</b><small class="muted">Recite from memory${range.mastery ? ' (+50 XP)' : ''}</small></span><input type="checkbox" id="hard" ${hard ? 'checked' : ''}></label>
      <div class="rtext ar" id="rtext" dir="rtl">${textHTML()}</div></div>
      <footer class="ov-foot"><button class="btn primary big" data-k="rec">${ic('mic', 20)} Start recording</button></footer>`;
  }
  function textHTML(marks = {}) {
    let out = ''; W.forEach((x, i) => { const m = marks[i]; out += `<span class="w ${m ? m.type : ''}" data-i="${i}">${esc(x.w)}</span> `; if (x.last) out += `<span class="aend">﴿${toAr(x.a)}﴾</span> `; });
    return out;
  }
  async function startRec() {
    if (!Auth.groq) { const el = sheet(`<h3>The coach isn't connected yet</h3><p class="muted">Add your <b>GROQ_API_KEY</b> as a secret in Cloudflare Pages (Settings, Variables and Secrets) and redeploy. The README has the two-minute setup.</p><button class="btn primary" data-c="1">Got it</button>`); el.addEventListener('click', e => { if (e.target.closest('[data-c]')) closeSheet(); }); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { toast('Microphone permission is needed', 'mic'); return; }
    hard = $('#hard', ov)?.checked || false;
    const mt = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const chunks = []; mr = new MediaRecorder(stream, mt ? { mimeType: mt } : {});
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = () => { const type = mr.mimeType || mt || 'audio/webm'; stream.getTracks().forEach(t => t.stop()); analyze(new Blob(chunks, { type })); };
    mr.start(); let s = 0; feel('tap');
    $('#rtext', ov).classList.toggle('hidden-text', hard);
    $('.ov-foot', ov).innerHTML = `<div class="recbar"><div class="meter" id="meter"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><b id="rtm">0:00</b></div><button class="btn danger big" data-k="stop">${ic('stop', 18)} Stop and check</button>`;
    try { // live level meter
      const C = window.AudioContext || window.webkitAudioContext; actx = new C(); const an = actx.createAnalyser(); an.fftSize = 256; actx.createMediaStreamSource(stream).connect(an); const buf = new Uint8Array(an.frequencyBinCount), bars = $$('#meter i', ov);
      const loop = () => { an.getByteFrequencyData(buf); bars.forEach((b, i) => { const v = buf[2 + i * 5] / 255; b.style.transform = `scaleY(${.15 + v * .95})`; }); raf = requestAnimationFrame(loop); }; loop();
    } catch { /* meter is optional */ }
    tick = setInterval(() => { s++; const e = $('#rtm', ov); if (e) e.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (s >= 900) stopRec(); }, 1000);
  }
  function stopRec() { clearInterval(tick); cancelAnimationFrame(raf); if (mr && mr.state !== 'inactive') mr.stop(); }

  async function analyze(blob) {
    if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = URL.createObjectURL(blob);
    ov.innerHTML = `${top('Checking your recitation')}<div class="ov-body"><div class="working"><div class="spinner"></div><h3 id="ph">Listening to your recitation…</h3><p class="muted">This takes a few seconds.</p></div></div>`;
    try {
      const fd = new FormData(); fd.append('audio', blob, 'rec.' + (/mp4|m4a/.test(blob.type) ? 'm4a' : 'webm'));
      const t = await api('transcribe', 'POST', fd);
      const ph = $('#ph', ov); if (ph) ph.textContent = 'Comparing with the mushaf…';
      const raw = (t.text || '').replace(/[^؀-ۿ\s]/g, ' ').split(/\s+/).filter(Boolean); const H = [], Hr = [];
      raw.forEach(r => { const n = nrm(r); if (n) { H.push(n); Hr.push(r); } });
      if (H.length < 2) throw new Error("I couldn't hear a recitation. Check your microphone and try again.");
      const E = W.map(x => nrm(x.w)), al = align(E, H), m = W.length;
      const info = W.map((x, i) => { const j = al[i]; const s = j < 0 ? 0 : sim(E[i], H[j]); return { i, j, s, heard: j < 0 ? null : Hr[j], st: j < 0 ? 'missing' : s >= .8 ? 'ok' : s >= .5 ? 'close' : 'wrong' }; });
      const missing = info.filter(x => x.st === 'missing').length;
      const near = i => { let a = i - 1; while (a >= 0 && info[a].j < 0) a--; let b = i + 1; while (b < m && info[b].j < 0) b++; const lo = a >= 0 ? info[a].j + 1 : 0, hi = b < m ? info[b].j : H.length; return Hr.slice(lo, hi).slice(0, 4); };
      const cands = info.filter(x => x.st !== 'ok').slice(0, 120);
      let coach = null;
      if (missing / m <= .35) {
        const p2 = $('#ph', ov); if (p2) p2.textContent = 'Your coach is reviewing tajweed…';
        try { coach = await api('coach', 'POST', { surah: surah.en, transcript: t.text, words: m <= 250 ? W.map(x => x.w) : null, candidates: cands.map(c => ({ i: c.i, expected: W[c.i].w, heard: c.heard, near: c.heard ? null : near(c.i), sim: +c.s.toFixed(2) })) }); } catch { coach = null; }
      }
      const marks = {};
      for (const c of cands) {
        const v = coach && (coach.verdicts || []).find(x => x.i === c.i);
        const fallback = c.st === 'missing' ? 'missing' : c.st === 'wrong' ? 'wrong' : 'pron';
        if (v && !v.real) continue;
        const type = v ? ({ wrong: 'wrong', missing: 'missing', pronunciation: 'pron' }[v.type] || fallback) : fallback;
        marks[c.i] = { type, heard: c.heard, issue: v?.issue || (type === 'missing' ? 'This word was not heard.' : type === 'wrong' ? 'This sounded like a different word.' : 'Pronunciation looks slightly off.'), tip: v?.tip || '' };
      }
      (coach?.tajweed_watch || []).forEach(x => { if (Number.isInteger(x.i) && x.i >= 0 && x.i < m && !marks[x.i]) marks[x.i] = { type: 'taj', heard: null, issue: x.rule || 'Tajweed reminder', tip: x.tip || '' }; });
      const errors = Object.values(marks).filter(x => x.type !== 'taj').length, incomplete = missing / m > .35;
      // Word credit: clean = 1, pronunciation slip = half, wrong or missing = 0
      const credit = W.reduce((a, _, i) => { const k = marks[i]; return a + (!k || k.type === 'taj' ? 1 : k.type === 'pron' ? .5 : 0); }, 0);
      const score = Math.max(0, Math.min(errors ? 99 : 100, Math.round(100 * credit / m)));
      const per = {}; W.forEach((x, i) => { const k = marks[i], c = !k || k.type === 'taj' ? 1 : k.type === 'pron' ? .5 : 0; (per[x.a] = per[x.a] || { s: 0, n: 0 }); per[x.a].s += c; per[x.a].n++; });
      result = { marks, errors, score, per, pass: !errors && !incomplete, incomplete, summary: coach?.summary || '', strengths: coach?.strengths || '', hasCoach: !!coach };
      showResult();
    } catch (e) {
      ov.innerHTML = `${top('Could not check')}<div class="ov-body"><div class="working">${ic('info', 36)}<h3>${esc(e.message || 'Something went wrong')}</h3></div></div><footer class="ov-foot"><button class="btn primary big" data-k="retry">Try again</button></footer>`;
    }
  }
  function showResult() {
    const r = result, [grade, tone] = gradeOf(r.score); let gain = null, mastered = false;
    day().recites++;
    S.recites.unshift({ at: Date.now(), n: surah.n, name: surah.en, from: range.from, to: range.to, score: r.score, errors: r.errors, mastery: range.mastery });
    S.recites = S.recites.slice(0, 60);
    if (range.mastery && r.pass) {
      const k = parts.findIndex(p => p[0] === range.from);
      gain = { xp: 100 + (hard ? 50 : 0), coins: 30 }; if (k >= 0) rec.parts[k] = { score: r.score, at: Date.now(), hard }; rec.best = Math.max(rec.best || 0, r.score);
      if (parts.every((_, j) => rec.parts[j]) && !rec.mastered) { rec.mastered = true; rec.masteredAt = Date.now(); gain.xp += 300; gain.coins += 100; mastered = true; }
    } else if (!r.incomplete) gain = { xp: 15 + Math.round(r.score / 10), coins: 5 };
    if (gain) { reward(gain); } else save();
    feel(r.pass || r.score >= 80 ? 'done' : 'bad', r.pass ? 'done' : 'tap'); if (!r.pass && r.score >= 80) sfx('ok');
    const list = Object.entries(r.marks).sort((a, b) => a[0] - b[0]);
    const circ = 2 * Math.PI * 54, sorted = Object.entries(r.per).sort((a, b) => a[0] - b[0]);
    ov.innerHTML = `${top('Your result')}<div class="ov-body">
      <div class="grade ${tone}"><svg viewBox="0 0 128 128" class="gring"><circle cx="64" cy="64" r="54" class="gb"/><circle cx="64" cy="64" r="54" class="gf" stroke-dasharray="${circ}" stroke-dashoffset="${circ}" transform="rotate(-90 64 64)" data-to="${circ * (1 - r.score / 100)}"/></svg><div class="gt"><b>${r.score}%</b><small>${r.incomplete ? 'Incomplete' : grade}</small></div></div>
      ${gain ? `<div class="banner gold">${mastered ? `<b>${esc(surah.en)} mastered.</b> ` : range.mastery && r.pass ? '<b>Part passed.</b> ' : ''}+${gain.xp} XP, +${gain.coins} coins</div>` : ''}
      ${range.mastery && !r.pass && !r.incomplete ? `<div class="banner">Mastery needs a recitation with no real mistakes. ${r.errors} to fix.</div>` : ''}
      ${r.incomplete ? `<div class="banner bad">It sounds like you stopped early or skipped a lot. Recite the whole range and try again.</div>` : ''}
      ${r.summary ? `<p class="coach-note">${ic('message', 18)}<span>${esc(r.summary)}${r.strengths ? `<br><span class="muted">${esc(r.strengths)}</span>` : ''}</span></p>` : ''}
      ${sorted.length > 1 ? `<section class="card"><h3>By ayah</h3><div class="abars">${sorted.map(([a, v]) => { const p = Math.round(v.s / v.n * 100); return `<div class="ab"><span>${a}</span><div class="progress thin ${p >= 90 ? 'good' : p >= 65 ? 'mid' : 'low'}"><i style="width:${p}%"></i></div><b>${p}%</b></div>`; }).join('')}</div></section>` : ''}
      <div class="legend"><span class="w wrong">wrong</span><span class="w missing">missing</span><span class="w pron">pronunciation</span><span class="w taj">tajweed reminder</span></div>
      <div class="rtext ar" dir="rtl" id="rtext">${textHTML(r.marks)}</div>
      ${list.length ? `<h3>Things to work on</h3><div class="issues">${list.map(([i, m]) => `<button class="issue ${m.type}" data-k="word" data-i="${i}"><span class="ar">${esc(W[i].w)}</span><div><b>${LAB[m.type]}</b><small>${esc(m.issue)}</small></div></button>`).join('')}</div>` : '<p class="muted center">Nothing to fix. Beautiful.</p>'}
      ${!r.hasCoach ? `<p class="muted center small">The tajweed coach was unavailable, so only word-level checks ran.</p>` : ''}
      <p class="muted center small">AI can verify words and obvious slips. Subtle tajweed, like exact madd length, is best confirmed by a teacher.</p></div>
      <footer class="ov-foot"><div class="col-gap"><div class="row-gap"><button class="btn grow" data-k="replay" id="rp">${ic('play', 16)} My recording</button><button class="btn grow" data-k="nur">${ic('message', 16)} Ask Nur</button></div><div class="row-gap"><button class="btn grow" data-k="retry">${ic('repeat', 16)} Try again</button><button class="btn primary grow" data-k="close">Done</button></div></div></footer>`;
    requestAnimationFrame(() => requestAnimationFrame(() => { const f = $('.gf', ov); if (f) f.setAttribute('stroke-dashoffset', f.dataset.to); }));
  }
  const wordInfo = i => {
    const m = result.marks[i]; if (!m) return;
    const el = sheet(`<div class="ar big center" dir="rtl">${esc(W[i].w)}</div><h3 class="center">${LAB[m.type]}</h3>${m.heard ? `<p><b>I heard:</b> <span class="ar">${esc(m.heard)}</span></p>` : ''}<p>${esc(m.issue)}</p>${m.tip ? `<p class="muted">${esc(m.tip)}</p>` : ''}<button class="btn" data-c="1">Close</button>`);
    el.addEventListener('click', e => { if (e.target.closest('[data-c]')) closeSheet(); });
  };

  ov.addEventListener('click', e => {
    const t = e.target.closest('[data-k]'), w = e.target.closest('.w[data-i]');
    if (!t && w && result) return wordInfo(+w.dataset.i);
    if (!t) return; const k = t.dataset.k;
    if (k === 'close') close();
    else if (k === 'dn' || k === 'up') clampRange(t.dataset.f, k === 'up' ? 1 : -1);
    else if (k === 'go') { range.mastery = false; ready(); }
    else if (k === 'part') { const p = parts[+t.dataset.n]; range = { from: p[0], to: p[1], mastery: true }; ready(); }
    else if (k === 'rec') startRec();
    else if (k === 'stop') stopRec();
    else if (k === 'retry') ready();
    else if (k === 'word') wordInfo(+t.dataset.i);
    else if (k === 'replay') { if (replay && !replay.paused) { replay.pause(); t.innerHTML = `${ic('play', 16)} My recording`; return; } replay = new Audio(blobUrl); replay.onended = () => { t.innerHTML = `${ic('play', 16)} My recording`; }; replay.play().catch(() => {}); t.innerHTML = `${ic('pause', 16)} Pause`; }
    else if (k === 'nur') {
      const bad = Object.entries(result.marks).filter(([, m]) => m.type !== 'taj').slice(0, 6).map(([i, m]) => `${W[i].w} (${LAB[m.type].toLowerCase()}: ${m.issue})`).join('; ');
      openNur({ ask: `I just recited ${surah.en} ayahs ${range.from} to ${range.to} and scored ${result.score}%.${bad ? ' Issues: ' + bad + '.' : ' No real mistakes.'} What should I work on?`, extra: `Recitation result for ${surah.en} ${range.from}-${range.to}: ${result.score}%` });
    }
  });
  ov.addEventListener('change', e => { if (e.target.id === 'hard') hard = e.target.checked; });

  if (opts.from) { range = { from: opts.from, to: Math.min(opts.to || opts.from, opts.from + MAX - 1), mastery: !!opts.mastery }; if (range.mastery) { const p = parts.find(x => x[0] === range.from); if (p) range.to = p[1]; } ready(); } else picker();
}

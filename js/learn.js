// Lesson engine (learn 20 ayahs or finish the surah) + mastery recitation with the Groq coach.
import { S, $, esc, shuffle, pick, strip, nrm, wordsOf, sr, levelOf, reward, sfx, toast, confetti, sheet, playAyah, stopAudio, day, save, Auth, api, toAr } from './core.js';
import { FALLBACK_WORDS } from './content.js';
import { openArcade } from './games.js';

const CHUNK = 20;
const refresh = () => window.dispatchEvent(new Event('iqra-refresh'));

export function nextChunk(ayahs, rec) {
  const done = new Set(rec.learned); const i = ayahs.findIndex(a => !done.has(a.n));
  return i < 0 ? null : ayahs.slice(i, i + CHUNK);
}

function buildSteps(chunk, all) {
  const pool = new Map(); all.forEach(a => wordsOf(a.ar).forEach(w => pool.set(strip(w), w)));
  const steps = []; let last = -1;
  chunk.forEach((a, idx) => {
    const w = wordsOf(a.ar);
    steps.push({ t: 'learn', a });
    if (w.length >= 2) steps.push({ t: w.length <= 7 ? 'build' : 'fill', a, pool });
    if (w.length >= 3 && w.length <= 7 && idx % 2 === 1) steps.push({ t: 'fill', a, pool });
    if (all.length >= 4 && idx % 3 === 2) steps.push({ t: 'meaning', a, all });
  });
  if (chunk.length >= 3) {
    const n = Math.max(1, Math.floor(chunk.length / 6));
    for (let k = 0; k < n; k++) {
      let s = Math.floor(Math.random() * (chunk.length - 2)); if (s === last) s = (s + 1) % (chunk.length - 2); last = s;
      steps.push({ t: 'seq', as: chunk.slice(s, s + 3) });
    }
  }
  return steps;
}

export function startLesson(surah, ayahs) {
  const rec = sr(surah.n); rec.count = surah.count;
  const chunk = nextChunk(ayahs, rec);
  if (!chunk) { toast('Surah learned! Try reciting it for mastery.', '🏅'); return; }
  const lessonNo = Math.floor(rec.learned.length / CHUNK) + 1, lessons = Math.ceil(surah.count / CHUNK);
  const ov = document.createElement('div'); ov.className = 'game';
  ov.innerHTML = `<div class="game-top"><button class="icon-btn" data-k="close" aria-label="Close">✕</button><div class="bar"><i></i></div><div class="combo" id="combo">🔥 0</div></div><div class="game-body"></div><div class="game-foot"></div>`;
  document.body.append(ov); document.body.classList.add('noscroll');
  const body = $('.game-body', ov), foot = $('.game-foot', ov), bar = $('.bar i', ov), comboEl = $('#combo', ov);
  const steps = buildSteps(chunk, ayahs);
  let i = 0, combo = 0, xp = 0, right = 0, asked = 0, cur = null, finished = false; const t0 = Date.now();
  const close = () => { stopAudio(); ov.remove(); if (!document.querySelector('.game')) document.body.classList.remove('noscroll'); refresh(); };
  const tag = (txt) => `<div class="step-tag">${esc(surah.en)} · lesson ${lessonNo}/${lessons} · ${esc(txt)}</div>`;

  function next() {
    bar.style.width = Math.min(100, (i / steps.length) * 100) + '%';
    if (i >= steps.length) return finish();
    cur = steps[i]; R[cur.t](cur);
  }
  function answer(ok, msg) {
    asked++; i++;
    if (ok) { right++; combo++; xp += 10 + Math.min(combo, 5) * 2; sfx('ok'); }
    else { combo = 0; sfx('bad'); if (!cur.retry) steps.push({ ...cur, retry: true }); }
    comboEl.textContent = '🔥 ' + combo; comboEl.classList.toggle('hot', combo >= 3);
    foot.innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}"><b>${ok ? pick(['Great!', 'Correct!', 'Nice one!', 'Spot on!']) : 'Not quite'}</b><span>${msg || ''}</span></div><button class="btn primary" data-k="next">Continue</button>`;
    bar.style.width = Math.min(100, (i / steps.length) * 100) + '%';
  }
  const playBtn = g => `<button class="listen" data-k="play" data-g="${g}">🔊 Listen</button>`;

  const R = {
    learn(s) {
      const a = s.a;
      body.innerHTML = `${tag('new ayah ' + a.n)}<div class="ar big" dir="rtl">${esc(a.ar)}</div><p class="tl">${esc(a.tr)}</p><p class="en">${esc(a.en)}</p>${playBtn(a.g)}`;
      foot.innerHTML = `<button class="btn primary" data-k="gotit">Got it</button>`; playAyah(a.g);
    },
    build(s) {
      const w = wordsOf(s.a.ar), bank = shuffle(w.map((x, k) => ({ x, k }))), placed = [];
      const draw = () => {
        $('.slots', body).innerHTML = placed.map((p, n) => `<button class="chip ar" data-k="un" data-n="${n}">${esc(p.x)}</button>`).join('') || '<span class="ph">Tap the words in order</span>';
        $('.bank', body).innerHTML = bank.map((b, n) => placed.includes(b) ? `<span class="chip ghost">&nbsp;</span>` : `<button class="chip ar" data-k="pk" data-n="${n}">${esc(b.x)}</button>`).join('');
      };
      body.innerHTML = `${tag('build the ayah')}<p class="q">Put the ayah together</p><p class="en">${esc(s.a.en)}</p>${playBtn(s.a.g)}<div class="slots" dir="rtl"></div><div class="bank" dir="rtl"></div>`;
      foot.innerHTML = '';
      s.pick = n => { const b = bank[n]; if (placed.includes(b)) return; placed.push(b); draw(); if (placed.length === bank.length) { const ok = placed.every((p, k) => p.x === w[k]); $('.slots', body).classList.add(ok ? 'good' : 'badx'); answer(ok, ok ? '' : `Correct order: <span class="ar">${esc(s.a.ar)}</span>`); } };
      s.unpick = n => { if (!foot.innerHTML) { placed.splice(n, 1); draw(); } };
      draw();
    },
    fill(s) {
      const w = wordsOf(s.a.ar); const cands = w.map((x, k) => k).filter(k => strip(w[k]).length >= 3); const t = cands.length ? pick(cands) : Math.floor(Math.random() * w.length);
      const right = w[t]; const pool = [...s.pool.values()].filter(x => strip(x) !== strip(right)); const near = shuffle(pool.filter(x => Math.abs(strip(x).length - strip(right).length) <= 1));
      const opts = [...new Set([...near, ...shuffle(pool), ...FALLBACK_WORDS].filter(x => strip(x) !== strip(right)).slice(0, 3))]; const options = shuffle([right, ...opts.slice(0, 3)]);
      body.innerHTML = `${tag('fill the gap')}<p class="q">Which word is missing?</p><p class="en">${esc(s.a.en)}</p>${playBtn(s.a.g)}<div class="ar big" dir="rtl">${w.map((x, k) => k === t ? '<span class="blank">؟</span>' : esc(x)).join(' ')}</div><div class="opts">${options.map(o => `<button class="opt ar" data-k="opt" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
      foot.innerHTML = ''; s.right = right;
    },
    meaning(s) {
      const others = shuffle(s.all.filter(x => x.n !== s.a.n && x.en !== s.a.en)).slice(0, 2); const options = shuffle([s.a, ...others]);
      body.innerHTML = `${tag('meaning check')}<p class="q">What does this ayah mean?</p><div class="ar big" dir="rtl">${esc(s.a.ar)}</div>${playBtn(s.a.g)}<div class="opts col">${options.map(o => `<button class="opt" data-k="opt" data-v="${o.n}">${esc(o.en)}</button>`).join('')}</div>`;
      foot.innerHTML = ''; s.right = String(s.a.n);
    },
    seq(s) {
      const cards = shuffle(s.as), picked = [];
      const short = a => { const w = wordsOf(a.ar); return w.length > 8 ? w.slice(0, 5).join(' ') + ' … ' + w.slice(-2).join(' ') : w.join(' '); };
      const draw = () => { $('.opts', body).innerHTML = cards.map(c => { const n = picked.indexOf(c); return `<button class="opt seq ${n >= 0 ? 'sel' : ''}" data-k="sq" data-n="${c.n}">${n >= 0 ? `<i>${n + 1}</i>` : ''}<span class="ar" dir="rtl">${esc(short(c))}</span></button>`; }).join(''); };
      body.innerHTML = `${tag('ayah order')}<p class="q">Tap these ayahs in the order they come</p><div class="opts col"></div>`;
      foot.innerHTML = '';
      s.sq = n => { const c = cards.find(x => x.n === n); if (picked.includes(c)) return; picked.push(c); draw(); if (picked.length === cards.length) { const ok = picked.every((p, k) => p.n === s.as[k].n); answer(ok, ok ? '' : `Order: ayah ${s.as.map(a => a.n).join(' → ')}`); } };
      draw();
    },
  };

  function finish() {
    finished = true; stopAudio();
    const acc = asked ? right / asked : 1, stars = acc >= .9 ? 3 : acc >= .7 ? 2 : 1;
    const bonus = 30 + stars * 20, coins = chunk.length + stars * 5, was = rec.done;
    chunk.forEach(a => { if (!rec.learned.includes(a.n)) rec.learned.push(a.n); }); rec.learned.sort((a, b) => a - b);
    if (rec.learned.length >= surah.count) rec.done = true;
    const full = rec.done && !was;
    day().ayahs += chunk.length; day().minutes += Math.max(1, Math.round((Date.now() - t0) / 60000)); S.sessions++; if (stars === 3) S.perfects++;
    const gained = xp + bonus + (full ? 100 : 0), got = coins + (full ? 50 : 0);
    const before = levelOf(S.xp - 0); const res = reward({ xp: gained, coins: got });
    sfx('win'); confetti(full ? 140 : 70); bar.style.width = '100%';
    const more = !rec.done;
    body.innerHTML = `<div class="result"><div class="stars">${[1, 2, 3].map(n => `<i class="${n <= stars ? 'on' : ''}" style="animation-delay:${n * .25}s">★</i>`).join('')}</div>
      <h2>${full ? `${esc(surah.en)} learned! 🎉` : 'Lesson complete!'}</h2>
      <div class="stat-row"><div><b>+${gained}</b><small>XP</small></div><div><b>+${got}</b><small>coins</small></div><div><b>${Math.round(acc * 100)}%</b><small>accuracy</small></div><div><b>${chunk.length}</b><small>ayahs</small></div></div>
      ${res.leveled ? `<div class="banner">🚀 Level up! You are now level ${res.leveled}</div>` : ''}
      ${res.badges.map(b => `<div class="banner">${b.i} New badge: <b>${esc(b.n)}</b></div>`).join('')}
      ${full ? `<div class="banner gold">🏅 Next step: recite the whole surah to earn <b>Mastery</b>.</div>` : ''}
      <p class="muted center">You earned a break. Take a quick game!</p></div>`;
    foot.innerHTML = `<div class="col-gap"><button class="btn gold" data-k="arcade">🎮 Break time</button>${full ? `<button class="btn primary" data-k="recite">🎙️ Recite for mastery</button>` : ''}${more ? `<button class="btn primary" data-k="again">Next lesson →</button>` : ''}<button class="btn ghost" data-k="close">Done</button></div>`;
    void before;
  }

  ov.addEventListener('click', e => {
    const t = e.target.closest('[data-k]'); if (!t) return; const k = t.dataset.k;
    if (k === 'close') { if (finished || i === 0 || confirm('Leave this lesson? Progress in it will be lost.')) close(); }
    else if (k === 'play') playAyah(+t.dataset.g);
    else if (k === 'gotit') { xp += 5; i++; next(); }
    else if (k === 'next') next();
    else if (k === 'pk') cur.pick(+t.dataset.n);
    else if (k === 'un') cur.unpick(+t.dataset.n);
    else if (k === 'sq') cur.sq(+t.dataset.n);
    else if (k === 'opt') {
      if (foot.innerHTML) return; const ok = t.dataset.v === cur.right;
      $$opts(body).forEach(b => { b.classList.add('locked'); if (b.dataset.v === cur.right) b.classList.add('right'); });
      if (!ok) t.classList.add('wrong'); answer(ok, ok ? '' : cur.t === 'fill' ? `Answer: <span class="ar">${esc(cur.right)}</span>` : '');
    }
    else if (k === 'arcade') openArcade();
    else if (k === 'again') { close(); startLesson(surah, ayahs); }
    else if (k === 'recite') { close(); openRecite(surah, ayahs); }
  });
  next();
}
const $$opts = body => [...body.querySelectorAll('.opt')];

// ------------------------------------------------------------------
// Mastery recitation
// ------------------------------------------------------------------
const partsOf = count => { if (count <= 30) return [[1, count]]; const p = []; for (let s = 1; s <= count; s += CHUNK) p.push([s, Math.min(count, s + CHUNK - 1)]); return p; };
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

export function openRecite(surah, ayahs) {
  const rec = sr(surah.n);
  if (!rec.done) { toast('Finish learning this surah first.', '🔒'); return; }
  const parts = partsOf(surah.count);
  const ov = document.createElement('div'); ov.className = 'game recite'; document.body.append(ov); document.body.classList.add('noscroll');
  let mr = null, stream = null, tick = null, partIdx = 0, W = [], hard = false, result = null;
  const close = () => { cleanup(); ov.remove(); if (!document.querySelector('.game')) document.body.classList.remove('noscroll'); refresh(); };
  const cleanup = () => { clearInterval(tick); try { if (mr && mr.state !== 'inactive') { mr.onstop = null; mr.stop(); } } catch { /* ignore */ } if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; mr = null; };
  const top = (t) => `<div class="game-top"><button class="icon-btn" data-k="close" aria-label="Close">✕</button><div class="grow"><b>${esc(t)}</b></div></div>`;

  function picker() {
    cleanup();
    ov.innerHTML = `${top('Mastery · ' + surah.en)}<div class="game-body"><p class="muted center">${esc(surah.en)} is long, so mastery is earned part by part. Pass every part to master the surah.</p><div class="opts col">${parts.map((p, k) => `<button class="opt" data-k="part" data-n="${k}">Part ${k + 1} · ayahs ${p[0]}–${p[1]} ${rec.parts[k] ? `<b class="ok-t">✓ ${rec.parts[k].score}%</b>` : ''}</button>`).join('')}</div></div>`;
  }
  function ready(k) {
    cleanup(); partIdx = k; result = null; const [from, to] = parts[k];
    const sel = ayahs.filter(a => a.n >= from && a.n <= to); W = []; sel.forEach(a => wordsOf(a.ar).forEach(w => W.push({ w, a: a.n, last: false }))); let c = 0; sel.forEach(a => { c += wordsOf(a.ar).length; W[c - 1].last = true; });
    ov.innerHTML = `${top(`Mastery · ${surah.en}${parts.length > 1 ? ' · part ' + (k + 1) : ''}`)}<div class="game-body">
      <div class="coach-note">🎙️ Recite from <b>ayah ${from}</b> to <b>${to}</b> in one go. The AI coach listens, then highlights what to fix. Perfect recitation = Mastery.</div>
      <label class="switch-row"><span>Hard mode (hide the text, +50 XP)</span><input type="checkbox" id="hard" ${hard ? 'checked' : ''}></label>
      <div class="rtext ar" id="rtext" dir="rtl">${textHTML()}</div></div>
      <div class="game-foot"><button class="btn primary big-mic" data-k="rec">🎙️ Start recording</button></div>`;
  }
  function textHTML(marks = {}) {
    let out = ''; W.forEach((x, i) => { const m = marks[i]; out += `<span class="w ${m ? m.type : ''}" data-i="${i}">${esc(x.w)}</span> `; if (x.last) out += `<span class="aend">﴿${toAr(x.a)}﴾</span> `; });
    return out;
  }
  async function startRec() {
    if (!Auth.groq) { sheet(`<h3>AI coach not connected</h3><p class="muted">Add your <b>GROQ_API_KEY</b> as a secret on Cloudflare Pages (Settings → Variables and Secrets), redeploy, and the coach switches on. See the README for the 2-minute setup.</p><button class="btn primary" onclick="document.querySelector('.sheet-wrap').remove()">Got it</button>`); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { toast('Microphone permission is needed', '🎙️'); return; }
    hard = $('#hard', ov)?.checked || false;
    const mt = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const chunks = []; mr = new MediaRecorder(stream, mt ? { mimeType: mt } : {});
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = () => { const type = mr.mimeType || mt || 'audio/webm'; stream.getTracks().forEach(t => t.stop()); analyze(new Blob(chunks, { type })); };
    mr.start(); let s = 0;
    $('#rtext', ov).classList.toggle('hidden-text', hard);
    $('.game-foot', ov).innerHTML = `<div class="recbar"><span class="dot"></span><b id="rt">0:00</b></div><button class="btn danger big-mic" data-k="stop">⏹ Stop &amp; check</button>`;
    tick = setInterval(() => { s++; const e = $('#rt', ov); if (e) e.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (s >= 900) stopRec(); }, 1000);
  }
  function stopRec() { clearInterval(tick); if (mr && mr.state !== 'inactive') mr.stop(); }

  async function analyze(blob) {
    ov.innerHTML = `${top('Checking your recitation')}<div class="game-body"><div class="result"><div class="spinner"></div><h3 id="ph">Listening to your recitation…</h3><p class="muted">This takes a few seconds.</p></div></div>`;
    try {
      const fd = new FormData(); fd.append('audio', blob, 'rec.' + (/mp4|m4a/.test(blob.type) ? 'm4a' : 'webm'));
      const t = await api('transcribe', 'POST', fd);
      const ph = $('#ph', ov); if (ph) ph.textContent = 'Comparing with the mushaf…';
      const raw = (t.text || '').replace(/[^\u0600-\u06FF\s]/g, ' ').split(/\s+/).filter(Boolean); const H = [], Hr = [];
      raw.forEach(r => { const n = nrm(r); if (n) { H.push(n); Hr.push(r); } });
      if (H.length < 2) throw new Error("I couldn't hear a recitation. Check your microphone and try again.");
      const E = W.map(x => nrm(x.w)), al = align(E, H), m = W.length;
      const info = W.map((x, i) => { const j = al[i]; const s = j < 0 ? 0 : sim(E[i], H[j]); return { i, j, s, heard: j < 0 ? null : Hr[j], st: j < 0 ? 'missing' : s >= .8 ? 'ok' : s >= .5 ? 'close' : 'wrong' }; });
      const missing = info.filter(x => x.st === 'missing').length;
      const near = i => { let a = i - 1; while (a >= 0 && info[a].j < 0) a--; let b = i + 1; while (b < m && info[b].j < 0) b++; const lo = a >= 0 ? info[a].j + 1 : 0, hi = b < m ? info[b].j : H.length; return Hr.slice(lo, hi).slice(0, 4); };
      const cands = info.filter(x => x.st !== 'ok').slice(0, 120);
      let coach = null;
      if (missing / m <= .35) {
        const ph2 = $('#ph', ov); if (ph2) ph2.textContent = 'Your coach is reviewing tajweed…';
        try { coach = await api('coach', 'POST', { surah: surah.en, transcript: t.text, words: m <= 250 ? W.map(x => x.w) : null, candidates: cands.map(c => ({ i: c.i, expected: W[c.i].w, heard: c.heard, near: c.heard ? null : near(c.i), sim: +c.s.toFixed(2) })) }); } catch { coach = null; }
      }
      const marks = {}, issues = [];
      for (const c of cands) {
        const v = coach && (coach.verdicts || []).find(x => x.i === c.i);
        const fallback = c.st === 'missing' ? 'missing' : c.st === 'wrong' ? 'wrong' : 'pron';
        if (v && !v.real) continue; if (!coach && c.st === 'close') { /* without the coach, treat as a likely pronunciation slip */ }
        const type = v ? ({ wrong: 'wrong', missing: 'missing', pronunciation: 'pron' }[v.type] || fallback) : fallback;
        marks[c.i] = { type, heard: c.heard, issue: v?.issue || (type === 'missing' ? 'This word was not heard.' : type === 'wrong' ? 'This sounded like a different word.' : 'Pronunciation looks slightly off.'), tip: v?.tip || '' };
      }
      (coach?.tajweed_watch || []).forEach(x => { if (Number.isInteger(x.i) && x.i >= 0 && x.i < m && !marks[x.i]) marks[x.i] = { type: 'taj', heard: null, issue: x.rule || 'Tajweed reminder', tip: x.tip || '' }; });
      const errors = Object.values(marks).filter(x => x.type !== 'taj').length, incomplete = missing / m > .35;
      const score = incomplete ? Math.max(0, Math.round(100 * (1 - missing / m))) : Math.max(0, Math.min(errors ? 99 : 100, Math.round(100 * (1 - errors / m))));
      result = { marks, errors, score, pass: !errors && !incomplete && score >= 90, incomplete, summary: coach?.summary || '', strengths: coach?.strengths || '', hasCoach: !!coach };
      showResult(); } catch (e) {
      ov.innerHTML = `${top('Could not check')}<div class="game-body"><div class="result"><div class="big-emoji">😕</div><h3>${esc(e.message || 'Something went wrong')}</h3></div></div><div class="game-foot"><button class="btn primary" data-k="retry">Try again</button></div>`;
    }
  }
  function showResult() {
    const r = result; let reward_ = null;
    if (r.pass) {
      const R = { xp: 100 + (hard ? 50 : 0), coins: 30 }; rec.parts[partIdx] = { score: r.score, at: Date.now(), hard };
      rec.best = Math.max(rec.best || 0, r.score);
      if (parts.every((_, k) => rec.parts[k]) && !rec.mastered) { rec.mastered = true; rec.masteredAt = Date.now(); R.xp += 300; R.coins += 100; reward_ = 'mastered'; }
      const res = reward(R); confetti(reward_ ? 160 : 80); sfx('win'); r.res = res; r.R = R; save();
    } else sfx('bad');
    const list = Object.entries(r.marks).sort((a, b) => a[0] - b[0]);
    const lab = { wrong: 'Wrong word', missing: 'Missing word', pron: 'Pronunciation', taj: 'Tajweed reminder' };
    ov.innerHTML = `${top('Your result')}<div class="game-body">
      <div class="score-ring ${r.pass ? 'pass' : ''}"><b>${r.score}%</b><small>${r.pass ? 'Perfect!' : r.incomplete ? 'Incomplete' : `${r.errors} to fix`}</small></div>
      ${r.pass ? `<div class="banner gold">${reward_ ? `🏅 <b>${esc(surah.en)} mastered!</b> +${r.R.xp} XP, +${r.R.coins} coins` : `✅ Part passed! +${r.R.xp} XP, +${r.R.coins} coins`}</div>` : r.incomplete ? `<div class="banner bad">It sounds like you stopped early or skipped a lot. Recite the whole passage and try again.</div>` : ''}
      ${r.summary ? `<p class="coach-note">🧑‍🏫 ${esc(r.summary)}${r.strengths ? ` <br><span class="muted">${esc(r.strengths)}</span>` : ''}</p>` : ''}
      <div class="legend"><span class="w wrong">wrong</span><span class="w missing">missing</span><span class="w pron">pronunciation</span><span class="w taj">tajweed reminder</span></div>
      <div class="rtext ar" dir="rtl" id="rtext">${textHTML(r.marks)}</div>
      ${list.length ? `<h3>Things to work on</h3><div class="issues">${list.map(([i, m]) => `<button class="issue ${m.type}" data-k="word" data-i="${i}"><span class="ar">${esc(W[i].w)}</span><div><b>${lab[m.type]}</b><small>${esc(m.issue)}</small></div></button>`).join('')}</div>` : ''}
      ${!r.hasCoach ? `<p class="muted center">The tajweed coach was unavailable, so only word-level checks ran.</p>` : ''}
      <p class="muted center small">AI can verify words and obvious pronunciation slips. Subtle tajweed (exact madd length, ghunnah) is best confirmed by a teacher.</p></div>
      <div class="game-foot"><div class="col-gap">${r.pass ? '' : `<button class="btn primary" data-k="retry">Try again</button>`}<button class="btn ${r.pass ? 'primary' : 'ghost'}" data-k="close">${r.pass ? 'Continue' : 'Close'}</button></div></div>`;
  }

  ov.addEventListener('click', e => {
    const t = e.target.closest('[data-k]'), w = e.target.closest('.w[data-i]');
    if (!t && w && result) return wordInfo(+w.dataset.i);
    if (!t) return; const k = t.dataset.k;
    if (k === 'close') close();
    else if (k === 'part') ready(+t.dataset.n);
    else if (k === 'rec') startRec();
    else if (k === 'stop') stopRec();
    else if (k === 'retry') ready(partIdx);
    else if (k === 'word') wordInfo(+t.dataset.i);
  });
  ov.addEventListener('change', e => { if (e.target.id === 'hard') hard = e.target.checked; });
  function wordInfo(i) {
    const m = result.marks[i]; if (!m) return;
    sheet(`<div class="ar big center" dir="rtl">${esc(W[i].w)}</div><h3 class="center">${{ wrong: 'Wrong word', missing: 'Missing word', pron: 'Pronunciation', taj: 'Tajweed reminder' }[m.type]}</h3>${m.heard ? `<p><b>I heard:</b> <span class="ar">${esc(m.heard)}</span></p>` : ''}<p>${esc(m.issue)}</p>${m.tip ? `<p class="muted">💡 ${esc(m.tip)}</p>` : ''}<button class="btn" onclick="document.querySelector('.sheet-wrap').remove()">Close</button>`);
  }
  if (parts.length > 1) picker(); else ready(0);
}

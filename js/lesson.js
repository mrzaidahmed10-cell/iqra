// Lesson engine: teach first, then practise. Every advance is saved so a lesson can be resumed.
import {
  S, $, $$, esc, toAr, shuffle, pick, sleep, wordsOf, day, sr, markLearned, reward, save, sheet, closeSheet, toast, feel, sfx, haptic,
  getSurah, getSurahList, getWords, playClip, stopClip, audioUrl, lessonDone, nextItem, dueReviews, bus, allLessonIds,
} from './core.js';
import { ic } from './icons.js';
import { lessonSteps, lessonMeta } from './curriculum.js';
import { makeSortable, flip } from './sortable.js';
import { openNur } from './nur.js';
import { openRecite } from './recite.js';
import { openArcade } from './games.js';

const GROUP = 4, LESSON_AYAHS = 20, NAMES = {};
const range = n => Array.from({ length: n }, (_, i) => i);
const clip = (ar, n = 7) => { const w = wordsOf(ar); return w.length > n ? w.slice(0, n).join(' ') + ' …' : ar; };

// ------------------------------------------------------------------ plans
async function ayahsOf(n) { return getSurah(n); }

async function surahPlan(surah, ayahs) {
  const rec = sr(surah.n), todo = ayahs.filter(a => !rec.learned.includes(a.n)).slice(0, LESSON_AYAHS);
  if (!todo.length) return null;
  const steps = [], n = surah.n, byN = Object.fromEntries(ayahs.map(a => [a.n, a]));
  const otherWords = ayahs.flatMap(a => wordsOf(a.ar));
  const fill = a => {
    const ws = wordsOf(a.ar); if (ws.length < 3) return null;
    const cands = ws.map((w, i) => i).filter(i => strip1(ws[i]).length > 1), w = pick(cands.length ? cands : range(ws.length)), right = ws[w];
    const pool = [...new Set(otherWords.filter(x => strip1(x) !== strip1(right)))];
    const opts = shuffle([right, ...shuffle(pool).slice(0, 3)]);
    return { t: 'fill', n, a: a.n, w, opts, c: opts.indexOf(right) };
  };
  const meaning = a => { const o = shuffle(ayahs.filter(x => x.n !== a.n)).slice(0, 3).map(x => x.n); if (!o.length) return null; const opts = shuffle([a.n, ...o]); return { t: 'meaning', n, a: a.n, opts }; };
  const hear = a => { const o = shuffle(ayahs.filter(x => x.n !== a.n && strip1(x.ar) !== strip1(a.ar))).slice(0, 2).map(x => x.n); if (!o.length) return null; return { t: 'hear', n, a: a.n, opts: shuffle([a.n, ...o]) }; };
  for (let i = 0; i < todo.length; i += GROUP) {
    const g = todo.slice(i, i + GROUP);
    g.forEach(a => steps.push({ t: 'teach', n, a: a.n }));
    g.forEach(a => { const nw = wordsOf(a.ar).length; steps.push(nw <= 8 ? { t: 'build', n, a: a.n, order: shuffle(range(nw)) } : fill(a) || { t: 'build', n, a: a.n, order: shuffle(range(nw)) }); });
    shuffle(g).slice(0, 2).forEach(a => { const s = meaning(a); if (s) steps.push(s); });
    const h = hear(pick(g)); if (h) steps.push(h);
    if (g.length >= 3) steps.push({ t: 'seq', n, as: g.map(a => a.n), order: shuffle(range(g.length)) });
    steps[steps.length - 1].mark = g.map(a => a.n);
  }
  // Final mixed review of what was just learned
  shuffle(todo).slice(0, 5).forEach((a, i) => { const s = [fill, hear, meaning][i % 3](a) || meaning(a); if (s) steps.push({ ...s, rev: 1 }); });
  void byN;
  return { kind: 'surah', n, title: surah.en, sub: `Ayahs ${todo[0].n} to ${todo[todo.length - 1].n}`, steps, from: todo[0].n, to: todo[todo.length - 1].n };
}
const strip1 = s => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '').replace(/[ٱأإآ]/g, 'ا');

async function reviewPlan() {
  const due = dueReviews(), seen = new Set(), items = [];
  for (const d of due) { const k = d.n + ':' + d.a; if (!seen.has(k)) { seen.add(k); items.push(d); } if (items.length >= 8) break; }
  if (!items.length) return null;
  const steps = [];
  for (const [i, it] of items.entries()) {
    const ayahs = await ayahsOf(it.n), a = ayahs.find(x => x.n === it.a); if (!a) continue;
    const ws = wordsOf(a.ar), others = ayahs.flatMap(x => wordsOf(x.ar));
    const rv = { rv: [{ n: it.n, a: it.a }], rev: 1 };
    if (i % 3 === 0 && ws.length >= 3) {
      const w = Math.floor(Math.random() * ws.length), pool = [...new Set(others.filter(x => strip1(x) !== strip1(ws[w])))], opts = shuffle([ws[w], ...shuffle(pool).slice(0, 3)]);
      if (opts.length > 1) { steps.push({ t: 'fill', n: it.n, a: it.a, w, opts, c: opts.indexOf(ws[w]), ...rv }); continue; }
    }
    if (i % 3 === 1) { const o = shuffle(ayahs.filter(x => x.n !== a.n && strip1(x.ar) !== strip1(a.ar))).slice(0, 2).map(x => x.n); if (o.length) { steps.push({ t: 'hear', n: it.n, a: it.a, opts: shuffle([a.n, ...o]), ...rv }); continue; } }
    const o = shuffle(ayahs.filter(x => x.n !== a.n)).slice(0, 3).map(x => x.n);
    if (o.length) steps.push({ t: 'meaning', n: it.n, a: it.a, opts: shuffle([a.n, ...o]), ...rv });
    else steps.push({ t: 'build', n: it.n, a: it.a, order: shuffle(range(ws.length)), ...rv });
  }
  const letters = allLessonIds.filter(id => id.startsWith('letters-') && lessonDone(id));
  if (letters.length) steps.push(...shuffle(lessonSteps(pick(letters)).filter(s => s.t === 'mcq')).slice(0, 2));
  return steps.length ? { kind: 'review', title: 'Revision', sub: `${items.length} ayahs to refresh`, steps } : null;
}

export const hasSession = () => !!(S.session && S.session.steps && S.session.i < S.session.steps.length);
export const sessionInfo = () => hasSession() ? { title: S.session.title, sub: S.session.sub, pct: Math.round(S.session.i / S.session.steps.length * 100), kind: S.session.kind, n: S.session.n } : null;

export async function startLesson(id) {
  const m = lessonMeta(id); if (!m) return;
  if (hasSession() && !(await confirmReplace())) return;
  open({ kind: 'lesson', id, title: m.title, sub: m.sub, steps: lessonSteps(id) });
}
export async function startSurah(surah, ayahs) {
  if (hasSession() && S.session.kind === 'surah' && S.session.n === surah.n) return resumeSession();
  if (hasSession() && !(await confirmReplace())) return;
  const p = await surahPlan(surah, ayahs || await ayahsOf(surah.n));
  if (!p) { toast('You already learned every ayah here.', 'check'); return; }
  open(p);
}
export async function startReview() {
  if (hasSession() && !(await confirmReplace())) return;
  const p = await reviewPlan(); if (!p) { toast('Nothing to revise yet. Come back tomorrow.', 'check'); return; }
  open(p);
}
export const resumeSession = () => { if (hasSession()) open(S.session, true); };
function confirmReplace() {
  return new Promise(res => {
    const el = sheet(`<h3>You have a lesson in progress</h3><p class="muted">${esc(S.session.title)}, ${esc(S.session.sub || '')}. Starting something new will discard it.</p><div class="col-gap"><button class="btn primary" data-r="resume">Resume it</button><button class="btn danger-o" data-r="new">Discard and start new</button><button class="btn ghost" data-r="no">Cancel</button></div>`);
    el.addEventListener('click', e => { const r = e.target.closest('[data-r]')?.dataset.r; if (!r) return; closeSheet(); if (r === 'resume') { resumeSession(); res(false); } else if (r === 'new') { S.session = null; save(); res(true); } else res(false); });
  });
}

// ------------------------------------------------------------------ the overlay
function open(sess, resumed) {
  if (!resumed) { sess.i = 0; sess.ok = 0; sess.bad = 0; sess.started = Date.now(); sess.learned = []; sess.rvDone = []; }
  S.session = sess; save();
  document.body.classList.add('studying', 'noscroll');
  const ov = document.createElement('div'); ov.className = 'lesson'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', sess.title);
  ov.innerHTML = `<header class="l-top"><button class="icon-btn" data-k="exit" aria-label="Save and exit">${ic('x', 20)}</button><div class="l-bar"><i></i></div><span class="l-count"></span></header>
    <main class="l-stage" id="stage"></main><footer class="l-foot"><div class="l-fb" id="fb" aria-live="polite"></div><button class="btn primary big" id="go" data-k="go"></button></footer>`;
  document.body.append(ov); requestAnimationFrame(() => ov.classList.add('in'));
  const stage = $('#stage', ov), fb = $('#fb', ov), go = $('#go', ov);
  let tok = 0, st = {}, counted = false, sortables = [];

  const close = () => { stopClip(); sortables.forEach(s => s.destroy && s.destroy()); ov.classList.remove('in'); setTimeout(() => ov.remove(), 280); document.body.classList.remove('studying'); if (!$('.game,.recite,.nur')) document.body.classList.remove('noscroll'); window.dispatchEvent(new Event('iqra-refresh')); };
  const bar = () => { $('.l-bar i', ov).style.width = Math.round(sess.i / sess.steps.length * 100) + '%'; $('.l-count', ov).textContent = `${Math.min(sess.i + 1, sess.steps.length)} / ${sess.steps.length}`; };
  const setGo = (label, disabled = false, k = 'go') => { go.textContent = label; go.disabled = disabled; go.dataset.k = k; go.classList.toggle('ready', !disabled); };
  const feedback = (ok, msg) => { fb.className = 'l-fb show ' + (ok ? 'good' : 'bad'); fb.innerHTML = `${ic(ok ? 'check' : 'x', 18)}<span>${msg}</span>`; };
  const clearFb = () => { fb.className = 'l-fb'; fb.innerHTML = ''; };
  const count = ok => { if (counted) return; counted = true; ok ? sess.ok++ : sess.bad++; };
  const nextBtn = () => setGo(sess.i + 1 >= sess.steps.length ? 'Finish' : 'Continue');

  async function advance() {
    stopClip();
    const s = sess.steps[sess.i];
    if (s.mark) { const fresh = markLearned(s.n, (await ayahsOf(s.n)).length, s.mark); sess.learned.push(...s.mark.map(a => ({ n: s.n, a }))); if (fresh) toast(`${fresh} ayah${fresh > 1 ? 's' : ''} saved`, 'check'); }
    if (s.rv) sess.rvDone.push(...s.rv);
    sess.i++; S.session = sess; save();
    if (sess.i >= sess.steps.length) return complete();
    show();
  }

  async function show() {
    const my = ++tok, s = sess.steps[sess.i]; st = {}; counted = false; sortables.forEach(x => x.destroy && x.destroy()); sortables = []; clearFb(); bar(); stopClip();
    setGo('Continue', true);
    let html = '', init = null;
    try { ({ html, init } = await RENDER[s.t](s)); } catch (e) { html = `<div class="card center"><h3>Couldn't load this step</h3><p class="muted">Check your connection.</p><button class="btn primary" data-k="skip">Skip</button></div>`; }
    if (my !== tok) return;
    stage.classList.remove('enter'); stage.innerHTML = html; void stage.offsetWidth; stage.classList.add('enter'); stage.scrollTop = 0;
    const h = $('[data-focus]', stage); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    init && init(stage);
  }

  // ---------- renderers: each returns {html, init}
  const R = {};
  const formsRow = f => `<div class="forms" dir="rtl">${f.map(x => `<div><span class="ar">${esc(x[1])}</span><small>${x[0]}</small></div>`).join('')}</div>`;
  R.card = s => {
    nextBtn(); setGo(s.title && sess.i + 1 < sess.steps.length ? 'Got it' : go.textContent, false);
    return {
      html: `<div class="teach card-step"><h2 data-focus>${esc(s.title)}</h2>${s.big ? `<div class="big-ar ${s.small ? 'small' : ''} ar" dir="rtl">${esc(s.big)}</div>` : ''}<p class="lead">${esc(s.body || '')}</p>${s.forms ? formsRow(s.forms) : ''}${s.ex ? `<div class="exlist">${s.ex.map(x => `<div class="ex"><span class="ar" dir="rtl">${esc(x.ar)}</span><small>${esc(x.tr)}</small></div>`).join('')}</div>` : ''}${s.note ? `<p class="note">${ic('info', 16)}<span>${esc(s.note)}</span></p>` : ''}</div>`,
    };
  };
  const optHTML = (s, i) => { const o = s.opts[i]; return `<button class="opt ${o.ar ? 'ar-opt' : ''}" data-i="${i}">${o.ar ? `<span class="ar" dir="rtl">${esc(o.ar)}</span>` : esc(o.t)}</button>`; };
  R.mcq = s => ({
    html: `<div class="quiz"><small class="kicker">Question</small><h2 data-focus>${esc(s.q)}</h2>${s.qar ? `<div class="big-ar ar" dir="rtl">${esc(s.qar)}</div>` : ''}<div class="opts ${s.grid ? 'grid' : 'col'}">${s.opts.map((_, i) => optHTML(s, i)).join('')}</div></div>`,
    init: el => pickOpts(el, i => i === s.a, () => s.opts[s.a].ar || s.opts[s.a].t, s.why),
  });
  function pickOpts(el, isRight, rightText, why) {
    let locked = false;
    $$('.opt', el).forEach(b => b.addEventListener('click', () => {
      if (locked) return; locked = true; const ok = isRight(+b.dataset.i); count(ok);
      $$('.opt', el).forEach(x => { x.disabled = true; if (isRight(+x.dataset.i)) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong'); feel(ok ? 'ok' : 'bad'); feedback(ok, ok ? (why || 'Correct') : `Answer: ${esc(rightText())}`); nextBtn();
    }));
  }
  const head = (s, ay) => `<small class="kicker">${esc(NAMES[s.n] || '')} · ayah ${ay.n}</small>`;
  async function ctxOf(s) { const list = await getSurahList(); NAMES[s.n] = list[s.n - 1].en; const ays = await ayahsOf(s.n); return { ays, ay: ays.find(x => x.n === s.a) }; }

  R.teach = async s => {
    const { ay } = await ctxOf(s); const words = (await getWords(s.n, s.a)) || wordsOf(ay.ar).map(w => ({ ar: w, en: '', tr: '', au: '' }));
    setGo('Got it', false);
    return {
      html: `<div class="teach">${head(s, ay)}<h2 data-focus class="sr-only">Learn ayah ${ay.n}</h2><div class="teach-ar ar" dir="rtl">${esc(ay.ar)}</div>
        <div class="words" dir="rtl">${words.map((w, i) => `<button class="wd" data-i="${i}" ${w.au ? '' : 'data-na="1"'}><span class="ar">${esc(w.ar)}</span>${w.tr ? `<small class="tr">${esc(w.tr)}</small>` : ''}${w.en ? `<small class="en">${esc(w.en)}</small>` : ''}</button>`).join('')}</div>
        <p class="en-line">${esc(ay.en)}</p>${S.settings.translit ? `<p class="tl">${esc(ay.tr)}</p>` : ''}
        <div class="teach-tools"><button class="btn small" data-t="play">${ic('play', 16)} Listen</button><button class="btn small ghost" data-t="slow">${ic('clock', 16)} <span id="rt">${S.settings.rate && S.settings.rate < 1 ? '0.75×' : '1×'}</span></button><button class="btn small ghost" data-t="nur">${ic('message', 16)} Ask Nur</button></div>
        <p class="hint-line">Tap a word to hear it. Learn these words, then you will be tested on them.</p></div>`,
      init: el => {
        let slow = false;
        $('[data-t=play]', el).onclick = () => { feel('tick'); playClip(audioUrl(ay.g), slow ? .75 : 1); };
        $('[data-t=slow]', el).onclick = e => { slow = !slow; $('#rt', el).textContent = slow ? '0.75×' : '1×'; e.currentTarget.classList.toggle('on', slow); };
        $('[data-t=nur]', el).onclick = () => openNur({ ask: `Explain ayah ${ay.n} of ${NAMES[s.n]} to me word by word, simply.`, extra: `Currently learning ${NAMES[s.n]} ${ay.n}: ${ay.ar} (${ay.en})` });
        $$('.wd', el).forEach(b => b.onclick = () => { const w = words[+b.dataset.i]; b.classList.add('tap'); setTimeout(() => b.classList.remove('tap'), 400); feel('tick'); if (w.au) playClip(w.au, slow ? .8 : 1); });
      },
    };
  };

  R.build = async s => {
    const { ay } = await ctxOf(s), ws = wordsOf(ay.ar);
    const chipHTML = i => `<button class="sw" data-w="${i}"><span class="ar">${esc(ws[i])}</span></button>`;
    return {
      html: `<div class="quiz">${head(s, ay)}<h2 data-focus>Put the ayah in order</h2><p class="en-line">${esc(ay.en)}</p>
        <div class="line answer" id="ans" dir="rtl" data-empty="Tap the words in order"></div><div class="line bank" id="bank" dir="rtl">${s.order.map(chipHTML).join('')}</div>
        <p class="hint-line">Tap to place a word, tap again to remove it, or drag words to reorder.</p></div>`,
      init: el => {
        const ans = $('#ans', el), bank = $('#bank', el); let misses = 0, done = false;
        const seq = () => $$('.sw', ans).map(x => +x.dataset.w), txt = i => strip1(ws[i]);
        const sync = () => { ans.classList.toggle('has', !!ans.children.length); setGo('Check', seq().length !== ws.length, 'check'); $$('.sw', ans).forEach(x => x.classList.remove('bad')); };
        const move = (b, to) => { flip([...$$('.sw', ans), ...$$('.sw', bank)], () => to.appendChild(b)); sync(); };
        const sortA = makeSortable(ans, { items: '.sw', axis: 'x', onChange: sync, onTick: () => haptic('tick') });
        sortables.push(sortA);
        el.addEventListener('click', e => { const b = e.target.closest('.sw'); if (!b || done) return; feel('tick'); clearFb(); move(b, b.parentElement === bank ? ans : bank); });
        st.check = () => {
          const mine = seq(), okAll = mine.every((x, p) => txt(x) === txt(p)); const wrongAt = mine.map((x, p) => txt(x) !== txt(p));
          if (okAll) { done = true; count(misses === 0); $$('.sw', ans).forEach(x => x.classList.add('right')); feel('ok'); feedback(true, misses ? 'Correct' : 'Perfect'); nextBtn(); return; }
          misses++; if (misses === 1) count(false); feel('bad'); $$('.sw', ans).forEach((x, p) => x.classList.toggle('bad', wrongAt[p])); ans.classList.add('shake'); setTimeout(() => ans.classList.remove('shake'), 400);
          feedback(false, misses >= 2 ? 'Still not right. You can reveal the answer.' : 'Not quite. Fix the highlighted words and check again.');
          if (misses >= 2) { st.reveal = true; setGo('Show answer', false, 'reveal'); }
        };
        st.revealFn = () => { done = true; const all = [...$$('.sw', ans), ...$$('.sw', bank)]; const byTxt = all.slice(); flip(all, () => { ws.forEach((_, p) => { const hit = byTxt.find(x => !x._used && txt(+x.dataset.w) === txt(p)); hit._used = true; ans.appendChild(hit); }); }); $$('.sw', ans).forEach(x => x.classList.add('right')); feedback(true, 'Here is the correct order.'); nextBtn(); };
        sync();
      },
    };
  };

  R.fill = async s => {
    const { ay } = await ctxOf(s), ws = wordsOf(ay.ar);
    const line = ws.map((w, i) => i === s.w ? `<span class="gap" id="gap">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>` : `<span>${esc(w)}</span>`).join(' ');
    return {
      html: `<div class="quiz">${head(s, ay)}<h2 data-focus>Which word is missing?</h2><div class="teach-ar ar" dir="rtl">${line}</div><p class="en-line">${esc(ay.en)}</p><div class="opts grid">${s.opts.map((w, i) => `<button class="opt ar-opt" data-i="${i}"><span class="ar" dir="rtl">${esc(w)}</span></button>`).join('')}</div></div>`,
      init: el => { pickOpts(el, i => i === s.c, () => ws[s.w], ''); $$('.opt', el).forEach(b => b.addEventListener('click', () => { const g = $('#gap', el); g.textContent = ws[s.w]; g.classList.add('filled'); })); },
    };
  };

  R.meaning = async s => {
    const { ays, ay } = await ctxOf(s);
    return {
      html: `<div class="quiz">${head(s, ay)}<h2 data-focus>What does this mean?</h2><div class="teach-ar ar" dir="rtl">${esc(ay.ar)}</div><div class="opts col">${s.opts.map((n, i) => `<button class="opt" data-i="${i}">${esc(ays.find(x => x.n === n).en)}</button>`).join('')}</div></div>`,
      init: el => pickOpts(el, i => s.opts[i] === s.a, () => ay.en, ''),
    };
  };

  R.hear = async s => {
    const { ays, ay } = await ctxOf(s);
    return {
      html: `<div class="quiz">${head(s, ay)}<h2 data-focus>Which ayah do you hear?</h2><button class="listen" data-t="play">${ic('play', 26)}<span>Play</span></button><div class="opts col">${s.opts.map((n, i) => `<button class="opt ar-opt" data-i="${i}"><span class="ar" dir="rtl">${esc(clip(ays.find(x => x.n === n).ar))}</span></button>`).join('')}</div></div>`,
      init: el => { const p = () => playClip(audioUrl(ay.g)); $('[data-t=play]', el).onclick = () => { feel('tick'); p(); }; setTimeout(p, 500); pickOpts(el, i => s.opts[i] === s.a, () => clip(ay.ar), ''); },
    };
  };

  R.seq = async s => {
    const { ays } = await ctxOf(s), by = Object.fromEntries(ays.map(a => [a.n, a]));
    const item = k => `<div class="sw row" data-w="${k}"><span class="grip" aria-hidden="true">${ic('grip', 18)}</span><span class="ar" dir="rtl">${esc(clip(by[s.as[k]].ar, 6))}</span><span class="upd"><button data-m="-1" aria-label="Move up">${ic('chevU', 16)}</button><button data-m="1" aria-label="Move down">${ic('chevD', 16)}</button></span></div>`;
    return {
      html: `<div class="quiz"><h2 data-focus>Put these ayahs in order</h2><p class="hint-line">Drag the handle, or use the arrows.</p><div class="vlist" id="vl">${s.order.map(item).join('')}</div></div>`,
      init: el => {
        const vl = $('#vl', el); let misses = 0, done = false;
        const seq = () => $$('.sw', vl).map(x => +x.dataset.w);
        sortables.push(makeSortable(vl, { items: '.sw', handle: '.grip', axis: 'y', onChange: () => { clearFb(); setGo('Check', false, 'check'); }, onTick: () => haptic('tick') }));
        vl.addEventListener('click', e => {
          const b = e.target.closest('[data-m]'); if (!b || done) return; const row = b.closest('.sw'), d = +b.dataset.m, sib = d < 0 ? row.previousElementSibling : row.nextElementSibling; if (!sib) return;
          feel('tick'); flip($$('.sw', vl), () => d < 0 ? sib.before(row) : sib.after(row)); clearFb(); setGo('Check', false, 'check');
        });
        st.check = () => {
          const mine = seq(), ok = mine.every((x, p) => x === p);
          if (ok) { done = true; count(misses === 0); $$('.sw', vl).forEach(x => x.classList.add('right')); feel('ok'); feedback(true, 'Correct order'); nextBtn(); return; }
          misses++; if (misses === 1) count(false); feel('bad'); $$('.sw', vl).forEach((x, p) => x.classList.toggle('bad', +x.dataset.w !== p)); vl.classList.add('shake'); setTimeout(() => vl.classList.remove('shake'), 400);
          feedback(false, misses >= 2 ? 'Still off. You can reveal the answer.' : 'Not quite. Adjust the highlighted ayahs.'); if (misses >= 2) setGo('Show answer', false, 'reveal');
        };
        st.revealFn = () => { done = true; const rows = $$('.sw', vl); flip(rows, () => s.as.forEach((_, p) => vl.appendChild(rows.find(x => +x.dataset.w === p)))); $$('.sw', vl).forEach(x => { x.classList.remove('bad'); x.classList.add('right'); }); feedback(true, 'Here is the correct order.'); nextBtn(); };
        setGo('Check', false, 'check');
      },
    };
  };
  const RENDER = R;

  // ---------- completion
  function complete() {
    stopClip(); const total = sess.ok + sess.bad, acc = total ? sess.ok / total : 1, stars = acc >= .9 ? 3 : acc >= .7 ? 2 : 1;
    const gain = { xp: sess.ok * 4 + 20 + stars * 5 + (sess.kind === 'review' ? 10 : 0), coins: 5 + stars * 3 };
    if (sess.kind === 'lesson') S.lessons[sess.id] = { at: Date.now(), stars: Math.max(stars, (S.lessons[sess.id] || {}).stars || 0) };
    if (sess.kind === 'review') { day().reviews++; (sess.rvDone || []).forEach(x => { const r = sr(x.n); r.rv[x.a] = Date.now(); }); } else day().lessons++;
    if (sess.kind !== 'review') { S.sessions++; if (stars === 3) S.perfects++; }
    const secs = Math.round((Date.now() - sess.started) / 1000);
    const r = reward(gain); S.session = null; save(); sfx('done'); haptic('done');
    const surah = sess.n; const rec = surah ? sr(surah) : null, canMaster = rec && rec.done && !rec.mastered;
    const svgStar = on => `<svg viewBox="0 0 24 24" class="star ${on ? 'on' : ''}"><path d="m12 3.2 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/></svg>`;
    stage.classList.remove('enter'); stage.innerHTML = `<div class="done"><div class="stars">${[1, 2, 3].map(i => svgStar(i <= stars)).join('')}</div><h2 data-focus>${sess.kind === 'review' ? 'Revision complete' : 'Lesson complete'}</h2><p class="muted">${esc(sess.title)}</p>
      <div class="stat-row"><div><b>+${gain.xp}</b><small>XP</small></div><div><b>+${gain.coins}</b><small>coins</small></div><div><b>${Math.round(acc * 100)}%</b><small>accuracy</small></div><div><b>${Math.max(1, Math.round(secs / 60))}m</b><small>time</small></div></div>
      ${r.leveled ? `<p class="lvl-line">${ic('trophy', 18)} Level ${r.leveled} reached</p>` : ''}${sess.learned.length ? `<p class="muted">${sess.learned.length} ayah${sess.learned.length > 1 ? 's' : ''} added to what you know.</p>` : ''}</div>`;
    void stage.offsetWidth; stage.classList.add('enter'); stage.scrollTop = 0; $('[data-focus]', stage)?.focus({ preventScroll: true });
    $('.l-bar i', ov).style.width = '100%'; clearFb();
    const nx = nextItem(window.__surahList || []);
    const foot = $('.l-foot', ov);
    foot.innerHTML = `<div class="col-gap">${surah ? `<button class="btn primary big" data-k="recite">${ic('mic', 18)} ${canMaster ? 'Recite for mastery' : 'Recite what you learned'}</button>` : ''}${nx && sess.kind !== 'review' ? `<button class="btn ${surah ? '' : 'primary big'}" data-k="next">${nx.k === 'lesson' ? 'Next lesson' : 'Next surah'}</button>` : ''}<div class="row-gap"><button class="btn ghost grow" data-k="break">${ic('dice', 16)} Take a break</button><button class="btn ghost grow" data-k="finish">Done</button></div></div>`;
    st.sess = { surah, from: sess.from, to: sess.to, canMaster };
  }

  // ---------- events
  ov.addEventListener('click', async e => {
    const t = e.target.closest('[data-k]'); if (!t) return; const k = t.dataset.k;
    if (k === 'go') { if (go.disabled) return; feel('tap'); advance(); }
    else if (k === 'skip') advance();
    else if (k === 'check') { if (!go.disabled && st.check) st.check(); }
    else if (k === 'reveal') { st.revealFn && st.revealFn(); }
    else if (k === 'exit') exit();
    else if (k === 'finish') close();
    else if (k === 'break') openArcade();
    else if (k === 'next') { close(); setTimeout(() => window.dispatchEvent(new Event('iqra-next')), 320); }
    else if (k === 'recite') { const x = st.sess; const list = await getSurahList(); const ays = await ayahsOf(x.surah); close(); setTimeout(() => openRecite(list[x.surah - 1], ays, { from: x.canMaster ? 1 : x.from, to: x.canMaster ? ays.length : x.to, mastery: x.canMaster }), 320); }
  });
  function exit() {
    stopClip();
    const el = sheet(`<h3>Leave this lesson?</h3><p class="muted">Your place is saved, so you can pick up right where you left off.</p><div class="col-gap"><button class="btn primary" data-x="save">Save and exit</button><button class="btn danger-o" data-x="drop">Discard lesson</button><button class="btn ghost" data-x="stay">Keep going</button></div>`);
    el.addEventListener('click', ev => { const x = ev.target.closest('[data-x]')?.dataset.x; if (!x) return; closeSheet(); if (x === 'save') { save(); close(); } else if (x === 'drop') { S.session = null; save(); close(); } });
  }
  show();
}

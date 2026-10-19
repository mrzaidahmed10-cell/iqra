// Placement quiz: finds your Arabic and Quran level and suggests how strict the recitation coach should be.
// It adapts: if the letters section shows you are new, it stops early instead of piling on.
import { esc, shuffle, feel } from './core.js';
import { ic } from './icons.js';
import { LEVELS, LENIENCY } from './content.js';

const Q = (sec, q, opts, a, o = {}) => ({ sec, q, opts, a, ...o });
const SECTIONS = {
  letters: { n: 'Letters', d: 'Recognizing letters and their sounds' },
  forms: { n: 'Joining', d: 'How letters connect and change shape' },
  vowels: { n: 'Vowel marks', d: 'Harakat, sukoon, shaddah and tanween' },
  reading: { n: 'Reading words', d: 'Sounding out real Arabic' },
  tajweed: { n: 'Tajweed', d: 'The rules that decorate recitation' },
  know: { n: 'Quran knowledge', d: 'Meanings and basics' },
};
const BANK = [
  Q('letters', 'What is this letter called?', ['Ayn', 'Ra', 'Meem', 'Noon'], 0, { qar: 'ع' }),
  Q('letters', 'What is this letter called?', ['Faa', 'Qaf', 'Kaaf', 'Waw'], 1, { qar: 'ق' }),
  Q('letters', 'What is this letter called?', ['Seen', 'Sheen', 'Saad', 'Zay'], 1, { qar: 'ش' }),
  Q('letters', 'Which letter has two dots above it and sounds like "t"?', ['ب', 'ت', 'ث', 'ن'], 1, { ar: 1 }),
  Q('letters', 'Which one is Saad, the heavy "s"?', ['س', 'ص', 'ش', 'ز'], 1, { ar: 1 }),
  Q('letters', 'Which letter is the deep "q" from the back of the throat?', ['ك', 'خ', 'ق', 'غ'], 2, { ar: 1 }),
  Q('forms', 'Which group of letters never joins to the letter after it?', ['ا د ر و', 'ب ت ن ي', 'س ش ص ض', 'ع غ ف ق'], 0, { ar: 1 }),
  Q('forms', 'Many Arabic letters look different at the start, middle and end of a word. Why?', ['Their shape depends on where they sit and what they join', 'They are always identical', 'Only the Quran changes them', 'Only vowel marks change them'], 0),
  Q('forms', 'Does the letter د join to the letter after it, as in دار?', ['No, د never joins forward', 'Yes, always', 'Only with a fatha', 'Only at the end of a word'], 0, { qar: 'دَار' }),
  Q('vowels', 'What sound does this make?', ['ba', 'bi', 'bu', 'b with no vowel'], 0, { qar: 'بَ' }),
  Q('vowels', 'What sound does this make?', ['ti', 'ta', 'tu', 't with no vowel'], 2, { qar: 'تُ' }),
  Q('vowels', 'What does the small circle sukoon ( ْ ) on a letter mean?', ['The letter has no vowel of its own', 'The vowel is long', 'The letter is doubled', 'You must stop here'], 0, { qar: 'مَنْ' }),
  Q('vowels', 'What does the shaddah ( ّ ) do?', ['Doubles the letter', 'Silences the letter', 'Lengthens the vowel', 'Marks a pause'], 0, { qar: 'رَبِّ' }),
  Q('vowels', 'What is the double mark at the end of this word called?', ['Tanween', 'Shaddah', 'Sukoon', 'Madd'], 0, { qar: 'كِتَابٌ' }),
  Q('reading', 'How is this read?', ['kataba', 'kutiba', 'katabi', 'kitabu'], 0, { qar: 'كَتَبَ' }),
  Q('reading', 'How is this read?', ['qul', 'qil', 'qala', 'qulu'], 0, { qar: 'قُلْ' }),
  Q('reading', 'How is this read?', ['rubbi', 'rabbi', 'raba', 'rabi'], 1, { qar: 'رَبِّ' }),
  Q('reading', 'How is this read?', ['malaki', 'maliku', 'maaliki', 'muluki'], 2, { qar: 'مَالِكِ' }),
  Q('reading', 'How is this read?', ['al-humdi', 'al-hamdu', 'ahmadu', 'al-hamda'], 1, { qar: 'ٱلْحَمْدُ' }),
  Q('reading', 'How is this read?', ['yumi l-dini', 'yawma d-deen', 'yawmi d-deen', 'yaumu d-dan'], 2, { qar: 'يَوْمِ ٱلدِّينِ' }),
  Q('tajweed', 'When noon sakinah or tanween meets the letter ب, which rule applies?', ['Idhar', 'Idgham', 'Ikhfa', 'Iqlab'], 3),
  Q('tajweed', 'How long is a natural madd (madd tabi\'i)?', ['1 count', '2 counts', '4 counts', '6 counts'], 1),
  Q('tajweed', 'Which are the letters of qalqalah?', ['ء ه ع ح غ خ', 'ب ت ث ج د', 'ق ط ب ج د', 'ق ك ط ب ج'], 2, { ar: 1 }),
  Q('tajweed', 'What is ikhfa?', ['Hiding the noon sound with a nasal hum', 'Pronouncing the noon clearly', 'Merging the noon into the next letter', 'Turning the noon into a meem'], 0),
  Q('tajweed', 'Noon sakinah before a throat letter (ء ه ع ح غ خ) is pronounced…', ['Clearly (idhar)', 'With a long ghunnah', 'As a meem', 'Merged into the next letter'], 0),
  Q('know', 'What does "Bismillah" mean?', ['In the name of Allah', 'Praise be to Allah', 'Allah is the greatest', 'If Allah wills'], 0),
  Q('know', 'How many ayahs does Al-Fatihah have?', ['5', '6', '7', '8'], 2),
  Q('know', 'Which surah is often called "the heart of the Quran"?', ['Al-Ikhlas', 'Ya-Sin', 'Al-Kahf', 'Al-Baqarah'], 1),
];
const SELF = [
  { id: 'read', q: 'How do you read the Quran today?', opts: [['none', "I can't yet"], ['slow', 'Slowly, I sound things out'], ['ok', 'Comfortably, with some mistakes'], ['fluent', 'Fluently, from the mushaf']] },
  { id: 'mem', q: 'How much have you memorized?', opts: [['0', 'Nothing yet'], ['few', 'A few short surahs'], ['juz', 'Up to a juz'], ['lots', 'More than a juz']] },
  { id: 'teach', q: 'Have you studied tajweed with a teacher?', opts: [['no', 'No'], ['some', 'A little'], ['yes', 'Yes, properly']] },
];

export function recommend(sc, self = {}) {
  const pct = k => sc[k] == null ? null : sc[k];
  const L = pct('letters') ?? 0, F = pct('forms'), V = pct('vowels'), R = pct('reading'), T = pct('tajweed');
  let level = 'new';
  if (L >= .6) {
    level = 'letters';
    const rv = [F, V, R].filter(x => x != null); const avg = rv.length ? rv.reduce((a, b) => a + b, 0) / rv.length : 0;
    if (V != null && R != null && avg >= .6 && R >= .6) {
      level = 'slow';
      if (R >= .8 && (T ?? 0) >= .6 && self.read !== 'none' && self.read !== 'slow') level = 'fluent';
    }
  }
  // Coach strictness: kind to learners, exacting for people who know the rules.
  let leniency = level === 'fluent' ? 'balanced' : level === 'slow' ? 'balanced' : 'gentle';
  if (level === 'fluent' && (T ?? 0) >= .8 && R >= .9 && (self.teach === 'yes' || self.mem === 'lots' || self.mem === 'juz')) leniency = 'strict';
  if (level === 'slow' && (T ?? 0) < .4) leniency = 'gentle';
  return { level, leniency };
}

/** Runs the quiz inside `root`. onDone({level, leniency, scores}) or onCancel(). */
export function runPlacement(root, { onDone, onCancel }) {
  let phase = 'intro', i = 0, queue = [], answers = {}, self = {}, si = 0, picked = null, sc = {}, rec = null;
  const secOrder = ['letters', 'forms', 'vowels', 'reading', 'tajweed', 'know'];
  const bySec = k => BANK.filter(q => q.sec === k);
  let secIdx = 0;
  const pctOf = k => { const qs = bySec(k); if (!qs.length) return null; return qs.reduce((a, q, n) => a + (answers[k + n] === 'ok' ? 1 : 0), 0) / qs.length; };
  const frame = (inner, foot = '') => { root.innerHTML = `<div class="plc enter">${inner}</div>${foot}`; };
  const total = () => queue.length;

  function intro() {
    frame(`<div class="plc-hero">${ic('compass', 40)}</div><h2>Find your level</h2>
      <p class="muted">A short, in-depth check of your Arabic and Quran skills. It covers letters, joining, vowels, reading, tajweed and basics, and it adapts: if the early questions are tough, it stops so you are not discouraged.</p>
      <ul class="plc-list"><li>${ic('clock', 18)} About 4 to 6 minutes</li><li>${ic('eyeOff', 18)} No feedback while you answer, so there is nothing to feel bad about</li><li>${ic('help', 18)} Choose "Not sure" instead of guessing</li><li>${ic('sliders', 18)} Sets your lessons and how strict your recitation coach is. You can change both any time.</li></ul>
      <div class="col-gap"><button class="btn primary big" data-p="start">Start the quiz</button>${onCancel ? '<button class="btn ghost" data-p="cancel">Skip, I will choose myself</button>' : ''}</div>`);
  }
  function startSec() {
    const k = secOrder[secIdx]; if (!k) return selfPhase();
    queue = bySec(k).map((q, n) => ({ ...q, key: k + n, order: shuffle(q.opts.map((_, j) => j)) })); i = 0; phase = 'q'; question();
  }
  function question() {
    const q = queue[i], s = SECTIONS[q.sec], done = BANK.indexOf(BANK.find(b => b === bySec(q.sec)[i])), pr = (secOrder.indexOf(q.sec) + i / total()) / secOrder.length;
    picked = null;
    frame(`<div class="plc-top"><span class="kicker">${s.n} · ${i + 1} of ${total()}</span><div class="progress thin"><i style="width:${Math.round(pr * 100)}%"></i></div></div>
      <h2 data-focus>${esc(q.q)}</h2>${q.qar ? `<div class="big-ar ar" dir="rtl">${esc(q.qar)}</div>` : ''}
      <div class="opts ${q.ar ? 'grid' : 'col'}">${q.order.map(j => `<button class="opt ${q.ar ? 'ar-opt' : ''}" data-p="ans" data-j="${j}">${q.ar ? `<span class="ar" dir="rtl">${esc(q.opts[j])}</span>` : esc(q.opts[j])}</button>`).join('')}</div>
      <button class="btn ghost" data-p="skip">Not sure</button>`);
    void done;
  }
  function answer(j) {
    const q = queue[i]; answers[q.key] = j === q.a ? 'ok' : j === -1 ? 'skip' : 'no'; feel('tick');
    i++; if (i < queue.length) return question();
    const k = q.sec; sc[k] = pctOf(k);
    // adaptive stops
    if (k === 'letters' && sc.letters < .5) { phase = 'early'; return selfPhase(); }
    if (k === 'vowels') { const f = sc.forms ?? 0; if ((f + sc.vowels) / 2 < .5) { phase = 'early'; return selfPhase(); } }
    secIdx++; startSec();
  }
  function selfPhase() {
    phase = 'self'; si = 0; selfQ();
  }
  function selfQ() {
    const q = SELF[si]; if (!q) return result();
    frame(`<div class="plc-top"><span class="kicker">About you · ${si + 1} of ${SELF.length}</span><div class="progress thin"><i style="width:${Math.round(((si + 1) / SELF.length) * 100)}%"></i></div></div><h2 data-focus>${esc(q.q)}</h2>
      <div class="opts col">${q.opts.map(o => `<button class="opt" data-p="self" data-v="${o[0]}">${esc(o[1])}</button>`).join('')}</div>`);
  }
  function result() {
    phase = 'result';
    secOrder.forEach(k => { if (sc[k] === undefined) sc[k] = secOrder.indexOf(k) <= secIdx ? pctOf(k) : null; });
    rec = rec || recommend(sc, self);
    const lv = LEVELS.find(l => l.id === rec.level);
    const bars = secOrder.map(k => { const v = sc[k]; return `<div class="ab plc-b"><span>${SECTIONS[k].n}</span><div class="progress thin ${v == null ? '' : v >= .75 ? 'good' : v >= .5 ? 'mid' : 'low'}"><i style="width:${v == null ? 0 : Math.round(v * 100)}%"></i></div><b>${v == null ? '–' : Math.round(v * 100) + '%'}</b></div>`; }).join('');
    frame(`<div class="plc-hero">${ic(lv.icon, 40)}</div><h2>${esc(lv.t)}</h2><p class="muted">${msg(rec.level)}</p>
      <section class="card"><div class="abars">${bars}</div></section>
      <h3>Your lesson level</h3><div class="levels">${LEVELS.map(l => `<button class="lv ${l.id === rec.level ? 'on' : ''}" data-p="lv" data-l="${l.id}"><span class="ico">${ic(l.icon, 22)}</span><div><b>${l.t}</b><small>${l.d}</small></div>${l.id === rec.level ? ic('check', 20) : ''}</button>`).join('')}</div>
      <h3>Recitation coach strictness</h3><div class="seg" data-p-seg>${Object.entries(LENIENCY).map(([id, v]) => `<button class="${rec.leniency === id ? 'on' : ''}" data-p="len" data-v="${id}">${v.n}</button>`).join('')}</div>
      <p class="muted small" id="lend">${esc(LENIENCY[rec.leniency].d)}</p>
      <div class="col-gap"><button class="btn primary big" data-p="done">Use these settings</button><button class="btn ghost" data-p="again">Retake the quiz</button></div>`);
  }
  const msg = l => ({
    new: 'Letters are the best place to begin. Your plan starts at the very start, and the coach will be gentle and encouraging.',
    letters: 'You know your letters. Next come vowels, joining and reading real Quran words. The coach stays gentle while you build speed.',
    slow: 'You can read, and tajweed is where you will grow most. The coach will be fair and will flag clear mistakes.',
    fluent: 'You read well. Your plan focuses on memorizing and polishing recitation, with a coach that holds you to a high standard.',
  }[l]);

  root.onclick = e => {
    const b = e.target.closest('[data-p]'); if (!b) return; const p = b.dataset.p;
    if (p === 'start') { secIdx = 0; answers = {}; sc = {}; self = {}; rec = null; startSec(); }
    else if (p === 'cancel') onCancel && onCancel();
    else if (p === 'ans') answer(+b.dataset.j);
    else if (p === 'skip') answer(-1);
    else if (p === 'self') { self[SELF[si].id] = b.dataset.v; feel('tick'); si++; selfQ(); }
    else if (p === 'lv') { rec.level = b.dataset.l; feel('tick'); result(); }
    else if (p === 'len') { rec.leniency = b.dataset.v; feel('tick'); root.querySelectorAll('[data-p="len"]').forEach(x => x.classList.toggle('on', x === b)); const d = root.querySelector('#lend'); if (d) d.textContent = LENIENCY[rec.leniency].d; }
    else if (p === 'again') { rec = null; intro(); }
    else if (p === 'done') { feel('done'); onDone({ level: rec.level, leniency: rec.leniency, scores: Object.fromEntries(Object.entries(sc).filter(([, v]) => v != null).map(([k, v]) => [k, Math.round(v * 100)])) }); }
  };
  intro();
  return () => { root.onclick = null; };
}

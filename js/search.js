// Forgiving surah search: ignores "Al-", dashes and punctuation, folds common spelling variants
// (Kawthar / Kausar / Kosar), tolerates typos, understands keywords, and treats Arabic the same way.
const ALIASES = {
  1: 'fatiha fateha fatihah opening alhamd', 2: 'baqara bakara baqarah cow', 3: 'imran family', 4: 'nisa nisaa women', 5: 'maida maidah table feast', 6: 'anam anaam cattle',
  7: 'araf aaraf heights', 9: 'tawba tawbah taubah repentance bara', 10: 'yunus jonah', 11: 'hud hood', 12: 'yusuf yousuf joseph', 13: 'rad raad thunder', 14: 'ibrahim abraham',
  15: 'hijr', 16: 'nahl bee bees', 17: 'isra israa night journey bani israil', 18: 'kahf kehf cave', 19: 'maryam mary mariam', 20: 'taha ta ha', 21: 'anbiya prophets',
  23: 'muminun believers', 24: 'nur noor light', 25: 'furqan criterion', 31: 'luqman lukman', 32: 'sajda sajdah prostration', 33: 'ahzab clans', 36: 'yasin yaseen ya sin yaaseen heart of quran',
  39: 'zumar groups', 40: 'ghafir mumin forgiver', 41: 'fussilat', 42: 'shura consultation', 47: 'muhammad', 48: 'fath victory', 49: 'hujurat rooms', 50: 'qaf', 55: 'rahman rehman merciful',
  56: 'waqia waqiah waqi event', 57: 'hadid iron', 59: 'hashr exile', 62: 'jumua jumuah friday', 67: 'mulk malik dominion sovereignty', 68: 'qalam pen', 71: 'nuh noah', 72: 'jinn',
  73: 'muzzammil', 74: 'muddaththir muddathir', 75: 'qiyama qiyamah resurrection', 76: 'insan dahr man', 78: 'naba nabaa tidings news', 79: 'naziat', 80: 'abasa frowned', 81: 'takwir takweer',
  82: 'infitar', 83: 'mutaffifin', 84: 'inshiqaq', 85: 'buruj', 86: 'tariq tareq', 87: 'ala aala', 88: 'ghashiya ghashiyah', 89: 'fajr dawn', 90: 'balad city', 91: 'shams sun',
  92: 'layl lail night', 93: 'duha dhuha morning', 94: 'sharh inshirah relief', 95: 'tin teen fig', 96: 'alaq iqra clot read', 97: 'qadr power destiny', 98: 'bayyina bayyinah',
  99: 'zalzala zilzal zalzalah earthquake', 100: 'adiyat', 101: 'qaria qariah calamity', 102: 'takathur takasur rivalry', 103: 'asr time', 104: 'humaza humazah slanderer',
  105: 'fil feel elephant', 106: 'quraysh quraish', 107: 'maun maoon small kindnesses', 108: 'kawthar kauthar kausar kosar abundance', 109: 'kafirun kafiroon disbelievers',
  110: 'nasr help', 111: 'masad lahab abu lahab palm fiber', 112: 'ikhlas ikhlaas sincerity oneness purity unity tawhid', 113: 'falaq daybreak', 114: 'nas naas mankind people',
};
const ART = /^(al|an|ar|as|ash|at|ad|az|adh|ath|az|el|en)\s+/;
export function fold(s) {
  s = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`ʿʾ‘]/g, '').replace(/[-_.,/()]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
const stripArt = s => s.replace(ART, '').replace(/^(al|an|ar|as|ash|at|ad|az|adh|ath)(?=[a-z]{4,})/, '');
// Sound-alike folding, so that spelling variants land on the same string.
function phon(s) {
  return s.replace(/kh/g, 'x').replace(/sh/g, 'S').replace(/gh/g, 'G').replace(/th/g, 's').replace(/dh/g, 'z').replace(/ch/g, 'S')
    .replace(/aa|ah?$/g, m => m === 'aa' ? 'a' : 'a').replace(/ee|ii|ei|y$/g, 'i').replace(/oo|uu|ou|ow|o/g, 'u').replace(/aw|au/g, 'u').replace(/ay|ai/g, 'i').replace(/e/g, 'i')
    .replace(/q|c|k/g, 'k').replace(/[zds]/g, 's').replace(/[tT]/g, 't').replace(/w/g, 'u').replace(/(.)\1+/g, '$1').replace(/h$/, '').replace(/\s+/g, '');
}
const skel = s => s.replace(/[aiu]/g, '');
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[n];
}
// Arabic: drop marks, tatweel, "surah", unify letter shapes, drop the leading ال.
export const arFold = s => String(s || '').replace(/[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/g, '').replace(/سور[ةه]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim().replace(/(^|\s)ال(?=\S{2})/g, '$1');
const AR = /[؀-ۿ]/;
function tokenScore(t, targets) {
  let best = 0;
  for (const g of targets) {
    if (!g) continue;
    if (g === t) { best = 100; break; }
    if (g.startsWith(t)) best = Math.max(best, 92 - Math.min(10, g.length - t.length)); else if (t.length >= 3 && g.includes(t)) best = Math.max(best, 78);
    if (t.length >= 3 && g.length >= 3) { const d = lev(t, g), tol = t.length >= 8 ? 2 : t.length >= 4 ? 1 : 0; if (d <= tol) best = Math.max(best, 80 - d * 8); }
  }
  return best;
}
const cache = new WeakMap();
function targetsOf(s) {
  let c = cache.get(s); if (c) return c;
  const names = [s.en, s.tr, ALIASES[s.n] || ''].join(' '), f = fold(names), words = f.split(' ').filter(Boolean);
  const main = stripArt(fold(s.en)), all = new Set();
  [main, ...words, ...words.map(stripArt)].forEach(w => { if (w) all.add(w); });
  const lat = [...all], ph = [...new Set(lat.map(phon))], sk = [...new Set(ph.map(skel))].filter(x => x.length >= 2);
  c = { lat, ph, sk, full: fold(s.en), phFull: phon(stripArt(fold(s.en))), ar: arFold(s.ar), arWords: arFold(s.ar).split(' ') };
  cache.set(s, c); return c;
}
export function scoreSurah(q, s) {
  const T = targetsOf(s), raw = String(q).trim(); if (!raw) return 1;
  if (/^\d+$/.test(raw)) return +raw === s.n ? 100 : (raw.length > 1 && String(s.n).startsWith(raw) ? 30 : 0);
  if (AR.test(raw)) { const qa = arFold(raw); if (!qa) return 0; let sc = 0; for (const t of qa.split(' ')) sc += tokenScore(t, [T.ar, ...T.arWords]); return qa.split(' ').every(t => tokenScore(t, [T.ar, ...T.arWords]) > 0) ? sc / qa.split(' ').length : 0; }
  const toks = fold(raw).split(' ').filter(Boolean).map((t, i, a) => (i === 0 ? stripArt(t + ' x').replace(/ x$/, '') : t)).filter(Boolean);
  if (!toks.length) return 1;
  // whole-query phonetic match first ("al kawthar" == "kausar")
  const whole = phon(stripArt(fold(raw))); let wsc = 0; if (whole.length >= 2) { if (whole === T.phFull) wsc = 98; else if (T.ph.includes(whole)) wsc = 94; else if (T.phFull.startsWith(whole)) wsc = 86; const d = lev(whole, T.phFull); if (whole.length >= 4 && d <= (whole.length >= 8 ? 2 : 1)) wsc = Math.max(wsc, 82 - d * 6); }
  let total = 0;
  for (const t of toks) {
    const a = tokenScore(t, T.lat), b = tokenScore(phon(t), T.ph) - 4, c = skel(phon(t)).length >= 3 ? tokenScore(skel(phon(t)), T.sk) - 20 : 0, sc = Math.max(a, b, c);
    if (sc <= 0) return Math.max(0, wsc); total += sc;
  }
  return Math.max(wsc, total / toks.length);
}
export function searchSurahs(list, q) {
  q = String(q || '').trim(); if (!q) return list;
  const r = list.map(s => [s, scoreSurah(q, s)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1] || a[0].n - b[0].n), top = r.length ? r[0][1] : 0;
  return r.filter(x => x[1] >= top * .75).map(x => x[0]);
}

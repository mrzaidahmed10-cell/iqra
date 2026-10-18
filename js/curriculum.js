// Curriculum: every non-Quran lesson (letters, vowels, joining, reading, tajweed) and the plan for each track.
import { LETTERS, formsOf, FOUNDATION_SURAHS, PATH } from './content.js';

const shuf = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Letters whose sounds are close enough that a quiz should never offer both as options.
const TWINS = ['هح', 'سص', 'تط', 'دض', 'ذظ', 'كق', 'عا', 'ثس', 'ذز', 'خح', 'غع'];
const twin = (a, b) => TWINS.some(p => p.includes(a.c) && p.includes(b.c));
const pickN = (arr, n, not = []) => shuf(arr.filter(x => !not.includes(x) && !not.some(y => y && y.c && twin(x, y)))).slice(0, n);

// A question: correct option + wrong ones. Options are plain strings or {ar:'..'} for Arabic.
const mc = (q, correct, wrong, o = {}) => {
  const all = shuf([correct, ...wrong]);
  const f = x => (typeof x === 'object' ? x : { t: x });
  return { t: 'mcq', q, ...o, opts: all.map(f), a: all.indexOf(correct), why: o.why || '' };
};
const AR = s => ({ ar: s });

// ---------------------------------------------------------------- letters
const groups = Array.from({ length: 7 }, (_, i) => LETTERS.slice(i * 4, i * 4 + 4));
function letterSteps(gi) {
  const g = groups[gi], cards = [], qs = [];
  cards.push({ t: 'card', big: g.map(l => l.c).join('  '), title: gi === 0 ? 'Arabic reads right to left' : 'Meet four new letters', body: `${gi === 0 ? 'The alphabet has 28 letters. ' : ''}In this lesson: ${g.map(l => l.n).join(', ')}. We will look at each one, then you will practise.`, ar: 1 });
  g.forEach(l => cards.push({ t: 'card', big: l.c, title: l.n, body: `Sounds like ${l.s}. Look for: ${l.d}.`, forms: formsOf(l), note: l.j ? '' : 'This letter does not connect to the one after it.', ar: 1 }));
  const others = LETTERS.filter(l => !g.includes(l));
  g.forEach(l => {
    qs.push(mc(`Which letter is ${l.n}?`, AR(l.c), pickN(LETTERS, 3, [l]).map(x => AR(x.c)), { grid: 1 }));
    qs.push(mc('What is this letter called?', l.n, pickN(LETTERS, 3, [l]).map(x => x.n), { qar: l.c }));
    qs.push(mc(`Which letter sounds like ${l.s}?`, AR(l.c), pickN(others, 3, [l]).map(x => AR(x.c)), { grid: 1 }));
  });
  const l = g[1], mid = x => formsOf(x)[x.j ? 2 : 1][1];
  qs.push(mc(`Which one is ${l.n} in the middle of a word?`, AR(mid(l)), g.filter(x => x !== l && x.j).map(x => AR(mid(x))), { grid: 1 }));
  return cards.concat(shuf(qs));
}

// ---------------------------------------------------------------- static lessons (cards then questions)
const C = (title, body, extra = {}) => ({ t: 'card', title, body, ...extra });
const ex = (...pairs) => pairs.map(([ar, tr]) => ({ ar, tr }));

const STATIC = {
  'v-short': {
    title: 'Short vowels', sub: 'Fatha, damma, kasra', icon: 'sparkle',
    cards: [
      C('Marks that make the sound', 'Arabic letters are consonants. Small marks above or below tell you the vowel. These three are the short vowels.', { big: 'بَ  بُ  بِ', ar: 1 }),
      C('Fatha: a short "a"', 'A small slanted line above the letter. بَ is "ba".', { ex: ex(['بَ', 'ba'], ['تَ', 'ta'], ['سَ', 'sa']) }),
      C('Damma: a short "u"', 'A tiny و shape above the letter. بُ is "bu".', { ex: ex(['بُ', 'bu'], ['تُ', 'tu'], ['سُ', 'su']) }),
      C('Kasra: a short "i"', 'A small slanted line below the letter. بِ is "bi".', { ex: ex(['بِ', 'bi'], ['تِ', 'ti'], ['سِ', 'si']) }),
    ],
    qs: () => [
      mc('How is بَ read?', 'ba', ['bu', 'bi', 'b']), mc('How is مُ read?', 'mu', ['ma', 'mi', 'm']), mc('How is نِ read?', 'ni', ['na', 'nu', 'n']),
      mc('Which one says "su"?', AR('سُ'), [AR('سَ'), AR('سِ')], { grid: 1 }), mc('Which one says "ti"?', AR('تِ'), [AR('تَ'), AR('تُ')], { grid: 1 }),
      mc('Which mark is a kasra?', AR('بِ'), [AR('بَ'), AR('بُ')], { grid: 1 }), mc('How is لَ read?', 'la', ['lu', 'li', 'l']), mc('How is كُ read?', 'ku', ['ka', 'ki', 'k']),
    ],
  },
  'v-sukoon': {
    title: 'Sukoon and shaddah', sub: 'Silent stops and doubled letters', icon: 'sparkle',
    cards: [
      C('Sukoon: no vowel', 'A small circle ْ above a letter means it has no vowel. You stop on the sound and move straight to the next letter.', { ex: ex(['أَبْ', 'ab'], ['مَنْ', 'man'], ['قَدْ', 'qad']) }),
      C('Shaddah: a doubled letter', 'A little "w" shape ّ above a letter means the letter is said twice: first closed, then opened with its vowel.', { ex: ex(['رَبَّ', 'rab-ba'], ['إِنَّ', 'in-na'], ['ثُمَّ', 'thum-ma']) }),
    ],
    qs: () => [
      mc('What does a sukoon mean?', 'The letter has no vowel', ['A long vowel', 'Say the letter twice', 'Skip the letter']),
      mc('How is مَنْ read?', 'man', ['mana', 'maan', 'ma']), mc('What does a shaddah mean?', 'The letter is doubled', ['The letter is silent', 'A long vowel', 'A pause']),
      mc('How is إِنَّ read?', 'in-na', ['ina', 'inn', 'in-la']), mc('Which word has a shaddah?', AR('رَبَّ'), [AR('رَبْ'), AR('رَبِ')], { grid: 1 }), mc('Which word ends in a sukoon?', AR('قَدْ'), [AR('قَدَ'), AR('قَدُ')], { grid: 1 }),
    ],
  },
  'v-tanween': {
    title: 'Tanween', sub: 'The "-n" endings', icon: 'sparkle',
    cards: [
      C('Doubled marks add an "n"', 'Two fathas, two dammas or two kasras at the end of a word add an "n" sound. They only appear at the end of a word.', { big: 'ـً  ـٌ  ـٍ', ar: 1 }),
      C('The three tanween', 'Fathatayn adds "an" (and usually an alif), dammatayn adds "un", kasratayn adds "in".', { ex: ex(['كِتَابًا', 'kitaaban'], ['كِتَابٌ', 'kitaabun'], ['كِتَابٍ', 'kitaabin']) }),
    ],
    qs: () => [
      mc('How is كِتَابٌ read?', 'kitaabun', ['kitaaban', 'kitaabin', 'kitaab']), mc('How is كِتَابٍ read?', 'kitaabin', ['kitaaban', 'kitaabun', 'kitaabi']),
      mc('Which ending says "an"?', AR('ـًا'), [AR('ـٌ'), AR('ـٍ')], { grid: 1 }), mc('Which sound does tanween add?', '"n"', ['"m"', '"l"', 'nothing']),
      mc('How is رَحِيمًا read?', 'raheeman', ['raheemun', 'raheemin', 'raheema']),
    ],
  },
  'v-long': {
    title: 'Long vowels', sub: 'Alif, waw and ya stretch the sound', icon: 'sparkle',
    cards: [
      C('Three letters stretch a vowel', 'Alif after a fatha makes "aa". Waw after a damma makes "oo". Ya after a kasra makes "ee". Hold the sound for two beats.', { big: 'بَا  بُو  بِي', ar: 1 }),
      C('In real words', 'Listen for the stretch: قَالَ is "qaa-la", يَقُولُ is "ya-qoo-lu", قِيلَ is "qee-la".', { ex: ex(['قَالَ', 'qaala'], ['يَقُولُ', 'yaqoolu'], ['قِيلَ', 'qeela']) }),
    ],
    qs: () => [
      mc('How is بَا read?', 'baa', ['ba', 'bu', 'bee']), mc('How is بُو read?', 'boo', ['bu', 'baa', 'bee']), mc('How is بِي read?', 'bee', ['bi', 'baa', 'boo']),
      mc('How is قَالَ read?', 'qaala', ['qala', 'qeela', 'qoola']), mc('Which letter stretches a kasra?', AR('ي'), [AR('ا'), AR('و')], { grid: 1 }), mc('How long do you hold a long vowel?', 'Two beats', ['One beat', 'Six beats', 'Not at all']),
    ],
  },
  join: {
    title: 'Joining letters', sub: 'How letters connect into words', icon: 'route',
    cards: [
      C('Letters change shape', 'Inside a word most letters connect, and each has a start, middle and end shape. Nothing else about the letter changes.', { big: 'ك ت ب', ex: ex(['كتب', 'k - t - b'], ['كَتَبَ', 'kataba']), ar: 1 }),
      C('Six letters never connect forward', 'ا د ذ ر ز و stop the chain. The next letter starts fresh, so a small gap shows up.', { big: 'ا د ذ ر ز و', ar: 1, note: 'Remember them together: they are the letters that "break" a word.' }),
    ],
    qs: () => [
      mc('Which letter does NOT connect to the next one?', AR('ر'), [AR('ب'), AR('س'), AR('ل')], { grid: 1 }), mc('Which letter does NOT connect to the next one?', AR('و'), [AR('م'), AR('ن'), AR('ي')], { grid: 1 }),
      mc('Which letter connects to the next one?', AR('ت'), [AR('د'), AR('ذ'), AR('ز')], { grid: 1 }), mc('Which is the word "kitaab"?', AR('كِتَاب'), [AR('بَيْت'), AR('قَلَم'), AR('بَاب')], { grid: 1 }),
      mc('Which is the word "bayt"?', AR('بَيْت'), [AR('كِتَاب'), AR('قَلَم'), AR('نُور')], { grid: 1 }), mc('How many letters never connect forward?', 'Six', ['Two', 'Ten', 'None']),
    ],
  },
  'read-1': {
    title: 'First Quran words', sub: 'Words from Al-Fatiha', icon: 'book',
    cards: [
      C('Words you will hear every day', 'These words open the Quran. Read each one slowly: letters, vowels, then the whole word.', { ex: ex(['بِسْمِ', 'bismi: in the name of'], ['ٱللَّهِ', 'allahi: Allah'], ['ٱلرَّحْمَٰنِ', 'ar-rahmaani: the Most Merciful'], ['ٱلرَّحِيمِ', 'ar-raheemi: the Especially Merciful']) }),
      C('More from Al-Fatiha', 'Praise, Lord, and the Day of Judgment.', { ex: ex(['ٱلْحَمْدُ', 'al-hamdu: all praise'], ['رَبِّ', 'rabbi: Lord'], ['يَوْمِ', 'yawmi: day'], ['ٱلدِّينِ', 'ad-deen: the judgment']) }),
      C('A prayer for guidance', 'The heart of the surah is a request.', { ex: ex(['نَعْبُدُ', "na'budu: we worship"], ['نَسْتَعِينُ', "nasta'een: we seek help"], ['ٱهْدِنَا', 'ihdina: guide us'], ['ٱلْمُسْتَقِيمَ', 'al-mustaqeem: the straight']) }),
    ],
    qs: () => [
      mc('Which word is "rabbi"?', AR('رَبِّ'), [AR('يَوْمِ'), AR('نَعْبُدُ'), AR('ٱلدِّينِ')], { grid: 1 }), mc('Which word is "yawmi"?', AR('يَوْمِ'), [AR('رَبِّ'), AR('بِسْمِ'), AR('ٱلْحَمْدُ')], { grid: 1 }),
      mc('What does ٱهْدِنَا mean?', 'Guide us', ['We worship', 'The day', 'The straight']), mc('What does نَعْبُدُ mean?', 'We worship', ['Guide us', 'Praise', 'The Lord']), mc('How is ٱلْحَمْدُ read?', 'al-hamdu', ['al-hamdi', 'ar-rabbu', 'al-yawmi']),
      mc('What does بِسْمِ mean?', 'In the name of', ['All praise', 'The day of', 'We seek help']), mc('Which word is "ad-deen"?', AR('ٱلدِّينِ'), [AR('ٱلرَّحِيمِ'), AR('ٱلْمُسْتَقِيمَ'), AR('نَسْتَعِينُ')], { grid: 1 }),
    ],
  },
  // ---------------------------------------------------------------- tajweed
  't-noon': {
    title: 'Noon sakinah and tanween', sub: 'The four rules at a glance', icon: 'book',
    disclaimer: 1,
    cards: [
      C('One sound, four behaviours', 'When a noon with sukoon (نْ) or any tanween is followed by a letter, how you say it depends on that letter. The four rules are idhaar, idghaam, iqlaab and ikhfaa.', { big: 'نْ  ـًـٌـٍ', ar: 1 }),
      C('Which letter decides?', 'Idhaar: ء هـ ع ح غ خ. Idghaam: ي ر م ل و ن. Iqlaab: ب. Ikhfaa: the other 15 letters.', { ex: ex(['ء ه ع ح غ خ', 'idhaar: clear'], ['ي ر م ل و ن', 'idghaam: merge'], ['ب', 'iqlaab: swap'], ['ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك', 'ikhfaa: hide']) }),
    ],
    qs: () => [
      mc('Noon sakinah before ب follows which rule?', 'Iqlaab', ['Idhaar', 'Idghaam', 'Ikhfaa']), mc('Noon sakinah before ع follows which rule?', 'Idhaar', ['Iqlaab', 'Idghaam', 'Ikhfaa']),
      mc('Noon sakinah before ي follows which rule?', 'Idghaam', ['Idhaar', 'Iqlaab', 'Ikhfaa']), mc('Noon sakinah before ت follows which rule?', 'Ikhfaa', ['Idhaar', 'Idghaam', 'Iqlaab']),
      mc('How many letters trigger idghaam?', 'Six', ['One', 'Fifteen', 'Twenty-eight']),
    ],
  },
  't-idhar': {
    title: 'Idhaar: clear pronunciation', sub: 'Say the noon plainly', icon: 'book',
    cards: [
      C('The throat letters', 'When noon sakinah or tanween meets a throat letter (ء هـ ع ح غ خ), say the noon clearly. Do not blend it and do not add a nasal hum.', { big: 'ء  هـ  ع  ح  غ  خ', ar: 1 }),
      C('Examples from the Quran', 'Hear the noon stay crisp each time.', { ex: ex(['مِنْ هَادٍ', 'min haadin'], ['مَنْ آمَنَ', 'man aamana'], ['أَنْعَمْتَ', "an'amta"], ['مِنْ خَيْرٍ', 'min khayrin']) }),
    ],
    qs: () => [
      mc('How is the noon said in idhaar?', 'Clearly, without blending', ['Merged into the next letter', 'Hidden with a nasal hum', 'Changed into meem']),
      mc('Which example has idhaar?', AR('مِنْ هَادٍ'), [AR('مِنْ بَعْدِ'), AR('مَنْ يَقُولُ'), AR('مِنْ قَبْلُ')], { grid: 1 }), mc('Which letter triggers idhaar?', AR('ح'), [AR('ب'), AR('ر'), AR('ت')], { grid: 1 }),
      mc('أَنْعَمْتَ has noon before which letter?', 'Ain, so idhaar', ['Ta, so ikhfaa', 'Ba, so iqlaab', 'Ya, so idghaam']), mc('مِنْ خَيْرٍ is...', 'Idhaar', ['Ikhfaa', 'Iqlaab', 'Idghaam']),
    ],
  },
  't-idgham': {
    title: 'Idghaam: merging', sub: 'Blend into the next letter', icon: 'book',
    cards: [
      C('Six letters: يرملون', 'Noon sakinah or tanween blends into ي ر م ل و ن when the next word begins with one of them. The noon disappears into that letter.', { big: 'ي ر م ل و ن', ar: 1 }),
      C('With ghunnah (nasal)', 'Before ي ن م و, blend and hold a nasal hum for about two beats.', { ex: ex(['مَنْ يَقُولُ', 'may-yaqoolu'], ['مِنْ وَالٍ', 'miw-waalin']) }),
      C('Without ghunnah', 'Before ل and ر, blend completely with no hum.', { ex: ex(['مِنْ رَبِّهِمْ', 'mir-rabbihim'], ['مِنْ لَدُنْهُ', 'mil-ladunhu']) }),
      C('One exception', 'If the noon and the idghaam letter sit in the same word, say the noon clearly instead.', { ex: ex(['دُنْيَا', 'dunyaa'], ['بُنْيَانٌ', 'bunyaanun']) }),
    ],
    qs: () => [
      mc('Which letters merge WITHOUT ghunnah?', 'ل and ر', ['ي and م', 'ن and و', 'ب and ت']), mc('مَنْ يَقُولُ is idghaam...', 'With ghunnah', ['Without ghunnah', 'It is idhaar', 'It is iqlaab']),
      mc('مِنْ رَبِّهِمْ is idghaam...', 'Without ghunnah', ['With ghunnah', 'It is ikhfaa', 'It is idhaar']), mc('Why is دُنْيَا said clearly?', 'The noon and ya are in the same word', ['It is iqlaab', 'It has a shaddah', 'It is a long vowel']),
      mc('Which is an idghaam letter?', AR('م'), [AR('ب'), AR('ع'), AR('ك')], { grid: 1 }),
    ],
  },
  't-iqlab': {
    title: 'Iqlaab: swapping', sub: 'Noon becomes a hidden meem', icon: 'book',
    cards: [
      C('Only one letter: ب', 'When noon sakinah or tanween meets ba, the noon turns into a meem. Close your lips lightly and hold a nasal hum for two beats.', { big: 'نْ + ب  ←  مْ', ar: 1 }),
      C('Examples', 'Listen for the closed lips and the hum.', { ex: ex(['مِنْ بَعْدِ', 'mim ba\'di'], ['سَمِيعٌ بَصِيرٌ', 'samee\'um baseer'], ['أَنْبِئْهُمْ', 'ambi\'hum']) }),
    ],
    qs: () => [
      mc('What does the noon turn into before ب?', 'A meem', ['A lam', 'Nothing', 'A ra']), mc('Which example has iqlaab?', AR('مِنْ بَعْدِ'), [AR('مِنْ هَادٍ'), AR('مِنْ قَبْلُ'), AR('مَنْ يَقُولُ')], { grid: 1 }),
      mc('How are the lips during iqlaab?', 'Lightly closed', ['Wide open', 'Rounded', 'Teeth showing']), mc('How many letters trigger iqlaab?', 'One', ['Six', 'Fifteen', 'Two']),
    ],
  },
  't-ikhfa': {
    title: 'Ikhfaa: hiding', sub: 'Between clear and merged', icon: 'book',
    cards: [
      C('Fifteen letters', 'For the remaining 15 letters the noon is neither clear nor fully merged: it hides, with a nasal hum for two beats, while your tongue prepares the next letter.', { ex: ex(['ت ث ج د ذ', '5 letters'], ['ز س ش ص ض', '5 letters'], ['ط ظ ف ق ك', '5 letters']) }),
      C('A memory line', 'Each word of this line begins with one of the fifteen letters, in order:', { big: 'صِفْ ذَا ثَنَا كَمْ جَادَ شَخْصٌ قَدْ سَمَا دُمْ طَيِّبًا زِدْ فِي تُقًى ضَعْ ظَالِمَا', ar: 1, small: 1 }),
      C('Examples', 'Hum gently, do not say a clear noon.', { ex: ex(['أَنْتَ', 'anta'], ['كُنْتُمْ', 'kuntum'], ['مِنْ قَبْلُ', 'min qablu'], ['مِنْ شَرِّ', 'min sharri']) }),
    ],
    qs: () => [
      mc('How many letters trigger ikhfaa?', 'Fifteen', ['Six', 'Ten', 'Twenty']), mc('مِنْ شَرِّ is...', 'Ikhfaa', ['Idhaar', 'Iqlaab', 'Idghaam']), mc('أَنْتَ is...', 'Ikhfaa', ['Idhaar', 'Iqlaab', 'Idghaam']),
      mc('How is the noon pronounced in ikhfaa?', 'Hidden, with a nasal hum', ['Perfectly clear', 'Turned into meem', 'Dropped entirely']), mc('Which letter triggers ikhfaa?', AR('ق'), [AR('ع'), AR('ب'), AR('ل')], { grid: 1 }),
    ],
  },
  't-meem': {
    title: 'Meem sakinah', sub: 'Three lip rules', icon: 'book',
    cards: [
      C('Meem with sukoon (مْ)', 'There are three rules, all about the lips. They depend on the letter after the meem.', { big: 'مْ', ar: 1 }),
      C('Ikhfaa shafawi: before ب', 'Hide the meem lightly with the lips almost touching and a short hum.', { ex: ex(['تَرْمِيهِمْ بِحِجَارَةٍ', 'tarmeehim bihijaaratin']) }),
      C('Idghaam shafawi: before م', 'Two meems become one, with a hum for two beats.', { ex: ex(['لَهُمْ مَا', 'lahum-maa']) }),
      C('Idhaar shafawi: any other letter', 'Say the meem clearly. Take extra care before و and ف so you do not hide it.', { ex: ex(['أَنْعَمْتَ عَلَيْهِمْ', "an'amta 'alayhim"], ['هُمْ فِيهَا', 'hum feehaa']) }),
    ],
    qs: () => [
      mc('Meem sakinah before ب is...', 'Ikhfaa shafawi', ['Idghaam shafawi', 'Idhaar shafawi', 'Iqlaab']), mc('Meem sakinah before م is...', 'Idghaam shafawi', ['Ikhfaa shafawi', 'Idhaar shafawi', 'Iqlaab']),
      mc('Meem sakinah before ف is...', 'Idhaar shafawi', ['Ikhfaa shafawi', 'Idghaam shafawi', 'Idghaam']), mc('Which example is idhaar shafawi?', AR('هُمْ فِيهَا'), [AR('لَهُمْ مَا'), AR('تَرْمِيهِمْ بِ')], { grid: 1 }),
    ],
  },
  't-madd1': {
    title: 'Natural madd', sub: 'The basic stretch of two beats', icon: 'book',
    cards: [
      C('Madd means stretching', 'The natural stretch (madd asli) happens on a long vowel when no hamza or sukoon follows. Hold it for two beats.', { big: 'ـَا  ـُو  ـِي', ar: 1 }),
      C('Three triggers', 'Alif after fatha, waw after damma and ya after kasra. Count "one-two" without rushing.', { ex: ex(['قَالَ', 'qaa-la'], ['يَقُولُ', 'ya-qoo-lu'], ['قِيلَ', 'qee-la']) }),
    ],
    qs: () => [
      mc('How long is natural madd?', 'Two beats', ['Four beats', 'Six beats', 'One beat']), mc('Which word has a natural madd?', AR('قَالَ'), [AR('قَدْ'), AR('مَنْ'), AR('رَبَّ')], { grid: 1 }),
      mc('Which letter stretches after a damma?', AR('و'), [AR('ا'), AR('ي')], { grid: 1 }), mc('يَقُولُ stretches on...', 'The waw', ['The ya', 'The lam', 'The qaf']),
    ],
  },
  't-madd2': {
    title: 'Longer madd', sub: 'When a hamza or sukoon follows', icon: 'book',
    disclaimer: 1,
    cards: [
      C('Madd muttasil: joined', 'A long vowel followed by a hamza in the same word. Hold it four to five beats.', { ex: ex(['جَاءَ', 'jaa-a'], ['ٱلسَّمَاءِ', 'as-samaa-i']) }),
      C('Madd munfasil: separated', 'A long vowel at the end of one word and a hamza at the start of the next. Commonly four to five beats in Hafs, though two is also reported.', { ex: ex(['بِمَا أُنْزِلَ', 'bimaa unzila']) }),
      C('Madd lazim: necessary', 'A long vowel followed by a permanent sukoon or shaddah. Always six beats.', { ex: ex(['ٱلضَّالِّينَ', 'ad-daaal-leen']) }),
    ],
    qs: () => [
      mc('How long is madd lazim?', 'Six beats', ['Two beats', 'Four beats', 'One beat']), mc('جَاءَ is which madd?', 'Muttasil', ['Munfasil', 'Lazim', 'Natural']),
      mc('بِمَا أُنْزِلَ is which madd?', 'Munfasil', ['Muttasil', 'Lazim', 'Natural']), mc('ٱلضَّالِّينَ is which madd?', 'Lazim', ['Muttasil', 'Munfasil', 'Natural']),
    ],
  },
  't-qalqalah': {
    title: 'Qalqalah: the echo', sub: 'Five bouncing letters', icon: 'book',
    cards: [
      C('ق ط ب ج د', 'When one of these five letters has a sukoon, release it with a light echo or bounce. Remember them as "qutbu jadin".', { big: 'ق  ط  ب  ج  د', ar: 1 }),
      C('Examples', 'The bounce is stronger at the end of a pause than in the middle of a word.', { ex: ex(['ٱقْتَرَبَ', 'iqtaraba'], ['ٱلْأَبْتَرُ', 'al-abtaru'], ['يَجْعَلُ', "yaj'alu"], ['قَدْ', 'qad']) }),
    ],
    qs: () => [
      mc('Which letters have qalqalah?', 'ق ط ب ج د', ['ق ك ب ج ل', 'ص ض ط ظ ق', 'ا و ي م ن']), mc('Which word has qalqalah?', AR('يَجْعَلُ'), [AR('مَنْ'), AR('هُمْ'), AR('يَوْمِ')], { grid: 1 }),
      mc('When does qalqalah happen?', 'When the letter has a sukoon', ['When it has a shaddah', 'Only before alif', 'Never inside a word']),
    ],
  },
  't-ghunnah': {
    title: 'Ghunnah', sub: 'The nasal hum', icon: 'book',
    cards: [
      C('Noon and meem with shaddah', 'Whenever noon or meem has a shaddah, hum through the nose for two beats. This is the fullest ghunnah.', { ex: ex(['إِنَّ', 'inna'], ['ثُمَّ', 'thumma'], ['ٱلنَّاسِ', 'an-naasi'], ['عَمَّ', "'amma"]) }),
      C('Count it', 'Hold the hum for two beats, like a natural madd, then release into the vowel.', { note: 'The hum comes from the nose, not the throat.' }),
    ],
    qs: () => [
      mc('How long is the fullest ghunnah?', 'Two beats', ['Four beats', 'Six beats', 'One beat']), mc('Which word has a ghunnah on a shaddah?', AR('ثُمَّ'), [AR('كَتَبَ'), AR('قَدْ'), AR('رَبِّ')], { grid: 1 }),
      mc('Where does ghunnah come from?', 'The nose', ['The throat', 'The tongue tip', 'The lips only']),
    ],
  },
  't-heavy': {
    title: 'Heavy and light letters', sub: 'Full mouth and thin mouth', icon: 'book',
    cards: [
      C('Seven heavy letters', 'These letters are said with the back of the tongue raised, giving a full, deep sound:', { big: 'خ  ص  ض  غ  ط  ق  ظ', ar: 1, note: 'Remember: خُصَّ ضَغْطٍ قِظْ' }),
      C('The Lam of Allah', 'Say the lam in "Allah" heavy after a fatha or damma, and light after a kasra.', { ex: ex(['رَسُولُ ٱللَّهِ', 'rasoolu llaahi: heavy'], ['بِسْمِ ٱللَّهِ', 'bismi llaahi: light']) }),
    ],
    qs: () => [
      mc('Which letter is heavy?', AR('ص'), [AR('س'), AR('ت'), AR('د')], { grid: 1 }), mc('Which letter is heavy?', AR('ق'), [AR('ك'), AR('ب'), AR('ن')], { grid: 1 }),
      mc('The lam in رَسُولُ ٱللَّهِ is...', 'Heavy', ['Light', 'Silent', 'Doubled']), mc('The lam in بِسْمِ ٱللَّهِ is...', 'Light', ['Heavy', 'Silent', 'Doubled']),
      mc('How many heavy letters are there?', 'Seven', ['Three', 'Twelve', 'Twenty']),
    ],
  },
};

export const DISCLAIMER = 'Tajweed is best learned with a teacher. Counts for madd vary by recitation style (riwayah); this app follows Hafs.';

// ---------------------------------------------------------------- registry
export const UNITS = [
  { id: 'letters', title: 'Arabic letters', sub: 'All 28 letters, four at a time', icon: 'type', ids: groups.map((_, i) => `letters-${i + 1}`) },
  { id: 'vowels', title: 'Vowels and marks', sub: 'How Arabic is voiced', icon: 'sparkle', ids: ['v-short', 'v-sukoon', 'v-tanween', 'v-long'] },
  { id: 'reading', title: 'Reading', sub: 'Joining letters and first words', icon: 'route', ids: ['join', 'read-1'] },
  { id: 'tajweed', title: 'Tajweed', sub: 'The rules of recitation', icon: 'book', ids: ['t-noon', 't-idhar', 't-idgham', 't-iqlab', 't-ikhfa', 't-meem', 't-madd1', 't-madd2', 't-qalqalah', 't-ghunnah', 't-heavy'] },
];

const META = {};
groups.forEach((g, i) => { META[`letters-${i + 1}`] = { id: `letters-${i + 1}`, unit: 'letters', title: `Letters: ${g.map(l => l.n).join(', ')}`, short: g.map(l => l.c).join(' '), sub: `Lesson ${i + 1} of 7`, icon: 'type' }; });
Object.entries(STATIC).forEach(([id, d]) => { META[id] = { id, unit: UNITS.find(u => u.ids.includes(id)).id, title: d.title, sub: d.sub, icon: d.icon, disclaimer: !!d.disclaimer }; });
export const lessonMeta = id => META[id];
export const allLessonIds = UNITS.flatMap(u => u.ids);

/** Fresh, serialisable steps for a lesson. Cards first, then questions: always teach before testing. */
export function lessonSteps(id) {
  if (id.startsWith('letters-')) return letterSteps(+id.split('-')[1] - 1);
  const d = STATIC[id]; if (!d) return [];
  const steps = d.cards.map(c => ({ ...c }));
  if (d.disclaimer) steps.push({ t: 'card', title: 'A note on learning tajweed', body: DISCLAIMER });
  return steps.concat(shuf(d.qs()));
}

// ---------------------------------------------------------------- plans
const TAJ = UNITS.find(u => u.id === 'tajweed').ids, LET = UNITS[0].ids, VOW = UNITS[1].ids, RD = UNITS[2].ids;
export function planOf(track) {
  const L = id => ({ k: 'lesson', id }), Sx = n => ({ k: 'surah', n });
  if (track === 'foundations') return [...LET, ...VOW, ...RD].map(L).concat(FOUNDATION_SURAHS.map(Sx));
  if (track === 'reading') return [...VOW, ...RD].map(L).concat(FOUNDATION_SURAHS.map(Sx));
  if (track === 'tajweed') {
    const out = [Sx(1)], s = PATH.filter(n => n !== 1);
    TAJ.forEach((id, i) => { out.push(L(id)); if (s[i]) out.push(Sx(s[i])); });
    return out.concat(s.slice(TAJ.length).map(Sx));
  }
  return PATH.map(Sx);
}

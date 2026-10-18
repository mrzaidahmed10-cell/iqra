// Static content: themes, letters, tracks, hadith, advice.

export const TITLES = ['Seeker', 'Reader', 'Listener', 'Memorizer', 'Reciter', 'Guardian', 'Student of Light', 'Scholar', 'Luminary', 'Noor'];

// Surahs taught in each track, in order. Short surahs first, so every lesson stays small.
export const FOUNDATION_SURAHS = [1, 112, 114, 113, 108, 103, 110, 109, 107, 111, 105, 106, 102, 101, 100];
export const PATH = [1, ...Array.from({ length: 37 }, (_, i) => 114 - i), 67, 36, 55, 56, 18, 32, 2];

// h = hue. Everything in the UI is derived from this one number.
export const THEMES = [
  { id: 'lapis', name: 'Lapis', h: 228, cost: 0, lvl: 1 },
  { id: 'malachite', name: 'Malachite', h: 162, cost: 120, lvl: 2 },
  { id: 'madder', name: 'Madder', h: 346, cost: 220, lvl: 4 },
  { id: 'saffron', name: 'Saffron', h: 38, cost: 320, lvl: 6 },
  { id: 'amethyst', name: 'Amethyst', h: 272, cost: 480, lvl: 9 },
];

// Avatars are icon names from icons.js
export const AVATARS = [
  { id: 'moon', cost: 0, lvl: 1 }, { id: 'star', cost: 40, lvl: 2 }, { id: 'book', cost: 80, lvl: 2 },
  { id: 'dome', cost: 100, lvl: 3 }, { id: 'leaf', cost: 120, lvl: 4 }, { id: 'feather', cost: 150, lvl: 5 },
  { id: 'compass', cost: 200, lvl: 6 }, { id: 'sunrise', cost: 260, lvl: 8 }, { id: 'mountain', cost: 300, lvl: 10 },
  { id: 'cube', cost: 450, lvl: 12 }, { id: 'gem', cost: 700, lvl: 15 }, { id: 'crown', cost: 1200, lvl: 20 },
];

export const FAST_TYPES = [
  { id: 'ramadan', l: 'Ramadan', i: 'moon' },
  { id: 'monthu', l: 'Monday / Thursday', i: 'calendar' },
  { id: 'white', l: 'White days (13–15)', i: 'circle' },
  { id: 'arafah', l: 'Day of Arafah', i: 'mountain' },
  { id: 'ashura', l: 'Ashura', i: 'feather' },
  { id: 'shawwal', l: 'Six of Shawwal', i: 'sparkle' },
  { id: 'qada', l: 'Make-up (qada)', i: 'repeat' },
  { id: 'nafl', l: 'Voluntary', i: 'heart' },
];

export const LEVELS = [
  { id: 'new', t: 'Brand new', d: "I don't know the Arabic letters yet", icon: 'leaf', track: 'foundations' },
  { id: 'letters', t: 'I know the letters', d: 'I can recognise them but not read words', icon: 'type', track: 'reading' },
  { id: 'slow', t: 'I read slowly', d: 'I can read, and want better tajweed', icon: 'book', track: 'tajweed' },
  { id: 'fluent', t: 'I read fluently', d: 'I want to memorise and perfect it', icon: 'crown', track: 'hifz' },
];
export const TRACKS = {
  foundations: { n: 'Foundations', d: 'Letters, vowels, then your first short surahs', icon: 'leaf' },
  reading: { n: 'Reading', d: 'Vowels, joining, then real Quran words', icon: 'type' },
  tajweed: { n: 'Tajweed', d: 'The rules of recitation, with memorisation', icon: 'book' },
  hifz: { n: 'Memorise', d: 'Learn, revise and recite whole surahs', icon: 'crown' },
};

// c letter, n name, h sound hint, s short sound, d how to spot it, j joins to the next letter
export const LETTERS = [
  { c: 'ا', n: 'Alif', h: 'A long "aa". It never joins forward.', s: 'long "aa"', d: 'a plain vertical line, no dots', j: 0 },
  { c: 'ب', n: 'Ba', h: '"b" as in bat', s: '"b"', d: 'one dot below', j: 1 },
  { c: 'ت', n: 'Ta', h: '"t" as in tea', s: '"t"', d: 'two dots above', j: 1 },
  { c: 'ث', n: 'Tha', h: '"th" as in think', s: '"th" (think)', d: 'three dots above', j: 1 },
  { c: 'ج', n: 'Jeem', h: '"j" as in jam', s: '"j"', d: 'one dot inside the curve', j: 1 },
  { c: 'ح', n: 'Haa', h: 'A breathy "h" from the middle of the throat', s: 'breathy "h"', d: 'no dots, like Jeem without the dot', j: 1 },
  { c: 'خ', n: 'Khaa', h: 'Like "ch" in Scottish loch', s: '"kh" (loch)', d: 'one dot above', j: 1 },
  { c: 'د', n: 'Dal', h: '"d" as in dog', s: '"d"', d: 'no dots, a small hook', j: 0 },
  { c: 'ذ', n: 'Dhal', h: '"th" as in this', s: '"th" (this)', d: 'one dot above', j: 0 },
  { c: 'ر', n: 'Ra', h: 'A rolled "r"', s: 'rolled "r"', d: 'no dots, dips below the line', j: 0 },
  { c: 'ز', n: 'Zay', h: '"z" as in zoo', s: '"z"', d: 'one dot above', j: 0 },
  { c: 'س', n: 'Seen', h: '"s" as in sun', s: '"s"', d: 'three teeth, no dots', j: 1 },
  { c: 'ش', n: 'Sheen', h: '"sh" as in ship', s: '"sh"', d: 'three teeth, three dots above', j: 1 },
  { c: 'ص', n: 'Saad', h: 'A heavy, full "s"', s: 'heavy "s"', d: 'a round loop, no dots', j: 1 },
  { c: 'ض', n: 'Daad', h: 'A heavy, full "d"', s: 'heavy "d"', d: 'a round loop, one dot above', j: 1 },
  { c: 'ط', n: 'Taa', h: 'A heavy, full "t"', s: 'heavy "t"', d: 'a loop with a tall stick, no dots', j: 1 },
  { c: 'ظ', n: 'Zaa', h: 'A heavy "th" as in this', s: 'heavy "th"', d: 'a loop with a tall stick, one dot', j: 1 },
  { c: 'ع', n: 'Ain', h: 'A deep sound squeezed from the throat', s: 'deep throat "ʿ"', d: 'no dots, a small head', j: 1 },
  { c: 'غ', n: 'Ghain', h: 'A gargled sound, like French "r"', s: '"gh" (gargle)', d: 'one dot above Ain', j: 1 },
  { c: 'ف', n: 'Fa', h: '"f" as in fun', s: '"f"', d: 'one dot above, round head', j: 1 },
  { c: 'ق', n: 'Qaf', h: 'A deep "k" from the back of the throat', s: 'deep "q"', d: 'two dots above, round head', j: 1 },
  { c: 'ك', n: 'Kaf', h: '"k" as in kite', s: '"k"', d: 'no dots, a tall stroke with a small mark', j: 1 },
  { c: 'ل', n: 'Lam', h: '"l" as in lamp', s: '"l"', d: 'a tall stroke with a curved base', j: 1 },
  { c: 'م', n: 'Meem', h: '"m" as in moon', s: '"m"', d: 'a small round head, no dots', j: 1 },
  { c: 'ن', n: 'Noon', h: '"n" as in nose', s: '"n"', d: 'a bowl with one dot above', j: 1 },
  { c: 'ه', n: 'Ha', h: '"h" as in hat', s: '"h"', d: 'a loop-like shape, no dots', j: 1 },
  { c: 'و', n: 'Waw', h: '"w" as in water, or a long "oo"', s: '"w" / "oo"', d: 'a round head with a tail, no dots', j: 0 },
  { c: 'ي', n: 'Ya', h: '"y" as in yes, or a long "ee"', s: '"y" / "ee"', d: 'two dots below', j: 1 },
];
export const ZWJ = '‍';
export const formsOf = l => l.j ? [['Alone', l.c], ['Start', l.c + ZWJ], ['Middle', ZWJ + l.c + ZWJ], ['End', ZWJ + l.c]] : [['Alone', l.c], ['End', ZWJ + l.c]];

export const FALLBACK_WORDS = ['ٱللَّهِ', 'رَبِّ', 'ٱلْعَـٰلَمِينَ', 'ٱلَّذِينَ', 'يَوْمِ', 'ٱلدِّينِ', 'عَلَيْهِمْ', 'ٱلْأَرْضِ'];

export const DHIKR = [
  { ar: 'سُبْحَانَ ٱللَّٰهِ', en: 'SubhanAllah', goal: 33 },
  { ar: 'ٱلْحَمْدُ لِلَّٰهِ', en: 'Alhamdulillah', goal: 33 },
  { ar: 'ٱللَّٰهُ أَكْبَرُ', en: 'Allahu Akbar', goal: 34 },
  { ar: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', en: 'La ilaha illa Allah', goal: 100 },
  { ar: 'أَسْتَغْفِرُ ٱللَّٰهَ', en: 'Astaghfirullah', goal: 100 },
];

// Well-known hadith, summarised in plain English. Always verify wording against the cited collection.
export const HADITH = [
  { t: 'Actions are judged by intentions, and everyone will get what they intended.', s: 'Bukhari 1, Muslim 1907' },
  { t: 'The best among you are those who learn the Quran and teach it.', s: 'Bukhari 5027' },
  { t: 'None of you truly believes until he loves for his brother what he loves for himself.', s: 'Bukhari 13, Muslim 45' },
  { t: 'Whoever believes in Allah and the Last Day should speak good or keep silent.', s: 'Bukhari 6018, Muslim 47' },
  { t: 'The strong person is not the one who defeats others, but the one who controls himself when angry.', s: 'Bukhari 6114, Muslim 2609' },
  { t: 'Make things easy and do not make them difficult; give good news and do not drive people away.', s: 'Bukhari 69, Muslim 1734' },
  { t: 'The most beloved deeds to Allah are the most consistent ones, even if they are small.', s: 'Bukhari 6464, Muslim 783' },
  { t: 'Whoever recites a letter from the Book of Allah earns a good deed, and each good deed is multiplied by ten.', s: 'Tirmidhi 2910' },
  { t: 'The one who recites the Quran fluently will be with the noble angels; the one who recites with difficulty and struggles through it will have a double reward.', s: 'Bukhari 4937, Muslim 798' },
  { t: 'Whoever follows a path to seek knowledge, Allah makes easy for him a path to Paradise.', s: 'Muslim 2699' },
  { t: 'Smiling at your brother is charity.', s: 'Tirmidhi 1956' },
  { t: 'Allah does not look at your appearance or wealth, but at your hearts and your deeds.', s: 'Muslim 2564' },
  { t: 'Part of the excellence of a person\'s Islam is leaving what does not concern him.', s: 'Tirmidhi 2317' },
  { t: 'The best of you are those who are best to their families.', s: 'Tirmidhi 3895' },
  { t: 'Whoever fasts Ramadan out of faith and seeking reward will have his previous sins forgiven.', s: 'Bukhari 38, Muslim 760' },
  { t: 'Whoever does not thank people has not thanked Allah.', s: 'Abu Dawud 4811, Tirmidhi 1954' },
];

export const ADVICE = [
  { c: 'Memorizing', i: 'layers', t: 'Same copy, every time', d: 'Use one mushaf (or this app) consistently. Your brain remembers the page layout and position of ayahs.' },
  { c: 'Memorizing', i: 'repeat', t: 'Revise before you add', d: "Spend the first minutes of every session reviewing yesterday's lesson. New memorization without revision leaks away." },
  { c: 'Memorizing', i: 'headphones', t: 'Listen first, then read', d: 'Play the ayah 3–5 times before you try it. Your ear learns the rhythm and tajweed before your tongue has to.' },
  { c: 'Memorizing', i: 'cube', t: 'Small bites', d: 'Five ayahs done well beats twenty done badly. Stack small wins, then connect them.' },
  { c: 'Consistency', i: 'clock', t: 'Anchor it to a prayer', d: 'Tie your session to something you already do daily, like right after Fajr or Maghrib.' },
  { c: 'Consistency', i: 'flame', t: 'Never miss twice', d: 'If you miss a day, do a 2-minute lesson the next day. The streak matters less than the habit.' },
  { c: 'Consistency', i: 'moon', t: 'Night review', d: 'Recite what you learned just before sleeping. Sleep helps lock memory in.' },
  { c: 'Tajweed', i: 'target', t: 'Fix the letters first', d: 'Getting makharij (articulation points) right is the foundation. Practice ص/س, ض/د, ط/ت, ع/ء and ق/ك slowly.' },
  { c: 'Tajweed', i: 'mountain', t: 'Slow is correct', d: 'Recite slowly (tartil) until tajweed becomes automatic, then gradually pick up pace.' },
  { c: 'Tajweed', i: 'user', t: 'Find a teacher', d: 'AI feedback is a helpful coach, but a qualified teacher who can hear the details is irreplaceable. Aim for both.' },
  { c: 'Heart', i: 'heart', t: 'Know what you recite', d: 'Read the translation of each ayah. Meaning makes memorization stick and makes recitation sincere.' },
  { c: 'Heart', i: 'sparkle', t: 'Ask for help', d: 'Begin with a short dua for ease and understanding. Sincerity and effort are what count.' },
  { c: 'Heart', i: 'leaf', t: 'Struggle is reward', d: 'If it feels hard, remember the hadith about the reciter who struggles: a double reward.' },
];

// Ayahs per surah, used to turn a global ayah number into surah:ayah for sources that need it.
export const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
export const RECITERS = [
  { id: 'ar.alafasy', n: 'Mishary Alafasy' }, { id: 'ar.husary', n: 'Mahmoud Khalil Al-Husary' },
  { id: 'ar.minshawi', n: 'Mohamed Siddiq El-Minshawi' }, { id: 'ar.abdulbasitmurattal', n: 'Abdul Basit (Murattal)' },
  { id: 'ea:Yasser_Ad-Dussary_128kbps', n: 'Yasser Ad-Dosary' },
];

// How forgiving the recitation coach is. Chosen from the placement quiz, adjustable any time.
export const LENIENCY = {
  gentle: { n: 'Gentle', d: 'Encouraging. Small slips are not counted against you.', ok: .72, wrong: .42, pron: .8, passPron: true, ai: 'The student is a beginner. Be generous and encouraging. Mark real=true only for clearly wrong or skipped words; treat accent, small vowel slips and unclear articulation as NOT real. List at most 2 tajweed reminders.' },
  balanced: { n: 'Balanced', d: 'Fair. Real word mistakes count, tiny slips count half.', ok: .8, wrong: .5, pron: .5, passPron: false, ai: 'The student is intermediate. Be fair: mark clear word errors and clear letter substitutions as real, ignore transcription noise.' },
  strict: { n: 'Strict', d: 'Exacting. Pronunciation slips count heavily.', ok: .88, wrong: .6, pron: .25, passPron: false, ai: 'The student is advanced and wants exacting feedback. Flag clear letter substitutions, dropped or added letters and likely makhraj problems as real, and list up to 6 tajweed reminders.' },
};

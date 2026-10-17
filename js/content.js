// Static content: alphabet, hadith, advice, shop, etc.

// Recommended learning path: Al-Fatiha, then Juz Amma backwards (short -> long), then favourites.
export const PATH = [1, ...Array.from({ length: 37 }, (_, i) => 114 - i), 67, 36, 55, 56, 18, 32, 2];

export const TITLES = ['Seeker', 'Reader', 'Listener', 'Memorizer', 'Reciter', 'Guardian', 'Hafiz-in-Training', 'Scholar', 'Luminary', 'Noor'];

// c = letter, n = name, h = sound hint, j = joins to the next letter
export const LETTERS = [
  { c: 'ا', n: 'Alif', h: 'Long "a"; carries a hamza', j: 0 },
  { c: 'ب', n: 'Ba', h: '"b" as in bat', j: 1 },
  { c: 'ت', n: 'Ta', h: '"t" as in tea', j: 1 },
  { c: 'ث', n: 'Tha', h: '"th" as in think', j: 1 },
  { c: 'ج', n: 'Jeem', h: '"j" as in jam', j: 1 },
  { c: 'ح', n: 'Haa', h: 'Breathy "h" from the throat', j: 1 },
  { c: 'خ', n: 'Khaa', h: 'Like "ch" in Scottish loch', j: 1 },
  { c: 'د', n: 'Dal', h: '"d" as in dog', j: 0 },
  { c: 'ذ', n: 'Dhal', h: '"th" as in this', j: 0 },
  { c: 'ر', n: 'Ra', h: 'Rolled "r"', j: 0 },
  { c: 'ز', n: 'Zay', h: '"z" as in zoo', j: 0 },
  { c: 'س', n: 'Seen', h: '"s" as in sun', j: 1 },
  { c: 'ش', n: 'Sheen', h: '"sh" as in ship', j: 1 },
  { c: 'ص', n: 'Saad', h: 'Heavy "s"', j: 1 },
  { c: 'ض', n: 'Daad', h: 'Heavy "d"', j: 1 },
  { c: 'ط', n: 'Taa', h: 'Heavy "t"', j: 1 },
  { c: 'ظ', n: 'Zaa', h: 'Heavy "dh"', j: 1 },
  { c: 'ع', n: 'Ain', h: 'Deep throat sound', j: 1 },
  { c: 'غ', n: 'Ghain', h: 'Gargled "r", like French', j: 1 },
  { c: 'ف', n: 'Fa', h: '"f" as in fun', j: 1 },
  { c: 'ق', n: 'Qaf', h: 'Deep "k" from the back of the throat', j: 1 },
  { c: 'ك', n: 'Kaf', h: '"k" as in kite', j: 1 },
  { c: 'ل', n: 'Lam', h: '"l" as in lamp', j: 1 },
  { c: 'م', n: 'Meem', h: '"m" as in moon', j: 1 },
  { c: 'ن', n: 'Noon', h: '"n" as in nose', j: 1 },
  { c: 'ه', n: 'Ha', h: '"h" as in hat', j: 1 },
  { c: 'و', n: 'Waw', h: '"w" as in water, or long "oo"', j: 0 },
  { c: 'ي', n: 'Ya', h: '"y" as in yes, or long "ee"', j: 1 },
];

export const FALLBACK_WORDS = ['ٱللَّهِ', 'رَبِّ', 'ٱلْعَـٰلَمِينَ', 'ٱلَّذِينَ', 'ءَامَنُوا۟', 'يَوْمِ', 'ٱلدِّينِ', 'عَلَيْهِمْ', 'ٱلْأَرْضِ', 'ٱلسَّمَـٰوَٰتِ'];

export const DHIKR = [
  { ar: 'سُبْحَانَ ٱللَّٰهِ', en: 'SubhanAllah', goal: 33 },
  { ar: 'ٱلْحَمْدُ لِلَّٰهِ', en: 'Alhamdulillah', goal: 33 },
  { ar: 'ٱللَّٰهُ أَكْبَرُ', en: 'Allahu Akbar', goal: 34 },
  { ar: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', en: 'La ilaha illa Allah', goal: 100 },
  { ar: 'أَسْتَغْفِرُ ٱللَّٰهَ', en: 'Astaghfirullah', goal: 100 },
];

export const FAST_TYPES = [
  { id: 'ramadan', l: 'Ramadan', i: '🌙' },
  { id: 'monthu', l: 'Monday / Thursday', i: '📅' },
  { id: 'white', l: 'White days (13–15)', i: '⚪' },
  { id: 'arafah', l: 'Day of Arafah', i: '⛰️' },
  { id: 'ashura', l: 'Ashura', i: '🕊️' },
  { id: 'shawwal', l: 'Six of Shawwal', i: '✨' },
  { id: 'qada', l: 'Make-up (qada)', i: '🔁' },
  { id: 'nafl', l: 'Voluntary', i: '🤍' },
];

export const THEMES = [
  { id: 'emerald', name: 'Emerald', cost: 0, lvl: 1 },
  { id: 'midnight', name: 'Midnight', cost: 150, lvl: 3 },
  { id: 'rose', name: 'Rose', cost: 250, lvl: 5 },
  { id: 'sand', name: 'Golden Sand', cost: 400, lvl: 8 },
  { id: 'violet', name: 'Twilight', cost: 600, lvl: 12 },
];

export const AVATARS = [
  { id: '🌙', cost: 0, lvl: 1 }, { id: '⭐', cost: 50, lvl: 2 }, { id: '📖', cost: 100, lvl: 2 },
  { id: '🕌', cost: 100, lvl: 3 }, { id: '🌿', cost: 120, lvl: 4 }, { id: '🦋', cost: 150, lvl: 5 },
  { id: '🦉', cost: 250, lvl: 6 }, { id: '🌅', cost: 300, lvl: 8 }, { id: '🏔️', cost: 300, lvl: 10 },
  { id: '🕋', cost: 500, lvl: 12 }, { id: '💎', cost: 800, lvl: 15 }, { id: '👑', cost: 1500, lvl: 20 },
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
  { c: 'Memorizing', i: '🧠', t: 'Same copy, every time', d: 'Use one mushaf (or this app) consistently. Your brain remembers the page layout and position of ayahs.' },
  { c: 'Memorizing', i: '🔁', t: 'Revise before you add', d: 'Spend the first minutes of every session reviewing yesterday\'s lesson. New memorization without revision leaks away.' },
  { c: 'Memorizing', i: '👂', t: 'Listen first, then read', d: 'Play the ayah 3–5 times before you try it. Your ear learns the rhythm and tajweed before your tongue has to.' },
  { c: 'Memorizing', i: '🧩', t: 'Small bites', d: 'Five ayahs done well beats twenty done badly. Stack small wins, then connect them.' },
  { c: 'Consistency', i: '⏰', t: 'Anchor it to a prayer', d: 'Tie your session to something you already do daily, like right after Fajr or Maghrib.' },
  { c: 'Consistency', i: '🔥', t: 'Never miss twice', d: 'If you miss a day, do a 2-minute lesson the next day. The streak matters less than the habit.' },
  { c: 'Consistency', i: '🌙', t: 'Night review', d: 'Recite what you learned just before sleeping. Sleep helps lock memory in.' },
  { c: 'Tajweed', i: '🎯', t: 'Fix the letters first', d: 'Getting makharij (articulation points) right is the foundation. Practice ص/س, ض/د, ط/ت, ع/ء and ق/ك slowly.' },
  { c: 'Tajweed', i: '🐢', t: 'Slow is correct', d: 'Recite slowly (tartil) until tajweed becomes automatic, then gradually pick up pace.' },
  { c: 'Tajweed', i: '👩‍🏫', t: 'Find a teacher', d: 'AI feedback is a helpful coach, but a qualified teacher who can hear the details is irreplaceable. Aim for both.' },
  { c: 'Heart', i: '💚', t: 'Know what you recite', d: 'Read the translation of each ayah. Meaning makes memorization stick and makes recitation sincere.' },
  { c: 'Heart', i: '🤲', t: 'Ask for help', d: 'Begin with a short dua for ease and understanding. Sincerity and effort are what count.' },
  { c: 'Heart', i: '🌱', t: 'Struggle is reward', d: 'If it feels hard, remember the hadith about the reciter who struggles: a double reward.' },
];

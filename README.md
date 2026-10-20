# Iqra: learn the Quran

A static site + one Cloudflare Pages Function. No build step.

```
index.html  css/  js/  functions/api/[[path]].js  manifest.webmanifest  icon.svg  _routes.json
```

## Deploy (about 5 minutes)

1. **Push this folder to GitHub** (the folder contents go in the repo root).
2. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**, pick the repo.
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/` (or leave empty)
3. **Create the KV namespace** (for logins that work across devices):
   Storage & Databases → KV → *Create namespace* (call it `iqra`).
4. **Bind it:** your Pages project → Settings → **Bindings** (or *Functions → KV namespace bindings*) → Add → KV namespace.
   - Variable name: **`IQRA_KV`** (exactly)
   - Namespace: the one you just made
   - Add it for **Production** (and Preview if you use previews).
5. **Add the Groq key as a secret:** Settings → **Variables and Secrets** → Add
   - Name: **`GROQ_API_KEY`**, Type: **Secret**, Value: your key from console.groq.com
6. **Redeploy** (Deployments → ⋯ → Retry deployment) so the bindings load.

Optional variables: `GROQ_STT_MODEL` (default `whisper-large-v3`) and `GROQ_CHAT_MODEL` (default `llama-3.3-70b-versatile`).

Check it worked: open `https://YOUR-SITE.pages.dev/api/health` — you should see `{"ok":true,"kv":true,"groq":true}`.

If `kv` is false the app still works, but accounts live only on that device. If `groq` is false the lessons and games work and the recitation coach shows a setup message.

## No API key needed for the Quran

All 114 surahs (Uthmani text, Sahih International translation, transliteration) come from the free public **alquran.cloud** API, and ayah audio from the **Islamic Network CDN**. Both are fetched in the browser and cached in IndexedDB, so each surah loads once.

## How it works

- **Level and plan:** you pick where you are during setup (brand new, know the letters, read slowly, read fluently) and can change it any time in Account or on Home. That sets your plan: *Foundations* (letters, vowels, joining, first words, short surahs), *Reading*, *Tajweed* (11 rule lessons interleaved with surahs) or *Memorize*. Daily tasks change with the plan. Every lesson stays open in the Library.
- **Teach first, then test:** each lesson starts with teaching cards (letters, rules) or, for a surah, a word-by-word view with tap-to-hear audio, translation and transliteration. Practice only covers what was just taught: build the ayah (tap or drag words to reorder, Check, retry, reveal after two misses), fill the gap, meaning, listen, ayah order.
- **Saves your place:** every step is saved, so you can leave mid lesson and resume from Home or the surah page. It syncs with your account.
- **Recite and get graded:** any surah, any range up to 30 ayahs, from Home, every surah page or the end of a lesson. You get a grade, per-ayah accuracy, highlighted words, a replay of your recording and a hand-off to Nur. Mastery needs a clean recitation of a fully learned surah (surahs over 30 ayahs are mastered in parts of 20).
- **Nur:** a back-and-forth chat coach (`/api/nur`, Groq) that knows your level and progress. 80 messages per user per day.
- **Mini player:** a glass capsule that follows you across the app whenever Quran audio plays (pause, play, previous, next, and lock-screen controls).
- **Navigation:** the glass bar can be dragged. The page only changes when you let go.
- **Break room:** three calm games (Pairs, Letter pop, Glide). The first 3 rounds a day pay coins.
- **Levels and prizes:** XP raises your level; longer surahs unlock at higher levels (Explorer mode opens everything). Coins buy accents and avatars. Badges, streaks and quests included.
- **More tab:** account (sign-in details behind a Show toggle), rewards, fasting log, hadith, advice, prayer times, dhikr, alphabet, settings (light/dark/auto, sounds, haptics, reciter, speed).

Word-by-word data comes from the free quran.com API. If it is unreachable the teach view falls back to plain words.

## Honest limits of the AI coach

Speech-to-text hears words, not harakat. It can reliably catch skipped, swapped or clearly mispronounced words, and the coach flags likely letter substitutions (ص/س, ق/ك, ع/ء…). It **cannot** truly measure madd length, ghunnah or exact makhraj. Those show as "tajweed reminders" and are advice, not verdicts. Use it alongside a qualified teacher.

## Security notes

- Passwords are hashed with PBKDF2-SHA256 (100k iterations, per-user salt); sessions are random tokens in KV (60 days).
- Login attempts are rate-limited; the coach is limited to 60 recordings and Nur to 80 messages per user per day so nobody can burn your Groq quota.
- Your Groq key only ever exists server-side as a secret. It is never sent to the browser.
- The hadith are plain-English summaries of well-known hadith with their sources. Verify exact wording in the cited collection.

## Local testing

`npx wrangler pages dev . --kv IQRA_KV --binding GROQ_API_KEY=your_key` runs the site and the function together. Opening `index.html` directly also works in "this device only" mode (microphone needs HTTPS or localhost).

## Public-launch notes

- `privacy.html` and `terms.html` are static pages (linked from signup and More). Edit the contact line (currently the GitHub issues page) and the governing-law clause before a wide launch, and have them reviewed if you collect more data than described.
- Signup requires accepting the Terms and Privacy Policy (existing users get a one-time prompt). There is no age limit. Recordings are forwarded to Groq for transcription and are not stored by Iqra; Nur chats are stored inside the user's synced progress.
- Coach strictness (Gentle, Balanced, Strict) comes from the placement quiz and can be changed in Settings.
- Reciters: Alafasy, Husary, Minshawi, Abdul Basit (alquran.cloud) and Yasser Ad-Dosary (everyayah.com, `ea:` ids).

## v5 notes
- Optional secret `PW_PEPPER` (any long random string): mixes a server-side secret into password hashes. Accounts are upgraded to the current hash format (PBKDF2-SHA-512, 100k iterations, the Workers maximum) the next time they sign in.
- Halal scanner looks products up on Open Food Facts straight from the browser; no server config needed.

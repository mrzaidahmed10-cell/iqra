# Iqra — learn the Quran like a game

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

## How the game works

- **Lessons:** up to 20 ayahs per lesson (or the rest of the surah, whichever comes first): listen, build the ayah, fill the gap, meaning check, ayah-order challenge. Mistakes get one retry at the end. 1–3 stars from accuracy.
- **Break time:** after every lesson you unlock the arcade (Memory Match, Bubble Pop, Flappy Crescent). The first 3 rounds a day pay coins.
- **Levels & prizes:** XP raises your level. Longer surahs unlock at higher levels (turn on *Explorer mode* in Settings to open everything). Coins and levels unlock themes and avatars in the Rewards shop. Badges, daily quests and streaks included.
- **Mastery:** once a surah is fully learned, recite it. Your recording goes to `/api/transcribe` (Groq Whisper), the app aligns the transcript to the mushaf word by word, and `/api/coach` (Groq LLM) decides which mismatches are real and adds tajweed reminders. Wrong/missing/mispronounced words are highlighted; tap any highlighted word for details. **Zero real errors = Mastery.** Surahs over 30 ayahs are mastered in parts of 20 ayahs. *Hard mode* hides the text.
- **More tab:** account (sign-in details hidden behind a Show toggle), rewards shop, fasting log with Hijri hints, hadith, learning advice, prayer times (aladhan.com), dhikr counter, Arabic alphabet, settings.

## Honest limits of the AI coach

Speech-to-text hears words, not harakat. It can reliably catch skipped, swapped or clearly mispronounced words, and the coach flags likely letter substitutions (ص/س, ق/ك, ع/ء…). It **cannot** truly measure madd length, ghunnah or exact makhraj. Those show as "tajweed reminders" and are advice, not verdicts. Use it alongside a qualified teacher.

## Security notes

- Passwords are hashed with PBKDF2-SHA256 (100k iterations, per-user salt); sessions are random tokens in KV (60 days).
- Login attempts are rate-limited; the coach is limited to 60 recordings per user per day so nobody can burn your Groq quota.
- Your Groq key only ever exists server-side as a secret. It is never sent to the browser.
- The hadith are plain-English summaries of well-known hadith with their sources. Verify exact wording in the cited collection.

## Local testing

`npx wrangler pages dev . --kv IQRA_KV --binding GROQ_API_KEY=your_key` runs the site and the function together. Opening `index.html` directly also works in "this device only" mode (microphone needs HTTPS or localhost).

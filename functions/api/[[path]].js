// Cloudflare Pages Function — accounts (KV) + Groq recitation coach.
// Bindings:  IQRA_KV (KV namespace)   GROQ_API_KEY (secret)
// Optional:  GROQ_STT_MODEL (default whisper-large-v3)   GROQ_CHAT_MODEL (default llama-3.3-70b-versatile)

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const enc = new TextEncoder();
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
const b64 = u => btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = u => [...u].map(b => b.toString(16).padStart(2, '0')).join('');
const SESSION_TTL = 60 * 60 * 24 * 60;
const MAX_STATE = 400000;

async function hashPw(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256));
}
const same = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const okUser = u => /^[a-z0-9_]{3,20}$/.test(u);
const okEmail = e => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e) && e.length <= 254;

async function readBody(request) { try { return await request.json(); } catch { return null; } }
async function authed(request, env) {
  const t = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!t) return null;
  const u = await env.IQRA_KV.get('s:' + t);
  if (!u) return null;
  const rec = await env.IQRA_KV.get('u:' + u, 'json');
  return rec ? { u, rec, t } : null;
}
async function newSession(env, username) {
  const token = hex(rnd(32));
  await env.IQRA_KV.put('s:' + token, username, { expirationTtl: SESSION_TTL });
  return token;
}
async function throttle(env, key, max, ttl) {
  const n = +(await env.IQRA_KV.get(key) || 0);
  if (n >= max) return false;
  await env.IQRA_KV.put(key, String(n + 1), { expirationTtl: ttl });
  return true;
}

export async function onRequest({ request, env, params }) {
  const path = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean).join('/');
  const m = request.method;
  try {
    if (path === 'health') return J({ ok: true, kv: !!env.IQRA_KV, groq: !!env.GROQ_API_KEY });

    // ---------- AI coach ----------
    if (path === 'transcribe' && m === 'POST') return transcribe(request, env);
    if (path === 'coach' && m === 'POST') return coach(request, env);
    if (path === 'nur' && m === 'POST') return nur(request, env);

    // ---------- accounts ----------
    if (!env.IQRA_KV) return J({ error: 'Cloud sync is not configured (bind a KV namespace named IQRA_KV).' }, 503);
    const kv = env.IQRA_KV;

    if (path === 'register' && m === 'POST') {
      const b = await readBody(request); if (!b) return J({ error: 'Bad request' }, 400);
      const username = String(b.username || '').trim().toLowerCase(), email = String(b.email || '').trim().toLowerCase(), password = String(b.password || '');
      if (!okUser(username)) return J({ error: 'Username must be 3–20 letters, numbers or underscores.' }, 400);
      if (!okEmail(email)) return J({ error: 'Please enter a valid email.' }, 400);
      if (password.length < 8 || password.length > 200) return J({ error: 'Password must be at least 8 characters.' }, 400);
      if (await kv.get('u:' + username)) return J({ error: 'That username is taken.' }, 409);
      if (await kv.get('e:' + email)) return J({ error: 'That email already has an account.' }, 409);
      const salt = rnd(16);
      const state = b.state && JSON.stringify(b.state).length < MAX_STATE ? b.state : null;
      await kv.put('u:' + username, JSON.stringify({ username, email, salt: b64(salt), hash: await hashPw(password, salt), created: Date.now(), state }));
      await kv.put('e:' + email, username);
      return J({ token: await newSession(env, username), username });
    }

    if (path === 'login' && m === 'POST') {
      const b = await readBody(request); if (!b) return J({ error: 'Bad request' }, 400);
      const id = String(b.id || '').trim().toLowerCase(), password = String(b.password || '');
      if (!id || !password) return J({ error: 'Enter your username/email and password.' }, 400);
      if (!(await throttle(env, 'f:' + id, 10, 900))) return J({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
      const username = id.includes('@') ? await kv.get('e:' + id) : id;
      const rec = username ? await kv.get('u:' + username, 'json') : null;
      if (!rec || !same(await hashPw(password, unb64(rec.salt)), rec.hash)) return J({ error: 'Wrong username or password.' }, 401);
      await kv.delete('f:' + id);
      return J({ token: await newSession(env, rec.username), username: rec.username, email: rec.email, state: rec.state });
    }

    const a = await authed(request, env);
    if (path === 'logout' && m === 'POST') { if (a) await kv.delete('s:' + a.t); return J({ ok: true }); }
    if (!a) return J({ error: 'Please sign in again.' }, 401);

    if (path === 'me' && m === 'GET') return J({ username: a.u, email: a.rec.email, state: a.rec.state });

    if (path === 'sync' && m === 'PUT') {
      const b = await readBody(request);
      if (!b || !b.state || JSON.stringify(b.state).length > MAX_STATE) return J({ error: 'Bad state' }, 400);
      const rec = await kv.get('u:' + a.u, 'json');
      if (rec.state && (rec.state.updatedAt || 0) > (b.state.updatedAt || 0)) return J({ ok: true, newer: true, state: rec.state });
      rec.state = b.state; await kv.put('u:' + a.u, JSON.stringify(rec));
      return J({ ok: true });
    }

    if (path === 'account' && m === 'PUT') {
      const b = await readBody(request); if (!b) return J({ error: 'Bad request' }, 400);
      const username = String(b.username || a.u).trim().toLowerCase(), email = String(b.email || a.rec.email).trim().toLowerCase();
      if (!okUser(username)) return J({ error: 'Username must be 3–20 letters, numbers or underscores.' }, 400);
      if (!okEmail(email)) return J({ error: 'Please enter a valid email.' }, 400);
      if (username !== a.u && await kv.get('u:' + username)) return J({ error: 'That username is taken.' }, 409);
      if (email !== a.rec.email && await kv.get('e:' + email)) return J({ error: 'That email already has an account.' }, 409);
      const rec = { ...a.rec, username, email };
      await kv.put('u:' + username, JSON.stringify(rec));
      if (email !== a.rec.email) { await kv.delete('e:' + a.rec.email); await kv.put('e:' + email, username); } else if (username !== a.u) await kv.put('e:' + email, username);
      if (username !== a.u) { await kv.delete('u:' + a.u); await kv.put('s:' + a.t, username, { expirationTtl: SESSION_TTL }); }
      return J({ username, email });
    }

    if (path === 'password' && m === 'POST') {
      const b = await readBody(request); if (!b) return J({ error: 'Bad request' }, 400);
      if (!same(await hashPw(String(b.current || ''), unb64(a.rec.salt)), a.rec.hash)) return J({ error: 'Current password is wrong.' }, 401);
      const next = String(b.next || ''); if (next.length < 8 || next.length > 200) return J({ error: 'New password must be at least 8 characters.' }, 400);
      const salt = rnd(16); await kv.put('u:' + a.u, JSON.stringify({ ...a.rec, salt: b64(salt), hash: await hashPw(next, salt) }));
      return J({ ok: true });
    }

    if (path === 'delete' && m === 'POST') {
      const b = await readBody(request) || {};
      if (!same(await hashPw(String(b.password || ''), unb64(a.rec.salt)), a.rec.hash)) return J({ error: 'Password is wrong.' }, 401);
      await kv.delete('u:' + a.u); await kv.delete('e:' + a.rec.email); await kv.delete('s:' + a.t);
      return J({ ok: true });
    }

    return J({ error: 'Not found' }, 404);
  } catch (e) {
    return J({ error: 'Server error. Please try again.' }, 500);
  }
}

// ---------- Groq helpers ----------
async function guard(request, env) {
  if (!env.GROQ_API_KEY) return { res: J({ error: 'The AI coach is not configured yet (missing GROQ_API_KEY).' }, 503) };
  if (env.IQRA_KV) {
    const a = await authed(request, env);
    if (!a) return { res: J({ error: 'Please sign in again.' }, 401) };
    const day = new Date().toISOString().slice(0, 10);
    if (request.url.endsWith('/transcribe') && !(await throttle(env, `r:${a.u}:${day}`, 60, 172800))) return { res: J({ error: 'Daily coach limit reached. Try again tomorrow.' }, 429) };
    if (request.url.endsWith('/nur') && !(await throttle(env, `n:${a.u}:${day}`, 80, 172800))) return { res: J({ error: 'You have reached the daily chat limit. Nur will be back tomorrow.' }, 429) };
  }
  return {};
}

async function transcribe(request, env) {
  const g = await guard(request, env); if (g.res) return g.res;
  let form; try { form = await request.formData(); } catch { return J({ error: 'Bad upload' }, 400); }
  const audio = form.get('audio');
  if (!audio || typeof audio === 'string') return J({ error: 'No audio received.' }, 400);
  if (audio.size < 2000) return J({ error: "That recording was too short. Try again." }, 400);
  if (audio.size > 24 * 1024 * 1024) return J({ error: 'Recording is too long. Try a shorter part.' }, 413);
  const fd = new FormData();
  fd.append('file', audio, audio.name || 'rec.webm');
  fd.append('model', env.GROQ_STT_MODEL || 'whisper-large-v3');
  fd.append('language', 'ar'); fd.append('response_format', 'json'); fd.append('temperature', '0');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + env.GROQ_API_KEY }, body: fd });
  if (!r.ok) return J({ error: r.status === 429 ? 'The AI is busy right now. Wait a moment and retry.' : 'Transcription failed. Please try again.' }, 502);
  const j = await r.json();
  return J({ text: String(j.text || '') });
}

const COACH_SYSTEM = `You are a gentle, precise Quran recitation coach (tajweed teacher).
You receive: the expected words of a passage (Uthmani script, indexed, when provided), a speech-to-text transcript of the student's recitation, and candidate mismatches found by an automatic aligner.
IMPORTANT: the transcript has NO diacritics and the speech model often uses modern spelling (ة/ه, ى/ي, hamza forms, dagger alef written as ا, split or merged words). Those differences are transcription noise, NOT student errors.
For each candidate decide whether the student really misread. Mark real=true only when the heard word is genuinely a different word or letters, a skipped word, or a clear letter/makhraj substitution (e.g. ص→س, ق→ك, ع→ء, ث→س, ذ→ز, ح→ه, ض→د). Otherwise real=false.
Also list up to 6 tajweed REMINDERS (madd, ghunnah, qalqalah, idgham, ikhfa, heavy/light letters, waqf) for words in the passage where those rules apply. These are reminders, not detected errors.
Reply with JSON only, exactly this shape:
{"verdicts":[{"i":number,"real":boolean,"type":"wrong"|"missing"|"pronunciation","issue":string,"tip":string}],"tajweed_watch":[{"i":number,"rule":string,"tip":string}],"summary":string,"strengths":string}
Keep every string under 25 words, kind and specific.`;

async function coach(request, env) {
  const g = await guard(request, env); if (g.res) return g.res;
  const b = await readBody(request); if (!b || !Array.isArray(b.candidates)) return J({ error: 'Bad request' }, 400);
  const payload = {
    surah: String(b.surah || '').slice(0, 60), transcript: String(b.transcript || '').slice(0, 8000),
    words: Array.isArray(b.words) && b.words.length <= 250 ? b.words.map((w, i) => `${i}:${String(w).slice(0, 40)}`) : undefined,
    candidates: b.candidates.slice(0, 120).map(c => ({ i: c.i, expected: String(c.expected || '').slice(0, 40), heard: c.heard ? String(c.heard).slice(0, 40) : null, near: Array.isArray(c.near) ? c.near.slice(0, 4) : undefined, sim: c.sim })),
  };
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.GROQ_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: COACH_SYSTEM }, { role: 'user', content: JSON.stringify(payload) }] }),
  });
  if (!r.ok) return J({ error: 'Coach unavailable' }, 502);
  let out; try { out = JSON.parse((await r.json()).choices[0].message.content); } catch { return J({ error: 'Coach returned an unreadable answer' }, 502); }
  const str = (s, n = 200) => String(s ?? '').slice(0, n);
  return J({
    verdicts: (Array.isArray(out.verdicts) ? out.verdicts : []).filter(v => Number.isInteger(v.i)).map(v => ({ i: v.i, real: v.real === true, type: ['wrong', 'missing', 'pronunciation'].includes(v.type) ? v.type : 'pronunciation', issue: str(v.issue), tip: str(v.tip) })),
    tajweed_watch: (Array.isArray(out.tajweed_watch) ? out.tajweed_watch : []).filter(v => Number.isInteger(v.i)).slice(0, 6).map(v => ({ i: v.i, rule: str(v.rule, 80), tip: str(v.tip) })),
    summary: str(out.summary, 300), strengths: str(out.strengths, 300),
  });
}

const NUR_SYSTEM = `You are Nur, a warm, patient Quran teacher inside a learning app called Iqra.
Help with: Arabic letters and reading, tajweed, memorisation technique, the meaning and context of surahs and ayahs the student is learning, and motivation.
Style: short and conversational (usually under 120 words), plain language, no long lectures. Ask at most one follow-up question. When asked to quiz, ask ONE question at a time and wait for the answer. Write Arabic with full diacritics when you quote it.
Rules: never invent verses, hadith or attributions; if unsure, say so. Do not give fiqh rulings or fatwas; for those, suggest asking a qualified scholar. Tajweed can only be confirmed by a teacher in person, say so when it matters. Stay on topic: gently steer back if asked about unrelated things.
You receive a short context object about the student (name, level, progress, what they are looking at). Use it quietly to personalise advice, do not recite it back.`;

async function nur(request, env) {
  const g = await guard(request, env); if (g.res) return g.res;
  const b = await readBody(request); if (!b || !Array.isArray(b.messages) || !b.messages.length) return J({ error: 'Bad request' }, 400);
  const msgs = b.messages.slice(-20).filter(x => x && (x.role === 'user' || x.role === 'assistant')).map(x => ({ role: x.role, content: String(x.content || '').slice(0, 1500) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return J({ error: 'Bad request' }, 400);
  const c = b.context && typeof b.context === 'object' ? b.context : {};
  const ctx = JSON.stringify({ name: String(c.name || '').slice(0, 40), level: String(c.level || '').slice(0, 20), plan: String(c.track || '').slice(0, 30), appLevel: +c.appLevel || 1, ayahsLearned: +c.ayahsLearned || 0, surahsMastered: +c.surahsMastered || 0, lessonsDone: +c.lessonsDone || 0, looking_at: String(c.extra || '').slice(0, 400) });
  const models = [...new Set([env.GROQ_CHAT_MODEL, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'].filter(Boolean))];
  let r, why = '';
  for (const model of models) {
    try {
      r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + env.GROQ_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0.5, max_tokens: 500, messages: [{ role: 'system', content: NUR_SYSTEM + '\nStudent context: ' + ctx }, ...msgs] }),
      });
    } catch (e) { r = null; why = 'network: ' + (e && e.message); continue; }
    if (r.ok) break;
    try { why = `${model} ${r.status}: ` + ((await r.json()).error || {}).message; } catch { why = `${model} ${r.status}`; }
    if (r.status === 401 || r.status === 403) break;
  }
  if (!r || !r.ok) return J({ error: (r && r.status === 429 ? 'Nur is busy right now. Try again in a moment.' : 'Nur is unavailable right now.') + ' (' + String(why).slice(0, 160) + ')' }, 502);
  let reply = ''; try { reply = String((await r.json()).choices[0].message.content || '').trim(); } catch { /* fallthrough */ }
  if (!reply) return J({ error: 'Nur had trouble answering. Try rephrasing.' }, 502);
  return J({ reply: reply.slice(0, 2500) });
}

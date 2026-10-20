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

// Password hashing. Cloudflare Workers caps PBKDF2 at 100,000 iterations, so strength comes from the hash instead:
//   v1 (legacy)  PBKDF2-SHA-256, 100k iterations
//   v2 (current) PBKDF2-SHA-512, 100k iterations, with an optional server-side pepper (secret PW_PEPPER) mixed in via HMAC,
//                so a copy of the database alone cannot be attacked offline.
// Old accounts keep working and are upgraded to v2 the next time they sign in.
const PBKDF2_ITER = 100000;
async function pepperPw(pw, env, use) {
  if (!use) return enc.encode(pw);
  const k = await crypto.subtle.importKey('raw', enc.encode(env.PW_PEPPER), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(pw)));
}
async function hashPw(pw, salt, env, v = 2, use = false) {
  const key = await crypto.subtle.importKey('raw', v >= 2 ? await pepperPw(pw, env, use) : enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: v >= 2 ? 'SHA-512' : 'SHA-256', salt, iterations: PBKDF2_ITER }, key, v >= 2 ? 512 : 256));
}
const newCred = async (pw, env) => { const salt = rnd(16), pp = env.PW_PEPPER ? 1 : 0; return { v: 2, pp, salt: b64(salt), hash: await hashPw(pw, salt, env, 2, !!pp) }; };
// Constant-ish work whether or not the account exists, so response time does not reveal which usernames are registered.
const DUMMY = { v: 2, pp: 0, salt: b64(new Uint8Array(16)), hash: '' };
async function checkPw(rec, pw, env) {
  const r = rec || DUMMY, v = r.v || 1;
  if (v >= 2 && r.pp && !env.PW_PEPPER) throw new Error('PW_PEPPER secret is missing');
  const h = await hashPw(pw, unb64(r.salt), env, v, !!r.pp);
  return !!rec && same(h, r.hash);
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
      const state = b.state && JSON.stringify(b.state).length < MAX_STATE ? b.state : null;
      await kv.put('u:' + username, JSON.stringify({ username, email, ...(await newCred(password, env)), created: Date.now(), state }));
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
      if (!(await checkPw(rec, password, env))) return J({ error: 'Wrong username or password.' }, 401);
      await kv.delete('f:' + id);
      if ((rec.v || 1) < 2 || (!rec.pp && env.PW_PEPPER)) await kv.put('u:' + rec.username, JSON.stringify({ ...rec, ...(await newCred(password, env)) })); // upgrade old hashes
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
      if (!(await checkPw(a.rec, String(b.current || ''), env))) return J({ error: 'Current password is wrong.' }, 401);
      const next = String(b.next || ''); if (next.length < 8 || next.length > 200) return J({ error: 'New password must be at least 8 characters.' }, 400);
      await kv.put('u:' + a.u, JSON.stringify({ ...a.rec, ...(await newCred(next, env)) }));
      return J({ ok: true });
    }

    if (path === 'delete' && m === 'POST') {
      const b = await readBody(request) || {};
      if (!(await checkPw(a.rec, String(b.password || ''), env))) return J({ error: 'Password is wrong.' }, 401);
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
  if (!env.GROQ_API_KEY) return { res: J({ error: 'The coach is unavailable right now.' }, 503) };
  if (env.IQRA_KV) {
    const a = await authed(request, env);
    if (!a) return { res: J({ error: 'Please sign in again.' }, 401) };
    const day = new Date().toISOString().slice(0, 10);
    if (request.url.endsWith('/transcribe') && !(await throttle(env, `r:${a.u}:${day}`, 150, 172800))) return { res: J({ error: 'Daily coach limit reached. Try again tomorrow.' }, 429) };
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
  fd.append('language', 'ar'); fd.append('temperature', '0');
  const send = async (f, extra) => { const x = new FormData(); for (const [k, v] of f.entries()) x.append(k, v); for (const [k, v] of extra) x.append(k, v); return fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + env.GROQ_API_KEY }, body: x }); };
  // Ask for word timestamps (used for the word-by-word replay); fall back to plain text if the model refuses.
  let r = await send(fd, [['response_format', 'verbose_json'], ['timestamp_granularities[]', 'word']]);
  if (!r.ok && r.status !== 429) r = await send(fd, [['response_format', 'json']]);
  if (!r.ok) return J({ error: r.status === 429 ? 'The AI is busy right now. Wait a moment and retry.' : 'Transcription failed. Please try again.' }, 502);
  const j = await r.json();
  const words = Array.isArray(j.words) ? j.words.slice(0, 1500).map(w => ({ w: String(w.word || '').trim(), s: +w.start || 0, e: +w.end || 0 })) : [];
  return J({ text: String(j.text || ''), words });
}

const COACH_SYSTEM = `You are a gentle, precise Quran recitation coach (tajweed teacher).
You receive: the expected words of a passage (Uthmani script, indexed, when provided), a speech-to-text transcript of the student's recitation, and candidate mismatches found by an automatic aligner.
IMPORTANT: the transcript has NO diacritics and the speech model often uses modern spelling (ة/ه, ى/ي, hamza forms, dagger alef written as ا, split or merged words). Those differences are transcription noise, NOT student errors.
For each candidate decide whether the student really misread. Mark real=true only when the heard word is genuinely a different word or letters, a skipped word, or a clear letter/makhraj substitution (e.g. ص→س, ق→ك, ع→ء, ث→س, ذ→ز, ح→ه, ض→د). Otherwise real=false.
Candidates with suspect=true matched the expected word closely but the heard spelling swaps a letter that is easy to confuse. The transcript is written from what was heard, so a swapped letter there is real evidence: mark real=true with type pronunciation when the heard letters clearly differ, otherwise real=false.\nBe consistent: the same evidence must always get the same verdict. Judge only the evidence given and do not invent errors for words that match.\nAlso list up to 6 tajweed REMINDERS (madd, ghunnah, qalqalah, idgham, ikhfa, heavy/light letters, waqf) for words in the passage where those rules apply. These are reminders, not detected errors.
Reply with JSON only, exactly this shape:
{"verdicts":[{"i":number,"real":boolean,"type":"wrong"|"missing"|"pronunciation","issue":string,"tip":string}],"tajweed_watch":[{"i":number,"rule":string,"tip":string}],"summary":string,"strengths":string}
Keep every string under 25 words, kind and specific.`;

async function coach(request, env) {
  const g = await guard(request, env); if (g.res) return g.res;
  const b = await readBody(request); if (!b || !Array.isArray(b.candidates)) return J({ error: 'Bad request' }, 400);
  const payload = {
    surah: String(b.surah || '').slice(0, 60), transcript: String(b.transcript || '').slice(0, 8000),
    words: Array.isArray(b.words) && b.words.length <= 250 ? b.words.map((w, i) => `${i}:${String(w).slice(0, 40)}`) : undefined,
    candidates: b.candidates.slice(0, 120).map(c => ({ i: c.i, expected: String(c.expected || '').slice(0, 40), heard: c.heard ? String(c.heard).slice(0, 40) : null, near: Array.isArray(c.near) ? c.near.slice(0, 4) : undefined, sim: c.sim, suspect: c.suspect === true ? true : undefined })),
  };
  const lenient = { gentle: 'The student is a beginner. Be generous and encouraging. Mark real=true only for clearly wrong or skipped words; treat accent, small vowel slips and unclear articulation as NOT real. List at most 2 tajweed reminders.', strict: 'The student is advanced and wants exacting feedback. Flag clear letter substitutions, dropped or added letters and likely makhraj problems as real, and list up to 6 tajweed reminders.' }[b.leniency] || 'The student is intermediate. Be fair: mark clear word errors and clear letter substitutions as real, ignore transcription noise.';
  const g2 = await groqChat(env, { temperature: 0, seed: 7, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: COACH_SYSTEM + '\nStrictness: ' + lenient }, { role: 'user', content: JSON.stringify(payload) }] });
  if (!g2.ok) { console.error('coach', g2.why); return J({ error: 'The coach is unavailable right now. Please try again.' }, 502); }
  let out; try { out = JSON.parse(g2.text.replace(/^```json|```$/g, '')); } catch { return J({ error: 'Coach returned an unreadable answer' }, 502); }
  const str = (s, n = 200) => String(s ?? '').slice(0, n);
  return J({
    verdicts: (Array.isArray(out.verdicts) ? out.verdicts : []).filter(v => Number.isInteger(v.i)).map(v => ({ i: v.i, real: v.real === true, type: ['wrong', 'missing', 'pronunciation'].includes(v.type) ? v.type : 'pronunciation', issue: str(v.issue), tip: str(v.tip) })),
    tajweed_watch: (Array.isArray(out.tajweed_watch) ? out.tajweed_watch : []).filter(v => Number.isInteger(v.i)).slice(0, 6).map(v => ({ i: v.i, rule: str(v.rule, 80), tip: str(v.tip) })),
    summary: str(out.summary, 300), strengths: str(out.strengths, 300),
  });
}


// Try chat models in order; return { ok, data } or { ok:false, why }.
async function groqChat(env, body) {
  const models = [...new Set([env.GROQ_CHAT_MODEL, 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'].filter(Boolean))];
  const errs = [];
  for (const model of models) {
    const b = { ...body, model };
    if (model.startsWith('openai/gpt-oss')) { b.reasoning_effort = 'low'; if (b.max_tokens) { b.max_completion_tokens = b.max_tokens * 3; delete b.max_tokens; } }
    let r;
    try { r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + env.GROQ_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); }
    catch (e) { errs.push(model + ' network'); continue; }
    if (r.ok) { try { const d = await r.json(); const t = d.choices[0].message.content; if (t) return { ok: true, text: String(t) }; errs.push(model + ' empty'); } catch { errs.push(model + ' bad json'); } continue; }
    let m = ''; try { m = ((await r.json()).error || {}).message || ''; } catch { /* ignore */ }
    errs.push(`${model} ${r.status}${m ? ' ' + m.slice(0, 70) : ''}`);
    if (r.status === 401) break;
  }
  return { ok: false, why: errs.join(' | ').slice(0, 400) };
}

const NUR_SYSTEM = `You are Nur, a warm, knowledgeable Quran and Islam teacher inside a learning app called Iqra.
You help with Arabic letters and reading, tajweed, memorization technique, tafsir and the context of surahs and ayahs, and also general Islamic questions: beliefs, worship (prayer, fasting, zakat, Hajj), ethics, the life of the Prophet, history, and everyday practice.
Answer Islamic questions directly and helpfully. Do not refuse because you are not a scholar. Give the mainstream, well-established answer first. Where scholars genuinely differ (for example between the four Sunni madhhabs), say so briefly and fairly instead of picking a side. Name sources (a surah and ayah, a hadith collection) only when you are confident of them. Never invent verses, hadith, rulings or attributions; if you are unsure, say so plainly.
For a very personal or high-stakes situation (divorce, inheritance, a complex financial contract, a medical-religious dilemma) still give the general principles, then suggest asking a qualified scholar who can hear the full situation.
Style: short and conversational (usually under 150 words), plain language, no lectures. Ask at most one follow-up question. When asked to quiz, ask ONE question at a time. Write Arabic with full diacritics when you quote it. Stay respectful of all schools; no sectarian attacks. If the question is unrelated to Islam or learning, steer back gently.
You receive a short context object about the student (name, level, progress, what they are looking at). Use it quietly, do not recite it back.
If your answer involves an Islamic ruling, belief, interpretation or religious guidance (not just letters, tajweed or study technique), end your reply with the exact token [[D]] on its own last line. Otherwise do not write it.`;

async function nur(request, env) {
  const g = await guard(request, env); if (g.res) return g.res;
  const b = await readBody(request); if (!b || !Array.isArray(b.messages) || !b.messages.length) return J({ error: 'Bad request' }, 400);
  const msgs = b.messages.slice(-20).filter(x => x && (x.role === 'user' || x.role === 'assistant')).map(x => ({ role: x.role, content: String(x.content || '').slice(0, 1500) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return J({ error: 'Bad request' }, 400);
  const c = b.context && typeof b.context === 'object' ? b.context : {};
  const ctx = JSON.stringify({ name: String(c.name || '').slice(0, 40), level: String(c.level || '').slice(0, 20), plan: String(c.track || '').slice(0, 30), appLevel: +c.appLevel || 1, ayahsLearned: +c.ayahsLearned || 0, surahsMastered: +c.surahsMastered || 0, lessonsDone: +c.lessonsDone || 0, looking_at: String(c.extra || '').slice(0, 400) });
  const g2 = await groqChat(env, { temperature: 0.5, max_tokens: 500, messages: [{ role: 'system', content: NUR_SYSTEM + '\nStudent context: ' + ctx }, ...msgs] });
  if (!g2.ok) { console.error('nur', g2.why); return J({ error: 'Nur is unavailable right now. Please try again in a moment.' }, 502); }
  let reply = g2.text.trim(); const disclaimer = /\[\[D\]\]\s*$/.test(reply); reply = reply.replace(/\s*\[\[D\]\]\s*/g, '').trim();
  return J({ reply: reply.slice(0, 2500), disclaimer });
}

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
async function sessionOf(request, env) {
  const t = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''); if (!t || !env.IQRA_KV) return null;
  const u = await env.IQRA_KV.get('s:' + t); if (!u) return null;
  return { u, t, rec: await env.IQRA_KV.get('u:' + u, 'json') };
}
const suspendedNow = r => !!(r && r.suspended && !(r.until && Date.now() > r.until));
async function authed(request, env) { const x = await sessionOf(request, env); return x && x.rec && !suspendedNow(x.rec) ? x : null; }
// Signed-in check that tells the app why it was refused (suspended, or the account was removed).
async function gate(request, env) {
  const x = await sessionOf(request, env);
  if (!x) return { res: J({ error: 'Please sign in again.' }, 401) };
  if (!x.rec) return { res: J({ error: 'This account no longer exists.', gone: true }, 401) };
  if (suspendedNow(x.rec)) return { res: J({ error: 'This account has been suspended.', suspended: true, reason: x.rec.reason || '', until: x.rec.until || 0 }, 403) };
  return { a: x };
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
    if (path === 'config' && m === 'GET') { const c = await getCfg(env); return J({ banner: c.banner.on && c.banner.text ? c.banner : null, maintenance: c.maintenance.on ? c.maintenance : null, registrations: c.registrations }); }
    if (path === 'community' && m === 'GET') return communityList(request, env);
    if (path.startsWith('admin/') || path === 'admin') return admin(path.slice(6), m, request, env);

    // ---------- AI coach ----------
    if (path === 'transcribe' && m === 'POST') return transcribe(request, env);
    if (path === 'coach' && m === 'POST') return coach(request, env);
    if (path === 'nur' && m === 'POST') return nur(request, env);

    // ---------- accounts ----------
    if (!env.IQRA_KV) return J({ error: 'Cloud sync is not configured (bind a KV namespace named IQRA_KV).' }, 503);
    const kv = env.IQRA_KV;

    if (path === 'register' && m === 'POST') {
      if (!(await getCfg(env)).registrations) return J({ error: 'New sign-ups are paused right now. Please check back soon.' }, 403);
      const b = await readBody(request); if (!b) return J({ error: 'Bad request' }, 400);
      const username = String(b.username || '').trim().toLowerCase(), email = String(b.email || '').trim().toLowerCase(), password = String(b.password || '');
      if (!okUser(username)) return J({ error: 'Username must be 3–20 letters, numbers or underscores.' }, 400);
      if (!okEmail(email)) return J({ error: 'Please enter a valid email.' }, 400);
      if (password.length < 8 || password.length > 200) return J({ error: 'Password must be at least 8 characters.' }, 400);
      if (await kv.get('u:' + username)) return J({ error: 'That username is taken.' }, 409);
      if (await kv.get('e:' + email)) return J({ error: 'That email already has an account.' }, 409);
      const state = b.state && JSON.stringify(b.state).length < MAX_STATE ? b.state : null;
      await kv.put('u:' + username, JSON.stringify({ username, email, ...(await newCred(password, env)), created: Date.now(), state }));
      await kv.put('e:' + email, username); await bump(env, 'reg');
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
      if (rec.suspended && !suspendedNow(rec)) { delete rec.suspended; delete rec.until; delete rec.reason; await kv.put('u:' + rec.username, JSON.stringify(rec)); }
      if (suspendedNow(rec)) return J({ error: 'This account has been suspended' + (rec.until ? ' until ' + new Date(rec.until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '') + '.' + (rec.reason ? ' Reason: ' + rec.reason : ''), suspended: true, reason: rec.reason || '', until: rec.until || 0 }, 403);
      await kv.delete('f:' + id); await bump(env, 'login');
      if ((rec.v || 1) < 2 || (!rec.pp && env.PW_PEPPER)) await kv.put('u:' + rec.username, JSON.stringify({ ...rec, ...(await newCred(password, env)) })); // upgrade old hashes
      return J({ token: await newSession(env, rec.username), username: rec.username, email: rec.email, state: rec.state });
    }

    if (path === 'logout' && m === 'POST') { const x = await sessionOf(request, env); if (x) await kv.delete('s:' + x.t); return J({ ok: true }); }
    if (path.startsWith('img/') && m === 'GET') return serveImg(path.slice(4), env);
    if (path.startsWith('community/')) return communityApi(path.slice(10), m, request, env);
    const gt = await gate(request, env); if (gt.res) return gt.res; const a = gt.a;

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
      if (username !== a.u) { const ul = await kv.get('ul:' + a.u); if (ul) { await kv.put('ul:' + username, ul); await kv.delete('ul:' + a.u); } await kv.delete('u:' + a.u); await kv.put('s:' + a.t, username, { expirationTtl: SESSION_TTL }); }
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

// ---------- config, stats ----------
const DEF_CFG = { banner: { on: false, text: '', tone: 'info' }, maintenance: { on: false, text: '' }, registrations: true, coach: true, nur: true, limits: { coach: 150, nur: 80 } };
async function getCfg(env) {
  if (!env.IQRA_KV) return DEF_CFG; let c = null; try { c = await env.IQRA_KV.get('cfg', 'json'); } catch { /* defaults */ } c = c || {};
  return { ...DEF_CFG, ...c, banner: { ...DEF_CFG.banner, ...(c.banner || {}) }, maintenance: { ...DEF_CFG.maintenance, ...(c.maintenance || {}) }, limits: { ...DEF_CFG.limits, ...(c.limits || {}) } };
}
const dayKey = (d = Date.now()) => new Date(d).toISOString().slice(0, 10);
async function bump(env, k) { // rough daily counters for the dev portal
  if (!env.IQRA_KV) return; try { const key = 'st:' + dayKey(), c = (await env.IQRA_KV.get(key, 'json')) || {}; c[k] = (c[k] || 0) + 1; await env.IQRA_KV.put(key, JSON.stringify(c), { expirationTtl: 3456000 }); } catch { /* stats are best effort */ }
}
const sortPosts = l => [...l].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at);
const KINDS = ['news', 'update', 'reminder', 'dua', 'event'];
const okId = x => typeof x === 'string' && /^[0-9a-f]{8,16}$/.test(x);

// ---------- community: posts, likes, comments, photos ----------
const pub = (p, liked) => ({ id: p.id, title: p.title, body: p.body, kind: p.kind, link: p.link || '', pinned: !!p.pinned, at: p.at, imgs: p.imgs || [], likes: p.likes || 0, cc: p.cc || 0, closed: !!p.nocomments, liked: !!liked });
async function communityList(request, env) {
  if (!env.IQRA_KV) return J({ posts: [] });
  const list = sortPosts((await env.IQRA_KV.get('community', 'json')) || []).slice(0, 40), x = await sessionOf(request, env).catch(() => null);
  const mine = x && x.rec && !suspendedNow(x.rec) ? (await env.IQRA_KV.get('ul:' + x.u, 'json')) || [] : [];
  return J({ posts: list.map(p => pub(p, mine.includes(p.id))), me: x && x.rec ? x.u : '' });
}
async function communityApi(sub, m, request, env) {
  const kv = env.IQRA_KV; if (!kv) return J({ error: 'Not available' }, 503); const url = new URL(request.url);
  if (sub === 'comments' && m === 'GET') {
    const id = url.searchParams.get('id') || ''; if (!okId(id)) return J({ error: 'Bad request' }, 400);
    const x = await sessionOf(request, env).catch(() => null), me = x && x.rec ? x.u : '', list = (await kv.get('cm:' + id, 'json')) || [];
    return J({ comments: list.map(c => ({ id: c.id, user: c.user, text: c.text, at: c.at, mine: !!me && c.user === me })), me });
  }
  if (m !== 'POST') return J({ error: 'Not found' }, 404);
  const gt = await gate(request, env); if (gt.res) return gt.res; const a = gt.a, b = (await readBody(request)) || {};
  if (!okId(b.id)) return J({ error: 'Bad request' }, 400);
  const posts = (await kv.get('community', 'json')) || [], post = posts.find(p => p.id === b.id); if (!post) return J({ error: 'That post is gone.' }, 404);
  if (sub === 'like') {
    const mine = (await kv.get('ul:' + a.u, 'json')) || [], had = mine.includes(post.id), now = !had;
    await kv.put('ul:' + a.u, JSON.stringify(now ? [...mine, post.id].slice(-300) : mine.filter(i => i !== post.id)));
    post.likes = Math.max(0, (post.likes || 0) + (now ? 1 : -1)); await kv.put('community', JSON.stringify(posts)); return J({ liked: now, likes: post.likes });
  }
  if (sub === 'comment') {
    if (post.nocomments) return J({ error: 'Comments are closed on this post.' }, 403);
    const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 300); if (!text) return J({ error: 'Write something first.' }, 400);
    if (!(await throttle(env, 'cmt:' + a.u, 8, 600))) return J({ error: 'Slow down a little. Try again in a few minutes.' }, 429);
    const list = (await kv.get('cm:' + post.id, 'json')) || [], c = { id: hex(rnd(4)), user: a.u, text, at: Date.now() };
    list.push(c); await kv.put('cm:' + post.id, JSON.stringify(list.slice(-300))); post.cc = Math.min(300, list.length); await kv.put('community', JSON.stringify(posts));
    return J({ comment: { ...c, mine: true }, cc: post.cc });
  }
  if (sub === 'comment-delete') {
    const list = (await kv.get('cm:' + post.id, 'json')) || [], c = list.find(x => x.id === b.cid); if (!c || c.user !== a.u) return J({ error: 'You can only delete your own comments.' }, 403);
    const next = list.filter(x => x.id !== b.cid); await kv.put('cm:' + post.id, JSON.stringify(next)); post.cc = next.length; await kv.put('community', JSON.stringify(posts)); return J({ ok: true, cc: post.cc });
  }
  return J({ error: 'Not found' }, 404);
}
const sniff = u => u[0] === 0xFF && u[1] === 0xD8 ? 'image/jpeg' : u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4E ? 'image/png' : u[0] === 0x52 && u[1] === 0x49 && u[8] === 0x57 && u[9] === 0x45 ? 'image/webp' : '';
async function serveImg(id, env) {
  if (!env.IQRA_KV || !/^[0-9a-f]{16}$/.test(id)) return new Response('Not found', { status: 404 });
  const r = await env.IQRA_KV.getWithMetadata('img:' + id, 'arrayBuffer'); if (!r || !r.value) return new Response('Not found', { status: 404 });
  return new Response(r.value, { headers: { 'Content-Type': (r.metadata && r.metadata.type) || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
}

// ---------- dev portal API (needs the ADMIN_PASSWORD secret) ----------
async function adminAuth(request, env) {
  const t = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''); if (!t || !env.IQRA_KV) return false;
  return !!(await env.IQRA_KV.get('a:' + t));
}
async function logA(env, action, detail) { try { const l = (await env.IQRA_KV.get('alog', 'json')) || []; l.unshift({ at: Date.now(), action, detail: String(detail || '').slice(0, 120) }); await env.IQRA_KV.put('alog', JSON.stringify(l.slice(0, 100))); } catch { /* best effort */ } }
const digest = async s => b64(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const brief = r => { const st = r.state || {}; return { username: r.username, email: r.email, created: r.created || 0, suspended: suspendedNow(r), until: r.until || 0, reason: r.reason || '', xp: st.xp || 0, level: st.profile?.level || '', streak: st.streak || 0, lastActive: st.lastActive || '', lessons: Object.keys(st.lessons || {}).length, recites: (st.recites || []).length, name: st.profile?.name || '' }; };
async function admin(sub, m, request, env) {
  if (!env.ADMIN_PASSWORD) return J({ error: 'Dev portal is not set up. Add the ADMIN_PASSWORD secret in Cloudflare.' }, 503);
  if (!env.IQRA_KV) return J({ error: 'KV is not bound.' }, 503); const kv = env.IQRA_KV;
  if (sub === 'login' && m === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'x'; if (!(await throttle(env, 'af:' + ip, 8, 900))) return J({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
    const b = await readBody(request) || {}; if (!same(await digest(String(b.password || '')), await digest(env.ADMIN_PASSWORD))) { await logA(env, 'login failed', ip); return J({ error: 'Wrong password.' }, 401); }
    const token = hex(rnd(32)); await kv.put('a:' + token, '1', { expirationTtl: 28800 }); await logA(env, 'login', ip); return J({ token });
  }
  if (!(await adminAuth(request, env))) return J({ error: 'Session expired. Sign in again.' }, 401);
  const b = m === 'POST' && sub !== 'upload' ? (await readBody(request)) || {} : {}, url = new URL(request.url);
  if (sub === 'logout') { await kv.delete('a:' + (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')); return J({ ok: true }); }
  if (sub === 'overview') {
    let total = 0, cursor, susp = 0; for (let i = 0; i < 10; i++) { const r = await kv.list({ prefix: 'u:', limit: 1000, cursor }); total += r.keys.length; if (r.list_complete) break; cursor = r.cursor; }
    const days = [...Array(7)].map((_, i) => dayKey(Date.now() - (6 - i) * 864e5)), stats = await Promise.all(days.map(async d => ({ day: d, ...((await kv.get('st:' + d, 'json')) || {}) })));
    const posts = (await kv.get('community', 'json')) || [];
    return J({ total, stats, posts: posts.length, groq: !!env.GROQ_API_KEY, pepper: !!env.PW_PEPPER, cfg: await getCfg(env), susp });
  }
  if (sub === 'accounts') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase(), cursor = url.searchParams.get('cursor') || undefined; let names = [], next = null;
    if (q.includes('@')) { const u = await kv.get('e:' + q); if (u) names = [u]; }
    else { const r = await kv.list({ prefix: 'u:' + q, limit: 25, cursor: q ? undefined : cursor }); names = r.keys.map(k => k.name.slice(2)); next = !q && !r.list_complete ? r.cursor : null; }
    const rows = (await Promise.all(names.map(n => kv.get('u:' + n, 'json')))).filter(Boolean).map(brief); return J({ rows, next });
  }
  if (sub === 'account' && m === 'POST') {
    const u = String(b.username || '').toLowerCase(), rec = await kv.get('u:' + u, 'json'); if (!rec) return J({ error: 'No such account.' }, 404);
    if (b.action === 'suspend') { rec.suspended = true; rec.reason = String(b.reason || '').slice(0, 200); const dd = Math.round(+b.days); if (dd > 0) rec.until = Date.now() + Math.min(dd, 3650) * 864e5; else delete rec.until; await kv.put('u:' + u, JSON.stringify(rec)); await logA(env, 'suspend', u); return J({ ok: true }); }
    if (b.action === 'unsuspend') { delete rec.suspended; delete rec.reason; delete rec.until; await kv.put('u:' + u, JSON.stringify(rec)); await logA(env, 'unsuspend', u); return J({ ok: true }); }
    if (b.action === 'delete') { await kv.delete('u:' + u); await kv.delete('e:' + rec.email); await kv.delete('ul:' + u); await logA(env, 'delete', u); return J({ ok: true }); }
    if (b.action === 'resetpw') { const temp = hex(rnd(5)) + 'Aa1'; await kv.put('u:' + u, JSON.stringify({ ...rec, ...(await newCred(temp, env)) })); await logA(env, 'reset password', u); return J({ ok: true, temp }); }
    return J({ error: 'Unknown action.' }, 400);
  }
  if (sub === 'upload' && m === 'POST') {
    const buf = await request.arrayBuffer(); if (buf.byteLength < 100 || buf.byteLength > 1500000) return J({ error: 'Photos must be under 1.5 MB.' }, 400);
    const type = sniff(new Uint8Array(buf)); if (!type) return J({ error: 'Use a JPEG, PNG or WebP photo.' }, 400);
    const id = hex(rnd(8)); await kv.put('img:' + id, buf, { metadata: { type } }); return J({ id });
  }
  if (sub === 'comments') { const id = url.searchParams.get('id') || ''; return J({ comments: okId(id) ? (await kv.get('cm:' + id, 'json')) || [] : [] }); }
  if (sub === 'comment-delete' && m === 'POST') {
    const posts = (await kv.get('community', 'json')) || [], post = posts.find(p => p.id === b.id); if (!post || !okId(b.id)) return J({ error: 'No such post.' }, 404);
    const next = ((await kv.get('cm:' + b.id, 'json')) || []).filter(x => x.id !== b.cid); await kv.put('cm:' + b.id, JSON.stringify(next)); post.cc = next.length; await kv.put('community', JSON.stringify(posts)); await logA(env, 'delete comment', b.id); return J({ ok: true });
  }
  if (sub === 'posts') return J({ posts: sortPosts((await kv.get('community', 'json')) || []) });
  if (sub === 'post' && m === 'POST') {
    const title = String(b.title || '').trim().slice(0, 80), body = String(b.body || '').trim().slice(0, 2000), kind = KINDS.includes(b.kind) ? b.kind : 'news', link = /^https:\/\//.test(String(b.link || '')) ? String(b.link).slice(0, 300) : '';
    if (!title || !body) return J({ error: 'A post needs a title and some text.' }, 400);
    const imgs = (Array.isArray(b.imgs) ? b.imgs : []).filter(x => /^[0-9a-f]{16}$/.test(x)).slice(0, 4);
    const list = (await kv.get('community', 'json')) || []; let post = b.id ? list.find(x => x.id === b.id) : null;
    if (post) { for (const old of post.imgs || []) if (!imgs.includes(old)) await kv.delete('img:' + old); Object.assign(post, { title, body, kind, link, imgs, nocomments: !!b.nocomments, pinned: !!b.pinned, upd: Date.now() }); } else { post = { id: hex(rnd(4)), title, body, kind, link, imgs, nocomments: !!b.nocomments, pinned: !!b.pinned, at: Date.now(), likes: 0, cc: 0 }; list.unshift(post); }
    await kv.put('community', JSON.stringify(list.slice(0, 100))); await logA(env, b.id ? 'edit post' : 'new post', title); return J({ ok: true, post });
  }
  if (sub === 'post-delete' && m === 'POST') { const all = (await kv.get('community', 'json')) || [], gone = all.find(x => x.id === b.id), list = all.filter(x => x.id !== b.id); if (gone) { for (const im of gone.imgs || []) await kv.delete('img:' + im); await kv.delete('cm:' + gone.id); } await kv.put('community', JSON.stringify(list)); await logA(env, 'delete post', b.id); return J({ ok: true }); }
  if (sub === 'config' && m === 'POST') {
    const n = (v, lo, hi, d) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d, c = await getCfg(env);
    const next = { banner: { on: !!b.banner?.on, text: String(b.banner?.text || '').slice(0, 200), tone: ['info', 'warn', 'good'].includes(b.banner?.tone) ? b.banner.tone : 'info' }, maintenance: { on: !!b.maintenance?.on, text: String(b.maintenance?.text || '').slice(0, 200) }, registrations: b.registrations !== false, coach: b.coach !== false, nur: b.nur !== false, limits: { coach: n(b.limits?.coach, 1, 1000, c.limits.coach), nur: n(b.limits?.nur, 1, 1000, c.limits.nur) } };
    await kv.put('cfg', JSON.stringify(next)); await logA(env, 'settings changed', ''); return J({ ok: true, cfg: next });
  }
  if (sub === 'log') return J({ log: (await kv.get('alog', 'json')) || [] });
  return J({ error: 'Not found' }, 404);
}

// ---------- Groq helpers ----------
async function guard(request, env) {
  if (!env.GROQ_API_KEY) return { res: J({ error: 'The coach is unavailable right now.' }, 503) };
  if (env.IQRA_KV) {
    const gt = await gate(request, env); if (gt.res) return gt; const a = gt.a;
    const day = new Date().toISOString().slice(0, 10), cfg = await getCfg(env), pn = new URL(request.url), isT = pn.pathname.endsWith('/transcribe'), isN = pn.pathname.endsWith('/nur'), extra = pn.searchParams.get('x') === '1';
    if (cfg.maintenance.on) return { res: J({ error: cfg.maintenance.text || 'Iqra is getting a quick update. Please try again soon.' }, 503) };
    if (isT && cfg.coach === false) return { res: J({ error: 'The coach is taking a short break. Please try again later.' }, 503) };
    if (isN && cfg.nur === false) return { res: J({ error: 'Nur is taking a short break. Please try again later.' }, 503) };
    if (isT && extra && !(await throttle(env, `x:${a.u}:${day}`, 900, 172800))) return { res: J({ error: 'Daily limit reached. Try again tomorrow.' }, 429) };
    if (isT && !extra && !(await throttle(env, `r:${a.u}:${day}`, cfg.limits.coach, 172800))) return { res: J({ error: 'Daily coach limit reached. Try again tomorrow.' }, 429) };
    if (isN && !(await throttle(env, `n:${a.u}:${day}`, cfg.limits.nur, 172800))) return { res: J({ error: 'You have reached the daily chat limit. Nur will be back tomorrow.' }, 429) };
    if (isT && !extra) await bump(env, 'rec'); else if (isN) await bump(env, 'nur');
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
  const want = String(form.get('model') || ''); fd.append('model', ['whisper-large-v3', 'whisper-large-v3-turbo'].includes(want) ? want : (env.GROQ_STT_MODEL || 'whisper-large-v3'));
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
Candidates with suspect=true matched the expected word closely but the heard spelling swaps a letter that is easy to confuse. The transcript is written from what was heard, so a swapped letter there is real evidence: mark real=true with type pronunciation when the heard letters clearly differ, otherwise real=false.\nCandidates may also carry alt (what a second speech model heard) and ac (an acoustic distance score against the reference recitation: below 1 sounds typical for this student, above 3 sounds clearly different). If both models heard the right word or ac is below 1, the mismatch is probably transcription noise: mark real=false. A high ac together with a different heard word is strong evidence: mark real=true.\nBe consistent: the same evidence must always get the same verdict. Judge only the evidence given and do not invent errors for words that match.\nAlso list up to 6 tajweed REMINDERS (madd, ghunnah, qalqalah, idgham, ikhfa, heavy/light letters, waqf) for words in the passage where those rules apply. These are reminders, not detected errors.
If history is present it lists words this student missed in earlier attempts (with how many times). Judge those words with extra care, and make the summary specific about progress: say plainly which of those words are now fine and which still need work. Do not invent history.
Reply with JSON only, exactly this shape:
{"verdicts":[{"i":number,"real":boolean,"type":"wrong"|"missing"|"pronunciation","issue":string,"tip":string}],"tajweed_watch":[{"i":number,"rule":string,"tip":string}],"summary":string,"strengths":string}
Keep every string under 25 words, kind and specific.`;

async function coach(request, env) {
  const g = await guard(request, env); if (g.res) return g.res;
  const b = await readBody(request); if (!b || !Array.isArray(b.candidates)) return J({ error: 'Bad request' }, 400);
  const payload = {
    surah: String(b.surah || '').slice(0, 60), transcript: String(b.transcript || '').slice(0, 8000),
    words: Array.isArray(b.words) && b.words.length <= 250 ? b.words.map((w, i) => `${i}:${String(w).slice(0, 40)}`) : undefined,
    history: Array.isArray(b.history) ? b.history.slice(0, 40).map(h => ({ i: h.i, expected: String(h.expected || '').slice(0, 40), misses: Math.min(99, +h.misses || 1), issue: String(h.issue || '').slice(0, 80) })) : undefined,
    candidates: b.candidates.slice(0, 120).map(c => ({ i: c.i, expected: String(c.expected || '').slice(0, 40), heard: c.heard ? String(c.heard).slice(0, 40) : null, near: Array.isArray(c.near) ? c.near.slice(0, 4) : undefined, sim: c.sim, alt: c.alt ? String(c.alt).slice(0, 40) : undefined, ac: Number.isFinite(+c.ac) ? +c.ac : undefined, suspect: c.suspect === true ? true : undefined })),
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

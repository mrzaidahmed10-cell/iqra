// "More" pages: account, settings, rewards, fasting, hadith, advice, prayer, dhikr, alphabet, about.
import { sliderHTML } from './slider.js';
import {
  S, $, $$, esc, todayKey, levelOf, Auth, logout, updateAccount, changePassword, deleteAccount, save, sheet, closeSheet, ask, toast, feel, sfx, haptic,
  hijri, applyTheme, reward, checkBadges, setLevel, trackFor, alphabetDone, burst,
} from './core.js';
import { ic } from './icons.js';
import { HADITH, ADVICE, DHIKR, LETTERS, THEMES, AVATARS, FAST_TYPES, LEVELS, TRACKS, RECITERS, LENIENCY, formsOf } from './content.js';
import { UNITS } from './curriculum.js';
import { runPlacement } from './placement.js';
import { startLesson } from './lesson.js';
import { back, ring, val, timers, refresh, clearTimers } from './ui.js';

let shopTab = 'themes', fastMonth = new Date();
export const resetAuthFlow = { fn: null };

export function openLevelSheet() {
  const cur = (S.profile && S.profile.level) || 'new';
  const el = sheet(`<h3>Where are you now?</h3><p class="muted">This decides your lessons and daily tasks. You can change it any time and keep all your progress.</p><div class="levels">${LEVELS.map(l => `<button class="lv ${l.id === cur ? 'on' : ''}" data-l="${l.id}"><span class="ico">${ic(l.icon, 22)}</span><div><b>${l.t}</b><small>${l.d}</small><em>${TRACKS[l.track].n}: ${TRACKS[l.track].d}</em></div>${l.id === cur ? ic('check', 20) : ''}</button>`).join('')}</div>`);
  el.addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (!b) return; setLevel(b.dataset.l); feel('ok'); closeSheet(); toast(`Plan switched to ${TRACKS[trackFor(b.dataset.l)].n}`, 'route'); refresh(); });
}

export function viewAccount() {
  const p = S.profile || {}, lv = LEVELS.find(l => l.id === p.level) || LEVELS[0];
  return {
    html: `${back()}<h2>Account</h2><p class="muted small">${Auth.remote ? 'Synced across your devices' : 'Stored on this device only (cloud sync is not connected)'}</p>
    <section class="card form"><h3>Your level</h3><button class="lrow plain" data-act="level"><span class="ico">${ic(lv.icon, 20)}</span><div class="grow"><b>${lv.t}</b><small class="muted">Plan: ${TRACKS[S.track].n}. Tap to change.</small></div>${ic('chevR', 18, 'dim')}</button></section>
    <section class="card form"><h3>Recitation coach</h3><p class="muted small">Strictness: <b>${LENIENCY[S.settings.leniency || 'balanced'].n}</b>. ${p.placement ? 'From your placement quiz.' : 'Take the quiz for a recommendation.'}</p><div class="col-gap"><button class="btn" data-act="placement">${ic('compass', 18)} ${p.placement ? 'Retake placement quiz' : 'Take placement quiz'}</button><a class="btn ghost" href="#/more/settings">Change strictness</a></div></section>
    <section class="card form"><h3>About you</h3><label>Name<input id="a-name" value="${esc(p.name || '')}"></label><label>Age<input id="a-age" type="number" inputmode="numeric" value="${esc(p.age || '')}"></label>
    <label>Gender<select id="a-gender"><option value="male" ${p.gender === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.gender === 'female' ? 'selected' : ''}>Female</option><option value="na" ${p.gender === 'na' ? 'selected' : ''}>Prefer not to say</option></select></label>
    <label>Daily goal<select id="a-goal">${[5, 10, 20, 30].map(g => `<option value="${g}" ${(p.goalMin || 10) === g ? 'selected' : ''}>${g} minutes</option>`).join('')}</select></label><button class="btn primary" data-act="save-profile">Save</button></section>
    <section class="card form"><div class="row-between"><h3>Sign-in details</h3><button class="btn small" data-act="toggle-secret" id="tg">Show</button></div><p class="muted small">Hidden by default for privacy.</p>
    <div id="secret" hidden><label>Username<input id="s-user" value="${esc(Auth.username)}" autocapitalize="none"></label><label>Email<input id="s-email" type="email" value="${esc(Auth.email)}"></label><button class="btn" data-act="save-signin">Update username and email</button>
    <hr><label>Current password<input id="s-cur" type="password" autocomplete="current-password"></label><label>New password<input id="s-new" type="password" autocomplete="new-password" placeholder="8+ characters"></label><button class="btn" data-act="save-pw">Change password</button></div></section>
    <section class="card form"><h3>Your data</h3><div class="col-gap"><button class="btn" data-act="export">${ic('download', 18)} Export my progress</button><button class="btn" data-act="logout">${ic('logout', 18)} Sign out</button><button class="btn danger-o" data-act="delete-acct">${ic('trash', 18)} Delete account</button></div></section>`,
  };
}
export function viewSettings() {
  const s = S.settings, tg = (k, t, d) => `<label class="switch-row"><span><b>${t}</b><small class="muted">${d}</small></span><input type="checkbox" role="switch" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
  const seg = (k, opts) => `<div class="seg" data-seg="${k}">${opts.map(o => `<button class="${String(s[k]) === String(o[0]) ? 'on' : ''}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
  return {
    html: `${back()}<h2>Settings</h2><section class="card form"><h3>Appearance</h3>${seg('mode', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}
    <label>Accent<div class="swatches">${THEMES.filter(t => S.owned.themes.includes(t.id)).map(t => `<button class="sw-t ${s.theme === t.id ? 'on' : ''}" data-act="theme" data-id="${t.id}" style="--sh:${t.h}" aria-label="${t.name}"></button>`).join('')}<a class="sw-more" href="#/more/shop">${ic('plus', 16)}</a></div></label>
    <label>Arabic text size <output id="fso">${s.fontSize}px</output>${sliderHTML('fs', { min: 22, max: 48, value: s.fontSize, label: 'Arabic text size' })}</label><p class="ar preview" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p></section>
    <section class="card form"><h3>Reading</h3>${tg('translation', 'English translation', 'Show meaning under each ayah')}${tg('translit', 'Transliteration', 'Latin letters to help reading')}
    <label>Reciter<select data-set="reciter">${RECITERS.map(r => `<option value="${r.id}" ${s.reciter === r.id ? 'selected' : ''}>${r.n}</option>`).join('')}</select></label>
    <label>Playback speed</label>${seg('rate', [[0.75, '0.75×'], [1, '1×'], [1.25, '1.25×']])}</section>
    <section class="card form"><h3>Recitation coach</h3><label>Strictness</label>${seg('leniency', Object.entries(LENIENCY).map(([k, v]) => [k, v.n]))}<p class="muted small">${LENIENCY[s.leniency || 'balanced'].d}</p><button class="btn" data-act="placement">${ic('compass', 18)} Retake the placement quiz</button></section>
    <section class="card form"><h3>Feel</h3>${tg('sound', 'Sounds', 'Soft tones for answers and navigation')}${tg('haptics', 'Haptics', 'Gentle vibration on supported phones')}${tg('openAll', 'Explorer mode', 'Unlock every surah regardless of level')}</section>`,
  };
}
export function viewShop() {
  const items = shopTab === 'themes' ? THEMES : AVATARS, cur = shopTab === 'themes' ? S.settings.theme : S.settings.avatar;
  const card = it => { const eq = cur === it.id;
    return `<button class="shopi ${eq ? 'eq' : ''}" data-act="equip" data-id="${esc(it.id)}" aria-pressed="${eq}"><div class="prev">${shopTab === 'themes' ? `<i class="sw-t big" style="--sh:${it.h}"></i>` : ic(it.id, 30)}</div><b>${shopTab === 'themes' ? it.name : ''}</b>${eq ? `<small class="muted">${ic('check', 14)} In use</small>` : ''}</button>`; };
  return { html: `${back()}<header class="top"><h2>Appearance</h2></header><p class="muted">Pick the accent color and avatar that feel right to you.</p><div class="seg" data-tabs><button class="${shopTab === 'themes' ? 'on' : ''}" data-act="shop-tab" data-t="themes">Accent</button><button class="${shopTab === 'avatars' ? 'on' : ''}" data-act="shop-tab" data-t="avatars">Avatar</button></div><div class="shopgrid">${items.map(card).join('')}</div>` };
}

// ----- fasting -----
function fastHint(d) {
  const h = hijri(d), out = []; if (!h) return out;
  if (h.m === 9) out.push('Ramadan'); if (h.d >= 13 && h.d <= 15 && h.m !== 9) out.push('White day'); if (h.m === 12 && h.d === 9) out.push('Day of Arafah'); if (h.m === 1 && (h.d === 9 || h.d === 10)) out.push('Ashura season');
  if ([1, 4].includes(d.getDay()) && h.m !== 9) out.push(d.getDay() === 1 ? 'Monday' : 'Thursday'); return out;
}
export function viewFasting() {
  const y = fastMonth.getFullYear(), m = fastMonth.getMonth(), first = new Date(y, m, 1), n = new Date(y, m + 1, 0).getDate(), pad = first.getDay(), tk = todayKey();
  const cells = []; for (let i = 0; i < pad; i++) cells.push('<span></span>');
  for (let d = 1; d <= n; d++) { const k = todayKey(new Date(y, m, d)), f = S.fasts[k]; cells.push(`<button class="day ${f ? 'f' : ''} ${k === tk ? 'today' : ''}" data-act="fast-day" data-d="${k}">${d}${f ? '<i></i>' : ''}</button>`); }
  const total = Object.keys(S.fasts).length, inMonth = Object.keys(S.fasts).filter(k => k.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).length;
  let streak = 0; for (let i = 0; i < 400; i++) { const k = todayKey(new Date(Date.now() - i * 864e5)); if (S.fasts[k]) streak++; else if (i > 0) break; }
  const hints = fastHint(new Date()), hj = hijri();
  return { html: `${back()}<h2>Fasting log</h2><section class="card"><small class="muted">${hj ? esc(hj.text) : ''}</small><p>${hints.length ? `Today: <b>${hints.join(' · ')}</b>. A recommended day to fast.` : 'No special fasting day today.'}</p></section>
    <section class="stats3"><div class="card stat"><b>${inMonth}</b><small>this month</small></div><div class="card stat"><b>${total}</b><small>all time</small></div><div class="card stat"><b>${streak}</b><small>day streak</small></div></section>
    <section class="card"><div class="row-between"><button class="icon-btn" data-act="fast-prev" aria-label="Previous month">${ic('chevL', 20)}</button><b>${first.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</b><button class="icon-btn" data-act="fast-next" aria-label="Next month">${ic('chevR', 20)}</button></div><div class="cal-h">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<span>${x}</span>`).join('')}</div><div class="cal">${cells.join('')}</div><p class="muted small center">Tap a day to log or clear a fast.</p></section>` };
}
export function viewHadith() {
  const dayN = Math.floor(Date.now() / 864e5), h = HADITH[dayN % HADITH.length];
  return { html: `${back()}<h2>Hadith</h2><section class="card hadith-today"><small class="muted">Hadith of the day</small><p class="quote">“${esc(h.t)}”</p><small class="muted">${esc(h.s)}</small></section>
    <p class="muted small">Plain-English summaries of well-known hadith. Always check the exact wording in the cited collection.</p>${HADITH.map((x, i) => `<article class="card hadith"><p>${esc(x.t)}</p><div class="row-between"><small class="muted">${esc(x.s)}</small><button class="icon-btn sm ${S.favs.includes(i) ? 'fav' : ''}" data-act="fav" data-i="${i}" aria-label="Favorite">${ic('heart', 18)}</button></div></article>`).join('')}` };
}
export function viewAdvice() {
  const cats = [...new Set(ADVICE.map(a => a.c))];
  return { html: `${back()}<h2>Learning advice</h2>${cats.map(c => `<h3 class="sec">${c}</h3>${ADVICE.filter(a => a.c === c).map(a => `<article class="card advice"><span class="ico">${ic(a.i, 20)}</span><div><b>${esc(a.t)}</b><p class="muted">${esc(a.d)}</p></div></article>`).join('')}`).join('')}` };
}
export function viewAbout() {
  return { html: `${back()}<h2>About Iqra</h2><section class="card"><h3>How it works</h3><p>Pick your level and Iqra builds a path: letters, vowels and reading first, or tajweed and memorization if you already read. Each lesson <b>teaches before it tests</b>, and your place is saved if you leave. Learn a surah in lessons of up to 20 ayahs, then recite it to be graded.</p></section>
    <section class="card"><h3>Recitation grading and Nur</h3><p>Your recitation is compared word by word with the mushaf and reviewed for pronunciation and tajweed. Nur is a chat coach you can ask anything. Both are practice partners: fine details like exact madd length are best confirmed by a teacher.</p></section>
    <section class="card"><h3>Credits</h3><p class="muted small">Quran text, translation (Sahih International), audio and prayer times come from trusted third-party sources. The full list is in the <a href="privacy.html">Privacy policy</a> and <a href="terms.html">Terms</a>. Fonts: Amiri Quran and Instrument Sans.</p></section>` };
}

// ----- dhikr -----
export function viewDhikr() {
  const d = S.dhikr, p = DHIKR[d.idx] || DHIKR[0];
  return { html: `${back()}<h2>Dhikr counter</h2><div class="chips-row scroll">${DHIKR.map((x, i) => `<button class="pick ${d.idx === i ? 'on' : ''}" data-act="dhikr-pick" data-i="${i}">${x.en}</button>`).join('')}</div>
    <div class="dhikr"><p class="ar big" dir="rtl">${p.ar}</p><button class="dbtn" data-act="dhikr-tap" aria-label="Count">${ring(d.count / p.goal, 220, `<span id="dc">${d.count}</span>`, `of ${p.goal}`)}</button></div>
    <p class="muted center">Total all time: <b id="dt">${d.total}</b></p><div class="center"><button class="btn ghost" data-act="dhikr-reset">Reset count</button></div>` };
}

// ----- alphabet reference -----
export function viewAlphabet() {
  return { html: `${back()}<h2>Arabic alphabet</h2><p class="muted">Tap a letter to see its sound and shapes. Arabic reads right to left.</p><div class="alpha" dir="rtl">${LETTERS.map((l, i) => `<button class="letter" data-act="alpha" data-i="${i}"><span class="ar">${l.c}</span><small>${l.n}</small></button>`).join('')}</div>
    <div class="col-gap">${alphabetDone() ? `<p class="muted center">${ic('check', 16)} You completed the letters course.</p>` : `<button class="btn primary" data-act="start-lesson" data-id="letters-1">${ic('type', 18)} Start the letters course</button>`}<button class="btn" data-act="arcade">${ic('dice', 18)} Practice in the break room</button></div>` };
}
export function letterSheet(i) {
  const l = LETTERS[i];
  sheet(`<div class="ar giant center">${l.c}</div><h3 class="center">${l.n}</h3><p class="center muted">${esc(l.h)}</p><p class="center small muted">Look for: ${esc(l.d)}</p><div class="forms" dir="rtl">${formsOf(l).map(f => `<div><span class="ar">${f[1]}</span><small>${f[0]}</small></div>`).join('')}</div>${l.j ? '' : '<p class="muted small center">This letter does not connect to the next one.</p>'}<button class="btn" data-act="close-sheet">Close</button>`);
}

// ----- actions owned by these pages -----
const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
export function openPlacement() {
  const ov = document.createElement('div'); ov.className = 'game plcov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Placement quiz');
  ov.innerHTML = `<header class="ov-top"><button class="icon-btn" data-x aria-label="Close">${ic('x', 20)}</button><b>Placement quiz</b><span></span></header><div class="ov-body" id="plc-root"></div>`;
  document.body.append(ov); document.body.classList.add('noscroll'); requestAnimationFrame(() => ov.classList.add('in'));
  let stop = null; const close = () => { if (stop) stop(); ov.classList.remove('in'); setTimeout(() => ov.remove(), 280); if (!document.querySelector('.lesson,.recite,.nur,.game:not(.plcov)')) document.body.classList.remove('noscroll'); };
  ov.querySelector('[data-x]').onclick = close;
  stop = runPlacement(ov.querySelector('#plc-root'), { onCancel: close, onDone: r => {
    setLevel(r.level); S.settings.leniency = r.leniency; S.profile.placement = { at: Date.now(), scores: r.scores }; save(); close();
    toast(`Level: ${LEVELS.find(l => l.id === r.level).t}. Coach: ${LENIENCY[r.leniency].n}.`, 'check'); refresh();
  } });
}

export const PAGE_ACT = {
  placement: () => openPlacement(),
  level: () => openLevelSheet(),
  'toggle-secret': t => { const s = $('#secret'); s.hidden = !s.hidden; t.textContent = s.hidden ? 'Show' : 'Hide'; },
  'save-profile': () => { const p = S.profile || (S.profile = {}); p.name = val('a-name') || p.name; p.age = +val('a-age') || p.age; p.gender = val('a-gender'); p.goalMin = +val('a-goal'); save(); feel('ok'); toast('Profile saved', 'check'); },
  'save-signin': async () => { try { await updateAccount({ username: val('s-user'), email: val('s-email') }); toast('Sign-in details updated', 'check'); } catch (e) { toast(e.message, 'info'); } },
  'save-pw': async () => { try { await changePassword(val('s-cur'), val('s-new')); toast('Password changed', 'check'); $('#s-cur').value = $('#s-new').value = ''; } catch (e) { toast(e.message, 'info'); } },
  export: () => download('iqra-progress.json', JSON.stringify({ ...S }, null, 2)),
  logout: async () => { if (!(await ask({ title: 'Sign out?', ok: 'Sign out' }))) return; await logout(); location.hash = ''; resetAuthFlow.fn && resetAuthFlow.fn('login'); },
  'delete-acct': async () => { const pw = await ask({ title: 'Delete your account?', body: 'This permanently deletes your account and progress. Enter your password to confirm.', input: 'password', ok: 'Delete', danger: true }); if (!pw) return; try { await deleteAccount(pw); location.hash = ''; resetAuthFlow.fn && resetAuthFlow.fn('welcome'); } catch (e) { toast(e.message, 'info'); } },
  'shop-tab': t => { shopTab = t.dataset.t; refresh(); },
  buy: t => { const it = [...THEMES, ...AVATARS].find(x => x.id === t.dataset.id); if (!it || S.coins < it.cost || levelOf(S.xp) < it.lvl) return; S.coins -= it.cost; (shopTab === 'themes' ? S.owned.themes : S.owned.avatars).push(it.id); save(); feel('ok'); toast('Unlocked', 'gem'); PAGE_ACT.equip(t); },
  equip: t => { if (shopTab === 'themes') { S.settings.theme = t.dataset.id; applyTheme(); } else S.settings.avatar = t.dataset.id; save(); feel('tap'); refresh(); },
  theme: t => { S.settings.theme = t.dataset.id; applyTheme(); save(); feel('tap'); refresh(); },
  'fast-prev': () => { fastMonth = new Date(fastMonth.getFullYear(), fastMonth.getMonth() - 1, 1); refresh(); },
  'fast-next': () => { fastMonth = new Date(fastMonth.getFullYear(), fastMonth.getMonth() + 1, 1); refresh(); },
  'fast-day': t => { const k = t.dataset.d; sheet(`<h3 class="center">${new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3><div class="opts col">${FAST_TYPES.map(f => `<button class="opt ${S.fasts[k] === f.id ? 'right' : ''}" data-act="fast-set" data-d="${k}" data-f="${f.id}"><span class="oi">${ic(f.i, 18)}</span> ${f.l}</button>`).join('')}${S.fasts[k] ? `<button class="opt" data-act="fast-set" data-d="${k}" data-f="">${ic('x', 18)} Clear</button>` : ''}</div>`); },
  'fast-set': t => { const k = t.dataset.d; if (t.dataset.f) S.fasts[k] = t.dataset.f; else delete S.fasts[k]; reward({ streak: false }); closeSheet(); feel('tap'); refresh(); },
  fav: t => { const i = +t.dataset.i, k = S.favs.indexOf(i); if (k >= 0) S.favs.splice(k, 1); else S.favs.push(i); save(); refresh(); },
  'dhikr-pick': t => { S.dhikr.idx = +t.dataset.i; S.dhikr.count = 0; save(); refresh(); },
  'dhikr-tap': () => {
    const d = S.dhikr, p = DHIKR[d.idx]; d.count++; d.total++; haptic('tap'); sfx('tick');
    if (d.count >= p.goal) { feel('done'); toast(`${p.en} complete`, 'beads'); d.count = 0; }
    save(); const nb = checkBadges(); if (nb.length) { save(); nb.forEach(b => toast(`Badge: ${b.n}`, b.i)); }
    const rf = $('.dhikr .rf'), c = 2 * Math.PI * (220 / 2 - 8); if (rf) rf.setAttribute('stroke-dashoffset', c * (1 - d.count / p.goal));
    if ($('#dc')) $('#dc').textContent = d.count; if ($('#dt')) $('#dt').textContent = d.total;
  },
  'dhikr-reset': () => { S.dhikr.count = 0; save(); refresh(); },
  alpha: t => letterSheet(+t.dataset.i),
  'start-lesson': t => startLesson(t.dataset.id),
};
export { UNITS, burst };

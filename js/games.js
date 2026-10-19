// Calm break games, built on the alphabet: Pairs, Letter pop, Glide. Three paid rounds a day.
import { S, $, esc, shuffle, feel, sfx, day, reward, burst } from './core.js';
import { LETTERS } from './content.js';
import { ic } from './icons.js';

export function openArcade() {
  const ov = document.createElement('div'); ov.className = 'game'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Break room');
  document.body.append(ov); document.body.classList.add('noscroll'); requestAnimationFrame(() => ov.classList.add('in'));
  let stop = null;
  const close = () => { if (stop) stop(); stop = null; ov.classList.remove('in'); setTimeout(() => ov.remove(), 280); if (!document.querySelector('.lesson,.recite,.nur')) document.body.classList.remove('noscroll'); window.dispatchEvent(new Event('iqra-refresh')); };
  const top = (back) => `<header class="ov-top"><button class="icon-btn" data-k="${back ? 'menu' : 'close'}" aria-label="${back ? 'Back' : 'Close'}">${ic(back ? 'arrowL' : 'x', 20)}</button><b>Break room</b><span></span></header>`;

  function menu() {
    if (stop) stop(); stop = null; const left = Math.max(0, 3 - day().breaks);
    ov.innerHTML = `${top()}<div class="ov-body"><p class="muted center">${left ? `A short pause that still trains your eye. <b>${left}</b> rewarded round${left > 1 ? 's' : ''} left today.` : 'Rewards are used up today, but you can still play for fun.'}</p>
      ${[['memory', 'dice', 'Pairs', 'Match each letter with its name'], ['bubbles', 'target', 'Letter pop', 'Tap the target letter as it rises'], ['flappy', 'feather', 'Glide', 'Hold your course through the gaps']].map(g => `<button class="gcard" data-k="${g[0]}"><span class="gi">${ic(g[1], 22)}</span><div><b>${g[2]}</b><small>${g[3]}</small></div>${ic('chevR', 18)}</button>`).join('')}</div>`;
  }
  function launch(kind) {
    ov.innerHTML = `${top(true)}<div class="ov-body" id="stage"></div>`;
    const end = (title, score, coins) => {
      if (stop) stop(); stop = null;
      const paid = day().breaks < 3; day().breaks++; S.gamesPlayed++;
      const r = reward({ xp: paid ? 10 : 0, coins: paid ? coins : 0, streak: false });
      feel('done'); if (score > 0) burst();
      $('#stage', ov).innerHTML = `<div class="working"><h2>${esc(title)}</h2><p class="muted">Score</p><div class="score">${score}</div>
        <p>${paid ? `+${coins} coins · +10 XP` : 'Rewards used up for today. Come back tomorrow.'}</p>${r.leveled ? `<p class="lvl-line">${ic('trophy', 18)} Level ${r.leveled}</p>` : ''}
        <div class="col-gap"><button class="btn primary" data-k="${kind}">Play again</button><button class="btn" data-k="menu">Other games</button><button class="btn ghost" data-k="close">Back to learning</button></div></div>`;
    };
    stop = { memory, bubbles, flappy }[kind]($('#stage', ov), end);
  }
  ov.addEventListener('click', e => { const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return; if (k === 'close') close(); else if (k === 'menu') menu(); else launch(k); });
  menu();
}

function memory(root, end) {
  const pairs = shuffle(LETTERS).slice(0, 8);
  const cards = shuffle(pairs.flatMap(l => [{ id: l.c, t: l.c, ar: 1 }, { id: l.c, t: l.n, ar: 0 }]));
  let first = null, lock = false, moves = 0, found = 0;
  root.innerHTML = `<div class="g-head"><b>Pairs</b><span id="mv">Moves 0</span></div>
    <div class="mem">${cards.map((c, i) => `<button class="mcard" data-i="${i}" aria-label="Card ${i + 1}"><span class="f"></span><span class="b ${c.ar ? 'ar' : ''}">${esc(c.t)}</span></button>`).join('')}</div>`;
  const el = i => root.querySelector(`.mcard[data-i="${i}"]`);
  root.onclick = e => {
    const b = e.target.closest('.mcard'); if (!b || lock || b.classList.contains('open') || b.classList.contains('done')) return;
    const i = +b.dataset.i; b.classList.add('open'); feel('tick');
    if (first === null) { first = i; return; }
    moves++; $('#mv', root).textContent = 'Moves ' + moves;
    const a = first; first = null;
    if (cards[a].id === cards[i].id) {
      el(a).classList.add('done'); el(i).classList.add('done'); feel('right'); found++;
      if (found === pairs.length) setTimeout(() => end('All matched', Math.max(10, 120 - moves * 5), Math.min(30, Math.max(5, Math.round(40 - moves * 1.5)))), 600);
    } else { lock = true; setTimeout(() => { el(a).classList.remove('open'); el(i).classList.remove('open'); lock = false; }, 800); }
  };
  return () => { root.onclick = null; };
}

function bubbles(root, end) {
  let score = 0, time = 30, lives = 3, target = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  root.innerHTML = `<div class="g-head"><b>Letter pop</b><span id="bs"></span></div><div class="target">Tap <b class="ar" id="tg"></b> <small id="tn"></small></div><div class="field" id="fld"></div>`;
  const fld = $('#fld', root), hud = () => { $('#bs', root).textContent = `${time}s · ${lives} left · ${score} popped`; $('#tg', root).textContent = target.c; $('#tn', root).textContent = `(${target.n})`; };
  const spawn = () => {
    const l = Math.random() < .42 ? target : LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const b = document.createElement('button'); b.className = 'bub ar'; b.textContent = l.c; b.style.left = (4 + Math.random() * 76) + '%'; b.style.animationDuration = (4 + Math.random() * 2.5) + 's';
    b.onclick = () => {
      if (!b.isConnected || b.classList.contains('pop')) return;
      if (l.c === target.c) { score++; feel('tap'); b.classList.add('pop'); setTimeout(() => b.remove(), 300); }
      else { lives--; feel('bad'); b.classList.add('bad'); setTimeout(() => b.remove(), 300); if (lives <= 0) finish(); }
      hud();
    };
    b.onanimationend = () => b.remove(); fld.appendChild(b);
  };
  const finish = () => { clearInterval(sp); clearInterval(tm); clearInterval(tg); end(lives > 0 ? 'Time is up' : 'Out of tries', score, Math.min(30, 4 + score * 2)); };
  const sp = setInterval(spawn, 620);
  const tm = setInterval(() => { time--; hud(); if (time <= 0) finish(); }, 1000);
  const tg = setInterval(() => { target = LETTERS[Math.floor(Math.random() * LETTERS.length)]; hud(); }, 8000);
  hud();
  return () => { clearInterval(sp); clearInterval(tm); clearInterval(tg); };
}

function flappy(root, end) {
  const W = 360, H = 520;
  root.innerHTML = `<div class="g-head"><b>Glide</b><span id="fs">0</span></div><canvas id="cv" width="${W}" height="${H}"></canvas><p class="muted center" id="fh">Tap to start, tap to rise</p>`;
  const cv = $('#cv', root), ctx = cv.getContext('2d'); let y = 240, v = 0, t = 0, score = 0, started = false, dead = false, raf = 0; const pipes = [];
  const G = .42, J = -6.8, GAP = 170, PW = 52, BX = 90;
  const cs = getComputedStyle(document.documentElement), h = cs.getPropertyValue('--h').trim() || '228';
  const bg0 = `hsl(${h} 40% 14%)`, bg1 = `hsl(${h} 38% 22%)`, wall = `hsl(${h} 30% 34%)`, gold = 'hsl(41 70% 62%)';
  const flap = () => { if (dead) return; if (!started) { started = true; $('#fh', root).textContent = ''; } v = J; feel('tick'); };
  const key = e => { if (e.code === 'Space') { e.preventDefault(); flap(); } };
  cv.addEventListener('pointerdown', flap); window.addEventListener('keydown', key);
  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, bg0); g.addColorStop(1, bg1); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 24; i++) ctx.fillRect((i * 97 - t * .3 + 1000) % W, (i * 53) % 400, 2, 2);
    ctx.fillStyle = wall;
    for (const p of pipes) { rr(p.x, -10, PW, p.y - GAP / 2 + 10, 12); rr(p.x, p.y + GAP / 2, PW, H, 12); }
    ctx.save(); ctx.translate(BX, y); ctx.rotate(Math.max(-.5, Math.min(.9, v / 12)));
    ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(7, -3, 13, 0, 7); ctx.fill(); ctx.restore();
  }
  function rr(x, yy, w, hh, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, yy, w, hh, r) : ctx.rect(x, yy, w, hh); ctx.fill(); }
  function loop() {
    t++;
    if (started && !dead) {
      v += G; y += v;
      if (t % 85 === 0) pipes.push({ x: W + 10, y: 150 + Math.random() * 220, s: 0 });
      for (const p of pipes) {
        p.x -= 2.6;
        if (!p.s && p.x + PW < BX - 16) { p.s = 1; score++; $('#fs', root).textContent = score; feel('ok'); }
        if (BX + 14 > p.x && BX - 14 < p.x + PW && (y - 14 < p.y - GAP / 2 || y + 14 > p.y + GAP / 2)) dead = true;
      }
      while (pipes.length && pipes[0].x < -80) pipes.shift();
      if (y < 0 || y > H) dead = true;
      if (dead) { sfx('bad'); setTimeout(() => end('Good flight', score, Math.min(30, 3 + score * 3)), 500); }
    } else if (!started) y = 240 + Math.sin(t / 15) * 8;
    draw(); raf = requestAnimationFrame(loop);
  }
  loop();
  return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); dead = true; };
}

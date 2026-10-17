// Arcade break games: Memory Match, Bubble Pop, Flappy Crescent.
import { S, $, esc, shuffle, sfx, day, reward, toast, confetti } from './core.js';
import { LETTERS } from './content.js';

export function openArcade() {
  const ov = document.createElement('div'); ov.className = 'game arcade';
  document.body.append(ov); document.body.classList.add('noscroll');
  let stop = null;
  const close = () => {
    if (stop) stop(); stop = null; ov.remove();
    if (!document.querySelector('.game')) document.body.classList.remove('noscroll');
    window.dispatchEvent(new Event('iqra-refresh'));
  };

  function menu() {
    if (stop) stop(); stop = null;
    const left = Math.max(0, 3 - day().breaks);
    ov.innerHTML = `<div class="game-top"><button class="icon-btn" data-k="close" aria-label="Close">✕</button><div class="grow"><b>Break Room 🎮</b></div></div>
      <div class="game-body arc-menu">
        <p class="muted center">${left ? `Play a game, earn coins. <b>${left}</b> coin-bonus round${left > 1 ? 's' : ''} left today.` : 'Coin bonuses are used up today, but you can still play for fun!'}</p>
        <button class="gcard" data-k="memory"><span>🃏</span><div><b>Memory Match</b><small>Pair Arabic letters with their names</small></div></button>
        <button class="gcard" data-k="bubbles"><span>🫧</span><div><b>Bubble Pop</b><small>Pop the right letter before time runs out</small></div></button>
        <button class="gcard" data-k="flappy"><span>🌙</span><div><b>Flappy Crescent</b><small>Tap to fly between the minarets</small></div></button>
      </div>`;
  }
  function launch(kind) {
    ov.innerHTML = `<div class="game-top"><button class="icon-btn" data-k="menu" aria-label="Back">←</button><div class="grow"></div></div><div class="game-body" id="stage"></div>`;
    const end = (title, score, coins) => {
      if (stop) stop(); stop = null;
      const paid = day().breaks < 3; day().breaks++; S.gamesPlayed++;
      const r = reward({ xp: paid ? 10 : 0, coins: paid ? coins : 0, streak: false });
      sfx('win'); if (score > 0) confetti(30);
      $('#stage', ov).innerHTML = `<div class="result"><div class="big-emoji">🎉</div><h2>${esc(title)}</h2><p class="muted">Score</p><div class="score">${score}</div>
        <p>${paid ? `🪙 +${coins} coins &nbsp; ⚡ +10 XP` : 'Coin bonus used up for today — come back tomorrow!'}</p>${r.leveled ? `<p>Level up! 🚀</p>` : ''}
        <div class="row-gap"><button class="btn primary" data-k="${kind}">Play again</button><button class="btn" data-k="menu">Other games</button><button class="btn ghost" data-k="close">Back to learning</button></div></div>`;
    };
    stop = { memory, bubbles, flappy }[kind]($('#stage', ov), end);
  }
  ov.addEventListener('click', e => {
    const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
    if (k === 'close') close(); else if (k === 'menu') menu(); else launch(k);
  });
  menu();
}

function memory(root, end) {
  const pairs = shuffle(LETTERS).slice(0, 8);
  const cards = shuffle(pairs.flatMap(l => [{ id: l.c, t: l.c, ar: 1 }, { id: l.c, t: l.n, ar: 0 }]));
  let first = null, lock = false, moves = 0, found = 0;
  root.innerHTML = `<div class="g-head"><b>Memory Match</b><span id="mv">Moves 0</span></div>
    <div class="mem">${cards.map((c, i) => `<button class="mcard" data-i="${i}"><span class="f">✦</span><span class="b ${c.ar ? 'ar' : ''}">${esc(c.t)}</span></button>`).join('')}</div>
    <p class="muted center">Match each Arabic letter with its name.</p>`;
  const el = i => root.querySelector(`.mcard[data-i="${i}"]`);
  root.onclick = e => {
    const b = e.target.closest('.mcard'); if (!b || lock || b.classList.contains('open') || b.classList.contains('done')) return;
    const i = +b.dataset.i; b.classList.add('open'); sfx('pop');
    if (first === null) { first = i; return; }
    moves++; $('#mv', root).textContent = 'Moves ' + moves;
    const a = first; first = null;
    if (cards[a].id === cards[i].id) {
      el(a).classList.add('done'); el(i).classList.add('done'); sfx('ok'); found++;
      if (found === pairs.length) setTimeout(() => end('Perfect match!', Math.max(10, 120 - moves * 5), Math.min(30, Math.max(5, Math.round(40 - moves * 1.5)))), 500);
    } else { lock = true; setTimeout(() => { el(a).classList.remove('open'); el(i).classList.remove('open'); lock = false; }, 800); }
  };
  return () => { root.onclick = null; };
}

function bubbles(root, end) {
  let score = 0, time = 30, lives = 3, target = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  root.innerHTML = `<div class="g-head"><b>Bubble Pop</b><span id="bs"></span></div><div class="target">Pop: <b class="ar" id="tg"></b> <small id="tn"></small></div><div class="field" id="fld"></div>`;
  const fld = $('#fld', root), hud = () => { $('#bs', root).textContent = `⏱ ${time}  ${'❤️'.repeat(lives)}  ★ ${score}`; $('#tg', root).textContent = target.c; $('#tn', root).textContent = `(${target.n})`; };
  const spawn = () => {
    const l = Math.random() < .42 ? target : LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const b = document.createElement('button'); b.className = 'bub ar'; b.textContent = l.c; b.style.left = (4 + Math.random() * 76) + '%'; b.style.animationDuration = (4 + Math.random() * 2.5) + 's';
    b.style.setProperty('--h', 170 + Math.floor(Math.random() * 120));
    b.onclick = () => {
      if (!b.isConnected || b.classList.contains('pop')) return;
      if (l.c === target.c) { score++; sfx('pop'); b.classList.add('pop'); setTimeout(() => b.remove(), 250); }
      else { lives--; sfx('bad'); b.classList.add('bad'); setTimeout(() => b.remove(), 250); if (lives <= 0) finish(); }
      hud();
    };
    b.onanimationend = () => b.remove(); fld.appendChild(b);
  };
  const finish = () => { clearInterval(sp); clearInterval(tm); clearInterval(tg); end(lives > 0 ? "Time's up!" : 'Out of lives', score, Math.min(30, 4 + score * 2)); };
  const sp = setInterval(spawn, 620);
  const tm = setInterval(() => { time--; hud(); if (time <= 0) finish(); }, 1000);
  const tg = setInterval(() => { target = LETTERS[Math.floor(Math.random() * LETTERS.length)]; hud(); }, 8000);
  hud();
  return () => { clearInterval(sp); clearInterval(tm); clearInterval(tg); };
}

function flappy(root, end) {
  const W = 360, H = 520;
  root.innerHTML = `<div class="g-head"><b>Flappy Crescent</b><span id="fs">0</span></div><canvas id="cv" width="${W}" height="${H}"></canvas><p class="muted center" id="fh">Tap or press space to start</p>`;
  const cv = $('#cv', root), ctx = cv.getContext('2d'); let y = 240, v = 0, t = 0, score = 0, started = false, dead = false, raf = 0; const pipes = [];
  const G = .42, J = -6.8, GAP = 160, PW = 56, BX = 90;
  const flap = () => { if (dead) return; if (!started) { started = true; $('#fh', root).textContent = ''; } v = J; sfx('pop'); };
  const key = e => { if (e.code === 'Space') { e.preventDefault(); flap(); } };
  cv.addEventListener('pointerdown', flap); window.addEventListener('keydown', key);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--ac').trim() || '#34d399';
  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1d3a'); g.addColorStop(1, '#14532d'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 24; i++) ctx.fillRect((i * 97 + t * .3) % W, (i * 53) % 400, 2, 2);
    for (const p of pipes) {
      ctx.fillStyle = '#e7d9b0'; ctx.fillRect(p.x, 0, PW, p.y - GAP / 2); ctx.fillRect(p.x, p.y + GAP / 2, PW, H);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(p.x - 4, p.y - GAP / 2 - 14, PW + 8, 14); ctx.fillRect(p.x - 4, p.y + GAP / 2, PW + 8, 14);
    }
    ctx.save(); ctx.translate(BX, y); ctx.rotate(Math.max(-.5, Math.min(.9, v / 12)));
    ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(7, -3, 13, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(-4, -6, 2.2, 0, 7); ctx.fill(); ctx.restore();
  }
  function loop() {
    t++;
    if (started && !dead) {
      v += G; y += v;
      if (t % 85 === 0) pipes.push({ x: W + 10, y: 150 + Math.random() * 220, s: 0 });
      for (const p of pipes) {
        p.x -= 2.6;
        if (!p.s && p.x + PW < BX - 16) { p.s = 1; score++; $('#fs', root).textContent = score; sfx('ok'); }
        if (BX + 14 > p.x && BX - 14 < p.x + PW && (y - 14 < p.y - GAP / 2 || y + 14 > p.y + GAP / 2)) dead = true;
      }
      while (pipes.length && pipes[0].x < -80) pipes.shift();
      if (y < 0 || y > H) dead = true;
      if (dead) { sfx('bad'); setTimeout(() => end('Crash landing!', score, Math.min(30, 3 + score * 3)), 500); }
    } else if (!started) y = 240 + Math.sin(t / 15) * 8;
    draw(); raf = requestAnimationFrame(loop);
  }
  loop();
  return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); dead = true; };
}

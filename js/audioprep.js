// Audio helpers for the recitation coach: clean up a recording before it is transcribed, and compare two clips by sound.

export function wavOf(f32, sr = 16000) {
  const n = f32.length, b = new DataView(new ArrayBuffer(44 + n * 2)), w = (o, s) => { for (let i = 0; i < s.length; i++) b.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, sr, true); b.setUint32(28, sr * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, f32[i])); b.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true); }
  return new Blob([b], { type: 'audio/wav' });
}

// Any AudioBuffer (or a slice of one) to 16 kHz mono floats, with rumble removed.
export async function to16k(buf, from = 0, to = buf.duration) {
  const len = Math.max(1, Math.ceil((to - from) * 16000)), off = new OfflineAudioContext(1, len, 16000), src = off.createBufferSource(), hp = off.createBiquadFilter();
  src.buffer = buf; hp.type = 'highpass'; hp.frequency.value = 70; src.connect(hp); hp.connect(off.destination); src.start(0, from, to - from);
  return (await off.startRendering()).getChannelData(0);
}
const normalize = d => { let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); const g = pk > .002 ? Math.min(20, .9 / pk) : 1; if (g !== 1) for (let i = 0; i < d.length; i++) d[i] *= g; return d; };

// Speech models work best on clean 16 kHz mono with a healthy level, which also avoids odd phone codecs.
export async function prepare(blob) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(); let buf;
    try { buf = await ctx.decodeAudioData(await blob.arrayBuffer()); } finally { ctx.close().catch(() => {}); }
    if (!buf || buf.duration > 600 || buf.duration < .3) return blob;
    return wavOf(normalize(await to16k(buf)));
  } catch { return blob; }
}

// ---------- sound comparison: MFCC features + dynamic time warping ----------
const N = 512, HOP = 160, WIN = 400, NM = 26, NC = 13;
const hamming = Float32Array.from({ length: WIN }, (_, i) => .54 - .46 * Math.cos(2 * Math.PI * i / (WIN - 1)));
const mel = f => 2595 * Math.log10(1 + f / 700), imel = m => 700 * (10 ** (m / 2595) - 1);
const bank = (() => {
  const pts = Array.from({ length: NM + 2 }, (_, i) => imel(mel(100) + (mel(7000) - mel(100)) * i / (NM + 1))), bins = pts.map(f => Math.floor((N + 1) * f / 16000));
  return Array.from({ length: NM }, (_, m) => { const f = new Float32Array(N / 2 + 1); for (let k = bins[m]; k < bins[m + 1]; k++) f[k] = (k - bins[m]) / Math.max(1, bins[m + 1] - bins[m]); for (let k = bins[m + 1]; k < bins[m + 2]; k++) f[k] = (bins[m + 2] - k) / Math.max(1, bins[m + 2] - bins[m + 1]); return f; });
})();
const dct = Array.from({ length: NC }, (_, c) => Float32Array.from({ length: NM }, (_, m) => Math.cos(Math.PI * c * (m + .5) / NM)));
function fft(re, im) { // in place radix-2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const u = i + k, v = u + len / 2, xr = re[v] * cr - im[v] * ci, xi = re[v] * ci + im[v] * cr; re[v] = re[u] - xr; im[v] = im[u] - xi; re[u] += xr; im[u] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
}
// Returns frames x 12 features (c1..c12), each coefficient normalized over the clip so voice pitch and loudness matter less.
export function mfcc(x) {
  const frames = []; const re = new Float32Array(N), im = new Float32Array(N);
  for (let s = 0; s + WIN <= x.length; s += HOP) {
    re.fill(0); im.fill(0); for (let i = 0; i < WIN; i++) re[i] = (x[s + i] - (i ? x[s + i - 1] * .97 : 0)) * hamming[i]; fft(re, im);
    const p = new Float32Array(N / 2 + 1); for (let k = 0; k <= N / 2; k++) p[k] = re[k] * re[k] + im[k] * im[k];
    const lm = bank.map(f => { let a = 0; for (let k = 0; k < f.length; k++) a += f[k] * p[k]; return Math.log(a + 1e-9); });
    frames.push(dct.slice(1).map(row => { let a = 0; for (let m = 0; m < NM; m++) a += row[m] * lm[m]; return a; }));
  }
  if (frames.length < 3) return frames;
  const d = frames[0].length; for (let c = 0; c < d; c++) { let m = 0; frames.forEach(f => { m += f[c]; }); m /= frames.length; let v = 0; frames.forEach(f => { f[c] -= m; v += f[c] * f[c]; }); const sd = Math.sqrt(v / frames.length) || 1; frames.forEach(f => { f[c] /= sd; }); }
  return frames;
}
export function dtw(A, B) {
  const n = A.length, m = B.length; if (n < 3 || m < 3) return Infinity;
  const band = Math.max(Math.abs(n - m) + 4, Math.ceil(Math.max(n, m) * .35)), D = Array.from({ length: n + 1 }, () => new Float32Array(m + 1).fill(Infinity)); D[0][0] = 0;
  const dist = (a, b) => { let s = 0; for (let k = 0; k < a.length; k++) { const d = a[k] - b[k]; s += d * d; } return Math.sqrt(s); };
  for (let i = 1; i <= n; i++) { const c = Math.round(i * m / n); for (let j = Math.max(1, c - band); j <= Math.min(m, c + band); j++) D[i][j] = dist(A[i - 1], B[j - 1]) + Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]); }
  return D[n][m] / (n + m);
}
export const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

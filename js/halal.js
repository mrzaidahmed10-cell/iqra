// Halal scanner: scan or type a barcode, look the product up on Open Food Facts, and read its ingredients against a rule list.
// The verdict is guidance only. It is not a fatwa and not a certification.
import { $, esc, toast, feel, haptic } from './core.js';
import { ic } from './icons.js';
import { back } from './ui.js';
import { openNur } from './nur.js';

// ---------- rules ----------
// k: haram = clearly impermissible, doubt = source or method uncertain (mushbooh), low = usually fine, worth a look
const RULES = [
  { k: 'haram', n: 'Pork', re: /\b(?:pork|pig|pigs|swine|porcine|bacon|ham|lard|prosciutto|pancetta|gammon|hog)\b/, why: 'Pork and its derivatives are haram.' },
  { k: 'haram', n: 'Alcoholic drink', re: /\b(?:wine|beer|rum|whisk(?:e)?y|vodka|brandy|liqueur|sake|mirin|bourbon|champagne|cider(?= alcohol)|sherry|port wine|cognac|tequila|gin)\b(?!\s*(?:vinegar|flavou?r|flavou?ring|extract|essence))(?<!root beer)(?<!ginger beer)(?<!\bnon[- ]alcoholic beer)/, why: 'Alcoholic drinks are haram, including when used in cooking.' },
  { k: 'haram', n: 'Blood', re: /\b(?:blood|blood plasma)\b/, why: 'Flowing blood is haram.' },
  { k: 'doubt', n: 'Alcohol / ethanol', re: /(?<!non[- ])(?<!no )(?<!free of )\b(?:alcohol|ethanol|ethyl alcohol)\b(?!\s*free)/, why: 'Alcohol as an ingredient is a concern. Scholars differ on trace amounts used as a flavor carrier.' },
  { k: 'doubt', n: 'Gelatin', an: 1, re: /\b(?:gelatin|gelatine|e\s?441)\b(?<!(?:fish|bovine|beef|halal|plant|vegetable)\s+gelatine?)/, why: 'Gelatin is often pork or non-halal beef. Only fish, plant or halal-certified gelatin is fine.' },
  { k: 'doubt', n: 'Carmine / cochineal (E120)', re: /\b(?:carmine|cochineal|e\s?120|natural red 4)\b/, why: 'Red dye made from insects. Many scholars consider it impermissible.' },
  { k: 'doubt', n: 'Rennet / animal enzymes', an: 1, re: /\b(?:rennet|pepsin|animal enzymes?|lipase|animal rennet|chymosin)\b/, why: 'Often from non-halal slaughtered animals unless microbial or halal-certified.' },
  { k: 'doubt', n: 'L-cysteine (E920)', re: /\b(?:l[- ]?cysteine|e\s?920)\b/, why: 'Can come from hair or feathers, sometimes pork or human hair.' },
  { k: 'doubt', n: 'Shellac / confectioner\'s glaze (E904)', re: /\b(?:shellac|confectioner'?s glaze|e\s?904)\b/, why: 'Insect secretion. Scholars differ.' },
  { k: 'doubt', n: 'Animal fat / tallow', an: 1, re: /\b(?:tallow|animal fats?|animal shortening|suet|beef fat|lard oil|shortening of animal)\b/, why: 'Only halal if from a halal-slaughtered animal.' },
  { k: 'doubt', n: 'Meat or poultry', an: 1, re: /\b(?:beef|chicken|lamb|mutton|turkey|duck|veal|goat|meat|poultry|sausage|salami|pepperoni|meatball|broth|bone|collagen|stock)\b/, why: 'Meat is only halal if the animal was slaughtered the Islamic way. Look for halal certification.', needsLabel: true },
  { k: 'doubt', n: 'Cheese (rennet unknown)', an: 1, re: /\b(?:cheese|parmesan|cheddar|mozzarella|gruyere|pecorino|emmental|gouda|brie)\b/, why: 'Traditional cheese uses animal rennet. Microbial rennet is fine.', soft: true },
  { k: 'doubt', n: 'Mono- and diglycerides / fatty acid emulsifiers', an: 1, re: /\b(?:mono[- ]?(?:and|&)?[- ]?diglycerides?|diglycerides?|monoglycerides?|e\s?47[0-9][a-f]?|e\s?48[1-3]|e\s?570|e\s?572|stearic acid|magnesium stearate|e\s?542|e\s?631|e\s?627|e\s?635)\b/, why: 'These can be made from animal or plant fat. The source is usually not stated.', soft: true },
  { k: 'doubt', n: 'Glycerin / glycerol (E422)', an: 1, re: /\b(?:glycerin|glycerine|glycerol|e\s?422)\b/, why: 'Can be plant or animal derived.', soft: true },
  { k: 'low', n: 'Natural flavors', re: /\b(?:natural flavou?rs?|flavou?rings?|natural flavou?ring)\b/, why: 'Flavors may use an alcohol carrier or animal source. Usually fine.' },
  { k: 'low', n: 'Vanilla extract', re: /\b(?:vanilla extract|vanilla essence)\b/, why: 'Vanilla extract is usually made with alcohol. Many scholars permit the trace amounts; some avoid it.' },
  { k: 'low', n: 'Whey / dairy enzymes', an: 1, re: /\b(?:whey|casein)\b/, why: 'Sometimes made with animal rennet.' },
];
const LABEL = { haram: 'Haram', doubt: 'Doubtful', likely: 'Likely halal', halal: 'Halal', unknown: "Can't tell" };
const NOTE = {
  haram: 'Contains something clearly impermissible. Avoid it.',
  doubt: 'Some ingredients have an unclear source (mushbooh). Check with the maker or look for a halal certificate. When in doubt, leave it.',
  likely: 'Nothing haram found. A few ingredients are usually fine but worth a look.',
  halal: 'No haram or doubtful ingredients found in the list.',
  unknown: 'There is no ingredient list to check.',
};

export function analyze(p) {
  const text = String(p.ingredients || '').toLowerCase().replace(/[_*]/g, '');
  const tags = (p.tags || []).map(t => String(t).replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')).join(', ');
  const hay = (text + ', ' + tags).toLowerCase(), labelled = (p.labels || []).some(l => /halal/.test(l)), vegan = (p.analysis || []).includes('en:vegan'), hits = [];
  if (!text.trim() && !tags.trim()) return { verdict: 'unknown', hits, labelled, vegan, note: NOTE.unknown };
  for (const r of RULES) {
    const m = hay.match(r.re); if (!m) continue;
    if ((r.needsLabel && labelled) || (r.an && vegan)) continue;
    hits.push({ k: r.k, n: r.n, why: r.why, hit: m[0], soft: !!r.soft });
  }
  const has = k => hits.some(h => h.k === k), strong = hits.some(h => h.k === 'doubt' && !h.soft);
  let verdict = has('haram') ? (labelled ? 'doubt' : 'haram') : strong ? 'doubt' : hits.some(h => h.k === 'doubt' && h.soft) ? (labelled ? 'likely' : 'doubt') : hits.length ? 'likely' : 'halal';
  if (labelled && verdict === 'halal') verdict = 'halal';
  let note = NOTE[verdict]; if (labelled && has('haram')) note = 'The label says halal but the ingredients list something haram. Do not trust it without checking.';
  else if (labelled) note += ' The package carries a halal label.';
  return { verdict, hits, labelled, vegan, note };
}

// ---------- lookup ----------
const FIELDS = 'code,product_name,brands,quantity,ingredients_text,ingredients_text_en,ingredients_tags,labels_tags,ingredients_analysis_tags,image_front_small_url';
async function lookup(code) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, { headers: { Accept: 'application/json' } });
  if (!r.ok && r.status !== 404) throw new Error('lookup failed');
  const j = await r.json().catch(() => ({}));
  if (!j || j.status !== 1 || !j.product) return null;
  const p = j.product;
  return { code, name: p.product_name || 'Unnamed product', brand: p.brands || '', qty: p.quantity || '', ingredients: p.ingredients_text_en || p.ingredients_text || '', tags: p.ingredients_tags || [], labels: p.labels_tags || [], analysis: p.ingredients_analysis_tags || [], img: p.image_front_small_url || '' };
}

// ---------- recent scans ----------
const RK = 'iqra_scans';
const recents = () => { try { return JSON.parse(localStorage.getItem(RK)) || []; } catch { return []; } };
const pushRecent = x => { try { const l = [x, ...recents().filter(r => r.code !== x.code)].slice(0, 15); localStorage.setItem(RK, JSON.stringify(l)); } catch { /* storage unavailable */ } };

// ---------- UI ----------
let last = null;
const hl = (text, hits) => { let o = esc(text); hits.forEach(h => { if (h.hit) o = o.replace(new RegExp(esc(h.hit).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark class="${h.k}">${m}</mark>`); }); return o; };
function showResult(p, v) {
  last = { p, v }; const out = $('#hl-out'); if (!out) return;
  out.innerHTML = `<section class="card hl-card"><div class="hl-top">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="hl-ph">${ic('scan', 26)}</span>`}<div><b>${esc(p.name)}</b><small class="muted">${esc([p.brand, p.qty].filter(Boolean).join(' · ') || (p.code ? 'Barcode ' + esc(p.code) : ''))}</small></div></div>
    <div class="vd ${v.verdict}"><b>${LABEL[v.verdict]}</b><span>${esc(v.note)}</span></div>
    ${v.hits.length ? `<h4>What I found</h4><ul class="hl-hits">${v.hits.map(h => `<li class="${h.k}"><b>${esc(h.n)}</b><small>${esc(h.why)}</small></li>`).join('')}</ul>` : ''}
    ${p.ingredients ? `<h4>Ingredients</h4><p class="hl-ing">${hl(p.ingredients, v.hits)}</p>` : ''}
    <div class="row-gap"><button class="btn grow" data-act="hl-ask">${ic('message', 16)} Ask Nur</button><button class="btn primary grow" data-act="hl-scan">${ic('scan', 16)} Scan another</button></div>
    <p class="muted small center">Ingredient data comes from Open Food Facts and can be incomplete, so this can make mistakes. When in doubt, leave it.</p></section>`;
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function check(code) {
  code = String(code || '').replace(/\D/g, ''); const out = $('#hl-out');
  if (code.length < 8 || code.length > 14) { toast('Enter the 8 to 14 digit barcode', 'info'); return; }
  if (out) out.innerHTML = `<section class="card"><div class="working"><div class="spinner"></div><p class="muted">Looking up ${esc(code)}…</p></div></section>`;
  try {
    const p = await lookup(code);
    if (!p) { out.innerHTML = `<section class="card"><h3>Not found</h3><p class="muted">Barcode ${esc(code)} is not in Open Food Facts yet. Paste the ingredients from the package below to check them.</p></section>`; feel('bad'); return; }
    const v = analyze(p); pushRecent({ code, name: p.name, verdict: v.verdict, at: Date.now() }); feel(v.verdict === 'haram' ? 'bad' : v.verdict === 'halal' ? 'right' : 'tap'); haptic('tick'); showResult(p, v); renderRecents();
  } catch { if (out) out.innerHTML = `<section class="card"><h3>Could not look that up</h3><p class="muted">Check your connection and try again, or paste the ingredients below.</p></section>`; }
}
function renderRecents() {
  const box = $('#hl-recent'); if (!box) return; const l = recents();
  box.innerHTML = l.length ? `<h3>Recent scans</h3><div class="card list">${l.map(r => `<button class="lrow" data-act="hl-recent" data-code="${esc(r.code)}"><span class="vdot ${r.verdict}"></span><div class="grow"><b>${esc(r.name)}</b><small class="muted">${LABEL[r.verdict]} · ${esc(r.code)}</small></div>${ic('chevR', 16, 'dim')}</button>`).join('')}</div>` : '';
}

export function viewHalal() {
  return { html: `${back()}<h2>Halal scanner</h2><p class="muted">Scan a product's barcode and I'll read its ingredients for anything haram or doubtful.</p>
    <button class="btn primary big hl-scan" data-act="hl-scan">${ic('scan', 20)} Scan a barcode</button>
    <section class="card"><h3>Type a barcode</h3><div class="row-gap"><input id="hl-code" class="hl-in" inputmode="numeric" autocomplete="off" placeholder="e.g. 3017620422003" maxlength="16"><button class="btn" data-act="hl-check">Check</button></div></section>
    <div id="hl-out"></div>
    <section class="card"><h3>Paste ingredients</h3><textarea id="hl-ing" class="hl-in" rows="3" placeholder="Copy the ingredient list from the package"></textarea><button class="btn" data-act="hl-text">Check ingredients</button></section>
    <div id="hl-recent"></div>`, after: () => { renderRecents(); const i = $('#hl-code'); if (i) i.addEventListener('keydown', e => { if (e.key === 'Enter') check(i.value); }); } };
}

let stopScan = null;
async function openScanner() {
  if (stopScan) return;
  const ov = document.createElement('div'); ov.className = 'scanner'; ov.innerHTML = `<video playsinline muted></video><div class="sc-frame"><i></i></div><p class="sc-hint">Point at the barcode</p><button class="btn sc-x" aria-label="Close">${ic('x', 18)} Close</button>`;
  document.body.append(ov); document.body.classList.add('noscroll'); const video = $('video', ov); let stream = null, alive = true, reader = null;
  const end = () => { alive = false; try { reader && reader.reset(); } catch { /* ignore */ } if (stream) stream.getTracks().forEach(t => t.stop()); ov.remove(); document.body.classList.remove('noscroll'); stopScan = null; };
  stopScan = end; $('.sc-x', ov).onclick = end;
  const found = c => { if (!alive) return; end(); check(c); };
  try {
    if ('BarcodeDetector' in window) {
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } }); video.srcObject = stream; await video.play();
      const loop = async () => { if (!alive) return; try { const r = await det.detect(video); if (r.length) return found(r[0].rawValue); } catch { /* frame not ready */ } setTimeout(loop, 120); }; loop();
    } else { // Safari and others: decode with ZXing, loaded only when needed
      await new Promise((res, rej) => { if (window.ZXing) return res(); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'; s.onload = res; s.onerror = rej; document.head.append(s); });
      reader = new window.ZXing.BrowserMultiFormatReader(); await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video, r => { if (r) found(r.getText()); });
    }
  } catch { end(); toast('Camera unavailable. Type the barcode instead.', 'mic'); }
}

export const HALAL_ACT = {
  'hl-scan': () => openScanner(),
  'hl-check': () => check($('#hl-code')?.value),
  'hl-recent': t => check(t.dataset.code),
  'hl-text': () => { const v = $('#hl-ing')?.value || ''; if (v.trim().length < 3) { toast('Paste the ingredients first', 'info'); return; } const p = { name: 'Pasted ingredients', ingredients: v, tags: [], labels: [], analysis: [], code: '' }; showResult(p, analyze(p)); },
  'hl-ask': () => { if (!last) return; const { p, v } = last; openNur({ ask: `My halal scanner flagged "${p.name}" as ${LABEL[v.verdict]}${v.hits.length ? ' (' + v.hits.map(h => h.n).join(', ') + ')' : ''}. What should I know about these ingredients?`, extra: `Halal scan of ${p.name}. Ingredients: ${String(p.ingredients).slice(0, 600)}` }); },
};

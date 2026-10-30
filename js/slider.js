// Draggable slider: press and drag anywhere on the track, tap to jump, arrow keys to nudge.
// Markup comes from sliderHTML(); listen for the 'slide' event ({value, final}) on the element or document.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sliderHTML = (id, { min, max, step = 1, value, label }) =>
  `<div class="sl" id="${id}" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}" data-min="${min}" data-max="${max}" data-step="${step}" data-v="${value}" style="--p:${(value - min) / (max - min)}"><i class="sl-t"><b class="sl-f"></b></i><span class="sl-h"></span></div>`;
export function setSlider(el, v) {
  const min = +el.dataset.min, max = +el.dataset.max, st = +el.dataset.step || 1;
  v = clamp(Math.round((v - min) / st) * st + min, min, max);
  el.dataset.v = v; el.setAttribute('aria-valuenow', v); el.style.setProperty('--p', (v - min) / (max - min)); return v;
}
function emit(el, v, final) { el.dispatchEvent(new CustomEvent('slide', { bubbles: true, detail: { value: v, final } })); }
export function initSliders() {
  let cur = null;
  const at = (el, e) => { const r = el.getBoundingClientRect(), f = clamp((e.clientX - r.left - 14) / Math.max(1, r.width - 28), 0, 1); return +el.dataset.min + f * (+el.dataset.max - +el.dataset.min); };
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.sl'); if (!el || e.button > 0) return;
    cur = el; try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ } el.classList.add('drag'); el.focus({ preventScroll: true });
    emit(el, setSlider(el, at(el, e)), false); e.preventDefault();
  });
  document.addEventListener('pointermove', e => { if (cur) emit(cur, setSlider(cur, at(cur, e)), false); });
  const end = () => { if (!cur) return; cur.classList.remove('drag'); emit(cur, +cur.dataset.v, true); cur = null; };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  document.addEventListener('keydown', e => {
    const el = e.target.closest && e.target.closest('.sl'); if (!el) return;
    const st = +el.dataset.step || 1, d = { ArrowRight: st, ArrowUp: st, ArrowLeft: -st, ArrowDown: -st, PageUp: st * 5, PageDown: -st * 5 }[e.key];
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); const v = setSlider(el, e.key === 'Home' ? +el.dataset.min : +el.dataset.max); emit(el, v, false); emit(el, v, true); return; }
    if (!d) return; e.preventDefault(); const v = setSlider(el, +el.dataset.v + d); emit(el, v, false); emit(el, v, true);
  });
}

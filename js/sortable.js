// Pointer-based drag to reorder, for chips (axis 'x', wraps and respects RTL) and lists (axis 'y').
// Taps still work as normal clicks: dragging only starts after the pointer has moved a few pixels.
export function flip(kids, change) {
  const first = new Map(kids.map(k => [k, k.getBoundingClientRect()]));
  change();
  kids.forEach(k => {
    const a = first.get(k), b = k.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if ((dx || dy) && k.animate) k.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}

export function makeSortable(box, { items = '.sw', handle = null, axis = 'x', onChange = () => {}, onTick = () => {} } = {}) {
  let d = null, swallow = false;
  const kids = () => [...box.children].filter(c => c.matches(items));
  const down = e => {
    if (e.button > 0 || e.isPrimary === false) return;
    const el = e.target.closest(items); if (!el || !box.contains(el)) return;
    if (handle && !e.target.closest(handle)) return;
    d = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, ph: null };
  };
  const start = () => {
    const el = d.el, r = el.getBoundingClientRect();
    d.on = true; d.ph = document.createElement(el.tagName); d.ph.className = el.className + ' ph'; d.ph.style.cssText = `width:${r.width}px;height:${r.height}px`;
    el.after(d.ph);
    Object.assign(el.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: 200, pointerEvents: 'none', margin: 0 });
    el.classList.add('lifting'); try { box.setPointerCapture(d.id); } catch { /* ignore */ }
    document.body.classList.add('dragging');
  };
  const place = e => {
    const sib = kids().filter(c => c !== d.el && c !== d.ph), br = box.getBoundingClientRect();
    if (e.clientX < br.left - 50 || e.clientX > br.right + 50 || e.clientY < br.top - 50 || e.clientY > br.bottom + 50) return;
    let t = sib.find(c => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
    if (!t && sib.length) { let best = 1e9; sib.forEach(c => { const r = c.getBoundingClientRect(), dd = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)); if (dd < best) { best = dd; t = c; } }); }
    if (!t) return;
    const r = t.getBoundingClientRect(), rtl = getComputedStyle(box).direction === 'rtl';
    const before = axis === 'y' ? (e.clientY - r.top) / r.height < .5 : (rtl ? (e.clientX - r.left) / r.width > .5 : (e.clientX - r.left) / r.width < .5);
    const target = before ? t : t.nextElementSibling;
    if (target === d.ph || (before ? t.previousElementSibling : t.nextElementSibling) === d.ph) return;
    flip([...sib, d.ph], () => before ? t.before(d.ph) : t.after(d.ph)); onTick();
  };
  const move = e => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.on) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 7) return; start(); }
    d.el.style.transform = `translate(${e.clientX - d.x0}px,${e.clientY - d.y0}px) scale(1.04)`;
    if (axis === 'y') { const sc = box.closest('.l-stage') || document.scrollingElement; if (sc) { const r = sc.getBoundingClientRect ? sc.getBoundingClientRect() : { top: 0, bottom: innerHeight }; if (e.clientY < r.top + 70) sc.scrollTop -= 10; else if (e.clientY > r.bottom - 70) sc.scrollTop += 10; } }
    place(e);
  };
  const up = e => {
    if (!d || (e && e.pointerId !== d.id)) return;
    const { el, ph, on } = d; d = null;
    if (!on) return;
    document.body.classList.remove('dragging');
    const r = ph.getBoundingClientRect(), cur = el.getBoundingClientRect();
    ph.replaceWith(el); el.classList.remove('lifting');
    Object.assign(el.style, { position: '', left: '', top: '', width: '', height: '', zIndex: '', pointerEvents: '', margin: '', transform: '' });
    if (el.animate) el.animate([{ transform: `translate(${cur.left - r.left}px,${cur.top - r.top}px) scale(1.04)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    swallow = true; setTimeout(() => { swallow = false; }, 60); onChange();
  };
  box.addEventListener('pointerdown', down); box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  box.addEventListener('click', e => { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
  return { kids, destroy() { box.removeEventListener('pointerdown', down); box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); box.removeEventListener('pointercancel', up); } };
}

// Small shared UI helpers.
import { esc, $ } from './core.js';
import { ic } from './icons.js';
import { TITLES } from './content.js';

export const timers = [];
export const clearTimers = () => { timers.forEach(clearInterval); timers.length = 0; };
export const title = lv => TITLES[Math.min(TITLES.length - 1, Math.floor((lv - 1) / 5))];
export const getErr = e => esc(e && e.message ? e.message : 'Something went wrong');
export const refresh = () => window.dispatchEvent(new Event('iqra-refresh'));
export const val = id => ($('#' + id)?.value || '').trim();
export const back = (to = '#/more', t = 'More') => `<a class="back" href="${to}">${ic('chevL', 18)}<span>${t}</span></a>`;
export function ring(p, size = 96, label = '', sub = '') {
  const r = size / 2 - 8, c = 2 * Math.PI * r;
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="rb"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="rf" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, p))}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><div class="rl"><b>${label}</b><small>${sub}</small></div></div>`;
}
export const lrow = (icon, t, d, href, extra = '') => `<a class="lrow" href="${href}"><span class="ico">${ic(icon, 20)}</span><div class="grow"><b>${t}</b><small class="muted">${d}</small></div>${extra}${ic('chevR', 18, 'dim')}</a>`;

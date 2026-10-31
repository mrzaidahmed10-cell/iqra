// Selectable app icons. The choice updates the browser tab icon, the "Add to Home Screen" icon and the install manifest.
import { S } from './core.js';

const star8 = (c, r, f, extra = '') => `<g transform="translate(${c} ${c})" fill="${f}" ${extra}><rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}"/><rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" transform="rotate(45)"/></g>`;
const wrap = (bg, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs><rect width="64" height="64" fill="${bg}"/>${body}</svg>`;
export const APP_ICONS = [
  { id: 'mihrab', n: 'Mihrab', svg: wrap('#0b1030', '<path d="M16 54V30C16 20 25 14 32 7c7 7 16 13 16 23v24" fill="none" stroke="#e8c36a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="36" r="4" fill="#e8c36a"/>') },
  { id: 'crescent', n: 'Crescent', svg: wrap('#0d3b2e', '<path d="M40 14a19 19 0 1 0 0 36 15 15 0 1 1 0-36z" fill="#f3e6c4"/><path d="m47 22 2 4.6 5 .5-3.8 3.3 1.2 4.9-4.4-2.6-4.4 2.6 1.2-4.9-3.8-3.3 5-.5z" fill="#e8c36a"/>') },
  { id: 'rub', n: 'Rub el Hizb', svg: wrap('#3a1c4d', star8(32, 15, 'none', 'stroke="#f2c9e0" stroke-width="3" stroke-linejoin="round"') + '<circle cx="32" cy="32" r="4" fill="#f2c9e0"/>') },
  { id: 'book', n: 'Open book', svg: wrap('#111318', '<path d="M32 20c-5-3.5-12-4-19-3v30c7-1 14-.5 19 3 5-3.5 12-4 19-3V17c-7-1-14-.5-19 3z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M32 20v30" stroke="#fff" stroke-width="3"/><path d="M18 24c4 0 8 .5 10 2M18 31c4 0 8 .5 10 2M46 24c-4 0-8 .5-10 2M46 31c-4 0-8 .5-10 2" stroke="#e8c36a" stroke-width="2" stroke-linecap="round"/>') },
  { id: 'alif', n: 'Alif', svg: wrap('#f4ecd8', '<circle cx="32" cy="32" r="22" fill="none" stroke="#b5852e" stroke-width="2"/><rect x="29" y="14" width="6" height="36" rx="3" fill="#0b1030"/><path d="M32 8l2 3-2 3-2-3z" fill="#b5852e"/><path d="M32 56l2-3-2-3-2 3z" fill="#b5852e"/>') },
  { id: 'dome', n: 'Dome', svg: wrap('url(#g)', '<path d="M12 50V36c0-8 8-12 14-15 3-1.5 4-4 6-9 2 5 3 7.500 6 9 6 3 14 7 14 15v14z" fill="#fff4d6"/><rect x="8" y="50" width="48" height="4" fill="#fff4d6"/><path d="M26 50v-8a6 6 0 0 1 12 0v8" fill="#e46a3c"/><circle cx="48" cy="14" r="4" fill="#ffd27a"/>', '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1a5e"/><stop offset="1" stop-color="#e46a3c"/></linearGradient>') },
  { id: 'lattice', n: 'Lattice', svg: wrap('#0f4c5c', star8(32, 18, 'none', 'stroke="#9fe0d0" stroke-width="2.5"') + star8(32, 9, '#9fe0d0') + '<g fill="#9fe0d0"><circle cx="8" cy="8" r="3"/><circle cx="56" cy="8" r="3"/><circle cx="8" cy="56" r="3"/><circle cx="56" cy="56" r="3"/></g>') },
  { id: 'nur', n: 'Nur', svg: wrap('#14213d', '<circle cx="32" cy="32" r="10" fill="#ffd166"/><g stroke="#ffd166" stroke-width="3" stroke-linecap="round">' + [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M32 12v6" transform="rotate(${a} 32 32)"/>`).join('') + '</g>') },
];
export const iconById = id => APP_ICONS.find(i => i.id === id) || APP_ICONS[0];
const uri = s => 'data:image/svg+xml,' + encodeURIComponent(s);
const png = (svg, size) => new Promise(res => { const img = new Image(); img.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = size; c.getContext('2d').drawImage(img, 0, 0, size, size); res(c.toDataURL('image/png')); } catch { res(null); } }; img.onerror = () => res(null); img.src = uri(svg); });
let mUrl = '';
export async function applyAppIcon() {
  const ic = iconById(S.settings.appIcon), set = (rel, href, extra) => { let l = document.querySelector(`link[rel="${rel}"]`); if (!l) { l = document.createElement('link'); l.rel = rel; document.head.appendChild(l); } l.href = href; if (extra) l.type = extra; };
  set('icon', S.settings.appIcon && ic.id !== 'mihrab' ? uri(ic.svg) : 'icon.svg', 'image/svg+xml');
  if (!S.settings.appIcon || ic.id === 'mihrab') { set('apple-touch-icon', 'icon.svg'); return; }
  try {
    const [p180, p192, p512] = await Promise.all([png(ic.svg, 180), png(ic.svg, 192), png(ic.svg, 512)]);
    if (p180) set('apple-touch-icon', p180);
    if (p192 && p512) { const bg = ic.svg.match(/<rect width="64" height="64" fill="(#[0-9a-f]+)/i); const m = { name: 'Iqra | Learn the Quran', short_name: 'Iqra', start_url: location.origin + '/', scope: location.origin + '/', display: 'standalone', background_color: bg ? bg[1] : '#0b0f24', theme_color: bg ? bg[1] : '#0b0f24', icons: [{ src: p192, sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: p512, sizes: '512x512', type: 'image/png', purpose: 'any' }] };
      if (mUrl) URL.revokeObjectURL(mUrl); mUrl = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' })); set('manifest', mUrl); }
  } catch { /* the tab icon already changed */ }
}

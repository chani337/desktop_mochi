const { pathToFileURL } = require('node:url');
const COLORS = ['blue', 'red', 'green', 'orange', 'purple', 'pink'];
const ICONS = ['web', 'play', 'table', 'folder', 'star', 'check', 'music'];
function normalizeURL(raw) {
  if (typeof raw !== 'string' || raw.length > 8192) throw new Error('주소를 확인해 주세요.');
  raw = raw.trim();
  if (/^[a-z]:[\\/]/i.test(raw)) raw = 'file:///' + raw.replaceAll('\\', '/').split('/').map((part,i)=>i===0?part:encodeURIComponent(part)).join('/');
  else if (raw.startsWith('/')) raw = pathToFileURL(raw).href;
  else if (!/^[a-z][a-z\d+.-]*:/i.test(raw)) raw = 'https://' + raw;
  let url; try { url = new URL(raw); } catch { throw new Error('올바른 주소를 입력해 주세요.'); }
  const allowed = ['http:', 'https:', 'file:', 'mailto:', 'shortcuts:', 'notion:', 'obsidian:', 'slack:', 'vscode:', 'spotify:', 'ms-settings:'];
  if (!allowed.includes(url.protocol)) throw new Error('지원하지 않는 주소 형식이에요.');
  if (['https:', 'http:'].includes(url.protocol) && !url.hostname) throw new Error('웹 주소를 확인해 주세요.');
  return url.href;
}
const MAX_SHORTCUTS = 10;
const SHORTCUTS_PER_PAGE = 5;
function validateShortcuts(rows) {
  if (!Array.isArray(rows) || rows.length > MAX_SHORTCUTS) throw new Error('바로가기는 최대 10개예요.');
  return rows.filter(r => r && (r.title?.trim() || r.name?.trim() || r.url?.trim() || r.target?.trim())).map((r, i) => {
    const rawUrl = r.url || r.target;
    const url = normalizeURL(rawUrl);
    const title = String(r.title?.trim() || r.name?.trim() || new URL(url).hostname || '바로가기').slice(0, 24);
    return {
      title,
      url,
      type: r.type || 'url',
      target: r.target || url,
      icon: ICONS.includes(r.icon) ? r.icon : inferIcon(url),
      color: COLORS.includes(r.color) ? r.color : COLORS[i % COLORS.length]
    };
  });
}
function inferIcon(url, title = '') {
  const text = (url + ' ' + title).toLowerCase();
  if (/youtu|video|media|player|동영상|재생/.test(text)) return 'play';
  if (/spreadsheets|calc|excel|code|dev|terminal|cmd|git|시트|계산기|엑셀|개발/.test(text)) return 'table';
  if (/music|spotify|audio|sound|음악|멜론/.test(text)) return 'music';
  if (/check|task|todo|note|memo|체크|메모|할일/.test(text)) return 'check';
  if (/folder|file|explorer|finder|폴더|파일|탐색기/.test(text)) return 'folder';
  if (/star|fav|bookmark|즐겨찾기|별/.test(text)) return 'star';
  return 'web';
}
function durationSeconds(hours, minutes) {
  const h = Number(hours), m = Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59 || h*60+m < 1) throw new Error('1분부터 23시간 59분까지 입력해 주세요.');
  return (h*60+m)*60;
}
function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds)), pad = n => String(n).padStart(2,'0');
  return s >= 3600 ? `${Math.floor(s/3600)}:${pad(Math.floor(s/60)%60)}:${pad(s%60)}` : `${pad(Math.floor(s/60))}:${pad(s%60)}`;
}
function palettePoints(count) {
  return Array.from({length: count}, (_, i) => { const a = (count===1 ? 90 : 160-i*140/(count-1))*Math.PI/180; return {x:170+118*Math.cos(a),y:177-118*Math.sin(a)}; });
}
function selectedShortcut(point, count) { return palettePoints(count).findIndex(p => Math.hypot(p.x-point.x,p.y-point.y)<=34); }
function petSize(value) {
  if (!Number.isInteger(value) || value < 100 || value > 250 || value % 25 !== 0) throw new Error('크기는 100%부터 250%까지 25% 단위로 설정해 주세요.');
  return {width:Math.round(80*value/100),height:Math.round(86*value/100)};
}
function resizedPetBounds(bounds, area, scale) {
  const size=petSize(scale);
  return {...size,x:Math.round(Math.max(area.x,Math.min(bounds.x+(bounds.width-size.width)/2,area.x+area.width-size.width))),y:Math.round(Math.max(area.y,Math.min(bounds.y+bounds.height-size.height,area.y+area.height-size.height)))};
}
function getShortcutPage(shortcuts, page = 0) {
  if (!Array.isArray(shortcuts)) return [];
  const start = Math.max(0, page) * SHORTCUTS_PER_PAGE;
  return shortcuts.slice(start, start + SHORTCUTS_PER_PAGE);
}
module.exports = { MAX_SHORTCUTS, SHORTCUTS_PER_PAGE, getShortcutPage, petSize, resizedPetBounds, COLORS, ICONS, normalizeURL, validateShortcuts, inferIcon, durationSeconds, formatTime, palettePoints, selectedShortcut };

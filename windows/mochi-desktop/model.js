const { pathToFileURL } = require('node:url');
const COLORS = ['blue', 'red', 'green', 'orange', 'purple', 'pink'];
const ICONS = ['web', 'play', 'table', 'folder', 'star', 'check', 'music'];
function normalizeURL(raw) {
  if (typeof raw !== 'string' || raw.length > 8192) throw new Error('주소를 확인해 주세요.');
  raw = raw.trim();
  if (/^[a-z]:[\\/]/i.test(raw)) raw = 'file:///' + raw.replaceAll('\\', '/');
  else if (raw.startsWith('/')) raw = pathToFileURL(raw).href;
  else if (!/^[a-z][a-z\d+.-]*:/i.test(raw)) raw = 'https://' + raw;
  let url; try { url = new URL(raw); } catch { throw new Error('올바른 주소를 입력해 주세요.'); }
  const allowed = ['http:', 'https:', 'file:', 'mailto:', 'shortcuts:', 'notion:', 'obsidian:', 'slack:', 'vscode:', 'spotify:', 'ms-settings:'];
  if (!allowed.includes(url.protocol)) throw new Error('지원하지 않는 주소 형식이에요.');
  if (['https:', 'http:'].includes(url.protocol) && !url.hostname) throw new Error('웹 주소를 확인해 주세요.');
  return url.href;
}
function validateShortcuts(rows) {
  if (!Array.isArray(rows) || rows.length > 5) throw new Error('바로가기는 최대 5개예요.');
  return rows.filter(r => r && (r.title?.trim() || r.url?.trim())).map((r, i) => {
    const url = normalizeURL(r.url);
    return { title: String(r.title?.trim() || new URL(url).hostname || '바로가기').slice(0, 24), url,
      icon: ICONS.includes(r.icon) ? r.icon : inferIcon(url), color: COLORS.includes(r.color) ? r.color : COLORS[i] };
  });
}
function inferIcon(url) { return /youtu/.test(url) ? 'play' : /spreadsheets/.test(url) ? 'table' : url.startsWith('file:') ? 'folder' : 'web'; }
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
module.exports = { COLORS, ICONS, normalizeURL, validateShortcuts, inferIcon, durationSeconds, formatTime, palettePoints, selectedShortcut };

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function backupSettings(file) {
  if (!fs.existsSync(file)) return null;
  const data = fs.readFileSync(file);
  const directory = path.join(path.dirname(file), 'backups');
  fs.mkdirSync(directory, { recursive: true });
  const digest = crypto.createHash('sha256').update(data).digest('hex');
  const files = fs.readdirSync(directory).filter(n => /^settings-.*\.json$/.test(n)).sort();
  if (files.length && fs.readFileSync(path.join(directory, files.at(-1))).equals(data)) return path.join(directory, files.at(-1));
  const stamp = Math.max(Date.now(), Number(files.at(-1)?.split('-')[1] || 0) + 1);
  const target = path.join(directory, `settings-${stamp}-${digest.slice(0, 12)}.json`);
  fs.writeFileSync(target, data, { flag: 'wx', mode: 0o600 });
  for (const old of files.slice(0, Math.max(0, files.length - 19))) fs.unlinkSync(path.join(directory, old));
  return target;
}
module.exports = { backupSettings };

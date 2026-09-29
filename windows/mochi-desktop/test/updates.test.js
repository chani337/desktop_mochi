const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { backupSettings } = require('../backups');
const { setupUpdates } = require('../updates');

test('settings backups preserve prior bytes, deduplicate and keep the latest 20', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mochi-backup-test-'));
  try {
    const file = path.join(dir, 'settings.json');
    assert.equal(backupSettings(file), null);
    fs.writeFileSync(file, '{"shortcuts":[{"title":"내 링크"}]}');
    const first = backupSettings(file);
    assert.equal(backupSettings(file), first);
    assert.equal(fs.readFileSync(first, 'utf8'), fs.readFileSync(file, 'utf8'));
    // Different timestamps establish retention order without wall-clock sleeps.
    const now = Date.now; let tick = now();
    try {
      Date.now = () => ++tick;
      for (let i = 0; i < 25; i++) { fs.writeFileSync(file, JSON.stringify({ i })); backupSettings(file); }
    } finally { Date.now = now; }
    assert.equal(fs.readdirSync(path.join(dir, 'backups')).length, 20);
    assert.ok(fs.readdirSync(path.join(dir, 'backups')).some(n => JSON.parse(fs.readFileSync(path.join(dir, 'backups', n))).i === 24));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

function fixture({ installed = true, backupFails = false, response = 0 } = {}) {
  const updater = new EventEmitter(), events = [], messages = [], schedules = [];
  updater.checkForUpdates = async () => { events.push('check'); updater.emit('update-not-available'); };
  updater.quitAndInstall = () => events.push('install');
  const dialog = { showMessageBox: async options => { messages.push(options); return { response }; } };
  const setup = setupUpdates({ updater, dialog, installed, version: '2.3.0', backup: () => { events.push('backup'); if (backupFails) throw Error('disk full'); }, schedule: callback => { schedules.push(callback); return {}; }, repeat: callback => { schedules.push(callback); return {}; } });
  return { updater, events, messages, schedules, ...setup };
}
test('installed updater checks automatically and manual checks report no update', async () => {
  const f = fixture(); assert.equal(f.schedules.length, 2);
  await f.check(true); assert.deepEqual(f.events, ['check']); assert.match(f.messages[0].message, /최신/);
  assert.equal(f.updater.allowDowngrade, false);
});
test('downloaded update backs up before install; cancel and backup failure cannot install', async () => {
  for (const options of [{}, { response: 1 }, { backupFails: true }]) {
    const f = fixture(options); f.updater.emit('update-downloaded');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.events, options.response === 1 ? [] : options.backupFails ? ['backup'] : ['backup', 'install']);
  }
});
test('portable copies never auto-install and failed checks can be retried', async () => {
  const portable = fixture({ installed: false }); await portable.check(true);
  assert.deepEqual(portable.events, []); assert.equal(portable.schedules.length, 0);
  const f = fixture(); f.updater.checkForUpdates = async () => { throw Error('offline'); };
  await f.check(true); assert.match(f.messages[0].message, /확인하지/);
  f.updater.checkForUpdates = async () => f.events.push('retried');
  await f.check(true); assert.deepEqual(f.events, ['retried']);
});

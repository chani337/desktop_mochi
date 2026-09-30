const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');

// electron-updater has already verified this downloaded installer's release hash.
// A separate Windows process waits for Mochi's exit before it launches NSIS.
async function handoffUpdate({ installer, directory, executable = process.execPath, pid = process.pid,
  launch = spawn, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 100 }) {
  if (typeof installer !== 'string' || path.extname(installer).toLowerCase() !== '.exe' || !fs.statSync(installer).isFile()) throw Error('다운로드한 설치 파일을 찾을 수 없어요.');
  fs.mkdirSync(directory, { recursive: true });
  const ready = path.join(directory, `update-ready-${randomUUID()}`);
  const log = path.join(directory, 'update-install.log');
  const script = fs.readFileSync(path.join(__dirname, 'install-update.ps1'), 'utf8');
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  let failure;
  const helper = launch(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    detached: true, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, MOCHI_UPDATE_INSTALLER: installer, MOCHI_UPDATE_PID: String(pid), MOCHI_UPDATE_READY: ready, MOCHI_UPDATE_LOG: log, MOCHI_UPDATE_APP: executable }
  });
  helper.on('error', error => { failure = error; });
  helper.on('exit', code => { if (code !== 0) failure = Error('업데이트 도우미를 실행하지 못했어요.'); });
  helper.unref();
  for (let i = 0; i < attempts; i++) {
    if (failure) throw failure;
    if (fs.existsSync(ready)) return;
    await wait(50);
  }
  // The helper can only install after the parent exits. If it never signalled
  // readiness, stop this owned helper and keep Mochi running for a retry.
  helper.kill();
  throw Error('업데이트 도우미가 준비되지 않았어요. 모찌는 종료하지 않았어요.');
}
module.exports = { handoffUpdate };

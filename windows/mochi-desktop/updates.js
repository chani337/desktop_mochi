// The updater is injected so tests never replace or quit a real installation.
function setupUpdates({ updater, dialog, backup, installed, version, schedule = setTimeout, repeat = setInterval }) {
  let manual = false, busy = false, ready = false;
  const message = (text, detail = '') => dialog.showMessageBox({ type: 'info', title: '모찌 업데이트', message: text, detail });
  async function install() {
    const result = await dialog.showMessageBox({ type: 'info', title: '모찌 업데이트', message: '새 버전 다운로드가 완료됐어요.', detail: '설정을 백업한 뒤 모찌를 종료하고 업데이트합니다.', buttons: ['지금 업데이트', '나중에'], defaultId: 0, cancelId: 1 });
    if (result.response !== 0) return;
    try { backup(); updater.quitAndInstall(false, true); }
    catch { await message('설정 백업에 실패해 업데이트를 중단했어요.', '저장 공간과 폴더 권한을 확인한 뒤 다시 시도해 주세요.'); }
  }
  if (installed) {
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = false; // Back up successfully before replacing the app.
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.on('update-not-available', () => { busy = false; if (manual) void message(`최신 버전이에요. (${version})`); manual = false; });
    updater.on('update-downloaded', () => { busy = false; ready = true; manual = false; void install(); });
    updater.on('error', () => { busy = false; if (manual) void message('업데이트를 확인하거나 다운로드하지 못했어요.', '인터넷 연결을 확인하고 다시 시도해 주세요.'); manual = false; });
  }
  async function check(userInitiated = false) {
    if (!installed) { if (userInitiated) await message('설치형 모찌에서 자동 업데이트를 사용할 수 있어요.', 'GitHub Releases의 Mochi-Setup 설치 파일을 한 번 실행해 주세요. 기존 링크는 유지됩니다.'); return; }
    if (ready) { if (userInitiated) await install(); return; }
    if (busy) { if (userInitiated) await message('업데이트를 확인하거나 다운로드하는 중이에요.'); return; }
    busy = true; manual = userInitiated;
    try { await updater.checkForUpdates(); }
    catch { busy = false; manual = false; if (userInitiated) await message('업데이트를 확인하지 못했어요.', '잠시 후 다시 시도해 주세요.'); }
  }
  if (installed) { schedule(() => void check(), 15000).unref?.(); repeat(() => void check(), 6 * 60 * 60 * 1000).unref?.(); }
  return { check };
}
module.exports = { setupUpdates };

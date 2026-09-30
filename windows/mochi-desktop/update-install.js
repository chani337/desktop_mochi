// Use electron-updater's verified installer and quit signal, with explicit
// teardown so close-to-tray/beforeunload cannot retain Mochi during replacement.
function installUpdate({updater, lifecycle, prepare, recover, exit, log=()=>{}, schedule=setTimeout, cancel=clearTimeout}) {
  return new Promise((resolve,reject)=>{
    let finished=false, timeout;
    const cleanup=()=>{cancel(timeout);updater.removeListener('error',failed);lifecycle.removeListener('before-quit-for-update',quit);};
    const failed=error=>{if(finished)return;finished=true;cleanup();log('Install failed: '+error.message);recover();reject(error);};
    const quit=()=>{if(finished)return;finished=true;cleanup();log('Updater requested exit; closing Mochi.');resolve();exit(0);};
    updater.once('error',failed);lifecycle.once('before-quit-for-update',quit);
    timeout=schedule(()=>failed(Error('설치 프로그램의 종료 요청을 받지 못했어요. 다시 시도해 주세요.')),15000);
    try {
      log('Preparing windows for installation.');prepare();
      updater.autoRunAppAfterInstall=true;
      updater.quitAndInstall(true,true);
    } catch(error){failed(error);}
  });
}
module.exports={installUpdate};

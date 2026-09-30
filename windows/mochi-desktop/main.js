const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, shell, Notification, dialog } = require('electron');
const fs = require('node:fs');
const { backupSettings } = require('./backups');
const { setupUpdates } = require('./updates');
const { handoffUpdate } = require('./update-handoff');
let updates, animationTimer;
const Motions = require('./motions');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { MAX_SHORTCUTS, SHORTCUTS_PER_PAGE, COLORS, petSize, resizedPetBounds, validateShortcuts, normalizeURL, inferIcon, durationSeconds, formatTime, selectedShortcut } = require('./model');
let pet, palette, prefs, tray, file, state, dragging, holding = false, highlighted = -1;
let lastTouch = Date.now(), celebrateUntil = 0, waveUntil = 0, landUntil = 0, direction = 1, ticks = 0, pauseUntil = 0, quitting = false;
const defaults = { shortcuts: [{title:'검색',url:'https://www.google.com/',icon:'web',color:'blue'}, {title:'YouTube',url:'https://www.youtube.com/',icon:'play',color:'red'}], walking:false, scale:150, duration:25, end:null };
const smoke = process.argv.includes('--smoke-test');
// Keep the portable and installed editions on the existing settings directory.
app.setPath('userData',path.join(app.getPath('appData'),'mochi-desktop'));
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'mochi-smoke-profile'));
if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on('second-instance', () => { pet?.showInactive(); showSettings('timer'); });
  app.whenReady().then(start).catch(error=>{console.error(error);app.exit(1);});
}
function save() { backupSettings(file); fs.mkdirSync(path.dirname(file),{recursive:true}); const tmp=file+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(state,null,2)); fs.renameSync(tmp,file); }
function load() {
  file=path.join(app.getPath('userData'),'settings.json');
  try { const s=JSON.parse(fs.readFileSync(file,'utf8')); state={...defaults,...s,shortcuts:validateShortcuts(s.shortcuts)}; }
  catch { state=structuredClone(defaults); }
  // Walking is opt-in each session, including upgrades with walking:true saved.
  state.walking=false;
  state.motions=Motions.validate(state.motions);
  try {petSize(state.scale);} catch {state.scale=150;}
  if (!Number.isFinite(state.duration)||state.duration<1||state.duration>1439) state.duration=25;
  if (!Number.isFinite(state.end) || state.end<=Date.now()) state.end=null;
}
function publicState() {
  const now=Date.now(), remain=state.end ? Math.max(0,Math.ceil((state.end-now)/1000)) : 0;
  return {...state, remaining:formatTime(remain), facing:direction, pose: dragging ? 'dragging' : now<celebrateUntil ? 'celebrating' : now<landUntil ? 'landing' : now<waveUntil ? 'waving' : state.end ? 'focusing' : now-lastTouch>600000 ? 'sleeping' : state.walking && !palette?.isVisible() && now>pauseUntil ?'walking':palette?.isVisible()?'waving':'idle', highlighted, palette:!!palette?.isVisible()};
}
function send() { const data=publicState(); for (const w of [pet,palette,prefs]) if(w&&!w.isDestroyed()) w.webContents.send('mochi:update',data); }
function touch() {lastTouch=Date.now();pauseUntil=Date.now()+1500;}
function createWindow(kind,width,height) {
  const transparent=kind!=='settings';
  const w=new BrowserWindow({parent:kind==='palette'?pet:undefined,width,height,show:false,frame:!transparent,transparent,hasShadow:!transparent,backgroundColor:transparent?'#00000000':'#faf8f4',resizable:false,maximizable:false,skipTaskbar:transparent,alwaysOnTop:transparent,title:'Mochi · 모찌',webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
  if(transparent) {w.setAlwaysOnTop(true,'floating');w.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});}
  w.setMenuBarVisibility(false);
  w.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  w.webContents.on('will-navigate',event=>event.preventDefault());
  w.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  w.loadFile('index.html',{query:{view:kind}});
  w.webContents.on('did-finish-load',send);
  return w;
}
function home() { const r=screen.getPrimaryDisplay().workArea,p=pet.getBounds(); pet.setPosition(Math.max(r.x,r.x+r.width-p.width-120),Math.max(r.y,r.y+r.height-p.height-19)); }
function showMenu(open=true) {
  touch(); if(!open){palette?.hide();highlighted=-1;send();return;}
  const p=pet.getBounds(), r=screen.getDisplayMatching(p).workArea;
  const x=Math.max(r.x,Math.min(p.x+p.width/2-170,r.x+r.width-340));
  const wanted=p.y-206, y=wanted<r.y ? p.y+p.height-12 : wanted;
  palette.setPosition(Math.round(x),Math.round(Math.max(r.y,Math.min(y,r.y+r.height-220))));
  palette.setIgnoreMouseEvents(false);
  palette.setAlwaysOnTop(true,'pop-up-menu');
  // Keep pointer capture during the hold gesture; normal clicks activate the palette.
  if(holding) palette.showInactive(); else palette.show();
  palette.moveTop();send();
}
function showSettings(tab='links') {
  showMenu(false); touch();
  if (!prefs||prefs.isDestroyed()) {prefs=createWindow('settings',820,580);prefs.on('close',e=>{if(!quitting){e.preventDefault();prefs.hide();}});prefs.once('ready-to-show',()=>{prefs.show();prefs.webContents.send('mochi:update',{tab,...publicState()});});}
  else {prefs.show();prefs.focus();prefs.webContents.send('mochi:update',{tab,...publicState()});}
}
async function openShortcut(index) {
  if(!Number.isInteger(index)||!state.shortcuts[index])return;
  const url=normalizeURL(state.shortcuts[index].url);
  try {
    if(url.startsWith('file:')){const error=await shell.openPath(fileURLToPath(url));if(error)throw new Error(error);}
    else await shell.openExternal(url);
    touch();waveUntil=Date.now()+2000;showMenu(false);
  } catch {dialog.showErrorBox('바로가기를 열 수 없어요','주소나 연결된 앱을 확인해 주세요.');}
}
function authorize(event) { return [pet,palette,prefs].some(w=>w&&!w.isDestroyed()&&event.sender===w.webContents&&event.senderFrame===w.webContents.mainFrame); }
function handle(name,fn) {ipcMain.handle('mochi:'+name,async(event,arg)=>{if(!authorize(event))throw new Error('Invalid sender');try{return {ok:true,data:await fn(arg,event)}}catch(error){return {ok:false,error:error.message}}});}
function setupIPC() {
  handle('state',()=>publicState());
  handle('motions',value=>{state.motions=Motions.validate(value);save();send();return state.motions;});
  handle('size',value=>{petSize(value);const p=pet.getBounds(),r=screen.getDisplayMatching(p).workArea;state.scale=value;pet.setBounds(resizedPetBounds(p,r,value));if(palette.isVisible())showMenu(true);save();send();});
  handle('save',rows=>{state.shortcuts=validateShortcuts(rows);save();send();});
  handle('open',index=>openShortcut(index));
  handle('menu',open=>showMenu(open));
  handle('settings',tab=>showSettings(tab==='timer'?'timer':'links'));
  handle('timer-start',value=>{const seconds=durationSeconds(value?.hours,value?.minutes);state.duration=seconds/60;state.end=Date.now()+seconds*1000;touch();save();send();});
  handle('timer-stop',()=>{state.end=null;touch();save();send();});
  handle('walk',()=>{state.walking=!state.walking;touch();save();send();updateTray();});
  handle('drag-start',()=>{touch();showMenu(false);dragging={point:screen.getCursorScreenPoint(),bounds:pet.getBounds()};send();});
  handle('drag-end',()=>{dragging=null;landUntil=Date.now()+450;touch();send();});
  handle('hold',()=>{holding=true;showMenu(true);});
  handle('release',async()=>{if(holding){holding=false;const c=screen.getCursorScreenPoint(),r=palette.getBounds();const i=selectedShortcut({x:c.x-r.x,y:c.y-r.y},state.shortcuts.length);if(i>=0)await openShortcut(i);highlighted=-1;send();}});
  handle('drop',raw=>{if(state.shortcuts.length>=MAX_SHORTCUTS)throw new Error('바로가기는 최대 10개까지 등록할 수 있어요.');const url=normalizeURL(raw),u=new URL(url);state.shortcuts.push({title:(u.hostname||path.basename(u.pathname)||'바로가기').replace(/^www\./,'').slice(0,24),url,type:'url',target:url,icon:inferIcon(url),color:COLORS[state.shortcuts.length % COLORS.length]});save();touch();waveUntil=Date.now()+1600;send();});
  handle('get-installed-apps',()=>getInstalledApps());
  handle('pick-file',async()=>{
    const {canceled,filePaths}=await dialog.showOpenDialog(prefs||pet,{title:'바로가기로 추가할 파일이나 프로그램 선택',properties:['openFile']});
    if(canceled||!filePaths||!filePaths.length)return null;
    const p=filePaths[0],name=path.basename(p).replace(/\.(exe|app|lnk)$/i,'');
    return {name,target:p,icon:inferIcon(p,name)};
  });
  handle('ignore',(ignore,event)=>{const w=BrowserWindow.fromWebContents(event.sender);if(w===pet||w===palette)w.setIgnoreMouseEvents(!!ignore,{forward:true});});
  handle('quit',()=>app.quit());
}
function scanLnkFiles(dir, addApp, depth = 0) {
  if (depth > 3) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) scanLnkFiles(fullPath, addApp, depth + 1);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lnk')) {
        const base = entry.name.slice(0, -4);
        if (/uninstall|readme|help|도움말|제거/i.test(base)) continue;
        addApp(base, fullPath);
      }
    }
  } catch {}
}
function getInstalledApps() {
  const apps = [], seen = new Set();
  function addApp(name, target, icon) {
    if (!name || !target || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    apps.push({ name, target, icon: icon || inferIcon(target, name) });
  }
  if (process.platform === 'win32') {
    const startMenuPaths = [
      path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'),
      path.join(process.env.APPDATA || '', 'Microsoft\\Windows\\Start Menu\\Programs')
    ];
    for (const dir of startMenuPaths) { if (fs.existsSync(dir)) scanLnkFiles(dir, addApp); }
    const windir = process.env.WINDIR || 'C:\\Windows';
    const systemApps = [
      { name: '메모장', target: path.join(windir, 'notepad.exe'), icon: 'check' },
      { name: '계산기', target: path.join(windir, 'system32', 'calc.exe'), icon: 'table' },
      { name: '그림판', target: path.join(windir, 'system32', 'mspaint.exe'), icon: 'star' },
      { name: '파일 탐색기', target: path.join(windir, 'explorer.exe'), icon: 'folder' },
      { name: '명령 프롬프트', target: path.join(windir, 'system32', 'cmd.exe'), icon: 'table' }
    ];
    for (const sa of systemApps) { if (fs.existsSync(sa.target)) addApp(sa.name, sa.target, sa.icon); }
  } else {
    const macAppDirs = ['/Applications', '/System/Applications', path.join(require('node:os').homedir(), 'Applications')];
    for (const dir of macAppDirs) {
      if (fs.existsSync(dir)) {
        try {
          for (const f of fs.readdirSync(dir)) {
            if (f.endsWith('.app')) addApp(f.replace(/\.app$/, ''), path.join(dir, f));
          }
        } catch {}
      }
    }
  }
  return apps.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
}
async function restoreSettings() {
  const {canceled,filePaths}=await dialog.showOpenDialog({title:'모찌 설정 백업 선택',defaultPath:path.join(app.getPath('userData'),'backups'),filters:[{name:'모찌 설정',extensions:['json']}],properties:['openFile']});
  if(canceled||!filePaths.length)return;
  try {
    const data=JSON.parse(fs.readFileSync(filePaths[0],'utf8'));
    const restored={...defaults,motions:Motions.validate(data.motions),shortcuts:validateShortcuts(data.shortcuts),scale:data.scale??defaults.scale,duration:data.duration??defaults.duration,end:null,walking:false};
    petSize(restored.scale);
    if(!Number.isInteger(restored.duration)||restored.duration<1||restored.duration>1439)throw new Error('Invalid duration');
    const result=await dialog.showMessageBox({type:'question',message:'선택한 백업으로 설정을 복원할까요?',detail:'현재 설정은 먼저 백업합니다.',buttons:['복원','취소'],cancelId:1,defaultId:1});
    if(result.response!==0)return;
    backupSettings(file);
    state=restored;save();
    showMenu(false);const p=pet.getBounds();pet.setBounds(resizedPetBounds(p,screen.getDisplayMatching(p).workArea,state.scale));
    if(prefs&&!prefs.isDestroyed()){prefs.destroy();prefs=null;}
    send();updateTray();showSettings('links');
  } catch {dialog.showErrorBox('설정을 복원하지 못했어요','백업 파일, 저장 공간과 폴더 권한을 확인해 주세요.');}
}
function updateTray() {
  if(!tray)return;
  tray.setContextMenu(Menu.buildFromTemplate([{label:'모찌 데려오기',click:()=>{home();pet.showInactive();touch();}},{label:'집중 타이머…',click:()=>showSettings('timer')},{label:'바로가기 설정…',click:()=>showSettings('links')},{label:state.walking?'산책 멈춤':'산책 시작',click:()=>{state.walking=!state.walking;touch();save();send();updateTray();}},{type:'separator'},{label:'업데이트 확인…',click:()=>updates.check(true)},{label:'설정 백업 폴더 열기',click:async()=>{const dir=path.join(app.getPath('userData'),'backups');fs.mkdirSync(dir,{recursive:true});await shell.openPath(dir);}},{label:'설정 복원…',click:()=>restoreSettings()},{type:'separator'},{label:'종료',click:()=>app.quit()}]));
}
function tick() {
  if(!pet||pet.isDestroyed())return;
  const now=Date.now();
  if(state.end && now>=state.end){state.end=null;touch();celebrateUntil=now+4000;save();pet.webContents.send('mochi:update',{complete:true,...publicState()});if(Notification.isSupported())new Notification({title:'모찌 · 집중 완료',body:'수고했어요! 잠깐 기지개를 켜요.'}).show();}
  if(dragging){const c=screen.getCursorScreenPoint(),r=screen.getDisplayNearestPoint(c).workArea;
    const x=Math.round(Math.max(r.x,Math.min(dragging.bounds.x+c.x-dragging.point.x,r.x+r.width-dragging.bounds.width))),previous=pet.getBounds().x;
    if(x!==previous)direction=x<previous?-1:1;
    pet.setPosition(x,Math.round(Math.max(r.y,Math.min(dragging.bounds.y+c.y-dragging.point.y,r.y+r.height-dragging.bounds.height))));}
  else if(holding){const c=screen.getCursorScreenPoint(),r=palette.getBounds();highlighted=selectedShortcut({x:c.x-r.x,y:c.y-r.y},state.shortcuts.length);}
  else if(publicState().pose==='walking') {const p=pet.getBounds(),r=screen.getDisplayMatching(p).workArea;let x=p.x+direction;if(x<r.x||x+p.width>r.x+r.width){direction*=-1;x=Math.max(r.x,Math.min(x,r.x+r.width-p.width));}pet.setPosition(x,Math.max(r.y,Math.min(p.y,r.y+r.height-p.height)));}
  if(++ticks%5===0){send();tray?.setToolTip(state.end?'모찌 · '+publicState().remaining:'모찌 · 바로가기와 집중 타이머');if(process.platform==='darwin')tray?.setTitle(state.end?publicState().remaining:'');}
}
async function start() {
  load();
  try {backupSettings(file);} catch(error) {console.error('Settings backup:',error.message);}
  const installed=!smoke && process.platform==='win32' && app.isPackaged && fs.existsSync(path.join(path.dirname(process.execPath),'Uninstall Mochi.exe'));
  updates=setupUpdates({updater:installed?require('electron-updater').autoUpdater:null,dialog,backup:()=>{save();backupSettings(file);},installUpdate:async installer=>{
    await handoffUpdate({installer,directory:app.getPath('userData')});
    quitting=true;clearInterval(animationTimer);tray?.destroy();
    for(const window of BrowserWindow.getAllWindows())window.destroy();
    // Settings were saved and the helper is ready. Exit without close-to-tray
    // or beforeunload handlers retaining a renderer and locking app.asar.
    app.exit(0);
  },installed,version:app.getVersion()});
  setupIPC();pet=createWindow('pet',petSize(state.scale).width,petSize(state.scale).height);palette=createWindow('palette',340,220);home();
  pet.once('ready-to-show',()=>pet.showInactive());
  try {const icon=nativeImage.createFromPath(path.join(__dirname,'assets','mochi.png')).resize({width:24,height:24});tray=new Tray(icon);tray.setToolTip('모찌');tray.on('double-click',()=>showSettings('timer'));updateTray();}catch(error){console.error('Tray:',error.message);}
  app.dock?.hide();animationTimer=setInterval(tick,40);
  if(smoke) await smokeTest();
}
async function smokeTest() {
  const assert=require('node:assert/strict');
  const ready=w=>w.webContents.isLoading()?new Promise(resolve=>w.webContents.once('did-finish-load',resolve)):Promise.resolve();
  await Promise.all([ready(pet),ready(palette)]);
  const result=await pet.webContents.executeJavaScript(`(async()=>{const result=await window.mochi.call('state');return {ok:result.ok, count:result.data.shortcuts.length, loaded:!!document.querySelector('#petImage.motion-sprite')};})()`);
  assert.equal(result.ok,true);assert.ok(result.count<=MAX_SHORTCUTS);assert.equal(result.loaded,true);
  const sleepLoaded=await pet.webContents.executeJavaScript(`new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth>0);i.onerror=()=>resolve(false);i.src='assets/mochi-motions.png';})`);assert.equal(sleepLoaded,true);
  let r=await pet.webContents.executeJavaScript(`window.mochi.call('timer-start',{hours:1,minutes:15})`);assert.equal(r.ok,true);assert.ok(state.end>Date.now()+4490000);
  r=await pet.webContents.executeJavaScript(`window.mochi.call('timer-start',{hours:0,minutes:0})`);assert.equal(r.ok,false);
  await pet.webContents.executeJavaScript(`window.mochi.call('timer-stop')`);assert.equal(state.end,null);
  assert.equal(state.walking,false);
  const restingBounds=pet.getBounds();
  for(let i=0;i<50;i++)tick();
  assert.deepEqual(pet.getBounds(),restingBounds);
  // Exercise renderer click handling, not just showMenu directly.
  pet.webContents.sendInputEvent({type:'mouseMove',x:40,y:48});
  pet.webContents.sendInputEvent({type:'mouseDown',x:40,y:48,button:'left',clickCount:1});
  pet.webContents.sendInputEvent({type:'mouseUp',x:40,y:48,button:'left',clickCount:1});
  for(let i=0;i<50&&!palette.isVisible();i++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(palette.isVisible(),true);
  assert.equal(palette.isAlwaysOnTop(),true);
  assert.equal(palette.getParentWindow(),pet);
  showSettings('timer');await ready(prefs);
  if(!prefs.isVisible())await new Promise(resolve=>prefs.once('show',resolve));
  const errors=await prefs.webContents.executeJavaScript(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({timer:!document.querySelector('#timerPanel').hidden,rows:document.querySelectorAll('.shortcut-row').length}))))`);assert.equal(errors.timer,true);assert.equal(errors.rows,MAX_SHORTCUTS);
  r=await prefs.webContents.executeJavaScript(`(async()=>{const input=document.querySelector('#petSize');input.value='250';input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));return true;})()`);
  for(let i=0;i<50&&state.scale!==250;i++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(state.scale,250);assert.equal(pet.getBounds().width,200);assert.equal(pet.getBounds().height,215);
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).scale,250);
  load();assert.equal(state.scale,250);
  r=await prefs.webContents.executeJavaScript(`window.mochi.call('size',999)`);assert.equal(r.ok,false);assert.equal(state.scale,250);
  await prefs.webContents.executeJavaScript(`window.mochi.call('size',150)`);

  // Test shortcut pagination and limits in palette & settings
  // 0개 (링크 추가 버튼 표시됨)
  await pet.webContents.executeJavaScript(`window.mochi.call('save',[])`);
  showMenu(true);
  for(let i=0;i<50&&!palette.isVisible();i++)await new Promise(resolve=>setTimeout(resolve,20));
  let palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, more:!!document.querySelector('.action[aria-label="더보기"]')})`);
  assert.equal(palState.actions, 1); assert.equal(palState.more, false);

  // 1개
  await pet.webContents.executeJavaScript(`window.mochi.call('save',[{title:'1',url:'https://1.com'}])`);
  await new Promise(resolve=>setTimeout(resolve,50));
  palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, more:!!document.querySelector('.action[aria-label="더보기"]')})`);
  assert.equal(palState.actions, 1); assert.equal(palState.more, false);

  // 5개
  await pet.webContents.executeJavaScript(`window.mochi.call('save',Array.from({length:5},(_,i)=>({title:'Link'+(i+1),url:'https://'+(i+1)+'.com'})))`);
  await new Promise(resolve=>setTimeout(resolve,50));
  palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, more:!!document.querySelector('.action[aria-label="더보기"]')})`);
  assert.equal(palState.actions, 5); assert.equal(palState.more, false);

  // 6개: 1페이지 5개 + 더보기, 2페이지 1개 + 이전
  await pet.webContents.executeJavaScript(`window.mochi.call('save',Array.from({length:6},(_,i)=>({title:'Link'+(i+1),url:'https://'+(i+1)+'.com'})))`);
  await new Promise(resolve=>setTimeout(resolve,50));
  palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, more:!!document.querySelector('.action[aria-label="더보기"]')})`);
  assert.equal(palState.actions, 5); assert.equal(palState.more, true);
  await palette.webContents.executeJavaScript(`document.querySelector('.action[aria-label="더보기"]').click()`);
  await new Promise(resolve=>setTimeout(resolve,50));
  palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, prev:!!document.querySelector('.action[aria-label="이전"]')})`);
  assert.equal(palState.actions, 1); assert.equal(palState.prev, true);
  await palette.webContents.executeJavaScript(`document.querySelector('.action[aria-label="이전"]').click()`);
  await new Promise(resolve=>setTimeout(resolve,50));
  palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, more:!!document.querySelector('.action[aria-label="더보기"]')})`);
  assert.equal(palState.actions, 5); assert.equal(palState.more, true);

  // 7개
  await pet.webContents.executeJavaScript(`window.mochi.call('save',Array.from({length:7},(_,i)=>({title:'Link'+(i+1),url:'https://'+(i+1)+'.com'})))`);
  await new Promise(resolve=>setTimeout(resolve,50));
  await palette.webContents.executeJavaScript(`document.querySelector('.action[aria-label="더보기"]').click()`);
  await new Promise(resolve=>setTimeout(resolve,50));
  palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, prev:!!document.querySelector('.action[aria-label="이전"]')})`);
  assert.equal(palState.actions, 2); assert.equal(palState.prev, true);

  // 10개
  await pet.webContents.executeJavaScript(`window.mochi.call('save',Array.from({length:10},(_,i)=>({title:'Link'+(i+1),url:'https://'+(i+1)+'.com'})))`);
  await new Promise(resolve=>setTimeout(resolve,50));
  palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, more:!!document.querySelector('.action[aria-label="더보기"]')})`);
  assert.equal(palState.actions, 5); assert.equal(palState.more, true);
  await palette.webContents.executeJavaScript(`document.querySelector('.action[aria-label="더보기"]').click()`);
  await new Promise(resolve=>setTimeout(resolve,50));
  palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, prev:!!document.querySelector('.action[aria-label="이전"]')})`);
  assert.equal(palState.actions, 5); assert.equal(palState.prev, true);

  // 페이지 초기화: 2페이지 상태에서 팔레트 닫고 열면 1페이지
  showMenu(false);
  await new Promise(resolve=>setTimeout(resolve,100));
  showMenu(true);
  for(let i=0;i<50&&!palette.isVisible();i++)await new Promise(resolve=>setTimeout(resolve,20));
  palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, more:!!document.querySelector('.action[aria-label="더보기"]')})`);
  assert.equal(palState.actions, 5); assert.equal(palState.more, true);

  // 삭제: 6개 -> 5개로 줄이면 더보기 자동 제거
  await pet.webContents.executeJavaScript(`window.mochi.call('save',Array.from({length:5},(_,i)=>({title:'Link'+(i+1),url:'https://'+(i+1)+'.com'})))`);
  await new Promise(resolve=>setTimeout(resolve,50));
  palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, more:!!document.querySelector('.action[aria-label="더보기"]')})`);
  assert.equal(palState.actions, 5); assert.equal(palState.more, false);

  // 드롭: 5개에서 드롭 시 6개로 확장 + 더보기 나타남
  await pet.webContents.executeJavaScript(`window.mochi.call('drop','https://drop6.com')`);
  await new Promise(resolve=>setTimeout(resolve,50));
  palState = await palette.webContents.executeJavaScript(`({actions:document.querySelectorAll('.action:not(.utility)').length, more:!!document.querySelector('.action[aria-label="더보기"]')})`);
  assert.equal(palState.actions, 5); assert.equal(palState.more, true);
  assert.equal(state.shortcuts.length, 6);

  // 최대 10개 제한: 10개 상태에서 드롭 시도 시 실패
  await pet.webContents.executeJavaScript(`window.mochi.call('save',Array.from({length:10},(_,i)=>({title:'Link'+(i+1),url:'https://'+(i+1)+'.com'})))`);
  const dropOver = await pet.webContents.executeJavaScript(`window.mochi.call('drop','https://drop11.com')`);
  assert.equal(dropOver.ok, false);
  assert.equal(state.shortcuts.length, 10);

  // Exercise app picker through the real preload bridge and renderer.
  await prefs.webContents.executeJavaScript(`window.mochi.call('save',[])`);
  await new Promise(resolve=>setTimeout(resolve,100));
  showSettings('links');
  const installed=await prefs.webContents.executeJavaScript(`(async()=>{await document.querySelector('#openAppPicker').onclick();const item=document.querySelector('.app-item');if(!item)throw new Error(document.querySelector('#appList').textContent);const target=item.querySelector('.app-path').textContent;item.click();await document.querySelector('#save').onclick();return target;})()`);
  assert.equal(state.shortcuts.length,1);assert.equal(fileURLToPath(state.shortcuts[0].url),installed);
  const realDialog=dialog.showOpenDialog, realOpen=shell.openPath;
  const pickedPath=path.join(app.getPath('temp'),'테스트 앱 #1%.exe');
  let openedPath;
  try {
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[pickedPath]});
    await prefs.webContents.executeJavaScript(`(async()=>{await document.querySelector('#browseCustomFile').onclick();await document.querySelector('#save').onclick();})()`);
    assert.equal(state.shortcuts.length,2);assert.equal(fileURLToPath(state.shortcuts[1].url),pickedPath);
    shell.openPath=async p=>{openedPath=p;return '';};
    await prefs.webContents.executeJavaScript(`window.mochi.call('open',1)`);
    assert.equal(openedPath,pickedPath);
    load();assert.equal(fileURLToPath(state.shortcuts[1].url),pickedPath);
    dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});
    await prefs.webContents.executeJavaScript(`document.querySelector('#browseCustomFile').onclick()`);
    assert.equal(state.shortcuts.length,2);
  } finally {dialog.showOpenDialog=realDialog;shell.openPath=realOpen;}
  console.log('APP REGISTRATION PASS: installed apps, picker, select, save, restore, exact launch path, cancel');
  const linksBefore=JSON.stringify(state.shortcuts);
  await prefs.webContents.executeJavaScript(`window.mochi.call('motions',{idle:'dance',sleeping:'sleep',celebrating:'jump'})`);
  load();assert.equal(state.motions.idle,'dance');assert.equal(JSON.stringify(state.shortcuts),linksBefore);
  state.end=Date.now()+10000;waveUntil=landUntil=celebrateUntil=0;assert.equal(publicState().pose,'focusing');
  state.end=Date.now()-1;tick();assert.equal(publicState().pose,'celebrating');celebrateUntil=0;
  lastTouch=Date.now()-600001;assert.equal(publicState().pose,'sleeping');touch();
  showSettings('motions');
  await prefs.webContents.executeJavaScript(`document.querySelector('#closeAppPicker').click()`);
  await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(await prefs.webContents.executeJavaScript(`document.querySelectorAll('[data-motion]').length`),8);
  assert.equal(await prefs.webContents.executeJavaScript(`document.querySelector('[data-motion="idle"]').value`),'dance');
  const motionShot=await prefs.webContents.capturePage();fs.writeFileSync(path.join(__dirname,'smoke-motions.png'),motionShot.toPNG());
  await prefs.webContents.executeJavaScript(`document.querySelector('#resetMotions').click()`);
  await new Promise(resolve=>setTimeout(resolve,200));assert.equal(state.motions.idle,'idle');
  direction=-1;send();await new Promise(resolve=>setTimeout(resolve,250));
  assert.equal(publicState().facing,-1);
  const mirrored=await pet.webContents.executeJavaScript(`(()=>{const c=document.querySelector('#petImage');paintMotion(c,Motions.selected(state.motions,'walking'),-1);const left=c.getContext('2d').getImageData(0,0,c.width,c.height).data;paintMotion(c,Motions.selected(state.motions,'walking'),1);const right=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let error=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)for(let k=0;k<4;k++)error+=Math.abs(left[(y*c.width+x)*4+k]-right[(y*c.width+c.width-1-x)*4+k]);return error/left.length;})()`);
  assert.ok(mirrored<1,'Rendered directions must be mirrored');direction=1;
  console.log('MOTIONS PASS: selection, persistence, existing links, focus/complete/sleep contexts, 8 controls, reset');
  const settingsShot=await prefs.webContents.capturePage();fs.writeFileSync(path.join(__dirname,'smoke-settings.png'),settingsShot.toPNG());
  const shot=await palette.webContents.capturePage();fs.writeFileSync(path.join(__dirname,'smoke-palette.png'),shot.toPNG());
  console.log('SMOKE PASS: assets, renderer IPC, timer, palette, settings, size control, persistence, 0/1/5/6/7/10 shortcuts, pagination, reset, drop expand, max 10 limit.');app.quit();
}
app.on('before-quit',()=>{quitting=true;});
app.on('window-all-closed',()=>{});

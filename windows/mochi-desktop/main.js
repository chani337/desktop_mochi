const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, shell, Notification, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { petSize, resizedPetBounds, validateShortcuts, normalizeURL, inferIcon, durationSeconds, formatTime, selectedShortcut } = require('./model');
let pet, palette, prefs, tray, file, state, dragging, holding = false, highlighted = -1;
let lastTouch = Date.now(), waveUntil = 0, landUntil = 0, direction = 1, ticks = 0, pauseUntil = 0, quitting = false;
const defaults = { shortcuts: [{title:'검색',url:'https://www.google.com/',icon:'web',color:'blue'}, {title:'YouTube',url:'https://www.youtube.com/',icon:'play',color:'red'}], walking:false, scale:150, duration:25, end:null };
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'mochi-smoke-profile'));
if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on('second-instance', () => { pet?.showInactive(); showSettings('timer'); });
  app.whenReady().then(start).catch(error=>{console.error(error);app.exit(1);});
}
function save() { fs.mkdirSync(path.dirname(file),{recursive:true}); const tmp=file+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(state,null,2)); fs.renameSync(tmp,file); }
function load() {
  file=path.join(app.getPath('userData'),'settings.json');
  try { const s=JSON.parse(fs.readFileSync(file,'utf8')); state={...defaults,...s,shortcuts:validateShortcuts(s.shortcuts)}; }
  catch { state=structuredClone(defaults); }
  // Walking is opt-in each session, including upgrades with walking:true saved.
  state.walking=false;
  try {petSize(state.scale);} catch {state.scale=150;}
  if (!Number.isFinite(state.duration)||state.duration<1||state.duration>1439) state.duration=25;
  if (!Number.isFinite(state.end) || state.end<=Date.now()) state.end=null;
}
function publicState() {
  const now=Date.now(), remain=state.end ? Math.max(0,Math.ceil((state.end-now)/1000)) : 0;
  return {...state, remaining:formatTime(remain), pose: dragging ? 'dragging' : now<landUntil ? 'landing' : now<waveUntil ? 'waving' : state.end ? 'sleeping' : now-lastTouch>600000 ? 'sleeping' : state.walking && !palette?.isVisible() && now>pauseUntil ? 'walking':'idle', highlighted, palette:!!palette?.isVisible()};
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
  handle('drop',raw=>{if(state.shortcuts.length>=5)throw new Error('최대 5개예요. 설정에서 하나를 지워 주세요.');const url=normalizeURL(raw),u=new URL(url);state.shortcuts.push({title:(u.hostname||path.basename(u.pathname)||'바로가기').replace(/^www\./,'').slice(0,24),url,icon:inferIcon(url),color:['blue','red','green','orange','purple'][state.shortcuts.length]});save();touch();waveUntil=Date.now()+1600;send();});
  handle('ignore',(ignore,event)=>{const w=BrowserWindow.fromWebContents(event.sender);if(w===pet||w===palette)w.setIgnoreMouseEvents(!!ignore,{forward:true});});
  handle('quit',()=>app.quit());
}
function updateTray() {
  if(!tray)return;
  tray.setContextMenu(Menu.buildFromTemplate([{label:'모찌 데려오기',click:()=>{home();pet.showInactive();touch();}},{label:'집중 타이머…',click:()=>showSettings('timer')},{label:'바로가기 설정…',click:()=>showSettings('links')},{label:state.walking?'산책 멈춤':'산책 시작',click:()=>{state.walking=!state.walking;touch();save();send();updateTray();}},{type:'separator'},{label:'종료',click:()=>app.quit()}]));
}
function tick() {
  if(!pet||pet.isDestroyed())return;
  const now=Date.now();
  if(state.end && now>=state.end){state.end=null;touch();waveUntil=now+4000;save();pet.webContents.send('mochi:update',{complete:true,...publicState()});if(Notification.isSupported())new Notification({title:'모찌 · 집중 완료',body:'수고했어요! 잠깐 기지개를 켜요.'}).show();}
  if(dragging){const c=screen.getCursorScreenPoint(),r=screen.getDisplayNearestPoint(c).workArea;pet.setPosition(Math.round(Math.max(r.x,Math.min(dragging.bounds.x+c.x-dragging.point.x,r.x+r.width-dragging.bounds.width))),Math.round(Math.max(r.y,Math.min(dragging.bounds.y+c.y-dragging.point.y,r.y+r.height-dragging.bounds.height))));}
  else if(holding){const c=screen.getCursorScreenPoint(),r=palette.getBounds();highlighted=selectedShortcut({x:c.x-r.x,y:c.y-r.y},state.shortcuts.length);}
  else if(publicState().pose==='walking') {const p=pet.getBounds(),r=screen.getDisplayMatching(p).workArea;let x=p.x+direction;if(x<r.x||x+p.width>r.x+r.width){direction*=-1;x=Math.max(r.x,Math.min(x,r.x+r.width-p.width));}pet.setPosition(x,Math.max(r.y,Math.min(p.y,r.y+r.height-p.height)));}
  if(++ticks%5===0){send();tray?.setToolTip(state.end?'모찌 · '+publicState().remaining:'모찌 · 바로가기와 집중 타이머');if(process.platform==='darwin')tray?.setTitle(state.end?publicState().remaining:'');}
}
async function start() {
  load();setupIPC();pet=createWindow('pet',petSize(state.scale).width,petSize(state.scale).height);palette=createWindow('palette',340,220);home();
  pet.once('ready-to-show',()=>pet.showInactive());
  try {const icon=nativeImage.createFromPath(path.join(__dirname,'assets','mochi.png')).resize({width:24,height:24});tray=new Tray(icon);tray.setToolTip('모찌');tray.on('double-click',()=>showSettings('timer'));updateTray();}catch(error){console.error('Tray:',error.message);}
  app.dock?.hide();setInterval(tick,40);
  if(smoke) await smokeTest();
}
async function smokeTest() {
  const assert=require('node:assert/strict');
  const ready=w=>w.webContents.isLoading()?new Promise(resolve=>w.webContents.once('did-finish-load',resolve)):Promise.resolve();
  await Promise.all([ready(pet),ready(palette)]);
  const result=await pet.webContents.executeJavaScript(`(async()=>{const result=await window.mochi.call('state');return {ok:result.ok, count:result.data.shortcuts.length, loaded:document.querySelector('#petImage').naturalWidth>0};})()`);
  assert.equal(result.ok,true);assert.ok(result.count<=5);assert.equal(result.loaded,true);
  const sleepLoaded=await pet.webContents.executeJavaScript(`new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth>0);i.onerror=()=>resolve(false);i.src='assets/mochi-sleep.png';})`);assert.equal(sleepLoaded,true);
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
  const errors=await prefs.webContents.executeJavaScript(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({timer:!document.querySelector('#timerPanel').hidden,rows:document.querySelectorAll('.shortcut-row').length}))))`);assert.equal(errors.timer,true);assert.equal(errors.rows,5);
  r=await prefs.webContents.executeJavaScript(`(async()=>{const input=document.querySelector('#petSize');input.value='250';input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));return true;})()`);
  for(let i=0;i<50&&state.scale!==250;i++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(state.scale,250);assert.equal(pet.getBounds().width,200);assert.equal(pet.getBounds().height,215);
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).scale,250);
  load();assert.equal(state.scale,250);
  r=await prefs.webContents.executeJavaScript(`window.mochi.call('size',999)`);assert.equal(r.ok,false);assert.equal(state.scale,250);
  await prefs.webContents.executeJavaScript(`window.mochi.call('size',150)`);
  const settingsShot=await prefs.webContents.capturePage();fs.writeFileSync(path.join(__dirname,'smoke-settings.png'),settingsShot.toPNG());
  const shot=await palette.webContents.capturePage();fs.writeFileSync(path.join(__dirname,'smoke-palette.png'),shot.toPNG());
  console.log('SMOKE PASS: assets, renderer IPC, 75-minute timer, zero rejection, stop, palette, settings, size control, persistence, invalid size rejection.');app.quit();
}
app.on('before-quit',()=>{quitting=true;});
app.on('window-all-closed',()=>{});

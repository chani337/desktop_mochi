const api = window.mochi;
const root = document.querySelector('#root');
const view = new URLSearchParams(location.search).get('view') || 'pet';
document.body.className = view;
const MAX_SHORTCUTS = 10, SHORTCUTS_PER_PAGE = 5;
let state = null, rows = [], lastLinks = '', lastPalette = false, dirty = false, errorTimeout, pointerActive = false, palettePage = 0;
const colorNames = [['blue','파랑'],['red','빨강'],['green','초록'],['orange','주황'],['purple','보라'],['pink','분홍']];
const iconNames = [['web','웹'],['play','재생'],['table','표'],['folder','폴더'],['star','별'],['check','체크'],['music','음악']];
const iconPaths = {
 web:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',
 play:'<path d="m8 4 12 8-12 8z" fill="currentColor" stroke="none"/>',
 table:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
 folder:'<path d="M3 6h7l2 3h9v11H3z"/>',
 star:'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
 music:'<path d="M9 17V5l11-2v12M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
 settings:'<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="white"/><circle cx="16" cy="12" r="2" fill="white"/><circle cx="10" cy="18" r="2" fill="white"/>',
 timer:'<circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 5V2M12 8v5l3 2"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 more:'<circle cx="6" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="18" cy="12" r="2" fill="currentColor"/>',
 back:'<path d="m15 18-6-6 6-6"/>'
};
function icon(name) {return `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name]||iconPaths.web}</svg>`;}
async function call(name,value){const result=await api.call(name,value);if(!result.ok)throw new Error(result.error);return result.data;}
function error(message){const e=document.querySelector('.error');if(e)e.textContent=message;else{const e=document.querySelector('.pet-message');if(e){e.textContent=message;clearTimeout(errorTimeout);errorTimeout=setTimeout(()=>{e.textContent='';errorTimeout=null;},5000);}}}
if(view==='pet') {
  root.innerHTML='<div class="pet-message"></div><button class="pet-hit" title="클릭: 바로가기 · 꾹 누르고 쓸기: 실행 · 드래그: 이동" aria-label="모찌 바로가기"><canvas id="petImage" class="motion-sprite" width="264" height="264" role="img" aria-label="포근한 아기 햄스터 모찌"></canvas></button>';
  const hit=document.querySelector('.pet-hit');
  let holdTimer, start, dragging=false, holding=false;
  hit.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointerActive=true;hit.setPointerCapture(e.pointerId);start={x:e.screenX,y:e.screenY};dragging=false;holding=false;holdTimer=setTimeout(()=>{holding=true;call('hold').catch(e=>error(e.message));},260);});
  hit.addEventListener('pointermove',e=>{if(!start||holding)return;if(!dragging&&Math.hypot(e.screenX-start.x,e.screenY-start.y)>5){clearTimeout(holdTimer);dragging=true;call('drag-start').catch(e=>error(e.message));}});
  hit.addEventListener('pointerup',async e=>{if(!start)return;clearTimeout(holdTimer);start=null;hit.releasePointerCapture(e.pointerId);try{if(holding)await call('release');else if(dragging)await call('drag-end');else await call('menu',!state?.palette);}catch(e){error(e.message)}holding=false;dragging=false;pointerActive=false;});
  hit.addEventListener('lostpointercapture',()=>{if(start){clearTimeout(holdTimer);start=null;call(holding?'release':'drag-end');holding=false;dragging=false;pointerActive=false;}});
  hit.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';hit.classList.add('drop');});
  hit.addEventListener('dragleave',()=>hit.classList.remove('drop'));
  hit.addEventListener('drop',async e=>{e.preventDefault();hit.classList.remove('drop');const data=e.dataTransfer;const raw=data.files.length?api.filePath(data.files[0]):(data.getData('text/uri-list').split('\n').find(x=>x&&!x.startsWith('#'))||data.getData('text/plain'));try{await call('drop',raw);}catch(e){error(e.message)}});
} else if(view==='palette') {
  root.innerHTML='<section class="palette-shell"></section>';
} else {
  root.innerHTML=`<div class="settings-shell"><div class="top"><img class="avatar" src="assets/mochi.png" alt="모찌"><div><h1>모찌의 작은 작업실</h1><p>자주 가는 곳, 그리고 나만의 집중 시간.</p></div></div><section class="size-control"><div><label for="petSize">모찌 크기</label><output id="petSizeValue" for="petSize">150%</output></div><input id="petSize" type="range" min="100" max="250" step="25" value="150"><p>100% ~ 250% · 크기를 바꾸면 바로 적용되고 자동 저장돼요.</p></section><nav class="tabs"><button data-tab="links" class="active">바로가기</button><button data-tab="timer">집중 타이머</button><button data-tab="motions">모션</button></nav><section id="linksPanel" class="panel"><div class="column-head"><span>이름</span><span>주소</span><span>아이콘</span><span>색상</span><span>순서</span></div><div id="rows"></div><div class="footer"><span class="hint">최대 10개 · 빈 줄은 숨겨져요.<br>브라우저 링크나 파일을 모찌에게 끌어다 놓아도 돼요.</span><div class="footer-actions"><button type="button" class="secondary" id="openAppPicker">+ 설치된 앱 가져오기</button><button class="primary" id="save">저장</button></div></div></section><section id="timerPanel" class="panel" hidden><div class="timer-card"><h2>모찌와 함께 집중하기</h2><div class="countdown">준비됐나요?</div><img class="timer-pet" src="assets/mochi.png" alt=""><div class="time-inputs"><input id="timerHours" type="number" min="0" max="23" value="0" aria-label="시간"><span>시간</span><input id="timerMinutes" type="number" min="0" max="59" value="25" aria-label="분"><span>분</span></div><p class="timer-hint">1분 ~ 23시간 59분. 컴퓨터가 잠들어도 경과 시간에 포함돼요.</p><div class="timer-actions"><button id="startTimer" class="primary">시작</button><button id="stopTimer" class="secondary">종료</button></div></div></section><section id="motionsPanel" class="panel" hidden><p class="hint">상황마다 좋아하는 모습을 골라요. 즉시 적용하고 자동 저장해요.</p><div id="motionRows"></div><button id="resetMotions" class="secondary">기본 모션으로 되돌리기</button></section><div id="appPickerModal" class="modal-overlay" hidden><div class="modal-card"><div class="modal-head"><h3>설치된 앱 가져오기</h3><button type="button" class="modal-close" id="closeAppPicker" aria-label="닫기">×</button></div><div class="modal-search-row"><input type="text" id="appSearchInput" placeholder="앱 검색 (예: Chrome, Code, 메모장...)" autocomplete="off"><button type="button" class="secondary" id="browseCustomFile">파일 직접 찾기…</button></div><div id="appList" class="app-list"></div></div></div><div class="error" role="status"></div></div>`;
  const sizeInput=document.querySelector('#petSize');
  sizeInput.oninput=()=>{document.querySelector('#petSizeValue').textContent=sizeInput.value+'%';call('size',Number(sizeInput.value)).catch(e=>error(e.message));};
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  document.querySelector('#motionRows').innerHTML=Motions.contexts.map(c=>`<label class="motion-row"><canvas class="motion-sprite" width="264" height="264" data-preview="${c.id}"></canvas><span>${c.name}</span><select aria-label="${c.name}" data-motion="${c.id}">${Motions.motions.map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}</select></label>`).join('');
  document.querySelectorAll('[data-motion]').forEach(select=>select.onchange=()=>call('motions',{...state.motions,[select.dataset.motion]:select.value}).catch(e=>error(e.message)));
  document.querySelector('#resetMotions').onclick=()=>call('motions',{}).catch(e=>error(e.message));
  document.querySelector('#save').onclick=async()=>{try{await call('save',collectRows());dirty=false;lastLinks=JSON.stringify(state.shortcuts);error('저장했어요.');}catch(e){error(e.message)}};
  document.querySelector('#startTimer').onclick=async()=>{try{await call('timer-start',{hours:document.querySelector('#timerHours').value,minutes:document.querySelector('#timerMinutes').value});error('');}catch(e){error(e.message)}};
  document.querySelector('#stopTimer').onclick=()=>call('timer-stop').catch(e=>error(e.message));
  let cachedApps=null;
  const showAppPicker=async()=>{
    const modal=document.querySelector('#appPickerModal'),list=document.querySelector('#appList'),input=document.querySelector('#appSearchInput');
    modal.hidden=false;input.value='';list.innerHTML='<div class="app-list-loading">앱 목록을 불러오는 중…</div>';input.focus();
    try{if(!cachedApps)cachedApps=await call('get-installed-apps');renderAppList(cachedApps);}
    catch(err){list.innerHTML=`<div class="app-list-empty">목록을 불러오지 못했어요: ${err.message}</div>`;}
  };
  const renderAppList=apps=>{
    const list=document.querySelector('#appList');list.innerHTML='';
    const q=(document.querySelector('#appSearchInput').value||'').trim().toLowerCase();
    const filtered=apps.filter(a=>!q||a.name.toLowerCase().includes(q)||a.target.toLowerCase().includes(q));
    if(!filtered.length){list.innerHTML='<div class="app-list-empty">검색 결과가 없어요.</div>';return;}
    for(const app of filtered){
      const item=document.createElement('div');item.className='app-item';item.tabIndex=0;
      const name=document.createElement('span'),target=document.createElement('span');
      name.className='app-name';name.textContent=app.name;
      target.className='app-path';target.textContent=app.target;target.title=app.target;item.append(name,target);
      const select=()=>{
        const rows=collectRows();let idx=rows.findIndex(r=>!r.title.trim()&&!r.url.trim());
        if(idx===-1)idx=rows.findIndex(r=>!r.url.trim());
        if(idx===-1){error('최대 10개까지 등록할 수 있어요. 빈 줄이 없어요.');document.querySelector('#appPickerModal').hidden=true;return;}
        rows[idx]={title:app.name.slice(0,24),url:app.target,icon:app.icon||'web',color:colorNames[idx%colorNames.length][0]};
        dirty=true;renderRows(rows);document.querySelector('#appPickerModal').hidden=true;error(`'${app.name}' 바로가기를 추가했어요. [저장]을 눌러주세요.`);
      };
      item.onclick=select;item.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};
      list.append(item);
    }
  };
  document.querySelector('#openAppPicker').onclick=showAppPicker;
  document.querySelector('#closeAppPicker').onclick=()=>{document.querySelector('#appPickerModal').hidden=true;};
  document.querySelector('#appPickerModal').onclick=e=>{if(e.target.id==='appPickerModal')e.target.hidden=true;};
  document.querySelector('#appSearchInput').oninput=()=>{if(cachedApps)renderAppList(cachedApps);};
  document.querySelector('#browseCustomFile').onclick=async()=>{
    try{
      const picked=await call('pick-file');
      if(picked){
        const rows=collectRows();let idx=rows.findIndex(r=>!r.title.trim()&&!r.url.trim());
        if(idx===-1)idx=rows.findIndex(r=>!r.url.trim());
        if(idx===-1){error('최대 10개까지 등록할 수 있어요. 빈 줄이 없어요.');document.querySelector('#appPickerModal').hidden=true;return;}
        rows[idx]={title:picked.name.slice(0,24),url:picked.target,icon:picked.icon||'web',color:colorNames[idx%colorNames.length][0]};
        dirty=true;renderRows(rows);document.querySelector('#appPickerModal').hidden=true;error(`'${picked.name}' 바로가기를 추가했어요. [저장]을 눌러주세요.`);
      }
    }catch(err){error(err.message);}
  };
}
function switchTab(tab){for(const name of ['links','timer','motions'])document.querySelector('#'+name+'Panel').hidden=tab!==name;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));error('');}
function collectRows(){return [...document.querySelectorAll('.shortcut-row')].map(row=>({title:row.querySelector('.title').value,url:row.querySelector('.url').value,icon:row.querySelector('.icon-select').value,color:row.querySelector('.color-select').value}));}
function renderRows(data){
  const container=document.querySelector('#rows');container.replaceChildren();
  for(let i=0;i<MAX_SHORTCUTS;i++){
    const r=data[i]||{title:'',url:'',icon:'web',color:colorNames[i%colorNames.length][0]},row=document.createElement('div');row.className='shortcut-row';
    for(const [key,placeholder]of [['title',`바로가기 ${i+1}`],['url','https://example.com']]){const input=document.createElement('input');input.className=key;input.placeholder=placeholder;input.value=r[key]||r[key==='url'?'target':'name']||'';input.setAttribute('aria-label',`${i+1} ${key==='title'?'이름':'주소'}`);input.oninput=()=>dirty=true;row.append(input);}
    for(const [key,options]of [['icon',iconNames],['color',colorNames]]){const select=document.createElement('select');select.className=key+'-select';select.setAttribute('aria-label',`${i+1} ${key==='icon'?'아이콘':'색상'}`);for(const [value,title]of options){const o=document.createElement('option');o.value=value;o.textContent=title;select.append(o);}select.value=r[key];select.onchange=()=>dirty=true;row.append(select);}
    const moves=document.createElement('div');moves.className='row-move';for(const [text,delta]of [['↑',-1],['↓',1]]){const b=document.createElement('button');b.textContent=text;b.disabled=i+delta<0||i+delta>=MAX_SHORTCUTS;b.onclick=()=>{const all=collectRows();[all[i],all[i+delta]]=[all[i+delta],all[i]];dirty=true;renderRows(all);};moves.append(b);}row.append(moves);container.append(row);
  }
}
function renderPalette(){
  if(palettePage === 1 && state.shortcuts.length <= SHORTCUTS_PER_PAGE) palettePage = 0;
  const shell=document.querySelector('.palette-shell');shell.innerHTML='<svg class="arc" viewBox="0 0 340 220"><path d="M59.1 136.6 A118 118 0 0 1 280.9 136.6" fill="none" stroke="#fcfcfc" stroke-width="68" stroke-linecap="round"/></svg>';
  function add(title,symbol,color,x,y,action,utility=false,index=-1){const b=document.createElement('button');b.className=`action ${utility?'utility ':''}${color}`;b.style.left=x+'px';b.style.top=y+'px';b.setAttribute('aria-label',title);b.dataset.index=index;b.innerHTML='<span class="name"></span><span class="disc">'+icon(symbol)+'</span>';b.querySelector('.name').textContent=title;b.onclick=()=>action().catch(e=>error(e.message));shell.append(b);return b;}
  const start = palettePage * SHORTCUTS_PER_PAGE;
  const pageShortcuts = state.shortcuts.slice(start, start + SHORTCUTS_PER_PAGE);
  pageShortcuts.forEach((s,i)=>{const globalIndex=start+i;const count=pageShortcuts.length;const a=(count===1?90:160-i*140/(count-1))*Math.PI/180;add(s.title,s.icon,s.color,170+118*Math.cos(a),177-118*Math.sin(a),()=>call('open',globalIndex),false,globalIndex);});
  if(!state.shortcuts.length)add('링크 추가','star','blue',170,59,()=>call('settings','links'));
  if(state.shortcuts.length > SHORTCUTS_PER_PAGE){
    if(palettePage === 0){
      add('더보기','more','',268,185,async()=>{palettePage=1;renderPalette();},true);
    } else {
      add('이전','back','',72,185,async()=>{palettePage=0;renderPalette();},true);
    }
  }
  add('설정','settings','',121,185,()=>call('settings','links'),true);
  add(state.end?state.remaining:'타이머','timer','',170,185,()=>call('settings','timer'),true).id='paletteTimer';
  add('닫기','close','',219,185,()=>call('menu',false),true);
}
const motionAtlas=new Image();motionAtlas.src='assets/mochi-motions.png';
motionAtlas.onload=()=>{if(state)update(state);};
function paintMotion(element,motion){
  element.className='motion-sprite motion-'+motion.id;
  if(motionAtlas.complete&&motionAtlas.naturalWidth){const ctx=element.getContext('2d'),[x,y,w,h]=motion.rect,size=element.width,scale=size/Math.max(w,h);ctx.clearRect(0,0,size,size);ctx.drawImage(motionAtlas,x,y,w,h,(size-w*scale)/2,(size-h*scale)/2,w*scale,h*scale);}
  element.setAttribute('aria-label',motion.name);
}
function update(data){
  if(!data||!data.shortcuts)return;
  const first=!state;state=data;
  if(view==='pet'){
    root.style.width='80px';root.style.height='86px';root.style.transformOrigin='0 0';root.style.transform=`scale(${state.scale/100})`;
    const hit=document.querySelector('.pet-hit');hit.className='pet-hit '+state.pose;
    paintMotion(document.querySelector('#petImage'),Motions.selected(state.motions,state.pose));
    if(!errorTimeout)document.querySelector('.pet-message').textContent=state.end?state.remaining:state.pose==='sleeping'?'Zzz':state.pose==='waving'?'♥':'';
    if(data.complete){try{const ctx=new AudioContext(),o=ctx.createOscillator(),gain=ctx.createGain();o.connect(gain);gain.connect(ctx.destination);o.frequency.value=660;gain.gain.setValueAtTime(.1,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.7);o.start();o.stop(ctx.currentTime+.7);o.onended=()=>ctx.close();}catch{}}
  }else if(view==='palette'){
    const key=JSON.stringify(state.shortcuts);if(first||key!==lastLinks||(!lastPalette&&state.palette)){if(!lastPalette&&state.palette||key!==lastLinks)palettePage=0;renderPalette();lastLinks=key;}
    if(!state.palette&&lastPalette)palettePage=0;
    if(state.palette&&!lastPalette){const s=document.querySelector('.palette-shell');s.getAnimations().forEach(a=>a.cancel());s.animate([{transform:'scale(.15)',opacity:0},{transform:'scale(1.04)',opacity:1,offset:.7},{transform:'scale(1)',opacity:1}],{duration:400,easing:'ease-out'});}lastPalette=state.palette;
    document.querySelectorAll('.action').forEach(b=>b.classList.toggle('selected',Number(b.dataset.index)>=0&&Number(b.dataset.index)===state.highlighted));
    document.querySelector('#paletteTimer .name').textContent=state.end?state.remaining:'타이머';
  }else{
    if(document.activeElement!==document.querySelector('#petSize')){document.querySelector('#petSize').value=state.scale;document.querySelector('#petSizeValue').textContent=state.scale+'%';}
    if(first||(!dirty&&JSON.stringify(state.shortcuts)!==lastLinks)){renderRows(state.shortcuts);lastLinks=JSON.stringify(state.shortcuts);}
    if(first){document.querySelector('#timerHours').value=Math.floor(state.duration/60);document.querySelector('#timerMinutes').value=state.duration%60;}
    document.querySelector('.countdown').textContent=state.end?state.remaining:'준비됐나요?';document.querySelector('#startTimer').textContent=state.end?'새 시간으로 시작':'시작';
    for(const c of Motions.contexts){const motion=Motions.selected(state.motions,c.id);document.querySelector(`[data-motion="${c.id}"]`).value=motion.id;paintMotion(document.querySelector(`[data-preview="${c.id}"]`),motion);}
    if(data.tab)switchTab(data.tab);
  }
}
api.on(update);
call('state').then(update).catch(e=>error(e.message));
// Keep transparent windows interactive. Renderer mouseleave-based click-through
// could leave a window permanently ignoring clicks over other Windows apps.

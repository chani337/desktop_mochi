const {test}=require('node:test');const assert=require('node:assert/strict');
const {normalizeURL,validateShortcuts,durationSeconds,formatTime,palettePoints,selectedShortcut}=require('../model');
test('URLs normalize and reject executable web payloads',()=>{assert.equal(normalizeURL('example.com'),'https://example.com/');assert.equal(normalizeURL('C:\\Users\\Me\\hello.txt'),'file:///C:/Users/Me/hello.txt');assert.throws(()=>normalizeURL('javascript:alert(1)'));assert.throws(()=>normalizeURL('data:text/html,x'));});
test('custom timer boundaries and hour display',()=>{assert.equal(durationSeconds(1,15),4500);assert.equal(durationSeconds(23,59),86340);assert.equal(formatTime(4500),'1:15:00');assert.equal(formatTime(59.2),'01:00');for(const v of [[0,0],[-1,5],[24,0],[0,60],[.5,0],['x',5]])assert.throws(()=>durationSeconds(...v));});
test('gesture selects visible radial targets, not empty center',()=>{for(const count of [1,2,3,4,5]){const pts=palettePoints(count);pts.forEach((point,i)=>assert.equal(selectedShortcut(point,count),i));assert.equal(selectedShortcut({x:170,y:210},count),-1);}});
test('shortcut validation preserves colors and order, drops empty rows, allows up to 10',()=>{
  const result=validateShortcuts([
    {title:'YouTube',url:'youtube.com',icon:'play',color:'red'},
    {title:'',url:''},
    {name:'표',target:'https://docs.google.com/spreadsheets/',icon:'table',color:'green'}
  ]);
  assert.equal(result.length,2);
  assert.equal(result[0].color,'red');
  assert.equal(result[0].type,'url');
  assert.equal(result[0].target,'https://youtube.com/');
  assert.equal(result[1].title,'표');
  assert.equal(result[1].url,'https://docs.google.com/spreadsheets/');
  const ten=validateShortcuts(Array(10).fill({title:'a',url:'https://a.com'}));
  assert.equal(ten.length,10);
  assert.throws(()=>validateShortcuts(Array(11).fill({title:'a',url:'https://a.com'})));
});

const {getShortcutPage,SHORTCUTS_PER_PAGE,MAX_SHORTCUTS}=require('../model');
test('getShortcutPage splits 1-10 shortcuts into 5-item pages without modifying items',()=>{
  const list = Array.from({length: 7}, (_, i) => ({title: `link${i+1}`}));
  assert.equal(getShortcutPage(list, 0).length, 5);
  assert.equal(getShortcutPage(list, 0)[0].title, 'link1');
  assert.equal(getShortcutPage(list, 0)[4].title, 'link5');
  assert.equal(getShortcutPage(list, 1).length, 2);
  assert.equal(getShortcutPage(list, 1)[0].title, 'link6');
  assert.equal(getShortcutPage(list, 1)[1].title, 'link7');
  assert.equal(getShortcutPage(list, 2).length, 0);
  assert.equal(SHORTCUTS_PER_PAGE, 5);
  assert.equal(MAX_SHORTCUTS, 10);
});

const {petSize,resizedPetBounds}=require('../model');
test('pet size validation and resizing preserve feet and stay on screen',()=>{
 assert.deepEqual(petSize(250),{width:200,height:215});
 for(const value of [0,99,125.5,251,NaN,'150',null])assert.throws(()=>petSize(value));
 const area={x:-1920,y:0,width:1920,height:1080};
 const centered=resizedPetBounds({x:-1000,y:500,width:80,height:86},area,200);
 assert.equal(centered.y+centered.height,586);assert.equal(centered.x+centered.width/2,-960);
 const edge=resizedPetBounds({x:-80,y:0,width:80,height:86},area,250);
 assert.ok(edge.x+edge.width<=0);assert.equal(edge.y,0);
});

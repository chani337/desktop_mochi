const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {installUpdate}=require('../update-install');
function fixture(action){const updater=new EventEmitter(),lifecycle=new EventEmitter(),events=[];let timeout;
 updater.quitAndInstall=(silent,relaunch)=>{assert.equal(silent,true);assert.equal(relaunch,true);events.push('install');action(updater,lifecycle);};
 return {events,updater,lifecycle,run:()=>installUpdate({updater,lifecycle,prepare:()=>events.push('prepare'),recover:()=>events.push('recover'),exit:()=>events.push('exit'),schedule:fn=>{timeout=fn;},cancel:()=>{}}),timeout:()=>timeout()};}
test('windows are prepared before installer; exit occurs only on updater quit signal',async()=>{
 const f=fixture(()=>{});const done=f.run();assert.deepEqual(f.events,['prepare','install']);
 f.lifecycle.emit('before-quit-for-update');await done;assert.deepEqual(f.events,['prepare','install','exit']);assert.equal(f.updater.listenerCount('error'),0);
});
test('installer failure restores app and never exits',async()=>{
 const f=fixture(updater=>updater.emit('error',Error('blocked')));await assert.rejects(f.run(),/blocked/);assert.deepEqual(f.events,['prepare','install','recover']);
 f.lifecycle.emit('before-quit-for-update');assert.ok(!f.events.includes('exit'));
});
test('missing quit signal recovers, clears listeners and allows later retry',async()=>{
 const f=fixture(()=>{});const done=f.run();f.timeout();await assert.rejects(done,/종료 요청/);assert.equal(f.lifecycle.listenerCount('before-quit-for-update'),0);
 const retry=f.run();f.lifecycle.emit('before-quit-for-update');await retry;assert.equal(f.events.filter(e=>e==='exit').length,1);
});

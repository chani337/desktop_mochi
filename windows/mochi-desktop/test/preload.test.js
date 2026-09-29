const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('app discovery and file selection cross the preload bridge; unknown actions remain blocked',async()=>{
 let api;const calls=[];
 vm.runInNewContext(fs.readFileSync(require.resolve('../preload'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>api=value},ipcRenderer:{invoke:async(channel)=>{calls.push(channel);return {ok:true};}},webUtils:{}})});
 await api.call('get-installed-apps');await api.call('pick-file');
 assert.deepEqual(calls,['mochi:get-installed-apps','mochi:pick-file']);
 assert.throws(()=>api.call('unknown-action'),/Invalid action/);
});

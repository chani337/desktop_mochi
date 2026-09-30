const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { handoffUpdate } = require('../update-handoff');
async function fixture(run) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mochi-handoff-'));
  try {const installer=path.join(dir,"모찌 ' & $ setup.exe");fs.writeFileSync(installer,'test');await run(dir,installer);}
  finally {fs.rmSync(dir,{recursive:true,force:true});}
}
test('handoff waits for readiness and passes Unicode paths as data, never code',()=>fixture(async(dir,installer)=>{
  let options,command,checks=0;
  const child=new EventEmitter();child.unref=()=>{};child.kill=()=>assert.fail('ready helper must remain alive');
  await handoffUpdate({installer,directory:dir,pid:123,launch:(_cmd,args,opts)=>{options=opts;command=Buffer.from(args.at(-1),'base64').toString('utf16le');return child;},wait:async()=>{checks++;if(checks===2)fs.writeFileSync(options.env.MOCHI_UPDATE_READY,'ready');}});
  assert.equal(checks,2);assert.equal(options.env.MOCHI_UPDATE_INSTALLER,installer);assert.equal(options.env.MOCHI_UPDATE_PID,'123');assert.equal(options.detached,true);assert.ok(!command.includes(installer));
}));
test('unready helper times out without authorizing parent exit',()=>fixture(async(dir,installer)=>{
  let killed=false;const child=new EventEmitter();child.unref=()=>{};child.kill=()=>{killed=true;};
  await assert.rejects(handoffUpdate({installer,directory:dir,launch:()=>child,wait:async()=>{},attempts:2}),/종료하지 않았/);assert.ok(killed);
}));
test('helper launch failure and missing installer preserve the running app',()=>fixture(async(dir,installer)=>{
  const child=new EventEmitter();child.unref=()=>{};
  await assert.rejects(handoffUpdate({installer,directory:dir,launch:()=>child,wait:async()=>child.emit('error',Error('blocked'))}),/blocked/);
  await assert.rejects(handoffUpdate({installer:installer+'.missing',directory:dir,launch:()=>assert.fail()}));
}));

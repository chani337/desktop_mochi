const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const motions=require('../motions');
test('catalogs agree across native and Electron apps',()=>{
 const local=require('../assets/motions.json');
 const native=JSON.parse(fs.readFileSync(path.join(__dirname,'../../../macos/DesktopCat/Resources/motions.json')));
 assert.deepEqual(local,native);assert.deepEqual(motions.motions,local.motions);assert.deepEqual(motions.contexts,local.contexts);
 assert.equal(new Set(local.motions.map(m=>m.id)).size,18);assert.deepEqual(local.motions.map(m=>m.index),Array.from({length:18},(_,i)=>i));
});
test('mappings migrate independently without losing valid selections',()=>{
 const original={idle:'dance',sleeping:'invalid',foreign:'run'};
 const valid=motions.validate(original);assert.equal(valid.idle,'dance');assert.equal(valid.sleeping,'sleep');assert.equal(Object.keys(valid).length,8);
 assert.equal(motions.selected(valid,'focusing').id,'sit');assert.equal(motions.selected(valid,'celebrating').id,'clap');assert.equal(motions.validate(null).idle,'idle');
 assert.equal(original.sleeping,'invalid');assert.deepEqual(motions.validate(JSON.parse(JSON.stringify(valid))),valid);
});

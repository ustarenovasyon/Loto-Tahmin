import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArchive} from '../engine.mjs';
import {interpretLocal,validateIntent,research,makeColumns,ALL_MODULES} from '../assistant-engine.mjs';
const draws=parseArchive(readFileSync(new URL('../data/draws.txt',import.meta.url),'utf8'));
test('Turkish command separates requested pool and columns, handles followups and unsupported text honestly',()=>{
 let p=interpretLocal('Önümüzdeki çekiliş için en iyi 30 tane rakam bul ve 10 tane kolon oluştur');
 assert.equal(p.poolSize,30);assert.equal(p.couponCount,10);assert.equal(p.action,'both');assert.equal(p.modules.length,31);
 p=interpretLocal('Bunlardan beş kolon oluştur',{poolSize:30,window:50});assert.equal(p.poolSize,30);assert.equal(p.couponCount,5);assert.equal(p.usePrevious,true);
 assert.equal(interpretLocal('Bana bir hikaye anlat').action,'clarify');
 assert.equal(interpretLocal('Son 3 çekilişte gelenleri çıkar ve 20 sayı bul').excludeRecent,3);
 assert.equal(interpretLocal('En çok çıkanlardan 10 sayı bul').modules[0],'hot');
});
test('bounds and unknown modules reject, no silent clamping of user amounts',()=>{
 assert.throws(()=>validateIntent(interpretLocal('3 sayı bul'),draws),/poolSize/);
 assert.throws(()=>validateIntent(interpretLocal('100 kolon oluştur'),draws),/couponCount/);
 assert.throws(()=>validateIntent({action:'analyze',modules:['invented']},draws),/modülü/);
});
test('all 31 analyses produce exact 10/20/30-sized real pools and exact distinct columns in those pools',async()=>{
 for(const size of [10,20,30]){
  const intent=interpretLocal(`${size} sayı bul ve 5 kolon oluştur`),r=await research(draws,intent);
  assert.equal(r.pool.length,size);assert.equal(r.modules.length,31);assert.equal(r.ranked.length,60);
  assert.ok(r.trainingTargets.at(-1)<r.validationRows[0].target);
  assert.ok(r.validationRows.every(x=>x.target<r.target&&x.pool.length===size));
  const columns=makeColumns(draws,r,5);assert.equal(columns.length,5);assert.equal(new Set(columns.map(c=>c.join('-'))).size,5);
  assert.ok(columns.every(c=>new Set(c).size===6&&c.every(n=>r.pool.includes(n))));
 }
});
test('historical target and later actual numbers cannot influence its ranking or weights',async()=>{
 const p={action:'analyze',target:975,poolSize:20,window:50,modules:ALL_MODULES};
 const blind=new Map([...draws].filter(([id])=>id<975));
 const full=await research(draws,p),hidden=await research(blind,p);
 assert.deepEqual(full.pool,hidden.pool);assert.deepEqual(full.weights,hidden.weights);assert.deepEqual(full.ranked,hidden.ranked);
});
test('recent draw exclusions actually remove their numbers, and period limits are respected',async()=>{
 const p=interpretLocal('Son 1 çekilişte gelenleri çıkar ve 20 sayı bul');p.window=20;
 const r=await research(draws,p),latest=draws.get(Math.max(...draws.keys()));
 assert.ok(r.pool.every(n=>!latest.numbers.includes(n)));assert.deepEqual(r.windows,[20]);
 assert.throws(()=>makeColumns(draws,{...r,pool:r.pool.slice(0,6)},5),/farklı altılı/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseArchive,decimal,rational,displayFraction,selectDraws,runStrategy,combinePools,filterPool} from "../engine.mjs";

const archive=new Map([...parseArchive(readFileSync(new URL("../data/draws.txt",import.meta.url),"utf8"))].filter(([id])=>id<=975));

test("uploaded archive is complete from 1 through 975",()=>{
 assert.equal(archive.size,975);
 assert.equal(Math.min(...archive.keys()),1);
 assert.equal(Math.max(...archive.keys()),975);
 assert.deepEqual(archive.get(975).numbers,[7,8,32,35,49,51]);
 assert.deepEqual(archive.get(846).numbers,[2,7,19,21,23,59]);
});
test("decimal references are exact rational numbers",()=>{
 assert.deepEqual(decimal("243,75"),rational(975n,4n));
 assert.equal(displayFraction(rational(975n,2n)),"487,5");
 assert.equal(displayFraction(rational(975n,8n)),"121,875");
});
test("do NOT round away border candidates",()=>{
 const p=selectDraws(decimal("243,75"),archive);
 assert.deepEqual([p.lowerId,p.upperId,p.lowerCount,p.upperCount,p.numbers.length],[243,244,2,5,7]);
 const half=selectDraws(decimal("487,5"),archive);
 assert.deepEqual([half.lowerCount,half.upperCount,half.numbers.length],[3,3,6]);
 const high=selectDraws(decimal("121,875"),archive);
 assert.deepEqual([high.lowerCount,high.upperCount,high.numbers.length],[1,6,7]);
 const exact=selectDraws(decimal("325"),archive);
 assert.deepEqual([exact.lowerCount,exact.upperCount,exact.numbers.length],[6,0,6]);
});
test("975 / 100 + initial 9.75 repeated for 10 steps: 39 distinct, all 6 matches",()=>{
 const result=runStrategy({mode:"add",seedDivisor:"100",count:10,addCustom:false},archive,975);
 assert.equal(result.steps.length,10);
 assert.equal(result.steps[0].reference,"9,75");
 assert.equal(result.steps[1].reference,"19,5");
 assert.equal(result.steps[9].reference,"97,5");
 assert.equal(result.pool.length,39);
 assert.deepEqual(result.hits,[7,8,32,35,49,51]);
});
test("975 successive halving 9 steps, 40 distinct, 4/6",()=>{
 const result=runStrategy({mode:"divide",divisor:"2",count:10},archive,975);
 assert.equal(result.steps.length,9);
 assert.equal(result.totalPicked,62);
 assert.equal(result.pool.length,40);
 assert.deepEqual(result.hits,[8,32,49,51]);
 assert.match(result.warnings.join(" "),/1'in altına/);
});
test("two strategies intersection is 28 distinct with 4 target numbers",()=>{
 const add=runStrategy({mode:"add",seedDivisor:"100",count:10},archive,975);
 const halve=runStrategy({mode:"divide",divisor:"2",count:9},archive,975);
 const shared=combinePools([add.pool,halve.pool],"intersection");
 assert.equal(shared.length,28);
 assert.deepEqual(shared.filter(n=>archive.get(975).numbers.includes(n)),[8,32,49,51]);
});
test("sequential divisors 2..19 cover target by 18th step",()=>{
 const r=runStrategy({mode:"divisors",divisor:"2",increment:"1",count:18},archive,975);
 assert.equal(r.steps.length,18);
 assert.equal(r.pool.length,54);
 assert.deepEqual(r.hits,[7,8,32,35,49,51]);
 assert.equal(r.steps[17].reference,"51,315789473684…");
});
test("no look-ahead to the target draw",()=>{
 const r=runStrategy({mode:"divisors",divisor:"1",increment:"1",count:10},archive,975);
 assert.equal(r.steps.length,0);
 assert.match(r.warnings.join(" "),/hedef/);
});
test("filter recent N draws and exclude last draw without using target",()=>{
 const a=runStrategy({mode:"add",seedDivisor:"100",count:9},archive,846);
 const res=filterPool(a.pool,archive,846,{frequencyEnabled:true,lookback:10,threshold:3,excludeLatest:true});
 assert.ok(res.remaining.every(n=>!archive.get(845).numbers.includes(n)));
 assert.ok(res.remaining.every(n=>![9,32,35].includes(n)));
});

const strategies=[
 {mode:"add",seedDivisor:"100",count:10},
 {mode:"divide",divisor:"2",count:9},
 {mode:"multiply",seedDivisor:"100",factor:"2",count:7},
 {mode:"divisors",divisor:"2",increment:"1",count:18},
 {mode:"subtract",amount:"100",count:8}
];
test("all five strategies support future draws using only archived sources",()=>{
 for(const target of [976,977,1000])for(const config of strategies){
  const r=runStrategy(config,archive,target);
  assert.equal(r.hasTargetResult,false);
  assert.deepEqual(r.targetNumbers,[]);
  assert.deepEqual(r.hits,[]);
  assert.equal(r.steps.length,config.count);
  assert.ok(r.pool.length>0);
  for(const step of r.steps){
   assert.ok(step.lowerId<target&&archive.has(step.lowerId));
   assert.ok(step.upperId===null||(step.upperId<target&&archive.has(step.upperId)));
  }
 }
});
test("976 / 100 multiplied by two preserves exact references and both border shares",()=>{
 const r=runStrategy(strategies[2],archive,976);
 assert.deepEqual(r.steps.map(s=>s.reference),["9,76","19,52","39,04","78,08","156,16","312,32","624,64"]);
 assert.deepEqual(r.steps.map(s=>[s.lowerCount,s.upperCount]),[[2,5],[3,4],[6,1],[6,1],[6,1],[5,2],[3,4]]);
 assert.equal(r.totalPicked,49);
 assert.deepEqual(r.steps[0].numbers,[...archive.get(9).numbers.slice(-2),...archive.get(10).numbers.slice(0,5)]);
});
test("withholding a real target result changes scoring only, never the candidate pool",()=>{
 const hidden=new Map(archive);hidden.delete(975);
 for(const config of strategies){
  const past=runStrategy(config,archive,975),blind=runStrategy(config,hidden,975);
  assert.equal(past.hasTargetResult,true);
  assert.equal(blind.hasTargetResult,false);
  assert.deepEqual(blind.pool,past.pool);
  assert.deepEqual(blind.steps.map(s=>s.numbers),past.steps.map(s=>s.numbers));
 }
});
test("future mode still blocks target, future and missing source draws",()=>{
 const self=runStrategy({mode:"divide",divisor:"1",count:1},archive,976);
 assert.equal(self.steps.length,0);
 assert.match(self.warnings.join(" "),/hedef/);
 const boundary=runStrategy({mode:"subtract",amount:"0.5",count:1},archive,976);
 assert.equal(boundary.steps.length,0);
 const unavailable=runStrategy({mode:"subtract",amount:"1",count:2},archive,977);
 assert.equal(unavailable.steps.length,0);
 assert.match(unavailable.warnings.join(" "),/976.*arşivde yok/);
 const last=runStrategy({mode:"subtract",amount:"1",count:1},archive,976);
 assert.deepEqual(last.pool,archive.get(975).numbers);
});
test("future filters use the latest completed draw and invalid targets are rejected",()=>{
 const r=runStrategy(strategies[2],archive,976);
 const filtered=filterPool(r.pool,archive,976,{excludeLatest:true});
 assert.deepEqual(filtered.remaining,r.pool.filter(n=>!archive.get(975).numbers.includes(n)));
 for(const target of [0,1,-2,976.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  assert.throws(()=>runStrategy(strategies[2],archive,target),/tam sayı/);
 }
});

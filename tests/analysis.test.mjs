import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseArchive} from "../engine.mjs";
import {MODULES,CLUB,buildContext,analyze,compareAnalysisSets,assessPool,historicalCheck,ticketMetrics,filterPipeline,inspectBall,orderedHistory} from "../analysis-engine.mjs";
import {generateCoupons,clubContest,hexKey} from "../coupon-engine.mjs";
const draws=parseArchive(readFileSync(new URL("../data/draws.txt",import.meta.url),"utf8"));
test("975 real draws and 31 functional analysis modules",()=>{
 assert.equal(draws.size,975);
 assert.equal(MODULES.length,31);
 const c=buildContext(draws,976,100);
 for(const m of MODULES){
  const r=analyze(c,m.id,18);
  assert.equal(r.selected.length,18,m.id);
  assert.equal(new Set(r.selected).size,18,m.id);
  assert.ok(r.selected.every(n=>n>0&&n<=60),m.id);
 }
});
test("analysis target never includes that draw or future draws",()=>{
 for(const target of [200,846,975]){
  const full=buildContext(draws,target,100);
  assert.ok(full.all.every(d=>d.id<target));
  const modified=new Map(draws);modified.delete(target);
  const blind=buildContext(modified,target,100);
  for(const moduleId of ["dna","limit","matrix","pairs","follow","ordered","hot","scope"]){
    assert.deepEqual(analyze(full,moduleId,15).selected,analyze(blind,moduleId,15).selected,moduleId);
  }
 }
});
test("each module comparison preserves independently saved pools",()=>{
 const c=buildContext(draws,976,100);
 const a=analyze(c,"hot",16),b=analyze(c,"dna",16);
 const union=compareAnalysisSets([a,b],"union");
 const intersection=compareAnalysisSets([a,b],"intersection");
 assert.ok(union.length>=16);
 assert.ok(intersection.every(n=>a.selected.includes(n)&&b.selected.includes(n)));
 assert.equal(assessPool(c,union).hasResult,false);
});
test("new coupon runs are unique, exact six, deterministic when seeded, and consistent with strict source pool",()=>{
 const ctx=buildContext(draws,976,100),modules=["dna","limit","matrix","hot","pairs"];
 const r1=generateCoupons({ctx,moduleIds:modules,count:10,limit:18,seed:31415});
 const r2=generateCoupons({ctx,moduleIds:modules,count:10,limit:18,seed:31415});
 assert.deepEqual(r1.coupons,r2.coupons);
 assert.equal(new Set(r1.coupons.map(hexKey)).size,10);
 for(const c of r1.coupons){
  assert.equal(c.length,6);assert.equal(new Set(c).size,6);
  assert.ok(c.every(n=>n>=1&&n<=60));
  assert.ok(ticketMetrics(c).total>0);
 }
 const filtered=generateCoupons({ctx,moduleIds:modules,count:10,limit:18,manualPool:[1,6,9,13,19,20,21,22,23,24,27,33],
  strict:true,seed:900});
 assert.equal(filtered.coupons.length,10);
 assert.ok(filtered.coupons.every(c=>c.every(n=>[1,6,9,13,19,20,21,22,23,24,27,33].includes(n))));
});
test("past result verification compares without using it to construct coupons",()=>{
 const original=buildContext(draws,975,100),hidden=new Map(draws);hidden.delete(975);
 const ctx=buildContext(hidden,975,100);
 const arg={moduleIds:["dna","limit","matrix"],count:6,seed:12,limit:18};
 assert.deepEqual(generateCoupons({ctx:original,...arg}).coupons,generateCoupons({ctx,...arg}).coupons);
 assert.equal(assessPool(original,[7,8,32,35,49,51]).hits.length,6);
 assert.equal(assessPool(ctx,[7,8,32,35,49,51]).hits.length,0);
});
test("historical checks and 6 fixed systems can be tested on 20 draws without leakage",()=>{
 const check=historicalCheck(draws,{target:976,moduleIds:["dna","hot"],count:20,limit:18,window:100});
 assert.equal(check.rows.length,20);
 assert.equal(check.rows[0].id,956);
 assert.equal(check.rows.at(-1).id,975);
 const club=clubContest(draws,{target:976,window:100,period:20,seed:4719});
 assert.equal(club.records.length,6);
 assert.deepEqual(new Set(club.records.map(x=>x.name)).size,6);
 for(const system of club.records){
  assert.equal(system.runs,20);
  assert.equal(system.next.length,6);
  assert.equal(system.hitCounts.reduce((a,b)=>a+b,0),20);
 }
 const extra=clubContest(draws,{target:976,window:100,period:10,
  teams:[...CLUB,{id:"myteam",name:"Kendi Sistemim",modules:["dna","sum","pairs"]}]});
 assert.equal(extra.records.length,7);
 assert.ok(extra.records.some(x=>x.id==="myteam"));
});

test("loss-aware 21-to-12 sieve never mutates the original input pool",()=>{
 const c=buildContext(draws,976,100);
 const original=[1,6,9,10,13,19,20,21,22,23,24,27,33,37,38,40,45,48,53,54,60];
 const copy=[...original];
 const results=["hot","dna","matrix","limit"].map(id=>analyze(c,id,18));
 const r=filterPipeline(original,results,{keepAtLeast:12,order:"gentle"});
 assert.equal(r.source.length,21);
 assert.equal(r.remaining.length,12);
 assert.ok(r.remaining.every(n=>original.includes(n)));
 assert.deepEqual(original,copy);
 assert.equal(r.journal.length,4);
 assert.equal(r.journal.at(-1).after,12);
});
test("explainable DNA/Limit and ordered history do not use future target results",()=>{
 const c=buildContext(draws,975,100),hidden=new Map(draws);hidden.delete(975);
 const blind=buildContext(hidden,975,100);
 const a=inspectBall(c,37,10),b=inspectBall(blind,37,10);
 assert.deepEqual(a,b);
 assert.equal(a.dna.reduce((total,x)=>total+x.count,0),c.freq[37]);
 assert.ok(a.limit.every(n=>n>=0));
 const ordered=orderedHistory(c,12);
 assert.equal(ordered.length,12);
 assert.ok(ordered.every(x=>x.id<975&&x.numbers.length===6));
});

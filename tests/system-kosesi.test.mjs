import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseArchive} from "../engine.mjs";
import {catalog,SYSTEM_COUNT,buildPools,backtest,virtualCoupons,forecast,settleForecast,countHits} from "../system-kosesi-engine.mjs";
const draws=parseArchive(readFileSync(new URL("../data/draws.txt",import.meta.url),"utf8"));
test("catalog includes 31 analyses, math methods, 30-number variations and ALL pairwise intersections",()=>{
 const {sources,specs}=catalog();
 assert.equal(sources.length,44);
 assert.equal(specs.length,44+31+6+(44*43)/2);
 assert.equal(SYSTEM_COUNT,specs.length);
 assert.ok(specs.some(s=>s.kind==="intersection"&&s.left==="an-hot"&&s.right==="an-dna"));
});
test("historical prediction never uses its target or any later draw",()=>{
 const target=975,full=buildPools(draws,target);
 const hidden=new Map([...draws].filter(([id])=>id<target));
 const blind=buildPools(hidden,target);
 assert.deepEqual(full.all.get("an-hot"),blind.all.get("an-hot"));
 assert.deepEqual(full.all.get("math-subtract100"),blind.all.get("math-subtract100"));
 assert.deepEqual(full.all.get("common-an-hot-an-dna"),blind.all.get("common-an-hot-an-dna"));
 assert.deepEqual([...full.all],[...blind.all]);
});
test("two 30-number pools narrow by true intersection; no artificial 6-number padding",()=>{
 const pools=buildPools(draws,976).all;
 const a=pools.get("wide-hot"),b=pools.get("wide-dna");
 assert.equal(a.length,30);
 assert.equal(b.length,30);
 assert.deepEqual(pools.get("common-an-hot-an-dna"),a.filter(n=>b.includes(n)));
 const small=pools.get("common-an-hot-an-dna");
 if(small.length<6)assert.deepEqual(virtualCoupons(small),[]);
 else{
  const tickets=virtualCoupons(small,{count:5,seed:10});
  assert.equal(tickets.length,5);
  assert.ok(tickets.every(t=>t.length===6&&t.every(n=>small.includes(n))));
 }
});
test("real past outcomes computed AFTER predictions; expected hits scale with pool size",()=>{
 const result=backtest(draws,{target:975,period:5,window:100});
 assert.equal(result.totalRuns,5);
 assert.equal(result.rows.length,SYSTEM_COUNT);
 for(const row of result.rows){
  assert.equal(row.hits,row.draws.filter(d=>d.valid).reduce((a,d)=>a+d.hits,0));
  assert.equal(row.tries,row.draws.filter(d=>d.valid).length);
  assert.ok(Math.abs(row.expectedAverage-row.averagePool*.1)<1e-10);
  assert.equal(row.allSix,row.draws.filter(d=>d.valid&&d.hits===6).length);
 }
 assert.equal(countHits([1,7,8,32,35,49,51],[7,8,32,35,49,51]),6);
});
test("forward forecasts are frozen and settle only when actual result exists",()=>{
 const pending=forecast(draws,{target:976,period:5,systems:3,coupons:3});
 assert.equal(pending.state,"pending");
 assert.equal(pending.selected.length,3);
 const unchanged=settleForecast(pending,draws);
 assert.equal(unchanged.state,"pending");
 for(const row of pending.selected){
  assert.ok(row.pool.length>=6);
  assert.ok(row.tickets.every(t=>t.length===6&&new Set(t).size===6&&t.every(n=>row.pool.includes(n))));
 }
 const prev=forecast(draws,{target:975,period:5,systems:3,coupons:3});
 const settled=settleForecast(prev,draws);
 assert.equal(settled.state,"settled");
 assert.equal(settled.actual.length,6);
 for(const row of settled.selected){
  assert.equal(row.hits.length,row.pool.filter(n=>settled.actual.includes(n)).length);
  assert.deepEqual(row.ticketHits,row.tickets.map(t=>t.filter(n=>settled.actual.includes(n)).length));
 }
});

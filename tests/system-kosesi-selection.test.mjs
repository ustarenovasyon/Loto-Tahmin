import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseArchive} from "../engine.mjs";
import {forecast,settleForecast} from "../system-kosesi-engine.mjs";
import {columnHistory,selectFinalCoupons} from "../system-kosesi-selection.mjs";
const draws=new Map([...parseArchive(readFileSync(new URL("../data/draws.txt",import.meta.url),"utf8"))].filter(([id])=>id<=975));
test("final shortlist contains only existing source tickets, not invented numbers",()=>{
 const record=forecast(draws,{target:976,period:5,systems:7,coupons:5});
 const evidence=columnHistory(draws,record,{period:5});
 const selected=selectFinalCoupons(record,{count:8,maxOverlap:5,history:evidence});
 const originals=new Set(record.selected.flatMap(x=>x.tickets.map(n=>[...n].sort((a,b)=>a-b).join("-"))));
 assert.equal(selected.requested,8);
 assert.equal(selected.actualCount,8);
 assert.equal(new Set(selected.columns.map(x=>x.numbers.join("-"))).size,8);
 assert.equal(selected.totalColumns,35);
 for(const row of selected.columns){
  assert.equal(row.numbers.length,6);
  assert.ok(originals.has(row.numbers.join("-")));
  assert.ok(row.sources.length>=1);
 }
});
test("real past positional performance never sees target result, even when public record has it",()=>{
 const record=forecast(draws,{target:975,period:5,systems:4,coupons:4});
 const settled=settleForecast(record,draws);
 const blind=new Map([...draws].filter(([id])=>id<975));
 const a=columnHistory(draws,settled,{period:5});
 const b=columnHistory(blind,settled,{period:5});
 assert.deepEqual(a,b);
 const c=selectFinalCoupons(settled,{count:4,maxOverlap:5,history:a});
 const d=selectFinalCoupons(settled,{count:4,maxOverlap:5,history:b});
 assert.deepEqual(c.columns,d.columns);
 assert.ok(a.drawsChecked>0);
 for(const stat of Object.values(a.byPosition)){
  assert.equal(stat.totalHits,stat.distribution.reduce((n,count,hits)=>n+count*hits,0));
  assert.equal(stat.tries,stat.distribution.reduce((n,count)=>n+count,0));
 }
});
test("strong overlap constraint never pads with fake tickets or silently ignores the rule",()=>{
 const record=forecast(draws,{target:976,period:5,systems:5,coupons:5});
 const result=selectFinalCoupons(record,{count:30,maxOverlap:0});
 for(let i=0;i<result.columns.length;i++){
  for(let j=i+1;j<result.columns.length;j++){
   assert.equal(result.columns[i].numbers.filter(n=>result.columns[j].numbers.includes(n)).length,0);
  }
 }
 assert.ok(result.actualCount<30);
});
test("duplicate source tickets remain one choice, with both real source labels",()=>{
 const forecastRecord=forecast(draws,{target:976,period:5,systems:2,coupons:3});
 const altered={...forecastRecord,selected:forecastRecord.selected.map(x=>({...x,tickets:x.tickets.map(t=>[...t])}))};
 altered.selected[1].tickets[0]=[...altered.selected[0].tickets[0]];
 const result=selectFinalCoupons(altered,{count:4,maxOverlap:5});
 assert.equal(result.uniqueCandidates,5);
 const repeated=result.columns.find(x=>x.numbers.join("-")===altered.selected[0].tickets[0].join("-"));
 // It may be outside top 4; test all 5 to verify its provenance.
 const complete=selectFinalCoupons(altered,{count:5,maxOverlap:5});
 const item=complete.columns.find(x=>x.numbers.join("-")===altered.selected[0].tickets[0].join("-"));
 assert.ok(item);
 assert.equal(item.sources.length,2);
});
test("public pre-draw record produces selected playable candidates without editing its ledger",()=>{
 const archive=JSON.parse(readFileSync(new URL("../data/system-kosesi-ledger.json",import.meta.url),"utf8"));
 const record=archive.records.find(r=>r.target===976);
 assert.ok(record?.selected?.length);
 const serialized=JSON.stringify(record);
 const evidence=columnHistory(draws,record,{period:5});
 const result=selectFinalCoupons(record,{count:5,maxOverlap:5,history:evidence});
 assert.equal(result.actualCount,5);
 assert.equal(result.target,976);
 assert.ok(result.columns.every(x=>x.numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=60)));
 assert.equal(JSON.stringify(record),serialized);
});
test("reject invalid count or overlap, never pretend fewer is exact",()=>{
 const record=forecast(draws,{target:976,period:5,systems:2,coupons:2});
 assert.throws(()=>selectFinalCoupons(record,{count:0}),/kolon adedi/);
 assert.throws(()=>selectFinalCoupons(record,{count:101}),/kolon adedi/);
 assert.throws(()=>selectFinalCoupons(record,{count:3,maxOverlap:6}),/ortak sayı/);
 const chosen=selectFinalCoupons(record,{count:10,maxOverlap:5});
 assert.equal(chosen.actualCount,4);
 assert.equal(chosen.requested,10);
});

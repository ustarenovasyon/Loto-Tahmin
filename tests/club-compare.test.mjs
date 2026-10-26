import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseArchive} from "../engine.mjs";
import {parseOwnPool,parseExternalColumns,localClubSources,compareClubSources,compareDrawsToPool} from "../club-compare-engine.mjs";
const draws=new Map([...parseArchive(readFileSync(new URL("../data/draws.txt",import.meta.url),"utf8"))].filter(([id])=>id<=975));
test("user supplied club text parses multiple six-number lines without mistaking leading row IDs",()=>{
 const p=parseExternalColumns("B 9336 | DELTA 03 | 975 | 22.10.2026 | 21 24 38 42 52 55\n"+
 "1,6,9,19,20,21\n1,6,9,19,20,21\ninvalid");
 assert.deepEqual(p.columns,[[21,24,38,42,52,55],[1,6,9,19,20,21]]);
 assert.ok(p.errors.length===1);
 assert.throws(()=>parseExternalColumns("1 2 3 4 5 77"),/Geçerli altılı/);
});
test("own pool deduplication, strict validation and source-level vote support",()=>{
 const own=parseOwnPool("1 6 9 10 13 19 20 21 22 23 24 27 33 37 38 40 45 48 53 54 60 60");
 assert.equal(own.length,21);
 assert.throws(()=>parseOwnPool("7 90"),/1–60/);
 const sources=[
  {id:"first",name:"A",target:976,columns:[[1,6,9,19,20,37],[1,6,10,20,33,37]]},
  {id:"second",name:"B",target:976,columns:[[1,6,9,19,20,37],[6,9,13,23,37,48]]}
 ];
 const result=compareClubSources(own,sources,{topPerSystem:6,minSystems:2});
 assert.deepEqual(result.fullIntersection,result.consensus);
 assert.ok(result.fullIntersection.includes(6));
 assert.ok(result.candidateRows.find(x=>x.number===6)?.support===2);
 assert.equal(result.sourceCount,2);
 assert.ok(result.sources.every(s=>s.bestOverlap>=5));
});
test("six local club systems produce future-target samples without target data leakage",()=>{
 const next=localClubSources(draws,{target:976,window:100,perSystem:10,seed:419});
 assert.equal(next.length,6);
 assert.ok(next.every(s=>s.columns.length===10));
 assert.ok(next.every(s=>s.columns.every(c=>c.length===6&&new Set(c).size===6)));
 const historical=localClubSources(draws,{target:975,window:100,perSystem:5,seed:419});
 const hidden=new Map(draws);hidden.delete(975);
 const blind=localClubSources(hidden,{target:975,window:100,perSystem:5,seed:419});
 assert.deepEqual(historical.map(s=>s.columns),blind.map(s=>s.columns));
});
test("compare on 21 number pool gives explainable source intersections and no mutation",()=>{
 const original=parseOwnPool("1 6 9 10 13 19 20 21 22 23 24 27 33 37 38 40 45 48 53 54 60");
 const copy=[...original];
 const local=localClubSources(draws,{target:976,window:100,perSystem:24,seed:419});
 const r=compareClubSources(original,local,{topPerSystem:12,minSystems:2});
 assert.deepEqual(original,copy);
 assert.equal(r.candidateRows.length,21);
 assert.ok(r.consensus.every(n=>original.includes(n)));
 assert.ok(r.consensus.every(n=>r.candidateRows.find(x=>x.number===n).support>=2));
 assert.equal(r.sourceCount,6);
 assert.equal(r.sources.reduce((s,x)=>s+x.columns,0),144);
 const historic=compareDrawsToPool(draws,975,original);
 const future=compareDrawsToPool(draws,976,original);
 assert.equal(historic.hasResult,true);
 assert.equal(future.hasResult,false);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseArchive,decimal,rational,displayFraction,selectDraws,runStrategy,combinePools,filterPool} from "../engine.mjs";

const archive=parseArchive(readFileSync(new URL("../data/draws.txt",import.meta.url),"utf8"));

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

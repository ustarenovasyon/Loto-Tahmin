// Loto Tahmin · Modüler kupon üretimi ve birbirinden bağımsız sabit sistemler kulübü
// Bağımsız analiz seçimiyle çalışan kupon ve yarışma hesapları.
import {buildContext,analyze,ticketPass,ticketMetrics,sortedUnique,CLUB,assessPool} from "./analysis-engine.mjs";
export const hexKey=nums=>[...nums].sort((a,b)=>a-b).join("-");
const nums=Array.from({length:60},(_,i)=>i+1);
function seeded(seed){let a=(Number(seed)>>>0)||0x6d2b79f5;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function entropy(){try{const buf=new Uint32Array(1);crypto.getRandomValues(buf);return buf[0]}catch{return Math.floor(Math.random()*4294967295)}}
function chooseSix(rng,weights,manualPool=null){
 const available=(manualPool?.length>=6?manualPool:nums).map(n=>n),got=[];
 for(let i=0;i<6;i++){
  const weighted=available.map(n=>Math.max(.005,weights[n]||0.005)),total=weighted.reduce((a,b)=>a+b,0);
  let r=rng()*total,at=available.length-1;
  for(let j=0;j<available.length;j++){r-=weighted[j];if(r<=0){at=j;break}}
  got.push(available.splice(at,1)[0]);
 }
 return got.sort((a,b)=>a-b);
}
function itemRank(r,n){return r.ranked.indexOf(n)}
export function weightAnalyses(results,manualPool,strict=false){
 const weights=Array(61).fill(.05);
 if(!results.length)throw Error("En az bir analiz seç.");
 for(const result of results){
  for(let i=0;i<result.ranked.length;i++){
   const n=result.ranked[i],value=Math.max(0,1-i/60);
   weights[n]+=.3+Math.pow(value,2)*2.4;
   if(result.selected.includes(n))weights[n]+=.6;
  }
 }
 const pool=sortedUnique(manualPool||[]);
 if(pool.length>=6){for(const n of nums)weights[n]*=pool.includes(n)?1.35:(strict?.000001:.45)}
 return weights;
}
function quality(ctx,ticket,results,used){
 const vote=results.reduce((z,r)=>z+ticket.reduce((score,n)=>score+Math.max(0,(60-itemRank(r,n))/60),0),0)/(results.length*6);
 const m=ticketMetrics(ticket);
 const duplicate=used.reduce((pen,other)=>pen+Math.pow(ticket.filter(n=>other.includes(n)).length/6,3),0);
 const band=(m.total>=ctx.recent.map(x=>x.numbers.reduce((a,b)=>a+b,0)).sort((a,b)=>a-b)[Math.floor(ctx.recent.length*.15)]&&
             m.total<=ctx.recent.map(x=>x.numbers.reduce((a,b)=>a+b,0)).sort((a,b)=>a-b)[Math.floor(ctx.recent.length*.85)]?0.18:-.18);
 return vote+band-.7*duplicate;
}
export function generateCoupons({ctx,moduleIds,count=5,limit=18,manualPool=[],strict=false,seen=[],seed=null}){
 const ids=[...new Set(moduleIds)];if(!ids.length)throw Error("En az bir analiz seç.");
 count=Number(count);
 if(!Number.isInteger(count)||count<1||count>100)throw Error("Kupon adedi 1–100 arasında olmalı.");
 const manual=sortedUnique(manualPool);if(strict&&manual.length>0&&manual.length<6)throw Error("Sıkı havuz için en az 6 sayı seç.");
 const rng=seeded(seed===null?entropy():seed),results=ids.map(id=>analyze(ctx,id,limit)),weights=weightAnalyses(results,manual,strict);
 const old=new Set(seen),all=[];let skipped=0;
 for(let i=0;i<count;i++){
  let best=null,bestScore=-Infinity;
  for(let j=0;j<Math.min(220,90+count*4);j++){
   const ticket=chooseSix(rng,weights,strict&&manual.length>=6?manual:null);
   const key=hexKey(ticket);
   if(old.has(key)||all.some(x=>hexKey(x)===key)){skipped++;continue}
   const score=quality(ctx,ticket,results,all);
   const constraints=ticketPass(ctx,ticket,ids);
   const adjusted=score+(constraints?.35:-.5)+rng()*.25;
   if(adjusted>bestScore){bestScore=adjusted;best=ticket}
  }
  if(!best){
    let attempts=0;
    do{best=chooseSix(rng,weights,strict&&manual.length>=6?manual:null);attempts++}while(attempts<500&&(old.has(hexKey(best))||all.some(x=>hexKey(x)===hexKey(best))));
  }
  if(!best||old.has(hexKey(best))||all.some(x=>hexKey(x)===hexKey(best)))break;
  all.push(best);
 }
 const details=all.map((numbers,i)=>({
  row:i+1,numbers,metrics:ticketMetrics(numbers),matches:assessPool(ctx,numbers).hits,
  byModule:results.map(r=>({id:r.id,overlap:numbers.filter(n=>r.selected.includes(n)).length}))
 }));
 return {target:ctx.target,ids,limit,manualPool:manual,strict,seed,created:new Date().toISOString(),coupons:all,details,skipped};
}
export function clubContest(draws,{target,window=100,period=30,seed=4719,teams=CLUB}){
 const maximum=Math.max(...draws.keys());
 if(!Number.isInteger(target)||target<2||target>maximum+1)throw Error("Geçersiz hedef.");
 const records=teams.map(team=>({id:team.id,name:team.name,modules:team.modules,
  hitCounts:[0,0,0,0,0,0,0],totalHits:0,runs:0,rows:[],next:[]}));
 const start=Math.max(30,target-Math.min(150,Math.max(5,Number(period))));
 for(let id=start;id<target;id++){
  if(!draws.has(id))continue;
  const ctx=buildContext(draws,id,window);
  records.forEach((team,ix)=>{
   const generated=generateCoupons({ctx,moduleIds:team.modules,count:1,limit:18,seed:seed+id*97+ix*83});
   const picks=generated.coupons[0]||[];
   const hits=assessPool(ctx,picks).hits.length;
   team.runs++;team.totalHits+=hits;team.hitCounts[hits]++;
   team.rows.push({id,picks,hits});
  });
 }
 const nextCtx=buildContext(draws,target,window);
 records.forEach((team,ix)=>{
  team.average=team.runs?team.totalHits/team.runs:0;
  team.next=generateCoupons({ctx:nextCtx,moduleIds:team.modules,count:1,limit:18,seed:seed+target*97+ix*83}).coupons[0]||[];
 });
 records.sort((a,b)=>b.average-a.average||b.hitCounts[3]-a.hitCounts[3]||a.id.localeCompare(b.id));
 return {target,window,period,seed,records,baseline:0.6}; // 6/60: tek 6 sayılı kolonun rastgele beklenen isabeti 0,6
}

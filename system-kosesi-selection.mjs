// Sistem Köşesi — final kullanıcı kolonu seçici.
// Kaynak yalnızca önceden oluşturulmuş kuponlar ve geçmiş gerçek arşivdir.
// Hedef çekilişin sonucu hiçbir zaman sıralama veya kupon üretimine girmez.
import {catalog,buildPools,virtualCoupons} from "./system-kosesi-engine.mjs";
const specs=new Map(catalog().specs.map(x=>[x.id,x]));
const baseline=.6; // Gerçek 6/60 oyununda tek altılı kolonun beklenen eşleşmesi.
const key=nums=>nums.join("-");
const hash=text=>{
 let h=2166136261;
 for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
 return h>>>0;
};
function validTicket(ticket){
 return Array.isArray(ticket)&&ticket.length===6&&
 ticket.every(n=>Number.isInteger(n)&&n>=1&&n<=60)&&new Set(ticket).size===6;
}
function systemTicketsAt(pools,target,source,count){
 const pool=pools.all.get(source.id)||[];
 if(pool.length<6)return [];
 const spec=specs.get(source.id);
 if(!spec)return [];
 const weights=Object.create(null);
 if(spec.kind==="single"&&spec.source.kind==="analysis"){
  const scores=pools.analyses.get(spec.source.module)?.scores||{};
  for(const n of pool)weights[n]=.5+(scores[n]||0);
 }
 return virtualCoupons(pool,{
  count,seed:(target*1013+hash(source.id))>>>0,weights
 });
}
/** Historic columns for the SAME system and column index.
 * For each historical id, buildPools() sees ONLY draws strictly before that id.
 * Existing public forecast columns, scores and state are never mutated.
 */
export function columnHistory(draws,record,{period=10}={}){
 if(!record||!Number.isInteger(record.target)||!Array.isArray(record.selected))
  throw Error("Geçerli sistem tahmini bulunamadı.");
 const recent=Math.floor(Number(period));
 if(!Number.isInteger(recent)||recent<5||recent>100)
  throw Error("Sütun geçmiş testi 5–100 çekiliş olabilir.");
 const historical=[...draws.keys()].filter(id=>id<record.target&&id>=Math.max(31,record.target-recent)).sort((a,b)=>a-b);
 const stats=new Map();
 for(const source of record.selected){
  if(!Array.isArray(source.tickets)||!specs.has(source.id))continue;
  for(let i=0;i<source.tickets.length;i++){
   stats.set(source.id+":"+i,{systemId:source.id,position:i+1,tries:0,totalHits:0,
    twoPlus:0,threePlus:0,maxHits:0,distribution:[0,0,0,0,0,0,0]});
  }
 }
 for(const target of historical){
  // This is a real archived completed target; its result is never used by buildPools.
  const built=buildPools(draws,target,{window:record.window||100});
  const result=draws.get(target).numbers;
  const actualSet=new Set(result);
  for(const source of record.selected){
   if(!specs.has(source.id))continue;
   const predicted=systemTicketsAt(built,target,source,source.tickets.length);
   predicted.forEach((ticket,i)=>{
    const stat=stats.get(source.id+":"+i);
    if(!stat||!validTicket(ticket))return;
    const hits=ticket.filter(n=>actualSet.has(n)).length;
    stat.tries++;stat.totalHits+=hits;
    stat.twoPlus+=Number(hits>=2);stat.threePlus+=Number(hits>=3);
    stat.maxHits=Math.max(stat.maxHits,hits);stat.distribution[hits]++;
   });
  }
 }
 return {target:record.target,period:recent,drawsChecked:historical.length,
  byPosition:Object.fromEntries([...stats].map(([id,x])=>[id,{...x,average:x.tries?x.totalHits/x.tries:0}]))};
}
/** Picks ONLY existing forecast tickets (no new combinations, no fabricated hits).
 * Evidence is descriptive walk-forward column performance, not a claimed future probability.
 */
export function selectFinalCoupons(record,{count=5,maxOverlap=4,history=null}={}){
 if(!record||!Number.isInteger(record.target)||!Array.isArray(record.selected))
  throw Error("Kupon kaydı bulunamadı.");
 const requested=Number(count),overlap=Number(maxOverlap);
 if(!Number.isInteger(requested)||requested<1||requested>100)
  throw Error("Oynanacak kolon adedi 1–100 arasında olmalı.");
 if(!Number.isInteger(overlap)||overlap<0||overlap>5)
  throw Error("En fazla ortak sayı 0–5 arasında olmalı.");
 const candidates=new Map();
 for(const system of record.selected){
  if(!Array.isArray(system.tickets))continue;
  system.tickets.forEach((raw,i)=>{
   if(!validTicket(raw))return;
   const numbers=[...raw].sort((a,b)=>a-b),id=key(numbers);
   const ev=history?.byPosition?.[system.id+":"+i]||null;
   const tries=ev?.tries||0;
   // 10 historic observations' worth of neutral smoothing; NOT a probability of winning.
   const observed=tries?(ev.totalHits+10*baseline)/(tries+10):baseline;
   const poolExcess=Number.isFinite(system.test?.excess)?system.test.excess:0;
   const score=observed-baseline+.12*Math.max(-2,Math.min(2,poolExcess));
   const source={systemId:system.id,name:system.name,index:i+1,
    history:ev?{tries,totalHits:ev.totalHits,average:ev.average,
     twoPlus:ev.twoPlus,threePlus:ev.threePlus,maxHits:ev.maxHits}:null,score};
   if(!candidates.has(id))candidates.set(id,{numbers,sources:[source],score});
   else{
    const x=candidates.get(id);x.sources.push(source);x.score=Math.max(x.score,score);
   }
  });
 }
 const ranked=[...candidates.values()].sort((a,b)=>b.score-a.score||b.sources.length-a.sources.length||key(a.numbers).localeCompare(key(b.numbers)));
 const chosen=[];
 const remains=[...ranked];
 while(chosen.length<requested&&remains.length){
  let best=-1,bestScore=-Infinity;
  for(let i=0;i<remains.length;i++){
   const c=remains[i];
   const overlapList=chosen.map(t=>c.numbers.filter(n=>t.numbers.includes(n)).length);
   if(overlapList.some(n=>n>overlap))continue;
   const maximum=Math.max(0,...overlapList);
   const overlapPenalty=.06*maximum+.015*overlapList.reduce((s,n)=>s+n,0);
   const sourceBonus=.005*Math.min(3,c.sources.length-1);
   const score=c.score-overlapPenalty+sourceBonus;
   if(score>bestScore){best=i;bestScore=score}
  }
  if(best<0)break;
  const picked=remains.splice(best,1)[0];
  chosen.push({...picked,choiceScore:bestScore});
 }
 return {
  target:record.target,origin:record.origin||"unknown",
  requested,actualCount:chosen.length,totalColumns:record.selected.reduce((n,x)=>n+(x.tickets?.length||0),0),
  uniqueCandidates:ranked.length,maxOverlap:overlap,
  columns:chosen,method:"historical-ticket-positions-v1",
  historicalDraws:history?.drawsChecked??0,
  note:"Kaydedilmiş kuponlar arasından geriye dönük gerçek kolon testi ve tekrar azaltma ölçütleriyle seçildi. Gelecek isabeti garanti etmez. Gerçekte satın alınmadı."
 };
}

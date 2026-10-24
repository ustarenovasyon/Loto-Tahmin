// SISTEM KOSESI V1 — pure deterministic research engine; no fabricated results.
// Predictions for draw T use only draw ids < T. Results are compared afterward.
import {MODULES,CLUB,buildContext,analyze,sortedUnique} from "./analysis-engine.mjs";
import {runStrategy} from "./engine.mjs";

export const SYSTEM_VERSION="1.0.0";
export const MATH_RECIPES=[
 ["divide2","/2 zinciri",{mode:"divide",divisor:"2",count:9}],
 ["divide3","/3 zinciri",{mode:"divide",divisor:"3",count:8}],
 ["multiply90","/90 sonra ×2",{mode:"multiply",seedDivisor:"90",factor:"2",count:7}],
 ["multiply100","/100 sonra ×2",{mode:"multiply",seedDivisor:"100",factor:"2",count:7}],
 ["multiply36","/36 sonra ×18",{mode:"multiply",seedDivisor:"36",factor:"18",count:6}],
 ["subtract100","100'er geri",{mode:"subtract",amount:"100",count:9}],
 ["subtract10","10'ar geri",{mode:"subtract",amount:"10",count:20}],
 ["subtract12","12'şer geri",{mode:"subtract",amount:"12",count:20}],
 ["subtract18","18'er geri",{mode:"subtract",amount:"18",count:20}],
 ["subtract25","25'er geri",{mode:"subtract",amount:"25",count:20}],
 ["subtract30","30'ar geri",{mode:"subtract",amount:"30",count:20}],
 ["subtract35","35'er geri",{mode:"subtract",amount:"35",count:20}],
 ["subtract50","50'şer geri",{mode:"subtract",amount:"50",count:20}]
].map(([id,name,config])=>({id:"math-"+id,name:"Matematik · "+name,config}));

const preferredModules=MODULES.map(m=>m.id);
export function catalog(){
 const sources=[
  ...MODULES.map(m=>({id:"an-"+m.id,name:m.name,kind:"analysis",module:m.id})),
  ...MATH_RECIPES.map(r=>({id:r.id,name:r.name,kind:"math",config:r.config}))
 ];
 const specs=[
  ...sources.map(s=>({...s,kind:"single",source:s,description:"Tek yöntem",group:s.id.startsWith("an-")?"Analiz":"Matematik"})),
  ...MODULES.map(m=>({id:"wide-"+m.id,name:m.name+" · 30 sayı",kind:"wide",sourceId:"an-"+m.id,group:"Geniş analiz",description:"30 aday"})),
  ...CLUB.map(c=>({id:"club-"+c.id,name:"Kulüp · "+c.name,kind:"club",modules:[...c.modules],group:"Kulüp",description:"Modül uzlaşısı"}))
 ];
 for(let i=0;i<sources.length;i++)for(let j=i+1;j<sources.length;j++){
  const a=sources[i],b=sources[j];
  specs.push({id:"common-"+a.id+"-"+b.id,name:a.name+" ∩ "+b.name,
   kind:"intersection",left:a.id,right:b.id,group:"Ortak havuz",
   description:"İki bağımsız havuzun kesişimi"});
 }
 return {sources,specs};
}
const {sources:SOURCE_CATALOG,specs:SPEC_CATALOG}=catalog();
export const SYSTEM_COUNT=SPEC_CATALOG.length;
export function sourcePools(draws,target,{window=100}={}){
 const ctx=buildContext(draws,target,window);
 const analyses=new Map(MODULES.map(m=>[m.id,analyze(ctx,m.id,30)]));
 const pools=new Map();
 for(const s of SOURCE_CATALOG){
  if(s.kind==="analysis")pools.set(s.id,sortedUnique(analyses.get(s.module).ranked.slice(0,18)));
  else pools.set(s.id,runStrategy(s.config,draws,target).pool.filter(n=>Number.isInteger(n)&&n>=1&&n<=60));
 }
 const large=new Map(MODULES.map(m=>["an-"+m.id,sortedUnique(analyses.get(m.id).ranked.slice(0,30))]));
 return {ctx,analyses,pools,large};
}
export function buildPools(draws,target,options={}){
 const state=sourcePools(draws,target,options),{analyses,pools,large}=state;
 const out=new Map();
 for(const spec of SPEC_CATALOG){
  let pool=[];
  if(spec.kind==="single")pool=pools.get(spec.source.id);
  if(spec.kind==="wide")pool=large.get(spec.sourceId);
  if(spec.kind==="intersection"){
   // Two analysis strategies each use 30 candidates. Math strategies use their native pools.
   const a=large.get(spec.left)||pools.get(spec.left)||[];
   const b=new Set(large.get(spec.right)||pools.get(spec.right)||[]);
   pool=a.filter(n=>b.has(n));
  }
  if(spec.kind==="club"){
   const rank=new Map();
   for(let n=1;n<=60;n++){
    let sum=0;
    for(const id of spec.modules)sum+=60-analyses.get(id).ranked.indexOf(n);
    rank.set(n,sum/spec.modules.length);
   }
   pool=[...rank].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,24).map(x=>x[0]);
  }
  out.set(spec.id,sortedUnique(pool));
 }
 return {...state,all:out};
}
export function countHits(pool,actual){
 const set=new Set(actual);
 return pool.reduce((n,ball)=>n+Number(set.has(ball)),0);
}
export function backtest(draws,{target,period=20,window=100}={}){
 const latest=Math.max(...draws.keys());
 target=Number(target??latest+1);
 if(!Number.isInteger(target)||target<2||target>latest+1)throw Error("Hedef çekiliş arşiv sınırının dışında.");
 period=Math.floor(Number(period));
 if(!Number.isInteger(period)||period<5||period>100)throw Error("Geçmiş test 5–100 çekiliş olmalı.");
 const historical=[...draws.keys()].filter(id=>id<target&&id>=Math.max(31,target-period))
  .sort((a,b)=>a-b);
 const totals=new Map(SPEC_CATALOG.map(s=>[s.id,{
  id:s.id,name:s.name,kind:s.group,tries:0,hits:0,expected:0,poolTotal:0,
  threePlus:0,allSix:0,best:0,draws:[],eligible:0
 }]));
 for(const id of historical){
  const actual=draws.get(id).numbers;
  const {all}=buildPools(draws,id,{window});
  for(const [specId,pool] of all){
   const stat=totals.get(specId);
   if(pool.length<6){stat.draws.push({id,poolSize:pool.length,valid:false});continue}
   const hit=countHits(pool,actual);
   stat.tries++;stat.eligible++;stat.hits+=hit;stat.poolTotal+=pool.length;
   stat.expected+=6*pool.length/60;stat.threePlus+=Number(hit>=3);stat.allSix+=Number(hit===6);
   stat.best=Math.max(stat.best,hit);
   stat.draws.push({id,poolSize:pool.length,hits:hit,valid:true});
  }
 }
 const rows=[...totals.values()].map(s=>{
  const avg=s.tries?s.hits/s.tries:0;
  const expected=s.tries?s.expected/s.tries:0;
  const excess=avg-expected;
  const avgPool=s.tries?s.poolTotal/s.tries:0;
  // Exploratory ranking with coverage penalty for strategies rarely yielding >=6.
  const coverage=historical.length?s.tries/historical.length:0;
  return {...s,average:avg,expectedAverage:expected,excess,
   averagePool:avgPool,coverage,
   score:excess*coverage*Math.sqrt(Math.min(s.tries,20)/20)};
 }).sort((a,b)=>b.score-a.score||b.average-a.average||a.id.localeCompare(b.id));
 return {target,period,window,totalRuns:historical.length,rows,archiveLast:latest};
}
function mulberry(seed){
 let a=(seed>>>0)||1;
 return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
}
function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
export function virtualCoupons(pool,{count=5,seed=1,weights=null,existing=[]}={}){
 const allowed=sortedUnique(pool);count=Math.max(1,Math.min(30,Math.floor(Number(count)||5)));
 if(allowed.length<6)return [];
 const rng=mulberry(seed);
 const used=new Set(existing.map(x=>sortedUnique(x).join(","))),list=[];
 // Fixed seeded search: no actual target result or future numbers are consulted.
 for(let i=0;i<count;i++){
  let best=null,bestScore=-Infinity;
  for(let attempt=0;attempt<100;attempt++){
   const choices=[...allowed],candidate=[];
   for(let j=0;j<6;j++){
    const w=choices.map(n=>Math.max(.05,weights?.[n]??1));
    let n=rng()*w.reduce((a,b)=>a+b,0),index=choices.length-1;
    for(let k=0;k<w.length;k++){n-=w[k];if(n<=0){index=k;break}}
    candidate.push(choices.splice(index,1)[0]);
   }
   candidate.sort((a,b)=>a-b);
   const k=candidate.join(",");
   if(used.has(k))continue;
   const odd=candidate.filter(n=>n%2).length;
   const tens=new Set(candidate.map(n=>Math.floor((n-1)/10))).size;
   const maxOverlap=list.reduce((v,x)=>Math.max(v,candidate.filter(n=>x.includes(n)).length),0);
   const score=1.6-Math.abs(odd-3)*.17+Math.min(4,tens)*.07-maxOverlap*.18+rng()*.12;
   if(score>bestScore){bestScore=score;best=candidate}
  }
  if(!best)break;
  used.add(best.join(","));list.push(best);
 }
 return list;
}
export function forecast(draws,{target,period=20,window=100,systems=10,coupons=5}={}){
 const latest=Math.max(...draws.keys());
 target=Number(target??latest+1);
 const historical=backtest(draws,{target,period,window});
 const {all,analyses}=buildPools(draws,target,{window});
 systems=Math.max(1,Math.min(30,Math.floor(Number(systems)||10)));
 const selected=historical.rows.filter(row=>all.get(row.id).length>=6&&row.coverage>=.75)
  .slice(0,systems).map(row=>{
   const pool=all.get(row.id);
   const spec=SPEC_CATALOG.find(x=>x.id===row.id);
   const weighted=Object.create(null);
   if(spec.kind==="single"&&spec.source.kind==="analysis"){
    for(const n of pool)weighted[n]=.5+analyses.get(spec.source.module).scores[n];
   }
   const tickets=virtualCoupons(pool,{count:coupons,seed:(target*1013+hash(row.id))>>>0,weights:weighted});
   return {id:row.id,name:row.name,group:row.kind,pool,tickets,
    test:{tries:row.tries,average:row.average,expected:row.expectedAverage,excess:row.excess,
     averagePool:row.averagePool,threePlus:row.threePlus,allSix:row.allSix}};
  });
 return {version:SYSTEM_VERSION,target,archiveLast:latest,
  period,window,systems:selected.length,couponsPerSystem:coupons,
  origin:draws.has(target)?"retrospective":"pre_draw",
  source:"data/draws.txt",state:draws.has(target)?"historical":"pending",selected};
}
export function settleForecast(record,draws){
 if(!record||!Number.isInteger(record.target))throw Error("Geçersiz kayıt.");
 // Never present a reconstruction made after the draw as a pre-draw prediction.
 const actual=draws.get(record.target)?.numbers;
 if(record.state==="settled"&&actual&&
   JSON.stringify([...actual])!==JSON.stringify(record.actual))
   throw Error("Arşivdeki sonuç ve kilitli geçmiş kayıt uyuşmuyor; otomatik değiştirilmedi.");
 if(!actual)return {...record,state:"pending"};
 const archivedBefore=Number(String(record.sourceArchive||"").split(":")[1]);
 const inferredOrigin=Number.isInteger(archivedBefore)&&archivedBefore===record.target-1?"pre_draw":"retrospective";
 return {...record,state:"settled",origin:record.origin||inferredOrigin,actual:[...actual],
  selected:record.selected.map(row=>{
   const hits=row.pool.filter(n=>actual.includes(n));
   const ticketHits=row.tickets.map(ticket=>ticket.filter(n=>actual.includes(n)).length);
   return {...row,hits,ticketHits,bestTicket:Math.max(0,...ticketHits)};
  })};
}
export function archiveSignature(draws){
 const ids=[...draws.keys()].sort((a,b)=>a-b),last=draws.get(ids.at(-1));
 return String(ids.length)+":"+last.id+":"+last.date+":"+last.numbers.join("-");
}

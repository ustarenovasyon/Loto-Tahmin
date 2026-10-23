// KAZANANLAR KULÜBÜ — SAYI KARŞILAŞTIRMA
// Açık kaynak özgün sistemlerin çıktısı + kullanıcının kendisinin sağladığı dış kolonlar.
// Harici sitelerden otomatik çekim, kazıma veya özel formül taklidi YOK.
import {CLUB,sortedUnique} from "./analysis-engine.mjs";
import {generateCoupons} from "./coupon-engine.mjs";
import {buildContext} from "./analysis-engine.mjs";
const ALL=Array.from({length:60},(_,i)=>i+1);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const key=t=>t.join("-");
export function parseOwnPool(text){
 const nums=(String(text||"").match(/\d+/g)||[]).map(Number);
 if(nums.some(n=>!Number.isInteger(n)||n<1||n>60))throw Error("Havuzda yalnızca 1–60 arası sayılar olabilir.");
 return sortedUnique(nums);
}
export function parseExternalColumns(text,{maxRows=1200}={}){
 const lines=String(text||"").split(/\r?\n/),seen=new Set(),columns=[],errors=[];
 for(let lineNo=0;lineNo<lines.length;lineNo++){
  const line=lines[lineNo].trim();
  if(!line||line.startsWith("#")||line.startsWith("//"))continue;
  // Her satır altılı kolon veya kolonun önünde başlık/kimlik alanları olabilir.
  // Hücrelerin son 6 sayısını al; varsa kolon numarasını sayı sanma.
  const all=(line.match(/\b\d{1,7}\b/g)||[]).map(Number);
  if(all.length<6){errors.push(lineNo+1);continue}
  const six=all.slice(-6);
  if(six.some(n=>n<1||n>60)||sortedUnique(six).length!==6){
   errors.push(lineNo+1);continue;
  }
  // Sıralı altılılar aranır; girilen altılı kendi içinde sıralı değilse yine normalize edilir.
  const nums=sortedUnique(six),k=key(nums);
  if(!seen.has(k)){columns.push(nums);seen.add(k)}
  if(columns.length>maxRows)throw Error("Tek seferde en fazla "+maxRows+" kolon yüklenebilir.");
 }
 if(!columns.length)throw Error("Geçerli altılı kolon bulunamadı. Her satıra 6 sayı yaz.");
 return {columns,duplicates:lines.length-columns.length-errors.length,errors:errors.slice(0,25)};
}
export function localClubSources(draws,{target,window=100,perSystem=24,seed=419,teams=CLUB}={}){
 const ctx=buildContext(draws,Number(target),Number(window));
 const count=clamp(Number(perSystem)||24,1,100);
 const list=teams.map((team,i)=>{
  const tickets=generateCoupons({ctx,moduleIds:team.modules,count,limit:18,seed:Number(seed)+i*9929,seen:[]}).coupons;
  return {id:"local-"+team.id,name:team.name,kind:"local",target:ctx.target,
    columns:tickets,modules:team.modules};
 });
 return list;
}
export function compareClubSources(ownPool,sources,{topPerSystem=12,minSystems=2,method="top"}={}){
 const own=sortedUnique(ownPool);
 if(!own.length)throw Error("Önce kendi sayı havuzunu seç veya yaz.");
 const active=(sources||[]).filter(s=>Array.isArray(s.columns)&&s.columns.length);
 if(!active.length)throw Error("Karşılaştırmak için en az bir kulüp sistemi ekle.");
 const top=clamp(Number(topPerSystem)||12,1,60),minimum=clamp(Number(minSystems)||2,1,active.length);
 const each=active.map(source=>{
  const columns=source.columns.map(nums=>sortedUnique(nums)).filter(nums=>nums.length===6);
  const freq=Array(61).fill(0);
  columns.forEach(c=>c.forEach(n=>freq[n]++));
  const ranking=[...ALL].sort((a,b)=>freq[b]-freq[a]||a-b);
  const selected=method==="all"?ranking.filter(n=>freq[n]>0):ranking.filter(n=>freq[n]>0).slice(0,top);
  const selectedSet=new Set(selected),owner=own.filter(n=>selectedSet.has(n));
  const ownSet=new Set(own);
  const overlappingColumns=columns.map((numbers,index)=>{
    const matching=numbers.filter(n=>ownSet.has(n));
    return {numbers,matching,matched:matching.length,index:index+1};
  }).sort((a,b)=>b.matched-a.matched||a.index-b.index);
  const overlapDistribution=[0,0,0,0,0,0,0];
  overlappingColumns.forEach(row=>overlapDistribution[row.matched]++);
  return {...source,columns:columns.length,ranking:selected,rawRanking:ranking.filter(n=>freq[n]>0),
    selected:sortedUnique(selected),counts:freq,overlap:owner,overlapDistribution,
    topColumns:overlappingColumns.slice(0,12),bestOverlap:overlappingColumns[0]?.matched||0};
 });
 const votes=Array(61).fill(0),strength=Array(61).fill(0),byNumber=Array.from({length:61},()=>[]);
 for(const source of each){
  const selected=new Set(source.selected);
  for(const n of ALL){
   if(selected.has(n)){
    votes[n]++;byNumber[n].push(source.name);
    strength[n]+=source.counts[n]/Math.max(1,source.columns);
   }
  }
 }
 const candidateRows=own.map(n=>({number:n,support:votes[n],strength:strength[n],
   systems:byNumber[n]})).sort((a,b)=>b.support-a.support||b.strength-a.strength||a.number-b.number);
 const consensus=sortedUnique(candidateRows.filter(r=>r.support>=minimum).map(r=>r.number));
 const fullIntersection=sortedUnique(candidateRows.filter(r=>r.support===each.length).map(r=>r.number));
 const supported=sortedUnique(candidateRows.filter(r=>r.support>0).map(r=>r.number));
 const unsupported=own.filter(n=>votes[n]===0);
 const topNumbers=sortedUnique(candidateRows.slice(0,Math.min(own.length,12)).map(r=>r.number));
 return {own,sources:each,sourceCount:each.length,minSystems:minimum,topPerSystem:top,method,
   candidateRows,consensus,fullIntersection,supported,unsupported,topNumbers};
}
export function compareDrawsToPool(draws,target,pool){
 const result=draws.get(Number(target))?.numbers||[];
 return {actual:result,hits:sortedUnique(pool).filter(n=>result.includes(n)),hasResult:result.length===6};
}

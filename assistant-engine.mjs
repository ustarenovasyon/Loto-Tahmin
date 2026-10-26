import {MODULES,buildContext,analyze,sortedUnique} from './analysis-engine.mjs';
import {generateCoupons} from './coupon-engine.mjs';
export const ALL_MODULES=MODULES.map(m=>m.id);
export const normalize=s=>String(s).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
const WORDS={bir:1,iki:2,uc:3,dort:4,bes:5,alti:6,yedi:7,sekiz:8,dokuz:9,on:10,yirmi:20,otuz:30,kirk:40,elli:50};
export function interpretLocal(message,previous={}){
 let s=normalize(message).replace(/\b(bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on|yirmi|otuz|kirk|elli)\b/g,w=>WORDS[w]);
 const coupons=s.match(/(\d+)\s*(?:tane\s*|adet\s*)?(?:kolon|kupon)/);
 const pool=s.match(/(\d+)\s*(?:tane\s*|adet\s*)?(?:sayi|rakam)/)||s.match(/en iyi\s*(\d+)(?!\d)(?!\s*(?:tane\s*|adet\s*)?(?:kolon|kupon))/);
 const target=s.match(/#\s*(\d+)|\b(\d{3,5})\s*\.?\s*(?:cekilis|icin)/);
 const recent=s.match(/son\s+(\d+)\s*cekilis[^.]*?(?:cikar|ele|haric)/);
 const window=s.match(/son\s+(\d+)\s*cekilis/);
 const manual=s.match(/(?:su sayilari|bu sayilari|sayilari)\s*[:=]\s*([\d\s,;-]+)/);
 const aliases={hot:/en cok|cok cikan/,cold:/en az|az cikan/,overdue:/uzun.*gelmeyen/,near:/yakin gelen/,dna:/dna/,matrix:/matriks/,pairs:/ikili/,triples:/uclu/,trend:/trend/};
 const ids=Object.entries(aliases).filter(([,rx])=>rx.test(s)).map(([id])=>id);
 if(!coupons&&!pool&&!/analiz|havuz|sayi|rakam/.test(s))return {action:'clarify',message:'Örneğin “Önümüzdeki çekiliş için 20 sayı bul” veya “Bunlardan 5 kolon oluştur” yazabilirsin. Yerel mod yalnızca desteklenen analiz komutlarını anlar.'};
 const intent={action:coupons?(pool?'both':'coupons'):'analyze',poolSize:pool?Number(pool[1]):previous.poolSize??20,couponCount:coupons?Number(coupons[1]):0,target:target?Number(target[1]||target[2]):null,window:window&&!recent?Number(window[1]):previous.window??100,excludeRecent:recent?Number(recent[1]):0,excludeNumbers:manual?sortedUnique(manual[1].match(/\d+/g).map(Number)):[],modules:ids.length?ids:ALL_MODULES,usePrevious:!!coupons&&!pool&&!recent&&!manual&&!ids.length&&!window&&!!previous.poolSize};
 return intent;
}
export function validateIntent(input,draws){
 const latest=Math.max(...draws.keys()),p={...input};
 if(!['analyze','coupons','both'].includes(p.action))throw Error('Desteklenmeyen işlem. Sayı analizi veya kolon oluşturma iste.');
 p.target=p.target??latest+1;p.poolSize=p.poolSize??20;p.couponCount=p.couponCount??0;p.window=p.window??100;p.excludeRecent=p.excludeRecent??0;
 for(const [key,min,max]of [['target',31,latest+1],['poolSize',6,60],['couponCount',0,30],['window',20,Math.min(975,latest)],['excludeRecent',0,100]])if(!Number.isInteger(p[key])||p[key]<min||p[key]>max)throw Error(`${key}: ${min}–${max} arasında tam sayı gerekiyor.`);
 if(p.action!=='analyze'&&p.couponCount<1)throw Error('Kaç kolon istediğini yaz: örneğin 5 kolon.');
 if(!Array.isArray(p.modules)||!p.modules.length)p.modules=ALL_MODULES;
 if(p.modules.some(id=>!ALL_MODULES.includes(id)))throw Error('Tanınmayan analiz modülü.');
 p.modules=[...new Set(p.modules)];p.excludeNumbers=sortedUnique(p.excludeNumbers??[]);return p;
}
function combine(results,weights,excluded,limit){
 const scores=Array(61).fill(0);let total=0;
 for(const r of results){const w=weights[r.id]??1;total+=w;for(let n=1;n<=60;n++)scores[n]+=w*(60-r.ranked.indexOf(n))/60;}
 const ranked=Array.from({length:60},(_,i)=>i+1).filter(n=>!excluded.has(n)).sort((a,b)=>scores[b]-scores[a]||a-b);
 if(ranked.length<limit)throw Error(`Elemelerden sonra ${ranked.length} sayı var; ${limit} sayı seçilemiyor. Havuzu küçült veya elemeyi azalt.`);
 return {pool:ranked.slice(0,limit).sort((a,b)=>a-b),ranked:ranked.map(n=>({number:n,score:Math.round(scores[n]/total*1000)/10,support:results.filter(r=>r.selected.includes(n)).length}))};
}
export async function research(draws,rawIntent,progress=()=>{}){
 const p=validateIntent(rawIntent,draws),history=[...draws.values()].filter(d=>d.id<p.target).sort((a,b)=>a.id-b.id);
 if(history.length<30)throw Error('Analiz için en az 30 geçmiş çekiliş gerekli.');
 const excluded=new Set(p.excludeNumbers);history.slice(-p.excludeRecent||history.length).forEach(d=>{if(p.excludeRecent)d.numbers.forEach(n=>excluded.add(n));});
 const samples=history.slice(-24),training=samples.slice(0,12),validation=samples.slice(12),weights=Object.fromEntries(p.modules.map(id=>[id,1]));
 const totals=Object.fromEntries(p.modules.map(id=>[id,0]));
 for(let i=0;i<training.length;i++){
  const d=training[i],ctx=buildContext(draws,d.id,p.window);
  for(const id of p.modules){const r=analyze(ctx,id,p.poolSize);totals[id]+=r.selected.filter(n=>d.numbers.includes(n)).length;}
  progress(`Geçmiş analiz ölçümü ${i+1}/${training.length}`);
 }
 const expected=p.poolSize/10;
 for(const id of p.modules)weights[id]=Math.max(.6,Math.min(1.4,(totals[id]+training.length*expected)/(2*training.length*expected)));
 const validationRows=[];
 for(const d of validation){
  const ctx=buildContext(draws,d.id,p.window),results=p.modules.map(id=>analyze(ctx,id,p.poolSize));
  // At each historical target only its own earlier draws are used.
  const past=history.filter(x=>x.id<d.id),blocked=new Set(p.excludeNumbers);if(p.excludeRecent)past.slice(-p.excludeRecent).forEach(x=>x.numbers.forEach(n=>blocked.add(n)));
  const pick=combine(results,weights,blocked,p.poolSize);validationRows.push({target:d.id,pool:pick.pool,hits:pick.pool.filter(n=>d.numbers.includes(n)).length});
 }
 progress('20 / 50 / seçilen dönem analizleri birleştiriliyor');
 const windows=[...new Set([20,50,p.window].filter(w=>w<=p.window))],results=[];
 for(const window of windows){const ctx=buildContext(draws,p.target,window);for(const id of p.modules)results.push({...analyze(ctx,id,p.poolSize),window});}
 const ranking=combine(results,weights,excluded,p.poolSize);
 return {...ranking,target:p.target,sourceLast:history.at(-1).id,sourceDate:history.at(-1).date,archiveLatest:Math.max(...draws.keys()),poolSize:p.poolSize,window:p.window,modules:p.modules,windows,weights,trainingTargets:training.map(d=>d.id),validationRows,baseline:expected,validationAverage:validationRows.reduce((s,r)=>s+r.hits,0)/validationRows.length,excluded:[...excluded].sort((a,b)=>a-b),created:new Date().toISOString()};
}
export function makeColumns(draws,report,count){
 if(!Number.isInteger(count)||count<1||count>30)throw Error('Kolon adedi 1–30 arasında olmalı.');
 let combinations=1;for(let i=0;i<6;i++)combinations=combinations*(report.pool.length-i)/(i+1);
 if(count>Math.round(combinations))throw Error('Bu havuzdan istenen sayıda farklı altılı üretilemiyor.');
 const ctx=buildContext(draws,report.target,report.window);
 const output=generateCoupons({ctx,moduleIds:report.modules,count,limit:report.pool.length,manualPool:report.pool,strict:true});
 if(output.coupons.length!==count)throw Error(`${output.coupons.length} farklı kolon üretildi; sayıyı azaltıp tekrar dene.`);
 return output.coupons;
}

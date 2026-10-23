// Loto Tahmin · Özgün analiz motoru; geçmiş sonuçlardan yeniden üretilebilir.
// LotoTürkiye'deki yayımlanmış analiz kavramları incelenmiştir; gizli formüller kullanılmaz.
export const MODULES=[
 ["hot","En Çok Çıkanlar","Frekans","Seçilen geçmiş aralıkta en sık çıkan sayılar"],
 ["cold","En Az Çıkanlar","Frekans","Seçilen geçmiş aralıkta en seyrek çıkan sayılar"],
 ["near","Yakın Gelenler","Süre","En son çekilişlerde görülen sayılar"],
 ["overdue","Uzun Gelmeyenler","Süre","En uzun süredir çıkmayan sayılar"],
 ["dna","DNA · Dönemler","Analiz","Dönemsel frekans: yakın ve önceki dilimlerin farkı"],
 ["limit","Limit · Bekleme","Analiz","Sayı bazında bekleme aralıkları ve geçmiş aralık oranı"],
 ["scope","Scope · Adet/Süre","Analiz","Çok/Az ve Yakın/Uzun kırılımı"],
 ["matrix","Matriks · 4 Grup","Analiz","Dört sınıflı matriksin tarihsel dağılımıyla karşılaştırma"],
 ["radar","Radar · Harita","Analiz","Frekans ile bekleme süresini birlikte gösteren değerlendirme"],
 ["queue","Queue · Ritim","Analiz","Geçmiş tekrar aralıklarının düzenliliği"],
 ["trend","Trend · Hareket","Analiz","Son dilim ile önceki dilimin çıkış hızı"],
 ["repeat","Tekrar / RPT","Analiz","Önceki çekilişte görülen ve dönemsel tekrar yapan sayılar"],
 ["pairs","İkili Gruplar","Gruplar","Geçmişte beraber çıkan ikililer üzerinden ortaklık"],
 ["triples","Üçlü Gruplar","Gruplar","Sık tekrarlayan üçlü ilişkileri"],
 ["follow","Takip Edenler","Gruplar","Son çekilişteki sayılardan sonra geçmişte gelen sayılar"],
 ["ordered","Sıralı Pozisyonlar","Sıralı","Küçükten büyüğe sıralanmış 6 topun konum dağılımları"],
 ["range","Sıralı Aralıklar","Sıralı","Birbirini izleyen sıralı topların aralıkları"],
 ["sum","Toplamlar","Sıralı","Geçmiş altılı toplamlarının dağılımı"],
 ["parity","Tek / Çift","Sıralı","Geçmişteki tek ve çift sayı dengesi"],
 ["decades","Onlu Gruplar","Sıralı","1–10, 11–20 vb. altı onlu grup dağılımı"],
 ["finaldigit","Son Haneler","Sıralı","Son basamakların çekilişlerde görülme dağılımı"],
 ["prime","Asal Sayılar","Sıralı","Asal sayı içeren altılıların istatistiği"],
 ["consecutive","Ardışık Sayılar","Sıralı","Altılılarda bitişik sayı çifti analizi"],
 ["firstlast","İlk / Son","Sıralı","Altılıdaki en küçük ve en büyük sayı dağılımları"],
 ["eight","Son 8 Çekiliş","Kısa dönem","Son sekiz çekilişteki hareketleri inceler"],
 ["grid","GRID · Onlu Harita","Analiz","Onlu sıra ve son hane üzerinden sayı yoğunluk haritası"],
 ["list","LOTO List · Sıra","Analiz","Toplam sıklık, son dönem sıklık ve gecikme karşılaştırmalı listesi"],
 ["quartets","Dörtlü Gruplar","Gruplar","Birlikte görülen dörtlülerin geçmiş tekrar adedi"],
 ["quintets","Beşli Gruplar","Gruplar","Beşli eşleşmelerin frekans ve benzerlik incelemesi"],
 ["spread","Seri Büyüklüğü","Sıralı","Sıralı altılılarda ilk ve son sayı arasındaki açıklık"],
 ["streak","Üst Üste Gelme","Kısa dönem","Aynı sayının arka arkaya çekilişlerde görülme adedi"]
].map(([id,name,category,description])=>({id,name,category,description}));

export const CLUB=[
 {id:"denge",name:"Denge 01",modules:["hot","dna","parity","decades"]},
 {id:"sure",name:"Süre 02",modules:["overdue","limit","queue","radar"]},
 {id:"matriks",name:"Matriks 03",modules:["scope","matrix","trend","hot"]},
 {id:"seri",name:"Seri 04",modules:["ordered","range","sum","firstlast"]},
 {id:"grup",name:"Grup 05",modules:["pairs","triples","follow","repeat"]},
 {id:"karma",name:"Karma 06",modules:["dna","matrix","pairs","decades","limit"]}
];
const ALL=Array.from({length:60},(_,i)=>i+1);
export const sortedUnique=x=>[...new Set(x)].filter(n=>Number.isInteger(n)&&n>=1&&n<=60).sort((a,b)=>a-b);
const sum=a=>a.reduce((x,y)=>x+y,0);
const avg=a=>a.length?sum(a)/a.length:0;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const norm=(x,min,max)=>max>min?(x-min)/(max-min):0.5;
function topScore(raw){
 const arr=ALL.map(n=>Number.isFinite(raw[n])?raw[n]:0);
 const min=Math.min(...arr),max=Math.max(...arr);
 return Object.fromEntries(ALL.map((n,i)=>[n,norm(arr[i],min,max)]));
}
function mode(arr){const counter=new Map();arr.forEach(x=>counter.set(x,(counter.get(x)||0)+1));return [...counter].sort((a,b)=>b[1]-a[1]||Number(a[0])-Number(b[0]))[0]?.[0]}
function quantile(a,q){if(!a.length)return 0;const s=[...a].sort((a,b)=>a-b),i=Math.floor((s.length-1)*q);return s[i]}
export function buildContext(draws,target,window=100){
 target=Number(target);window=Number(window);
 const max=Math.max(...draws.keys());
 if(!Number.isSafeInteger(target)||target<2||target>max+1)throw Error("Hedef 2 ile son çekilişin bir fazlası arasında olmalı.");
 if(!Number.isInteger(window)||window<5||window>975)throw Error("Geçmiş aralığı 5–975 olmalı.");
 const available=[...draws.values()].filter(d=>d.id<target).sort((a,b)=>a.id-b.id);
 if(!available.length)throw Error("Hedef öncesinde çekiliş bulunamadı.");
 const recent=available.slice(-window),last=available.at(-1);
 const byN=Object.fromEntries(ALL.map(n=>[n,[]]));
 available.forEach(d=>d.numbers.forEach(n=>byN[n].push(d.id)));
 const freq=Array(61).fill(0),global=Array(61).fill(0),delay=Array(61).fill(0);
 recent.forEach(d=>d.numbers.forEach(n=>freq[n]++));
 available.forEach(d=>d.numbers.forEach(n=>global[n]++));
 ALL.forEach(n=>delay[n]=target-1-(byN[n].at(-1)||0));
 const expected=(available.length)/10;
 const matrix=Object.fromEntries(ALL.map(n=>[n,(global[n]>expected?0:2)+(delay[n]<=10?0:1)]));
 const sums=recent.map(d=>sum(d.numbers)),parities=recent.map(d=>d.numbers.filter(n=>n%2).length);
 return {draws,target,max,window,all:available,recent,last,byN,freq,global,delay,expected,matrix,sums,parities};
}
export function statsForNumber(ctx,n){
 const ids=ctx.byN[n],intervals=ids.slice(1).map((id,i)=>id-ids[i]-1),f=ctx.freq[n];
 return {n,count:ctx.global[n],recent:f,delay:ctx.delay[n],gapAverage:avg(intervals),gapMax:Math.max(0,...intervals),times:ids.length,matrix:ctx.matrix[n],intervals};
}
export function analyze(ctx,id,limit=18){
 const scores=Array(61).fill(0),recent=ctx.recent,all=ctx.all,window=recent.length,prev=ctx.last.numbers;
 const f=ctx.freq,d=ctx.delay;
 const short=recent.slice(-Math.min(20,window)),previous=recent.slice(-Math.min(40,window),-Math.min(20,window));
 const fShort=Array(61).fill(0),fPrevious=Array(61).fill(0);
 short.forEach(draw=>draw.numbers.forEach(n=>fShort[n]++));
 previous.forEach(draw=>draw.numbers.forEach(n=>fPrevious[n]++));
 const groupSizes=[0,0,0,0],matrixPattern=[];
 if(id==="matrix"||id==="scope"){
   const categories=Object.keys(ctx.matrix);
   for(const n of categories)groupSizes[ctx.matrix[n]]++;
   for(const draw of recent){
     const cat=[0,0,0,0];
     // Geçmişte sınıflar 'o güne kadar' verisiyle yeniden kurulur (tarihsel bilgi sızmaz).
     const past=all.filter(z=>z.id<draw.id);
     const lastDates=Array(61).fill(0),counts=Array(61).fill(0);
     past.forEach(p=>p.numbers.forEach(n=>{counts[n]++;lastDates[n]=p.id}));
     const threshold=past.length/10;
     draw.numbers.forEach(n=>cat[(counts[n]>threshold?0:2)+(draw.id-1-(lastDates[n]||0)<=10?0:1)]++);
     matrixPattern.push(cat.join("-"));
   }
 }
 const popular=mode(matrixPattern),bestGroup=popular?String(popular).split("-").map(Number):[2,1,2,1];
 const pairCounts=new Map(),tripleCounts=new Map(),followers=Array(61).fill(0);
 if(["pairs","triples","follow","quartets","quintets"].includes(id)){
   for(let i=0;i<recent.length;i++){
     const nums=recent[i].numbers;
     for(let a=0;a<6;a++)for(let b=a+1;b<6;b++){
       const key=nums[a]+"-"+nums[b];pairCounts.set(key,(pairCounts.get(key)||0)+1);
       if(id==="triples")for(let c=b+1;c<6;c++){const key3=key+"-"+nums[c];tripleCounts.set(key3,(tripleCounts.get(key3)||0)+1)}
     }
   }
   if(id==="follow"){
     const lastSet=new Set(prev);
     for(let i=0;i<all.length-1;i++){
       if(all[i].numbers.some(n=>lastSet.has(n)))all[i+1].numbers.forEach(n=>followers[n]++);
     }
   }
 }
 const groupCounts=new Map();
 if(id==="quartets"||id==="quintets"){
  const required=id==="quartets"?4:5;
  for(const draw of recent){
   const rec=(base,start)=>{
    if(base.length===required){const key=base.join("-");groupCounts.set(key,(groupCounts.get(key)||0)+1);return}
    for(let i=start;i<draw.numbers.length;i++)rec([...base,draw.numbers[i]],i+1);
   };
   rec([],0);
  }
 }
 const historySpread=quantile(recent.map(row=>row.numbers[5]-row.numbers[0]),.5);
 const digitCounts=Array(10).fill(0),decadeCounts=Array(6).fill(0);
 recent.forEach(row=>row.numbers.forEach(x=>{digitCounts[x%10]++;decadeCounts[Math.floor((x-1)/10)]++}));
 const streakCounts=Array(61).fill(0);
 for(let i=1;i<recent.length;i++)for(const number of recent[i].numbers)if(recent[i-1].numbers.includes(number))streakCounts[number]++;
 const modalOdd=Number(mode(ctx.parities)??3),medianSum=quantile(ctx.sums,.5);
 const lows=recent.map(x=>x.numbers[0]),highs=recent.map(x=>x.numbers[5]);
 const centers=ALL.map(n=>avg(recent.map(x=>x.numbers.some(y=>Math.abs(y-n)<=2)?1:0)));
 const mostFrequent=Object.fromEntries(ALL.map(n=>[n,ctx.global[n]]));
 for(const n of ALL){
   const ages=ctx.byN[n],intervals=ages.slice(1).map((x,i)=>x-ages[i]-1),intervalMean=avg(intervals),intervalSd=Math.sqrt(avg(intervals.map(g=>(g-intervalMean)**2)));
   const speed=fShort[n]/Math.max(1,short.length)-fPrevious[n]/Math.max(1,previous.length);
   const recentNear=clamp(1-d[n]/Math.max(1,Math.min(ctx.window,20)));
   const veryOld=clamp(d[n]/35);
   const lastIncluded=prev.includes(n)?1:0;
   switch(id){
   case "hot":scores[n]=f[n];break;
   case "cold":scores[n]=-f[n];break;
   case "near":scores[n]=recentNear;break;
   case "overdue":scores[n]=d[n];break;
   case "dna":scores[n]=speed*30+fShort[n]*.18;break;
   case "limit":scores[n]=intervalMean>0?clamp(d[n]/(intervalMean+1),0,5):clamp(d[n]/10,0,5);break;
   case "scope":scores[n]=(ctx.matrix[n]===0?1:ctx.matrix[n]===2?.85:ctx.matrix[n]===3?.65:.8)+f[n]*.006;break;
   case "matrix":scores[n]=(bestGroup[ctx.matrix[n]]||0)/(groupSizes[ctx.matrix[n]]||1)+f[n]*.001;break;
   case "radar":scores[n]=f[n]/Math.max(1,window)*30+d[n]/Math.max(10,ctx.window);break;
   case "queue":scores[n]=intervalMean?clamp(1-(intervalSd/(intervalMean+1)),0,1)+(1-Math.min(1,Math.abs(d[n]-intervalMean)/(intervalMean+1))):0;break;
   case "trend":scores[n]=speed;break;
   case "repeat":scores[n]=lastIncluded?1+fShort[n]*.05:fShort[n]*.02;break;
   case "pairs":scores[n]=sum(prev.filter(x=>x!==n).map(x=>pairCounts.get([x,n].sort((a,b)=>a-b).join("-"))||0))+f[n]*.05;break;
   case "triples":scores[n]=sum([...tripleCounts].filter(([key])=>key.split("-").map(Number).includes(n)).map(([,v])=>Math.max(0,v-1)))+f[n]*.05;break;
   case "follow":scores[n]=followers[n]+f[n]*.001;break;
   case "ordered":scores[n]=sum(Array.from({length:6},(_,p)=>recent.filter(row=>Math.abs(row.numbers[p]-n)<=2).length));break;
   case "range":scores[n]=centers[n-1]+(n>1?centers[n-2]:0);break;
   case "sum":scores[n]=1-Math.min(1,Math.abs(n-medianSum/6)/32);break;
   case "parity":scores[n]=((n%2)=== (modalOdd>=3?1:0)?1:0)+f[n]*.002;break;
   case "decades":scores[n]=recent.filter(row=>row.numbers.some(x=>Math.floor((x-1)/10)===Math.floor((n-1)/10))).length;break;
   case "finaldigit":scores[n]=sum(recent.map(row=>row.numbers.filter(x=>x%10===n%10).length));break;
   case "prime":scores[n]=isPrime(n)?1+f[n]*.001:f[n]*.001;break;
   case "consecutive":scores[n]=sum(recent.map(row=>row.numbers.includes(n-1)||row.numbers.includes(n+1)?1:0));break;
   case "firstlast":scores[n]=recent.filter(row=>Math.abs(row.numbers[0]-n)<=3||Math.abs(row.numbers[5]-n)<=3).length;break;
   case "eight":scores[n]=recent.slice(-8).filter(row=>row.numbers.includes(n)).length;break;
   case "grid":scores[n]=digitCounts[n%10]*.65+decadeCounts[Math.floor((n-1)/10)]*.35;break;
   case "list":scores[n]=ctx.global[n]/Math.max(1,ctx.all.length)*20+f[n]/Math.max(1,window)*35-.015*d[n];break;
   case "quartets":case "quintets":
     scores[n]=sum([...groupCounts].filter(([key])=>key.split("-").map(Number).includes(n)).map(([,v])=>v*v))+
       f[n]*.002;break;
   case "spread":scores[n]=1-Math.min(1,Math.abs(n-(60-historySpread)/2)/30);break;
   case "streak":scores[n]=streakCounts[n]+fShort[n]*.01;break;
   default:throw Error("Tanınmayan analiz: "+id);
   }
 }
 const normalized=topScore(scores);
 const ranked=[...ALL].sort((a,b)=>normalized[b]-normalized[a]||a-b);
 const selected=ranked.slice(0,Math.max(6,Math.min(60,Number(limit)||18))).sort((a,b)=>a-b);
 return {id,name:MODULES.find(m=>m.id===id)?.name||id,target:ctx.target,window:ctx.window,
   selected,ranked,scores:normalized,raw:Object.fromEntries(ALL.map(n=>[n,scores[n]])),
   details:{medianSum,modalOdd,bestMatrixPattern:bestGroup.join("-"),matrixGroups:groupSizes,
     numberRecords:selected.map(n=>statsForNumber(ctx,n))}};
}
function isPrime(n){if(n<2)return false;for(let x=2;x*x<=n;x++)if(n%x===0)return false;return true}
export function ticketMetrics(ticket){
 const s=sortedUnique(ticket),ten=Array(6).fill(0);s.forEach(n=>ten[Math.floor((n-1)/10)]++);
 return {total:sum(s),odd:s.filter(n=>n%2).length,even:s.filter(n=>!(n%2)).length,
  consecutive:s.slice(1).filter((n,i)=>n-s[i]===1).length,prime:s.filter(isPrime).length,
  decades:ten,spread:s.length?s.at(-1)-s[0]:0,uniqueLastDigits:new Set(s.map(n=>n%10)).size};
}
export function ticketPass(ctx,ticket,modules){
 const m=ticketMetrics(ticket),hist=ctx.recent,active=new Set(modules);
 if(active.has("sum")&&(m.total<quantile(ctx.sums,.15)||m.total>quantile(ctx.sums,.85)))return false;
 if(active.has("parity")&&Math.abs(m.odd-Number(mode(ctx.parities)??3))>1)return false;
 if(active.has("consecutive")){
   const pairs=hist.map(d=>ticketMetrics(d.numbers).consecutive);
   if(m.consecutive>Math.max(1,quantile(pairs,.9)))return false;
 }
 if(active.has("decades")&&(m.decades.filter(x=>x>0).length<3))return false;
 if(active.has("matrix")){
   const groups=[0,0,0,0];ticket.forEach(n=>groups[ctx.matrix[n]]++);
   const expect=[2,1,2,1]; // açık varsayılan; çekilişin dağılımı asla bilinmez
   if(groups.reduce((s,v,i)=>s+Math.abs(v-expect[i]),0)>4)return false;
 }
 return true;
}
export function compareAnalysisSets(results,operator="union"){
 if(!results.length)return [];
 const base=operator==="intersection"?
   results[0].selected.filter(n=>results.every(r=>r.selected.includes(n))):
   results.flatMap(r=>r.selected);
 return sortedUnique(base);
}
export function assessPool(ctx,pool){
 const actual=ctx.draws.get(ctx.target)?.numbers||[];
 const hits=actual.filter(n=>pool.includes(n));
 return {hasResult:actual.length===6,actual,hits,size:pool.length};
}
export function historicalCheck(draws,config){
 const {target,moduleIds=[],count=20,limit=18,window=100}=config;
 const all=[];
 const start=Math.max(2,Number(target)-Math.min(100,Math.max(1,Number(count))));
 for(let id=start;id<target;id++){
  if(!draws.has(id))continue;
  const ctx=buildContext(draws,id,window);
  const selections=moduleIds.map(n=>analyze(ctx,n,limit));
  const pool=compareAnalysisSets(selections,"union"),report=assessPool(ctx,pool);
  all.push({id,poolSize:pool.length,hits:report.hits.length,hitNumbers:report.hits});
 }
 return {rows:all,average:avg(all.map(x=>x.hits)),histogram:Object.fromEntries([0,1,2,3,4,5,6].map(i=>[i,all.filter(x=>x.hits===i).length]))};
}

/** Aşamalı filtre: kaynak havuzun kopyası üzerinde çalışır, asla aslı değiştirmez.
 * keepAtLeast = 6, her ara süzgeç en az 6 sayı bırakabiliyorsa uygulanır.
 * order = gentle: en az daraltan önce; selected: kullanıcının seçtiği sıra.
 */
export function filterPipeline(sourcePool,results,{keepAtLeast=6,order="gentle"}={}){
 const source=sortedUnique(sourcePool),min=Math.max(1,Math.min(60,Number(keepAtLeast)||6));
 let pool=[...source];
 const stages=results.map((r,index)=>({id:r.id,name:r.name||r.id,selected:sortedUnique(r.selected||[]),index}));
 if(order==="gentle")stages.sort((a,b)=>{
   const ca=source.filter(n=>a.selected.includes(n)).length,
         cb=source.filter(n=>b.selected.includes(n)).length;
   return cb-ca||a.index-b.index;
 });
 const journal=[];
 for(const item of stages){
   const next=pool.filter(n=>item.selected.includes(n));
   const applicable=next.length>=min;
   journal.push({id:item.id,name:item.name,before:pool.length,after:applicable?next.length:pool.length,
     excluded:applicable?pool.filter(n=>!next.includes(n)):[],applied:applicable,
     reason:applicable?"Uygulandı":next.length+" sayı bırakacaktı; en az "+min+" sayı koruma kuralıyla atlandı."});
   if(applicable)pool=next;
 }
 return {source,remaining:pool,journal,removed:source.filter(n=>!pool.includes(n)),keepAtLeast:min,order};
}

/** Her top için DNA, Limit, beraber gelenler ve matriksin açıklanabilir kayıtları. */
export function inspectBall(ctx,number,bandSize=10){
 const n=Number(number),size=Number(bandSize);
 if(!Number.isInteger(n)||n<1||n>60)throw Error("İncelenecek top 1–60 arasında olmalı.");
 if(!Number.isInteger(size)||size<2||size>100)throw Error("DNA dilimi 2–100 arasında olmalı.");
 const stats=statsForNumber(ctx,n);
 const chunks=[];
 for(let i=0;i<ctx.recent.length;i+=size){
   const segment=ctx.recent.slice(i,i+size);
   chunks.push({start:segment[0].id,end:segment.at(-1).id,count:segment.filter(d=>d.numbers.includes(n)).length});
 }
 const together=Array(61).fill(0);
 ctx.recent.forEach(d=>{
  if(d.numbers.includes(n))d.numbers.filter(x=>x!==n).forEach(x=>together[x]++);
 });
 const partners=ALL.filter(x=>x!==n).sort((a,b)=>together[b]-together[a]||a-b)
   .slice(0,12).map(x=>({number:x,count:together[x]}));
 const history=ctx.byN[n].filter(id=>id<ctx.target).slice(-20).reverse();
 const names=["Çok–Yakın","Çok–Uzun","Az–Yakın","Az–Uzun"];
 return {number:n,stats,className:names[ctx.matrix[n]],history,
   dna:chunks,limit:stats.intervals.slice(-16),partners,bandSize:size,
   target:ctx.target};
}
/** Gerçek sıralı analizlerin açıklanabilir 12 satırlık örnek tablosu. */
export function orderedHistory(ctx,count=12){
 return ctx.recent.slice(-Math.max(1,Math.min(100,Number(count)||12))).map(d=>{
   const nums=d.numbers,m=ticketMetrics(nums);
   return {id:d.id,date:d.date,numbers:[...nums],...m,first:nums[0],last:nums[5],
     gaps:nums.slice(1).map((n,i)=>n-nums[i])};
 }).reverse();
}

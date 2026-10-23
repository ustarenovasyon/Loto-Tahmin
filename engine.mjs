// Loto Tahmin — saf hesaplama motoru, BigInt ile tam kesir aritmetiği
export const MAX_STEPS = 975;
const abs = n => n < 0n ? -n : n;
function gcd(a,b){a=abs(a);b=abs(b);while(b){[a,b]=[b,a%b]}return a||1n}
export function rational(n,d=1n){
  n=BigInt(n);d=BigInt(d);
  if(d===0n)throw Error("Bölen sıfır olamaz.");
  if(d<0n){n=-n;d=-d}
  const g=gcd(n,d);return {n:n/g,d:d/g};
}
export function decimal(raw){
  const s=String(raw??"").trim().replace(",",".");
  if(!/^[+-]?\d+(?:\.\d+)?$/.test(s))throw Error("Geçerli bir sayı giriniz: "+s);
  const negative=s[0]==="-",part=(s[0]==="-"||s[0]==="+")?s.slice(1):s;
  const [whole,fraction=""]=part.split(".");
  return rational((negative?-1n:1n)*BigInt(whole+fraction),10n**BigInt(fraction.length));
}
export const add=(a,b)=>rational(a.n*b.d+b.n*a.d,a.d*b.d);
export const mul=(a,b)=>rational(a.n*b.n,a.d*b.d);
export const div=(a,b)=>rational(a.n*b.d,a.d*b.n);
export function displayFraction(r,digits=9){
  const sign=r.n<0n?"-":"",n=abs(r.n),whole=n/r.d;
  let rem=n%r.d;
  if(rem===0n)return sign+String(whole);
  let frac="";
  for(let i=0;i<digits&&rem!==0n;i++){rem*=10n;frac+=String(rem/r.d);rem%=r.d}
  return sign+String(whole)+","+frac+(rem!==0n?"…":"");
}
export function parseArchive(raw){
  const rows=new Map();
  const rx=/^\s*(\d{4})\s*\|\s*(\d+)\s*\|\s*(\d{2}\.\d{2}\.\d{4})\s*\|\s*(\d{2}(?:\s*-\s*\d{2}){5})\s*$/;
  for(const line of raw.replace(/^\uFEFF/,"").split(/\r?\n/)){
    const m=line.match(rx);if(!m)continue;
    const id=Number(m[1]),nums=m[4].split(/\s*-\s*/).map(Number);
    if(id<1||id>100000||nums.length!==6||new Set(nums).size!==6||nums.some(n=>n<1||n>60)||nums.some((n,i)=>i>0&&n<=nums[i-1]))throw Error("Geçersiz çekiliş: "+id);
    if(rows.has(id))throw Error("Tekrarlanan çekiliş: "+id);
    rows.set(id,{id,yearNo:Number(m[2]),date:m[3],numbers:nums});
  }
  if(!rows.size)throw Error("TXT içinde geçerli çekiliş bulunamadı.");
  const keys=[...rows.keys()].sort((a,b)=>a-b);
  for(let i=1;i<keys.length;i++)if(keys[i]!==keys[i-1]+1)throw Error("Eksik çekiliş: "+(keys[i-1]+1));
  return rows;
}
function ceilPositiveDiv(a,b){return (a+b-1n)/b}
export function selectDraws(reference,draws){
  if(reference.n<reference.d)return {ok:false,reason:"Referans 1'in altında; 0. çekiliş bulunmaz."};
  const lower=reference.n/reference.d;
  const rem=reference.n%reference.d;
  if(lower>BigInt(Number.MAX_SAFE_INTEGER))return {ok:false,reason:"Referans çok büyük."};
  const low=Number(lower);
  if(rem===0n){
    const d=draws.get(low);if(!d)return {ok:false,reason:low+". çekiliş arşivde yok."};
    return {ok:true,lowerId:low,upperId:null,lowerCount:6,upperCount:0,lowerNums:[...d.numbers],upperNums:[],numbers:[...d.numbers]};
  }
  const high=low+1;
  const a=draws.get(low),b=draws.get(high);
  if(!a||!b)return {ok:false,reason:!a?low+". çekiliş arşivde yok.":high+". çekiliş arşivde yok."};
  // İKİ PAY DA ayrı yukarı tamamlanır: 0,75 -> son 2 + ilk 5.
  const lowerCount=Number(ceilPositiveDiv(6n*(reference.d-rem),reference.d));
  const upperCount=Number(ceilPositiveDiv(6n*rem,reference.d));
  const lowerNums=a.numbers.slice(-lowerCount),upperNums=b.numbers.slice(0,upperCount);
  return {ok:true,lowerId:low,upperId:high,lowerCount,upperCount,lowerNums,upperNums,numbers:[...lowerNums,...upperNums]};
}
export function sequenceReference(config,index,target){
  const mode=config.mode;
  if(mode==="divide"){
    const v=decimal(config.divisor||"2");
    if(v.n<=0n)throw Error("Bölen pozitif olmalı.");
    let x=rational(BigInt(target));
    for(let i=0;i<=index;i++)x=div(x,v);
    return x;
  }
  if(mode==="multiply"){
    const seed=decimal(config.seedDivisor||"100"),factor=decimal(config.factor||"2");
    if(seed.n<=0n||factor.n<=0n)throw Error("Bölen ve çarpan pozitif olmalı.");
    let x=div(rational(BigInt(target)),seed);
    for(let i=0;i<index;i++)x=mul(x,factor);
    return x;
  }
  if(mode==="add"){
    const seed=decimal(config.seedDivisor||"100");
    if(seed.n<=0n)throw Error("Başlangıç böleni pozitif olmalı.");
    const x=div(rational(BigInt(target)),seed);
    const increment=config.addCustom?decimal(config.addValue||"0"):x;
    return add(x,mul(increment,rational(BigInt(index))));
  }
  if(mode==="divisors"){
    const start=decimal(config.divisor||"2"),delta=decimal(config.increment||"1");
    const current=add(start,mul(delta,rational(BigInt(index))));
    if(current.n<=0n)throw Error("Bölen pozitif olmalı.");
    return div(rational(BigInt(target)),current);
  }
  if(mode==="subtract"){
    const amount=decimal(config.amount||"100");
    if(amount.n<=0n)throw Error("Çıkarılacak sayı pozitif olmalı.");
    return add(rational(BigInt(target)),mul(rational(-BigInt(index+1)),amount));
  }
  throw Error("Bilinmeyen strateji türü: "+mode);
}
export function runStrategy(config,draws,target){
  target=Number(target);
  if(!Number.isSafeInteger(target)||target<2||!draws.has(target))throw Error("Hedef çekiliş arşivde bulunmalı ve 1'den büyük olmalı.");
  const requested=Number(config.count??10);
  if(!Number.isInteger(requested)||requested<1||requested>MAX_STEPS)throw Error("Adım sayısı 1–"+MAX_STEPS+" arasında olmalı.");
  const targetNums=draws.get(target).numbers, targetSet=new Set(targetNums);
  const selected=new Set(),steps=[],seen=new Set(),warnings=[];
  for(let i=0;i<requested;i++){
    const ref=sequenceReference(config,i,target), refStr=displayFraction(ref,12);
    const floor=ref.n/ref.d,ceil=floor+(ref.n%ref.d===0n?0n:1n);
    if(ref.n<ref.d){warnings.push((i+1)+". adım: 1'in altına düşüldü, işlem durduruldu.");break}
    if(ceil>=BigInt(target)){warnings.push((i+1)+". adım: hedef/gelecek çekiliş kullanılmadı ("+refStr+").");break}
    const pick=selectDraws(ref,draws);
    if(!pick.ok){warnings.push((i+1)+". adım: "+pick.reason);break}
    const newNumbers=pick.numbers.filter(n=>!selected.has(n));
    pick.numbers.forEach(n=>selected.add(n));
    const hits=[...new Set(pick.numbers)].filter(n=>targetSet.has(n)).sort((a,b)=>a-b);
    hits.forEach(n=>seen.add(n));
    steps.push({step:i+1,reference:refStr,...pick,newNumbers,hits,cumulativeHits:[...seen].sort((a,b)=>a-b),cumulativeUnique:selected.size});
  }
  return {config:{...config},target,targetNumbers:targetNums,steps,pool:[...selected].sort((a,b)=>a-b),totalPicked:steps.reduce((s,r)=>s+r.numbers.length,0),hits:[...selected].filter(n=>targetSet.has(n)).sort((a,b)=>a-b),warnings};
}
export function parseNumberList(input){return [...new Set(String(input??"").match(/\d+/g)?.map(Number)??[])].filter(n=>Number.isInteger(n))}
export function filterPool(pool,draws,target,options={}){
  const removed=new Map(), mark=(n,why)=>{if(pool.includes(n)){const existing=removed.get(n)||[];existing.push(why);removed.set(n,existing)}};
  const history=[...draws.values()].filter(d=>d.id<target).sort((a,b)=>b.id-a.id);
  if(options.frequencyEnabled){
    const recent=history.slice(0,Math.max(1,Number(options.lookback)||10));
    const threshold=Math.max(1,Number(options.threshold)||3);
    const counts=new Map();recent.forEach(d=>d.numbers.forEach(n=>counts.set(n,(counts.get(n)||0)+1)));
    counts.forEach((times,n)=>{if(times>=threshold)mark(n,"Son "+recent.length+" çekilişte "+times+" kez")});
  }
  if(options.excludeLatest&&history[0])history[0].numbers.forEach(n=>mark(n,"Son çekiliş #"+history[0].id));
  parseNumberList(options.excludeDraws).forEach(id=>{
    if(id>=target)return;
    const d=draws.get(id);if(d)d.numbers.forEach(n=>mark(n,"#"+id+" çekilişi"));
  });
  parseNumberList(options.excludeNumbers).forEach(n=>mark(n,"Elle eleme"));
  const remaining=pool.filter(n=>!removed.has(n)).sort((a,b)=>a-b);
  return {remaining,removed:[...removed].map(([number,reasons])=>({number,reasons}))};
}
export function combinePools(pools,kind="intersection"){
  if(!pools.length)return [];
  if(kind==="union")return [...new Set(pools.flat())].sort((a,b)=>a-b);
  return pools[0].filter(n=>pools.every(p=>p.includes(n))).sort((a,b)=>a-b);
}
export const MODE_LABELS={divide:"Sürekli 2'ye / seçilen bölenle böl",multiply:"Sabit çarpanla çarp",add:"İlk sonucu üzerine ekle",divisors:"Bölenleri sırayla artır",subtract:"Sabit değer çıkar"};

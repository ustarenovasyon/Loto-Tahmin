import {parseArchive} from "./engine.mjs";
import {MODULES} from "./analysis-engine.mjs";
import {SYSTEM_COUNT,catalog,backtest,buildPools,virtualCoupons,forecast,settleForecast,archiveSignature} from "./system-kosesi-engine.mjs";
import {columnHistory,selectFinalCoupons} from "./system-kosesi-selection.mjs";

const $=id=>document.getElementById(id);
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n).toLocaleString("tr-TR",{maximumFractionDigits:3});
const storageKey="loto-system-kosesi-v1";
const state={draws:null,report:null,forecast:null,own:null,public:null,signature:null,finalChoice:null};
const list=catalog();
const names=new Map(list.specs.map(s=>[s.id,s]));
let customPools=new Map();
function sourceOptions(){
 const current=Number($("target").value);
 customPools=new Map();
 for(const [key,prefix] of [["loto-tahmin-saved-v1","matematik"],["loto-analysis-saved-v1","analiz"]]){
  try{
   const saved=JSON.parse(localStorage.getItem(key)||"[]");
   if(!Array.isArray(saved))continue;
   for(const x of saved){
    if(x.target!==current||!Array.isArray(x.pool))continue;
    const numbers=[...new Set(x.pool.map(Number))].filter(n=>Number.isInteger(n)&&n>=1&&n<=60).sort((a,b)=>a-b);
    if(numbers.length<6)continue;
    const id="saved:"+prefix+":"+String(x.id||"").replace(/[^a-zA-Z0-9-]/g,"");
    customPools.set(id,{pool:numbers,name:prefix==="matematik"?"∑ "+(x.name||"Matematik Havuzu"):x.name||"Analiz Havuzu"});
   }
  }catch{}
 }
 const prevA=$("sourceA").value,prevB=$("sourceB").value;
 const builtins=list.specs.filter(x=>x.kind==="wide"||x.kind==="single");
 const options=builtins.map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name)+'</option>').join("")+
  (customPools.size?'<optgroup label="Kendi kayıtlı havuzlarım">'+[...customPools.entries()].map(([id,r])=>
   '<option value="'+safe(id)+'">'+safe(r.name)+' · '+r.pool.length+' sayı</option>').join("")+'</optgroup>':"");
 $("sourceA").innerHTML=options;$("sourceB").innerHTML=options;
 $("sourceA").value=[...builtins.map(x=>x.id),...customPools.keys()].includes(prevA)?prevA:"wide-hot";
 $("sourceB").value=[...builtins.map(x=>x.id),...customPools.keys()].includes(prevB)?prevB:"wide-dna";
}
function numbers(arr,hit=[]){return arr.map(n=>'<span class="s-ball '+(hit.includes(n)?"hit":"")+'">'+n+'</span>').join("")}
function settings(){
 const opts={target:Number($("target").value),period:Number($("period").value),window:100,
  systems:Number($("top").value),coupons:Number($("coupons").value)};
 const last=Math.max(...state.draws.keys());
 if(!Number.isInteger(opts.target)||opts.target<32||opts.target>last+1)throw Error("Hedef 32–"+(last+1)+" arasında olmalı.");
 return opts;
}
function saveLocal(){
 try{localStorage.setItem(storageKey,JSON.stringify({signature:state.signature,
  forecast:state.forecast,own:state.own,finalChoice:state.finalChoice,report:state.report?{target:state.report.target,period:state.report.period}:null}))}catch{}
}
function restoreLocal(){
 try{
  const item=JSON.parse(localStorage.getItem(storageKey)||"null");
  if(item?.forecast?.selected&&Array.isArray(item.forecast.selected))state.forecast=item.forecast;
  if(item?.own)state.own=item.own;
  if(item?.finalChoice?.columns&&Array.isArray(item.finalChoice.columns))state.finalChoice=item.finalChoice;
 }catch{}
}
function download(name,data,type="text/plain;charset=utf-8"){
 const blob=new Blob([data],{type}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const wait=()=>new Promise(resolve=>setTimeout(resolve,30));
function busy(which,status=true){$(which).disabled=status}
function reportErrors(error){$("status").textContent="Hata: "+error.message;console.error(error)}
function rankHtml(row,index){
 const mark=row.score>0?'<span class="s-good">+':'<span>';
 return '<tr><td><strong>'+(index+1)+'. '+safe(row.name)+'</strong>'+
 '<small>'+safe(row.kind)+' · '+fmt(row.score)+' puan</small><button type="button" data-inspect="'+safe(row.id)+'">İncele</button></td>'+
 '<td>'+fmt(row.averagePool)+'</td><td>'+fmt(row.average)+'/6</td>'+
 '<td>'+fmt(row.expectedAverage)+'/6</td><td>'+mark+fmt(row.excess)+'</span></td>'+
 '<td>'+row.threePlus+' / '+row.tries+'</td><td>'+row.tries+'</td></tr>';
}
function renderRanks(){
 const r=state.report;if(!r)return;
 $("rankNote").textContent=r.rows.length+" strateji · "+r.totalRuns+" arşivdeki geçmiş çekiliş (hedef #"+r.target+") · Ölçülen: HAVUZ isabeti";
 $("rankBody").innerHTML=r.rows.map(rankHtml).join("");
 $("kpis").innerHTML=[
  [SYSTEM_COUNT,"Toplam yöntem ve kombinasyon"],
  [r.totalRuns,"Geçmiş test edilen çekiliş"],
  [r.rows.filter(x=>x.tries===r.totalRuns).length,"Tam kapsama sağlayan"],
  ["#"+r.target,"Tahmin hedefi"]
 ].map(([n,label])=>'<div class="s-kpi"><strong>'+safe(n)+'</strong><span>'+safe(label)+'</span></div>').join("");
 if(r.rows.length){
  $("detail").textContent="İlk sıradaki strateji: "+r.rows[0].name+". "+r.totalRuns+
   " çekilişlik testte havuzunda toplam "+r.rows[0].hits+" doğru sayı bulundu. Bu kolon başına isabet değildir. Sıralama havuz büyüklüğünü hesaba katar.";
 }
}
function inspect(id){
 const r=state.report?.rows.find(x=>x.id===id);if(!r)return;
 const result=r.draws.filter(x=>x.valid).map(x=>'<tr><td>#'+x.id+'</td><td>'+x.poolSize+'</td><td><strong>'+x.hits+'/6</strong></td></tr>').join("");
 $("detail").innerHTML='<h3>'+safe(r.name)+'</h3><p>Toplam '+r.tries+' test · ortalama '+fmt(r.average)+
 ' · beklenen '+fmt(r.expectedAverage)+' · fark '+fmt(r.excess)+
 '. Geçmişte 6 sayının tamamını içeren havuz: '+r.allSix+'.</p>'+
 '<div class="s-scroll"><table class="s-table" style="min-width:300px"><thead><tr><th>Çekiliş</th><th>Havuz</th><th>Doğru sayı</th></tr></thead><tbody>'+result+'</tbody></table></div>';
 $("detail").scrollIntoView({block:"nearest",behavior:"smooth"});
}
async function scan(){
 if(!state.draws)return;
 busy("scan");$("status").textContent="Gerçek geçmiş çekilişlerle stratejiler karşılaştırılıyor…";
 await wait();
 try{state.report=backtest(state.draws,settings());renderRanks();$("status").textContent=
 "Tamamlandı: "+state.report.totalRuns+" geçmiş çekiliş ve "+state.report.rows.length+
 " strateji. Gelecek verisi tahmin motoruna girmedi.";saveLocal()}
 catch(e){reportErrors(e)}finally{busy("scan",false)}
}
function makeCompare(){
 const opts=settings(),idA=$("sourceA").value,idB=$("sourceB").value,op=$("combine").value;
 const built=buildPools(state.draws,opts.target,{window:opts.window});
 const a=built.all.get(idA)||customPools.get(idA)?.pool||[],b=built.all.get(idB)||customPools.get(idB)?.pool||[];
 const set=new Set(b),intersection=a.filter(n=>set.has(n));
 const pool=op==="intersection"?intersection:[...new Set([...a,...b])].sort((x,y)=>x-y);
 const tickets=virtualCoupons(pool,{count:Number($("compareCount").value),seed:opts.target*31+pool.reduce((x,y)=>x+y,0)});
 const actual=state.draws.get(opts.target)?.numbers||[];
 const hits=actual.filter(n=>pool.includes(n));
 const nameA=names.get(idA)?.name||customPools.get(idA)?.name||idA;
 const nameB=names.get(idB)?.name||customPools.get(idB)?.name||idB;
 const result={target:opts.target,idA,idB,nameA,nameB,operation:op,pool,tickets,actual:actual.length?actual:null,hits,created:new Date().toISOString()};
 state.own=result;saveLocal();renderOwn();
}
function renderOwn(){
 const o=state.own;if(!o)return;
 const oldA=o.nameA||names.get(o.idA)?.name||o.idA,oldB=o.nameB||names.get(o.idB)?.name||o.idB;
 const label=o.operation==="intersection"?"Ortak havuz":"Birleşik havuz";
 $("compareResult").className="";
 $("compareResult").innerHTML='<div class="s-result"><strong>'+safe(oldA)+'</strong> ve <strong>'+safe(oldB)+'</strong>'+
 ' → '+o.pool.length+' sayı · '+label+' · #'+o.target+
 (o.actual?' · '+o.hits.length+'/6 gerçek sayı kapsandı':' · <span class="s-pending">Sonuç bekleniyor</span>')+
 '</div><div class="s-balls">'+numbers(o.pool,o.hits)+'</div>'+
 (o.tickets.length?'<h4>Sanal kuponlar</h4><div class="s-tickets">'+o.tickets.map((t,i)=>
 '<div class="s-ticket"><h4>Kolon '+(i+1)+'</h4><div class="s-balls">'+numbers(t,o.actual?t.filter(n=>o.actual.includes(n)):[])+'</div></div>').join("")+'</div>':
 '<p class="s-muted">Ortak havuz altıdan az sayı içeriyor; sahte tamamlama yapılmadı.</p>')+
 '<div class="s-actions"><button type="button" class="s-button" id="ownTxt">↓ Bu karşılaştırmayı TXT indir</button></div>';
 $("ownTxt").onclick=()=>download("ortak_"+o.target+".txt",
  "Hedef "+o.target+"\n"+oldA+"\n"+oldB+"\n"+label+" ("+o.pool.length+"):\n"+o.pool.join(" ")+
  "\n\n"+o.tickets.map((t,i)=>(i+1)+". "+t.join(" ")).join("\n"));
}
function renderForecast(){
 const r=state.forecast;if(!r)return;
 const actual=r.actual||[];
 $("forecastResult").className="";
 const banners='<div class="s-result"><b>Hedef #'+r.target+'</b> · '+r.systems+' sistem · '+r.couponsPerSystem+
  ' öneri kolonu/sistem · Satın alınmadı · '+(r.state==="settled"?
  '<span class="s-good">Gerçek sonuç: '+actual.join(" - ")+'</span>':
  '<span class="s-pending">Çekiliş bekleniyor</span>')+
  (r.origin==="retrospective"?' · <b>GEÇMİŞ TEST: sonuçtan önce kaydedilmiş tahmin değil</b>':
   ' · <b>Geleceğe dönük hesaplama</b>')+'</div>';
 $("forecastResult").innerHTML=banners+r.selected.map((s,i)=>
  '<article class="s-ticket" style="margin:12px 0"><h4>'+(i+1)+'. '+safe(s.name)+' · '+s.pool.length+
  ' aday'+(s.hits?' · <span class="s-good">'+s.hits.length+'/6 havuz isabeti</span>':'')+'</h4>'+
  '<p>Geçmiş test: '+s.test.tries+' çekilişte ort. '+fmt(s.test.average)+' (beklenen '+fmt(s.test.expected)+')</p>'+
  '<div class="s-balls">'+numbers(s.pool,s.hits||[])+'</div><div class="s-tickets">'+s.tickets.map((t,j)=>
  '<div class="s-ticket"><p>'+(j+1)+'. kolon'+(s.ticketHits?' · '+s.ticketHits[j]+'/6 isabet':' · beklemede')+'</p>'+
  '<div class="s-balls">'+numbers(t,actual.filter(n=>t.includes(n)))+'</div></div>').join("")+'</div></article>').join("");
}
function makeForecast(){
 const opt=settings();
 try{
  busy("make");
  // The forecast must remain frozen once saved. A new run can be manually made for a different target.
  if(state.forecast?.target===opt.target&&state.forecast?.selected?.length&&state.forecast?.state==="pending"){
   state.forecast=settleForecast(state.forecast,state.draws);
  }else{
   state.forecast=settleForecast(forecast(state.draws,opt),state.draws);
  }
  renderForecast();saveLocal();$("status").textContent="#"+opt.target+" gerçek arşive dayalı tahmin oluşturuldu. Hiçbir kupon satın alınmadı.";
 }catch(e){reportErrors(e)}finally{busy("make",false)}
}
function exportForecast(){
 const r=state.forecast;if(!r)return alert("Önce tahmin oluştur.");
 const text="SİSTEM KÖŞESİ · SATIN ALINMAMIŞ SİSTEM TAHMİNİ\nHedef: #"+r.target+"\nDurum: "+(r.state==="pending"?"BEKLEMEDE":"SONUÇLANDI")+
 "\nMotor: "+r.version+"\nKayıt türü: "+(r.origin==="retrospective"?"SONRADAN ÜRETİLMİŞ GEÇMİŞ TEST":"İLERİYE DÖNÜK TAHMİN")+"\n\n"+r.selected.map((row,i)=>(i+1)+") "+row.name+
 "\nHAVUZ ("+row.pool.length+"): "+row.pool.join(", ")+
 "\n"+row.tickets.map((ticket,n)=>(n+1)+". "+ticket.join(" - ")+
 (row.ticketHits?" · "+row.ticketHits[n]+"/6":"")).join("\n")).join("\n\n");
 download("sistem-kosesi_"+r.target+".txt",text);
}

function getSelectionSource(){
 const target=Number($("target").value);
 const origin=$("finalSource").value;
 if(origin==="public"){
  const record=state.public?.records?.find(r=>r.target===target);
  if(!record)throw Error("#"+target+" için herkese açık kupon kaydı yok. Önce yerel tahmin üretip kaynak olarak onu seç.");
  return {record,origin};
 }
 const record=state.forecast;
 if(!record||record.target!==target||!record.selected?.length)
  throw Error("#"+target+" için bu sayfada kupon üretilmedi. Önce 'Tahmin üret' seçeneğine bas.");
 return {record,origin};
}
function finalText(result){
 return "SİSTEM KÖŞESİ — OYNAYACAĞIM KOLONLAR (HENÜZ SATIN ALINMADI)\n"+
 "Hedef: #"+result.target+"\nKaynak: "+(result.sourceKind==="public"?"Herkese açık kayıtlı sistem kolonları":"Kendi yerel sistem kolonlarım")+
 "\nSon seçim zamanı: "+result.created+"\nDurum: "+(result.resultWasKnown?"SONUCU BİLİNEN GEÇMİŞ HEDEF":"SEÇİM ANINDA SONUÇ BİLİNMİYOR")+
 "\nToplam aday: "+result.totalColumns+" · Farklı: "+result.uniqueCandidates+
 "\nİstenen: "+result.requested+" · Seçilen: "+result.actualCount+"\n"+
 result.columns.map((x,i)=>(i+1)+". "+x.numbers.join(" - ")).join("\n")+
 "\n\nNot: Geçmiş verilerle ölçülen aday seçimidir, gelecekte kazanma garantisi yoktur. Kuponlar satın alınmış değildir.";
}
function renderFinal(){
 const r=state.finalChoice;
 if(!r){$("finalResult").className="s-empty";$("finalResult").textContent="Henüz final kolon seçilmedi.";return}
 const actual=state.draws?.get(r.target)?.numbers||[];
 const lines=r.columns.map((c,i)=>{
  const src=c.sources?.slice().sort((a,b)=>b.score-a.score)?.[0];
  const tests=src?.history;
  const hits=actual.filter(n=>c.numbers.includes(n));
  return '<div class="s-ticket"><h4>'+(i+1)+'. seçilen kolon'+
   (actual.length===6?' · <span class="s-good">'+hits.length+'/6 gerçekleşmiş isabet</span>':' · <span class="s-pending">Sonuç bekleniyor</span>')+'</h4>'+
   '<div class="s-balls">'+numbers(c.numbers,hits)+'</div>'+
   '<p>Kaynak: '+safe(src?.name||"—")+" · "+(c.sources?.length||1)+' sistemde bulundu'+
   (tests?.tries?' · '+tests.tries+' geçmiş çekilişte aynı sistemin '+(src.index)+'. kolonunun ort. '+fmt(tests.average)+'/6 isabeti':' · Yeterli geçmiş kolon testi yok')+
   '</p></div>';
 }).join("");
 $("finalResult").className="";
 $("finalResult").innerHTML='<div class="s-result"><strong>Hedef #'+r.target+'</strong> · '+r.totalColumns+
 ' toplam sistem kolonu, '+r.uniqueCandidates+' farklı altılı içinden <b>'+r.actualCount+
 ' kolon seçildi</b> (istenen: '+r.requested+').'+
 (r.actualCount<r.requested?' <b>Belirlenen ortak sayı sınırı nedeniyle istenen adede ulaşılamadı. Sınırı gevşetip tekrar deneyebilirsin.</b>':'')+
 '</div><p class="s-muted">'+safe(r.sourceKind==="public"?"Herkese açık kayıttaki önceden üretilmiş adaylardan kişisel seçim.":"Tarayıcıda oluşturulmuş adaylardan kişisel seçim.")+
 ' · Son seçim zamanı: '+safe(r.created)+
 (r.resultWasKnown?' · Sonucu bilinen çekiliş için sonradan yapılmış seçim, ön tahmin değildir.':
  ' · Seçim yapıldığı sırada hedef sonucu arşivde yoktu.')+
 ' · Sistem satın alma işlemi yapmadı.</p><div class="s-tickets">'+lines+'</div>';
 $("finalDownload").disabled=!r.columns.length;
 $("finalCopy").disabled=!r.columns.length;
}
async function runFinalSelection(){
 if(!state.draws)return;
 $("finalSelect").disabled=true;
 $("finalResult").className="s-empty";
 $("finalResult").textContent="Hedef öncesi gerçek çekilişlerle geçmiş kolonlar ölçülüyor ve kayıtlı kuponlardan seçiliyor…";
 await wait();
 try{
  const {record,origin}=getSelectionSource();
  const period=Number($("finalPeriod").value);
  const history=columnHistory(state.draws,record,{period});
  const result=selectFinalCoupons(record,{
   count:Number($("finalCount").value),maxOverlap:Number($("finalOverlap").value),history
  });
  // Personal choice is timestamped separately; do not rewrite the published original tickets.
  state.finalChoice={...result,sourceKind:origin,created:new Date().toISOString(),
   originalRecordDate:record.created||null,resultWasKnown:state.draws.has(record.target)};
  saveLocal();renderFinal();
  $("status").textContent="Final seçildi: "+result.actualCount+" kolon, #"+record.target+
   ". Yalnızca önce oluşturulmuş gerçek hesaplama sonuçları kullanıldı; satın alma yapılmadı.";
 }catch(e){reportErrors(e);$("finalResult").textContent="Son seçim oluşturulamadı: "+e.message}
 finally{$("finalSelect").disabled=false}
}
function finalDownload(){
 if(!state.finalChoice?.columns?.length)return alert("Önce oynayacağın kolonları seç.");
 download("oynayacagim_kolonlar_"+state.finalChoice.target+".txt",finalText(state.finalChoice));
}
async function finalCopy(){
 if(!state.finalChoice?.columns?.length)return;
 const data=state.finalChoice.columns.map((x,i)=>(i+1)+". "+x.numbers.join(" - ")).join("\n");
 try{await navigator.clipboard.writeText(data);$("status").textContent=state.finalChoice.columns.length+" kolon panoya kopyalandı."}
 catch{$("status").textContent="Panoya erişilemedi. TXT indirme düğmesini kullanabilirsin."}
}

async function refreshPublic(){
 try{
  // Disallow stale GitHub Pages CDN copies after a published draw update.
  const response=await fetch("./data/system-kosesi-ledger.json?v="+Date.now(),{cache:"no-store"});
  if(!response.ok)throw Error("Kamu günlüğü henüz yayımlanmamış.");
  const raw=await response.json();
  if(!raw||!Array.isArray(raw.records))throw Error("Günlük formatı beklenenden farklı.");
  state.public=raw;
  const rows=[...raw.records].sort((a,b)=>b.target-a.target);
  $("publicResults").className="";
  $("publicResults").innerHTML='<p class="s-muted">'+rows.length+' herkese açık çekiliş kaydı. Bu kayıtlar tüm ziyaretçilerde aynıdır.</p>'+
   rows.slice(0,15).map(r=>'<div class="s-ticket" style="margin:8px 0"><b>Çekiliş #'+r.target+'</b> · '+
   (r.state==="settled"?'<span class="s-good">Sonuçlandı · '+safe((r.actual||[]).join(" - "))+'</span>':
   '<span class="s-pending">Tahmin kaydedildi · sonuç bekleniyor</span>')+
   '<p class="s-muted">Oluşturulma: '+safe(r.created||"—")+' · Motor: '+safe(r.version||"—")+
   ' · Gerçekte satın alınmadı · Kaynak: '+safe(r.sourceFile||"data/draws.txt")+
   (r.origin==="retrospective"?' · Geçmişte sonradan oluşturuldu':' · Çekiliş öncesi kaydedilmiş tahmin')+'</p>'+
   '<details><summary>'+r.selected.length+' sistemin kuponlarını gör</summary>'+
   r.selected.map(s=>'<div style="margin:10px 0"><b>'+safe(s.name)+'</b>'+
   (s.hits?' · '+s.hits.length+'/6 sayı kapsandı':'')+
   '<div class="s-balls">'+numbers(s.pool,s.hits||[])+'</div>'+
   s.tickets.map((ticket,i)=>
    '<div class="s-balls">'+(i+1)+'. '+numbers(ticket,r.actual||[])+'</div>').join("")+
   '</div>').join("")+'</details></div>').join("")+
   (!rows.length?'<p>Henüz yayımlanmış öngörü bulunmuyor.</p>':'');
 }catch(e){$("publicResults").className="s-empty";$("publicResults").textContent=e.message}
}
async function loadData(){
 try{
  const resp=await fetch("./data/draws.txt",{cache:"no-store"});if(!resp.ok)throw Error("Çekiliş arşivi bulunamadı.");
  const draws=parseArchive(await resp.text());
  state.draws=draws;state.signature=archiveSignature(draws);
  const last=Math.max(...draws.keys());
  $("target").value=last+1;$("target").max=last+1;
  $("status").textContent=draws.size+" arşiv çekiliş kaydı yüklendi (kaynak: data/draws.txt); son #"+last+
  " · Sonraki tahmin #"+(last+1)+". Kamuya açık sistem için aynı arşiv kullanılıyor.";
  restoreLocal();sourceOptions();
  if(state.forecast){state.forecast=settleForecast(state.forecast,draws);renderForecast()}
  if(state.own){if(draws.has(state.own.target)){state.own.actual=draws.get(state.own.target).numbers;state.own.hits=state.own.actual.filter(n=>state.own.pool.includes(n))}renderOwn()}
  if(state.finalChoice)renderFinal();
  saveLocal();
  await refreshPublic();
 }catch(e){reportErrors(e)}
}
const analyses=list.sources.filter(s=>s.id.startsWith("an-"));
$("target").addEventListener("change",sourceOptions);
$("scan").onclick=scan;$("reload").onclick=loadData;$("make").onclick=makeForecast;
$("compare").onclick=()=>{try{makeCompare()}catch(e){reportErrors(e)}};
$("rankBody").addEventListener("click",e=>{const id=e.target.closest("[data-inspect]")?.dataset.inspect;if(id)inspect(id)});
$("download").onclick=exportForecast;
$("export").onclick=()=>download("sistem-kosesi-kayit.json",JSON.stringify({savedAt:new Date().toISOString(),forecast:state.forecast,comparison:state.own,report:state.report},null,2),"application/json");
$("publicRefresh").onclick=refreshPublic;
$("finalSelect").onclick=runFinalSelection;
$("finalDownload").onclick=finalDownload;
$("finalCopy").onclick=finalCopy;
loadData();
// Açık sayfa, yayımlanmış yeni tahmin ve sonuçları kendi kendine yeniler.
setInterval(()=>{if(document.visibilityState!=="hidden")refreshPublic()},120000);
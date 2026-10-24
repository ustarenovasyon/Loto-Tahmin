import {parseArchive} from "./engine.mjs";
import {MODULES} from "./analysis-engine.mjs";
import {SYSTEM_COUNT,catalog,backtest,buildPools,virtualCoupons,forecast,settleForecast,archiveSignature} from "./system-kosesi-engine.mjs";

const $=id=>document.getElementById(id);
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n).toLocaleString("tr-TR",{maximumFractionDigits:3});
const storageKey="loto-system-kosesi-v1";
const state={draws:null,report:null,forecast:null,own:null,public:null,signature:null};
const list=catalog();
const names=new Map(list.specs.map(s=>[s.id,s]));
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
  forecast:state.forecast,own:state.own,report:state.report?{target:state.report.target,period:state.report.period}:null}))}catch{}
}
function restoreLocal(){
 try{
  const item=JSON.parse(localStorage.getItem(storageKey)||"null");
  if(item?.forecast?.selected&&Array.isArray(item.forecast.selected))state.forecast=item.forecast;
  if(item?.own)state.own=item.own;
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
 $("rankNote").textContent=r.rows.length+" strateji · "+r.totalRuns+" gerçek geçmiş çekiliş (hedef #"+r.target+")";
 $("rankBody").innerHTML=r.rows.map(rankHtml).join("");
 $("kpis").innerHTML=[
  [SYSTEM_COUNT,"Toplam yöntem ve kombinasyon"],
  [r.totalRuns,"Geçmiş test edilen çekiliş"],
  [r.rows.filter(x=>x.tries===r.totalRuns).length,"Tam kapsama sağlayan"],
  ["#"+r.target,"Tahmin hedefi"]
 ].map(([n,label])=>'<div class="s-kpi"><strong>'+safe(n)+'</strong><span>'+safe(label)+'</span></div>').join("");
 if(r.rows.length){
  $("detail").textContent="İlk sıradaki strateji: "+r.rows[0].name+". "+r.totalRuns+
   " çekilişlik testte toplam "+r.rows[0].hits+" isabet. Sıralama havuz büyüklüğünü ve karşılaştırılan gerçek sonuçları hesaba katar.";
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
 const a=built.all.get(idA)||[],b=built.all.get(idB)||[];
 const set=new Set(b),intersection=a.filter(n=>set.has(n));
 const pool=op==="intersection"?intersection:[...new Set([...a,...b])].sort((x,y)=>x-y);
 const tickets=virtualCoupons(pool,{count:Number($("compareCount").value),seed:opts.target*31+pool.reduce((x,y)=>x+y,0)});
 const actual=state.draws.get(opts.target)?.numbers||[];
 const hits=actual.filter(n=>pool.includes(n));
 const result={target:opts.target,idA,idB,operation:op,pool,tickets,actual:actual.length?actual:null,hits,created:new Date().toISOString()};
 state.own=result;saveLocal();renderOwn();
}
function renderOwn(){
 const o=state.own;if(!o)return;
 const oldA=names.get(o.idA)?.name||o.idA,oldB=names.get(o.idB)?.name||o.idB;
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
  ' sanal kupon/sistem · '+(r.state==="settled"?
  '<span class="s-good">Gerçek sonuç: '+actual.join(" - ")+'</span>':
  '<span class="s-pending">Çekiliş bekleniyor</span>')+'</div>';
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
  renderForecast();saveLocal();$("status").textContent="#"+opt.target+" sanal kupon kaydı oluşturuldu. Satın alma yapılmadı.";
 }catch(e){reportErrors(e)}finally{busy("make",false)}
}
function exportForecast(){
 const r=state.forecast;if(!r)return alert("Önce sanal kupon üret.");
 const text="SİSTEM KÖŞESİ · SANAL ÇALIŞMA\nHedef: #"+r.target+"\nDurum: "+(r.state==="pending"?"BEKLEMEDE":"SONUÇLANDI")+
 "\nMotor: "+r.version+"\n\n"+r.selected.map((row,i)=>(i+1)+") "+row.name+
 "\nHAVUZ ("+row.pool.length+"): "+row.pool.join(", ")+
 "\n"+row.tickets.map((ticket,n)=>(n+1)+". "+ticket.join(" - ")+
 (row.ticketHits?" · "+row.ticketHits[n]+"/6":"")).join("\n")).join("\n\n");
 download("sistem-kosesi_"+r.target+".txt",text);
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
   '<p class="s-muted">Tahmin oluşturma: '+safe(r.created||"—")+' · Kayıt sürümü: '+safe(r.version||"—")+'</p>'+
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
  $("status").textContent=draws.size+" gerçek çekiliş kaydı yüklendi; son #"+last+
  " · Sonraki tahmin #"+(last+1)+". Kamuya açık sistem için aynı arşiv kullanılıyor.";
  restoreLocal();
  if(state.forecast){state.forecast=settleForecast(state.forecast,draws);renderForecast()}
  if(state.own){if(draws.has(state.own.target)){state.own.actual=draws.get(state.own.target).numbers;state.own.hits=state.own.actual.filter(n=>state.own.pool.includes(n))}renderOwn()}
  saveLocal();
  await refreshPublic();
 }catch(e){reportErrors(e)}
}
const analyses=list.sources.filter(s=>s.id.startsWith("an-"));
$("sourceA").innerHTML=list.specs.filter(x=>x.kind==="wide"||x.kind==="single")
 .map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name)+'</option>').join("");
$("sourceB").innerHTML=$("sourceA").innerHTML;
$("sourceA").value="wide-hot";$("sourceB").value="wide-dna";
$("scan").onclick=scan;$("reload").onclick=loadData;$("make").onclick=makeForecast;
$("compare").onclick=()=>{try{makeCompare()}catch(e){reportErrors(e)}};
$("rankBody").addEventListener("click",e=>{const id=e.target.closest("[data-inspect]")?.dataset.inspect;if(id)inspect(id)});
$("download").onclick=exportForecast;
$("export").onclick=()=>download("sistem-kosesi-kayit.json",JSON.stringify({savedAt:new Date().toISOString(),forecast:state.forecast,comparison:state.own,report:state.report},null,2),"application/json");
$("publicRefresh").onclick=refreshPublic;
loadData();
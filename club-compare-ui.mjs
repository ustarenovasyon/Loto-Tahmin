import {parseArchive} from "./engine.mjs";
import {CLUB} from "./analysis-engine.mjs";
import {parseOwnPool,parseExternalColumns,localClubSources,compareClubSources,compareDrawsToPool} from "./club-compare-engine.mjs";
const el=id=>document.getElementById(id);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const balls=(arr,hits=[])=>arr.map(n=>'<span class="lab-ball '+(hits.includes(n)?"hit":"")+'">'+n+'</span>').join("");
const fmt=x=>Number(x).toLocaleString("tr-TR",{maximumFractionDigits:2});
const KEYS={math:"loto-tahmin-saved-v1",analysis:"loto-analysis-saved-v1",
 external:"loto-club-external-v1",customTeams:"loto-custom-club-teams-v1"};
const state={draws:null,own:[],sources:[],external:[],chosen:new Set(),result:null,teamList:[]};
const get=k=>{try{return JSON.parse(localStorage.getItem(k)||"null")}catch{return null}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
function toast(message){
 const box=el("clubToast");box.textContent=message;box.classList.add("show");
 setTimeout(()=>box.classList.remove("show"),3500);
}
function target(){return Number(el("clubTarget").value)}
function ownSaved(){
 const math=Array.isArray(get(KEYS.math))?get(KEYS.math):[];
 const analysis=Array.isArray(get(KEYS.analysis))?get(KEYS.analysis):[];
 return [...math.map(x=>({...x,kind:"math"})),...analysis.map(x=>({...x,kind:"analysis"}))]
  .filter(x=>x.target===target()&&Array.isArray(x.pool)&&x.pool.length>0);
}
function selectOptions(){
 const previous=el("ownSource").value,records=ownSaved();
 el("ownSource").innerHTML='<option value="manual">Elle yazdığım sayılar</option>'+
   records.map((s,i)=>'<option value="saved-'+i+'">'+esc(s.name||"Adsız havuz")+' · '+s.pool.length+' sayı</option>').join("");
 if(previous==="manual"||!previous)el("ownSource").value="manual";
 else if(records[Number(previous.replace("saved-",""))])el("ownSource").value=previous;
}
function applyOwn(){
 let pool;
 const selector=el("ownSource").value;
 if(selector.startsWith("saved-")){
  const item=ownSaved()[Number(selector.slice(6))];
  if(!item)throw Error("Seçilen havuz bulunamadı; listeyi yenile.");
  pool=parseOwnPool(item.pool.join(" "));
  el("ownNumbers").value=pool.join(", ");
 }else{
  pool=parseOwnPool(el("ownNumbers").value);
 }
 if(pool.length<1)throw Error("En az bir sayı gir.");
 state.own=pool;
 el("ownPreview").innerHTML=balls(pool);
 el("ownCount").textContent=pool.length+" farklı sayı · orijinal havuz değiştirilmedi.";
 state.result=null;
 toast("Kendi "+pool.length+" sayılık havuzun seçildi.");
}
function usableSources(){return state.sources.filter(s=>s.target===target())}
function sourceList(){
 const list=usableSources(),selected=state.chosen;
 el("sourceList").innerHTML=list.length?list.map(x=>
  '<div class="club-source"><label class="club-source-main">'+
  '<input type="checkbox" data-source="'+esc(x.id)+'" '+(selected.has(x.id)?"checked":"")+'>'+
  '<span class="club-source-details"><strong>'+esc(x.name)+'</strong><small>'+
  (x.kind==="local"?"Bizim açık kurallı sistemimiz":"Senin eklediğin dış kaynak")+
  ' · #'+x.target+' · '+x.columns.length+' örnek altılı</small></span></label>'+
  (x.kind==="external"?'<button class="del" data-delete="'+esc(x.id)+'">Sil</button>':"")+
  '</div>').join(""):'<p class="lab-empty">Henüz karşılaştırılacak sistem eklenmedi.</p>';
 const count=list.filter(s=>selected.has(s.id)).length;
 el("minClubSources").max=String(Math.max(1,count));
 if(Number(el("minClubSources").value)>count&&count>0)el("minClubSources").value=String(count);
}
function addExternal(){
 const text=el("externalColumns").value,name=el("externalName").value.trim();
 if(!name)throw Error("Önce dış kaynak için sistem adı yaz.");
 if(text.length>120000)throw Error("Bir defada en fazla 120.000 karakter ekleyebilirsin.");
 const parsed=parseExternalColumns(text);
 const src={id:"user-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
   kind:"external",name,target:target(),columns:parsed.columns,added:new Date().toISOString()};
 state.external.unshift(src);state.external=state.external.slice(0,40);
 state.sources.push(src);state.chosen.add(src.id);
 put(KEYS.external,state.external);
 el("externalColumns").value="";el("externalName").value="";
 sourceList();
 toast(src.columns.length+" benzersiz altılı "+name+" sistemine kaydedildi."+
   (parsed.errors.length?" "+parsed.errors.length+" satır geçersizdi.":""));
}
function simulate(){
 if(!state.draws)throw Error("Çekiliş verisi yüklenmedi.");
 const custom=Array.isArray(get(KEYS.customTeams))?get(KEYS.customTeams):[];
 const teams=[...CLUB,...custom.filter(t=>Array.isArray(t.modules)&&t.modules.length)];
 if(teams.length>25)throw Error("En fazla 25 bağımsız sistem destekleniyor.");
 const sources=localClubSources(state.draws,{target:target(),window:Number(el("clubWindow").value),
  perSystem:Number(el("simulationCount").value),seed:Number(el("simulationSeed").value),teams});
 const oldIDs=new Set(state.sources.filter(s=>s.kind==="local").map(s=>s.id));
 state.sources=state.sources.filter(s=>s.kind!=="local").concat(sources);
 oldIDs.forEach(id=>state.chosen.delete(id));
 sources.forEach(s=>state.chosen.add(s.id));
 sourceList();
 toast(sources.length+" sistemin sayıları üretildi.");
}
function newSimulation(){
 const buffer=new Uint32Array(1);
 if(globalThis.crypto?.getRandomValues)crypto.getRandomValues(buffer);
 else buffer[0]=Math.floor(Math.random()*4294967295);
 el("simulationSeed").value=String(buffer[0]);
 simulate();
}
function selectedSources(){
 return usableSources().filter(s=>state.chosen.has(s.id));
}
function compare(){
 if(!state.own.length)applyOwn();
 const sources=selectedSources();
 if(!sources.length)throw Error("En az bir kulüp sistemini işaretle.");
 const num=Number(el("topPerSource").value);
 const result=compareClubSources(state.own,sources,{
  topPerSystem:num,method:num===60?"all":"top",
  minSystems:Number(el("minClubSources").value)});
 state.result=result;
 renderResult();
 toast(result.sourceCount+" sistemin ortak sayıları hesaplandı.");
}
function selectionResult(){
 if(!state.result)return [];
 const type=el("intersectionDisplay").value;
 const r=state.result;
 return type==="all"?r.fullIntersection:
   type==="supported"?r.supported:
   type==="unmatched"?r.unsupported:r.consensus;
}
function renderResult(){
 const r=state.result;if(!r)return;
 const pool=selectionResult(),actual=compareDrawsToPool(state.draws,target(),pool);
 const titles={
  consensus:"En az "+r.minSystems+" sistemde güçlü olan sayılar",
  all:"Bütün seçili sistemlerde ortak sayılar",
  supported:"En az bir sistemle ortak sayılar",
  unmatched:"Kulüp listelerinde görülmeyen sayılar"
 };
 const title=titles[el("intersectionDisplay").value];
 const groups=r.sources.map(s=>{
  const topRows=s.topColumns.filter(x=>x.matched>=3).slice(0,6);
  return '<details><summary>'+esc(s.name)+' · '+s.columns+' kolon · '+
   s.overlap.length+' havuz ortağı · en yüksek '+s.bestOverlap+'/6</summary>'+
   '<div class="lab-ballrow">'+balls(s.overlap)+'</div>'+
   '<p class="lab-muted">Bu sistemin örnek kolonlarında senin havuzundan 3+ sayı taşıyan en iyi örnekler:</p>'+
   (topRows.length?topRows.map(row=>'<div class="club-match-card"><strong class="club-match-count">'+row.matched+
     ' ortak</strong><div class="lab-ballrow">'+balls(row.numbers,row.matching)+'</div></div>').join(""):
    '<p class="lab-muted">3 veya üzeri ortak içeren örnek kolon bulunamadı.</p>')+
   '</details>';
 }).join("");
 el("clubOutput").innerHTML=
 '<div class="club-output-grid">'+
   '<div class="club-summary-tile"><strong>'+r.own.length+'</strong><span>Senin orijinal havuzun</span></div>'+
   '<div class="club-summary-tile"><strong>'+r.sourceCount+'</strong><span>Karşılaştırılan sistem</span></div>'+
   '<div class="club-summary-tile"><strong>'+pool.length+'</strong><span>Seçili ortak sonuç</span></div>'+
 '</div>'+
 '<div class="club-highlight"><h3>'+esc(title)+'</h3>'+
 '<p>Bu liste havuzunu silmez. Sistem başına ilk '+r.topPerSystem+
 ' güçlü sayıya bakıldı. Geçmiş sonuç <strong>tahmin puanlamasına dahil edilmez</strong>.</p>'+
 (pool.length?'<div class="lab-ballrow">'+balls(pool,actual.hits)+'</div>':
 '<div class="club-warning">Bu eşik için ortak sayı yok. Destek eşiğini azalt veya sistem başına aday sayısını artır.</div>')+
 (actual.hasResult?'<p>Gerçekleşmiş #'+target()+' çekilişi ile karşılaştırma: '+actual.hits.length+'/6 sayı (yalnızca geçmiş kontrol).</p>':
 '<p>Bu hedef henüz arşivde yok; gerçek çekiliş sonucu hesaba katılmadı.</p>')+'</div>'+
 '<h3 class="lab-subtitle">Havuzumdaki her sayının sistem desteği</h3>'+
 '<div class="club-votes">'+r.candidateRows.map(row=>
 '<div class="club-vote-row"><span class="lab-ball">'+row.number+'</span>'+
 '<div class="club-vote-main"><strong>'+row.support+' / '+r.sourceCount+' ayrı sistem</strong>'+
 '<small>'+esc(row.systems.join(" · ")||"Seçilen sistemlerde yok")+'</small>'+
 '<div class="club-vote-meter"><i style="width:'+Math.round(100*row.support/r.sourceCount)+'%"></i></div></div>'+
 '<span class="club-vote-count">'+Math.round(row.strength*100)+' puan*</span></div>').join("")+'</div>'+
 '<p class="lab-muted">*Puan, seçilen örnek kolonlardaki görünme oranlarının toplamıdır; çekilişte çıkma olasılığı değildir.</p>'+
 '<h3 class="lab-subtitle">Sistem sistem ortaklar ve örnek kolonlar</h3>'+
 '<div class="club-source-matches">'+groups+'</div>';
}
function savePool(goCoupons=false){
 if(!state.result)throw Error("Önce ortak sayıları hesapla.");
 const numbers=selectionResult();
 if(!numbers.length)throw Error("Ortak havuz boş. Önce eşiği değiştir.");
 if(goCoupons&&numbers.length<6)throw Error("Altılı kupon için en az 6 sayı gerekli. Destek eşiğini azalt.");
 const key="loto-analysis-saved-v1",saved=Array.isArray(get(key))?get(key):[];
 const name="Kulüp Ortakları · "+state.result.sourceCount+" sistem · #"+target();
 const entry={id:"club-"+Date.now()+"-"+Math.random().toString(36).slice(2,5),
  target:target(),kind:"analiz",name,pool:numbers,
  moduleIds:[],created:new Date().toISOString(),source:"Kulüp Ortak Sayı Analizi"};
 saved.unshift(entry);put(key,saved.slice(0,150));
 if(goCoupons){
  // Kupon Atölyesi'nde sonuç havuzunu otomatik seç.
  try{localStorage.setItem("loto-coupon-preferred-source-v1","analiz:"+entry.id)}catch{}
  window.location.href="./lab.html#coupons";
 }else{
  selectOptions();
  toast(numbers.length+" sayı ayrı bir havuz olarak kaydedildi.");
 }
}
function download(){
 if(!state.result)throw Error("Önce ortak sayıları hesapla.");
 const nums=selectionResult();
 const content="LOTO TAHMİN — KULÜP ORTAK SAYILAR\n"+
   "Hedef: #"+target()+"\nSistemler: "+state.result.sources.map(s=>s.name).join(", ")+"\n"+
   "Kendi havuzum: "+state.own.join(", ")+"\n"+
   "Seçili ortaklar: "+nums.join(", ")+"\n"+
   "Orijinal havuz korunmuştur. Ortaklık gelecekteki isabet garantisi değildir.\n";
 const blob=new Blob(["\uFEFF",content],{type:"text/plain;charset=utf-8"}),
 url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="kulup_ortak_"+target()+".txt";document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function init(){
 const values=Array.isArray(get(KEYS.external))?get(KEYS.external):[];
 state.external=values.filter(s=>Array.isArray(s.columns)&&s.columns.length&&Number.isInteger(s.target));
 state.sources=[...state.external];state.external.forEach(s=>{if(s.target===target())state.chosen.add(s.id)});
 selectOptions();
 el("clubStatus").textContent="Gerçek çekiliş arşivi hazırlanıyor…";
 fetch("./data/draws.txt",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Çekiliş arşivi yüklenemedi");return r.text()})
 .then(raw=>{
  state.draws=parseArchive(raw);
  const last=Math.max(...state.draws.keys());el("clubTarget").value=String(last+1);el("clubTarget").max=String(last+1);
  el("clubStatus").textContent=state.draws.size+" kayıt hazır · Son #"+last+" · Karşılaştırma hedefi #"+(last+1);
  selectOptions();applyOwn();sourceList();
 }).catch(err=>{el("clubStatus").textContent="Veri hatası: "+err.message;toast(err.message)});
}
el("applyOwn").onclick=()=>{try{applyOwn()}catch(e){toast(e.message)}};
el("ownSource").onchange=()=>{if(el("ownSource").value!=="manual")try{applyOwn()}catch(e){toast(e.message)}};
el("ownNumbers").addEventListener("input",()=>{el("ownSource").value="manual"});
el("simulateClub").onclick=()=>{try{simulate()}catch(e){toast(e.message)}};
el("shuffleClub").onclick=()=>{try{newSimulation()}catch(e){toast(e.message)}};
el("importExternal").onclick=()=>{try{addExternal()}catch(e){toast(e.message)}};
el("sourceList").addEventListener("change",e=>{
 const id=e.target.dataset.source;if(!id)return;
 if(e.target.checked)state.chosen.add(id);else state.chosen.delete(id);
 sourceList();
});
el("sourceList").addEventListener("click",e=>{
 const id=e.target.closest("[data-delete]")?.dataset.delete;if(!id)return;
 state.external=state.external.filter(x=>x.id!==id);
 state.sources=state.sources.filter(x=>x.id!==id);state.chosen.delete(id);
 put(KEYS.external,state.external);sourceList();toast("Bu kaynak cihazdaki listeden çıkarıldı.");
});
el("compareClub").onclick=()=>{try{compare()}catch(e){toast(e.message)}};
el("intersectionDisplay").onchange=renderResult;
el("saveConsensus").onclick=()=>{try{savePool()}catch(e){toast(e.message)}};
el("sendToCoupons").onclick=()=>{try{savePool(true)}catch(e){toast(e.message)}};
el("exportClub").onclick=()=>{try{download()}catch(e){toast(e.message)}};
el("clubTarget").onchange=()=>{
 state.sources=state.sources.filter(s=>s.kind==="external");
 state.chosen=new Set(state.sources.filter(s=>s.target===target()).map(s=>s.id));
 state.result=null;state.own=[];selectOptions();sourceList();
 el("clubOutput").innerHTML='<p class="lab-empty">Hedef değişti. Kendi havuzunu ve sistemleri yeniden hesapla.</p>';
};
init();
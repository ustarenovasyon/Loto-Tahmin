import {parseArchive} from "./engine.mjs";
import {MODULES,CLUB,buildContext,analyze,compareAnalysisSets,assessPool,historicalCheck,sortedUnique,filterPipeline} from "./analysis-engine.mjs";
import {generateCoupons,clubContest,hexKey} from "./coupon-engine.mjs";
const el=id=>document.getElementById(id);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const balls=(a,hits=[])=>a.map(n=>'<span class="lab-ball '+(hits.includes(n)?"hit":"")+'">'+n+'</span>').join("");
const STORAGE={analysis:"loto-analysis-saved-v1",math:"loto-tahmin-saved-v1",coupons:"loto-coupon-history-v1",history:"loto-coupon-seen-v1",club:"loto-club-history-v1",customTeams:"loto-custom-club-teams-v1"};
const state={draws:null,ctx:null,selection:new Set(["dna","limit","matrix","hot"]),results:[],saved:[],math:[],chosen:new Set(),combined:[],coupons:null,couponHistory:[],pipeline:null,seen:[],club:null,clubHistory:[],customTeams:[]};
const fmt=x=>Number(x).toLocaleString("tr-TR",{maximumFractionDigits:2});
function store(key,content){try{localStorage.setItem(key,JSON.stringify(content))}catch{}}
function recall(key){try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}}
function toast(message){const t=el("labToast");t.textContent=message;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3100)}
function getSettings(){
 const target=Number(el("labTarget").value),window=Number(el("labWindow").value),limit=Number(el("labLimit").value);
 if(!Number.isInteger(limit)||limit<6||limit>60)throw Error("Analiz havuzu büyüklüğü 6–60 arasında olmalı.");
 return {target,window,limit};
}
function getCtx(){
 if(!state.draws)throw Error("Çekilişler henüz yüklenmedi.");
 const options=getSettings();
 if(!state.ctx||state.ctx.target!==options.target||state.ctx.window!==options.window){
  state.ctx=buildContext(state.draws,options.target,options.window);state.results=[];state.combined=[];
 }
 return state.ctx;
}
function drawModules(){
 const section=el("labModules"),cats=[...new Set(MODULES.map(x=>x.category))];
 section.innerHTML=cats.map(cat=>'<div class="lab-mod-group">'+esc(cat.toUpperCase())+'</div>'+
   MODULES.filter(m=>m.category===cat).map(m=>
    '<label class="lab-mod '+(state.selection.has(m.id)?"selected":"")+'"><input type="checkbox" data-module="'+m.id+'" '+(state.selection.has(m.id)?"checked":"")+
    '><span><strong>'+esc(m.name)+'</strong><small>'+esc(m.description)+'</small></span></label>').join("")).join("");
 el("selectedSummary").textContent=state.selection.size+" analiz seçildi";
}
function renderResult(){
 const parent=el("labResults");
 if(!state.results.length){parent.innerHTML='<p class="lab-empty">Henüz çalıştırılmış analiz yok.</p>';return}
 const actual=state.draws.get(state.ctx.target)?.numbers||[];
 parent.innerHTML=state.results.map(r=>{
  const hit=assessPool(state.ctx,r.selected);
  return '<div class="lab-card"><div class="lab-card-head"><strong>'+esc(r.name)+'</strong>'+
   '<small>#'+r.target+' · '+r.window+' geçmiş çekiliş</small></div>'+
   '<p>'+esc(MODULES.find(m=>m.id===r.id)?.description||"")+'</p>'+
   '<div class="lab-ballrow">'+balls(r.selected,hit.hits)+'</div>'+
   '<div class="lab-card-footer"><span>'+r.selected.length+' farklı sayı · '+(hit.hasResult?hit.hits.length+'/6 geçmiş isabet':'Henüz çekilmedi')+
   '</span><button type="button" data-save-analysis="'+r.id+'">＋ Kaydet</button></div></div>';
 }).join("");
}
function analyzeSelected(){
 if(!state.selection.size)throw Error("En az bir analiz seç.");
 const ctx=getCtx(),limit=getSettings().limit;
 state.results=[...state.selection].map(id=>analyze(ctx,id,limit));
 renderResult();
 toast(state.results.length+" analiz hesaplandı. Sonuçları ayrı ayrı kaydedebilirsin.");
}
function makeSavedEntry(name,pool,moduleIds){
 return{id:"a-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7),
  target:getSettings().target,name,pool:sortedUnique(pool),moduleIds:[...moduleIds],
  created:new Date().toISOString(),kind:"analiz"};
}
function saveAllAnalyses(){
 if(!state.results.length)return toast("Önce analizleri çalıştır.");
 for(const r of state.results)state.saved.unshift(makeSavedEntry(r.name+" · #"+r.target,r.selected,[r.id]));
 state.saved=state.saved.slice(0,150);store(STORAGE.analysis,state.saved);drawSaved();
 toast(state.results.length+" ayrı analiz sonucu kaydedildi.");
}
function saveModule(id){
 const r=state.results.find(x=>x.id===id);if(!r)return;
 state.saved.unshift(makeSavedEntry(r.name+" · #"+r.target,r.selected,[id]));
 state.saved=state.saved.slice(0,150);
 store(STORAGE.analysis,state.saved);drawSaved();toast(r.name+" havuzu kaydedildi.");
}
function loadSaved(){
 state.saved=Array.isArray(recall(STORAGE.analysis))?recall(STORAGE.analysis):[];
 state.math=Array.isArray(recall(STORAGE.math))?recall(STORAGE.math):[];
 state.couponHistory=Array.isArray(recall(STORAGE.coupons))?recall(STORAGE.coupons):[];
 state.seen=Array.isArray(recall(STORAGE.history))?recall(STORAGE.history):[];
 state.clubHistory=Array.isArray(recall(STORAGE.club))?recall(STORAGE.club):[];
 state.customTeams=Array.isArray(recall(STORAGE.customTeams))?recall(STORAGE.customTeams):[];
}
function allSaved(){
 return [...state.saved,...state.math.map(m=>({...m,name:"∑ "+(m.name||"Matematik"),kind:"matematik",pool:sortedUnique(m.pool||[])}))];
}
function drawSaved(){
 state.math=Array.isArray(recall(STORAGE.math))?recall(STORAGE.math):[];
 const all=allSaved(),target=Number(el("labTarget").value);
 el("labSaved").innerHTML=all.length?all.map(m=>{
  const eligible=m.target===target,key=m.kind+":"+m.id;
  return '<label class="lab-saved-row"><input type="checkbox" data-pool-key="'+esc(key)+'" '+(state.chosen.has(key)?"checked":"")+
   (!eligible?" disabled":"")+'><span><b>'+esc(m.name||"Adsız havuz")+'</b><small>'+
   (m.kind==="matematik"?"Matematik":"Analiz")+' · #'+m.target+' · '+m.pool.length+' sayı'+(!eligible?" · Farklı hedef":"")+
   '</small></span>'+(m.kind==="analiz"?'<button type="button" data-delete="'+esc(m.id)+'">Sil</button>':"")+'</label>';
 }).join(""):'<p class="lab-empty">Henüz kayıt bulunmuyor. Analiz kartlarından veya manuel matematik ekranından havuz kaydedebilirsin.</p>';
 const selected=el("couponPool").value,source=el("pipelineSource").value;
 const records=all.filter(m=>m.target===target&&m.pool.length>=6);
 const html=records.map(m=>'<option value="'+esc(m.kind+":"+m.id)+'">'+esc(m.name||m.id)+" · "+m.pool.length+" sayı</option>").join("");
 el("couponPool").innerHTML='<option value="">Sadece seçtiğim analizler</option>'+
   (state.pipeline?.result?.remaining?.length>=6?'<option value="pipeline">Son aşamalı süzgeç · '+state.pipeline.result.remaining.length+' sayı</option>':"")+html;
 if(selected==="pipeline"&&state.pipeline?.result?.remaining?.length>=6)el("couponPool").value="pipeline";
 else if(records.some(x=>x.kind+":"+x.id===selected))el("couponPool").value=selected;
 el("pipelineSource").innerHTML='<option value="">Kayıtlı havuz seç</option>'+html;
 if(records.some(x=>x.kind+":"+x.id===source))el("pipelineSource").value=source;
}
function poolByKey(key){return allSaved().find(s=>(s.kind+":"+s.id)===key)}
function combine(){
 getCtx();
 const all=[...state.chosen].map(poolByKey).filter(x=>x&&x.target===state.ctx.target);
 if(!all.length){el("labCombined").innerHTML='<p class="lab-empty">Aynı hedefe ait en az bir havuz işaretle.</p>';return toast("Önce havuz seç.")}
 state.combined=compareAnalysisSets(all.map(x=>({selected:x.pool})),el("labCombine").value);
 const hit=assessPool(state.ctx,state.combined);
 el("labCombined").innerHTML='<div class="lab-card"><div class="lab-card-head"><strong>'+state.combined.length+
   ' farklı sayı · '+all.length+' havuz</strong><small>'+(hit.hasResult?hit.hits.length+'/6 isabet':'Henüz çekilmedi')+
   '</small></div><div class="lab-ballrow">'+balls(state.combined,hit.hits)+'</div></div>';
}
function saveCombined(){
 if(!state.combined.length)return toast("Önce havuzları birleştir.");
 const label=el("labPoolName").value.trim()||"Ortak havuz · #"+state.ctx.target;
 state.saved.unshift(makeSavedEntry(label,state.combined,[]));state.saved=state.saved.slice(0,150);
 store(STORAGE.analysis,state.saved);drawSaved();toast("Birleşik havuz kaydedildi.");
}
function dl(filename,content,type="text/plain;charset=utf-8"){
 const blob=new Blob(["\uFEFF",content],{type}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadPool(){
 if(!state.combined.length)return toast("Önce havuz oluştur.");
 dl("loto_ortak_havuz_"+state.ctx.target+".txt","Hedef: #"+state.ctx.target+"\nSayılar: "+state.combined.join(", ")+"\n");
}
function table(html){return '<div class="lab-table-wrapper"><table class="lab-table">'+html+'</table></div>'}
async function backtest(){
 if(!state.selection.size)return toast("Önce analiz seç.");
 const ctx=getCtx(),settings=getSettings(),count=Number(el("labTestCount").value),btn=el("testNow");
 btn.disabled=true;btn.textContent="Hesaplanıyor…";
 await new Promise(r=>setTimeout(r,20));
 try{
  const result=historicalCheck(state.draws,{target:ctx.target,moduleIds:[...state.selection],count,limit:settings.limit,window:settings.window});
  const hist=Object.entries(result.histogram).map(([k,v])=>'<span>'+k+' isabet: <b>'+v+'</b></span>').join(" · ");
  el("labBacktest").innerHTML='<div class="lab-card"><strong>Seçilen analizlerin geçmiş testi</strong>'+
   '<p>Her geçmiş çekiliş kendi önceki verisiyle hesaplandı; hedef sonuç yalnızca puanlama için kullanıldı.</p>'+
   '<div class="lab-stats"><div><strong>'+result.rows.length+'</strong><span>Test edilen çekiliş</span></div>'+
   '<div><strong>'+fmt(result.average)+'</strong><span>Ortalama isabet · farklı büyüklükte havuzlar</span></div></div>'+
   '<p>'+hist+'</p>'+table('<thead><tr><th>Çekiliş</th><th>Havuz büyüklüğü</th><th>Gerçek isabet</th></tr></thead><tbody>'+
   result.rows.map(x=>'<tr><td>#'+x.id+'</td><td>'+x.poolSize+'</td><td class="'+(x.hits>=3?"lab-good":"")+'">'+x.hits+' / 6 · '+x.hitNumbers.join(", ")+'</td></tr>').join("")+'</tbody>')+'</div>';
 }catch(e){toast(e.message)}
 finally{btn.disabled=false;btn.textContent="▤ Geçmişte kontrol et"}
}
function runPipeline(){
 const ctx=getCtx(),source=poolByKey(el("pipelineSource").value);
 if(!source||source.target!==ctx.target)return toast("Süzgeç için bu hedefe ait bir havuz seç.");
 if(!state.selection.size)return toast("Süzmek için en az bir analiz seç.");
 const limit=getSettings().limit,results=[...state.selection].map(id=>analyze(ctx,id,limit));
 const result=filterPipeline(source.pool,results,{keepAtLeast:Number(el("pipelineMinimum").value),
   order:el("pipelineOrder").value});
 state.pipeline={sourceName:source.name,sourceId:source.id,modules:[...state.selection],result,target:ctx.target};
 const hits=assessPool(ctx,result.remaining);
 el("pipelineReport").innerHTML='<div class="lab-stats"><div><strong>'+result.source.length+
   '</strong><span>Orijinal havuz</span></div><div><strong>'+result.removed.length+
   '</strong><span>Çıkarılan sayı</span></div><div><strong>'+result.remaining.length+
   '</strong><span>Kalan sayı</span></div></div>'+
   '<div class="lab-ballrow">'+balls(result.remaining,hits.hits)+'</div>'+
   '<p class="lab-muted">Geçmiş hedef isabeti: '+(hits.hasResult?hits.hits.length+'/6':'Henüz belli değil')+
   ' · Kaynak havuz değiştirilmedi.</p>'+
   table('<thead><tr><th>Süzgeç</th><th>Önce</th><th>Sonra</th><th>Durum</th></tr></thead><tbody>'+
     result.journal.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+x.before+'</td><td>'+x.after+
       '</td><td>'+esc(x.reason)+'</td></tr>').join("")+'</tbody>');
 drawSaved();toast("Aşamalı süzme tamamlandı; "+result.remaining.length+" sayı kaldı.");
}
function savePipeline(){
 const p=state.pipeline;if(!p)return toast("Önce aşamalı süzgeci çalıştır.");
 state.saved.unshift(makeSavedEntry("Süzgeç · "+p.sourceName+" · "+p.modules.length+" analiz",p.result.remaining,p.modules));
 state.saved=state.saved.slice(0,150);store(STORAGE.analysis,state.saved);
 drawSaved();toast("Süzülen havuz ayrı bir kayıt olarak saklandı.");
}
function backupAll(){
 const keys=Object.values(STORAGE),payload={format:"loto-tahmin-workspace",version:1,
   exported:new Date().toISOString(),keys:Object.fromEntries(keys.map(k=>[k,recall(k)]))};
 dl("loto_tum_calismalarim_"+new Date().toISOString().slice(0,10)+".json",
   JSON.stringify(payload,null,2),"application/json;charset=utf-8");
}
async function importBackup(file){
 if(!file)return;
 if(file.size>3_000_000)throw Error("Yedek dosyası 3 MB üzerinde.");
 const data=JSON.parse(await file.text());
 if(data?.format!=="loto-tahmin-workspace"||data.version!==1||!data.keys||typeof data.keys!=="object")
   throw Error("Geçerli Loto Tahmin yedeği değil.");
 if(!window.confirm("Bu yedek cihazdaki mevcut havuz, kupon ve yarışma kayıtlarının üzerine yazacak. Onaylıyor musun?"))return;
 for(const k of Object.values(STORAGE)){
   const v=data.keys[k];
   if(v!==undefined&&v!==null&&Array.isArray(v))store(k,v);
 }
 loadSaved();state.chosen.clear();state.pipeline=null;drawSaved();drawCouponHistory();drawTeams();
 toast("Kayıtlar yedekten geri yüklendi.");
}
function savedPoolForCoupon(){
 const option=el("couponPool").value;
 return option==="pipeline"?(state.pipeline?.result.remaining||[]):option?poolByKey(option)?.pool||[]:[];
}
function makeCoupons(){
 const ctx=getCtx(),ids=[...state.selection];if(!ids.length)throw Error("Kupon için analiz seç.");
 const requested=Number(el("couponCount").value),manualPool=savedPoolForCoupon();
 const result=generateCoupons({ctx,moduleIds:ids,count:requested,limit:getSettings().limit,manualPool,
   strict:el("couponStrict").value==="strict",seen:state.seen});
 state.coupons=result;
 state.seen=[...new Set([...state.seen,...result.coupons.map(hexKey)])].slice(-1000);
 store(STORAGE.history,state.seen);
 renderCoupons();
 toast(result.coupons.length+" yeni ve birbirinden farklı kupon oluşturuldu.");
}
function renderCoupons(){
 const r=state.coupons;if(!r)return;
 const actual=state.draws.get(r.target)?.numbers||[];
 el("couponResult").innerHTML='<div class="lab-card-head"><strong>#'+r.target+' için '+r.coupons.length+' yeni kupon</strong><small>'+
   r.ids.length+' analiz seçili · '+(actual.length?"Geçmiş test":"Gelecek adayları")+'</small></div>'+
   r.details.map(x=>'<div class="lab-ticket"><strong>Kolon '+String(x.row).padStart(2,"0")+'</strong>'+
   '<div class="lab-ballrow">'+balls(x.numbers,x.matches)+'</div><small>Toplam '+x.metrics.total+
   ' · '+x.metrics.odd+' tek / '+x.metrics.even+' çift'+(actual.length?" · "+x.matches.length+"/6 isabet":"")+
   '</small></div>').join("")+
   '<p class="lab-muted">Yeni çalışmada kuponlar tekrar hesaplanır; geçmişte üretilenlerin aynısını vermemeye çalışır. Hiçbir yöntem 4–5 bilme garantisi sunamaz.</p>';
}
function drawCouponHistory(){
 el("couponHistory").innerHTML=state.couponHistory.length?state.couponHistory.slice(0,12).map((r,i)=>
  '<div class="lab-saved-row"><span><b>'+esc(r.name||"Kupon çalışması")+'</b><small>#'+r.target+" · "+r.coupons.length+
  ' kupon · '+r.ids.length+' analiz · '+esc(r.created?.slice(0,10)||"")+'</small></span>'+
  '<button type="button" data-load-coupon="'+i+'">Aç</button></div>').join(""):
  '<p class="lab-empty">Henüz kupon çalışması kaydedilmedi.</p>';
}
function saveCoupons(){
 const r=state.coupons;if(!r)return toast("Önce kupon çalışması oluştur.");
 const name=window.prompt("Çalışma adı", "Kupon · #"+r.target+" · "+r.coupons.length+" kolon");
 if(name===null)return;
 state.couponHistory.unshift({...r,name:name.trim()||"Kupon çalışması"});
 state.couponHistory=state.couponHistory.slice(0,40);store(STORAGE.coupons,state.couponHistory);drawCouponHistory();
 toast("Kupon çalışması kaydedildi.");
}
function downloadCoupons(){
 const r=state.coupons;if(!r)return toast("Önce kupon oluştur.");
 const head=["Kolon","Hedef","Sayı 1","Sayı 2","Sayı 3","Sayı 4","Sayı 5","Sayı 6","Analizler"];
 const rows=[head.join(";")];r.coupons.forEach((nums,i)=>rows.push([i+1,r.target,...nums,r.ids.join("+")].join(";")));
 dl("kuponlar_"+r.target+".csv",rows.join("\r\n"),"text/csv;charset=utf-8");
}
function drawTeams(){
 const teams=[...CLUB,...state.customTeams];
 el("clubTeams").innerHTML=teams.map(t=>'<div class="lab-team"><strong>♜ '+esc(t.name)+'</strong><small>'+
   t.modules.map(id=>MODULES.find(m=>m.id===id)?.name||id).join(" · ")+'</small></div>').join("");
 el("clubCustomTeams").innerHTML=state.customTeams.length?state.customTeams.map(t=>
  '<div class="lab-saved-row"><span><b>'+esc(t.name)+'</b><small>'+t.modules.map(id=>esc(MODULES.find(m=>m.id===id)?.name||id)).join(" + ")+'</small></span>'+
  '<button type="button" data-remove-club="'+esc(t.id)+'">Sil</button></div>').join(""):'<p class="lab-muted">İstersen kendine özel yarışmacılar oluşturabilirsin.</p>';
}
function addClubTeam(){
 const ids=[...state.selection];if(!ids.length)return toast("Takım için en az bir analiz seç.");
 const name=el("clubCustomName").value.trim()||"Benim Sistem "+(state.customTeams.length+1);
 if(state.customTeams.length>=12)return toast("En fazla 12 özel yarışmacı oluşturabilirsin.");
 state.customTeams.push({id:"custom-"+Date.now(),name,modules:ids});
 store(STORAGE.customTeams,state.customTeams);drawTeams();el("clubCustomName").value="";
 toast("Yeni sistem kulübe eklendi.");
}
async function runClub(){
 const ctx=getCtx(),period=Number(el("clubPeriod").value),seed=Number(el("clubSeed").value),btn=el("runClub");
 btn.disabled=true;btn.textContent="Sistemler yarıştırılıyor…";await new Promise(r=>setTimeout(r,20));
 try{state.club=clubContest(state.draws,{target:ctx.target,window:ctx.window,period,seed,teams:[...CLUB,...state.customTeams]});drawClub();toast("Kulüp sonuçları hesaplandı.")}
 catch(e){toast("Yarışma hatası: "+e.message)}
 finally{btn.disabled=false;btn.textContent="♜ Sistemleri yarıştır"}
}
function drawClub(){
 const r=state.club;if(!r)return;const first=r.records[0];
 el("clubResult").innerHTML='<div class="lab-stats"><div><strong>'+r.records.length+'</strong><span>Bağımsız sistem</span></div>'+
 '<div><strong>'+first.runs+'</strong><span>Geçmiş test / sistem</span></div>'+
 '<div><strong>'+fmt(first.average)+'</strong><span>En yüksek ortalama (altılı)</span></div></div>'+
 table('<thead><tr><th>Sıra / Sistem</th><th>Test</th><th>Ort. isabet</th><th>2+ / 3+ / 4+</th><th>Hedef için altılı</th></tr></thead><tbody>'+
 r.records.map((x,i)=>'<tr><td><b>'+(i+1)+'. '+esc(x.name)+'</b><small class="lab-muted"><br>'+x.modules.join(" + ")+'</small></td>'+
 '<td>'+x.runs+'</td><td>'+fmt(x.average)+'</td><td>'+x.hitCounts.slice(2).reduce((a,b)=>a+b,0)+
 ' / '+x.hitCounts.slice(3).reduce((a,b)=>a+b,0)+' / '+x.hitCounts.slice(4).reduce((a,b)=>a+b,0)+
 '</td><td>'+balls(x.next)+'</td></tr>').join("")+'</tbody>')+
 '<p class="lab-muted">6 sayılık bir kolonun 6/60 oyununda rastgele beklenen isabeti 0,6 sayıdır. Yarışma geçmişe dair bir karşılaştırmadır; yüksek sıra gelecek başarı garantisi değildir.</p>';
}
function saveClub(){
 if(!state.club)return toast("Önce yarışma çalıştır.");
 state.clubHistory.unshift({date:new Date().toISOString(),target:state.club.target,period:state.club.period,
  leaders:state.club.records.map(x=>({id:x.id,name:x.name,average:x.average}))});
 state.clubHistory=state.clubHistory.slice(0,30);store(STORAGE.club,state.clubHistory);toast("Kulüp karşılaştırması kaydedildi.");
}
async function start(){
 loadSaved();drawModules();drawTeams();drawSaved();drawCouponHistory();
 try{
  const response=await fetch("./data/draws.txt",{cache:"no-store"});if(!response.ok)throw Error("Veri yüklenemedi.");
  state.draws=parseArchive(await response.text());
  const last=Math.max(...state.draws.keys());
  el("labTarget").value=String(last+1);el("labTarget").max=String(last+1);
  el("labStatus").textContent=state.draws.size+" arşiv çekilişi hazır · Son #"+last+
   " · Gelecek hedef #"+(last+1)+" · Hesaplar hedef çekilişten önceki verileri kullanır.";
  drawSaved();analyzeSelected();
 }catch(e){el("labStatus").textContent="Hata: "+e.message;toast(e.message)}
}
el("labModules").addEventListener("change",e=>{
 const id=e.target.dataset.module;if(!id)return;
 if(e.target.checked)state.selection.add(id);else state.selection.delete(id);drawModules();
});
el("selectAll").onclick=()=>{state.selection=new Set(MODULES.map(x=>x.id));drawModules()};
el("deselectAll").onclick=()=>{state.selection.clear();drawModules()};
el("labResults").addEventListener("click",e=>{const id=e.target.closest("[data-save-analysis]")?.dataset.saveAnalysis;if(id)saveModule(id)});
el("analyzeNow").onclick=()=>{try{analyzeSelected()}catch(e){toast(e.message)}};
el("saveAllAnalyses").onclick=saveAllAnalyses;
el("testNow").onclick=backtest;
el("labSaved").addEventListener("change",e=>{
 const key=e.target.dataset.poolKey;if(!key)return;
 if(e.target.checked)state.chosen.add(key);else state.chosen.delete(key);
});
el("labSaved").addEventListener("click",e=>{
 const id=e.target.closest("[data-delete]")?.dataset.delete;if(!id)return;
 state.saved=state.saved.filter(x=>x.id!==id);store(STORAGE.analysis,state.saved);state.chosen.delete("analiz:"+id);drawSaved();
});
el("combineNow").onclick=combine;
el("saveCombined").onclick=saveCombined;
el("downloadPool").onclick=downloadPool;
el("runPipeline").onclick=()=>{try{runPipeline()}catch(e){toast(e.message)}};
el("savePipeline").onclick=savePipeline;
el("exportBackup").onclick=backupAll;
el("importBackup").addEventListener("change",async e=>{
 try{await importBackup(e.target.files?.[0])}catch(err){toast("Yedek hatası: "+err.message)}
 e.target.value="";
});
el("makeCoupons").onclick=()=>{try{makeCoupons()}catch(e){toast(e.message)}};
el("saveCoupons").onclick=saveCoupons;
el("downloadCoupons").onclick=downloadCoupons;
el("couponHistory").addEventListener("click",e=>{
 const i=e.target.closest("[data-load-coupon]")?.dataset.loadCoupon;
 if(i===undefined)return;
 const saved=state.couponHistory[Number(i)];if(!saved)return;
 state.coupons=saved;renderCoupons();el("couponResult").scrollIntoView({behavior:"smooth",block:"start"});
});
el("addClubTeam").onclick=addClubTeam;
el("clubCustomTeams").addEventListener("click",e=>{
 const id=e.target.closest("[data-remove-club]")?.dataset.removeClub;if(!id)return;
 state.customTeams=state.customTeams.filter(t=>t.id!==id);
 store(STORAGE.customTeams,state.customTeams);drawTeams();
});
el("runClub").onclick=runClub;
el("saveClub").onclick=saveClub;
el("labTarget").addEventListener("change",()=>{state.ctx=null;state.results=[];state.chosen.clear();state.pipeline=null;drawSaved();el("labResults").innerHTML='<p class="lab-empty">Hedef değişti. Analizleri yeniden çalıştır.</p>'});
el("labWindow").addEventListener("change",()=>{state.ctx=null;state.results=[]});
start();
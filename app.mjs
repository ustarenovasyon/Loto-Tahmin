import {parseArchive,runStrategy,filterPool,combinePools,MODE_LABELS} from "./engine.mjs";
const $=id=>document.getElementById(id);
const state={draws:null,mode:"add",current:null,saved:[],lastCombined:[],lastFiltered:[],activeTarget:975};
const STORAGE="loto-tahmin-saved-v1";
const FORM_KEYS=["seedDivisor","divisor","factor","increment","amount","stepCount","addCustom","addValue"];
const MODE_FIELDS={add:["seedDivisor","stepCount","addCustom"],divide:["divisor","stepCount"],multiply:["seedDivisor","factor","stepCount"],divisors:["divisor","increment","stepCount"],subtract:["amount","stepCount"]};
const DEFAULTS={
 add:{seedDivisor:"100",stepCount:"10",addCustom:false,addValue:"10"},
 divide:{divisor:"2",stepCount:"9"},multiply:{seedDivisor:"100",factor:"2",stepCount:"7"},
 divisors:{divisor:"2",increment:"1",stepCount:"20"},subtract:{amount:"100",stepCount:"10"}
};
const modes=structuredClone(DEFAULTS);
let timer=null;
const safe=x=>String(x??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const balls=(nums,hits=[],extra="")=>nums.map(n=>'<span class="ball '+(hits.includes(n)?"hit ":"")+extra+'">'+n+'</span>').join("");
const toast=(message)=>{const node=$("toast");node.textContent=message;node.classList.add("show");clearTimeout(window._toastTimer);window._toastTimer=setTimeout(()=>node.classList.remove("show"),2800)};
function currentTarget(){return Number($("targetInput").value)}
function updateTarget(){
  const target=currentTarget();state.activeTarget=target;
  if(state.draws?.has(target))$("targetNumbers").innerHTML=balls(state.draws.get(target).numbers,[],"target");
  else {
    const valid=Number.isSafeInteger(target)&&target>=2;
    const latest=state.draws?Math.max(...state.draws.keys()):0;
    const message=!valid?"1’den büyük bir tam sayı gir.":target>latest?
      "Sonuç bekleniyor. Geçmiş gerçek çekilişlerden aday havuzu hesaplanabilir.":
      "Hedef sonucu arşivde yok. Mevcut geçmiş çekilişlerden aday havuzu hesaplanabilir.";
    $("targetNumbers").innerHTML='<span class="muted">'+message+'</span>';
  }
}
function collectConfig(){
  const cfg={mode:state.mode,count:Number($("stepCount").value)};
  for(const k of FORM_KEYS){
    if(k==="stepCount")continue;
    cfg[k]=k==="addCustom"?$(k).checked:$(k).value;
  }
  return cfg;
}
function loadConfig(mode){
  const cfg=modes[mode];for(const k of FORM_KEYS){
    const node=$(k);if(k==="stepCount")node.value=cfg.stepCount??10;
    else if(k==="addCustom")node.checked=Boolean(cfg.addCustom);
    else if(cfg[k]!==undefined)node.value=cfg[k];
  }
  $("addValue").classList.toggle("hidden",!$("addCustom").checked);
}
function switchMode(mode){
  if(!MODE_FIELDS[mode])return;
  if(state.mode!==mode)modes[state.mode]=collectConfig();
  state.mode=mode;
  loadConfig(mode);
  document.querySelectorAll("[data-mode]").forEach(el=>{
    const active=el.dataset.mode===mode;el.classList.toggle("active",active);el.setAttribute("aria-selected",String(active));
  });
  document.querySelectorAll("[data-field]").forEach(el=>el.classList.toggle("hidden",!MODE_FIELDS[mode].includes(el.dataset.field)));
  scheduleRun(0);
}
function updateActiveResults(){
  if(!state.current)return;
  const result=state.current,goal=result.targetNumbers,known=result.hasTargetResult;
  $("resultsArea").classList.remove("hidden");
  $("resultCaption").textContent=MODE_LABELS[result.config.mode]+" · Hedef #"+result.target+" · Sınırdaki sayılar korunuyor";
  const metrics=[{v:result.steps.length,k:"Gerçekleşen adım"},{v:result.totalPicked,k:"Toplanan sayı kaydı"},{v:result.pool.length,k:"Benzersiz sayı"},{v:known?result.hits.length+"/6":"Bekleniyor",k:known?"Hedef eşleşmesi":"Hedef sonucu",positive:known}];
  $("resultMetrics").innerHTML=metrics.map(x=>'<div class="metric '+(x.positive?"positive":"")+'"><strong>'+x.v+'</strong><span>'+x.k+'</span></div>').join("");
  $("poolCount").textContent=known?result.hits.length+" hedef sayısı: "+(result.hits.join(", ")||"yok"):"Aday havuzu · Sonuç arşive eklendiğinde eşleşmeler hesaplanır.";
  $("poolNumbers").innerHTML=balls(result.pool,goal);
  $("stepRows").innerHTML=result.steps.map(s=>{
    const src=s.upperId===null?"#"+s.lowerId+" · tamamı":
      "#"+s.lowerId+" son "+s.lowerCount+" + #"+s.upperId+" ilk "+s.upperCount;
    const info=s.upperId===null?"6 sayı":(s.lowerCount+s.upperCount)+" sayı / "+s.lowerCount+"+"+s.upperCount;
    return '<tr><td><span class="index">'+s.step+'. ADIM</span><br><span class="refval">'+safe(s.reference)+'</span></td><td><span class="pickfrom">'+src+'</span><small>'+info+'</small></td><td>'+balls(s.numbers,goal)+'</td><td>'+(!known?'<span class="no-hit">Bekleniyor</span>':s.hits.length?'<span class="matches">'+s.hits.join(", ")+' ('+s.hits.length+')</span>':'<span class="no-hit">—</span>')+'</td><td><strong>'+(known?s.cumulativeHits.length+'/6':'—')+'</strong><br><small>'+s.cumulativeUnique+' farklı</small></td></tr>';
  }).join("");
  const warn=$("strategyWarning");warn.classList.toggle("hidden",!result.warnings.length);warn.textContent=result.warnings.join(" ");
  const c=result.config;
  $("strategyName").placeholder="#"+result.target+" · "+MODE_LABELS[c.mode]+" · "+result.steps.length+" adım";
}
function run(silent=false){
  if(!state.draws)return;
  updateTarget();
  try{
    const cfg=collectConfig();
    state.current=runStrategy(cfg,state.draws,currentTarget());
    modes[state.mode]=cfg;
    updateActiveResults();
    if(!silent)toast("Hesaplandı: "+state.current.pool.length+" farklı sayı, "+(state.current.hasTargetResult?state.current.hits.length+"/6 eşleşme":"sonuç bekleniyor"));
  }catch(err){state.current=null;$("resultsArea").classList.add("hidden");if(!silent)toast("Hata: "+err.message);else{ $("strategyWarning").textContent=err.message;$("strategyWarning").classList.remove("hidden")}}
  updateCompare();
}
function invalidateResult(){state.current=null;$("resultsArea").classList.add("hidden")}
function scheduleRun(delay=300){invalidateResult();clearTimeout(timer);timer=setTimeout(()=>run(true),delay)}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state.saved))}catch{}}
function loadSaved(){try{const x=JSON.parse(localStorage.getItem(STORAGE)||"[]");state.saved=Array.isArray(x)?x.slice(0,60).filter(s=>Array.isArray(s.pool)&&s.config&&Number.isInteger(s.target)):[]}catch{state.saved=[]}}
function save(){
  const r=state.current;if(!r)return toast("Önce stratejiyi çalıştır.");
  const label=$("strategyName").value.trim()||"#"+r.target+" · "+MODE_LABELS[r.config.mode]+" · "+r.steps.length+" adım";
  state.saved.unshift({id:Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7),target:r.target,name:label,config:r.config,pool:r.pool,active:true,date:new Date().toISOString()});
  if(state.saved.length>60)state.saved.length=60;
  $("strategyName").value="";persist();renderSaved();updateCompare();toast("Strateji kaydedildi. Ortak havuzda görünüyor.");
  $("compareTitle").scrollIntoView({behavior:"smooth",block:"start"});
}
function renderSaved(){
  const target=currentTarget();
  $("savedStrategies").innerHTML=state.saved.length?state.saved.map(s=>{
    const same=s.target===target;
    const count=s.pool.length;
    return '<div class="saved-item '+(s.active&&same?"active":"")+'"><input class="toggle" type="checkbox" '+(s.active&&same?"checked":"")+(same?"":" disabled")+' data-toggle="'+safe(s.id)+'" aria-label="Karşılaştırmaya dahil et"><div class="saved-details"><strong>'+safe(s.name)+'</strong><small>#'+s.target+" · "+safe(MODE_LABELS[s.config.mode]||s.config.mode)+" · "+count+' sayı'+(!same?" · Farklı hedef":"")+'</small></div><span class="mini">'+count+'</span><button type="button" data-remove="'+safe(s.id)+'" aria-label="Kaydı sil">×</button></div>';
  }).join(""):'<p class="empty">Henüz kayıt yok. Bir stratejiyi çalıştırıp <strong>Bu stratejiyi kaydet</strong> düğmesine dokun.</p>';
}
function updateCompare(){
  if(!state.draws)return;
  const target=currentTarget(),eligible=state.saved.filter(s=>s.target===target&&s.active);
  const op=document.querySelector('input[name="combine"]:checked')?.value||"intersection";
  const combined=combinePools(eligible.map(s=>s.pool),op);
  const targetNums=state.draws.get(target)?.numbers||[],known=state.draws.has(target);
  state.lastCombined=combined;
  const hit=combined.filter(n=>targetNums.includes(n));
  $("compareStats").innerHTML=eligible.length?'<strong>'+combined.length+' farklı sayı</strong> <span>· '+eligible.length+' seçili havuz · '+(op==="intersection"?"Ortaklar":"Birleşim")+' · '+(known?'<b>'+hit.length+'/6</b> hedef eşleşmesi':'Sonuç bekleniyor')+'</span>':'<span>Karşılaştırmak için yukarıdan bir veya daha fazla strateji seç.</span>';
  $("combinedNumbers").innerHTML=balls(combined,targetNums);
  const options={frequencyEnabled:$("frequencyEnabled").checked,lookback:$("lookback").value,threshold:$("threshold").value,excludeLatest:$("excludeLatest").checked,excludeDraws:$("excludeDraws").value,excludeNumbers:$("excludeNumbers").value};
  const active=options.frequencyEnabled||options.excludeLatest||String(options.excludeDraws).trim()||String(options.excludeNumbers).trim();
  const filter=filterPool(combined,state.draws,target,options),filteredHit=filter.remaining.filter(n=>targetNums.includes(n));
  state.lastFiltered=filter.remaining;
  const box=$("filteredResult");box.classList.toggle("hidden",!active||eligible.length===0);
  box.innerHTML='<strong>Filtre sonrası: '+filter.remaining.length+' sayı · '+(known?filteredHit.length+'/6 eşleşme':'Sonuç bekleniyor')+'</strong><p>Çıkarılan: '+(filter.removed.map(x=>x.number).join(", ")||"yok")+'</p><div class="number-grid">'+balls(filter.remaining,targetNums)+'</div>';
}
function download(filename,contents,mime){
  const blob=new Blob(["\uFEFF",contents],{type:mime||"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function exportSteps(){
  if(!state.current)return toast("Önce hesapla.");
  const r=state.current;
  const quote=v=>'"'+String(v??"").replaceAll('"','""')+'"';
  const lines=[["Adım","Referans","Alt çekiliş","Alt adedi","Üst çekiliş","Üst adedi","Seçilen sayılar","Eşleşme","Birikimli eşleşme","Birikimli havuz"]];
  r.steps.forEach(s=>lines.push([s.step,s.reference,s.lowerId,s.lowerCount,s.upperId??"",s.upperCount,s.numbers.join(" "),r.hasTargetResult?s.hits.join(" "):"Sonuç bekleniyor",r.hasTargetResult?s.cumulativeHits.length:"Sonuç bekleniyor",s.cumulativeUnique]));
  download("loto_"+r.target+"_"+r.config.mode+"_adimlar.csv",lines.map(row=>row.map(quote).join(";")).join("\r\n"),"text/csv;charset=utf-8");
}
function exportCombination(){
  const target=currentTarget(),nums=($("frequencyEnabled").checked||$("excludeLatest").checked||$("excludeDraws").value.trim()||$("excludeNumbers").value.trim())?state.lastFiltered:state.lastCombined;
  if(!nums.length)return toast("İndirilecek havuz yok.");
  const goal=state.draws.get(target)?.numbers||[];
  download("loto_"+target+"_ortak_havuz.txt","LOTO TAHMİN — HEDEF #"+target+"\nHAVUZ: "+nums.join(", ")+"\nHEDEF: "+(state.draws.has(target)?goal.join(", "):"Sonuç bekleniyor")+"\nEŞLEŞEN: "+(state.draws.has(target)?nums.filter(n=>goal.includes(n)).join(", "):"Sonuç bekleniyor")+"\nNOT: Havuz yalnızca hedef öncesindeki arşiv verilerinden oluşturulmuştur; gelecek sonucu garanti etmez.\n");
}
function setPreset(mode){
  $("targetInput").value="975";updateTarget();modes[mode]={...DEFAULTS[mode]};switchMode(mode);run();toast(mode==="add"?"975 · ilk 10 sabit ekleme":"975 · 9 adım sürekli ikiye bölme");
}
function updateArchiveView(){
  const all=[...state.draws.values()].sort((a,b)=>b.id-a.id);
  $("statDraws").textContent=String(all.length);
  const last=all[0];
  const status=$("dataStatus");status.innerHTML="<i></i> "+all.length+" gerçek çekiliş";status.classList.remove("error");
  $("archivePreview").innerHTML="<strong>Arşiv aralığı:</strong> #"+all[all.length-1].id+" – #"+last.id+" · <strong>En son:</strong> "+last.date+" · "+last.numbers.map(n=>String(n).padStart(2,"0")).join(" – ");
}
async function initialize(){
  loadSaved();
  try{
    const response=await fetch("./data/draws.txt",{cache:"no-store"});
    if(!response.ok)throw Error("TXT veri dosyası yüklenemedi ("+response.status+").");
    const txt=await response.text(),draws=parseArchive(txt);
    if(!draws.has(1))throw Error("Yerleşik arşivin başlangıcı eksik.");
    $("targetInput").value=String(Math.max(...draws.keys())+1);
    state.draws=draws;updateArchiveView();updateTarget();renderSaved();run(true);
  }catch(e){
    $("dataStatus").classList.add("error");$("dataStatus").textContent="Arşiv yüklenemedi";
    $("archivePreview").textContent="Veri hatası: "+e.message+" · Siteyi GitHub Pages üzerinden aç veya aşağıdan TXT yükle.";
    toast("Veri dosyası yüklenemedi. TXT dosyasını içe aktarabilirsin.");
  }
}
document.querySelectorAll("[data-mode]").forEach(btn=>btn.addEventListener("click",()=>switchMode(btn.dataset.mode)));
$("strategyForm").addEventListener("submit",e=>{e.preventDefault();run()});
$("strategyForm").addEventListener("input",e=>{if(e.target.id==="addCustom")return;scheduleRun()});
$("strategyForm").addEventListener("change",()=>{ $("addValue").classList.toggle("hidden",!$("addCustom").checked);scheduleRun()});
$("targetInput").addEventListener("change",()=>{updateTarget();renderSaved();run()});
$("targetInput").addEventListener("input",()=>{updateTarget();renderSaved();updateCompare();scheduleRun()});
$("exampleAdd").addEventListener("click",()=>setPreset("add"));
$("exampleDivide").addEventListener("click",()=>setPreset("divide"));
$("saveStrategy").addEventListener("click",save);
$("exportSteps").addEventListener("click",exportSteps);
$("exportComparison").addEventListener("click",exportCombination);
$("savedStrategies").addEventListener("change",e=>{
  const id=e.target.dataset.toggle;if(!id)return;
  const s=state.saved.find(s=>s.id===id);if(s){s.active=e.target.checked;persist();renderSaved();updateCompare();}
});
$("savedStrategies").addEventListener("click",e=>{
  const id=e.target.dataset.remove;if(!id)return;
  state.saved=state.saved.filter(s=>s.id!==id);persist();renderSaved();updateCompare();
});
document.querySelectorAll('input[name="combine"]').forEach(el=>el.addEventListener("change",updateCompare));
["frequencyEnabled","lookback","threshold","excludeLatest","excludeDraws","excludeNumbers"].forEach(k=>$(k).addEventListener("input",updateCompare));
$("clearSaved").addEventListener("click",()=>{
 if(!state.saved.length)return;
 if(!confirm("Kaydedilen tüm stratejiler silinsin mi?"))return;
 state.saved=[];persist();renderSaved();updateCompare();toast("Kayıtlar temizlendi.");
});
$("fileInput").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    const data=await file.text(),draws=parseArchive(data);
    state.draws=draws;
    const last=Math.max(...draws.keys());if(!Number.isSafeInteger(currentTarget())||currentTarget()<2)$("targetInput").value=String(last+1);
    state.saved=[];persist();state.current=null;updateArchiveView();updateTarget();renderSaved();run();
    toast(draws.size+" çekilişlik TXT yüklendi.");
  }catch(err){toast("TXT hatası: "+err.message)}
  e.target.value="";
});
switchMode("add");
initialize();

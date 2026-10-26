import {interpretLocal,validateIntent,ALL_MODULES} from './assistant-engine.mjs';
import {parseArchive} from './engine.mjs';
import {MODULES} from './analysis-engine.mjs';
const $=id=>document.getElementById(id),escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const worker=new Worker(new URL('./assistant-worker.mjs',import.meta.url),{type:'module'});
const state={draws:null,report:null,columns:[],busy:false,messages:[],request:null};
const balls=ns=>ns.map(n=>`<span class="ai-ball">${n}</span>`).join('');
function message(role,text){const node=document.createElement('div');node.className='ai-message '+role;node.textContent=text;$('aiMessages').append(node);state.messages.push({role:role==='user'?'user':'assistant',content:text});state.messages=state.messages.slice(-12);$('aiMessages').scrollTop=$('aiMessages').scrollHeight;}
function busy(value,label='Hazır'){state.busy=value;for(const e of document.querySelectorAll('[data-ai-command],#aiSend'))e.disabled=value||!state.draws;$('aiProgress').textContent=label;$('aiProgress').setAttribute('aria-busy',String(value));}
function save(){try{localStorage.setItem('loto-assistant-last-v1',JSON.stringify({report:state.report,columns:state.columns}));}catch{}}
function render(){
 const r=state.report;if(!r)return;$('aiResults').hidden=false;
 $('aiResultTitle').textContent=`#${r.target} için ${r.pool.length} sayı · ${state.columns.length} kolon`;
 $('aiEvidence').textContent=`Kaynak: #1–${r.sourceLast} · Son veri ${r.sourceDate} · ${r.modules.length} analiz × ${r.windows.join('/')} çekilişlik dönemler. Puan, hesaplanan sıralama puanıdır; çıkma olasılığı değildir.`;
 $('aiPool').innerHTML=balls(r.pool);
 $('aiColumns').innerHTML=state.columns.map((c,i)=>`<div class="ai-column"><b>${i+1}.</b>${balls(c)}</div>`).join('');
 $('aiDownload').disabled=false;$('aiSavePool').disabled=false;
 $('aiAudit').innerHTML=`<p>İlk ${r.trainingTargets.length} geçmiş hedefte analiz ağırlıkları ölçüldü; ardından ağırlıklar sabit tutularak ${r.validationRows.length} farklı geçmiş hedefte havuz test edildi. Her hedef yalnızca kendi öncesindeki kayıtlardan hesaplandı.</p><p>Kontrol döneminde ortalama <b>${r.validationAverage.toFixed(2)}/6</b>; aynı büyüklükte rastgele havuzun matematiksel beklentisi <b>${r.baseline.toFixed(2)}/6</b>. Bu kısa ölçüm, bağımsız ve uzun dönemli başarı kanıtı değildir.</p><div class="ai-table-wrap"><table><thead><tr><th>Geçmiş hedef</th><th>Havuz isabeti</th></tr></thead><tbody>${r.validationRows.map(x=>`<tr><td>#${x.target}</td><td>${x.hits}/6</td></tr>`).join('')}</tbody></table></div><p>Uygulanan analizler: ${r.modules.map(id=>escape(MODULES.find(m=>m.id===id)?.name)).join(', ')}.</p><p>Elendi: ${r.excluded.join(', ')||'Yok'}</p><div class="ai-table-wrap"><table><thead><tr><th>Sayı</th><th>Sıralama puanı / 100</th><th>Analiz desteği</th></tr></thead><tbody>${r.ranked.filter(x=>r.pool.includes(x.number)).map(x=>`<tr><td>${x.number}</td><td>${x.score}</td><td>${x.support}/${r.modules.length*r.windows.length}</td></tr>`).join('')}</tbody></table></div>`;
}
async function intentFor(text){
 const endpoint=$('aiEndpoint').value.trim();
 if(!endpoint){$('aiMode').textContent='Yerel analiz modu · Sohbet yapay zekâsı bağlı değil';return interpretLocal(text,state.report??{});}
 const u=new URL(endpoint);if(u.protocol!=='https:'&&u.hostname!=='localhost')throw Error('Yapay zekâ bağlantısı HTTPS olmalı.');
 const token=$('aiAccess').value;const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
 const response=await fetch(u,{method:'POST',headers,body:JSON.stringify({message:text,history:state.messages.slice(0,-1).slice(-8),context:{latest:Math.max(...state.draws.keys()),previous:state.report?{target:state.report.target,poolSize:state.report.poolSize,window:state.report.window,modules:state.report.modules}:null},allowedModules:ALL_MODULES}),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(response.status===401?'Yapay zekâ bağlantısının erişim kodu geçersiz.':`Yapay zekâ servisi yanıt vermedi (${response.status}).`);
 const result=await response.json();if(!result.intent||typeof result.intent!=='object')throw Error('Yapay zekâ geçerli bir analiz komutu döndürmedi.');
 $('aiMode').textContent='Bağlı yapay zekâ · Hesaplar gerçek arşiv motorunda';return result.intent;
}
async function submit(text){
 if(state.busy||!state.draws||!text.trim())return;message('user',text.trim());$('aiInput').value='';busy(true,'Talimat okunuyor…');
 try{
  let intent=await intentFor(text);
  if(intent.action==='clarify'){message('assistant',intent.message||'Sayı havuzu büyüklüğünü ve kolon adedini belirt.');busy(false);return;}
  if(intent.usePrevious&&state.report&&!intent.target)intent.target=state.report.target;
  intent=validateIntent(intent,state.draws);
  if(intent.usePrevious&&!state.report)throw Error('Önce bir sayı havuzu oluştur.');
  state.request=intent;
  const count=intent.usePrevious?state.report.pool.length:intent.poolSize;
  message('assistant',`#${intent.target} için ${count} sayılık havuz${intent.couponCount?' ve '+intent.couponCount+' farklı altılı kolon':''} hazırlanıyor. ${intent.usePrevious?'Son havuz korunuyor.':'Analizler ve geçmiş kontrol çalıştırılıyor.'}`);
  worker.postMessage({type:'run',intent,previous:state.report});
 }catch(error){message('assistant',error.message);busy(false,'İşlem tamamlanamadı');}
}
worker.onmessage=({data})=>{
 if(data.type==='ready'){busy(false,`${data.size} gerçek kayıt hazır · Son #${data.latest} · Önümüzdeki hedef #${data.latest+1}`);return;}
 if(data.type==='progress'){busy(true,data.message);return;}
 if(data.type==='error'){message('assistant',data.message);busy(false,'İşlem tamamlanamadı');return;}
 if(data.type==='result'){state.report=data.report;state.columns=data.columns;render();save();message('assistant',`#${data.report.target} çalışması hazır: ${data.report.pool.length} sayı${data.columns.length?', tamamı bu havuzdan '+data.columns.length+' farklı kolon':''}. Sayıları, kolonları ve geçmiş kontrolünü aşağıda görebilirsin.`);busy(false,'Analiz tamamlandı');}
};
worker.onerror=()=>{message('assistant','Analiz motoru yüklenemedi. Sayfayı yeniden açıp tekrar dene.');busy(false,'Motor hatası');};
$('aiForm').addEventListener('submit',e=>{e.preventDefault();submit($('aiInput').value);});
$('aiInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('aiForm').requestSubmit();}});
document.querySelectorAll('[data-ai-command]').forEach(b=>b.onclick=()=>submit(b.dataset.aiCommand));
$('aiReset').onclick=()=>{if(state.busy)return;state.report=null;state.columns=[];state.messages=[];$('aiMessages').replaceChildren();$('aiResults').hidden=true;localStorage.removeItem('loto-assistant-last-v1');message('assistant','Yeni çalışma açıldı. Kaç sayı ve kaç kolon istediğini yazabilirsin.');};
$('aiDownload').onclick=()=>{if(!state.report)return;const r=state.report,text=`LOTO ANALİZ ASİSTANI\nHedef: #${r.target}\nKaynak: #1–${r.sourceLast}\nHavuz (${r.pool.length}): ${r.pool.join(', ')}\n\n${state.columns.map((c,i)=>`${i+1}. ${c.join(' - ')}`).join('\n')}\n\nAnaliz: ${r.modules.length} modül; dönemler ${r.windows.join(', ')}.\nSıralama puanları çıkma olasılığı değildir.\n`,url=URL.createObjectURL(new Blob(['\uFEFF',text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`loto_asistan_${r.target}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('aiSavePool').onclick=()=>{if(!state.report)return;const r=state.report;try{const key='loto-analysis-saved-v1',saved=JSON.parse(localStorage.getItem(key)||'[]');saved.unshift({id:'assistant-'+Date.now(),name:`Asistan #${r.target} · ${r.pool.length} sayı`,target:r.target,pool:r.pool,source:'assistant',kind:'analiz',moduleIds:r.modules,created:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(saved.slice(0,100)));message('assistant','Havuz Analiz Merkezi kayıtlarına eklendi.');}catch{message('assistant','Cihazın kayıt alanına yazılamadı. TXT olarak indirebilirsin.');}};
try{const endpoint=localStorage.getItem('loto-assistant-endpoint');if(endpoint)$('aiEndpoint').value=endpoint;}catch{}
$('aiEndpoint').onchange=()=>{try{localStorage.setItem('loto-assistant-endpoint',$('aiEndpoint').value.trim());}catch{};$('aiMode').textContent=$('aiEndpoint').value.trim()?'Yapay zekâ servisi ilk komutta doğrulanacak':'Yerel analiz modu · Sohbet yapay zekâsı bağlı değil';};
(async()=>{busy(true,'Güncel arşiv yükleniyor…');try{const response=await fetch('./data/draws.txt',{cache:'no-store'});if(!response.ok)throw Error('Çekiliş arşivi yüklenemedi.');const archive=await response.text();state.draws=parseArchive(archive);worker.postMessage({type:'initialize',archive});message('assistant','Önümüzdeki çekiliş için 10, 20 veya 30 sayı isteyebilir; ardından “Bunlardan 5 kolon oluştur” yazabilirsin.');}catch(e){message('assistant',e.message);busy(false,'Arşiv yüklenemedi');state.draws=null;}})();

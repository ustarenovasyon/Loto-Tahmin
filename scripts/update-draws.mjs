// Append verified, sequential public draw results; never overwrite history.
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parseArchive} from '../engine.mjs';
export function parseResult(html,id){
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ');
 const heading=text.match(/(\d+)\.Çekiliş\s*\[\s*(\d+)\s*\]\s*-\s*(\d{2})\s+(\S+)\s+(\d{4})/i);
 if(!heading)return null;
 if(Number(heading[2])!==id)throw Error('Kaynak başka çekiliş döndürdü: '+id);
 const months=['OCAK','ŞUBAT','MART','NİSAN','MAYIS','HAZİRAN','TEMMUZ','AĞUSTOS','EYLÜL','EKİM','KASIM','ARALIK'];
 const month=months.indexOf(heading[4].toLocaleUpperCase('tr-TR'))+1;
 const match=text.match(/kazanan numaralar\s*,?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s+olarak/i);
 if(!match)return null; // Unpublished results must never be invented.
 const numbers=match.slice(1).map(Number).sort((a,b)=>a-b);
 const date=`${heading[3]}.${String(month).padStart(2,'0')}.${heading[5]}`;
 if(!month||new Set(numbers).size!==6||numbers.some(n=>n<1||n>60))throw Error('Geçersiz sonuç: '+id);
 return {id,yearNo:Number(heading[1]),date,numbers};
}
export async function updateArchive(file='data/draws.txt',fetcher=fetch){
 let raw=readFileSync(file,'utf8');const original=parseArchive(raw);let last=original.get(Math.max(...original.keys()));const added=[];
 for(let i=0;i<30;i++){
  const id=last.id+1;let result=null,reachable=false,failures=[];
  for(const host of ['www.lototurkiye.com','lototurkiye.com']){
   try{
    const response=await fetcher(`https://${host}/SUPER-LOTO-SISAL/CEKILIS-SONUCLARI/12/${id}`,{signal:AbortSignal.timeout(25000),headers:{'User-Agent':'Loto-Tahmin archive updater'}});
    if(response.status===404){reachable=true;continue;}
    if(!response.ok)throw Error('HTTP '+response.status);
    const bytes=await response.arrayBuffer();
    const utf8=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
    const html=utf8.includes('�')?new TextDecoder('windows-1254').decode(bytes):utf8;
    result=parseResult(html,id);reachable=true;if(result)break;
   }catch(error){failures.push(error.message);}
  }
  if(!result){if(!reachable)throw Error('Sonuç kaynağına ulaşılamadı: '+failures.join('; '));break;}
  const iso=d=>d.split('.').reverse().join('-');
  if(iso(result.date)<=iso(last.date)||iso(result.date)>new Date().toISOString().slice(0,10))throw Error('Geçersiz sonuç tarihi: '+id);
  const sameYear=result.date.slice(-4)===last.date.slice(-4);
  if(result.yearNo!==(sameYear?last.yearNo+1:1))throw Error('Yıl içi sıra tutarsız: '+id);
  added.push(result);last=result;
 }
 if(!added.length){console.log('Yeni yayımlanmış çekiliş yok. Son #'+last.id);return added;}
 const lines=added.slice().reverse().map(d=>`${String(d.id).padStart(4,'0')} | ${String(d.yearNo).padStart(3,'0')} | ${d.date} | ${d.numbers.map(n=>String(n).padStart(2,'0')).join(' - ')}`).join('\n');
 raw=raw.replace(/^(\d{4}\s*\|)/m,lines+'\n$1');
 raw=raw.replace(/^SÜPER LOTO.*$/m,`SÜPER LOTO — ${last.id} ÇEKİLİŞİN TAMAMI`).replace(/^Kapsam:.*$/m,`Kapsam: Genel sıra 0001–${String(last.id).padStart(4,'0')}; 02.08.2020–${last.date}`).replace(/^Derleme tarihi:.*$/m,`Derleme tarihi: ${new Date().toLocaleDateString('tr-TR')} (otomatik)`).replace(/^KONTROLLER:.*$/m,`KONTROLLER: ${last.id} benzersiz sıra (1–${last.id}), her satırda 1–60 aralığında 6 farklı sayı.`);
 if(!raw.includes('Otomatik eklenen sonuçlar:'))raw=raw.replace('KAYNAKLAR','KAYNAKLAR\nOtomatik eklenen sonuçlar: LotoTürkiye kamuya açık çekiliş sonuçları; önceki arşiv korunur.');
 const updated=parseArchive(raw);if(updated.size!==original.size+added.length)throw Error('Arşiv bütünlük hatası');
 for(const [id,row] of original)if(JSON.stringify(updated.get(id))!==JSON.stringify(row))throw Error('Geçmiş kayıt değişti: '+id);
 writeFileSync(file+'.tmp',raw);renameSync(file+'.tmp',file);console.log('Yeni çekilişler: '+added.map(d=>'#'+d.id).join(', '));return added;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await updateArchive();

// Optional real-model interpreter for the static GitHub Pages frontend.
// Secrets remain on this server; numerical analysis always runs in the archive engine.
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ALL_MODULES} from '../assistant-engine.mjs';
export const intentSchema={type:'object',additionalProperties:false,properties:{
 action:{type:'string',enum:['analyze','coupons','both','clarify']},
 message:{type:'string'},target:{type:['integer','null']},poolSize:{type:['integer','null']},couponCount:{type:['integer','null']},window:{type:['integer','null']},excludeRecent:{type:['integer','null']},excludeNumbers:{type:'array',items:{type:'integer'}},modules:{type:'array',items:{type:'string',enum:ALL_MODULES}},usePrevious:{type:'boolean'}
},required:['action','message','target','poolSize','couponCount','window','excludeRecent','excludeNumbers','modules','usePrevious']};
const instructions=`Türkçe Loto Analiz Asistanısın. Görevin kullanıcının talimatını yürütülebilir analiz komutuna çevirmek; çekiliş sayıları veya olasılıkları uydurma. analyze: sayı havuzu; coupons: mevcut/yeni havuzdan kolon; both: ikisi; clarify: desteklenmeyen veya belirsiz istek. Sonraki hedef context.latest+1; kullanıcı geçmiş hedef belirtirse o hedef. Varsayılan 20 sayı, 100 çekiliş, bütün izinli modüller. 6–60 sayı, 1–30 kolon. 'Bunlardan 5 kolon' için usePrevious true, önceki havuzu ve hedefi koru. Genel yardım, belirsizlik ve analiz dışı konularda clarify ve kısa açıklama döndür. Analiz/kolon işlemlerinde message kısa plan olsun; kesin başarı veya daha yüksek gerçek çekiliş olasılığı iddiası yapma. Model sayı seçmez; actual ranking is computed by deterministic archive tools. Hariç tutulan sayıları yalnızca kullanıcının açık talimatından çıkar. Son N çekilişi ele komutunda excludeRecent=N. Module listesinde yalnızca allowedModules değerlerini kullan.`;
export async function interpretWithModel(body,env,fetcher=fetch){
 if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL)throw Error('Model bağlantısı yapılandırılmamış.');
 const history=Array.isArray(body.history)?body.history.slice(-8).filter(m=>['user','assistant'].includes(m?.role)).map(m=>({role:m.role,content:String(m.content??'').slice(0,2000)})):[];
 const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.OPENAI_API_KEY},body:JSON.stringify({model:env.OPENAI_MODEL,store:false,instructions,input:[...history,{role:'user',content:JSON.stringify({message:body.message,context:body.context,allowedModules:ALL_MODULES})}],max_output_tokens:1500,text:{format:{type:'json_schema',name:'loto_intent',strict:true,schema:intentSchema}}}),signal:AbortSignal.timeout(40000)});
 if(!response.ok)throw Error(`Model servisi yanıt vermedi (${response.status}).`);
 const data=await response.json();if(data.status!=='completed')throw Error('Model yanıtı tamamlanmadı.');
 const text=data.output?.flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
 if(!text)throw Error('Model bir analiz komutu üretmedi.');const intent=JSON.parse(text);
 if(!['analyze','coupons','both','clarify'].includes(intent.action)||intent.modules?.some(id=>!ALL_MODULES.includes(id)))throw Error('Geçersiz model komutu.');
 return {intent};
}
export function createHandler(env,fetcher=fetch){
 const limits=new Map();
 return async(req,res)=>{
 const allowed=env.ASSISTANT_ALLOWED_ORIGIN;
 if(req.headers.origin!==allowed){res.writeHead(403);return res.end('Origin denied');}
 res.setHeader('Access-Control-Allow-Origin',allowed);res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});return res.end();}
 const answer=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json;charset=utf-8'});res.end(JSON.stringify(body));};
 if(req.url!=='/interpret'||req.method!=='POST')return answer(404,{error:'Not found'});
 const actual=Buffer.from(req.headers.authorization??''),expected=Buffer.from('Bearer '+env.ASSISTANT_ACCESS_TOKEN);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return answer(401,{error:'Unauthorized'});
 const ip=req.socket.remoteAddress,key=ip+':'+Math.floor(Date.now()/60000);for(const k of limits.keys())if(k!==key)limits.delete(k);
 limits.set(key,(limits.get(key)??0)+1);if(limits.get(key)>6)return answer(429,{error:'Dakikada en fazla 6 komut.'});
 let raw='';try{for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>12000)return answer(413,{error:'Talimat çok uzun.'});}const body=JSON.parse(raw);
 if(typeof body.message!=='string'||!body.message.trim()||body.message.length>2000)return answer(400,{error:'Geçersiz talimat.'});
 return answer(200,await interpretWithModel(body,env,fetcher));
 }catch(error){return answer(502,{error:error.message==='Model bağlantısı yapılandırılmamış.'?error.message:'Yapay zekâ komutu alınamadı. Servis bağlantısını kontrol et.'});}
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 for(const key of ['OPENAI_API_KEY','OPENAI_MODEL','ASSISTANT_ACCESS_TOKEN','ASSISTANT_ALLOWED_ORIGIN'])if(!process.env[key])throw Error('Eksik sunucu ayarı: '+key);
 createServer(createHandler(process.env)).listen(Number(process.env.PORT??8787),'127.0.0.1',()=>console.log('Assistant interpreter ready on localhost'));
}

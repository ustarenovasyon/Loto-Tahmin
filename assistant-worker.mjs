import {parseArchive} from './engine.mjs';
import {research,makeColumns,validateIntent} from './assistant-engine.mjs';
let draws;
self.onmessage=async({data})=>{
 try{
  if(data.type==='initialize'){draws=parseArchive(data.archive);self.postMessage({type:'ready',latest:Math.max(...draws.keys()),size:draws.size});return;}
  if(!draws)throw Error('Arşiv henüz hazır değil.');
  const intent=validateIntent(data.intent,draws);
  let report=data.previous;
  if(!(intent.usePrevious&&report&&report.target===intent.target))report=await research(draws,intent,message=>self.postMessage({type:'progress',message}));
  const columns=intent.action==='analyze'?[]:makeColumns(draws,report,intent.couponCount);
  self.postMessage({type:'result',report,columns});
 }catch(error){self.postMessage({type:'error',message:error.message});}
};

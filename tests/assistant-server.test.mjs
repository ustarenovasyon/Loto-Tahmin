import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHandler,intentSchema} from '../server/assistant-server.mjs';
const env={ASSISTANT_ALLOWED_ORIGIN:'https://ustarenovasyon.github.io',ASSISTANT_ACCESS_TOKEN:'test-only-access-code'};
test('model endpoint rejects other origins and unauthenticated requests before model access',async()=>{
 let calls=0;const server=createServer(createHandler(env,async()=>{calls++;throw Error('No live model credential in unit tests');}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/interpret`;
 try{
  assert.equal((await fetch(url,{method:'POST',headers:{Origin:'https://evil.invalid'}})).status,403);
  assert.equal((await fetch(url,{method:'POST',headers:{Origin:env.ASSISTANT_ALLOWED_ORIGIN}})).status,401);
  assert.equal(calls,0);
  const result=await fetch(url,{method:'POST',headers:{Origin:env.ASSISTANT_ALLOWED_ORIGIN,Authorization:'Bearer '+env.ASSISTANT_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({message:'20 sayı bul'})});
  assert.equal(result.status,502);assert.match((await result.json()).error,/yapılandırılmamış/);
  assert.equal(calls,0);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('model contract can only plan supported operations and cannot supply invented winning numbers',()=>{
 assert.equal(intentSchema.additionalProperties,false);
 assert.ok(!('winningNumbers' in intentSchema.properties));
 assert.ok(!('pool' in intentSchema.properties));
 assert.equal(intentSchema.properties.modules.items.enum.length,31);
});

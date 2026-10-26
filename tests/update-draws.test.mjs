import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseArchive} from '../engine.mjs';
import {parseResult,updateArchive} from '../scripts/update-draws.mjs';
// Public result text for the real 25 October 2026 draw (LotoTürkiye #976).
const source='128.Çekiliş[976] - 25 Ekim 2026 kazanan numaralar , 1 , 3 , 5 , 18 , 28 , 59 olarak belirlendi.';
test('real published result parses; unpublished or wrong draw cannot create numbers',()=>{
 assert.deepEqual(parseResult(source,976),{id:976,yearNo:128,date:'25.10.2026',numbers:[1,3,5,18,28,59]});
 assert.equal(parseResult('129.Çekiliş[977] - 27 Ekim 2026 Sonuç bekleniyor',977),null);
 assert.throws(()=>parseResult(source,977),/başka çekiliş/);
});
test('append a real result once, retain all history, then safely find no new result',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'loto-update-')),file=join(dir,'draws.txt');
 try{
  const raw=readFileSync(new URL('../data/draws.txt',import.meta.url),'utf8');
  const before=raw.replace(/^0976\s*\|.*\n/m,'');writeFileSync(file,before);
  const response=async url=>url.endsWith('/976')?new Response(source):new Response('',{status:404});
  assert.equal((await updateArchive(file,response)).length,1);
  const full=parseArchive(readFileSync(file,'utf8')),old=parseArchive(before);
  assert.equal(full.size,old.size+1);for(const [id,row]of old)assert.deepEqual(full.get(id),row);
  const saved=readFileSync(file,'utf8');assert.deepEqual(await updateArchive(file,response),[]);assert.equal(readFileSync(file,'utf8'),saved);
  await assert.rejects(()=>updateArchive(file,async()=>{throw Error('offline')}),/ulaşılamadı/);
  assert.equal(readFileSync(file,'utf8'),saved);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('current archive remains contiguous and new result is available to every engine',()=>{
 const draws=parseArchive(readFileSync(new URL('../data/draws.txt',import.meta.url),'utf8'));
 const last=Math.max(...draws.keys());assert.equal(draws.size,last);assert.ok(last>=976);
 assert.deepEqual(draws.get(976).numbers,[1,3,5,18,28,59]);
});

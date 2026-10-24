// GitHub Actions runner. Writes publicly inspectable immutable predictions per draw.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {parseArchive} from "../engine.mjs";
import {forecast,settleForecast,archiveSignature,SYSTEM_VERSION} from "../system-kosesi-engine.mjs";
const draws=parseArchive(readFileSync("data/draws.txt","utf8"));
const file="data/system-kosesi-ledger.json";
let ledger={version:1,records:[]};
try{ledger=JSON.parse(readFileSync(file,"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
if(ledger.version!==1||!Array.isArray(ledger.records))throw Error("Unexpected public ledger structure");
const id=Math.max(...draws.keys())+1;
if(ledger.records.some(r=>r.target>id))throw Error("Archive went backward; keep existing predictions and verify source.");
const known=new Set();
ledger.records=ledger.records.map(r=>{
 if(!Number.isInteger(r.target)||known.has(r.target))throw Error("Duplicate or invalid draw in ledger: "+r.target);
 known.add(r.target);
 if(r.state==="settled")return r; // Never revise an already published result.
 if(!draws.has(r.target))return r; // Do not revise pending tickets.
 return settleForecast(r,draws);
});
if(!known.has(id)){
 const prepared=forecast(draws,{target:id,period:10,window:100,systems:10,coupons:5});
 const item={...prepared,created:new Date().toISOString(),sourceArchive:archiveSignature(draws)};
 ledger.records.push(item);
}
ledger.records.sort((a,b)=>a.target-b.target);
ledger.updatedAt=new Date().toISOString();
ledger.engineVersion=SYSTEM_VERSION;
mkdirSync("data",{recursive:true});
writeFileSync(file,JSON.stringify(ledger,null,2)+"\n","utf8");
console.log("Public system ledger:",ledger.records.length,"records; next draw #"+id,
 "existing records preserved; only newly resulted predictions settled.");

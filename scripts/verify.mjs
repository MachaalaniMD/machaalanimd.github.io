import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {scoreTopic} from '../folio/search.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(await readFile(resolve(root,'folio/catalog.json'),'utf8'));
const {topics,categories,metadata}=catalog;
assert.equal(metadata.edition,'2025–26');assert.match(metadata.sourceSha256,/^[a-f0-9]{64}$/);
assert.equal(topics.length,metadata.topics);assert.equal(categories.length,18);
assert.equal(new Set(topics.map(t=>t.id)).size,topics.length);
const pages=topics.flatMap(t=>t.pages);assert.equal(pages.length,266);assert.equal(new Set(pages.map(p=>p.pdfPage)).size,266);
assert.deepEqual(pages.map(p=>p.pdfPage).sort((a,b)=>a-b),Array.from({length:267},(_,i)=>i+4).filter(n=>n!==269));
const panelIds=[];
for(const t of topics){assert.ok(t.title.length>2,t.id);assert.ok(categories.some(c=>c.id===t.categoryId),t.id);assert.ok(t.pages.length,t.id);for(const p of t.pages){assert.equal(p.panels[0].box[1],60);assert.equal(p.panels.at(-1).box[3],p.height-22);const file=resolve(root,'folio',p.image);assert.ok((await stat(file)).size>1000);const bytes=await readFile(file);assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');for(let i=0;i<p.panels.length;i++){const s=p.panels[i];panelIds.push(s.id);assert.equal(s.pdfPage,p.pdfPage);assert.ok(s.box[3]>s.box[1]);if(i>0)assert.equal(s.box[1],p.panels[i-1].box[3]);}}}
assert.equal(new Set(panelIds).size,panelIds.length);
assert.ok(!pages.some(p=>p.pdfPage===269));assert.ok(!(await readdir(resolve(root,'folio/assets'))).some(n=>n==='page-0269.webp'));
for(const c of categories)assert.equal(c.count,topics.filter(t=>t.categoryId===c.id).length);
for(const term of ['Heart Failure','Acute Kidney Injury','Anticoagulation Management','Respiratory Distress'])assert.ok(topics.some(t=>t.title===term),term);
// These known local instructions must be absent from the shipped search index.
const allText=topics.map(t=>t.text).join('\n');for(const local of ['ECMO Consult MGH','mghcardiology','p30104','Bigelow JAR','MGH Directory'])assert.ok(!allText.includes(local),local);
const home=await readFile(resolve(root,'index.html'),'utf8');assert.ok(home.includes('https://machaalanimd.github.io/sage/'));assert.ok(home.includes('href="folio/"'));assert.ok(home.includes('Marc Machaalani'));
const reader=await readFile(resolve(root,'folio/folio.js'),'utf8');for(const api of ['localStorage','sessionStorage','sendBeacon','XMLHttpRequest'])assert.ok(!reader.includes(api),api);assert.equal((reader.match(/fetch\(/g)||[]).length,1);assert.ok(reader.includes("fetch('catalog.json')"));
console.log(`Verified ${topics.length} unique topics, ${pages.length} source pages, ${panelIds.length} contiguous source sections, source identity, redacted search index and browser-only state.`);

for(const [q,name] of [['AKI','Acute Kidney Injury'],['HFpEF','Heart Failure'],['AF','Atrial Fibrillation & Flutter']]){const ranked=topics.map(t=>({t,n:scoreTopic(t,q)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);assert.equal(ranked[0].t.title,name);}
assert.equal(scoreTopic({title:'Acute Liver Injury',category:'GI',text:'Liver disease'},'AKI'),0);

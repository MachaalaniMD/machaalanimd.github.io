// Checks edited topics: they parse, map to real topics, render, and keep the
// source's clinical numbers. A number in the book's version that is missing
// from the edit is reported, so dropped doses and thresholds are deliberate.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildEditions} from './build-editions.mjs';
import {renderBlocks} from '../folio/content.mjs';
const catalog=JSON.parse(await readFile(new URL('../folio/catalog.json',import.meta.url),'utf8'));
const built=await buildEditions();
const shipped=(await import('../folio/editions.mjs')).editions;
assert.deepEqual(shipped,built,'folio/editions.mjs is stale: run node scripts/build-editions.mjs');
const strict=process.argv.includes('--strict');
const nums=s=>new Set((s.normalize('NFKC').replace(/[–—]/g,'-').match(/\d+(?:\.\d+)?/g)||[]).map(n=>n.replace(/\.0+$/,'')).filter(n=>!/^(19|20)\d\d$/.test(n)));
const text=bs=>bs.map(b=>b.runs?b.runs.map(r=>r.t).join(''):b.blocks?[b.branchLabel||'',b.question||'',text(b.blocks)].join(' '):b.columns?b.columns.map(text).join(' '):b.cells?b.cells.map(c=>text(c.blocks)).join(' '):'').join(' ');
let missingTotal=0;
for(const [id,e] of Object.entries(built)){
 const topic=catalog.topics.find(t=>t.id===id);assert.ok(topic,`Edition for unknown topic ${id}`);
 assert.ok(e.sections.length,`${id} has sections`);
 const ids=e.sections.map(s=>s.id);assert.equal(new Set(ids).size,ids.length,`${id}: duplicate section titles`);
 for(const s of e.sections){assert.ok(s.blocks.length,`${id}/${s.title} is empty`);const html=renderBlocks(s.blocks,{title:s.title});assert.ok(html.length>20);assert.ok(!html.includes('undefined'),`${id}/${s.title} renders undefined`);}
 // citations in the source are optional; clinical numbers are not
 const source=text(topic.pages.flatMap(p=>p.panels.flatMap(pa=>pa.blocks.filter(b=>b.style!=='diagram-transcript')))).replace(/\([^()]*(?:19|20)\d\d[^()]*\)/g,' ');
 const edited=nums([e.summary||'',...e.sections.map(s=>s.title+' '+text(s.blocks))].join(' '));
 const missing=[...nums(source)].filter(n=>!edited.has(n));
 missingTotal+=missing.length;
 if(missing.length)console.log(`${id}: ${missing.length} source numbers not in edit: ${missing.join(', ')}`);
}
if(strict)assert.equal(missingTotal,0);
console.log(`Verified ${Object.keys(built).length} edited topics.`);

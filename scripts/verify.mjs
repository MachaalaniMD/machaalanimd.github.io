import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {scoreTopic} from '../folio/search.mjs';
import {renderBlocks,blockText,renderRuns} from '../folio/content.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(await readFile(resolve(root,'folio/catalog.json'),'utf8'));
const {topics,categories,metadata}=catalog;
assert.equal(metadata.edition,'2025–26');assert.equal(metadata.format,'semantic-html');assert.match(metadata.sourceSha256,/^[a-f0-9]{64}$/);
assert.equal(topics.length,metadata.topics);assert.equal(categories.length,18);assert.equal(new Set(topics.map(t=>t.id)).size,topics.length);
const pages=topics.flatMap(t=>t.pages);assert.equal(pages.length,266);assert.equal(new Set(pages.map(p=>p.pdfPage)).size,266);
assert.deepEqual(pages.map(p=>p.pdfPage).sort((a,b)=>a-b),Array.from({length:267},(_,i)=>i+4).filter(n=>n!==269));
const page=n=>pages.find(p=>p.pdfPage===n),tablesByPage=new Map(),figures=new Set(),ids=new Set();let blockCount=0,tableCount=0;
async function checkBlocks(blocks,p){
 assert.ok(Array.isArray(blocks));
 for(const b of blocks){
  blockCount++;assert.ok(['paragraph','list-item','heading','columns','callout','table','figure','spectrum'].includes(b.type),b.type);
  if(b.runs){assert.ok(b.runs.length);for(const r of b.runs){assert.equal(typeof r.t,'string');assert.ok(!/[\uE000-\uF8FF]/.test(r.t),'Unmapped PDF symbol');if(r.href)assert.match(r.href,/^(https?:\/\/|mailto:)/);}}
  if(b.type==='columns'){assert.ok(b.columns.length);for(const col of b.columns)await checkBlocks(col,p);}
  if(b.blocks)await checkBlocks(b.blocks,p);
  if(b.type==='spectrum'){assert.equal(b.headers.reduce((n,h)=>n+h.colspan,0),5);assert.deepEqual(b.rows.map(r=>r.coverageSegments.map(s=>[s.col,s.colspan])),[[[0,1]],[[0,2]],[[0,3]],[[0,3],[4,1]],[[0,4]],[[0,5]]]);}
  if(b.type==='table'){
   tableCount++;if(!tablesByPage.has(p.pdfPage))tablesByPage.set(p.pdfPage,[]);tablesByPage.get(p.pdfPage).push(b);
   assert.ok(b.rows>0&&b.cols>1);const grid=Array.from({length:b.rows},()=>Array(b.cols).fill(0));
   for(const c of b.cells){assert.ok(c.row>=0&&c.col>=0&&c.rowspan>0&&c.colspan>0);assert.ok(c.row+c.rowspan<=b.rows&&c.col+c.colspan<=b.cols,`Bounds on ${p.pdfPage}`);for(let r=c.row;r<c.row+c.rowspan;r++)for(let col=c.col;col<c.col+c.colspan;col++)grid[r][col]++;await checkBlocks(c.blocks,p);}
   assert.ok(grid.every(row=>row.every(n=>n===1)),`Table overlap or missing structural cell on PDF ${p.pdfPage}`);
   const rendered=renderBlocks([b],{pdfPage:p.pdfPage});assert.match(rendered,/<table[ >]/);assert.match(rendered,/<caption[ >]/);assert.ok(!rendered.includes('page-0')); // Genuine illustrations may occupy source table cells.
  }
  if(b.type==='figure'){assert.match(b.src,/^assets\/(figure|diagram)-\d{4}-\d{2}\.webp$/);assert.ok(b.width>0&&b.height>0);figures.add(b.src);assert.ok((await stat(resolve(root,'folio',b.src))).size>30);}
 }
}
for(const t of topics){assert.ok(t.title.length>2);assert.ok(categories.some(c=>c.id===t.categoryId));assert.ok(t.pages.length);for(const p of t.pages){assert.ok(!p.image,'Page screenshots must not be reader content');assert.ok(p.panels.length);for(const s of p.panels){assert.ok(!ids.has(s.id));ids.add(s.id);assert.ok(s.blocks.length);await checkBlocks(s.blocks,p);}}}
assert.equal(tableCount,metadata.conversion.tables);assert.equal(figures.size,metadata.conversion.figures);
assert.ok(!(await readdir(resolve(root,'folio/assets'))).some(n=>/^page-/.test(n)),'Legacy full-page screenshots shipped');
for(const c of categories)assert.equal(c.count,topics.filter(t=>t.categoryId===c.id).length);
const allText=topics.map(t=>t.text).join('\n');for(const local of ['ECMO Consult MGH','mghcardiology','p30104','Bigelow JAR','MGH Directory'])assert.ok(!allText.includes(local),local);
const audit=JSON.parse(await readFile(resolve(root,'folio/conversion-audit.json'),'utf8'));assert.equal(audit.sourceSha256,metadata.sourceSha256);assert.equal(audit.pages.length,266);for(const p of audit.pages)assert.equal(p.retainedNativeCharacterDigest,p.htmlNativeCharacterDigest,`Native source fidelity on PDF ${p.pdfPage}`);
// Source-reviewed paragraph ownership regressions, including the reported Addison example.
const structureCases=JSON.parse(await readFile(resolve(root,'tests/folio-structure-cases.json'),'utf8'));
const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}↑↓→≥≤±⊕]/gu,'');
function textNodes(blocks){return blocks.flatMap(b=>[...(b.runs?[b]:[]),...textNodes(b.blocks||[]),...(b.columns||[]).flatMap(textNodes),...(b.cells||[]).flatMap(c=>textNodes(c.blocks))]);}
for(const c of structureCases){const needle=normalize(c.phrase);const matches=textNodes(page(c.pdfPage).panels.flatMap(s=>s.blocks)).filter(b=>b.type===c.type&&normalize(b.runs.map(r=>r.t).join('')).includes(needle));assert.ok(matches.some(b=>normalize(b.runs.map(r=>r.t).join('')).startsWith(needle)===c.start&&(c.depth===undefined||b.listDepth===c.depth)),`Source structure PDF ${c.pdfPage}: ${c.phrase}`);}
assert.match(renderBlocks([{type:'list-item',runs:[{t:'b. Original second item'}]}]),/<ol type="a"><li value="2">Original second item/);
assert.match(renderBlocks([{type:'list-item',runs:[{t:'● Source bullet'}]}]),/<ul><li>Source bullet/);
const cellText=c=>blockText(c.blocks).replace(/\s+/g,' ').trim();
// Regression checks address clinically meaningful alignment risks observed in this PDF.
const doses=tablesByPage.get(26).find(t=>t.rows===4&&t.cols===10);assert.ok(doses);
assert.equal(doses.cells.find(c=>c.row===0&&c.col===0).rowspan,2);
for(const [col,drug,initial,target] of [[1,'metop succ','12.5-25 qD','200 qD'],[2,'carvedilol','3.125 BID','25-50 BID'],[3,'sacub/val','49/51 BID','97/103 BID'],[4,'lisinopril','2.5-5 qD','20-40 qD'],[5,'losartan','25-50 qD','50-150 qD'],[8,'dapag','10 qD','10 qD']]){for(const [row,value] of [[1,drug],[2,initial],[3,target]])assert.equal(cellText(doses.cells.find(c=>c.row===row&&c.col===col)),value);}
// Imported ECG templates contain clipped, invisible text; it must not leak into reading/search.
assert.ok(!blockText(page(9).panels.flatMap(s=>s.blocks)).includes('Dudzinski'));
const illustrated=tablesByPage.get(237).find(t=>t.cols===6);assert.ok(illustrated,'Retain the source photo column');
assert.equal((renderBlocks([illustrated]).match(/<img /g)||[]).length,10,'Photos stay in the matching disease-table cells');
const oral=tablesByPage.get(134).find(t=>t.cols===3);assert.ok(oral.cells.some(c=>c.rowspan===3&&c.col===2));assert.match(blockText(page(134).panels.flatMap(s=>s.blocks)),/Non-MGH dosing/);assert.ok(!blockText(page(134).panels.flatMap(s=>s.blocks)).includes('Kcentra 1500'));
const contrast=tablesByPage.get(186).find(t=>blockText([t]).includes('Pseudoallergic'));assert.equal(contrast.cols,4);assert.ok(!blockText([contrast]).includes('Pre-Treatment (MGH'));
const empiric=tablesByPage.get(107)[0];assert.equal(empiric.cols,4);assert.deepEqual(empiric.cells.filter(c=>c.row===0).map(cellText),['Suspected Process','Microbiology','Empiric Antimicrobial Therapy','Notes']);
assert.match(renderBlocks([{type:'list-item',runs:[{t:'3) Original step three'}]}]),/li value="3"/);
assert.ok(!renderBlocks([{type:'paragraph',runs:[{t:'<script>alert(1)</script>'}]}]).includes('<script>'));assert.ok(!renderRuns([{t:'unsafe',href:'javascript:alert(1)'}]).includes('href='));
assert.match(renderBlocks([{type:'list-item',runs:[{t:'3) Original step three'}]}]),/li value="3"/);
assert.ok(!renderBlocks([{type:'paragraph',runs:[{t:'12.5-25 qD'}]}]).includes('<ol>'));
const home=await readFile(resolve(root,'index.html'),'utf8');assert.ok(home.includes('https://machaalanimd.github.io/sage/'));assert.ok(home.includes('href="folio/"'));assert.ok(home.includes('Marc Machaalani'));
const reader=await readFile(resolve(root,'folio/folio.js'),'utf8');for(const api of ['localStorage','sessionStorage','sendBeacon','XMLHttpRequest','sourceSvg'])assert.ok(!reader.includes(api));assert.equal((reader.match(/fetch\(/g)||[]).length,1);
for(const [q,name] of [['AKI','Acute Kidney Injury'],['HFpEF','Heart Failure'],['AF','Atrial Fibrillation & Flutter']]){const ranked=topics.map(t=>({t,n:scoreTopic(t,q)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);assert.equal(ranked[0].t.title,name);}
assert.equal(scoreTopic({title:'Acute Liver Injury',category:'GI',text:'Liver disease'},'AKI'),0);
console.log(`Verified ${topics.length} topics, ${pages.length} source pages, ${blockCount} semantic blocks, ${tableCount} native tables, table grids/dose alignment, retained PDF text digests, omissions, safe rendering, 78 source-structure cases, search and memory-only state.`);
await import('./verify-reading.mjs');

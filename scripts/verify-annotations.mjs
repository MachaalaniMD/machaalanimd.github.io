import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {renderBlocks,renderRuns,blockText} from '../folio/content.mjs';
import {walkBlocks,notesForTable} from '../folio/notes.mjs';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const cat=await read('../folio/catalog.json'),cases=await read('../tests/folio-annotation-cases.json');
assert.equal(cases.sourceSha256,cat.metadata.sourceSha256);
const pages=cat.topics.flatMap(t=>t.pages),page=n=>pages.find(p=>p.pdfPage===n),blocks=n=>[...walkBlocks(page(n).panels.flatMap(s=>s.blocks))],text=b=>(b.runs||[]).map(r=>r.t).join(''),norm=s=>s.replace(/\s/g,'');
function signature(n,styled=false){const counts=new Map();for(const b of blocks(n))for(const r of b.runs||[])for(const ch of r.t)if(!/\s/.test(ch)){const key=styled?JSON.stringify([ch,!!r.b,!!r.i,!!r.u,r.href||'']):ch;counts.set(key,(counts.get(key)||0)+1);}const sorted=[...counts].sort((a,b)=>Buffer.compare(Buffer.from(a[0]),Buffer.from(b[0])));return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');}
for(const c of cases.baselineConservation){assert.equal(signature(c.pdfPage),c.characterDigest,`Unchanged source characters, PDF${c.pdfPage}`);if(c.priorStyleDigest)assert.equal(signature(c.pdfPage,true),c.priorStyleDigest,`Original per-character emphasis and citations, PDF${c.pdfPage}`);}
for(const c of cases.ecgBags){const actual={};for(const b of blocks(c.pdfPage))for(const ch of text(b))if(!/\s/.test(ch))actual[ch]=(actual[ch]||0)+1;assert.deepEqual(actual,c.sourceCharacterBag,`Every visible source ECG character once, PDF${c.pdfPage}`);}
assert.equal(page(9).panels[0].title,'Approach');assert.match(blockText(page(9).panels[0].blocks),/^Approach all EKGs systematically/);
assert.equal(page(9).panels.find(s=>s.id==='e9-chamber-panel').title,'Chamber enlargement');
assert.ok(!cat.topics.find(t=>t.pages.some(p=>p.pdfPage===9)).text.includes('R bo • a x'));
for(const phrase of ['Cor Pulmonale','valvular, infiltrative','35mm','11mm'])assert.ok(norm(blockText(page(9).panels.flatMap(s=>s.blocks))).includes(norm(phrase)),phrase);
for(const c of cases.rotatedLabels){const expected=norm(c.expectedLabel);assert.ok(blocks(c.pdfPage).some(b=>norm(text(b)).includes(expected)),`Source rotation PDF${c.pdfPage}: ${c.expectedLabel}`);}
const gender=blocks(216).find(b=>b.type==='table'&&b.cells.some(c=>norm(blockText(c.blocks))==='MtF'));
assert.equal(norm(blockText(gender.cells.find(c=>c.sourceBox?.[1]===558.54&&c.col===0).blocks)),'MtF');
assert.equal(norm(blockText(gender.cells.find(c=>c.sourceBox?.[1]===627.9&&c.col===0).blocks)),'FtM');
for(const bad of ['sitinigaV','sesotamreD',')syaD – sruoH( YLRAE'])assert.ok(!cat.topics.some(t=>t.text.includes(bad)),bad);
const trauma=blocks(217).find(b=>b.type==='table'&&b.rows===4&&b.cols===2);assert.ok(trauma);
for(const [row,label,items]of[[1,'Before the Exam',4],[2,'During the Exam',4],[3,'After the Exam',1]]){assert.equal(blockText(trauma.cells.find(c=>c.row===row&&c.col===0).blocks).trim(),label);assert.equal(trauma.cells.find(c=>c.row===row&&c.col===1).blocks.filter(b=>b.type==='list-item').length,items);}
const abdominal=blocks(68).find(b=>b.id==='abd-upper-box');assert.equal(abdominal.cells.find(c=>c.col===1).rowspan,2);assert.match(blockText([abdominal]),/Cannot miss dx/);
assert.equal(page(126).panels.find(s=>s.id==='p126-3').title,'Rickettsia');
let reviewedRefs=0;
for(const group of cases.footnoteGroups){
 for(const ns of group.notes){
  const note=blocks(group.context.pdfPage).filter(b=>b.footnote&&norm(text(b))===norm(ns.exactText));assert.equal(note.length,1,group.id);assert.equal(note[0].footnote.marker,ns.marker);
  for(const anchor of ns.referenceAnchors){
   const found=blocks(group.context.pdfPage).find(b=>!b.footnote&&norm(text(b))===norm(anchor.exactText));assert.ok(found,anchor.label);
   const runs=found.runs.filter(r=>r.noteId===note[0].footnote.id);assert.equal(runs.map(r=>r.t).join(''),ns.marker,anchor.label);assert.ok(note[0].footnote.refs.includes(runs[0].noteRefId));reviewedRefs++;
  }
 }
}
assert.equal(reviewedRefs,20);
for(const [phrase,definition]of[['Adenosine*','hearttransplant'],['IV BB or Dilt**','**avoidifHFrEF'],['Oral vs IV BB or Dilt*','*avoidifHFrEF'],['(rhythm,rate)**','possiblecardioversion']]){
 const b=blocks(7).find(b=>text(b).includes(phrase)),id=b.runs.find(r=>r.noteId)?.noteId,note=blocks(7).find(b=>b.footnote?.id===id);assert.ok(note&&norm(text(note)).includes(definition),`Scope repeated marker to source branch: ${phrase}`);
}
for(const c of cases.negativeMarkers){const b=blocks(c.context.pdfPage).find(b=>norm(text(b))===norm(c.exactText));assert.ok(b,`Source negative found: ${c.exactText}`);assert.ok(!b.footnote&&!b.runs.some(r=>r.noteId),c.reason);}
const auto=page(170).panels[0],table=auto.blocks.find(b=>b.type==='table'),notes=notesForTable(table,auto.blocks);
assert.equal(notes.length,2);assert.deepEqual(notes.map(n=>n.footnote.refs.length),[5,2]);assert.ok(!blocks(170).find(b=>text(b)==='HMGCR').runs.some(r=>r.noteId));
const noteIds=new Set(),refIds=new Set();let refs=0,noteCount=0;
for(const p of pages){const markup=renderBlocks(p.panels.flatMap(s=>s.blocks),{pdfPage:p.pdfPage}),ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,`Unique DOM ids, PDF${p.pdfPage}`);
 for(const b of blocks(p.pdfPage)){
  if(b.footnote){noteCount++;assert.ok(!noteIds.has(b.footnote.id));noteIds.add(b.footnote.id);for(const ref of b.footnote.refs)assert.ok(markup.includes(`id="${ref}"`),ref);}
  for(const r of b.runs||[])if(r.noteId){refs++;assert.ok(!refIds.has(r.noteRefId));refIds.add(r.noteRefId);assert.ok(markup.includes(`id="${r.noteId}"`));}
 }
}
assert.equal(noteCount,86);assert.equal(refs,24);
const expanded=renderBlocks([table,...notes],{expand:false,idPrefix:'focus-'});
for(const n of notes){assert.ok(expanded.includes(`id="focus-${n.footnote.id}"`));for(const ref of n.footnote.refs)assert.ok(expanded.includes(`id="focus-${ref}"`));}
assert.ok(!renderRuns([{t:'*',noteId:'bad"><script>',noteRefId:'x'}]).includes('<a'));
const js=await readFile(new URL('../folio/folio.js',import.meta.url),'utf8');assert.match(js,/jumpToNote/);assert.match(js,/parent\.open=true/);
console.log('Verified visible ECG source characters, rotated labels and row associations, trauma exam rows, 86 separate note paragraphs, 24 source-reviewed marker links, repeated-symbol scopes, formula guards and focus-dialog IDs.');

const uti=blocks(112).find(b=>b.id==='table-112-1');assert.ok(uti.cells.every(c=>!c.header));const utiHtml=renderBlocks([uti]);assert.match(utiHtml,/<ul>/);assert.match(blockText([uti]),/Uncomplicated UTI/);assert.ok(!/<th[ >]/.test(utiHtml));

assert.ok(!renderBlocks([{type:'list-item',runs:[{t:'• .'}]}]).includes('<li>'));
assert.ok(blocks(93).some(b=>b.type==='list-item'&&text(b).includes('must assume GFR <10 if')));
assert.ok(blocks(187).some(b=>text(b).includes('immunosuppressant (rituximab')));
assert.ok(blocks(108).some(b=>text(b).includes('coverage. ; emerging evidence')));

const oxygenTable=blocks(44).find(b=>b.id==='table-44-1');assert.equal(oxygenTable.rows,8);assert.ok(!blockText([oxygenTable]).includes('Target SpO2'));assert.ok(blocks(44).some(b=>b.type==='list-item'&&text(b).includes('Target SpO2')));
assert.ok(!js.includes("['assessment','Assessment']"));assert.ok(js.includes('aria-label="Sections in this topic"'));

const screening=page(210).panels[0].blocks.find(b=>b.type==='table');const cards=renderBlocks([screening],{screeningCards:true});assert.match(cards,/class="screening-card"/);assert.match(cards,/Ages shown:/);assert.ok(!cards.includes('<table'));assert.ok(renderBlocks([screening],{screeningCards:false}).includes('<table'));
assert.ok(!renderRuns([{t:'local policy',href:'https://hospitalpolicies.ellucid.com/test'}]).includes('href='));
const respiratory=renderBlocks(page(42).panels.flatMap(s=>s.blocks));assert.ok(respiratory.includes('Have following information ready prior to intubation'));assert.ok(!respiratory.includes('” : have following'));

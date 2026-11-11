import {cardiacProcedures,procedureRedactions} from '../folio/cardiac-procedures.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cardiologyContents,cardiologyEntries,cardiologyMarkup,searchCardiology,resolveCardiologyId} from '../folio/cardiology.mjs';
const fixture=JSON.parse(await readFile(new URL('../tests/cardiology-toc-cases.json',import.meta.url),'utf8'));
assert.equal(cardiologyContents.sourceSha256,fixture.sourceSha256);assert.equal(cardiologyContents.sections.length,7);assert.equal(cardiologyEntries.length,57);
assert.equal(new Set(cardiologyEntries.map(n=>n.id)).size,57);
assert.deepEqual(cardiologyEntries.slice(1).map(n=>({title:n.title,page:n.page,level:n.ancestors.length,tocPdfPage:n.tocPdfPage})),fixture.entries.slice(3));
assert.deepEqual(cardiologyEntries.filter(n=>n.title==='Electrophysiology Studies and Procedures').map(n=>n.page),[104,112]);
const management=cardiologyEntries.find(n=>n.title==='Management');assert.equal(management.children.length,4);
const vte=cardiologyEntries.find(n=>n.title==='Venous Thromboembolism');assert.equal(vte.children.length,3);
const leaf=cardiologyEntries.find(n=>n.title==='HFpEF');assert.match(cardiologyMarkup(leaf.id),/Chapter content to follow/);assert.match(cardiologyMarkup(leaf.id),/Book page 45/);
assert.match(cardiologyMarkup(),/7 sections/);assert.match(cardiologyMarkup('invalid-id'),/Chapter not found/);
assert.equal(searchCardiology('transplant').length,1);assert.equal(searchCardiology('does-not-exist').length,0);assert.ok(!cardiologyMarkup('', '<script>').includes('<script>'));
const overview=cardiologyEntries[0];assert.equal(overview.title,'Overview of Cardiac Procedures');assert.equal(overview.children.length,0);assert.equal(overview.contentId,'cardiac-procedures');assert.equal(cardiacProcedures.length,4);
assert.ok(!cardiologyEntries.some(n=>n.title==='CCU & SDU Rotation Overview'));assert.ok(!cardiologyEntries.some(n=>n.title==='Overview of Cardiac Procedures Relevant to CCU/SDU Patients:'));
assert.equal(resolveCardiologyId('introduction-to-inpatient-cardiology-6'),overview.id);
const page=cardiologyMarkup(overview.id);for(const term of ['MGH','Ellucid','Ellison 11','cardiac access fellow','Chapter content to follow'])assert.ok(!page.includes(term),term);
for(const procedure of cardiacProcedures){assert.ok(page.includes(`id="procedure-${procedure.id}"`));assert.ok(procedure.items.some(i=>i.label==='Indications'));}
for(const term of ['14F','180bpm','balloon deflated','bilateral neurovascular','1-6 weeks','2-5 mo'])assert.ok(page.includes(term),`Source phrase retained: ${term}`);
assert.ok(procedureRedactions.length);assert.ok(searchCardiology('radiofrequency').some(n=>n.id===overview.id));
for(const n of cardiologyEntries)assert.ok(!cardiologyMarkup(n.id).includes('undefined'));
console.log('Verified the requested introductory replacement, four procedure transcriptions/redactions, all remaining TOC entries, nested hierarchy, scoped search, links and remaining chapter placeholders.');

const {acsChapters,acsSource}=await import('../folio/acs-content.mjs');
const {walkBlocks}=await import('../folio/notes.mjs');
const {blockText}=await import('../folio/content.mjs');
const acs=cardiologyContents.sections[1];
const expected=acs.children.flatMap(n=>[n,...n.children]);
assert.deepEqual(Object.keys(acsChapters),expected.map(n=>n.id));
assert.deepEqual(acsSource.bookPages,[11,37]);
assert.deepEqual(acsSource.contributors,['Erik Dove','Peyton Hanson']);
assert.equal(acsSource.sha256,'e20d60c985a0feffd2abed9a411e1e897bb8e814192f800f0cceca5a740b8b0a');
const provenance=JSON.parse(await readFile(new URL('../folio/acs-provenance.json',import.meta.url),'utf8'));
assert.deepEqual(provenance.source,acsSource);
for(const n of acs.children)assert.ok(cardiologyMarkup(acs.id).includes('href="#cardiology-reference/'+n.id+'"'));
for(const n of management.children)assert.ok(cardiologyMarkup(management.id).includes('href="#cardiology-reference/'+n.id+'"'));
const institution=/\b(?:MGH|Ellucid|Ellison|PDW|CCU|SDU|E10\/E11|Amion|HYPERLINK|moonlighting fellow)\b|6-8282|post-cath holding area|at night\)|admission template|\(ACS protocol\)/i;
const sectionIds=new Set(),tables=new Map(),sourcePages=new Set(),figures=new Set();
const text=blocks=>blockText(blocks).replace(/\s+/g,' ').trim();
for(const n of expected){
 const c=acsChapters[n.id],html=cardiologyMarkup(n.id);
 assert.ok(c.sections.length>0);
 assert.match(html,/Chapter text available/);
 assert.doesNotMatch(html,institution);
 assert.doesNotMatch(html,/Chapter content to follow/);
 for(const s of c.sections){
  assert.ok(s.blocks.length>0);
  assert.ok(!sectionIds.has(s.id));
  sectionIds.add(s.id);
  assert.ok(html.includes('id="'+s.id+'"'));
  for(const b of walkBlocks(s.blocks)){
   if(b.pdfPage)sourcePages.add(b.pdfPage);
   if(b.type==='figure'){
    figures.add(b.src);
    assert.match(b.src,/^assets\/acs-[a-z0-9-]+\.webp$/);
    const asset=await readFile(new URL('../folio/'+b.src,import.meta.url));
    assert.equal(asset.toString('ascii',8,12),'WEBP');
    assert.ok(b.width>50&&b.height>50);
   }
   if(b.type!=='table')continue;
   assert.ok(!tables.has(b.id));tables.set(b.id,b);
   const grid=new Set();
   for(const c of b.cells)for(let r=c.row;r<c.row+c.rowspan;r++)for(let col=c.col;col<c.col+c.colspan;col++){
    assert.ok(r<b.rows&&col<b.cols);
    const k=r+','+col;assert.ok(!grid.has(k),b.id+' overlapping cell '+k);grid.add(k);
   }
   assert.equal(grid.size,b.rows*b.cols,b.id);
   if(b.continuationHeaders)assert.equal(b.continuationHeaders.length,b.cols);
   assert.ok(html.includes('data-table="'+b.id+'"'),b.id);
  }
 }
}
assert.deepEqual([...sourcePages].sort((a,b)=>a-b),Array.from({length:27},(_,i)=>i+1));
assert.equal(tables.size,provenance.nativeTableCount);
assert.equal(figures.size,provenance.figureCount);
function cell(id,label,col){
 const t=tables.get(id),row=t.cells.find(c=>text(c.blocks).includes(label));
 assert.ok(row,id+': '+label);
 return text(t.cells.find(c=>c.row===row.row&&c.col===col).blocks);
}
assert.equal(cell('acs-chest-pain-likelihood-ratios','Radiation to right arm',1),'1.3 (0.78-2.1)');
assert.equal(cell('acs-chest-pain-likelihood-ratios','Pleuritic pain',1),'0.35-0.61');
assert.equal(cell('acs-injury-localization','Large Inferior MI',1),'Proximal RCA (90%) or LCx (10%)');
assert.match(cell('acs-injury-localization','Critical Left Main Dz',2),/aVR.*widespread STD/);
assert.equal(cell('acs-st-elevation-depression-ddx','Hyperkalemia',2),'Hypokalemia');
assert.match(cell('acs-mechanical-21','LV Thrombus',4),/Warfarin \(INR 2-3\)/);
assert.match(cell('acs-electrical-23','Ventricular Fibrillation',4),/ACLS\/defibrillation/);
assert.ok(searchCardiology('sgarbossa').some(n=>n.id==='diagnosis-12'));
assert.ok(searchCardiology('cangrelor').some(n=>n.id==='acs-pharmacologic-management-18'));
assert.ok(searchCardiology('papillary muscle rupture').some(n=>n.id==='post-mi-complications-30'));
assert.match(cardiologyMarkup('classification-11'),/OPQRST\s*mnemonic/);
assert.match(cardiologyMarkup('diagnosis-12'),/non-diagnostic ECG/);
assert.match(cardiologyMarkup('post-mi-complications-30'),/paper-references/);
assert.match(cardiologyMarkup('classification-11'),/<sup>49<\/sup>/);
assert.match(cardiologyMarkup('acs-pharmacologic-management-18'),/CYP2C19/);
console.log('Verified ACS chapter routes, all 27 source pages, redactions, search, 7 native table grids and clinical row associations, and 13 figure assets.');

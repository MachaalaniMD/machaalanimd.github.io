import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderBlocks,blockText,escapeHtml} from '../folio/content.mjs';
import {enumerationPlan,sliceRuns,textOf,cleanTitle,splitHeading,tableSizing,readingSections} from '../folio/reading.mjs';
import {readingPlans} from '../folio/reading-plans.mjs';
import {attributionMarkup} from '../folio/about.mjs';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const cat=await read('../folio/catalog.json'),fixtures=await read('../tests/folio-reading-cases.json');
const pages=cat.topics.flatMap(t=>t.pages),page=n=>pages.find(p=>p.pdfPage===n);
function* walk(bs){for(const b of bs){yield b;yield*walk(b.blocks||[]);for(const col of b.columns||[])yield*walk(col);for(const cell of b.cells||[])yield*walk(cell.blocks);}}
const tables=n=>[...walk(page(n).panels.flatMap(s=>s.blocks))].filter(b=>b.type==='table');
// Shapes independently reviewed against the printed grids, including their class bands.
for(const [n,rows,cols] of [[79,11,2],[138,14,4],[139,6,5],[139,3,5],[139,2,4],[170,29,4],[172,27,3],[174,18,5],[177,6,5],[185,5,5],[189,10,5],[192,11,3],[194,11,5],[200,9,12],[202,15,11],[210,28,16],[210,8,10],[211,8,16],[211,8,10],[211,16,7],[213,14,5],[214,3,4],[222,7,4],[231,5,6],[236,2,6],[237,5,6],[261,11,7],[261,11,3],[267,5,6]])assert.ok(tables(n).some(b=>b.rows===rows&&b.cols===cols),`Reviewed PDF grid ${n}: ${rows}×${cols}`);
assert.equal(fixtures.sourceSha256,cat.metadata.sourceSha256);
const attribution=attributionMarkup(cat.metadata.attribution);
assert.equal(cat.metadata.attribution.allPrintedNameForms.length,185);
for(const name of fixtures.printedContributorNameForms)assert.ok(attribution.includes(escapeHtml(name)),`Credit retained: ${name}`);
assert.match(attribution,/https:\/\/mghwhitebook.app\//);
assert.equal(cat.metadata.attribution.contributorsByChapter.flatMap(c=>c.topics).length,211,'Includes credits to omitted material');
const html=await readFile(new URL('../folio/index.html',import.meta.url),'utf8'),js=await readFile(new URL('../folio/folio.js',import.meta.url),'utf8');
assert.equal((html.match(/id="attribution-open"/g)||[]).length,1);
assert.ok(html.indexOf('id="attribution-open"')>html.indexOf('id="about-overview"'));
for(const boilerplate of ['SOURCE EDITION','SOURCE SECTION','source page${','Source notes','Source contributors','source-footer','source-details'])assert.ok(!js.includes(boilerplate)&&!html.includes(boilerplate),`No repeated ${boilerplate}`);
const titleRuns=[{t:'ETIOLOGY '},{t:'(Lancet 2014;383:2152)',href:'https://example.org/paper'}];
const h=splitHeading(titleRuns);assert.equal(cleanTitle(textOf(titleRuns)),'Etiology');assert.equal(h.references[0][0].href,'https://example.org/paper');
const section=renderBlocks([{type:'heading',runs:titleRuns},{type:'paragraph',runs:[{t:'Unchanged clinical text.'}]}]);
assert.match(section,/<h3>Etiology<\/h3>/);assert.ok(section.indexOf('Lancet')>section.indexOf('Unchanged clinical text.'));assert.match(section,/class="paper-references"/);
assert.equal(cleanTitle('ICD INDICATIONS (CLASS I) (JACC 2018;72:e91)'),'ICD Indications (Class I)');
assert.equal(cleanTitle('CPP INDICATIONS (2022 AHA HF Guideline), 2023 HRS Guideline on CPP)'),'CPP Indications');
assert.equal(cleanTitle('GENERAL APPROACH (Harrison’s 18th Ed.)'),'General Approach');
for(const c of readingPlans.positive){const runs=[{t:c.exactOriginalText}],p=enumerationPlan(runs,{pdfPage:c.page});assert.ok(p,c.id);assert.equal([p.prefix,...p.items,p.suffix].map(r=>textOf(sliceRuns(runs,...r))).join(''),c.exactOriginalText,`Exact partition ${c.id}`);}
for(const c of readingPlans.negative)assert.equal(enumerationPlan([{t:c.exactOriginalText}],{pdfPage:c.page}),null,`Keep conditional instructions intact: ${c.id}`);
const actualPlans=[];
for(const p of pages)for(const b of walk(p.panels.flatMap(s=>s.blocks)))if(b.runs){const plan=enumerationPlan(b.runs,{pdfPage:p.pdfPage});if(plan)actualPlans.push(plan.id);}
for(const c of readingPlans.positive)assert.ok(actualPlans.includes(c.id),`Actual shipped subtype group ${c.id}`);
const refeeding=renderBlocks(page(79).panels.flatMap(s=>s.blocks),{pdfPage:79});assert.match(refeeding,/data-reading-plan="refeeding/);assert.match(refeeding,/class="sibling-subtypes"/);
const antidepressants=tables(202).find(b=>b.cols===11);assert.equal(antidepressants.cells.filter(c=>blockText(c.blocks).trim()==='-').length,36,'Source minus signs are values, not empty cells');
const postpartum=blockText(page(214).panels.flatMap(s=>s.blocks));assert.match(postpartum,/If ⊝, q3y for life/);assert.ok(!postpartum.includes('monito⊝ring'));
const dm=tables(174)[0],cell=(row,col)=>dm.cells.find(c=>c.row===row&&c.col===col);
assert.match(blockText(cell(2,0).blocks),/500-1000mg BID/);assert.equal(blockText(cell(2,1).blocks),'1-2');
assert.match(blockText(cell(9,0).blocks),/Tirzepatide/);assert.equal(blockText(cell(9,1).blocks),'2.6');
for(const col of [2,3,4])assert.equal(cell(8,col).rowspan,2,'GLP-1/Tirzepatide shared cells retain source scope');
assert.ok(tables(237)[0].cells.every(c=>!c.header),'A continuation body row is not a header');
const sizing=tableSizing({cols:2,cells:[{col:0,colspan:1,blocks:[{type:'paragraph',runs:[{t:'2'}]}]},{col:1,colspan:1,blocks:[{type:'paragraph',runs:[{t:'A long clinical explanation. '.repeat(15)}]}]}]});assert.ok(sizing[1]>=300&&sizing[1]>sizing[0]);
const rendered=renderBlocks([dm],{title:'Non-insulin agents'});assert.match(rendered,/data-table="table-174-1"/);assert.match(rendered,/<colgroup>/);assert.ok(!/<th[^>]*><h3>/.test(rendered),'Column labels reflow together');
console.log('Verified centralized credits, clean citation headings, 20 source-reviewed subtype groups and 9 conditional guards, repaired table shapes, punctuation and medication associations.');

assert.equal(cleanTitle('CT CHEST'),'CT Chest');assert.equal(cleanTitle('Ct Chest'),'CT Chest');assert.equal(cleanTitle('HFREF MANAGEMENT'),'HFrEF Management');

assert.equal(cleanTitle('Renal Tubular Acidosis (Rta)'),'Renal Tubular Acidosis (RTA)');
assert.equal(cleanTitle('ANCA-Associated Small-Vessel Vasculitis (Aav)'),'ANCA-Associated Small-Vessel Vasculitis (AAV)');
assert.equal(cleanTitle('Proceed As Tolerated for all patients'),'Proceed As Tolerated for all patients');

const panel=id=>pages.flatMap(p=>p.panels).find(p=>p.id===id);
const panelMarkup=id=>{
 const data=panel(id);
 return renderBlocks(data.readerBlocks||data.blocks);
};
const sickleCell=panelMarkup('p130-2');
assert.match(sickleCell,/<p>Consult inpatient hematology/);
assert.match(sickleCell,/ED arrival ± fluids/);
assert.match(sickleCell,/0\.02-0\.05mg\/kg \(max 1\.5mg\)/);
assert.doesNotMatch(sickleCell,/If uncontrolled,|<p>[”).]+<\/p>/);
assert.equal(renderBlocks([
 {type:'paragraph',runs:[{t:'Dose .5mg/kg; (+), (-), and -3.'}]},
 {type:'paragraph',runs:[{t:'”).'}]}
]),'<p>Dose .5mg/kg; (+), (-), and -3.</p>');
for(const [id,phrase] of [
 ['p27-1','Escalating inotropes/pressors'],
 ['p48-2','Control airway if dyspneic'],
 ['p56-3','COVID-19: RECOVERY trial'],
 ['p242-1','pad count (monitors bleeding quantity)']
])assert.ok(panelMarkup(id).includes(phrase),id);

const overview=tables(164).find(t=>t.id==='table-164-overview');
assert.deepEqual([overview.rows,overview.cols],[3,5]);
for(const [r,c,phrase] of [
 [0,1,'Inflammatory Arthritis'],[1,1,'RA, seronegative spondyloarthropathy'],
 [1,2,'systemic sclerosis'],[2,3,'Small: ANCA'],[2,4,'Sarcoid: Ca']
])assert.ok(blockText(overview.cells.find(cell=>cell.row===r&&cell.col===c).blocks).includes(phrase),phrase);
assert.match(panelMarkup('p164-0'),/diagram-0164-00\.webp/);

const alcohol=cat.topics.find(t=>t.id==='alcohol-use-disorder-withdrawal-204');
assert.deepEqual(readingSections(alcohol).map(s=>[s.title,s.parts.map(({panel})=>panel.id)]),[
 ['Substance Use - General Principles',['p204-0']],
 ['SUD Levels of Care',['p204-2']],
 ['Alcohol Use Disorder (AUD)',['p204-3','p205-0']],
 ['Alcohol Withdrawal Syndrome',['p205-1','p206-0']]
]);
const criteria=panelMarkup('p204-0').match(/<ol>(.*?)<\/ol>/)?.[1];
assert.ok(criteria,'DSM-5-TR criteria appear together in one ordered list');
assert.deepEqual([...criteria.matchAll(/<li value="(\d+)"/g)].map(m=>Number(m[1])),Array.from({length:11},(_,i)=>i+1));
assert.doesNotMatch(criteria,/Risk Factors|Screening:|CAGE/);
assert.match(panelMarkup('p204-2'),/“detox” → CSS → TSS → long-term residential tx → sober living/);

for(const topic of cat.topics){
 const sections=readingSections(topic);
 assert.deepEqual(sections.flatMap(s=>s.parts.map(({panel})=>panel.id)),
  topic.pages.flatMap(p=>p.panels.map(s=>s.id)),`All source parts remain reachable in ${topic.id}`);
 assert.equal(new Set(sections.map(s=>s.title.toLowerCase())).size,sections.length,
  `Distinct section labels in ${topic.id}`);
 for(const {id,parts} of sections)
  for(const {panel} of parts.slice(1))assert.equal(panel.continuesSection,id);
}
console.log('Verified acronym casing, preserved clinical symbols, omission cleanup, rheumatology table associations, alcohol criteria and progression, and section navigation for all 210 topics.');

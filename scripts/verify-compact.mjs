import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderBlocks,renderRuns,blockText} from '../folio/content.mjs';
const root=new URL('../',import.meta.url),cat=JSON.parse(await readFile(new URL('folio/catalog.json',root),'utf8')),cases=JSON.parse(await readFile(new URL('tests/folio-compact-cases.json',root),'utf8'));
const pages=cat.topics.flatMap(t=>t.pages),page=n=>pages.find(p=>p.pdfPage===n);
function* walk(bs){for(const b of bs){yield b;yield*walk(b.blocks||[]);for(const col of b.columns||[])yield*walk(col);for(const c of b.cells||[])yield*walk(c.blocks);}}
const blocks=n=>[...walk(page(n).panels.flatMap(s=>s.blocks))],text=b=>(b.runs||[]).map(r=>r.t).join(''),norm=s=>s.replace(/\s/g,'');
for(const c of cases.wrapPositives)assert.ok(blocks(c.pdfPage).some(b=>b.type===c.type&&norm(text(b)).includes(norm(c.expectedText))),`Wrapped source item stays together: ${c.id}`);
for(const c of cases.boundaryNegatives){const found=blocks(c.pdfPage).filter(b=>b.runs);assert.ok(found.some(b=>norm(text(b)).includes(norm(c.rightText))),c.id);assert.ok(!found.some(b=>norm(text(b)).includes(norm(c.leftText))&&norm(text(b)).includes(norm(c.rightText))),`Keep independent source paragraphs: ${c.id}`);}
for(const c of cases.rhythmBags){const actual={};for(const b of blocks(c.pdfPage))for(const ch of text(b))if(!/\s/.test(ch))actual[ch]=(actual[ch]||0)+1;assert.deepEqual(actual,c.retainedCharacterBag,`Every source pathway character assigned once on PDF${c.pdfPage}`);}
const brady=blocks(6),branch=(question,label)=>brady.find(b=>b.question===question&&b.branchLabel===label);
assert.match(blockText(branch('Are P waves present?','No').blocks),/Sinus arrest/);
assert.match(blockText(branch('Regular P-P interval?','No').blocks),/Wandering pacemaker/);
assert.match(blockText(branch('Regular P-R interval?','No').blocks),/CHB w\/ junctional escape/);
assert.match(blockText(branch('Regular P-R interval?','Yes').blocks),/Mobitz I w\/ 2:1 block/);
const energy=blocks(7).find(b=>b.type==='table'),cell=(row,col)=>blockText(energy.cells.find(c=>c.row===row&&c.col===col).blocks).trim();
assert.equal(cell(4,0),'Wide & Irregular');assert.equal(cell(4,1),'Defib');assert.equal(cell(4,2),'120-200');assert.match(blockText(page(7).panels.flatMap(s=>s.blocks)),/Biphasic/);
const diagnostic=page(6).panels.find(s=>s.id==='rhythm-p6-diagnosis'),markup=renderBlocks(diagnostic.blocks,{title:diagnostic.title});assert.equal((markup.match(/class="pathway-branch"/g)||[]).length,6);assert.match(markup,/Expand all branches/);assert.ok(!markup.includes('class="pathway-branch" open'));
for(const [n,value] of [[58,'-1'],[58,'-5'],[244,'-1000'],[244,'-100'],[141,'-5 or del(5q); -7; -17/abn(17p)']]){const b=blocks(n).find(b=>text(b)===value);assert.equal(b?.type,'paragraph');assert.ok(!renderBlocks([b]).includes('<li>'));}
for(const [source,display] of [['-Hypothyroidism','Hypothyroidism'],['-≥60 to <70 kg: 35 mg','≥60 to &lt;70 kg: 35 mg'],['– liver most common','liver most common']])assert.ok(renderBlocks([{type:'list-item',runs:[{t:source}]}]).includes(`<li>${display}</li>`));
assert.match(renderRuns([{t:'Important',u:true,b:true,i:true}]),/<strong><span class="source-underline">Important<\/span><\/strong>/);
let checked=0;
for(const f of cases.underlineFixtures){
 const box=f.sourceBox,cx=(box[0]+box[2])/2,cy=(box[1]+box[3])/2,needle=norm(f.phrase);
 const candidates=blocks(f.pdfPage).filter(b=>b.runs&&norm(text(b)).includes(needle)&&(b.sourceLines||[]).some(l=>l[0]-.8<=cx&&cx<=l[2]+.8&&l[1]-.8<=cy&&cy<=l[3]+.8));
 assert.ok(candidates.length,`Source underline fixture located: ${f.pdfPage} ${f.phrase}`);
 const b=candidates[0],chars=b.runs.flatMap(r=>[...r.t].filter(ch=>! /\s/.test(ch)).map(ch=>({ch,u:!!r.u}))),all=chars.map(c=>c.ch).join('');let at=all.indexOf(needle);if(f.phrase==='FENa'&&!f.expectedUnderline)at=all.indexOf(needle,at+1);
 const flags=chars.slice(at,at+needle.length);assert.ok(at>=0&&flags.length===needle.length);assert.equal(f.expectedUnderline?flags.every(c=>c.u):flags.some(c=>c.u),f.expectedUnderline,`Original underline, not bold/borders: ${f.pdfPage} ${f.phrase}`);checked++;
}
const aki=blocks(93).find(b=>text(b).startsWith('1) History/exam'));assert.match(text(aki),/post-strep GN/);assert.match(text(aki),/rashes \(AIN, vasculitis\)/);
const tte=blocks(24).find(b=>b.type==='callout'&&b.sourceBox?.[0]===420);assert.ok(tte);assert.match(blockText(tte.blocks),/Indications for STAT TTE/);
console.log(`Verified source-owned rhythm branches and energy rows,12 wrap repairs,6 paragraph boundaries, numeric minus signs, clean bullet markers and ${checked} original underline fixtures.`);

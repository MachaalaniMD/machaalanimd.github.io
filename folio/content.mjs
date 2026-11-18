import {screeningGroups} from './screening.mjs?v=20261107-cardiopulm';
import {textOf,sliceRuns,splitHeading,cleanTitle,enumerationPlan,tableSizing,cleanReadingRuns} from './reading.mjs?v=reference-layout';
import {noteDomId} from './notes.mjs?v=20261107-cardiopulm';
export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeHtml;
function publicReference(href){
 if(!href||!/^https?:\/\//i.test(href))return false;
 let host;
 try{host=new URL(href).hostname;}catch{return false;}
 return !/(?:^|\.)(?:ellucid\.com|partners\.org|partnershealthcare\.sharepoint\.com|mgh\.harvard\.edu|mgb\.org|mghwhitebook\.app)$/.test(host);
}
export function renderRuns(runs=[],context={}){return runs.map(r=>{let text=esc(r.t);if(r.u&&!r.href)text=`<span class="source-underline">${text}</span>`;if(r.cite)text=`<span class="cite">${text}</span>`;if(r.b)text=`<strong>${text}</strong>`;if(r.i)text=`<em>${text}</em>`;if(r.sup)text=`<sup>${text}</sup>`;else if(r.sub)text=`<sub>${text}</sub>`;const target=noteDomId(r.noteId,context),ref=noteDomId(r.noteRefId,context);if(target&&ref)text=`<a class="footnote-ref" href="#${esc(r.noteId)}" id="${esc(ref)}" data-note-target="${esc(target)}" aria-label="Footnote ${esc(r.t)}"><sup>${text}</sup></a>`;else if(publicReference(r.href))text=`<a href="${esc(r.href)}" target="_blank" rel="noreferrer">${text}</a>`;return text;}).join('');}
function listRuns(runs){const text=textOf(runs);const m=text.match(/^\s*(?:[•▪◦●○]|o(?=\s)|[-–](?!\d)|(?:\d+|[a-z])[.)](?=\s))\s*/);return sliceRuns(runs,m?m[0].length:0,text.length);}
// Readability rules for converted book text (display only; source runs are unchanged).
const CITE=/\((?=[^()]*\b(?:19|20)\d{2}\b)[^()]{3,160}\)/g;
function markCitations(runs){
 const text=textOf(runs),ranges=[...text.matchAll(CITE)].filter(m=>/\b(?:NEJM|JAMA|Lancet|BMJ|Circ|JACC|Chest|CHEST|Ann|AJ[A-Z]|Blood|JCO|Gastro|Hepatology|CID|Crit|CCM|ERJ|Thorax|Stroke|Neurology|Kidney|JASN|CJASN|AHA|ACC|ESC|IDSA|ATS|ADA|USPSTF|ACG|AGA|KDIGO|NCCN|Rev|J |Am |Eur|Int|Med|guideline|Guideline|Cochrane|Mayo|Clin|Endo|Diab|Thromb|Haem|Heart|Rheum|Arthritis|Lupus|Infect|Pain|Psych|Hosp|Surg|Radiol|Proc)/.test(m[0]));
 if(!ranges.length)return runs;
 const out=[];let at=0;
 for(const m of ranges){out.push(...sliceRuns(runs,at,m.index),...sliceRuns(runs,m.index,m.index+m[0].length).map(r=>({...r,cite:true})));at=m.index+m[0].length;}
 out.push(...sliceRuns(runs,at,text.length));return out;
}
// "… 1) x, 2) y or 3) z" written inline becomes a short list.
function inlineEnumeration(text){
 const marks=[...text.matchAll(/(?:^|[\s:;,(])(\(?(\d{1,2})\))\s+(?=\S)/g)].map(m=>({at:m.index+m[0].indexOf(m[1]),n:+m[2],len:m[1].length}));
 let seq=[];for(const m of marks){if(m.n===1)seq=[m];else if(seq.length&&m.n===seq.at(-1).n+1)seq.push(m);}
 if(seq.length<2||text.length<90)return null;
 return {prefix:[0,seq[0].at],items:seq.map((m,i)=>[m.at+m.len,i+1<seq.length?seq[i+1].at:text.length])};
}
const ABBR=/(?:\b(?:e\.g|i\.e|vs|etc|approx|pts?|Dr|St|Fig|No|incl|max|min|esp|dx|tx|hx|sx|w|b\/c|cf|al|Ref|Jr|Sr|mg|mL|U|mo|yr|yrs|wk|wks|hr|hrs|ca|resp|appt|dept|gr|int|ext|sat|neg|pos|nl|abx|approx|Ave|Ca|Na|K|Mg|Cl|vol|Vol|ed|Ed|eds|J|Med|Am|Engl|Int|Clin|Rev|Soc)|\b[A-Z])$/;
function sentenceBreaks(text,min=300){
 if(text.length<min)return [];
 const cuts=[];const re=/[.!?](?=\s+[A-Z(“"↑↓])/g;let m;
 while((m=re.exec(text))){const before=text.slice(Math.max(0,m.index-12),m.index);if(ABBR.test(before)||/\d$/.test(before)&&/^\s+\d/.test(text.slice(m.index+1)))continue;
  let depth=0;for(let i=0;i<m.index;i++){if(text[i]==='(')depth++;else if(text[i]===')')depth=Math.max(0,depth-1);}if(depth)continue;cuts.push(m.index+1);}
 return cuts.length>=(min<300?1:2)?cuts:[];
}
const sentences=(rs,context,min)=>{const t=textOf(rs),cuts=sentenceBreaks(t,min);if(!cuts.length)return renderRuns(markCitations(rs),context);const pts=[0,...cuts,t.length];return pts.slice(0,-1).map((a,i)=>`<span class="sent">${renderRuns(markCitations(sliceRuns(rs,a,pts[i+1])),context).trim()}</span>`).join('');};
function prose(runs,context,isList=false){
 runs=cleanReadingRuns(runs);
 const plan=enumerationPlan(runs,context),display=rs=>renderRuns(markCitations(isList?listRuns(rs):rs),context);
 if(plan)return `${display(sliceRuns(runs,...plan.prefix))}<ul class="sibling-subtypes" data-reading-plan="${esc(plan.id)}">${plan.items.map(([a,b])=>`<li>${renderRuns(markCitations(sliceRuns(runs,a,b)),context)}</li>`).join('')}</ul>${plan.suffix[1]>plan.suffix[0]?`<div class="shared-qualifier">${renderRuns(sliceRuns(runs,...plan.suffix),context)}</div>`:''}`;
 if(context.edited)return display(runs);
 const shown=isList?listRuns(runs):runs,text=textOf(shown);
 const en=inlineEnumeration(text);
 if(en){const pre=textOf(sliceRuns(shown,...en.prefix)).trim();return `${pre?`<span class="enum-lead">${sentences(sliceRuns(shown,...en.prefix),context,120)}</span>`:''}<ol class="inline-enum">${en.items.map(([a,b])=>`<li>${renderRuns(markCitations(sliceRuns(shown,a,b)),context).replace(/(?:,|;|\s)*(?:\s(?:<em>)?(?:or|and)(?:<\/em>)?)?\s*$/,'')}</li>`).join('')}</ol>`;}
 const cuts=sentenceBreaks(text);
 if(cuts.length){const pts=[0,...cuts,text.length];return pts.slice(0,-1).map((a,i)=>`<span class="sent">${renderRuns(markCitations(sliceRuns(shown,a,pts[i+1])),context).trim()}</span>`).join('');}
 return renderRuns(markCitations(shown),context);
}
function styledHeading(runs,context){const raw=textOf(runs),trimmed=sliceRuns(runs,raw.length-raw.trimStart().length,raw.trimEnd().length),desired=[...cleanTitle(raw)].filter(c=>! /\s/.test(c));if(desired.length!==[...textOf(trimmed)].filter(c=>! /\s/.test(c)).length)return renderRuns(trimmed,context);let at=0;return renderRuns(trimmed.map(r=>({...r,t:[...r.t].map(c=>/\s/.test(c)?c:desired[at++]).join('')})),context);}
function heading(runs,context){const h=splitHeading(runs);context.references.push(...h.references);if(!context.inTable&&cleanTitle(h.text).toLowerCase()===context.title?.toLowerCase())return '';return h.text?context.inTable?`<div class="cell-heading">${renderRuns(h.main,context)}</div>`:`<h3>${styledHeading(h.main,context)}</h3>`:'';}
// Source PDF columns are reading-order groups. Prose and tables reflow as one
// column; only figures and paired callouts keep a side-by-side arrangement.
const onlyFigures=col=>col.length>0&&col.every(b=>b.type==='figure');
const onlyCallouts=col=>col.length>0&&col.every(b=>b.type==='callout'&&!b.branchLabel);
const hasTable=bs=>bs.some(b=>b.type==='table'||(b.columns||[]).some(hasTable)||hasTable(b.blocks||[]));
export function columnsClass(b){
 if(b.columns.every(col=>col.length===1&&col[0].branchLabel))return 'branch-columns';
 if(b.columns.every(onlyFigures))return 'figure-columns';
 if(b.columns.length===2&&!b.columns.some(hasTable)&&b.columns.filter(onlyFigures).length===1)return onlyFigures(b.columns[0])?'media-columns media-first':'media-columns';
 if(b.columns.length<=3&&b.columns.every(onlyCallouts)&&!b.columns.some(hasTable))return 'callout-columns';
 return 'text-columns';
}
// A sentence that wrapped beneath a side table or figure in the PDF continues
// in the next paragraph. Rejoin it (whitespace only) before the table.
const mediaOnly=col=>col.length>0&&col.every(b=>b.type==='table'||b.type==='figure');
const openParens=t=>(t.match(/\(/g)||[]).length>(t.match(/\)/g)||[]).length;
export function joinContinuation(b,next){
 if(b?.type!=='columns'||b.columns.length!==2||next?.type!=='paragraph'||!next.runs||next.displayText||next.footnote)return null;
 const at=mediaOnly(b.columns[1])&&!mediaOnly(b.columns[0])?0:mediaOnly(b.columns[0])&&!mediaOnly(b.columns[1])?1:-1;
 if(at<0)return null;
 const col=b.columns[at],last=col.at(-1);
 if(!last?.runs||last.displayText||last.footnote||!['paragraph','list-item'].includes(last.type))return null;
 const prev=textOf(last.displayRuns||last.runs).trim(),following=textOf(next.displayRuns||next.runs).trim();
 if(!(openParens(prev)||/^[a-z0-9]/.test(following)||/(?:[,(\/–-]|\b(?:the|of|for|and|or|to|with|w\/|in|at|by))$/i.test(prev)))return null;
 const joined={...last,[last.displayRuns?'displayRuns':'runs']:[...(last.displayRuns||last.runs),{t:' '},...(next.displayRuns||next.runs)]};
 const columns=b.columns.map((c,k)=>k===at?[...c.slice(0,-1),joined]:c);
 return {...b,columns};
}
function hasBranches(blocks){return blocks.some(b=>b.branchLabel||hasBranches(b.blocks||[])||(b.columns||[]).some(hasBranches));}
function cellContent(cell,context){if(cell.header&&cell.blocks.every(b=>b.runs&&!b.footnote))return cell.blocks.map(b=>{const h=splitHeading(b.displayRuns||b.runs);context.references.push(...h.references);return renderRuns(h.main,context);}).join(' ');return renderBlocks(cell.blocks,{...context,inTable:true});}
function visibleBlock(block){
 if(block.style==='omission-artifact'||block.style==='diagram-transcript')return false;
 if(!block.runs)return true;
 const runs=cleanReadingRuns(block.displayRuns||block.runs);
 const text=block.displayText??textOf(block.type==='list-item'?listRuns(runs):runs);
 // Standalone clinical symbols such as a minus sign are table values.
 return !/^[\s.,”“"’';:()\[\]]*$/.test(text);
}
export function renderBlocks(blocks=[],context={}){
 blocks=blocks.filter(visibleBlock);
 const outer=!context._rendering;
 if(outer){context={...context,_rendering:true,references:[...(context.references||[])]};if(context.titleRuns)context.references.push(...splitHeading(context.titleRuns).references);}
 let result=outer&&hasBranches(blocks)?'<div class="pathway-controls"><button data-toggle-branches aria-expanded="false">Expand all branches</button></div>':'';
 for(let i=0;i<blocks.length;i++){
  let b=blocks[i];
  const joined=joinContinuation(b,blocks[i+1]);if(joined){b=joined;i++;}
  if(b.type==='list-item'&&/^\s*[•◦▪]\s*[.;,]\s*$/.test(textOf(b.runs)))continue;
  if(b.footnote){const id=noteDomId(b.footnote.id,context),refs=b.footnote.refs||[];result+=`<p class="clinical-footnote" id="${esc(id)}" tabindex="-1">${renderRuns(b.runs,context)}${refs.length?` <span class="footnote-returns">${refs.map((ref,j)=>`<a class="footnote-back" href="#${esc(ref)}" data-note-target="${esc(noteDomId(ref,context))}" aria-label="Return to reference ${j+1} for footnote ${esc(b.footnote.marker)}">↩${refs.length>1?j+1:''}</a>`).join(' ')}</span>`:''}</p>`;continue;}
  if(b.flowArrowBefore)result+='<div class="flow-arrow" aria-hidden="true">↓</div>';
  if(b.type==='paragraph'){const inner=b.displayText?esc(b.displayText):prose(b.displayRuns||b.runs,context);result+=/<(?:ul|ol)[ >]/.test(inner)?`<div class="prose-group${b.style==='lead'?' source-lead':''}">${inner}</div>`:`<p${b.style==='lead'?' class="source-lead"':b.style==='section-lead'?' class="section-lead"':''}>${inner}</p>`;}
  else if(b.type==='heading')result+=heading(b.displayRuns||b.runs,context);
  else if(b.type==='list-item'){
   const kind=block=>/^\s*\d+[.)]\s/.test(textOf(block.runs))?'number':/^\s*[a-z][.)]\s/.test(textOf(block.runs))?'letter':'bullet';
   const mode=kind(b),tag=mode==='bullet'?'ul':'ol';let items='';
   do{const item=blocks[i],sourceText=textOf(item.runs),marker=sourceText.match(/^\s*(\d+|[a-z])[.)]\s/),value=marker?(mode==='letter'?marker[1].charCodeAt(0)-96:Number(marker[1])):null,subpoint=/^\s*[◦○o]\s/.test(sourceText);if(!/^\s*[•◦▪]\s*[.;,”“]+\s*$/.test(sourceText))items+=`<li${value?` value="${value}"`:''}${subpoint?' class="subpoint"':''}${item.sourceIndent!==undefined?` style="margin-left:${Math.min(3,item.sourceIndent/18)}em"`:''}>${item.displayText?esc(item.displayText):prose(item.displayRuns||item.runs,context,true)}</li>`;i++;}while(i<blocks.length&&blocks[i].type==='list-item'&&kind(blocks[i])===mode);i--;
   result+=`<${tag}${mode==='letter'?' type="a"':''}>${items}</${tag}>`;
  }else if(b.type==='columns')result+=`<div class="${columnsClass(b)}">${b.columns.map(col=>`<div>${renderBlocks(col,context)}</div>`).join('')}</div>`;
  else if(b.type==='callout'){
   if(b.branchLabel){const first=b.blocks[0],hasLabel=first?.runs&&textOf(first.runs).trim().toLowerCase()===b.branchLabel.toLowerCase();result+=`<details class="pathway-branch" data-question="${esc(b.question||'')}"><summary><span class="branch-label">${hasLabel?renderRuns(first.runs,context):esc(b.branchLabel)}</span><span>${esc(b.question||'')}</span></summary><div class="branch-content">${renderBlocks(hasLabel?b.blocks.slice(1):b.blocks,context)}</div></details>`;}
   else{const first=b.blocks[0],hasCondition=b.conditionLabel&&first?.runs&&textOf(first.runs).trim().toLowerCase()===b.conditionLabel.toLowerCase();result+=`<div class="source-callout${b.tone?` tone-${esc(b.tone)}`:''}">${hasCondition?`<div class="callout-condition"><strong class="branch-label">${renderRuns(first.runs,context)}</strong><span>${esc(b.conditionQuestion)}</span></div>`:''}${renderBlocks(hasCondition?b.blocks.slice(1):b.blocks,context)}</div>`;}
  }
  else if(b.type==='table'&&b.presentation==='screening-cards'&&context.screeningCards){
   result+=`<div class="screening-tools"><button data-table="${esc(b.id)}">Expand table ↗</button></div><div class="screening-cards">${screeningGroups(b).map(g=>g.band?`<div class="screening-band">${renderBlocks(g.band,context)}</div>`:`<section class="screening-card"><div class="screening-card-title">${renderBlocks([{type:'heading',runs:g.label.flatMap((b,i)=>[...(i?[{t:' '}]:[]),...(b.runs||[])])}],context)}</div>${g.parts.map(part=>`<div class="screening-age-band"><div class="screening-age-label">Ages shown: ${esc(part.ages.join(' · '))}</div>${renderBlocks(part.blocks,context)}</div>`).join('')}</section>`).join('')}</div>`;
  }else if(b.type==='table'){
   const first=b.cells.filter(c=>c.row===0),titleCell=b.rows>1&&first.length===1&&first[0].colspan===b.cols&&first[0].rowspan===1&&first[0].blocks.length===1&&['paragraph','heading'].includes(first[0].blocks[0].type)&&blockText(first[0].blocks).length<240?first[0]:null;
   const tableTitle=titleCell?splitHeading(titleCell.blocks[0].displayRuns||titleCell.blocks[0].runs):null;if(tableTitle)context.references.push(...tableTitle.references);
   const label=cleanTitle(tableTitle?.text||b.caption||context.title||'Table'),sizes=tableSizing(b);
   const rows=Array.from({length:b.rows},(_,row)=>row===0&&titleCell?'':`<tr>${b.cells.filter(c=>c.row===row).sort((a,b)=>a.col-b.col).map(c=>{const tag=c.header?'th':'td';return `<${tag}${c.header?` scope="${c.scope||'col'}"`:''}${c.colspan>1?` colspan="${c.colspan}"`:''}${c.rowspan>1?` rowspan="${c.rowspan}"`:''}${c.color?` class="risk-cell risk-${esc(c.color)}"`:c.col===0?' class="row-label"':''}>${c.color?`<span class="sr-only">${esc(c.color)}</span>`:''}${cellContent(c,context)}</${tag}>`;}).join('')}</tr>`).join('');
   const continuedHeader=b.continuationHeaders?`<thead><tr>${b.continuationHeaders.map((text,i)=>`<th scope="col"${!text?' aria-label="Condition"':''}>${esc(text)}</th>`).join('')}</tr></thead>`:'';
   const total=sizes.reduce((a,b)=>a+b,0),fit=total<=560?' table-compact':'',stick=b.cols>=3&&sizes[0]<=180?' sticky-first':'';
   result+=`<div class="table-block${fit}${stick}"${fit?` style="--fit:${Math.round(Math.min(760,Math.max(360,total*1.7)))}px"`:''}><div class="table-tools">${(titleCell||context.showTableCaptions&&b.caption)&&label.toLowerCase()!==context.title?.toLowerCase()?`<h3>${esc(label)}</h3>`:'<span></span>'}${b.id&&context.expand!==false?`<button data-table="${esc(b.id)}" aria-label="Expand table: ${esc(label)}">Expand table ↗</button>`:''}</div><div class="table-frame"><div class="table-wrap" role="region" aria-label="${esc(label)}" tabindex="0"><table style="min-width:${total}px"><caption class="sr-only">${esc(label)}</caption><colgroup>${sizes.map(w=>`<col style="width:${w}px">`).join('')}</colgroup>${continuedHeader}<tbody>${rows}</tbody></table></div></div></div>`;
  }else if(b.type==='spectrum')result+=`<div class="spectrum-wrap" role="region" aria-label="Antibiotic spectrum chart" tabindex="0"><div class="spectrum"><div class="spectrum-head">${b.headers.map(h=>`<span style="grid-column:span ${h.colspan}">${esc(h.text)}</span>`).join('')}</div>${b.rows.map(r=>`<div class="spectrum-row">${Array.from({length:5},(_,col)=>{const filled=r.coverageSegments.some(s=>col>=s.col&&col<s.col+s.colspan);return `<span class="spectrum-cell"${filled?` style="background:rgb(${r.sourceFillRGB.map(v=>Math.round(v*255)).join(',')})"`:''}></span>`;}).join('')}<span class="spectrum-label">${esc(r.text)}</span></div>`).join('')}</div></div>`;
  else if(b.type==='figure'){const label=cleanTitle(b.label?.replace(/\s*·\s*source p\..*$/i,'').replace(/(?:Original )?source (?:figure|diagram|table)\s*[·:]?\s*(?:PDF page|p\.)?\s*\d*(?:\s*·.*)?/ig,'').trim()||context.title||'Illustration');result+=(b.optional?`<details class="source-diagram"><summary>View ${/table/i.test(b.optionalLabel||'')?'table illustration':'diagram'} ↗</summary>`:'')+`<figure class="clinical-figure"><button data-figure="${esc(b.src)}" data-figure-label="${esc(label)}" aria-label="Enlarge ${esc(label)}"><img src="${esc(b.src)}" width="${b.width}" height="${b.height}" alt="${esc(b.alt||label)}" loading="lazy"></button>${b.references?.length?`<figcaption><ul>${b.references.map(r=>`<li>${renderRuns([r],context)}</li>`).join('')}</ul></figcaption>`:''}</figure>`+(b.optional?'</details>':'');}
 }
 if(outer){const seen=new Set(),refs=context.references.filter(r=>{const text=textOf(r).replace(/\s+/g,' ').trim();if(!text||seen.has(text))return false;seen.add(text);return true;});if(refs.length)result+=`<details class="paper-references"><summary>References</summary><ul>${refs.map(r=>`<li>${renderRuns(r,context)}</li>`).join('')}</ul></details>`;}
 return result;
}
export function blockText(blocks=[]){return blocks.map(b=>b.runs?textOf(b.runs):b.type==='table'?b.cells.map(c=>blockText(c.blocks)).join('\n'):b.type==='spectrum'?b.headers.map(h=>h.text).join(' ')+' '+b.rows.map(r=>r.text).join(' '):b.type==='columns'?b.columns.map(blockText).join('\n'):b.blocks?blockText(b.blocks):'').join('\n');}

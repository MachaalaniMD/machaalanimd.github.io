import {textOf,sliceRuns,splitHeading,cleanTitle,enumerationPlan,tableSizing} from './reading.mjs?v=20261105-clean';
export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeHtml;
export function renderRuns(runs=[]){return runs.map(r=>{let text=esc(r.t);if(r.b)text=`<strong>${text}</strong>`;if(r.i)text=`<em>${text}</em>`;if(r.href&&/^https?:\/\//.test(r.href))text=`<a href="${esc(r.href)}" target="_blank" rel="noreferrer">${text}</a>`;return text;}).join('');}
function listRuns(runs){const text=textOf(runs);const m=text.match(/^\s*(?:[•▪◦●○]|o(?=\s)|[-–](?=\s)|(?:\d+|[a-z])[.)](?=\s))\s*/);return sliceRuns(runs,m?m[0].length:0,text.length);}
function prose(runs,context,isList=false){
 const plan=enumerationPlan(runs,context),display=rs=>renderRuns(isList?listRuns(rs):rs);
 if(!plan)return display(runs);
 return `${display(sliceRuns(runs,...plan.prefix))}<ul class="sibling-subtypes" data-reading-plan="${esc(plan.id)}">${plan.items.map(([a,b])=>`<li>${renderRuns(sliceRuns(runs,a,b))}</li>`).join('')}</ul>${plan.suffix[1]>plan.suffix[0]?`<div class="shared-qualifier">${renderRuns(sliceRuns(runs,...plan.suffix))}</div>`:''}`;
}
function heading(runs,context){const h=splitHeading(runs);context.references.push(...h.references);return h.text?`<h3>${esc(cleanTitle(h.text))}</h3>`:'';}
function cellContent(cell,context){if(cell.header&&cell.blocks.every(b=>b.runs))return cell.blocks.map(b=>{const h=splitHeading(b.runs);context.references.push(...h.references);return renderRuns(h.main);}).join(' ');return renderBlocks(cell.blocks,context);}
export function renderBlocks(blocks=[],context={}){
 const outer=!context._rendering;
 if(outer){context={...context,_rendering:true,references:[...(context.references||[])]};if(context.titleRuns)context.references.push(...splitHeading(context.titleRuns).references);}
 let result='';
 for(let i=0;i<blocks.length;i++){
  const b=blocks[i];
  if(b.type==='paragraph'){const inner=prose(b.runs,context);result+=inner.includes('<ul')?`<div class="prose-group${b.style==='lead'?' source-lead':''}">${inner}</div>`:`<p${b.style==='lead'?' class="source-lead"':''}>${inner}</p>`;}
  else if(b.type==='heading')result+=heading(b.runs,context);
  else if(b.type==='list-item'){
   const kind=block=>/^\s*\d+[.)]\s/.test(textOf(block.runs))?'number':/^\s*[a-z][.)]\s/.test(textOf(block.runs))?'letter':'bullet';
   const mode=kind(b),tag=mode==='bullet'?'ul':'ol';let items='';
   do{const item=blocks[i],sourceText=textOf(item.runs),marker=sourceText.match(/^\s*(\d+|[a-z])[.)]\s/),value=marker?(mode==='letter'?marker[1].charCodeAt(0)-96:Number(marker[1])):null,subpoint=/^\s*[◦○o]\s/.test(sourceText);items+=`<li${value?` value="${value}"`:''}${subpoint?' class="subpoint"':''}${item.sourceIndent!==undefined?` style="margin-left:${Math.min(3,item.sourceIndent/18)}em"`:''}>${prose(item.runs,context,true)}</li>`;i++;}while(i<blocks.length&&blocks[i].type==='list-item'&&kind(blocks[i])===mode);i--;
   result+=`<${tag}${mode==='letter'?' type="a"':''}>${items}</${tag}>`;
  }else if(b.type==='columns')result+=`<div class="text-columns">${b.columns.map(col=>`<div>${renderBlocks(col,context)}</div>`).join('')}</div>`;
  else if(b.type==='callout')result+=`<div class="source-callout">${renderBlocks(b.blocks,context)}</div>`;
  else if(b.type==='table'){
   const first=b.cells.filter(c=>c.row===0),titleCell=b.rows>1&&first.length===1&&first[0].colspan===b.cols&&first[0].rowspan===1&&first[0].blocks.length===1&&['paragraph','heading'].includes(first[0].blocks[0].type)&&blockText(first[0].blocks).length<240?first[0]:null;
   const tableTitle=titleCell?splitHeading(titleCell.blocks[0].runs):null;if(tableTitle)context.references.push(...tableTitle.references);
   const label=cleanTitle(tableTitle?.text||b.caption||context.title||'Table'),sizes=tableSizing(b);
   const rows=Array.from({length:b.rows},(_,row)=>row===0&&titleCell?'':`<tr>${b.cells.filter(c=>c.row===row).sort((a,b)=>a.col-b.col).map(c=>{const tag=c.header?'th':'td';return `<${tag}${c.header?` scope="${c.scope||'col'}"`:''}${c.colspan>1?` colspan="${c.colspan}"`:''}${c.rowspan>1?` rowspan="${c.rowspan}"`:''}${c.color?` class="risk-cell risk-${esc(c.color)}"`:c.col===0?' class="row-label"':''}>${c.color?`<span class="sr-only">${esc(c.color)}</span>`:''}${cellContent(c,context)}</${tag}>`;}).join('')}</tr>`).join('');
   const continuedHeader=b.continuationHeaders?`<thead><tr>${b.continuationHeaders.map((text,i)=>`<th scope="col"${!text?' aria-label="Condition"':''}>${esc(text)}</th>`).join('')}</tr></thead>`:'';
   result+=`<div class="table-block"><div class="table-tools">${titleCell?`<h3>${esc(label)}</h3>`:'<span></span>'}${b.id&&context.expand!==false?`<button data-table="${esc(b.id)}" aria-label="Expand table: ${esc(label)}">Expand table ↗</button>`:''}</div><div class="table-wrap" role="region" aria-label="${esc(label)}" tabindex="0"><table style="min-width:${sizes.reduce((a,b)=>a+b,0)}px"><caption class="sr-only">${esc(label)}</caption><colgroup>${sizes.map(w=>`<col style="width:${w}px">`).join('')}</colgroup>${continuedHeader}<tbody>${rows}</tbody></table></div></div>`;
  }else if(b.type==='spectrum')result+=`<div class="spectrum-wrap" role="region" aria-label="Antibiotic spectrum chart" tabindex="0"><div class="spectrum"><div class="spectrum-head">${b.headers.map(h=>`<span style="grid-column:span ${h.colspan}">${esc(h.text)}</span>`).join('')}</div>${b.rows.map(r=>`<div class="spectrum-row">${Array.from({length:5},(_,col)=>{const filled=r.coverageSegments.some(s=>col>=s.col&&col<s.col+s.colspan);return `<span class="spectrum-cell"${filled?` style="background:rgb(${r.sourceFillRGB.map(v=>Math.round(v*255)).join(',')})"`:''}></span>`;}).join('')}<span class="spectrum-label">${esc(r.text)}</span></div>`).join('')}</div></div>`;
  else if(b.type==='figure'){const label=cleanTitle(b.label?.replace(/\s*·\s*source p\..*$/i,'').replace(/(?:Original )?source (?:figure|diagram|table)\s*[·:]?\s*(?:PDF page|p\.)?\s*\d*(?:\s*·.*)?/ig,'').trim()||context.title||'Illustration');result+=(b.optional?`<details class="source-diagram"><summary>View ${/table/i.test(b.optionalLabel||'')?'table illustration':'diagram'} ↗</summary>`:'')+`<figure class="clinical-figure"><button data-figure="${esc(b.src)}" data-figure-label="${esc(label)}" aria-label="Enlarge ${esc(label)}"><img src="${esc(b.src)}" width="${b.width}" height="${b.height}" alt="${esc(b.alt||label)}" loading="lazy"></button></figure>`+(b.optional?'</details>':'');}
 }
 if(outer){const seen=new Set(),refs=context.references.filter(r=>{const text=textOf(r).replace(/\s+/g,' ').trim();if(!text||seen.has(text))return false;seen.add(text);return true;});if(refs.length)result+=`<details class="paper-references"><summary>References</summary><ul>${refs.map(r=>`<li>${renderRuns(r)}</li>`).join('')}</ul></details>`;}
 return result;
}
export function blockText(blocks=[]){return blocks.map(b=>b.runs?textOf(b.runs):b.type==='table'?b.cells.map(c=>blockText(c.blocks)).join('\n'):b.type==='spectrum'?b.headers.map(h=>h.text).join(' ')+' '+b.rows.map(r=>r.text).join(' '):b.type==='columns'?b.columns.map(blockText).join('\n'):b.blocks?blockText(b.blocks):'').join('\n');}

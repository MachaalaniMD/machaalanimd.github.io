export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeHtml;
export function renderRuns(runs=[]){return runs.map(r=>{let text=esc(r.t);if(r.b)text=`<strong>${text}</strong>`;if(r.i)text=`<em>${text}</em>`;if(r.href&&/^https?:\/\//.test(r.href))text=`<a href="${esc(r.href)}" target="_blank" rel="noreferrer">${text}</a>`;return text;}).join('');}
function listRuns(runs){const text=runs.map(r=>r.t).join('');const m=text.match(/^\s*(?:[•▪◦]|o(?=\s)|[-–](?=\s)|\d+[.)](?=\s))\s*/);let remove=m?m[0].length:0;return runs.map(r=>{const trim=Math.min(remove,r.t.length);remove-=trim;return {...r,t:r.t.slice(trim)};});}
export function renderBlocks(blocks=[],context={}){
 let result='';
 for(let i=0;i<blocks.length;i++){
  const b=blocks[i];
  if(b.type==='paragraph')result+=`<p>${renderRuns(b.runs)}</p>`;
  else if(b.type==='heading')result+=`<h3>${renderRuns(b.runs)}</h3>`;
  else if(b.type==='list-item'){
   const ordered=/^\s*\d+[.)]/.test(b.runs.map(r=>r.t).join(''));const tag=ordered?'ol':'ul';let items='';
   do{const sourceText=blocks[i].runs.map(r=>r.t).join('');const number=sourceText.match(/^\s*(\d+)[.)]\s/);const subpoint=/^\s*[◦o]\s/.test(sourceText);items+=`<li${number?` value="${number[1]}"`:''}${subpoint?' class="subpoint"':''}>${renderRuns(listRuns(blocks[i].runs))}</li>`;i++;}while(i<blocks.length&&blocks[i].type==='list-item'&&/^\s*\d+[.)]/.test(blocks[i].runs.map(r=>r.t).join(''))===ordered);i--;
   result+=`<${tag}>${items}</${tag}>`;
  }else if(b.type==='columns')result+=`<div class="text-columns">${b.columns.map(col=>`<div>${renderBlocks(col,context)}</div>`).join('')}</div>`;
  else if(b.type==='callout')result+=`<div class="source-callout">${renderBlocks(b.blocks,context)}</div>`;
  else if(b.type==='table'){
   const label=`${context.title||'Source table'} · source p. ${context.page||''}`;
   const rows=Array.from({length:b.rows},(_,row)=>`<tr>${b.cells.filter(c=>c.row===row).sort((a,b)=>a.col-b.col).map(c=>{const tag=c.header?'th':'td';return `<${tag}${c.header?` scope="${c.scope||'col'}"`:''}${c.colspan>1?` colspan="${c.colspan}"`:''}${c.rowspan>1?` rowspan="${c.rowspan}"`:''}${c.color?` class="risk-cell risk-${esc(c.color)}"`:c.col===0?' class="row-label"':''}>${c.color?`<span class="sr-only">${esc(c.color)}</span>`:''}${renderBlocks(c.blocks,context)}</${tag}>`;}).join('')}</tr>`).join('');
   result+=`<div class="table-wrap" role="region" aria-label="${esc(label)}" tabindex="0"><table><caption>${esc(b.caption||`Source table · p. ${context.page||''}`)}</caption><tbody>${rows}</tbody></table></div>`;
  }else if(b.type==='spectrum')result+=`<div class="spectrum-wrap"><div class="spectrum"><div class="spectrum-head">${b.headers.map(h=>`<span style="grid-column:span ${h.colspan}">${esc(h.text)}</span>`).join('')}</div>${b.rows.map(r=>`<div class="spectrum-row"><span style="width:${r.coverageColspan*20}%">${esc(r.text)}</span></div>`).join('')}</div></div>`;
  else if(b.type==='figure')result+=(b.optional?'<details class="source-diagram"><summary>View original '+esc(b.optionalLabel||'source diagram')+' ↗</summary>':'')+`<figure class="clinical-figure"><button data-figure="${esc(b.src)}" data-figure-label="${esc(b.label)}" aria-label="Enlarge ${esc(b.label)}"><img src="${esc(b.src)}" width="${b.width}" height="${b.height}" alt="${esc(b.alt||b.label)}" loading="lazy"></button><figcaption>${esc(b.label)} <span>↗</span></figcaption></figure>`+(b.optional?'</details>':'');
 }
 return result;
}
export function blockText(blocks=[]){return blocks.map(b=>b.runs?b.runs.map(r=>r.t).join(''):b.type==='table'?b.cells.map(c=>blockText(c.blocks)).join('\n'):b.type==='spectrum'?b.headers.map(h=>h.text).join(' ')+' '+b.rows.map(r=>r.text).join(' '):b.type==='columns'?b.columns.map(blockText).join('\n'):b.blocks?blockText(b.blocks):'').join('\n');}

// Builds folio/editions.mjs from the edited topic files in folio/editions/*.md.
// Edited topics replace the converted book text in the reader and in search;
// the converted text stays in catalog.json as the source record.
//
// Markdown subset:
//   # Title                         optional, replaces the topic title
//   > lead sentence                 first quote before any section = topic summary
//   ## Section                      starts a section (shown in "On this page")
//   ### Heading                     sub-heading
//   - item / "  - sub item"         bullets (two spaces per level)
//   1. item                         numbered steps
//   | a | b |                       table (first row = header)
//   :::note / :::warn / :::key      boxed callout, closed by :::
//   ::: Answer | Question           collapsible decision branch, closed by :::
//   ![Label](assets/name.webp)     figure from folio/assets
//   **bold**  *italic*  [text](https://…)  {citation}
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dir=resolve(root,'folio/editions');

export function inline(src){
 const runs=[];let i=0;
 const push=(t,st={})=>{if(!t)return;const last=runs.at(-1);if(last&&JSON.stringify({...last,t:0})===JSON.stringify({...st,t:0}))last.t+=t;else runs.push({...st,t});};
 const re=/\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\{([^}]+)\}/g;let m;
 while((m=re.exec(src))){
  push(src.slice(i,m.index));
  if(m[1]!==undefined)for(const r of inline(m[1]))push(r.t,{...r,t:undefined,b:true});
  else if(m[2]!==undefined)for(const r of inline(m[2]))push(r.t,{...r,t:undefined,i:true});
  else if(m[3]!==undefined)push(m[3],{href:m[4]});
  else push(m[5],{cite:true});
  i=m.index+m[0].length;
 }
 push(src.slice(i));
 return runs.map(r=>Object.fromEntries(Object.entries(r).filter(([,v])=>v!==undefined)));
}
import {readFileSync} from 'node:fs';
function webpSize(file){const b=readFileSync(file);const kind=b.toString('ascii',12,16);
 if(kind==='VP8X')return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];
 if(kind==='VP8 ')return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];
 if(kind==='VP8L'){const v=b.readUInt32LE(21);return [1+(v&0x3fff),1+((v>>14)&0x3fff)];}
 throw Error('Unknown webp '+file);}
const slug=s=>s.toLowerCase().replace(/<[^>]+>/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);

export function parse(md,id){
 const lines=md.replace(/\r/g,'').split('\n');
 const out={sections:[]};let section=null,tables=0;
 const stack=[];// open containers (callouts/branches)
 const target=()=>stack.length?stack.at(-1).blocks:(section??=newSection('Overview')).blocks;
 function newSection(title){const s={id:`${id}--${slug(title)||'section'}`,title,blocks:[]};out.sections.push(s);return s;}
 for(let n=0;n<lines.length;n++){
  let line=lines[n];
  if(!line.trim())continue;
  if(/^# /.test(line)&&!out.title&&!section){out.title=line.slice(2).trim();continue;}
  if(/^> /.test(line)&&!section&&!stack.length){out.summary=(out.summary?out.summary+' ':'')+line.slice(2).trim();continue;}
  if(/^> /.test(line)){target().push({type:'paragraph',style:'section-lead',runs:inline(line.slice(2).trim())});continue;}
  if(/^## /.test(line)){if(stack.length)throw Error(`${id}:${n+1} section inside a box`);section=newSection(line.slice(3).trim());continue;}
  const open=line.match(/^:::\s*(note|warn|key|tip)\s*(.*)$/);
  if(open){const box={type:'callout',tone:open[1],blocks:[]};if(open[2])box.blocks.push({type:'heading',runs:inline(open[2])});target().push(box);stack.push(box);continue;}
  const branch=line.match(/^:::\s*([^|]+?)\s*\|\s*(.+)$/);
  if(branch){const b={type:'callout',branchLabel:branch[1].trim(),question:branch[2].trim(),blocks:[]};target().push(b);stack.push(b);continue;}
  if(/^:::\s*$/.test(line)){if(!stack.length)throw Error(`${id}:${n+1} unmatched :::`);stack.pop();continue;}
  const fig=line.match(/^!\[([^\]]*)\]\((assets\/[\w.-]+\.webp)\)\s*$/);
  if(fig){const [w,h]=webpSize(resolve(root,'folio',fig[2]));target().push({type:'figure',src:fig[2],width:w,height:h,label:fig[1],optional:false});continue;}
  if(/^### /.test(line)){target().push({type:'heading',runs:inline(line.slice(4).trim())});continue;}
  if(/^\s*\|/.test(line)){
   const rows=[];while(n<lines.length&&/^\s*\|/.test(lines[n])){const cells=lines[n].trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());if(!cells.every(c=>/^:?-{2,}:?$/.test(c)))rows.push(cells);n++;}n--;
   const cols=Math.max(...rows.map(r=>r.length));const cells=[];
   rows.forEach((r,ri)=>{for(let ci=0;ci<cols;ci++){const t=r[ci]??'';const c={row:ri,col:ci,rowspan:1,colspan:1,blocks:t?t.split(/\s*<br>\s*/).map(p=>({type:/^[-•] /.test(p)?'list-item':'paragraph',runs:inline(p.replace(/^- /,'• '))})):[]};if(ri===0){c.header=true;c.scope='col';}else if(ci===0){c.header=true;c.scope='row';}cells.push(c);}});
   target().push({type:'table',id:`ed-${id}-${++tables}`,rows:rows.length,cols,cells,edited:true});continue;
  }
  const bullet=line.match(/^(\s*)[-*] (.*)$/);
  if(bullet){const depth=Math.floor(bullet[1].length/2);target().push({type:'list-item',runs:inline((depth?'◦ ':'• ')+bullet[2]),...(depth?{sourceIndent:18*depth}:{})});continue;}
  const num=line.match(/^(\s*)(\d+)[.)] (.*)$/);
  if(num){const depth=Math.floor(num[1].length/2);target().push({type:'list-item',runs:inline(`${num[2]}. ${num[3]}`),...(depth?{sourceIndent:18*depth}:{})});continue;}
  // paragraph: join following plain lines
  let text=line.trim();
  while(n+1<lines.length&&lines[n+1].trim()&&!/^(\s*[-*] |\s*\d+[.)] |#|>|:::|\s*\|)/.test(lines[n+1])){text+=' '+lines[++n].trim();}
  const b={type:'paragraph',runs:inline(text)};if(/^\*\*[^*]+:\*\*/.test(text))b.style='lead';target().push(b);
 }
 if(stack.length)throw Error(`${id}: unclosed ::: box`);
 if(out.summary){out.summaryRuns=inline(out.summary);out.summary=out.summaryRuns.map(r=>r.t).join('');}
 return out;
}

export async function buildEditions(){
 const files=(await readdir(dir).catch(()=>[])).filter(f=>f.endsWith('.md')).sort();
 const editions={};
 for(const f of files){const id=f.slice(0,-3);editions[id]=parse(await readFile(resolve(dir,f),'utf8'),id);}
 return editions;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const editions=await buildEditions();
 await writeFile(resolve(root,'folio/editions.mjs'),'// Generated by scripts/build-editions.mjs from folio/editions/*.md. Do not edit by hand.\nexport const editions='+JSON.stringify(editions)+';\n');
 console.log(`Built ${Object.keys(editions).length} edited topics.`);
}

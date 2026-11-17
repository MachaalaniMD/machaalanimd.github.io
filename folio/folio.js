import {renderBlocks,blockText,escapeHtml as esc} from './content.mjs?v=folio-2611';
import {cleanTitle,readingSections} from './reading.mjs?v=reference-layout';
import {attributionMarkup} from './about.mjs?v=20261110-procedures';
import {notesForTable,walkBlocks} from './notes.mjs?v=20261110-procedures';
import {scoreTopic as score} from './search.mjs';

const main=document.querySelector('main'),$=s=>document.querySelector(s),$$=(s,root=document)=>[...root.querySelectorAll(s)];
// All reader state lives in memory for this tab only.
let catalog,view='home',category='',selected=null,saved=new Set(),recent=[],zoomScale=1,textScale=1,theme='auto';
let cardiologyActive=false,cardiologyId='',cardiologyQuery='',cardiologyReader,cardiologyImport;
let searchIndex=null,searchResults=[],searchActive=0,spy=null,spyFrame=0;
const sectionCache=new Map();
const topicTitle=topic=>cleanTitle(topic.title);
const shout=t=>t.length>4&&!/[a-z]/.test(t)&&/[A-Z]{3}/.test(t);
const sectionsOf=topic=>{if(!sectionCache.has(topic.id))sectionCache.set(topic.id,readingSections(topic).map(s=>shout(s.title)?{...s,title:cleanTitle(s.title)}:s));return sectionCache.get(topic.id);};
const readingContext=(panel,page,title)=>({screeningCards:true,title,titleRuns:panel.titleRuns||[{t:panel.title}],pdfPage:page.pdfPage});
const plain=s=>String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'');
const pad=n=>String(n).padStart(2,'0');
const icon={
 search:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
 bookmark:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>',
 link:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
 expand:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
 list:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>'
};

function focusMain(){main.focus({preventScroll:true});}
function status(s,toast=false){$('#live-status').textContent=s;if(toast){const t=$('#toast');t.textContent=s;t.classList.add('show');clearTimeout(status.timer);status.timer=setTimeout(()=>t.classList.remove('show'),1800);}}
function go(hash){if(location.hash.slice(1)!==hash)location.hash=hash;else route();}
function home(){go('');if(!location.hash)route();}
function remember(topic){recent=[topic.id,...recent.filter(id=>id!==topic.id)].slice(0,6);}

/* ---------- Shared pieces ---------- */
function saveButton(t,label=false){const on=saved.has(t.id);return `<button class="save-topic${on?' saved':''}${label?' with-label':''}" data-save="${t.id}" aria-pressed="${on}" aria-label="${on?'Remove':'Save'} ${esc(topicTitle(t))} ${on?'from':'to'} reading list">${icon.bookmark}${label?`<span>${on?'Saved':'Save'}</span>`:''}</button>`;}
function sectionPreview(t){const names=sectionsOf(t).map(s=>s.title).filter(n=>!/^overview$/i.test(n)&&n.toLowerCase()!==topicTitle(t).toLowerCase());const shown=names.slice(0,4).join(' · ');return names.length?esc(shown)+(names.length>4?` <span>+${names.length-4}</span>`:''):'';}
function topicRow(t,i,showCategory){
 return `<li class="topic-row"><a class="open-topic" href="#${t.id}"><span class="topic-index">${pad(i+1)}</span><span class="topic-name"><strong>${esc(topicTitle(t))}</strong>${showCategory?`<small class="topic-system">${esc(t.category)}</small>`:''}<small class="topic-sections">${sectionPreview(t)}</small></span><span class="topic-arrow" aria-hidden="true">→</span></a>${saveButton(t)}</li>`;
}
function breadcrumb(items){return `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="#">Folio</a>${items.map(([label,href])=>`<span aria-hidden="true">/</span>${href?`<a href="${href}">${esc(label)}</a>`:`<span aria-current="page">${esc(label)}</span>`}`).join('')}</nav>`;}
function searchTrigger(big=false){return `<button class="search-trigger${big?' big':''}" data-open-search type="button">${icon.search}<span>Search conditions, drugs, tests…</span><kbd>/</kbd></button>`;}

/* ---------- Home ---------- */
function homeMarkup(){
 const {metadata,categories,topics}=catalog;
 const recents=recent.map(id=>topics.find(t=>t.id===id)).filter(Boolean);
 const savedTopics=topics.filter(t=>saved.has(t.id));
 const shelf=(title,list,href)=>list.length?`<section class="shelf"><div class="section-label"><h2>${title}</h2>${href?`<a href="${href}">View all</a>`:''}</div><div class="shelf-row">${list.slice(0,6).map(t=>`<a class="shelf-card" href="#${t.id}"><small>${esc(t.category)}</small><strong>${esc(topicTitle(t))}</strong></a>`).join('')}</div></section>`:'';
 return `<section class="hero">
  <div class="kicker">Internal medicine reference · ${esc(metadata.edition)} edition</div>
  <h1>The medicine manual, <em>easy to find your way around.</em></h1>
  <p class="lede">${metadata.topics} topics across ${categories.length} systems. Search everything at once, or browse by system.</p>
  ${searchTrigger(true)}
  <dl class="stats" aria-label="Folio collection counts">${[[metadata.topics,'Topics'],[categories.length,'Systems'],[metadata.conversion.tables,'Tables'],[metadata.conversion.figures,'Figures']].map(([n,l])=>`<div><dd>${n}</dd><dt>${l}</dt></div>`).join('')}</dl>
 </section>
 ${shelf('Pick up where you left off',recents)}
 ${shelf('Your reading list',savedTopics,'#saved')}
 <section class="systems" aria-labelledby="systems-title">
  <div class="section-label"><h2 id="systems-title">Browse by system</h2><span>${categories.length} systems</span></div>
  <ol class="system-grid">${categories.map((c,i)=>{const sample=topics.filter(t=>t.categoryId===c.id).slice(0,3).map(t=>topicTitle(t).replace(/^ACLS:\s*/,''));return `<li><a class="system-card" href="#system/${c.id}"><span class="system-number">${pad(i+1)}</span><span class="system-body"><strong>${esc(c.title)}</strong><small>${esc(sample.join(' · '))}</small></span><span class="system-count">${c.count}</span></a></li>`;}).join('')}</ol>
 </section>
 <a class="feature-card" href="#cardiology-reference"><span class="feature-kicker">Also in Folio</span><strong>Cardiology Reference</strong><span>A separate manual for fellows and specialists: ACS, procedures and the Red Book chapters.</span><b aria-hidden="true">→</b></a>`;
}

/* ---------- System and reading list ---------- */
function systemMarkup(){
 const c=catalog.categories.find(c=>c.id===category),index=catalog.categories.indexOf(c);
 const list=catalog.topics.filter(t=>t.categoryId===c.id);
 return `${breadcrumb([[c.title]])}
 <section class="page-head"><div class="kicker">System ${pad(index+1)} of ${catalog.categories.length}</div><h1>${esc(c.title)}</h1><p>${list.length} topics. Choose one to read, or filter the list.</p></section>
 <nav class="system-strip" aria-label="All systems">${catalog.categories.map(x=>`<a href="#system/${x.id}"${x.id===c.id?' aria-current="page"':''}>${esc(x.title)}</a>`).join('')}</nav>
 <div class="filter-bar">${icon.search}<input id="topic-filter" type="search" autocomplete="off" placeholder="Filter ${esc(c.title)} topics" aria-label="Filter ${esc(c.title)} topics"><span id="filter-count">${list.length} topics</span></div>
 <ol class="topic-list" id="topic-list">${list.map((t,i)=>topicRow(t,i,false)).join('')}</ol>
 <p class="empty-inline" id="filter-empty" hidden>No topic titles match. <button data-open-search type="button">Search the whole manual →</button></p>`;
}
function savedMarkup(){
 const list=catalog.topics.filter(t=>saved.has(t.id));
 return `${breadcrumb([['Reading list']])}
 <section class="page-head"><div class="kicker">This session</div><h1>Reading list</h1><p>Topics you save stay here until you close or reload the page. Nothing is stored on your device.</p></section>
 ${list.length?`<ol class="topic-list">${list.map((t,i)=>topicRow(t,i,true)).join('')}</ol>`:`<div class="empty"><h2>Nothing saved yet</h2><p>Use the bookmark beside any topic to keep it here for this session.</p><a class="primary-button" href="#">Browse systems →</a></div>`}`;
}

/* ---------- Reader ---------- */
function renderSectionParts(section,parts=section.parts,context={}){
 return parts.map(({panel,page})=>{
  const legend=panel.legend?`<p class="section-legend">${esc(panel.legend)}</p>`:'';
  const lead=panel.readerLead?`<p>${esc(panel.readerLead)}</p>`:'';
  const content=legend+lead+renderBlocks(panel.readerBlocks||panel.blocks,{...readingContext(panel,page,section.title),...context});
  return panel.id===section.id||context.idPrefix?content:`<div id="${esc(panel.id)}">${content}</div>`;
 }).join('');
}
function readerMarkup(topic){
 const sections=sectionsOf(topic),siblings=catalog.topics.filter(t=>t.categoryId===topic.categoryId);
 const i=catalog.topics.indexOf(topic),prev=catalog.topics[i-1],next=catalog.topics[i+1];
 const toc=sections.map((s,n)=>`<a href="#${topic.id}/${s.id}" data-section="${esc(s.id)}"><span>${pad(n+1)}</span>${esc(s.title)}</a>`).join('');
 const articles=sections.map(s=>`<article class="source-panel" id="${esc(s.id)}" aria-labelledby="h-${esc(s.id)}">
   <header class="source-panel-bar"><h2 id="h-${esc(s.id)}">${esc(s.title)}</h2><div class="panel-actions"><button data-copy="${esc(s.id)}" aria-label="Copy link to ${esc(s.title)}" title="Copy link">${icon.link}</button><button data-enlarge="${esc(s.id)}" aria-label="Focus ${esc(s.title)}" title="Focus view">${icon.expand}</button></div></header>
   <div class="clinical-text">${renderSectionParts(s)}</div>
  </article>`).join('');
 const pager=(t,dir)=>t?`<a class="pager-${dir}" href="#${t.id}"><small>${dir==='prev'?'← Previous':'Next →'}${t.categoryId!==topic.categoryId?` · ${esc(t.category)}`:''}</small><strong>${esc(topicTitle(t))}</strong></a>`:'<span></span>';
 return `<div class="reader">
  <aside class="reader-nav" aria-label="${esc(topic.category)} topics"><a class="reader-nav-head" href="#system/${topic.categoryId}"><small>System</small>${esc(topic.category)}</a><ol>${siblings.map(t=>`<li><a href="#${t.id}"${t===topic?' aria-current="page"':''}>${esc(topicTitle(t))}</a></li>`).join('')}</ol></aside>
  <div class="reader-main">
   ${breadcrumb([[topic.category,'#system/'+topic.categoryId],[topicTitle(topic)]])}
   <header class="reader-heading"><div class="kicker">${esc(topic.category)}</div><h1>${esc(topicTitle(topic))}</h1>
    <div class="reader-tools">${saveButton(topic,true)}<div class="text-size" role="group" aria-label="Text size"><button data-size="-1" aria-label="Smaller text">A−</button><button data-size="1" aria-label="Larger text">A+</button></div><span class="reader-meta">${sections.length} section${sections.length===1?'':'s'}</span></div>
   </header>
   <div class="mobile-contents"><button id="open-contents" type="button">${icon.list}<span id="current-section">Contents</span><b aria-hidden="true">▾</b></button></div>
   <div class="reader-content" style="--reader-scale:${textScale}">${articles}</div>
   <nav class="pager" aria-label="More topics">${pager(prev,'prev')}${pager(next,'next')}</nav>
  </div>
  <aside class="reader-toc"><div class="toc-title">On this page</div><nav class="toc" aria-label="Sections in this topic">${toc}</nav><button class="to-top" data-top type="button">↑ Back to top</button></aside>
 </div>`;
}

/* ---------- Rendering ---------- */
function setChrome(){
 $('#browse-nav').textContent=cardiologyActive?'General Medicine':'Systems';
 $('#saved-nav').hidden=cardiologyActive;
 $('.folio-brand small').textContent=cardiologyActive?'Cardiology Reference':'Internal medicine reference';
 $('#browse-nav').classList.toggle('active',!cardiologyActive&&(view==='home'||view==='system'));
 $('#saved-nav').classList.toggle('active',view==='saved');
 $('#saved-count').textContent=saved.size;$('#saved-count').hidden=!saved.size;
 document.body.dataset.view=cardiologyActive?'cardiology':view;
}
function render(){
 spy=null;
 if(cardiologyActive){renderCardiology();return;}
 if(!catalog)return;
 setChrome();
 const c=catalog.categories.find(c=>c.id===category);
 document.title=view==='reader'?`${topicTitle(selected)} · Folio`:view==='system'?`${c.title} · Folio`:view==='saved'?'Reading list · Folio':'Folio · Internal medicine reference';
 main.innerHTML=view==='reader'?readerMarkup(selected):view==='system'?systemMarkup():view==='saved'?savedMarkup():homeMarkup();
 bindReadingEvents(main);
 if(view==='system'){bindFilter();const chip=$('.system-strip [aria-current]');if(chip)chip.parentElement.scrollLeft=chip.offsetLeft-chip.parentElement.offsetLeft-16;}
 if(view==='reader')bindReader();
}
function bindFilter(){
 const input=$('#topic-filter'),rows=$$('#topic-list .topic-row');
 input.addEventListener('input',()=>{const words=plain(input.value).split(/\s+/).filter(Boolean);let shown=0;rows.forEach(r=>{const hit=words.every(w=>plain(r.textContent).includes(w));r.hidden=!hit;if(hit)shown++;});$('#filter-count').textContent=`${shown} of ${rows.length} topics`;$('#filter-empty').hidden=shown>0;});
}
function bindReader(){
 const nav=$('.reader-nav [aria-current]');if(nav){const box=nav.closest('.reader-nav');box.scrollTop=nav.offsetTop-box.clientHeight/3;}
 const links=new Map($$('.toc a').map(a=>[a.dataset.section,a]));
 const mark=id=>{links.forEach((a,k)=>a.classList.toggle('active',k===id));const a=links.get(id);if(a){$('#current-section').textContent=a.textContent.replace(/^\d+/,'').trim();const toc=a.closest('.toc');if(toc.scrollHeight>toc.clientHeight)toc.scrollTop=a.offsetTop-toc.clientHeight/2;}};
 const panels=$$('.reader-content > .source-panel');
 // The current section is the last one whose top has passed under the sticky header.
 spy=()=>{const line=(innerWidth<=960?150:110);let current=panels[0];for(const p of panels){if(p.getBoundingClientRect().top<=line)current=p;else break;}if(innerHeight+scrollY>=document.documentElement.scrollHeight-4)current=panels.at(-1);if(current)mark(current.id);};
 spy();
 $$('.toc a').forEach(a=>a.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();scrollToSection(a.dataset.section);}));
 $('#open-contents').addEventListener('click',openContents);
 $$('[data-size]').forEach(b=>b.addEventListener('click',()=>{textScale=Math.max(.85,Math.min(1.4,Math.round((textScale+Number(b.dataset.size)*.075)*1000)/1000));$('.reader-content').style.setProperty('--reader-scale',textScale);status(`Text size ${Math.round(textScale*100)}%`,true);}));
 $$('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const url=`${location.origin}${location.pathname}#${selected.id}/${b.dataset.copy}`;try{await navigator.clipboard.writeText(url);status('Link to section copied',true);}catch{history.replaceState(null,'',`#${selected.id}/${b.dataset.copy}`);status('Link is in the address bar',true);}}));
 $$('[data-top]').forEach(b=>b.addEventListener('click',()=>{scrollTo({top:0,behavior:'smooth'});history.replaceState(null,'',`#${selected.id}`);}));
}
function scrollToSection(id,smooth=true){
 const el=document.getElementById(id);if(!el)return;
 el.scrollIntoView({behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant',block:'start'});
 history.replaceState(null,'',`#${selected.id}/${id}`);
 el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');
}
function openContents(){
 const d=$('#contents-dialog');
 $('#contents-list').innerHTML=$('.toc').innerHTML;
 const active=$('#contents-list .active');
 $$('#contents-list a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();d.close();scrollToSection(a.dataset.section,false);}));
 d.showModal();active?.scrollIntoView({block:'center'});active?.focus();
}
function bindReadingEvents(container){
 container.querySelectorAll('[data-note-target]').forEach(link=>link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();jumpToNote(link.dataset.noteTarget);}));
 container.querySelectorAll('[data-enlarge]').forEach(b=>b.addEventListener('click',()=>openZoom(b.dataset.enlarge)));
 container.querySelectorAll('[data-table]').forEach(b=>b.addEventListener('click',()=>openTable(b.dataset.table)));
 container.querySelectorAll('[data-figure]').forEach(b=>b.addEventListener('click',()=>openFigure(b.dataset.figure,b.dataset.figureLabel)));
 container.querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click',()=>toggleSave(b.dataset.save)));
 container.querySelectorAll('[data-open-search]').forEach(b=>b.addEventListener('click',()=>openSearch(view==='system'?$('#topic-filter')?.value||'':'')));
 container.querySelectorAll('[data-toggle-branches]').forEach(button=>{const group=button.closest('.clinical-text'),branches=[...group.querySelectorAll('.pathway-branch')];const update=()=>{const allOpen=branches.every(d=>d.open);button.textContent=allOpen?'Collapse all branches':'Expand all branches';button.setAttribute('aria-expanded',String(allOpen));};button.addEventListener('click',()=>{const open=branches.some(d=>!d.open);branches.forEach(d=>d.open=open);update();});branches.forEach(d=>d.addEventListener('toggle',update));});
 container.querySelectorAll('.table-wrap').forEach(watchTable);
}
// Wide tables show edge shadows and a hint while there is more to scroll.
const tableObserver=new ResizeObserver(entries=>entries.forEach(e=>edgeState(e.target)));
function edgeState(wrap){const block=wrap.closest('.table-block');if(!block)return;const over=wrap.scrollWidth>wrap.clientWidth+2;block.classList.toggle('overflowing',over);block.classList.toggle('at-start',wrap.scrollLeft<4);block.classList.toggle('at-end',wrap.scrollLeft+wrap.clientWidth>=wrap.scrollWidth-4);}
function watchTable(wrap){wrap.addEventListener('scroll',()=>edgeState(wrap),{passive:true});tableObserver.observe(wrap);edgeState(wrap);}
function toggleSave(id){
 if(saved.has(id))saved.delete(id);else saved.add(id);
 const on=saved.has(id),t=catalog.topics.find(t=>t.id===id);
 $$(`[data-save="${id}"]`).forEach(b=>{b.classList.toggle('saved',on);b.setAttribute('aria-pressed',on);b.setAttribute('aria-label',`${on?'Remove':'Save'} ${topicTitle(t)} ${on?'from':'to'} reading list`);const label=b.querySelector('span');if(label)label.textContent=on?'Saved':'Save';});
 $('#saved-count').textContent=saved.size;$('#saved-count').hidden=!saved.size;
 status(on?'Added to this session’s reading list':'Removed from reading list',true);
 if(view==='saved'&&!on)render();
}
function jumpToNote(id){const target=document.getElementById(id);if(!target)return false;for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;target.scrollIntoView({behavior:'smooth',block:'center'});target.focus({preventScroll:true});return true;}

/* ---------- Cardiology Reference ---------- */
function renderCardiology(){
 setChrome();
 if(!cardiologyReader){
  if(cardiologyImport)return;
  main.innerHTML='<div class="loading" role="status">Opening the Cardiology Reference…</div>';
  cardiologyImport=import('./cardiology.mjs?v=folio-2611')
   .then(reader=>{cardiologyReader=reader;if(cardiologyActive)renderCardiology();})
   .catch(()=>{if(cardiologyActive){main.innerHTML='<div class="empty"><h1>The Cardiology Reference could not be opened.</h1><button id="retry-cardiology" class="primary-button">Try again</button></div>';$('#retry-cardiology').addEventListener('click',renderCardiology);}})
   .finally(()=>{cardiologyImport=null;});
  return;
 }
 const {cardiologyMarkup,cardiologyEntries,cardiologyTitle,resolveCardiologyId}=cardiologyReader;
 cardiologyId=resolveCardiologyId(cardiologyId);
 const node=cardiologyEntries.find(n=>n.id===cardiologyId);document.title=`${node?cardiologyTitle(node.title)+' · ':''}Cardiology Reference · Folio`;
 main.innerHTML=cardiologyMarkup(cardiologyId,cardiologyQuery);
 bindReadingEvents(main);
 $('#cardiology-search').addEventListener('input',e=>{const start=e.target.selectionStart;cardiologyQuery=e.target.value;renderCardiology();const field=$('#cardiology-search');field.focus();try{field.setSelectionRange(start,start);}catch{}});
 main.querySelectorAll('[data-procedure-anchor]').forEach(button=>button.addEventListener('click',()=>{const target=document.getElementById(button.dataset.procedureAnchor);target?.scrollIntoView({behavior:'smooth',block:'start'});target?.focus({preventScroll:true});}));
 $('[data-clear-cardiology]')?.addEventListener('click',()=>{cardiologyQuery='';renderCardiology();$('#cardiology-search').focus();});
}

/* ---------- Routing ---------- */
function route(){
 $$('dialog[open]').forEach(d=>d.close());
 const id=decodeURIComponent(location.hash.slice(1));
 if(id==='cardiology-reference'||id.startsWith('cardiology-reference/')){const nextId=id.split('/')[1]||'';if(!cardiologyActive||nextId!==cardiologyId)cardiologyQuery='';cardiologyActive=true;cardiologyId=nextId;view='cardiology';selected=null;render();scrollTo({top:0,behavior:'instant'});focusMain();return;}
 cardiologyActive=false;
 if(!catalog)return;
 const [topicId,sectionId]=id.split('/');
 let topic=catalog.topics.find(t=>t.id===topicId)||null;
 if(!topic&&/^fn(?:ref)?-/.test(id))topic=catalog.topics.find(t=>t.pages.some(p=>p.panels.some(s=>[...walkBlocks(s.blocks)].some(b=>b.footnote?.id===id||b.runs?.some(r=>r.noteRefId===id)))))||null;
 if(topic){
  const same=view==='reader'&&selected===topic&&main.querySelector('.reader');
  selected=topic;view='reader';remember(topic);
  if(!same){render();scrollTo({top:0,behavior:'instant'});focusMain();}
  if(sectionId)requestAnimationFrame(()=>scrollToSection(sectionId,same));
  if(/^fn(?:ref)?-/.test(id))jumpToNote(id);
  return;
 }
 selected=null;
 const c=id.startsWith('system/')&&catalog.categories.find(c=>c.id===id.slice(7));
 if(c){view='system';category=c.id;}else if(id==='saved')view='saved';else view='home';
 render();scrollTo({top:0,behavior:'instant'});focusMain();
}

/* ---------- Search everywhere ---------- */
function buildIndex(){
 if(searchIndex)return;
 searchIndex=new Map(catalog.topics.map(t=>[t.id,sectionsOf(t).map(s=>{const raw=s.parts.map(({panel})=>blockText(panel.readerBlocks||panel.blocks)).join(' ').replace(/\s+/g,' ');return {id:s.id,title:s.title,raw,low:plain(s.title)+' '+raw.toLowerCase()};})]));
}
function snippet(raw,word){
 const at=raw.toLowerCase().indexOf(word);if(at<0)return esc(raw.slice(0,110))+(raw.length>110?'…':'');
 const start=Math.max(0,at-45),end=Math.min(raw.length,at+word.length+75);
 return (start?'…':'')+esc(raw.slice(start,at))+'<mark>'+esc(raw.slice(at,at+word.length))+'</mark>'+esc(raw.slice(at+word.length,end))+(end<raw.length?'…':'');
}
function runSearch(q){
 const words=plain(q).trim().split(/\s+/).filter(Boolean);
 if(!words.length){const list=recent.map(id=>catalog.topics.find(t=>t.id===id)).filter(Boolean);return {label:list.length?'Recently viewed':'',items:list.map(t=>({href:'#'+t.id,title:topicTitle(t),meta:t.category}))};}
 buildIndex();
 const topics=catalog.topics.map(t=>({t,n:score(t,q)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n).slice(0,24);
 const items=[];
 for(const {t} of topics){
  const secs=searchIndex.get(t.id)||[];
  const titleHits=secs.filter(s=>words.every(w=>plain(s.title).includes(w)));
  const textHits=secs.filter(s=>!titleHits.includes(s)&&words.every(w=>s.low.includes(w)));
  const best=textHits[0]||titleHits[0];
  items.push({href:'#'+t.id+(best&&!words.every(w=>plain(t.title).includes(w))?'/'+best.id:''),title:topicTitle(t),meta:t.category,snippet:best?snippet(best.raw,words.find(w=>best.raw.toLowerCase().includes(w))||words[0]):(()=>{const raw=t.text.replace(/\s+/g,' '),w=words.find(w=>raw.toLowerCase().includes(w));return w?snippet(raw,w):'';})(),sections:[...titleHits,...textHits].slice(0,3).map(s=>({href:`#${t.id}/${s.id}`,title:s.title}))});
 }
 return {label:items.length?`${items.length}${items.length===24?'+':''} topic${items.length===1?'':'s'}`:'',items};
}
function renderSearch(){
 const q=$('#search-input').value,{label,items}=runSearch(q);
 searchResults=[];
 const box=$('#search-results');
 if(!items.length){box.innerHTML=q.trim()?`<p class="search-empty">No matches for “${esc(q)}”. Try an abbreviation, drug name or broader term.</p>`:`<div class="search-hints"><p>Try <button data-q="afib">afib</button> <button data-q="hyponatremia">hyponatremia</button> <button data-q="heparin">heparin</button> <button data-q="DKA">DKA</button></p><p class="muted">Search covers every topic, section heading and table.</p></div>`;box.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{$('#search-input').value=b.dataset.q;renderSearch();$('#search-input').focus();}));return;}
 box.innerHTML=`${label?`<div class="search-label">${esc(label)}</div>`:''}<ul role="listbox" aria-label="Search results">${items.map(it=>`<li><a class="result" href="${it.href}" role="option"><span class="result-head"><strong>${esc(it.title)}</strong><small>${esc(it.meta)}</small></span>${it.snippet?`<span class="result-snippet">${it.snippet}</span>`:''}</a>${it.sections?.length?`<span class="result-sections">${it.sections.map(s=>`<a href="${s.href}">§ ${esc(s.title)}</a>`).join('')}</span>`:''}</li>`).join('')}</ul>`;
 searchResults=$$('#search-results a');searchActive=0;highlightResult();
 searchResults.forEach(a=>a.addEventListener('click',()=>$('#search-dialog').close()));
}
function highlightResult(){searchResults.forEach((a,i)=>a.classList.toggle('active',i===searchActive));searchResults[searchActive]?.scrollIntoView({block:'nearest'});}
function openSearch(initial=''){
 if(cardiologyActive){$('#cardiology-search')?.focus();return;}
 const d=$('#search-dialog'),input=$('#search-input');
 input.value=initial;renderSearch();if(!d.open)d.showModal();input.focus();input.select();
}
$('#search-input').addEventListener('input',renderSearch);
$('#search-input').addEventListener('keydown',e=>{
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!searchResults.length)return;searchActive=(searchActive+(e.key==='ArrowDown'?1:-1)+searchResults.length)%searchResults.length;highlightResult();}
 else if(e.key==='Enter'&&searchResults[searchActive]){e.preventDefault();const href=searchResults[searchActive].getAttribute('href');$('#search-dialog').close();go(href.slice(1));}
});

/* ---------- About, focus view, figures ---------- */
function showAboutOverview(){
 let box=$('#cardiology-about');if(!box){box=document.createElement('div');box.id='cardiology-about';$('#about-dialog').append(box);}
 box.hidden=!cardiologyActive;
 if(cardiologyActive){
  const source=cardiologyReader?.cardiologyContents.redbookSource;
  box.innerHTML=`<div class="kicker">About Cardiology Reference</div>
   <h2 id="cardiology-about-title">Cardiology Reference</h2>
   <p>A searchable cardiology manual for fellows and specialists. The Red Book chapters preserve the 2022–23 edition. Check current guidance and local policy before clinical use.</p>
   <details><summary class="primary-button">Source and credits</summary>
   <p>Book pages 38–189 come from the supplied <em>Cardiology Housestaff Manual · The Red Book</em>, 2022–23. The figures and complex source tables can be enlarged. Local unit workflows, paging instructions, and institution-specific policies were removed.</p>
   <p>Red Book excerpt contributors include ${esc(source?.contributors.join(', ')||'the authors credited in the manual')}.</p>
   <p>Erik Dove and Peyton Hanson are credited for the supplied ACS excerpt, book pages 11–37. The overview of cardiac procedures was transcribed from the supplied screenshots.</p></details>`;
  $('#about-overview').hidden=true;$('#about-credits').hidden=true;
  $('#about-dialog').setAttribute('aria-labelledby','cardiology-about-title');$('#about-dialog').scrollTop=0;return;
 }
 $('#about-overview').hidden=false;$('#about-credits').hidden=true;$('#about-dialog').setAttribute('aria-labelledby','about-title');$('#about-dialog').scrollTop=0;
}
function openAbout(){closeMenu();showAboutOverview();$('#about-dialog').showModal();}
function openCredits(){const box=$('#about-credits');box.innerHTML=attributionMarkup(catalog.metadata.attribution);$('#about-overview').hidden=true;box.hidden=false;$('#about-dialog').setAttribute('aria-labelledby','credits-title');$('#credits-back').addEventListener('click',()=>{showAboutOverview();$('#attribution-open').focus();});$('#about-dialog').scrollTop=0;$('#credits-back').focus();}
function openZoom(id){const section=sectionsOf(selected).find(s=>s.id===id);if(section)showZoom(section.title,renderSectionParts(section,section.parts,{expand:false,idPrefix:'focus-'}));}
function findTable(blocks,id){for(const b of blocks){if(b.type==='table'&&b.id===id)return b;const match=findTable([...(b.blocks||[]),...(b.columns||[]).flat(),...(b.cells||[]).flatMap(c=>c.blocks)],id);if(match)return match;}return null;}
function openTable(id){
 if(cardiologyActive){const {cardiologyChapterSections,cardiologyTitle}=cardiologyReader;for(const s of cardiologyChapterSections(cardiologyId)){const b=findTable(s.blocks,id);if(b){const title=cardiologyTitle(b.caption||s.title);showZoom(title,renderBlocks([b,...notesForTable(b,s.blocks)],{title,expand:false,idPrefix:'focus-'}));return;}}return;}
 if(!selected)return;
 for(const section of sectionsOf(selected))for(const {panel,page} of section.parts){
  const table=findTable(panel.blocks,id);if(!table)continue;
  const context={...readingContext(panel,page,section.title),expand:false,idPrefix:'focus-',screeningCards:false};
  showZoom(cleanTitle(table.caption||section.title),renderBlocks([table,...notesForTable(table,panel.blocks)],context));return;
 }
}
function showZoom(title,html){zoomScale=1;$('#zoom-title').textContent=title;$('#zoom-content').innerHTML=`<div class="zoom-canvas clinical-text">${html}</div>`;bindReadingEvents($('#zoom-content'));setZoom(1);if(!$('#zoom-dialog').open)$('#zoom-dialog').showModal();$$('#zoom-content .table-wrap').forEach(edgeState);}
function openFigure(src,label){zoomScale=1;$('#zoom-title').textContent=label;$('#zoom-content').innerHTML=`<div class="zoom-canvas figure-canvas"><img src="${esc(src)}" alt="${esc(label)}"></div>`;setZoom(1);if(!$('#zoom-dialog').open)$('#zoom-dialog').showModal();}
function setZoom(n){zoomScale=Math.max(.75,Math.min(3,n));$('.zoom-canvas')?.style.setProperty('font-size',`${zoomScale*100}%`);$('.figure-canvas')?.style.setProperty('width',`${zoomScale*100}%`);$('#zoom-level').textContent=`${Math.round(zoomScale*100)}%`;}

/* ---------- Header, theme, menu ---------- */
function applyTheme(){if(theme==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;const label={auto:'Theme: match system',light:'Theme: light',dark:'Theme: dark'}[theme];$$('[data-theme-toggle]').forEach(b=>{b.setAttribute('aria-label',label);b.title=label;b.dataset.mode=theme;});}
function cycleTheme(){theme={auto:'light',light:'dark',dark:'auto'}[theme];applyTheme();status({auto:'Theme follows your system',light:'Light theme',dark:'Dark theme'}[theme],true);}
function closeMenu(){$('#menu').hidden=true;$('#menu-button').setAttribute('aria-expanded','false');}
$('#menu-button').addEventListener('click',e=>{e.stopPropagation();const open=$('#menu').hidden;$('#menu').hidden=!open;$('#menu-button').setAttribute('aria-expanded',String(open));});
addEventListener('click',e=>{if(!e.target.closest('#menu'))closeMenu();});
$$('[data-theme-toggle]').forEach(b=>b.addEventListener('click',cycleTheme));
$$('[data-open-search]').forEach(b=>b.addEventListener('click',()=>{closeMenu();openSearch();}));
$('.skip').addEventListener('click',e=>{e.preventDefault();focusMain();});
$('.folio-brand').addEventListener('click',e=>{e.preventDefault();closeMenu();home();});
$$('[data-nav="home"]').forEach(b=>b.addEventListener('click',()=>{closeMenu();home();}));
$$('[data-nav="saved"]').forEach(b=>b.addEventListener('click',()=>{closeMenu();go('saved');}));
$$('[data-nav="about"]').forEach(b=>b.addEventListener('click',openAbout));
$('#attribution-open').addEventListener('click',openCredits);
$('.dialog-close').addEventListener('click',()=>$('#about-dialog').close());
$('#zoom-close').addEventListener('click',()=>$('#zoom-dialog').close());
$('#zoom-in').addEventListener('click',()=>setZoom(zoomScale+.25));$('#zoom-out').addEventListener('click',()=>setZoom(zoomScale-.25));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d&&d.id!=='zoom-dialog')d.close();}));
addEventListener('hashchange',route);
addEventListener('keydown',e=>{
 const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||document.activeElement.isContentEditable;
 if((e.key==='k'&&(e.metaKey||e.ctrlKey))||(e.key==='/'&&!typing&&!document.querySelector('dialog[open]'))){e.preventDefault();openSearch();}
 if(e.key==='Escape')closeMenu();
});
addEventListener('scroll',()=>{if(spy&&!spyFrame)spyFrame=requestAnimationFrame(()=>{spyFrame=0;spy?.();});const doc=document.documentElement,max=doc.scrollHeight-innerHeight;$('#progress').style.transform=`scaleX(${view==='reader'&&max>0?Math.min(1,scrollY/max):0})`;document.body.classList.toggle('scrolled',scrollY>8);},{passive:true});
let printBranches=[];
addEventListener('beforeprint',()=>{printBranches=[...document.querySelectorAll('.pathway-branch')].map(el=>({el,open:el.open}));printBranches.forEach(({el})=>el.open=true);});
addEventListener('afterprint',()=>{printBranches.forEach(({el,open})=>el.open=open);printBranches=[];});
applyTheme();
if(location.hash.startsWith('#cardiology-reference'))route();
try{const response=await fetch('catalog.json?v=reference-layout');if(!response.ok)throw Error('Catalog unavailable');catalog=await response.json();if(!cardiologyActive)route();(window.requestIdleCallback||setTimeout)(()=>buildIndex());}catch(e){if(!cardiologyActive)main.innerHTML='<div class="empty"><h1>The collection could not be loaded.</h1><p>Reload the page to try again.</p><button class="primary-button" onclick="location.reload()">Reload</button></div>';}

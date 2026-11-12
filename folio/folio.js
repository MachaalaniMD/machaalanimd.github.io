import {renderBlocks,escapeHtml as esc} from './content.mjs?v=reference-layout';
import {cleanTitle,readingSections} from './reading.mjs?v=reference-layout';
import {attributionMarkup} from './about.mjs?v=20261110-procedures';
import {notesForTable,walkBlocks} from './notes.mjs?v=20261110-procedures';
import {scoreTopic as score} from './search.mjs';
const main=document.querySelector('main'),$=s=>document.querySelector(s);
let cardiologyActive=false,cardiologyId='',cardiologyQuery='';
let cardiologyReader,cardiologyImport;

let catalog,category='all',query='',view='browse',selected=null,activePanel='all',facet='all',saved=new Set(),zoomScale=1;
const topicTitle=topic=>cleanTitle(topic.title);
const readingContext=(panel,page,title)=>({
 screeningCards:true,
 title,
 titleRuns:panel.titleRuns||[{t:panel.title}],
 pdfPage:page.pdfPage
});
function focusMain(){main.focus({preventScroll:true});}
function status(s){$('#live-status').textContent=s;}
function setHash(id){if(location.hash.slice(1)!==id)location.hash=id;else route();}
function home(){cardiologyActive=false;cardiologyQuery='';selected=null;category='all';query='';view='browse';activePanel='all';facet='all';if(location.hash)history.replaceState(null,'',location.pathname+location.search);render();scrollTo({top:0,behavior:'instant'});}
function updateSave(id){if(saved.has(id))saved.delete(id);else saved.add(id);$('#saved-count').textContent=saved.size;status(saved.has(id)?'Added to this session’s reading list.':'Removed from reading list.');render();}
function collectionStats(){
 const {metadata,categories}=catalog;
 const counts=[
  [metadata.topics,'Topics'],
  [categories.length,'Systems'],
  [metadata.conversion.tables,'Tables'],
  [metadata.conversion.figures,'Figures']
 ];
 return `<dl class="collection-stats" aria-label="Folio collection counts">${counts.map(([count,label])=>
  `<div><dt>${label}</dt><dd>${count}</dd></div>`
 ).join('')}</dl>`;
}
function browseMarkup(){
 const isIndex=view==='browse'&&!query&&category==='all',chapter=catalog.categories.find(c=>c.id===category);
 const list=catalog.topics.filter(t=>(query||category==='all'||t.categoryId===category)&&(view!=='saved'||saved.has(t.id))).map(t=>({t,n:score(t,query)})).filter(x=>x.n>0).sort((a,b)=>query?b.n-a.n:catalog.topics.indexOf(a.t)-catalog.topics.indexOf(b.t)).map(x=>x.t);
 const title=query?'Find your next answer.':view==='saved'?'Your reading list.':chapter?chapter.title:'A manual of medicine.';
 return `<section class="directory-intro"><div><div class="kicker">THE MEDICINE MANUAL</div><h1>${esc(title)}</h1><p>${isIndex?'Choose a system. Find a topic. Get to the part you need.':query?`Searching all ${catalog.metadata.topics} topics.`:view==='saved'?'A little space for the topics you want to come back to this session.':`${chapter?.count||list.length} topics to explore.`}</p></div>${isIndex?collectionStats():''}</section>
 <section class="find-section"><div class="folio-search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="topic-search" type="search" autocomplete="off" aria-label="Search the manual" placeholder="Search a condition, medication or test…" value="${esc(query)}">${query?'<button id="clear-query" aria-label="Clear search">×</button>':'<kbd>/</kbd>'}</div></section>
 ${isIndex?`<section class="systems-directory" aria-labelledby="systems-title"><div class="directory-label"><h2 id="systems-title">Explore the systems</h2><span>${catalog.categories.length} chapters</span></div><div class="system-grid">${catalog.categories.map((c,i)=>`<button class="system-tile" data-category="${c.id}" aria-label="${esc(c.title)}, ${c.count} topics"><span class="system-number">${String(i+1).padStart(2,'0')}</span><span class="system-title">${esc(c.title)}</span><span class="system-count">${c.count}</span><span class="system-arrow" aria-hidden="true">↗</span></button>`).join('')}</div></section><a class="cardiology-entry" href="#cardiology-reference"><strong>Cardiology Reference</strong><span>Contents for fellows and specialists</span><b aria-hidden="true">↗</b></a>`:
 `<div class="directory-trail"><button data-systems>All systems</button><span>/</span><span>${esc(query?'Search':view==='saved'?'Reading list':chapter?.title||'Topics')}</span><strong>${list.length} topic${list.length===1?'':'s'}</strong></div><section class="topic-list" aria-label="Medical topics">${list.map((t,i)=>`<article class="topic-row"><button class="open-topic" data-open="${t.id}"><span class="topic-index">${String(i+1).padStart(2,'0')}</span><span class="topic-name"><h2>${esc(topicTitle(t))}</h2>${query||view==='saved'?`<small>${esc(t.category)}</small>`:''}</span><span class="topic-arrow" aria-hidden="true">→</span></button><button class="save-topic ${saved.has(t.id)?'saved':''}" data-save="${t.id}" aria-label="${saved.has(t.id)?'Remove':'Save'} ${esc(topicTitle(t))}" aria-pressed="${saved.has(t.id)}">${saved.has(t.id)?'◆':'◇'}</button></article>`).join('')||`<div class="empty"><h2>${view==='saved'?'Nothing saved yet.':'No matching topics.'}</h2><p>${view==='saved'?'Use the bookmark beside a topic to keep it for this session.':'Try a condition, abbreviation or broader term.'}</p><button data-systems>Browse systems →</button></div>`}</section>`}`;
}
function renderSectionParts(section,parts=section.parts,context={}){
 return parts.map(({panel,page})=>{
  const legend=panel.legend?`<p class="section-legend">${esc(panel.legend)}</p>`:'';
  const lead=panel.readerLead?`<p>${esc(panel.readerLead)}</p>`:'';
  const content=legend+lead+renderBlocks(panel.readerBlocks||panel.blocks,{...readingContext(panel,page,section.title),...context});
  return panel.id===section.id||context.idPrefix?content:`<div id="${esc(panel.id)}">${content}</div>`;
 }).join('');
}

function readerMarkup(topic){
 const sections=readingSections(topic);
 let visible=sections.filter(s=>activePanel==='all'||s.id===activePanel);
 if(!visible.length&&activePanel!=='all'){
  activePanel='all';
  visible=sections;
 }
 const related=catalog.topics.filter(t=>t.category===topic.category&&t.id!==topic.id).slice(0,5);
 const buttons=[{id:'all',title:'All sections'},...sections].map(({id,title})=>{
  const active=activePanel===id;
  return `<button data-panel="${esc(id)}" class="${active?'active':''}" aria-pressed="${active}">${esc(title)}</button>`;
 }).join('');
 const options=[{id:'all',title:'All sections'},...sections].map(({id,title})=>
  `<option value="${esc(id)}"${activePanel===id?' selected':''}>${esc(title)}</option>`
 ).join('');
 const articles=visible.map(s=>{
  const parts=s.parts.filter(({panel})=>facet==='all'||panel.kind===facet);
  if(!parts.length)return '';
  return `<article class="source-panel" id="${esc(s.id)}">
   <div class="source-panel-bar"><h2>${esc(s.title)}</h2><button data-enlarge="${esc(s.id)}" aria-label="Focus ${esc(s.title)}">Focus ↗</button></div>
   <div class="clinical-text">${renderSectionParts(s,parts)}</div>
  </article>`;
 }).join('');
 return `<div class="reader-breadcrumb"><button id="back-browse">Systems</button><span>/</span><button data-back-category="${topic.categoryId}">${esc(topic.category)}</button><span>/</span><span>${esc(topicTitle(topic))}</span></div>
 <section class="reader-heading"><div><div class="kicker">${esc(topic.category)}</div><h1>${esc(topicTitle(topic))}</h1></div><button class="reader-save ${saved.has(topic.id)?'saved':''}" data-save="${topic.id}">${saved.has(topic.id)?'◆ Saved':'◇ Save topic'}</button></section>
 <div class="reader-layout">
  <aside class="reader-index"><div class="index-title">In this topic</div>${buttons}<div class="index-title related-title">Keep exploring</div>
   ${related.map(t=>`<button class="related-topic" data-open="${t.id}">${esc(topicTitle(t))} <span>↗</span></button>`).join('')}
  </aside>
  <section class="reader-content">
   <label class="section-picker">In this topic<select id="section-select">${options}</select></label>
   <div class="reader-controls"><nav class="focus-filters" aria-label="Sections in this topic">${buttons}</nav></div>
   ${articles||'<div class="empty"><h2>No sections under this heading.</h2><p>Choose All sections to read the entry.</p></div>'}
   <div class="reader-end"><button id="next-topic">Next topic →</button></div>
  </section>
 </div>`;
}

function bindReadingEvents(container){
 container.querySelectorAll('[data-note-target]').forEach(link=>link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();jumpToNote(link.dataset.noteTarget);}));
 container.querySelectorAll('[data-enlarge]').forEach(b=>b.addEventListener('click',()=>openZoom(b.dataset.enlarge)));
 container.querySelectorAll('[data-table]').forEach(b=>b.addEventListener('click',()=>openTable(b.dataset.table)));
 container.querySelectorAll('[data-figure]').forEach(b=>b.addEventListener('click',()=>openFigure(b.dataset.figure,b.dataset.figureLabel)));
 container.querySelectorAll('[data-toggle-branches]').forEach(button=>{const group=button.closest('.clinical-text'),branches=[...group.querySelectorAll('.pathway-branch')];const update=()=>{const allOpen=branches.every(d=>d.open);button.textContent=allOpen?'Collapse all branches':'Expand all branches';button.setAttribute('aria-expanded',String(allOpen));};button.addEventListener('click',()=>{const open=branches.some(d=>!d.open);branches.forEach(d=>d.open=open);update();});branches.forEach(d=>d.addEventListener('toggle',update));});
}
function render(){
 if(cardiologyActive){renderCardiology();return;}
 if(!catalog)return;
 $('#browse-nav').textContent='Systems';$('#saved-nav').hidden=false;$('.folio-brand small').textContent='INTERNAL MEDICINE REFERENCE';
 document.title=selected?`${topicTitle(selected)} · Folio`:'Folio · Internal medicine reference';
 main.innerHTML=selected?readerMarkup(selected):browseMarkup();
 $('#topic-search')?.addEventListener('input',e=>{const start=e.target.selectionStart;query=e.target.value;render();const next=$('#topic-search');next.focus();try{next.setSelectionRange(start,start);}catch{}});
 main.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>setHash(b.dataset.open)));
 main.querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click',()=>updateSave(b.dataset.save)));
 main.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{query='';view='browse';setHash('system/'+b.dataset.category);}));
 main.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>{activePanel=b.dataset.panel;facet='all';render();status('Section selected.');if(innerWidth<850)$('.reader-content')?.scrollIntoView({behavior:'smooth',block:'start'});}));
 main.querySelectorAll('[data-facet]').forEach(b=>b.addEventListener('click',()=>{facet=b.dataset.facet;activePanel='all';render();}));
 bindReadingEvents(main);
 $('#back-browse')?.addEventListener('click',home);
 main.querySelector('[data-back-category]')?.addEventListener('click',e=>{query='';view='browse';setHash('system/'+e.currentTarget.dataset.backCategory);});
 main.querySelectorAll('[data-systems]').forEach(b=>b.addEventListener('click',home));
 $('#clear-query')?.addEventListener('click',()=>{query='';render();$('#topic-search')?.focus();});
 $('#section-select')?.addEventListener('change',e=>{activePanel=e.target.value;facet='all';render();});
 $('#next-topic')?.addEventListener('click',()=>{const i=catalog.topics.indexOf(selected);setHash(catalog.topics[(i+1)%catalog.topics.length].id);});
 $('#browse-nav').classList.toggle('active',view==='browse');$('#saved-nav').classList.toggle('active',view==='saved');
}
function jumpToNote(id){const target=document.getElementById(id);if(!target)return false;for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;target.scrollIntoView({behavior:'smooth',block:'center'});target.focus({preventScroll:true});return true;}
function renderCardiology(){
 if(!cardiologyReader){
  if(cardiologyImport)return;
  main.innerHTML='<div class="loading" role="status">Opening the Cardiology Reference…</div>';
  cardiologyImport=import('./cardiology.mjs?v=reference-layout')
   .then(reader=>{
    cardiologyReader=reader;
    if(cardiologyActive)renderCardiology();
   })
   .catch(()=>{
    if(cardiologyActive){
     main.innerHTML='<div class="empty"><h1>The Cardiology Reference could not be opened.</h1><button id="retry-cardiology">Try again</button></div>';
     $('#retry-cardiology').addEventListener('click',renderCardiology);
    }
   })
   .finally(()=>{cardiologyImport=null;});
  return;
 }
 const {cardiologyMarkup,cardiologyEntries,cardiologyTitle,resolveCardiologyId}=cardiologyReader;
 cardiologyId=resolveCardiologyId(cardiologyId);
 $('#browse-nav').textContent='General Medicine';$('#saved-nav').hidden=true;$('.folio-brand small').textContent='CARDIOLOGY REFERENCE';
 const node=cardiologyEntries.find(n=>n.id===cardiologyId);document.title=`${node?cardiologyTitle(node.title)+' · ':''}Cardiology Reference · Folio`;
 main.innerHTML=cardiologyMarkup(cardiologyId,cardiologyQuery);
 bindReadingEvents(main);
 $('#browse-nav').classList.remove('active');$('#saved-nav').classList.remove('active');
 $('#cardiology-search').addEventListener('input',e=>{const start=e.target.selectionStart;cardiologyQuery=e.target.value;renderCardiology();const field=$('#cardiology-search');field.focus();try{field.setSelectionRange(start,start);}catch{}});
 main.querySelectorAll('[data-procedure-anchor]').forEach(button=>button.addEventListener('click',()=>{const target=document.getElementById(button.dataset.procedureAnchor);target?.scrollIntoView({behavior:'smooth',block:'start'});target?.focus({preventScroll:true});}));
 $('[data-clear-cardiology]')?.addEventListener('click',()=>{cardiologyQuery='';renderCardiology();$('#cardiology-search').focus();});
}
function route(){if($('#zoom-dialog').open)$('#zoom-dialog').close();const id=decodeURIComponent(location.hash.slice(1));if(id==='cardiology-reference'||id.startsWith('cardiology-reference/')){const nextId=id.split('/')[1]||'';if(!cardiologyActive||nextId!==cardiologyId)cardiologyQuery='';cardiologyActive=true;cardiologyId=nextId;selected=null;render();scrollTo({top:0,behavior:'instant'});focusMain();return;}cardiologyActive=false;selected=catalog?.topics.find(t=>t.id===id)||null;if(!selected&&/^fn(?:ref)?-/.test(id))selected=catalog?.topics.find(t=>t.pages.some(p=>p.panels.some(s=>[...walkBlocks(s.blocks)].some(b=>b.footnote?.id===id||b.runs?.some(r=>r.noteRefId===id)))))||null;const c=catalog?.categories.find(c=>'system/'+c.id===id);if(c){category=c.id;view='browse';}else if(!selected){category='all';}activePanel='all';facet='all';render();scrollTo({top:0,behavior:'instant'});focusMain();if(selected&&/^fn(?:ref)?-/.test(id))jumpToNote(id);}
function showAboutOverview(){
 let box=$('#cardiology-about');if(!box){box=document.createElement('div');box.id='cardiology-about';$('#about-dialog').append(box);}
 box.hidden=!cardiologyActive;
 if(cardiologyActive){
  const source=cardiologyReader?.cardiologyContents.redbookSource;
  box.innerHTML=`<div class="kicker">ABOUT CARDIOLOGY REFERENCE</div>
   <h2 id="cardiology-about-title">Cardiology Reference</h2>
   <p>A searchable cardiology manual for fellows and specialists. The Red Book chapters preserve the 2022–23 edition. Check current guidance and local policy before clinical use.</p>
   <details><summary class="primary-button">Source and credits</summary>
   <p>Book pages 38–189 come from the supplied <em>Cardiology Housestaff Manual · The Red Book</em>, 2022–23. The figures and complex source tables can be enlarged. Local unit workflows, paging instructions, and institution-specific policies were removed.</p>
   <p>Red Book excerpt contributors include ${esc(source?.contributors.join(', ')||'the authors credited in the manual')}.</p>
   <p>Erik Dove and Peyton Hanson are credited for the supplied ACS excerpt, book pages 11–37. The overview of cardiac procedures was transcribed from the supplied screenshots.</p></details>`;
  $('#about-overview').hidden=true;
  $('#about-credits').hidden=true;
  $('#about-dialog').setAttribute('aria-labelledby','cardiology-about-title');
  $('#about-dialog').scrollTop=0;
  return;
 }
 $('#about-overview').hidden=false;$('#about-credits').hidden=true;$('#about-dialog').setAttribute('aria-labelledby','about-title');$('#about-dialog').scrollTop=0; }
function openAbout(){showAboutOverview();$('#about-dialog').showModal();}
function openCredits(){const box=$('#about-credits');box.innerHTML=attributionMarkup(catalog.metadata.attribution);$('#about-overview').hidden=true;box.hidden=false;$('#about-dialog').setAttribute('aria-labelledby','credits-title');$('#credits-back').addEventListener('click',()=>{showAboutOverview();$('#attribution-open').focus();});$('#about-dialog').scrollTop=0;$('#credits-back').focus();}
function openZoom(id){
 const section=readingSections(selected).find(s=>s.id===id);
 if(section)showZoom(section.title,renderSectionParts(section,section.parts,{expand:false,idPrefix:'focus-'}));
}
function findTable(blocks,id){for(const b of blocks){if(b.type==='table'&&b.id===id)return b;const match=findTable([...(b.blocks||[]),...(b.columns||[]).flat(),...(b.cells||[]).flatMap(c=>c.blocks)],id);if(match)return match;}return null;}
function openTable(id){
 if(cardiologyActive){const {cardiologyChapterSections,cardiologyTitle}=cardiologyReader;for(const s of cardiologyChapterSections(cardiologyId)){const b=findTable(s.blocks,id);if(b){const title=cardiologyTitle(b.caption||s.title);showZoom(title,renderBlocks([b,...notesForTable(b,s.blocks)],{title,expand:false,idPrefix:'focus-'}));return;}}return;}
 if(!selected)return;
 for(const section of readingSections(selected)){
  for(const {panel,page} of section.parts){
   const table=findTable(panel.blocks,id);
   if(!table)continue;
   const context={...readingContext(panel,page,section.title),expand:false,idPrefix:'focus-',screeningCards:false};
   showZoom(cleanTitle(table.caption||section.title),renderBlocks([table,...notesForTable(table,panel.blocks)],context));
   return;
  }
 }
}
function showZoom(title,html){zoomScale=1;$('#zoom-title').textContent=title;$('#zoom-content').innerHTML=`<div class="zoom-canvas clinical-text">${html}</div>`;bindReadingEvents($('#zoom-content'));setZoom(1);if(!$('#zoom-dialog').open)$('#zoom-dialog').showModal();}
function openFigure(src,label){zoomScale=1;$('#zoom-title').textContent=label;$('#zoom-content').innerHTML=`<div class="zoom-canvas figure-canvas"><img src="${esc(src)}" alt="${esc(label)}"></div>`;setZoom(1);if(!$('#zoom-dialog').open)$('#zoom-dialog').showModal();}
function setZoom(n){zoomScale=Math.max(.75,Math.min(3,n));$('.zoom-canvas')?.style.setProperty('font-size',`${zoomScale*100}%`);$('.figure-canvas')?.style.setProperty('width',`${zoomScale*100}%`);$('#zoom-level').textContent=`${Math.round(zoomScale*100)}%`;}
$('.skip').addEventListener('click',e=>{e.preventDefault();focusMain();});$('.folio-brand').addEventListener('click',e=>{e.preventDefault();home();});
$('#browse-nav').addEventListener('click',home);$('#saved-nav').addEventListener('click',()=>{cardiologyActive=false;view='saved';selected=null;category='all';query='';if(location.hash)history.replaceState(null,'',location.pathname+location.search);render();scrollTo({top:0,behavior:'instant'});});$('#about-nav').addEventListener('click',openAbout);$('#attribution-open').addEventListener('click',openCredits);$('.dialog-close').addEventListener('click',()=>$('#about-dialog').close());$('#zoom-close').addEventListener('click',()=>$('#zoom-dialog').close());$('#zoom-in').addEventListener('click',()=>setZoom(zoomScale+.25));$('#zoom-out').addEventListener('click',()=>setZoom(zoomScale-.25));
addEventListener('hashchange',route);addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();if(cardiologyActive){e.preventDefault();$('#cardiology-search')?.focus();return;}if(selected)home();$('#topic-search')?.focus();}});
let printBranches=[];
addEventListener('beforeprint',()=>{printBranches=[...document.querySelectorAll('.pathway-branch')].map(el=>({el,open:el.open}));printBranches.forEach(({el})=>el.open=true);});
addEventListener('afterprint',()=>{printBranches.forEach(({el,open})=>el.open=open);printBranches=[];});
if(location.hash.startsWith('#cardiology-reference'))route();
try{const response=await fetch('catalog.json?v=reference-layout');if(!response.ok)throw Error('Catalog unavailable');catalog=await response.json();if(!cardiologyActive)route();}catch(e){if(!cardiologyActive)main.innerHTML='<div class="empty"><h1>The collection could not be loaded.</h1><p>Reload the page to try again.</p><button onclick="location.reload()">Reload</button></div>';}

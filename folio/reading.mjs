import {readingPlans} from './reading-plans.mjs?v=20261107-cardiopulm';
export const textOf=runs=>runs.map(r=>r.t).join('');
export function sliceRuns(runs,start,end){let at=0;return runs.flatMap(r=>{const a=Math.max(0,start-at),b=Math.min(r.t.length,end-at);at+=r.t.length;return b>a?[{...r,t:r.t.slice(a,b)}]:[];});}
// Remove punctuation left behind by an omitted cross-reference. Clinical
// signs, decimal points, and nonempty parentheticals stay in the source runs.
export function cleanReadingRuns(runs){
 const text=textOf(runs);
 const ranges=[...text.matchAll(/ *\(\s*[.]?\s*\)/g)].map(m=>[m.index,m.index+m[0].length]);
 const leading=text.match(/^(\s*(?:[•▪◦●○o]\s+)?)\.\s+(?=\p{L})/u);
 if(leading)ranges.unshift([leading[1].length,leading[0].length]);
 if(!ranges.length)return runs;
 const clean=[];
 let start=0;
 for(const [a,b] of ranges){
  clean.push(...sliceRuns(runs,start,a));
  start=b;
 }
 clean.push(...sliceRuns(runs,start,text.length));
 return clean;
}

const citationPattern=/(?:19|20)\d{2}|pubmed|doi:|guidelines|Harrison[’']s|Pink Book|\b(?:NEJM|JAMA|Lancet|Circulation)\b/i;
const journalTail=/\b(?:NEJM|JAMA|Lancet|Eur Resp J|AJRCCM|Thorax|Epilepsia|Continuum|Neuro(?:logy)?|Neurosurg Focus|Stroke|JACC(?:HF)?|Circ(?:ulation)?|EHJ|J Hepatol|Hepatology|JACI|JCEM|AJG|Gastro(?:enterology)?|CGH|JHLT|JCS|CID|Chest|CHEST|Annals|Blood(?:\s*Adv)?|KDIGO|GINA|GOLD|ADA|IDSA|USPSTF|ACR|ASCO|EASL|ILTS)\s*(?:Guidelines\s*)?(?:19|20)\d{2}/ig;
export function splitHeading(runs){
 runs=cleanReadingRuns(runs);
 const text=textOf(runs),ranges=[];let start=-1,depth=0;
 for(let i=0;i<text.length;i++){if(text[i]==='('){if(!depth)start=i;depth++;}else if(text[i]===')'&&depth){depth--;if(!depth&&citationPattern.test(text.slice(start+1,i)))ranges.push([start,i+1]);}}
 if(depth&&start>=0&&citationPattern.test(text.slice(start+1)))ranges.push([start,text.length]);
 journalTail.lastIndex=0;let m;while((m=journalTail.exec(text))){if(!ranges.some(([a,b])=>m.index>=a&&m.index<b)){ranges.push([m.index,text.length]);break;}}
 for(const pattern of [/,\s*(?:19|20)\d{2}\s+(?:HRS|ACC|AHA)\b/i,/;\s*Chart w\/list of common inhalers:/i]){const tail=text.match(pattern);if(tail)ranges.push([tail.index,text.length]);}
 if(/^non-CF:\s*Eur Resp J/i.test(text))ranges.push([0,text.length]);
 ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const r of ranges){if(merged.length&&r[0]<=merged.at(-1)[1])merged.at(-1)[1]=Math.max(merged.at(-1)[1],r[1]);else merged.push([...r]);}
 let at=0,main=[];for(const[a,b]of merged){main.push(...sliceRuns(runs,at,a));at=b;}main.push(...sliceRuns(runs,at,text.length));
 return {main,references:merged.map(([a,b])=>sliceRuns(runs,a,b)),text:textOf(main).replace(/\s+/g,' ').replace(/^[\s|:–—-]+|[\s|–—-]+$/g,'')};
}
const acronyms=new Set('WHO GOLD HAVB DM HLD CVD CA HPV RSV MMR PCV15 PPSV23 PCV20 COVID-19 CT MRI PET CTA MRA MRCP ERCP EGD EUS CXR ABG VBG PFT PFTs PPM SND AVB SVT VT VF WPW LBBB RBBB LAFB LPFB LUTS OHS OSA CPAP BiPAP SpO2 PaO2 FiO2 HFNC NIPPV CPP CCM ICD GFR TMA TTP ITP MTC MEN2 AI AKI CKD GDMT HF HFrEF HFpEF HFmrEF HFimpEF HIV HBV HCV AAA DKA HHS ARDS COPD ICU SDU CCU IV PO TTM ACLS AV LV RV EF PPX BP HTN IDA TTE TEE ECG EKG VTE PE DVT ACS MI STEMI NSTEMI TIA CNS PNS SLE RA GI IBD IBS GERD PUD PPI INR PTT UFH LMWH DOAC LDL HDL ASCVD BMI A1C TSH T4 T3 CSF RBC WBC ANC MDS MPN AML ALL CLL CML GBM ANCA MRSA MSSA AIN ATN HRS BPH NAFLD NASH MASLD ASH HSV VZV TB UTI HAP VAP CAP CGRP JAK CAR-T AAS AAV ACO AGEP AHTR AIHA ALD AOSD APL AS AUD AVP-D AVP-R BSI CAUTI CCD CDC CIN CPC CRRT DHTR FNHTR GAD GN GVT HCC HE HES HIT HLH HPS IABP ICI KUB LBD LTACH MCS MDD MM MTX NMS NSF OCD OD OUD PBSC PCA PCOS PEP PFO PPA PTSD RLS RTA SBP SCU SNB SNF SUD SUDs SVC TACO TLS TRALI UACS VRE VSD MCTD UCTD GPA MPA EGPA GCA PAN VEXAS IgG4 IgA eGFR CYP2C19 DSM-5-TR ARDSnet'.split(' '));
const canonicalAcronyms=new Map([...acronyms].map(w=>[w.toLowerCase(),w]));
const ambiguousAcronyms=new Set(['ALL','AS','HE']);
function canonicalWord(word){
 const acronym=canonicalAcronyms.get(word.toLowerCase());
 return ambiguousAcronyms.has(acronym)&&word!==acronym?undefined:acronym;
}
export function cleanTitle(text){
 const title=splitHeading([{t:text}]).text;
 const allCaps=title===title.toUpperCase();
 return title.replace(/[A-Za-z][A-Za-z0-9-]*/g,word=>{
  const canonical=canonicalWord(word);
  if(canonical)return canonical;
  return word.split('-').map(part=>canonicalWord(part)||
   (allCaps?part.slice(0,1)+part.slice(1).toLowerCase():part)).join('-');
 });
}

export function readingSections(topic){
 const sections=[];
 for(const page of topic.pages){
  for(const panel of page.panels){
   const previous=sections.at(-1);
   const part={panel,page};
   if(previous&&panel.continuesSection===previous.id){
    previous.parts.push(part);
    continue;
   }
   const title=panel.readerTitle||cleanTitle(panel.title);
   sections.push({
    id:panel.id,
    title:/^source content$/i.test(title)?'Overview':title||'Overview',
    parts:[part]
   });
  }
 }
 return sections;
}

function compact(s){return s.normalize('NFKC').replace(/\s/g,'');}
function positions(s){let value='',map=[];for(let i=0;i<s.length;){const ch=String.fromCodePoint(s.codePointAt(i));for(const c of ch.normalize('NFKC'))if(!/\s/.test(c)){value+=c;for(let k=0;k<c.length;k++)map.push(i);}i+=ch.length;}map.push(s.length);return {value,map};}
const positive=readingPlans.positive.map(p=>({...p,key:compact(p.exactOriginalText)}));const negative=new Set(readingPlans.negative.map(p=>`${p.page}:${compact(p.exactOriginalText)}`));
function cpToUnit(s,n){return Array.from(s).slice(0,n).join('').length;}
function mappedBoundary(original,n,actual){const units=cpToUnit(original,n),index=compact(original.slice(0,units)).length;return actual.map[index]??actual.map.at(-1);}
const families=[['early','late','other s/s','late acute','late chronic','delayed graft function'],['acute','chronic','intranasal'],['primary','secondary','tertiary'],['mild','moderate','severe'],['inpatient','outpatient'],['type 1','type 2'],['prerenal','intrinsic','postrenal']];
export function enumerationPlan(runs,context={}){
 const text=textOf(runs),p=positions(text),page=context.pdfPage;
 if(negative.has(`${page}:${p.value}`))return null;
 const explicit=positive.find(x=>x.page===page&&x.key===p.value);
 if(explicit){const starts=explicit.subtypes.map(s=>mappedBoundary(explicit.exactOriginalText,s.start,p));const suffix=explicit.sharedSuffix?mappedBoundary(explicit.exactOriginalText,explicit.sharedSuffix.start,p):text.length;return {id:explicit.id,prefix:[0,starts[0]],items:starts.map((a,i)=>[a,starts[i+1]??suffix]),suffix:[suffix,text.length],reviewed:true};}
 // Additional display-only cases require explicit sibling labels at the top level,
 // a clear shared introduction, and strong source emphasis on every label.
 let depth=0;const labels=[];const re=/(?:^|[\s;])((?:late acute|late chronic|delayed graft function|other s\/s|acute|chronic|early|late|primary|secondary|tertiary|mild|moderate|severe|inpatient|outpatient|type 1|type 2|prerenal|intrinsic|postrenal)):/ig;
 let m;while((m=re.exec(text))){const start=m.index+m[0].indexOf(m[1]);depth=0;for(let j=0;j<start;j++){if(text[j]==='('||text[j]==='[')depth++;if(text[j]===')'||text[j]===']')depth--;}
  if(depth!==0)continue;const segment=sliceRuns(runs,start,start+m[1].length);const ink=segment.reduce((n,r)=>n+r.t.replace(/\s/g,'').length,0),bold=segment.reduce((n,r)=>n+(r.b?r.t.replace(/\s/g,'').length:0),0);if(bold/Math.max(1,ink)<.75)continue;labels.push({label:m[1].toLowerCase(),start});}
 const family=families.find(f=>new Set(labels.filter(l=>f.includes(l.label)).map(l=>l.label)).size>=2);if(!family)return null;
 const siblings=labels.filter(l=>family.includes(l.label));const prefix=text.slice(0,siblings[0].start);
 if(!/^(?:[•▪◦●○]\s*)?(?:Characteristics|Etiology|Pathophysiology|Clinical|Features|Types|Causes|Symptoms|Presentation|Classification|Complications|Treatment|Management)[^:]{0,35}:\s*$/i.test(prefix))return null;
 if(/\b(?:if|unless|AND|OR)\b|\b(?:mg|mcg|mL|q\d)\b/.test(prefix)||/\b(?:19|20)\d{2}[;:]/.test(text))return null;
 return {id:'source-emphasized-siblings',prefix:[0,siblings[0].start],items:siblings.map((l,i)=>[l.start,siblings[i+1]?.start??text.length]),suffix:[text.length,text.length],reviewed:false};
}
export function tableSizing(table){
 if(table.columnWidths?.length===table.cols&&table.columnWidths.every(n=>Number.isFinite(n)&&n>=60&&n<=700))return table.columnWidths;

 const cols=Array.from({length:table.cols},()=>({body:[],words:[],image:false}));
 const plain=bs=>bs.map(b=>b.runs?textOf(b.runs):b.type==='columns'?b.columns.map(plain).join(' '):b.blocks?plain(b.blocks):b.type==='table'?b.cells.map(c=>plain(c.blocks)).join(' '):'').join(' ');
 const hasImage=bs=>bs.some(b=>b.type==='figure'||b.blocks&&hasImage(b.blocks)||(b.columns||[]).some(hasImage));
 for(const c of table.cells){if(c.colspan!==1)continue;const t=plain(c.blocks);const v=cols[c.col];v.image||=hasImage(c.blocks);if(!c.header)v.body.push(t.length);v.words.push(...t.split(/\s+/).map(s=>s.length));}
 return cols.map((c,i)=>{const avg=c.body.reduce((a,b)=>a+b,0)/Math.max(1,c.body.length),max=Math.max(0,...c.body);let width=c.image?200:max>180||avg>100?300:max>85||avg>50?220:max>38?160:table.cols>8&&!c.words.some(n=>n>0)?42:78;if(i===0)width=Math.max(width,130);return Math.min(360,Math.max(width,Math.min(280,Math.max(0,...c.words)*6.5+22)));});
}

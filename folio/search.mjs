const aliases={aki:'acute kidney injury',ckd:'chronic kidney disease',hf:'heart failure',hfpef:'heart failure',hfref:'heart failure',afib:'atrial fibrillation',af:'atrial fibrillation',acs:'acute coronary syndrome',dka:'dka hhs',uti:'urinary tract infections',gi:'gastroenterology',platelets:'thrombocytopenia',mi:'myocardial infarction',pe:'pulmonary embolism',htn:'hypertensive',ppi:'peptic ulcer',antibiotics:'antimicrobials'};
const plain=s=>String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const includesTerm=(text,term)=>new RegExp(`(^|[^a-z0-9])${escape(term)}${term.length<4?'([^a-z0-9]|$)':''}`).test(text);
export function scoreTopic(t,q){
 const raw=plain(q.trim());if(!raw)return 1;
 const title=plain(t.title),text=plain(t.text),category=plain(t.category);
 const expanded=aliases[raw];
 if(expanded){const words=expanded.split(' ');if(words.every(w=>includesTerm(title,w)))return 120;if(includesTerm(title,raw))return 100;if(includesTerm(text,raw))return 12;if(words.every(w=>includesTerm(text,w)))return 8;return 0;}
 const words=raw.split(/\s+/).filter(Boolean);
 const all=words.every(w=>includesTerm(title+' '+category+' '+text,w));if(!all)return 0;
 return (title.includes(raw)?80:0)+(words.every(w=>includesTerm(title,w))?30:0)+(category.includes(raw)?15:0)+words.filter(w=>includesTerm(title,w)).length*8+1;
}

// Keep printed age-column associations; do not infer age cutoffs from cell widths.
export function screeningGroups(table){
 const header=table.cells.filter(c=>c.row===0),labels=Array.from({length:table.cols},(_,col)=>{const h=header.find(c=>c.col<=col&&col<c.col+c.colspan);return h?.blocks.flatMap(b=>(b.runs||[]).map(r=>r.t)).join('').trim()||'';});
 const groups=[];let active=null;
 for(let row=1;row<table.rows;row++){
  const cells=table.cells.filter(c=>c.row===row).sort((a,b)=>a.col-b.col),band=cells.find(c=>c.col===0&&c.colspan===table.cols);
  if(band){groups.push({band:band.blocks});active=null;continue;}
  const label=cells.find(c=>c.col===0);
  if(label){active={label:label.blocks,parts:[]};groups.push(active);}
  if(!active){active={label:[],parts:[]};groups.push(active);}
  for(const cell of cells.filter(c=>c.col>0&&c.blocks.length))active.parts.push({ages:[...new Set(labels.slice(cell.col,cell.col+cell.colspan))].filter(Boolean),blocks:cell.blocks});
 }
 return groups;
}

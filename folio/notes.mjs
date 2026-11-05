const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]*$/i.test(id);
export const noteDomId=(id,context={})=>validId(id)?`${context.idPrefix||''}${id}`:'';
export function* walkBlocks(blocks=[]){for(const b of blocks){yield b;yield*walkBlocks(b.blocks||[]);for(const col of b.columns||[])yield*walkBlocks(col);for(const cell of b.cells||[])yield*walkBlocks(cell.blocks);}}
export function notesForTable(table,panelBlocks){const present=new Set([...walkBlocks([table])].filter(b=>b.footnote).map(b=>b.footnote.id)),targets=new Set([...walkBlocks([table])].flatMap(b=>(b.runs||[]).map(r=>r.noteId).filter(Boolean)));return [...walkBlocks(panelBlocks)].filter(b=>b.footnote&&!present.has(b.footnote.id)&&(targets.has(b.footnote.id)||b.footnote.tableIds?.includes(table.id)));}

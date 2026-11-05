"""Source-based paragraph and list boundaries; no clinical text is authored here."""
import re
from pdfplumber.utils import extract_words
BULLET=re.compile(r'^[•▪◦●○]\s*|^o\s+|^[-–]\s*\S|^\d+[.)]\s+|^[a-z][.)]\s+')
LABEL=re.compile(r'^[A-Za-z][A-Za-z0-9 /()“”"’\'&–-]{0,90}:')
CITATION=re.compile(r'\b(?:19|20)\d{2}\b|\b(?:NEJM|JAMA|Lancet|JCEM|JACC|CHEST|AJRCCM|Gastroenterology|Annals|Hepatology|Circulation)\b',re.I)
def build_text_blocks(chars,links,glyph,inline,base_x=None):
 if not chars:return []
 words=extract_words(chars,x_tolerance=1.5,y_tolerance=4.2,keep_blank_chars=False,return_chars=True)
 rows=[]
 for w in sorted(words,key=lambda w:(w['top'],w['x0'])):
  cy=(w['top']+w['bottom'])/2
  row=next((r for r in reversed(rows[-4:]) if abs(r['cy']-cy)<4.5),None)
  if row:row['words'].append(w);row['cy']=sum((a['top']+a['bottom'])/2 for a in row['words'])/len(row['words'])
  else:rows.append({'cy':cy,'words':[w]})
 lines=[]
 for row in sorted(rows,key=lambda r:r['cy']):
  cs=sorted([c for w in row['words'] for c in w['chars']],key=lambda c:c['x0']);runs=inline(cs,links)
  if not runs:continue
  text=''.join(r['t'] for r in runs).strip();box=[min(c['x0'] for c in cs),min(c['top'] for c in cs),max(c['x1'] for c in cs),max(c['bottom'] for c in cs)]
  ink=[c for c in cs if any(ch.isalnum() for ch in glyph(c))]
  isbold=lambda c:'bold' in c['fontname'].lower() or 'black' in c['fontname'].lower()
  ratio=sum(isbold(c) for c in ink)/max(1,len(ink))
  first_bold=bool(ink and isbold(ink[0]));prefix=[]
  for c in ink:
   if not isbold(c):break
   prefix.append(c)
  prefix_end=max((c['x1'] for c in prefix),default=box[0]);suffix=''.join(glyph(c) for c in cs if c['x0']>=prefix_end-.1).strip()
  # A heading's normal-weight citation or parenthetical must not dilute the
  # title's typography. Stop after balanced groups, so a following explanatory
  # sentence (Oxygen Therapy (...): long-term O2 ...) stays a labelled paragraph.
  rest=suffix.strip(' |').lstrip(':').strip();groups=0
  while rest.startswith(('(', '[')):
   opening=rest[0];closing=')' if opening=='(' else ']';depth=0;end=None
   for at,ch in enumerate(rest):
    if ch==opening:depth+=1
    elif ch==closing:
     depth-=1
     if depth==0:end=at+1;break
   if end is None:break
   rest=rest[end:].strip(' |');groups+=1
  standalone_tail=groups>0 and not rest.strip(' .:;')
  letters=any(ch.isalpha() for ch in text)
  bullet=bool(BULLET.match(text));label=(bool(LABEL.match(text)) or first_bold and len(prefix)>=3 and rest.startswith(':')) and not bullet
  heading=letters and not bullet and ((ratio>.84 and len(text)<145 and (not label or text.rstrip().endswith(':'))) or first_bold and len(prefix)>=3 and standalone_tail)
  lead=letters and not heading and not bullet and (label or first_bold and ratio>.48)
  ordered=sorted(row['words'],key=lambda w:w['x0']);body_x=box[0]
  if bullet:
   first=ordered[0];first_text=''.join(glyph(c) for c in first['chars']).strip();mark=BULLET.match(first_text)
   if (re.fullmatch(r'(?:\d+|[a-z])[.)]|[•▪◦●○o–-]',first_text) or mark and len(mark[0])>=len(first_text)) and len(ordered)>1:body_x=ordered[1]['x0']
   else:
    nonmarker=[c for c in first['chars'] if glyph(c).isalnum()]
    body_x=min((c['x0'] for c in nonmarker),default=box[0]+9)
  lines.append({'runs':runs,'text':text,'box':box,'bullet':bullet,'heading':heading,'lead':lead,'label':label,'body_x':body_x})
 out=[];current=None
 for line in lines:
  box=line['box'];gap=box[1]-(current['_last'][3] if current else 0)
  if line['heading']:
   current=None;out.append({'type':'heading','runs':line['runs'],'sourceLines':[[round(v,2) for v in box]]});continue
  # Wrapped list lines align with the *text*, not the bullet marker. Returning
  # to the outer margin closes the list item. Never compare with a42pt tolerance.
  aligned=current and (abs(box[0]-current['_body_x'])<=4 or current['type']=='paragraph' and abs((box[0]+box[2]-current['_last'][0]-current['_last'][2])/2)<=4)
  # Emphasis at the start of a hanging-indent wrap is still owned by its list.
  lead_break=line['lead'] and not (current and current['type']=='list-item' and aligned and not line['label'])
  continuation=current and not line['bullet'] and not line['label'] and not lead_break and -2<gap<6 and aligned
  if continuation:
   current['runs'].append({'t':' '});current['runs'].extend(line['runs']);current['_last']=box;current['sourceLines'].append([round(v,2) for v in box])
  else:
   current={'type':'list-item' if line['bullet'] else 'paragraph','runs':line['runs'],'sourceLines':[[round(v,2) for v in box]],'_last':box,'_body_x':line['body_x']}
   if line['lead']:current['style']='lead'
   if line['bullet']:
    indent=max(0,box[0]-(base_x if base_x is not None else min(l['box'][0] for l in lines)))
    current['sourceIndent']=round(indent,2);current['listDepth']=min(4,round(indent/18))
   out.append(current)
 for b in out:b.pop('_last',None);b.pop('_body_x',None)
 return out

"""Export Folio's code-native SVG mark as home-screen PNGs (requires Pillow)."""
from pathlib import Path
import re,xml.etree.ElementTree as ET
from PIL import Image,ImageDraw,ImageColor
root=Path(__file__).resolve().parents[1]/'folio'
svg=ET.parse(root/'favicon.svg').getroot();ns='{http://www.w3.org/2000/svg}'
def path_points(d):
 tokens=re.findall(r'[MLCHVZ]|-?\d*\.?\d+',d);i=0;paths=[];points=[];at=(0,0)
 while i<len(tokens):
  command=tokens[i];i+=1
  if command=='M':
   if points:paths.append((points,False))
   at=(float(tokens[i]),float(tokens[i+1]));i+=2;points=[at]
  elif command=='L':at=(float(tokens[i]),float(tokens[i+1]));i+=2;points.append(at)
  elif command=='H':at=(float(tokens[i]),at[1]);i+=1;points.append(at)
  elif command=='V':at=(at[0],float(tokens[i]));i+=1;points.append(at)
  elif command=='C':
   nums=list(map(float,tokens[i:i+6]));i+=6;a=at;b=nums[:2];c=nums[2:4];z=nums[4:6]
   for step in range(1,41):
    t=step/40;u=1-t;points.append(tuple(u**3*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t**3*z[k]for k in range(2)))
   at=tuple(z)
  elif command=='Z':paths.append((points,True));points=[]
  else:raise ValueError(command)
 if points:paths.append((points,False))
 return paths
for size,name in [(32,'favicon-32.png'),(180,'apple-touch-icon.png'),(192,'icon-192.png'),(512,'icon-512.png')]:
 n=size*4;s=n/64;image=Image.new('RGB',(n,n));pix=image.load();a=(82,120,239);b=(36,74,183)
 for y in range(n):
  for x in range(n):
   t=(x+y)/(2*(n-1));pix[x,y]=tuple(round(a[k]*(1-t)+b[k]*t)for k in range(3))
 draw=ImageDraw.Draw(image)
 for path in svg.findall(ns+'path'):
  for pts,closed in path_points(path.attrib['d']):
   pts=[(x*s,y*s)for x,y in pts];fill=path.get('fill','none');stroke=path.get('stroke');width=float(path.get('stroke-width','1'))*s
   if fill!='none':draw.polygon(pts,fill=fill)
   if stroke:
    draw.line(pts+[pts[0]]if closed else pts,fill=stroke,width=round(width),joint='curve')
    if path.get('stroke-linecap')=='round':
     for x,y in pts:draw.ellipse([x-width/2,y-width/2,x+width/2,y+width/2],fill=stroke)
 image.resize((size,size),Image.Resampling.LANCZOS).save(root/name)
 print(name)

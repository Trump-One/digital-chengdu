import xml.etree.ElementTree as ET,json,math
from pathlib import Path
root=ET.parse('public/geodata/osm-source.osm').getroot();lat0,lon0=30.54930,104.0640
nodes={n.attrib['id']:n for n in root.findall('node')}
def position(n):return [round((float(n.attrib['lon'])-lon0)*111320*math.cos(math.radians(lat0)),2),round(-(float(n.attrib['lat'])-lat0)*111320,2)]
def clip(a,b):
 x,y=a;dx,dy=b[0]-x,b[1]-y;t0,t1=0,1
 for p,q in [(-dx,x+320),(dx,320-x),(-dy,y+250),(dy,250-y)]:
  if p==0:
   if q<0:return None
  else:
   t=q/p
   if p<0:t0=max(t0,t)
   else:t1=min(t1,t)
 if t0>t1:return None
 return [[round(x+t0*dx,2),round(y+t0*dy,2)],[round(x+t1*dx,2),round(y+t1*dy,2)]]
buildings=[];roads=[];greens=[]
for w in root.findall('way'):
 tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')};p=[position(nodes[n.attrib['ref']]) for n in w.findall('nd') if n.attrib['ref'] in nodes]
 if len(p)<2:continue
 center=[sum(a[0] for a in p[:-1])/max(1,len(p)-1),sum(a[1] for a in p[:-1])/max(1,len(p)-1)]
 if 'building' in tags and len(p)>=4 and abs(center[0])<310 and abs(center[1])<240:
  levels=None;source='示范高度 · 待核实';height=24
  try:
   if 'height' in tags:height=float(tags['height'].replace('m','').strip());source='开放地图标注'
   elif 'building:levels' in tags:levels=int(tags['building:levels']);height=levels*3.2;source='由开放地图楼层数估算'
  except ValueError:pass
  buildings.append(dict(id='way-'+w.attrib['id'],name=tags.get('name',tags.get('addr:housename','未命名建筑')),kind=tags['building'],points=p,center=[round(v,2) for v in center],height=height,heightSource=source,levels=levels,sourceUrl='https://www.openstreetmap.org/way/'+w.attrib['id'],tags=tags))
 if 'highway' in tags and tags['highway'] not in ['proposed','construction']:
  width=7 if tags['highway'] in ['tertiary','secondary','primary'] else 4
  if tags['highway'] in ['footway','path','steps','pedestrian']:width=2.5
  try:
   if 'width' in tags:width=float(tags['width'].replace('m',''))
   elif 'lanes' in tags:width=float(tags['lanes'])*3.5
  except ValueError:pass
  for i in range(1,len(p)):
   pair=clip(p[i-1],p[i])
   if pair:roads.append(dict(id='way-'+w.attrib['id']+'-'+str(i),name=tags.get('name',''),kind=tags['highway'],width=width,points=pair))
 if (tags.get('landuse') in ['grass','forest','meadow'] or tags.get('leisure') in ['garden','park']) and len(p)>3 and abs(center[0])<400 and abs(center[1])<300:greens.append(dict(points=p))
buildings.sort(key=lambda b:(b['name']=='未命名建筑',b['center'][0]))
source_date=root.find('meta').attrib.get('osm_base','unknown') if root.find('meta') is not None else max((w.attrib.get('timestamp','') for w in root.findall('way')),default='unknown')
d=dict(center=dict(lat=lat0,lon=lon0),bounds=[-320,-250,320,250],sourceDate=source_date,fetchedDate='2026-10-13',buildings=buildings,roads=roads,greens=greens,route=[[-185,20],[0,20],[215,20]],areaLabel='天府三街东段 · 约 400 米步行路线')
Path('public/geodata/street.json').write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')))
print('buildings',len(buildings),'road segments',len(roads),'greens',len(greens),'timestamp',source_date)
for b in buildings:print(b['id'],b['name'],b['height'],b['heightSource'],b['center'])

"""Author the room network. Run python tools/build_world.py after editing."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def door(id,x,y,target,entry,label,**kw):return dict(id=id,kind='gate',x=x,y=y,target=target,entry=entry,label=label,**kw)
def npc(id,kind,x,y,label,**kw):return dict(id=id,kind=kind,x=x,y=y,label=label,**kw)
def foe(x,kind='sentinel',floor=452,left=None,right=None):return dict(x=x,type=kind,floor=floor,left=x-100 if left is None else left,right=x+100 if right is None else right)
def zone(id,name,area,width,pos,ground=None,platforms=None,**kw):
    return dict(id=id,name=name,area=area,width=width,top=-80,bottom=540,map=pos,ground=ground or [[0,452,width,100]],platforms=platforms or [],solids=[],hazards=[],enemies=[],interactions=[],spawns={'default':[110,412]},decor=[],tutorials=[],**kw)

rooms=[]
z=zone('wake','THE WAKE / SIGNAL WELL',0,1120,[80,210],platforms=[[265,362,140,20],[455,272,145,20],[660,182,170,20]])
z.update(top=-80,spawns={'default':[110,412],'east':[1000,412],'high':[730,142],'drain':[690,412]},decor=[['arch',340,452,.52]],interactions=[npc('rest-wake','bench',145,425,'SIGNAL ANCHOR'),npc('creature','creature',440,422,'THE WOUNDED'),door('wake-east',1060,417,'procession','west','PILGRIM CAUSEWAY'),door('wake-high',745,147,'belfry','low','CLIMB THE BELFRY'),door('wake-drain',700,417,'cistern','west','DESCEND TO THE CISTERN')],tutorials=[dict(x=250,y=315,text='SPACE / JUMP    W + J / RISING CUT'),dict(x=740,y=95,text='AN UPPER ROAD WAITS')])
rooms.append(z)
z=zone('belfry','THE BELFRY / BROKEN ASCENT',0,970,[80,70],platforms=[[210,355,140,20],[335,255,165,20],[570,130,140,20],[570,-85,150,20],[335,-195,155,20],[570,-360,230,22]])
z.update(top=-550,solids=[[345,-360,28,590],[520,-490,28,740]],spawns={'default':[120,412],'low':[120,412],'high':[720,-400]},enemies=[foe(690,'drone',160,580,820)],interactions=[door('belfry-low',65,417,'wake','high','RETURN TO THE WELL'),door('belfry-high',730,-395,'archive','west','THE GLASS ARCHIVE'),npc('belfry-cache','cache',635,-120,'A RESONANCE VESSEL')],decor=[['spire',820,452,.55]],tutorials=[dict(x=435,y=320,text='HOLD TOWARD A WALL TO SLIDE'),dict(x=435,y=292,text='SPACE / WALL JUMP — THEN TURN'),dict(x=445,y=-270,text='WALL JUMPS RESTORE YOUR AIR DASH')])
rooms.append(z)
z=zone('cistern','THE CISTERN / HOLLOW ROOTS',0,1360,[175,350],ground=[[0,330,310,215],[1140,330,220,215]],platforms=[[345,300,90,20],[1000,270,100,20]])
z.update(spawns={'default':[90,290],'west':[90,290],'east':[1270,290]},hazards=[[310,474,830,50]],pogo=[[500,407,25,25],[670,365,25,25],[840,400,25,25]],enemies=[foe(635,'drone',365,540,730),foe(970,'drone',350,870,1060)],interactions=[door('cistern-west',70,295,'wake','drain','RETURN TO THE WELL'),npc('sluice-lever','lever',1210,295,'OPEN THE SLUICE',flag='sluice'),door('cistern-east',1300,295,'procession','low','THE LOWER CAUSEWAY',requires='sluice'),npc('cistern-cache','cache',1040,235,'A RESONANCE VESSEL')],decor=[['arch',1190,330,.38]],tutorials=[dict(x=180,y=235,text='HOLD S + J IN THE AIR / POGO'),dict(x=700,y=245,text='BOUNCES REFRESH JUMP AND AIR DASH')])
rooms.append(z)
z=zone('archive','THE GLASS ARCHIVE / UNFILED LIVES',0,1160,[290,70],platforms=[[220,355,120,20],[420,260,170,20],[740,170,150,20]])
z.update(spawns={'default':[100,412],'west':[100,412],'east':[1050,412],'memory':[810,130]},interactions=[door('archive-west',60,417,'belfry','high','THE BELFRY'),npc('archive-echo','body',480,227,'THE SELF WHO WAITED',loop='unknown'),npc('archive-lever','lever',980,417,'UNLOCK THE ARCHIVE LIFT',flag='archive-lift'),door('archive-east',1100,417,'procession','high','THE ARCHIVE LIFT',requires='archive-lift'),door('archive-memory',805,135,'lungs','archive','THE BREATHING PASSAGE',memory='defiance'),npc('archive-rest','bench',600,425,'SIGNAL ANCHOR')],decor=[['arch',490,452,.58],['spire',950,452,.4]],tutorials=[dict(x=785,y=80,text='THE DOOR EXISTS IF YOU REMEMBER OPENING IT')])
rooms.append(z)
z=zone('procession','PILGRIM CAUSEWAY / THE DIVIDED ROAD',0,1590,[290,210],platforms=[[220,352,140,20],[415,252,145,20],[620,152,170,20],[850,252,150,20],[1060,352,140,20]])
z.update(spawns={'default':[100,412],'west':[100,412],'east':[1460,412],'high':[700,112],'low':[420,412]},enemies=[foe(560),foe(980,'lancer'),foe(1220,'drone',265,1140,1340)],interactions=[door('procession-west',60,417,'wake','east','THE SIGNAL WELL'),door('procession-high',700,117,'archive','east','THE ARCHIVE LIFT',requires='archive-lift'),door('procession-low',400,417,'cistern','east','THE OPEN SLUICE',requires='sluice'),npc('door','door',1180,407,'THE FORBIDDEN DOOR'),door('procession-east',1530,417,'king','west','THE COURT OF CERTAINTY')],decor=[['arch',780,452,.55],['spire',1380,452,.52]],tutorials=[dict(x=580,y=330,text='F / DEFLECT → BUILD RESONANCE'),dict(x=1020,y=315,text='RED ATTACK / JUMP OR RELEASE A CHARGED F'),dict(x=1450,y=315,text='Q / IMPRINT A NEARBY FOE, THEN Q / DETONATE')])
rooms.append(z)
z=zone('king','THE COURT / A FUTURE WITHOUT CHOICE',0,1280,[480,210],platforms=[[375,342,125,20],[950,342,125,20]])
z.update(spawns={'default':[105,412],'west':[105,412],'east':[1170,412]},boss='king',arena=[265,1120],interactions=[door('king-west',65,417,'procession','east','THE CAUSEWAY'),door('king-east',1210,417,'cradle','west','DESCEND TO THE CRADLE',requires='king')],decor=[['arch',720,452,.8],['spire',1080,452,.6]],tutorials=[dict(x=130,y=305,text='HOLD H / SPEND RESONANCE TO MEND')])
rooms.append(z)
z=zone('cradle','THE CRADLE / THREADS OF MERCY',1,1470,[670,210],platforms=[[235,352,125,20],[430,252,140,20],[630,152,160,20],[960,352,160,20]])
z.update(spawns={'default':[110,412],'west':[110,412],'east':[1330,412],'high':[700,112]},enemies=[foe(1000,'lancer')],interactions=[door('cradle-west',65,417,'king','east','THE COURT'),npc('keeper','keeper',400,412,'THE KEEPER'),npc('cradle-rest','bench',820,425,'SIGNAL ANCHOR'),door('cradle-high',710,117,'lungs','low','THE SUSPENDED LUNGS'),door('cradle-east',1400,417,'mother','west','THE IMMORTAL CHAMBER')],decor=[['arch',490,452,.5],['spire',1280,452,.48]])
rooms.append(z)
z=zone('lungs','THE SUSPENDED LUNGS / CHOIR MACHINERY',1,1250,[670,70],platforms=[[180,345,140,20],[360,230,160,20],[650,100,180,20],[960,225,130,20]])
z.update(top=-320,solids=[[550,-100,30,400],[750,-260,30,300]],spawns={'default':[100,412],'low':[100,412],'archive':[1100,185],'east':[1110,412]},enemies=[foe(690,'drone',60,615,875),foe(920,'sentinel')],interactions=[door('lungs-low',60,417,'cradle','high','RETURN TO THE CRADLE'),npc('echo','echo',440,195,'AN ABANDONED SELF'),door('lungs-archive',1020,190,'archive','memory','THE BREATHING PASSAGE',memory='defiance'),npc('lungs-lever','lever',1100,417,'RELEASE THE MAINTENANCE LIFT',flag='lung-lift'),door('lungs-east',1190,417,'mother','high','THE MOTHER FROM ABOVE',requires='lung-lift'),npc('lungs-cache','cache',710,65,'A RESONANCE VESSEL')],decor=[['spire',1100,452,.6]])
rooms.append(z)
z=zone('mother','THE MOTHER / A FUTURE WITHOUT END',1,1370,[860,210],platforms=[[360,342,125,20],[930,342,125,20],[170,205,170,20]])
z.update(spawns={'default':[110,412],'west':[110,412],'high':[240,165],'east':[1250,412]},boss='mother',arena=[350,1200],interactions=[door('mother-west',65,417,'cradle','east','THE CRADLE'),door('mother-high',230,170,'lungs','east','THE MAINTENANCE LIFT',requires='lung-lift'),door('mother-east',1300,417,'garden','west','THE LAST GARDEN',requires='mother')],decor=[['arch',770,452,.75]])
rooms.append(z)
z=zone('garden','THE LAST GARDEN / A FIRST MORNING',2,1430,[860,350],platforms=[[260,350,160,20],[540,245,160,20],[930,350,150,20]])
z.update(spawns={'default':[110,412],'west':[110,412],'east':[1300,412],'high':[620,205]},interactions=[door('garden-west',65,417,'mother','east','THE CRADLE'),npc('garden-rest','bench',360,425,'SIGNAL ANCHOR'),door('garden-high',620,210,'observatory','east','THE QUIET OBSERVATORY'),npc('child','child',1110,417,'THE LAST CHILD'),door('garden-east',1370,417,'choir','west','THE CHOIR WAITS',requires='child')],decor=[['arch',630,452,.45],['spire',1310,452,.33]])
rooms.append(z)
z=zone('observatory','THE QUIET OBSERVATORY / ANOTHER WAY HOME',2,1050,[480,350],platforms=[[210,350,150,20],[440,245,160,20]])
z.update(spawns={'default':[900,412],'east':[900,412],'west':[100,412]},interactions=[door('observatory-east',980,417,'garden','high','THE GARDEN'),npc('observatory-echo','body',520,212,'THE SELF WHO REMAINED',loop='older'),npc('well-lever','lever',170,417,'RECONNECT THE SIGNAL WELL',flag='well-link'),door('observatory-west',65,417,'wake','east','THE WAY HOME',requires='well-link'),npc('observatory-cache','cache',740,417,'A RESONANCE VESSEL')],decor=[['spire',790,452,.58]])
rooms.append(z)
z=zone('choir','THE CHOIR / THE ORIGINAL MEMORY',3,1420,[1050,350],platforms=[[320,350,140,20],[610,245,160,20]])
z.update(spawns={'default':[110,412],'west':[110,412]},interactions=[door('choir-west',65,417,'garden','east','THE GARDEN'),npc('choir','choir',1100,340,'REMEMBER THE BEGINNING')],decor=[['spire',420,452,.55],['spire',1290,452,.55]])
rooms.append(z)
# This return gate materializes after the long loop has been opened from beyond.
rooms[0]['interactions'].append(door('wake-return',935,417,'observatory','west','THE LONG WAY HOME',requires='well-link'))

# Rest, movement and safe combat lead into the first decision.
wake=rooms[0]
next(o for o in wake['interactions'] if o['id']=='creature')['x']=900
wake['enemies']=[dict(foe(570,'sentinel',452,520,645),training=True)]
wake['interactions'].append(npc('first-transfer','mirror',1010,417,'THE TRANSFER GLASS'))
wake['tutorials'] += [dict(x=145,y=332,text='E / SIT AT THE SIGNAL ANCHOR'),dict(x=555,y=382,text='THE PRACTICE WARDEN CANNOT TAKE YOUR LAST INTEGRITY')]

# Optional traversal rewards and regional landmarks.
by_id={r['id']:r for r in rooms}
by_id['belfry']['platforms'].append([165,-345,165,20])
by_id['belfry']['interactions'].append(npc('bell-secret','relic',230,-380,'THE BELL KEEPER',story='Before the Choir, this bell rang when someone made a choice. Its clapper is worn down to a thread.'))
by_id['cistern']['platforms'].append([605,235,130,18])
by_id['cistern']['interactions'].append(npc('pogo-secret','relic',670,200,'THE DROWNED ENGINEER',story='The engineer left a note above the flood: machines repeat a command. People can decide to stop.'))
by_id['garden']['platforms'].append([735,160,125,20])
by_id['garden']['interactions'].append(npc('root-secret','relic',800,125,'A SEED FROM OUTSIDE',story='The seed predates the simulation. Someone kept a small possibility of a different world.'))
by_id['procession']['enemies'].append(foe(1050,'sentinel',452,890,1120))

# Remembered choices change the route graph as well as combat.
by_id['cistern']['spawns']['root']=[655,195]
by_id['archive']['spawns']['root']=[700,412]
by_id['cistern']['interactions'].append(door('root-ascent',680,200,'archive','root','THE LIVING ROOT',memory='mercy',blockedBy='fire'))
by_id['archive']['interactions'].append(door('root-descent',710,417,'cistern','root','THE LIVING ROOT',memory='mercy',blockedBy='fire'))
for r in rooms:
    for o in r['interactions']:
        if o.get('memory')=='defiance':o['blockedBy']='obedience'
        if o['id']=='archive-east':o['guard']='betrayal-guard'

data={'version':2,'start':'wake','areas':['THE WAKE','THE CRADLE','THE LAST GARDEN','THE CHOIR'],'rooms':rooms}
(ROOT/'data').mkdir(exist_ok=True)
(ROOT/'data'/'world.json').write_text(json.dumps(data,indent=2),encoding='utf8')
(ROOT/'world-data.js').write_text('/* Generated by tools/build_world.py. */\nwindow.ECHO_WORLD = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf8')
print('Authored',len(rooms),'interconnected rooms.')

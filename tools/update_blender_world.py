"""Add/update the twelve-room map scene while preserving the character scenes.
blender --background models/echo-fall.blend --python tools/update_blender_world.py
"""
import bpy
import json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'data/world.json').read_text(encoding='utf8'))
name='06 MAP / interconnected world'
if name in bpy.data.scenes:
    old=bpy.data.scenes[name]
    for obj in list(old.objects):bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.scenes.remove(old)
s=bpy.data.scenes.new(name)
bpy.context.window.scene=s
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.cycles.use_denoising=True
s.render.resolution_x=1760;s.render.resolution_y=1160;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.film_transparent=False
s.view_settings.view_transform='AgX'
s.world=bpy.data.worlds.new('Network / world');s.world.use_nodes=True
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.022,.038,.057,1)
s.world.node_tree.nodes['Background'].inputs[1].default_value=.8
stone=bpy.data.materials['Ruins / blue slate'];edge=bpy.data.materials['Ruins / worn edges'];signal=bpy.data.materials['Signal / cyan'];rose=bpy.data.materials.get('Cradle / signal') or bpy.data.materials['Wanderer / signal-red scarf'];gold=bpy.data.materials['Ruins / tarnished brass']
mats=[stone,bpy.data.materials['Choir / violet stone'],bpy.data.materials['Garden / oxidized stone'],bpy.data.materials['Choir / violet stone']]

def box(name,loc,dim,mat,coll):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj=bpy.context.object;obj.name=name;obj.dimensions=dim
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.location=loc;obj.data.materials.append(mat)
    for c in list(obj.users_collection):c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj

for i,z in enumerate(data['rooms']):
    ox=(i%4)*20;oy=(i//4)*16
    coll=bpy.data.collections.new('NETWORK / '+z['id']);s.collection.children.link(coll)
    coll['game_zone_id']=z['id'];coll['game_area_index']=z['area'];coll['game_width']=z['width'];coll['game_origin_x']=ox;coll['game_origin_y']=oy
    for kind,key in [('floor','ground'),('platform','platforms'),('wall','solids')]:
        for n,(x,y,w,h) in enumerate(z[key]):
            obj=box(f'{kind} / {z["id"]} / {n:02d}',(ox+(x+w/2)/100,oy,(452-y-h/2)/100),(w/100,1.0,h/100),mats[z['area']] if kind=='floor' else edge,coll)
            obj['role']='collision';obj['game_rect']=[x,y,w,h]
    for x,y,w,h in z['hazards']:
        obj=box('hazard / '+z['id'],(ox+(x+w/2)/100,oy,(452-y-h/2)/100),(w/100,.8,h/100),rose,coll);obj['role']='hazard'
    for o in z['interactions']:
        if o['kind']=='gate':
            x=ox+o['x']/100;floor=(452-o['y']-35)/100
            for dx in [-.24,.24]:box('portal / '+o['id'],(x+dx,oy+.2,floor+.45),(.07,.15,.9),signal if not o.get('requires') and not o.get('memory') else gold,coll)
            obj=box('portal lintel / '+o['id'],(x,oy+.2,floor+.92),(.56,.15,.08),signal,coll)
            obj['destination']=o['target'];obj['entry']=o['entry'];obj['role']='route marker'
        elif o['kind']=='bench':
            obj=box('rest / '+o['id'],(ox+o['x']/100,oy,(452-o['y'])/100),(.6,.3,.12),signal,coll);obj['role']='rest marker'
    for n,e in enumerate(z['enemies']):
        obj=box('enemy / '+z['id']+str(n),(ox+e['x']/100,oy,(452-e['floor'])/100+.2),(.22,.3,.4),rose,coll);obj['role']='enemy marker';obj['archetype']=e['type']
    text=bpy.data.curves.new(z['name']+' / title','FONT');text.body=z['name'].split(' / ')[0];text.size=.39;text.extrude=.001;text.materials.append(signal)
    obj=bpy.data.objects.new(text.name,text);coll.objects.link(obj);obj.location=(ox,oy-1.5,-.02)
    # Show the room's signature architectural asset behind the playable plane.
    for key,x,y,scale in z['decor']:
        source=bpy.data.scenes['02 RUIN / pointed arch' if key=='arch' else '03 RUIN / choir spire']
        model_scale=scale*.8
        for original in source.objects:
            if original.type!='MESH':continue
            obj=original.copy();obj.data=original.data;coll.objects.link(obj)
            obj.location=Vector((ox+x/100,oy+1.2,(452-y)/100))+original.location*model_scale;obj.scale=original.scale*model_scale

camdata=bpy.data.cameras.new('Network / overview camera');cam=bpy.data.objects.new(camdata.name,camdata);s.collection.objects.link(cam)
cam.location=(38,-47,71);target=Vector((38,16,2.2));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=83;s.camera=cam
for x,y,power in [(15,8,16000),(58,28,16000),(38,-4,9000)]:
    ld=bpy.data.lights.new('Network / softbox','AREA');ld.energy=power;ld.size=28;obj=bpy.data.objects.new(ld.name,ld);s.collection.objects.link(obj);obj.location=(x,y,26)
s['coordinate_system']='100 pixels per unit. Subtract collection game_origin_x before converting X. Z=(452-y)/100.'
s['source']='data/world.json; doors, combat encounters and secrets are authored there.'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/echo-fall.blend'))
s.render.filepath=str(ROOT/'assets/map-preview.png');bpy.ops.render.render(write_still=True)
print('NETWORK_MODEL_READY',flush=True)

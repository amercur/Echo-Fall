"""Export the edited .blend without regenerating or overwriting its models.

blender --background models/echo-fall.blend --python tools/export_blender_assets.py
Then: python tools/pack_sprites.py
"""
import bpy
import json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'


def anchor(scene,point=(0,0,0)):
    bpy.context.window.scene=scene
    # Evaluate the newly active scene before reading its camera matrix.
    scene.frame_set(scene.frame_current)
    bpy.context.view_layer.update()
    p=world_to_camera_view(scene,scene.camera,Vector(point))
    return [round(p.x*scene.render.resolution_x,3),round((1-p.y)*scene.render.resolution_y,3)]


def export(render=True):
    player=bpy.data.scenes['01 WANDERER / animated source']
    bpy.context.window.scene=player
    player.frame_set(1)
    manifest={'generator':'Blender / edited source export','player':{'file':'assets/wanderer.png','cell':192,'columns':4,'anchor':anchor(player),'scale':.34,'states':{'idle':[0,1,2,3],'run':[4,5,6,7,8,9,10,11],'jump':[12],'attack':[13,14,15]}}}
    assets=[('arch','02 RUIN / pointed arch','ruin-arch.png',(0,0,0)),('spire','03 RUIN / choir spire','choir-spire.png',(0,0,0)),('ledge','04 RUIN / floating ledge','ruin-ledge.png',(0,0,.10))]
    for key,name,file,point in assets:
        s=bpy.data.scenes[name]
        manifest[key]={'file':'assets/'+file,'size':[s.render.resolution_x,s.render.resolution_y],'anchor':anchor(s,point)}
    map_scene=bpy.data.scenes.get('06 MAP / interconnected world') or bpy.data.scenes['05 MAP / four-area blockout']
    bpy.context.window.scene=map_scene
    bpy.context.view_layer.update()
    layout=[]
    for coll in sorted([c for c in map_scene.collection.children if 'game_area_index' in c],key=lambda c:c['game_area_index']):
        floors=[];platforms=[];solids=[]
        for obj in coll.objects:
            if obj.get('role')!='collision':continue
            if any(abs(v)>.001 for v in obj.rotation_euler):
                raise ValueError('Collision blocks must stay axis-aligned: '+obj.name)
            w,h=round(obj.dimensions.x*100),round(obj.dimensions.z*100)
            x=round((obj.location.x-coll.get('game_origin_x',0))*100-w/2)
            y=round(452-obj.location.z*100-h/2)
            if w<=0 or h<=0:raise ValueError('Collision block has zero size: '+obj.name)
            (floors if obj.name.startswith('floor') else solids if obj.name.startswith('wall') else platforms).append([x,y,w,h])
        index=coll['game_area_index']
        floors.sort();platforms.sort()
        width=int(coll.get('game_width',max(r[0]+r[2] for r in floors)))
        layout.append({'id':coll.get('game_zone_id',''),'name':coll.name.split(' / ',1)[-1],'width':width,'ground':floors,'platforms':platforms,'solids':solids})
    (ROOT/'models'/'map-layout.json').write_text(json.dumps(layout,indent=2),encoding='utf8')
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
    if render:
        def image(s,path):
            bpy.context.window.scene=s;s.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        for f in range(1,17):
            player.frame_set(f);image(player,OUT/'frames'/('wanderer-%02d.png'%(f-1)))
        for _,name,file,_ in assets:image(bpy.data.scenes[name],OUT/file)
        image(map_scene,OUT/'map-preview.png')
    print('ECHO_EXPORT_COMPLETE',flush=True)


if __name__=='__main__':
    import sys
    export(render='--layout-only' not in sys.argv)

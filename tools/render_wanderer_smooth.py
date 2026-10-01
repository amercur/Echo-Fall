"""Render cyclic in-between poses from the editable Wanderer FK rig.
Run Blender with models/echo-fall.blend loaded; then pack_wanderer_smooth.py.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'assets'/'smooth-frames';out.mkdir(exist_ok=True)
s=bpy.data.scenes['01 WANDERER / animated source'];bpy.context.window.scene=s;s.frame_set(1)
s.cycles.samples=12
rig=[o for o in s.objects if o.name.startswith('RIG /')]
poses={}
for frame in range(1,17):
    s.frame_set(frame);poses[frame]={o.name:(o.location.copy(),o.rotation_euler.copy()) for o in rig}
samples=[(i,i,0) for i in range(1,5)]
samples += [(5+i//2,5+(i//2+1)%8,(i%2)*.5) for i in range(16)]
samples += [(13,13,0),(13,13,0)]
samples += [(14+min(1,int(i*2/7)),15+min(1,int(i*2/7)),min(1,i*2/7-min(1,int(i*2/7)))) for i in range(8)]
samples += [(14,15,.5),(14,15,.7)]
for index,(a,b,t) in enumerate(samples):
    s.frame_set(a)
    for o in rig:
        la,ra=poses[a][o.name];lb,rb=poses[b][o.name]
        o.location=la.lerp(lb,t);o.rotation_euler=Vector(ra).lerp(Vector(rb),t)
    if index>=30:
        for o in rig:
            if o.name=='RIG / near shoulder':o.rotation_euler.y=-1.3
            if o.name=='RIG / near elbow':o.rotation_euler.y=-.7
    bpy.context.view_layer.update();s.render.filepath=str(out/f'wanderer-{index:02}.png');bpy.ops.render.render(write_still=True)
s.frame_set(1);bpy.context.view_layer.update();p=world_to_camera_view(s,s.camera,Vector((0,0,0)))
meta={'player':{'file':'assets/wanderer-smooth.png','cell':192,'columns':4,'anchor':[round(p.x*192,3),round((1-p.y)*192,3)],'scale':.34,'states':{'idle':list(range(4)),'run':list(range(4,20)),'jump':[20,21],'attack':list(range(22,30)),'guard':[30,31]}}}
(ROOT/'assets'/'wanderer-smooth.json').write_text(json.dumps(meta,indent=2));print('WANDERER_INBETWEENS_READY',flush=True)

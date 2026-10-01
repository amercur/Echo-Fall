"""Blender CLI: create an editable, animated bestiary and transparent sprite poses.
Independent source file; does not overwrite the Wanderer or map models.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'/'bestiary-frames'; OUT.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name,color,metal=0,emit=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.38
    p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
    return m
M={k:mat(k,c,metal,emit) for k,c,metal,emit in [
    ('obsidian',(.035,.055,.08),.65,0),('steel',(.23,.34,.43),.7,0),
    ('ivory',(.76,.79,.72),.3,0),('brass',(.68,.42,.16),.65,0),
    ('wine',(.25,.035,.095),.15,0),('veil',(.22,.12,.26),.25,0),
    ('cyan',(.13,.85,.83),.35,2),('rose',(.95,.13,.31),.3,2),
    ('gold',(1,.65,.23),.3,2),('glass',(.45,.78,.83),.75,0)]}

def pivot(name,loc,parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);o.location=loc;o.parent=parent;return o
def cube(name,loc,size,material,parent=None,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name=name;o.parent=parent;o.location=loc
    o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[material])
    if bevel:
        mod=o.modifiers.new('Worn machined edges','BEVEL');mod.width=bevel;mod.segments=2
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
def orb(name,loc,size,material,parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=name;o.parent=parent;o.location=loc;o.scale=size;o.data.materials.append(M[material]);return o
def cone(name,loc,r1,r2,depth,material,parent=None):
    bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=r1,radius2=r2,depth=depth);o=bpy.context.object;o.name=name;o.parent=parent;o.location=loc;o.data.materials.append(M[material]);return o
def ring(name,loc,r,material,parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=.035,major_segments=40,minor_segments=6,rotation=(math.pi/2,0,0))
    o=bpy.context.object;o.name=name;o.parent=parent;o.location=loc;o.data.materials.append(M[material]);return o

manifest={}
for kind in ['sentinel','lancer','drone','king','mother']:
    s=bpy.data.scenes.new('BESTIARY / '+kind.upper());bpy.context.window.scene=s
    s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=True
    s.render.resolution_x=s.render.resolution_y=256;s.render.resolution_percentage=100
    s.render.film_transparent=True;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA'
    s.world=bpy.data.worlds.new(kind+' atmosphere');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.23,.32,1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    s.view_settings.view_transform='AgX'
    target=Vector((.18,0,1.45));camdata=bpy.data.cameras.new(kind+' camera');cam=bpy.data.objects.new(kind+' camera',camdata);s.collection.objects.link(cam)
    cam.location=(.35,-10,3.1);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=4.9;s.camera=cam
    for name,loc,color,energy in [('Moon',(-3,-4,6),(.7,.85,1),650),('Rim',(3,2,5),(.2,1,.85),900),('Warm',(4,-2,3),(1,.5,.35),250)]:
        l=bpy.data.lights.new(name,'AREA');l.energy=energy;l.color=color;l.shape='DISK';l.size=4;o=bpy.data.objects.new(name,l);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    root=pivot(kind+' / body',(0,0,0));parts={};signal='gold' if kind in ['lancer','king'] else 'rose' if kind=='mother' else 'cyan'
    if kind=='drone':
        orb('Suspended ceramic eye',(0,0,1.25),(.44,.25,.44),'ivory',root)
        orb('Optical socket',(0,-.24,1.25),(.30,.06,.30),'obsidian',root)
        orb('Signal iris',(0,-.30,1.25),(.16,.04,.19),'cyan',root)
        ring('Inner gyroscope',(0,0,1.25),.57,'brass',root)
        for sign in [-1,1]:
            p=pivot('Articulated wing',(sign*.47,0,1.25),root);parts['wing'+str(sign)]=p
            for n in range(3):
                plate=cube('Feather / '+str(n),(sign*(.22+n*.17),0,-n*.12),(.15,.18,.72-n*.12),'steel',p);plate.rotation_euler.y=sign*.4
                cube('Feather light',(sign*(.22+n*.17),-.1,.12-n*.1),(.045,.03,.27),'cyan',p,.01)
        cone('Pendulum spike',(0,0,.48),0,.13,.48,'brass',root)
    else:
        robe=kind=='mother';royal=kind=='king'
        cone('Layered mantle',(0,.12,1.25),.56 if robe or royal else .38,.24,1.35,'veil' if robe else 'wine',root)
        for n in range(7):
            a=n*math.pi/3.5;plate=cube('Mantle rib '+str(n),(math.sin(a)*.33,math.cos(a)*.22,1.02),(.07,.05,.85),'brass' if royal else 'steel',root,.015);plate.rotation_euler.y=math.sin(a)*.17
        cube('Breastplate',(0,-.08,1.63),(.65,.40,.59),'ivory' if robe else 'steel',root)
        cube('Chest inlay',(0,-.302,1.65),(.1,.035,.37),signal,root,.012)
        for sign in [-1,1]:
            leg=pivot('Hip '+str(sign),(sign*.18,0,.85),root);parts['leg'+str(sign)]=leg
            cube('Greave',(0,0,-.31),(.23,.24,.62),'steel',leg);cube('Boot',(sign*.025,-.09,-.72),(.27,.39,.21),'obsidian',leg)
            cube('Knee seal',(0,-.15,-.17),(.18,.08,.18),'brass',leg)
            arm=pivot('Shoulder '+str(sign),(sign*.40,0,1.8),root);parts['arm'+str(sign)]=arm
            orb('Pauldron',(0,0,-.04),(.27,.27,.22),'ivory' if robe else 'brass' if royal else 'steel',arm)
            cube('Upper arm',(0,0,-.28),(.18,.22,.46),'obsidian',arm)
            cube('Vambrace',(0,-.025,-.55),(.25,.27,.36),'ivory' if robe else 'steel',arm)
            orb('Joint rivet',(0,-.15,-.39),(.065,.035,.065),'brass',arm)
        head=pivot('Neck',(0,0,2.04),root);parts['head']=head
        cube('Porcelain death mask',(0,-.02,.15),(.43,.36,.47),'ivory',head,.08)
        cube('Black visor',(0,-.213,.18),(.36,.025,.095),'obsidian',head,.015)
        for sign in [-1,1]:cube('Eye slit',(sign*.095,-.231,.18),(.095,.02,.025),signal,head,.006)
        cube('Mask ridge',(0,-.233,.025),(.05,.05,.15),'brass',head,.012)
        if kind=='sentinel':
            cone('Crest',(0,.02,2.66),.20,0,.48,'wine',root)
            shield=cube('Forearm shield',(-.08,-.21,-.50),(.47,.14,.65),'steel',parts['arm-1']);shield.rotation_euler.y=-.2
            cube('Shield glyph',(-.08,-.29,-.5),(.07,.035,.4),'cyan',parts['arm-1'],.01)
        if kind=='lancer':
            for sign in [-1,1]:cone('Helm horn',(sign*.19,0,2.62),.075,0,.58,'brass',root)
            arm=parts['arm1'];cube('Lance haft',(.12,0,-.26),(.055,.06,2.7),'brass',arm,.01)
            cone('Lance spearhead',(.12,0,1.25),.16,0,.55,'glass',arm)
        elif not robe:
            arm=parts['arm1'];cube('Blade grip',(0,0,-.8),(.10,.13,.28),'obsidian',arm)
            cube('Crossguard',(0,0,-.95),(.39,.13,.08),'brass',arm)
            blade=cone('Execution blade',(0,0,-1.37),0,.16,.79,'glass',arm);blade.scale.y=.3
        if royal:
            ring('Crown band',(0,0,2.53),.27,'brass',root).rotation_euler=(0,0,0)
            for n in range(5):cone('Crown tooth',((n-2)*.12,-.02,2.77-abs(n-2)*.045),.065,0,.37,'gold',root)
        if robe:
            ring('Broken preservation halo',(0,.17,2.33),.64,'gold',root)
            for sign in [-1,1]:
                for n in range(3):
                    bone=cube('Preservation tendril',(sign*(.56+n*.16),.11,1.7-n*.15),(.065,.07,1.0-n*.12),'brass',root,.015);bone.rotation_euler.y=sign*(.6+n*.18)
                    orb('Memory vessel',(sign*(.86+n*.20),.10,1.95-n*.15),(.10,.12,.17),'rose',root)
    base={o:(o.location.copy(),o.rotation_euler.copy()) for o in [root,*parts.values()]}
    for frame in range(8):
        for o,(loc,rot) in base.items():o.location=loc.copy();o.rotation_euler=rot.copy()
        phase=frame*math.pi/2
        if frame<4:
            root.location.z=.035*math.cos(phase*2)
            for sign in [-1,1]:
                if 'leg'+str(sign) in parts:parts['leg'+str(sign)].rotation_euler.y=sign*math.sin(phase)*.34;parts['arm'+str(sign)].rotation_euler.y=-sign*math.sin(phase)*.22
        elif kind!='drone':
            root.rotation_euler.y=[-.15,-.22,.24,.1][frame-4]
            parts['arm1'].rotation_euler.y=[-1.0,-1.4,-2.2,-.55][frame-4] if kind!='lancer' else [.2,.45,1.5,.4][frame-4]
            parts['arm-1'].rotation_euler.y=[-.35,-.5,-.7,-.2][frame-4]
            if kind=='mother':
                for sign in [-1,1]:parts['arm'+str(sign)].rotation_euler.y=sign*[.4,.9,1.4,.6][frame-4]
        if kind=='drone':
            for sign in [-1,1]:parts['wing'+str(sign)].rotation_euler.y=sign*(.17*math.sin(phase)+(.5 if frame in [4,5] else 0))
            root.location.z=.08*math.sin(phase)
        for o in base:o.keyframe_insert(data_path='location',frame=frame+1);o.keyframe_insert(data_path='rotation_euler',frame=frame+1)
        s.frame_set(frame+1);s.render.filepath=str(OUT/f'{kind}-{frame:02}.png');bpy.ops.render.render(write_still=True)
    s.frame_set(1);bpy.context.view_layer.update();p=world_to_camera_view(s,cam,Vector((0,0,0)))
    manifest[kind]={'file':f'assets/{kind}.png','cell':256,'columns':4,'anchor':[round(p.x*256,3),round((1-p.y)*256,3)],'scale':.34 if kind not in ['king','mother'] else .65,'states':{'walk':[0,1,2,3],'tell':[4,5],'strike':[6],'recover':[7]}}
    s.frame_start=1;s.frame_end=8;s.render.fps=12
    print('BESTIARY_READY '+kind,flush=True)
(ROOT/'assets'/'bestiary.json').write_text(json.dumps(manifest,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'bestiary.blend'))

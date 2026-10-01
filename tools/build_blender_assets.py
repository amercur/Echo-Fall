"""Run with Blender: blender --background --python tools/build_blender_assets.py

Creates editable scenes, an animated low-poly Wanderer, modular ruins, and the
four game areas at 100 game pixels per Blender unit. No external dependencies.
"""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
FRAMES = OUT / 'frames'
MODELS = ROOT / 'models'
for folder in (OUT, FRAMES, MODELS):
    folder.mkdir(parents=True, exist_ok=True)
random.seed(17)
bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, rgb, metal=0.0, rough=.65, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*rgb, 1)
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = rough
    if emission:
        node.inputs['Emission Color'].default_value = (*rgb, 1)
        node.inputs['Emission Strength'].default_value = emission
    return mat


M = {
    'armor': material('Wanderer / weathered blue ceramic', (.23, .36, .43), .45, .4),
    'ivory': material('Wanderer / ivory faceplate', (.67, .78, .77), .35, .35),
    'dark': material('Wanderer / charcoal joints', (.025, .047, .074), .1),
    'cloth': material('Wanderer / midnight mantle', (.045, .11, .17)),
    'red': material('Wanderer / signal-red scarf', (.68, .055, .17), .05, .6),
    'cyan': material('Signal / cyan', (.17, .95, .84), .25, .25, 2.3),
    'blade': material('Wanderer / glass blade', (.54, .84, .87), .7, .22),
    'stone': material('Ruins / blue slate', (.11, .18, .245), .2),
    'edge': material('Ruins / worn edges', (.25, .34, .39), .2),
    'deep': material('Ruins / shadowed stone', (.045, .078, .12), .1),
    'gold': material('Ruins / tarnished brass', (.58, .37, .16), .6, .5),
    'moss': material('Ruins / mineral growth', (.095, .29, .245)),
    'rose': material('Cradle / signal', (.75, .10, .29), .1, .4, 1.7),
    'garden': material('Garden / oxidized stone', (.10, .23, .19)),
    'purple': material('Choir / violet stone', (.21, .18, .31), .25),
}


def scene(name, resolution=(384, 512), scale=6, target=(0, 0, 2.5), camera=(6, -15, 6)):
    s = bpy.data.scenes.new(name)
    bpy.context.window.scene = s
    s.render.engine = 'CYCLES'
    s.cycles.samples = 24
    s.cycles.use_denoising = True
    s.cycles.device = 'CPU'
    s.render.resolution_x, s.render.resolution_y = resolution
    s.render.resolution_percentage = 100
    s.render.film_transparent = True
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    s.render.image_settings.color_depth = '8'
    s.render.fps = 12
    s.view_settings.view_transform = 'AgX'
    s.world = bpy.data.worlds.new(name + ' / world')
    s.world.use_nodes = True
    s.world.node_tree.nodes['Background'].inputs[0].default_value = (.11, .17, .24, 1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value = .35
    data = bpy.data.cameras.new(name + ' / orthographic camera')
    cam = bpy.data.objects.new(data.name, data)
    s.collection.objects.link(cam)
    cam.location = camera
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    data.type = 'ORTHO'
    data.ortho_scale = scale
    s.camera = cam
    for name, location, energy, size, color in [
        ('Key / soft moon', (3, -6, 8), 850, 5, (.68, .85, 1)),
        ('Rim / cyan', (-4, 3, 6), 1200, 4, (.25, 1, .86)),
        ('Fill / warm', (6, 2, 5), 600, 4, (1, .48, .40)),
    ]:
        light = bpy.data.lights.new(name, 'AREA')
        light.energy, light.shape, light.size = energy, 'DISK', size
        light.color = color
        obj = bpy.data.objects.new(name, light)
        s.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    return s


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    obj.empty_display_size = .15
    obj.empty_display_type = 'PLAIN_AXES'
    return obj


def box(name, location, dimensions, mat, bevel=.025, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Small worn edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
    return obj


def mesh(name, verts, faces, mat, parent=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def beam(name, a, b, width, depth, mat):
    a, b = Vector(a), Vector(b)
    obj = box(name, (a + b) / 2, (width, depth, (b-a).length), mat)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def anchor(s, point=(0, 0, 0)):
    bpy.context.view_layer.update()
    p = world_to_camera_view(s, s.camera, Vector(point))
    return [round(p.x * s.render.resolution_x, 3), round((1-p.y) * s.render.resolution_y, 3)]


def render(s, path):
    bpy.context.window.scene = s
    s.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


# A hierarchical FK rig is deliberately kept simple and editable.
player_scene = scene('01 WANDERER / animated source', (192, 192), 3.15, (0, 0, 1.10), (6, -13, 4.2))
root = empty('RIG / body root')
root['animation_layout'] = 'Idle 1-4; run 5-12; jump 13; attack 14-16. Facing +X.'
torso = box('Chest / ceramic cuirass', (0, 0, 1.38), (.34, .43, .49), M['armor'], .055, root)
box('Chest / central light', (.176, -.025, 1.4), (.018, .055, .23), M['cyan'], .008, root)
box('Belt', (0, 0, 1.11), (.35, .43, .10), M['dark'], .018, root)
box('Belt / clasp', (.18, -.03, 1.11), (.045, .105, .08), M['gold'], .012, root)
head = empty('RIG / head', (0, 0, 1.85), root)
box('Hood / shell', (-.055, 0, 0), (.45, .50, .46), M['cloth'], .075, head)
box('Mask / porcelain', (.055, -.005, -.015), (.35, .39, .37), M['ivory'], .06, head)
box('Mask / visor recess', (.239, -.005, .025), (.018, .35, .104), M['dark'], .01, head)
box('Mask / unbroken signal', (.25, -.005, .025), (.02, .31, .024), M['cyan'], .005, head)
box('Mask / side seam', (.08, -.205, -.07), (.13, .009, .016), M['dark'], 0, head)
cape = mesh('Mantle / folded low-poly cloth', [(-.19,-.25,1.63),(-.19,.25,1.63),(-.38,-.30,.82),(-.41,.29,.83),(-.54,-.03,.73),(-.35,-.04,1.3)], [(0,2,5),(0,5,1),(1,5,3),(2,4,5),(3,5,4)], M['cloth'], root)
solid = cape.modifiers.new('Cloth thickness', 'SOLIDIFY'); solid.thickness = .015
box('Scarf / collar', (0, 0, 1.64), (.43, .47, .11), M['red'], .03, root)
scarf = empty('RIG / scarf', (-.15, .06, 1.65), root)
mesh('Scarf / trailing ribbon', [(0,-.12,0),(0,.08,0),(-.50,.07,-.025),(-.9,.03,.06),(-.72,-.06,-.08),(-.97,-.05,-.15),(-.42,-.12,-.14)], [(0,1,2,6),(2,3,4,6),(4,5,6)], M['red'], scarf)

hips, knees, arms, elbows = [], [], [], []
for label, side in [('far', .14), ('near', -.14)]:
    hip = empty('RIG / '+label+' hip', (0, side, 1.04), root)
    box(label+' thigh', (0,0,-.21), (.16,.17,.40), M['armor'], .04, hip)
    knee = empty('RIG / '+label+' knee', (0,0,-.43), hip)
    box(label+' knee guard', (.07,0,0), (.12,.19,.14), M['ivory'], .025, knee)
    box(label+' shin', (0,0,-.20), (.13,.16,.36), M['dark'], .025, knee)
    box(label+' greave', (.04,0,-.16), (.14,.18,.22), M['armor'], .018, knee)
    box(label+' boot', (.075,0,-.48), (.29,.21,.17), M['dark'], .026, knee)
    hips.append(hip); knees.append(knee)
for label, side in [('far', .30), ('near', -.30)]:
    arm = empty('RIG / '+label+' shoulder', (0, side, 1.53), root)
    box(label+' pauldron', (0,0,-.055), (.27,.23,.22), M['armor'], .035, arm)
    box(label+' upper arm', (0,0,-.22), (.12,.13,.27), M['dark'], .02, arm)
    elbow = empty('RIG / '+label+' elbow', (0,0,-.35), arm)
    box(label+' bracer', (0,0,-.12), (.17,.18,.25), M['ivory'], .03, elbow)
    box(label+' hand', (0,0,-.28), (.12,.14,.12), M['dark'], .022, elbow)
    arms.append(arm); elbows.append(elbow)
sword = empty('RIG / blade', (0,0,-.30), elbows[1])
sword.rotation_euler.y = -.25
box('Blade / grip', (0,0,-.05), (.07,.07,.19), M['dark'], .012, sword)
box('Blade / crossguard', (0,0,-.14), (.29,.10,.045), M['gold'], .015, sword)
mesh('Blade / tapered glass', [(-.065,0,-.16),(.065,0,-.16),(0,-.038,-.16),(0,.038,-.16),(-.042,0,-.70),(.042,0,-.70),(0,-.024,-.70),(0,.024,-.70),(0,0,-.89)], [(0,2,6,4),(2,1,5,6),(1,3,7,5),(3,0,4,7),(4,6,8),(6,5,8),(5,7,8),(7,4,8)], M['blade'], sword)
box('Blade / signal edge', (0,-.039,-.39), (.02,.012,.43), M['cyan'], 0, sword)

rig = [root, head, scarf, *hips, *knees, *arms, *elbows]
for frame in range(1, 17):
    for obj in rig:
        obj.rotation_euler = (0,0,0)
    root.location.z = 0
    arms[0].rotation_euler.y = .15
    arms[1].rotation_euler.y = -.28
    elbows[1].rotation_euler.y = -.1
    if frame <= 4:
        phase = (frame-1)/4*math.tau
        root.location.z = .015*math.sin(phase)
        head.rotation_euler.y = .025*math.sin(phase)
        scarf.rotation_euler.y = .10*math.sin(phase)
    elif frame <= 12:
        phase = (frame-5)/8*math.tau
        root.rotation_euler.y = .10
        root.location.z = .04*abs(math.cos(phase))
        for i in range(2):
            stride = math.sin(phase+i*math.pi)
            hips[i].rotation_euler.y = stride*.62
            knees[i].rotation_euler.y = max(0, -stride)*.75
            arms[i].rotation_euler.y = -stride*.5 - (0.3 if i else 0)
            elbows[i].rotation_euler.y = -.32
        scarf.rotation_euler.y = -.12 + .13*math.sin(phase)
    elif frame == 13:
        hips[0].rotation_euler.y = .3; knees[0].rotation_euler.y = .9
        hips[1].rotation_euler.y = -.7; knees[1].rotation_euler.y = .8
        arms[0].rotation_euler.y = 1.05; arms[1].rotation_euler.y = -1.0
        scarf.rotation_euler.y = -.3
    else:
        arms[1].rotation_euler.y = [-2.3,-1.5,-.75][frame-14]
        elbows[1].rotation_euler.y = -.1
        arms[0].rotation_euler.y = .55
        hips[0].rotation_euler.y = -.3; hips[1].rotation_euler.y = .35
        root.rotation_euler.y = .13
        scarf.rotation_euler.y = -.15
    for obj in rig:
        obj.keyframe_insert(data_path='rotation_euler', frame=frame)
    root.keyframe_insert(data_path='location', frame=frame)
for label, frame in [('IDLE',1),('RUN',5),('JUMP',13),('ATTACK',14)]:
    player_scene.timeline_markers.new(label, frame=frame)
player_scene.frame_end = 16
player_scene.frame_set(1)
metadata = {'generator': 'Blender 5.2 / tools/build_blender_assets.py', 'player': {'file':'assets/wanderer.png','cell':192,'columns':4,'anchor':anchor(player_scene), 'scale':.34, 'states':{'idle':[0,1,2,3],'run':[4,5,6,7,8,9,10,11],'jump':[12],'attack':[13,14,15]}}}

# An open pointed arch with individual, editable masonry blocks.
arch_scene = scene('02 RUIN / pointed arch', (384,512), 6.35, (0,0,2.35), (4,-15,5.5))
for side in [-1,1]:
    x=side*1.18
    box('Arch / foot', (x,0,.12), (.95,1.05,.24), M['deep'], .06)
    for i in range(6):
        box('Arch / pier block %d %d'%(side,i), (x,0,.47+i*.49), (.55,.65,.46), M['stone'] if i%2 else M['edge'], .035)
    for z in [.33,1.26,2.70,3.08]:
        box('Arch / moulding', (x,-.01,z), (.73,.82,.12), M['edge'], .02)
    box('Arch / brass inset', (x,-.34,1.82), (.06,.025,.76), M['gold'], .008)
    box('Arch / signal rune', (x,-.362,2.26), (.11,.016,.17), M['cyan'], .008)
points=[(-1.18,0,3.10),(-1.02,0,3.63),(-.64,0,4.13),(0,0,4.57),(.64,0,4.13),(1.02,0,3.63),(1.18,0,3.10)]
for i in range(len(points)-1):
    beam('Arch / voussoir %02d'%i,points[i],points[i+1],.42,.72,M['edge'] if i%2 else M['stone'])
box('Arch / keystone',(0,-.01,4.56),(.43,.87,.51),M['gold'],.04)
box('Arch / keystone signal',(0,-.455,4.56),(.055,.014,.25),M['cyan'],.007)
for i in range(12):
    x=random.choice([-1,1])*random.uniform(.83,1.70)
    rock=box('Arch / fallen stone', (x,random.uniform(-.53,.48),random.uniform(.02,.13)), (random.uniform(.16,.44),random.uniform(.16,.39),random.uniform(.12,.25)), M['moss'] if i%3==0 else M['stone'], .04)
    rock.rotation_euler.z=random.random()
metadata['arch']={'file':'assets/ruin-arch.png','size':[384,512],'anchor':anchor(arch_scene)}

spire_scene = scene('03 RUIN / choir spire',(384,640),10.1,(0,0,4.0),(5,-17,7.8))
box('Spire / foundation',(0,0,.18),(2.8,2.2,.36),M['deep'],.06)
box('Spire / tower',(0,0,3.15),(1.65,1.15,5.9),M['stone'],.045)
for i in range(9):
    box('Spire / stone course',(0,-.015,.48+i*.61),(1.80,1.30,.11),M['edge'],.018)
for side in [-1,1]:
    box('Spire / buttress',(side*1.05,0,1.6),(.48,1.65,3.2),M['stone'],.055)
    beam('Spire / flying buttress',(side*1.05,0,3.1),(side*.68,0,4.6),.28,.7,M['edge'])
for z in [1.55,3.25,4.95]:
    box('Spire / slit recess',(0,-.586,z),(.47,.03,1.1),M['deep'],.03)
    box('Spire / slit light',(0,-.611,z),(.035,.014,.87),M['cyan'],.005)
box('Spire / cornice',(0,0,6.20),(2.1,1.6,.26),M['edge'],.055)
for side in [-1,1]:
    box('Spire / crown prong',(side*.83,0,6.70),(.23,.73,.9),M['stone'],.03)
mesh('Spire / suspended monolith',[(0,0,8.8),(-.45,-.33,7.55),(.45,-.33,7.55),(.45,.33,7.55),(-.45,.33,7.55),(0,0,6.85)],[(0,1,2),(0,2,3),(0,3,4),(0,4,1),(5,2,1),(5,3,2),(5,4,3),(5,1,4)],M['deep'])
beam('Spire / monolith fracture',(0,-.345,7.14),(0,-.345,8.48),.024,.025,M['cyan'])
metadata['spire']={'file':'assets/choir-spire.png','size':[384,640],'anchor':anchor(spire_scene)}

ledge_scene=scene('04 RUIN / floating ledge',(384,160),4.8,(0,0,-.30),(1,-14,4.0))
box('Ledge / cap',(0,0,0),(3.8,.90,.20),M['edge'],.035)
for i in range(5):
    x=-1.52+i*.76
    box('Ledge / block',(x,0,-.30),(.73,.8,.45),M['stone'],.04)
    if i%2==0:
        mesh('Ledge / broken underside',[(x-.32,-.35,-.51),(x+.32,-.35,-.51),(x+.32,.35,-.51),(x-.32,.35,-.51),(x+.13,.04,-1.0)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,3,2,1)],M['deep'])
for x in [-1.32,.55]:
    box('Ledge / signal inlay',(x,-.458,-.03),(.21,.013,.05),M['cyan'],.006)
metadata['ledge']={'file':'assets/ruin-ledge.png','size':[384,160],'anchor':anchor(ledge_scene,(0,0,.10))}

# Exact gameplay coordinates. Rooms are arranged in parallel rows for editing.
map_scene=scene('05 MAP / four-area blockout',(1600,1120),36,(11.3,13.5,1.0),(11.3,-30,42))
map_scene.render.film_transparent=False
map_scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.018,.032,.054,1)
map_scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
for obj in map_scene.objects:
    if obj.type=='LIGHT':
        obj.location.y+=12
        obj.location.z+=10
        obj.data.energy*=5
        obj.data.size=18
layout=[]
for index,(name,width,mat) in enumerate([('THE WAKE',2260,M['stone']),('THE CRADLE',2260,M['purple']),('THE LAST GARDEN',1640,M['garden']),('THE CHOIR',1460,M['purple'])]):
    coll=bpy.data.collections.new('%02d / %s'%(index+1,name))
    map_scene.collection.children.link(coll)
    yoffset=index*9
    floors=[(0,452,710,110),(840,452,width-840,110)] if index<2 else [(0,452,width,110)]
    platforms=[(260,362,140,19),(665,345,170,20),(990,357,150,19),(1300,338,150,20),(1680,354,110,18),(1970,354,110,18)] if index<2 else [(340,365,150,18),(740,348,150,18)]
    def to_collection(obj):
        for c in list(obj.users_collection):c.objects.unlink(obj)
        coll.objects.link(obj)
    for kind,items in [('floor',floors),('platform',platforms)]:
        for i,(x,y,w,h) in enumerate(items):
            obj=box('%s / collision %02d'%(kind,i),((x+w/2)/100,yoffset,(452-y-h/2)/100),(w/100,1.2,h/100),mat,.025)
            obj['game_rect']=[x,y,w,h];obj['role']='collision';to_collection(obj)
    for label,x in [('SPAWN',110),('THRESHOLD',width-90)]:
        obj=empty(label,(x/100,yoffset,.4));obj['role']='marker';to_collection(obj)
    if index<2:
        for label,rect_data in [('OBEDIENCE / conditional bridge',(710,452,130,25)),('DEFIANCE / conditional ledge',(1120,268,170,18))]:
            x,y,w,h=rect_data
            obj=box(label,((x+w/2)/100,yoffset,(452-y-h/2)/100),(w/100,1.2,h/100),M['cyan'],.01)
            obj['game_rect']=list(rect_data);obj['role']='memory-dependent';obj.hide_render=True;obj.display_type='WIRE';to_collection(obj)
    layout.append({'name':name,'width':width,'ground':floors,'platforms':platforms})
    # Instanced architecture stays linked to its source geometry.
    for src,x,scale in [(arch_scene,4.6,.47),(spire_scene,15.1,.52)]:
        if x*100>width:continue
        for original in src.objects:
            if original.type!='MESH':continue
            copy=original.copy();copy.data=original.data
            coll.objects.link(copy)
            copy.location=Vector((x,yoffset+1.7,0))+original.location*scale
            copy.scale=original.scale*scale
    coll['game_area_index']=index
    coll['game_width']=width
    label_data=bpy.data.curves.new(name+' / label','FONT')
    label_data.body='%02d  /  %s'%(index+1,name)
    label_data.size=.33
    label_data.extrude=.002
    label_obj=bpy.data.objects.new(name+' / label',label_data)
    coll.objects.link(label_obj)
    label_obj.location=(0,yoffset-1.5,.02)
    label_data.materials.append(M['cyan'])
map_scene['coordinate_system']='X = game X / 100; Z = (452 - game Y) / 100. Rooms offset +9 in Y.'
map_scene['purpose']='Editable visual blockout. Collision source remains game.js; custom game_rect properties preserve correspondence.'
(MODELS/'map-layout.json').write_text(json.dumps(layout,indent=2),encoding='utf8')

# Save before rendering, so the editable source survives a render interruption.
player_scene.frame_set(1)
bpy.context.window.scene=player_scene
bpy.ops.wm.save_as_mainfile(filepath=str(MODELS/'echo-fall.blend'))
(OUT/'manifest.json').write_text(json.dumps(metadata,indent=2),encoding='utf8')
for f in range(1,17):
    player_scene.frame_set(f)
    render(player_scene,FRAMES/('wanderer-%02d.png'%(f-1)))
for s,name in [(arch_scene,'ruin-arch.png'),(spire_scene,'choir-spire.png'),(ledge_scene,'ruin-ledge.png'),(map_scene,'map-preview.png')]:
    render(s,OUT/name)
print('ECHO_ASSETS_RENDERED',str(OUT),flush=True)

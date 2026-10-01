"""Export edited bestiary.blend poses without rebuilding the models."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
for kind in ['sentinel','lancer','drone','king','mother']:
    scene=bpy.data.scenes['BESTIARY / '+kind.upper()];bpy.context.window.scene=scene
    for frame in range(1,9):
        scene.frame_set(frame);scene.render.filepath=str(ROOT/'assets'/'bestiary-frames'/f'{kind}-{frame-1:02}.png')
        bpy.ops.render.render(write_still=True)
print('Edited bestiary poses exported. Run python tools/pack_bestiary.py.')

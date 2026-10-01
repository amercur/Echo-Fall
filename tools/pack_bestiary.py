"""Pack Blender bestiary poses and merge their manifest into the game bundle."""
import json
from pack_sprites import ROOT,read_png,write_png,blit
manifest=json.loads((ROOT/'assets'/'bestiary.json').read_text())
board=bytearray(bytes([14,23,36,255])*(2048*1280))
for row,kind in enumerate(manifest):
    pixels=bytearray(1024*512*4)
    for i in range(8):
        w,h,p=read_png(ROOT/'assets'/'bestiary-frames'/f'{kind}-{i:02}.png')
        assert (w,h)==(256,256)
        assert any(p[3::4]),kind
        blit(pixels,1024,p,w,h,(i%4)*256,(i//4)*256)
        blit(board,2048,p,w,h,i*256,row*256,True)
    write_png(ROOT/'assets'/f'{kind}.png',1024,512,pixels)
write_png(ROOT/'assets'/'bestiary-preview.png',2048,1280,board)
art=json.loads((ROOT/'assets'/'manifest.json').read_text());art.update(manifest)
smooth=ROOT/'assets'/'wanderer-smooth.json'
if smooth.exists():art.update(json.loads(smooth.read_text()))
art['maps']=json.loads((ROOT/'models'/'map-layout.json').read_text())
(ROOT/'assets'/'art-manifest.js').write_text('window.ECHO_ART = '+json.dumps(art,separators=(',',':'))+';\n')
print('Packed five animated enemies / bosses and updated browser manifest.')

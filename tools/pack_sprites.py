"""Lossless PNG atlas packing using only Python's standard library."""
import struct
import zlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def read_png(path):
    data=Path(path).read_bytes()
    assert data[:8]==b'\x89PNG\r\n\x1a\n'
    offset=8; compressed=bytearray(); width=height=0
    while offset<len(data):
        size=struct.unpack('>I',data[offset:offset+4])[0]
        kind=data[offset+4:offset+8];chunk=data[offset+8:offset+8+size];offset+=size+12
        if kind==b'IHDR':
            width,height,depth,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',chunk)
            assert depth==8 and color==6 and interlace==0,'Expected noninterlaced 8-bit RGBA'
        elif kind==b'IDAT':compressed.extend(chunk)
        elif kind==b'IEND':break
    raw=zlib.decompress(compressed);stride=width*4;pixels=bytearray(width*height*4);previous=bytearray(stride)
    for y in range(height):
        start=y*(stride+1);filter_type=raw[start];row=bytearray(raw[start+1:start+1+stride])
        for i in range(stride):
            a=row[i-4] if i>=4 else 0;b=previous[i];c=previous[i-4] if i>=4 else 0
            if filter_type==1:prediction=a
            elif filter_type==2:prediction=b
            elif filter_type==3:prediction=(a+b)//2
            elif filter_type==4:
                p=a+b-c;pa,pb,pc=abs(p-a),abs(p-b),abs(p-c)
                prediction=a if pa<=pb and pa<=pc else b if pb<=pc else c
            elif filter_type==0:prediction=0
            else:raise ValueError('Unknown PNG filter')
            row[i]=(row[i]+prediction)&255
        pixels[y*stride:(y+1)*stride]=row;previous=row
    return width,height,pixels


def write_png(path,width,height,pixels):
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    rows=b''.join(b'\0'+pixels[y*width*4:(y+1)*width*4] for y in range(height))
    Path(path).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+chunk(b'sRGB',b'\0')+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b''))


def blit(target,tw,source,sw,sh,x,y,composite=False):
    for row in range(sh):
        for col in range(sw):
            si=(row*sw+col)*4;di=((row+y)*tw+col+x)*4
            if composite:
                a=source[si+3]/255
                for c in range(3):target[di+c]=round(source[si+c]*a+target[di+c]*(1-a))
                target[di+3]=255
            else:target[di:di+4]=source[si:si+4]


def main():
    width=height=768;atlas=bytearray(width*height*4)
    for i in range(16):
        w,h,pixels=read_png(ROOT/'assets'/'frames'/f'wanderer-{i:02d}.png')
        assert (w,h)==(192,192)
        alpha=pixels[3::4];assert any(a>0 for a in alpha) and any(a==0 for a in alpha)
        assert not any(pixels[x*4+3] for x in range(w)),f'Frame {i} clipped at top'
        blit(atlas,width,pixels,w,h,(i%4)*192,(i//4)*192)
    write_png(ROOT/'assets'/'wanderer.png',width,height,atlas)
    # A reviewable contact sheet, including all animation poses and the ruins.
    bw,bh=1536,832;board=bytearray(bytes([12,20,33,255])*(bw*bh))
    blit(board,bw,atlas,768,768,16,32,True)
    for filename,x,y in [('ruin-arch.png',786,210),('choir-spire.png',1145,45)]:
        w,h,pixels=read_png(ROOT/'assets'/filename);blit(board,bw,pixels,w,h,x,y,True)
    write_png(ROOT/'assets'/'asset-preview.png',bw,bh,board)
    manifest=json.loads((ROOT/'assets'/'manifest.json').read_text(encoding='utf8'))
    bestiary=ROOT/'assets'/'bestiary.json'
    if bestiary.exists():manifest.update(json.loads(bestiary.read_text(encoding='utf8')))
    smooth=ROOT/'assets'/'wanderer-smooth.json'
    if smooth.exists():manifest.update(json.loads(smooth.read_text(encoding='utf8')))
    manifest['maps']=json.loads((ROOT/'models'/'map-layout.json').read_text(encoding='utf8'))
    (ROOT/'assets'/'art-manifest.js').write_text('/* Generated from the Blender export. */\nwindow.ECHO_ART = '+json.dumps(manifest,ensure_ascii=True,separators=(',',':'))+';\n',encoding='utf8')
    print('Packed 16 frames into assets/wanderer.png; review assets/asset-preview.png')


if __name__=='__main__':main()

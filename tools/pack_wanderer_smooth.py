from pack_sprites import ROOT,read_png,write_png,blit,main
pixels=bytearray(768*1920*4)
for i in range(40):
    w,h,p=read_png(ROOT/'assets'/'smooth-frames'/f'wanderer-{i:02}.png')
    assert (w,h)==(192,192)
    blit(pixels,768,p,w,h,(i%4)*192,(i//4)*192)
write_png(ROOT/'assets'/'wanderer-smooth.png',768,1920,pixels)
main()
print('Packed 40 Wanderer poses, including sitting down.')

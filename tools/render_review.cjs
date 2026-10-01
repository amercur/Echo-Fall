'use strict';
// Offline render of the actual game Canvas commands, not browser automation.
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {boot}=require('../tests/harness.cjs');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
(async()=>{
  const images=new Map();
  for(const file of fs.readdirSync(path.join(root,'assets')).filter(f=>f.endsWith('.png'))){images.set('assets/'+file,await loadImage(path.join(root,'assets',file)));}
  const canvas=createCanvas(960,540),context=canvas.getContext('2d');
  const {game,tick,down,up}=boot(new Map(),true,{context,images});game.startRun();
  const out=path.join(root,'art-review');fs.mkdirSync(out,{recursive:true});
  for(const zone of ['wake','procession','king','mother','garden']){
    game.loadRoom(zone);game.player.x=zone==='wake'?110:500;game.player.inv=100;tick(.5);
    if(zone==='procession'){
      game.enemies.length=0;for(const [x,type] of [[640,'sentinel'],[780,'lancer'],[560,'drone']]){const e=game.enemy(x,type);if(type==='drone')e.y=e.homeY=280;game.enemies.push(e);}
      game.player.inv=0;down('j');tick(.03);up('j');
    }
    if(game.boss){game.boss.x=740;game.boss.phase='tell';game.boss.timer=.4;game.boss.targetX=game.player.x;}
    game.player.inv=0;
    game.render();fs.writeFileSync(path.join(out,zone+'.png'),canvas.toBuffer('image/png'));
  }
  console.log('Rendered five gameplay scenes to art-review/.');
})().catch(e=>{console.error(e);process.exitCode=1;});

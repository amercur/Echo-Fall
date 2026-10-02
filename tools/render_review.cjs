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
  game.loadRoom('wake');tick(.1);game.interact(game.world.interactions.find(o=>o.kind==='bench'));tick(.6);game.player.inv=0;game.render();
  fs.writeFileSync(path.join(out,'bench-rest.png'),canvas.toBuffer('image/png'));
  game.loadRoom('mother');game.player.inv=100;
  for(const [x,y,heavy,vx,vy] of [[450,250,false,180,0],[680,260,true,-160,0],[820,170,false,0,180]])game.shots.push({x,y,vx,vy,r:heavy?13:8,heavy,life:4,color:heavy?'#ff6f91':'#73f0e7',friendly:false});
  for(let i=0;i<30;i++)game.updateShots(1/120);game.player.inv=0;game.render();
  fs.writeFileSync(path.join(out,'projectiles.png'),canvas.toBuffer('image/png'));
  console.log('Rendered gameplay scenes, bench rest, and projectile details to art-review/.');
})().catch(e=>{console.error(e);process.exitCode=1;});

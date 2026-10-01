'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {boot}=require('./harness.cjs');
const data=require('../data/world.json');

test('movement, variable jump height, and directional aiming use separate controls',()=>{
  const a=boot();a.game.startRun();a.tick(.1);a.down('d');a.tick(.4);a.up('d');assert.ok(a.game.player.x>185);
  a.down('w');a.tick(.05);assert.equal(a.game.player.grounded,true,'aiming upward does not jump');a.up('w');
  a.down(' ');a.tick(.1);a.up(' ');a.tick(.14);const short=a.game.player.y;
  const b=boot();b.game.startRun();b.tick(.1);b.down(' ');b.tick(.24);assert.ok(b.game.player.y<short-20,'holding jump reaches higher');
});
test('normal jumps reach the hub platforms; dropping through does not drop through solid ground',()=>{
  const {game,tick,down,up}=boot();game.startRun();game.player.x=300;tick(.1);down(' ');tick(.85);up(' ');
  assert.equal(game.player.y+game.player.h,362);assert.equal(game.player.onPlatform,true);
  down('s');down(' ');tick(.2);up(' ');up('s');tick(.5);assert.equal(game.player.y+game.player.h,452);
  down('s');down(' ');tick(.1);assert.ok(game.player.y+game.player.h<=452);
});
test('wall sliding caps descent and wall jumping pushes away while restoring aerial movement',()=>{
  const {game,tick,down}=boot();game.startRun();game.loadRoom('belfry');Object.assign(game.player,{x:373,y:50,vy:400,airDashUsed:true});down('a');tick(.08);
  assert.equal(game.player.wall,-1);assert.ok(game.player.vy<=110);
  down(' ');tick(.06);assert.ok(game.player.vx>0);assert.ok(game.player.vy<0);assert.equal(game.player.airDashUsed,false);assert.ok(game.player.x>373);
});
test('solids block dash tunneling and prevent head-first ceiling penetration',()=>{
  const {game,tick}=boot();game.startRun();game.loadRoom('belfry');Object.assign(game.player,{x:280,y:40});game.movePlayerX(250);assert.equal(game.player.x,323);
  Object.assign(game.player,{x:349,y:238,vy:-600});tick(.03);assert.ok(game.player.y>=230,'underside of the wall is solid');
});
test('holding toward either wall allows repeated tap jumps up the same wall',()=>{
  for(const [x,key,side] of [[373,'a',-1],[498,'d',1]]){
    const {game,tick,down,up}=boot();game.startRun();game.loadRoom('belfry');
    Object.assign(game.player,{x,y:50,vy:100,inv:100});down(key);tick(.03);
    assert.equal(game.player.wall,side);
    for(let jump=0;jump<3;jump++){
      const startY=game.player.y,startX=game.player.x;let maxDistance=0,returned=false;
      down(' ');tick(.05);up(' ');
      for(let step=0;step<48;step++){
        game.update(1/120);maxDistance=Math.max(maxDistance,Math.abs(game.player.x-startX));
        if(game.player.wall===side){returned=true;break;}
      }
      assert.ok(returned,'held input returns to the same wall within 0.45 seconds');
      assert.ok(maxDistance<35,'push-off stays close enough for wall climbing');
      assert.ok(game.player.y<startY-15,'each tap jump gains height');
    }
  }
});
test('the full belfry ascent is traversable with chained wall jumps and a final air dash',()=>{
  const {game}=boot();game.startRun();game.loadRoom('belfry');Object.assign(game.player,{x:410,y:215,grounded:true,inv:100});
  let aim=1,reached=false;
  for(let i=0;i<3600;i++){
    const p=game.player;if(p.grounded)game.pressed.add(' ');
    if(p.wall&&p.wallLock<=0){game.pressed.add(' ');aim=-p.wall;}
    if(p.y<-395&&p.x<420)aim=1;if(p.y<-530)aim=1;
    if(p.y<-540&&p.vx>0&&!p.airDashUsed)game.pressed.add('k');
    game.keys.clear();game.keys.add(aim>0?'d':'a');game.update(1/120);
    if(p.x>560&&p.y<-370){reached=true;break;}
  }
  assert.equal(reached,true,'the upper route can be reached without a memory upgrade');assert.ok(game.cameraY<-200);
});
test('only one airborne dash is available until a pogo, landing, or deflect restores it',()=>{
  const {game,tick,down,up}=boot();game.startRun();Object.assign(game.player,{x:150,y:-200,grounded:false});down('k');tick(.02);up('k');assert.equal(game.player.airDashUsed,true);
  tick(.65);down('k');tick(.02);assert.equal(game.player.dash,0);assert.equal(game.player.airDashUsed,true);
});
test('downward strikes bounce off enemies and restore the double jump and air dash',()=>{
  const {game}=boot();game.startRun();const e=game.enemy(220);game.enemies.push(e);Object.assign(game.player,{x:218,y:e.y-49,grounded:false,double:true,airDashUsed:true,dashCd:.5});game.keys.add('s');game.attack();
  assert.ok(e.hp<e.max);assert.ok(game.player.vy<-500);assert.equal(game.player.airDashUsed,false);assert.equal(game.player.double,false);assert.equal(game.player.dashCd,0);
});
test('pogo crystals can be used to cross the cistern without taking damage',()=>{
  const {game}=boot();game.startRun();game.loadRoom('cistern');const p=game.world.pogo[0];Object.assign(game.player,{x:p.x,y:p.y-64,grounded:false,airDashUsed:true});game.keys.add('s');game.attack();assert.ok(game.player.vy<0);assert.equal(game.player.hp,6);
});
test('timed deflect earns Resonance and creates strain; a late block fractures integrity',()=>{
  const {game,tick}=boot();game.startRun();game.player.inv=0;game.player.dir=1;const source=game.enemy(180);
  game.beginDeflect();assert.equal(game.hurt(1,180,'test',{source}),'parry');assert.equal(game.player.resonance,1);assert.equal(source.strain,3);
  tick(.4);game.player.inv=0;game.beginDeflect();tick(.21);assert.equal(game.hurt(1,180,'test',{source}),'guard');assert.equal(game.player.fracture,.5);
  game.player.inv=0;game.player.parry=0;game.hurt(1,180);assert.equal(game.player.hp,4);assert.equal(game.player.fracture,0);
});
test('red attacks defeat tap parries but a charged release counters them',()=>{
  const {game,tick,down,up}=boot();game.startRun();game.player.inv=0;game.beginDeflect();assert.equal(game.hurt(1,170,'test',{heavy:true}),'hit');assert.equal(game.player.hp,5);
  tick(.45);game.player.inv=0;game.player.dir=1;down('f');tick(.54);up('f');tick(.01);assert.ok(game.player.counter>0);assert.equal(game.hurt(1,170,'test',{heavy:true}),'parry');assert.equal(game.player.hp,5);
});
test('deflecting a projectile returns it to its shooter',()=>{
  const {game}=boot();game.startRun();game.player.inv=0;game.player.dir=1;game.beginDeflect();const e=game.enemy(240,'drone');game.enemies.push(e);
  game.shots.push({x:game.player.x+15,y:game.player.y+20,vx:-200,vy:0,r:7,life:2,friendly:false,color:'#fff',source:e});game.updateShots(.001);
  assert.equal(game.shots[0].friendly,true);assert.equal(game.shots[0].reflected,true);assert.ok(game.shots[0].vx>0);
});
test('imprints spend stored Resonance and detonate the target strain',()=>{
  const {game}=boot();game.startRun();const e=game.enemy(160,'lancer');e.hp=30;e.max=30;e.strain=5;game.enemies.push(e);game.player.resonance=2;
  assert.equal(game.imprintAttack(),true);assert.equal(game.player.resonance,0);assert.equal(game.imprint.charge,2);game.imprintAttack();assert.equal(e.hp,18);assert.equal(e.strain,0);assert.equal(game.imprint,null);
  game.player.resonance=1;game.player.x=600;assert.equal(game.imprintAttack(),false);assert.equal(game.player.resonance,1);
});
test('three-hit chains and held charge attacks produce distinct finishers',()=>{
  const {game,tick,down,up}=boot();game.startRun();game.attack();tick(.25);game.attack();tick(.25);game.attack();assert.equal(game.player.combo,3);assert.ok(game.player.attackCd>.3);
  tick(.9);down('j');tick(.61);up('j');tick(.01);assert.equal(game.player.combo,3);assert.ok(game.player.attackCd>.4);
});
test('mending consumes one Resonance and can be interrupted by a hit',()=>{
  const {game,tick,down}=boot();game.startRun();tick(.1);game.player.hp=3;game.player.resonance=2;down('h');tick(1.1);assert.equal(game.player.hp,4);assert.equal(game.player.resonance,1);
  tick(.4);assert.ok(game.player.focus>0);game.player.inv=0;game.hurt(1,500);assert.equal(game.player.focus,0);
});
test('hazards return the player to safe footing; only fatal damage ends the life',()=>{
  const {game,tick}=boot();game.startRun();game.loadRoom('cistern');Object.assign(game.player,{x:700,y:480});tick(.02);assert.equal(game.state,'play');assert.equal(game.player.hp,5);assert.equal(game.player.x,90);
  game.player.hp=1;Object.assign(game.player,{x:700,y:480});tick(.2);assert.equal(game.state,'dead');
});
test('one chosen decision survives a transfer and reload',()=>{
  const {game,click,store}=boot();game.startRun();game.interact(game.world.interactions.find(o=>o.kind==='creature'));click('choice-0');assert.equal(game.player.hp,4);game.recordDecision('defiance');assert.equal(game.save.archive.length,0);
  game.die('test');click('extract-mercy');assert.equal(game.save.loop,2);assert.equal(game.save.archive.length,1);assert.equal(game.save.active,'mercy');
  const loaded=boot(store);loaded.game.startRun();assert.equal(loaded.game.world.interactions.some(o=>o.kind==='creature'),false);assert.equal(loaded.game.remembered('defiance'),false);
});
test('five-memory capacity and forgetting remove the breathing passage and its geometry',()=>{
  const {game,click}=boot();game.setSave({archive:['return','mercy','fire','defiance','obedience'].map(id=>({id,loop:1})),active:'defiance',loop:3});game.startRun();game.loadRoom('archive');assert.equal(game.doorOpen(game.world.interactions.find(o=>o.memory)),true);
  game.recordDecision('respect');game.die('test');click('extract-respect');assert.equal(game.state,'forget');click('forget-defiance');click('choice-0');assert.equal(game.save.archive.length,5);assert.equal(game.save.loop,4);
  game.startRun();game.loadRoom('archive');assert.equal(game.doorOpen(game.world.interactions.find(o=>o.memory)),false);assert.equal(game.world.platforms.some(p=>p.x===620&&p.w===90),false);
});
test('memory double jump and healing still work with the new movement system',()=>{
  const {game,tick,down,up}=boot();game.setSave({archive:[{id:'defiance',loop:1}],active:'defiance'});game.startRun();tick(.1);down(' ');tick(.1);up(' ');down(' ');tick(.02);assert.equal(game.player.double,true);assert.ok(game.player.vy<-500);
  game.setSave({active:'sacrifice'});game.player.hp=1;game.ability();assert.equal(game.player.hp,3);tick(1.1);game.ability();assert.equal(game.player.hp,3);game.loadRoom('cradle');game.ability();assert.equal(game.player.hp,5);
});
test('shortcut levers connect both ends and killed enemies stay dead on a return visit',()=>{
  const {game}=boot();game.startRun();game.loadRoom('procession');const locked=game.world.interactions.find(o=>o.requires==='archive-lift');game.interact(locked);assert.equal(game.zoneId,'procession');
  game.enterZone('archive');game.interact(game.world.interactions.find(o=>o.kind==='lever'));game.interact(game.world.interactions.find(o=>o.target==='procession'));assert.equal(game.zoneId,'procession');assert.equal(game.doorOpen(game.world.interactions.find(o=>o.requires==='archive-lift')),true);
  game.enemies[0].hp=0;game.enterZone('wake');game.enterZone('procession');assert.equal(game.enemies[0].hp,0);
});
test('the King preserves his shield rules and stays defeated when revisited',()=>{
  const {game,tick}=boot();game.startRun();game.loadRoom('king');game.player.x=340;tick(.05);const hp=game.boss.hp;game.player.grounded=true;game.damageBoss(4);assert.equal(game.boss.hp,hp);
  game.player.grounded=false;game.damageBoss(4);assert.equal(game.boss.hp,hp-4);game.damageBoss(100,true);assert.equal(game.flags.king,true);
  game.interact(game.world.interactions.find(o=>o.target==='cradle'));assert.equal(game.zoneId,'cradle');game.interact(game.world.interactions.find(o=>o.target==='king'));assert.equal(game.boss.hp,0);
});
test('the Mother summons past selves and mercy assists after three transfers',()=>{
  const {game,tick}=boot();game.setSave({archive:[{id:'mercy',loop:1}],loop:3});game.startRun();game.loadRoom('mother');game.player.x=400;game.player.inv=100;tick(8);assert.ok(game.enemies.some(e=>e.type==='echo'));assert.equal(game.boss.hp,game.boss.max);
  game.setSave({loop:4});game.loadRoom('king');game.player.x=340;game.player.inv=100;tick(3);assert.ok(game.boss.hp<game.boss.max);
});
test('the Child opens the Choir only through dialogue, and remembered care unlocks SHARE',()=>{
  const {game,click,element}=boot();game.startRun();game.loadRoom('garden');const gate=game.world.interactions.find(o=>o.target==='choir');game.interact(gate);assert.equal(game.zoneId,'garden');
  game.childDialogue();click('choice-0');assert.equal(game.childStage,0);game.childDialogue();click('choice-1');click('choice-2');click('choice-0');assert.equal(game.player.hp,6);game.interact(gate);assert.equal(game.zoneId,'choir');
  game.setSave({archive:[{id:'respect',loop:1},{id:'mercy',loop:2}],respect:1,loop:3});game.choirDialogue();assert.match(element('overlayCard').innerHTML,/SHARE THE CHOICE/);click('choice-3');assert.ok(game.save.endings.includes('SHARE'));
});
test('the twelve-room graph has valid entry points, reversible shortcuts, and no orphaned rooms',()=>{
  assert.equal(data.rooms.length,12);const zones=Object.fromEntries(data.rooms.map(z=>[z.id,z]));const seen=new Set(['wake']),pending=['wake'];
  while(pending.length){const id=pending.pop();for(const d of zones[id].interactions.filter(o=>o.target)){assert.ok(zones[d.target],d.target);assert.ok(zones[d.target].spawns[d.entry],d.id);if(!seen.has(d.target)){seen.add(d.target);pending.push(d.target);}}}
  assert.equal(seen.size,12);assert.ok(data.rooms.filter(z=>z.top<-250).length>=2);
});
test('map fog reveals adjacent routes, pauses physics, and resumes with M',()=>{
  const {game,element,tick,down,up}=boot();game.startRun();game.showMap();assert.equal(game.state,'map');assert.match(element('overlayCard').innerHTML,/UNEXPLORED/);const x=game.player.x;tick(1);assert.equal(game.player.x,x);down('m');tick(.02);up('m');assert.equal(game.state,'play');
});
test('all Blender sprites render within atlas bounds in every room and combat pose',()=>{
  const {game,drawnImages}=boot(new Map(),true);game.startRun();
  for(const z of data.rooms){game.loadRoom(z.id);for(const pose of ['idle','run','jump','attack','charged','guard']){game.player.grounded=pose!=='jump';game.player.vx=pose==='run'?250:0;game.player.attackCd=pose==='charged'?.46:pose==='attack'?.2:0;game.player.attackVisual=game.player.attackCd;game.player.attackDuration=game.player.attackCd||.22;game.player.guardCharge=pose==='guard'?.6:0;game.render();}}
  for(const [img,sx,sy,sw,sh] of drawnImages)assert.ok(sx>=0&&sy>=0&&sx+sw<=img.width&&sy+sh<=img.height,img.path);
  for(const file of ['wanderer-smooth.png','ruin-arch.png','choir-spire.png','ruin-ledge.png'])assert.ok(drawnImages.some(([img])=>img.path.endsWith(file)));
});
test('old archives and malformed saves still start safely',()=>{
  const {game}=boot(new Map([['echo-fall-v1','{broken']]));assert.equal(game.save.loop,1);game.startRun();assert.equal(game.zoneId,'wake');
});
test('a tapped follow-up survives recovery and executes once, including after a heavy cut',()=>{
  const {game,tick,down,up}=boot();game.startRun();tick(.1);game.attack(true);tick(.07);
  down('j');tick(.01);up('j');tick(.40);assert.equal(game.player.combo,1);assert.ok(game.player.attackCd>0);
  tick(.35);assert.equal(game.player.attackCd,0);assert.equal(game.player.combo,1);
});
test('deflect and dash inputs shortly before cooldown ends are buffered',()=>{
  const {game,tick,down,up}=boot();game.startRun();tick(.1);game.player.parryCd=.06;
  down('f');tick(.01);up('f');tick(.07);assert.ok(game.player.perfect>0);
  game.player.dashCd=.06;down('k');tick(.01);up('k');tick(.07);assert.ok(game.player.dash>0);
});
test('fixed simulation gives equivalent movement at 30, 60, and 144 Hz rendering',()=>{
  const positions=[30,60,144].map(hz=>{const {game,down}=boot();game.startRun();game.frame(1000);down('d');for(let n=1;n<=hz;n++)game.frame(1000+n*1000/hz);return game.player.x;});
  assert.ok(Math.max(...positions)-Math.min(...positions)<3,positions.join(', '));
});
test('each new bestiary atlas is rendered, with valid attack and recovery frames',()=>{
  const {game,drawnImages}=boot(new Map(),true);game.startRun();game.loadRoom('procession');
  for(const type of ['sentinel','lancer','drone']){
    game.enemies.length=0;const e=game.enemy(140,type);game.enemies.push(e);
    for(const phase of ['walk','windup','strike','recover']){e.phase=phase;game.render();}
  }
  for(const room of ['king','mother']){game.loadRoom(room);game.player.x=500;game.update(.02);game.boss.x=600;game.render();}
  for(const type of ['sentinel','lancer','drone','king','mother'])assert.ok(drawnImages.some(([img])=>img.path.endsWith('/'+type+'.png')),type);
  for(const [img,sx,sy,sw,sh] of drawnImages)assert.ok(sx>=0&&sy>=0&&sx+sw<=img.width&&sy+sh<=img.height,img.path);
});

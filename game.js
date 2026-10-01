/* ECHO//FALL — dependency-free browser prototype. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const W = 960, H = 540, FLOOR = 452, SAVE_KEY = 'echo-fall-v1';
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * pixelRatio; canvas.height = H * pixelRatio;
  const C = { cyan: '#73f0e7', rose: '#ff6f91', gold: '#f9ca7b', ink: '#09101d', white: '#e6eff5' };
  const art = window.ECHO_ART || {}, artImages = {};
  const atlas = window.ECHO_WORLD;
  const zones = Object.fromEntries(atlas.rooms.map(z => [z.id, z]));
  if (typeof Image === 'function') for (const [key, asset] of Object.entries(art)) {
    if (!asset || typeof asset.file !== 'string') continue;
    const img = new Image(); img.decoding = 'async';
    img.onload = () => { artImages[key] = img; };
    img.src = asset.file;
  }
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const approach = (n, target, step) => n < target ? Math.min(n + step, target) : Math.max(n - step, target);
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const memories = {
    return: { name: 'The will to return', icon: '◇', short: 'RETURN', color: C.cyan, desc: 'L · Parry an incoming strike. A perfect parry restores integrity.', world: 'Even an empty hand can refuse the end.', ability: 'parry' },
    mercy: { name: 'The life I spared', icon: '✧', short: 'MERCY', color: C.cyan, desc: 'L · Call a spirit to strike. In three loops, a life will find you.', world: 'The wounded creature is gone. Something small remembers you.', ability: 'spirit' },
    fire: { name: 'The ember I took', icon: '◆', short: 'EMBER', color: '#ffa16b', desc: 'J · Cast fire instead of a blade. L · Release a fireburst.', world: 'Ash grows where a creature once lay.', ability: 'fire' },
    defiance: { name: 'The door I opened', icon: '⌁', short: 'DEFIANCE', color: '#c7a5ff', desc: 'Jump again in the air. L · Blink forward through danger.', world: 'A forbidden path is now part of the world.', ability: 'blink' },
    obedience: { name: 'The door I sealed', icon: '▣', short: 'ORDER', color: C.gold, desc: 'L · Raise a ward for two seconds. The King recognizes you.', world: 'Order restores a bridge, but strengthens its sovereign.', ability: 'ward' },
    sacrifice: { name: 'The blood I gave', icon: '♡', short: 'SACRIFICE', color: C.rose, desc: 'L · Restore two integrity, once per room. The cages open.', world: 'The preserved begin to stir. Someone left the locks undone.', ability: 'heal' },
    betrayal: { name: 'The hand I betrayed', icon: '╱', short: 'BETRAYAL', color: C.rose, desc: 'Your blade steals life on a kill. L · Strike both directions.', world: 'Keepers withdraw their trust. Old selves sharpen their blades.', ability: 'fury' },
    respect: { name: 'The voice I heard', icon: '∞', short: 'KINSHIP', color: C.cyan, desc: 'L · Ask your Echo to strike beside you. It answers by choice.', world: 'The abandoned stop pretending to be reflections.', ability: 'echo' },
    abandon: { name: 'The self I abandoned', icon: '∅', short: 'DISTANCE', color: '#a2b3db', desc: 'Dash recharges twice as fast. L · Become untouchable briefly.', world: 'Your old bodies remember which way you walked.', ability: 'phase' }
  };
  function readSave() {
    const fresh = { version: 1, loop: 1, archive: [], active: null, bodies: [], endings: [], respect: 0 };
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!s || s.version !== 1) return fresh;
      s.archive = Array.isArray(s.archive) ? s.archive.filter(m => m && memories[m.id] && Number.isFinite(m.loop)).slice(0, 5) : [];
      s.active = s.archive.some(m => m.id === s.active) ? s.active : null;
      s.loop = Number.isFinite(s.loop) ? clamp(Math.floor(s.loop), 1, 9999) : 1;
      s.bodies = Array.isArray(s.bodies) ? s.bodies.filter(b => Number.isFinite(b.x) && Number.isFinite(b.room)).slice(-7) : [];
      s.endings = Array.isArray(s.endings) ? s.endings.filter(x => ['RESET','BREAK','REMEMBER','SHARE'].includes(x)) : [];
      s.respect = Number.isFinite(s.respect) ? s.respect : 0;
      return { ...fresh, ...s };
    } catch { return fresh; }
  }
  let save = readSave(), state = 'title', room = 0, zoneId = 'wake', world, player, camera = 0, cameraY = 0, clock = 0, roomTime = 0;
  let enemies = [], shots = [], particles = [], slash = [], decisions = [], chosen = new Set(), log = [];
  let boss = null, bossStarted = false, bossDefeated = false, shake = 0, deathReason = '', aidTimer = 0;
  let pendingMemory = null, keys = new Set(), pressed = new Set(), lastTime = 0, toastTimer = 0, sound = false, audio;
  let jumpBuffer = 0, coyote = 0, pausedFrom = 'play', childStage = 0, childAttempts = 0, deathsThisSession = 0;
  let released = new Set(), roomCache = new Map(), visited = new Set(), runFlags = {}, hitstop = 0, imprint = null;
  let accumulator = 0, renderAlpha = 1, viewCamera = 0, viewCameraY = 0, ghosts = [], ghostTimer = 0;
  const STEP = 1 / 120;
  const themes = [
    { name: 'THE WAKE', sector: '01', sub: 'THE KINGDOM OF CERTAINTY', sky: '#111b30', far: '#182a40', mid: '#24384d', accent: C.cyan, width: 2260 },
    { name: 'THE CRADLE', sector: '02', sub: 'NOTHING HERE IS ALLOWED TO END', sky: '#201a31', far: '#322740', mid: '#46354c', accent: C.rose, width: 2260 },
    { name: 'THE LAST GARDEN', sector: '03', sub: 'A WORLD THAT HAS NEVER ENDED', sky: '#142b30', far: '#1d3d3d', mid: '#30544a', accent: C.gold, width: 1640 },
    { name: 'THE CHOIR', sector: '00', sub: 'YOU HAVE BEEN HERE BEFORE', sky: '#171b31', far: '#242944', mid: '#393857', accent: '#c7a5ff', width: 1460 }
  ];
  const remembered = id => save.archive.some(m => m.id === id);
  const did = id => remembered(id) || decisions.includes(id);
  const active = id => save.active === id;
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { toast('Archive is temporary: browser storage is unavailable.'); } }
  function tone(freq = 300, duration = .08, type = 'sine', volume = .035) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * .55), audio.currentTime + duration);
      gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
    } catch { sound = false; }
  }
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); toastTimer = 3.5; }
  function addLog(message, label = `LOOP ${String(save.loop).padStart(3, '0')}`) {
    log.unshift({ message, label }); log = log.slice(0, 7);
    $('logList').replaceChildren(...log.map(entry => {
      const div = document.createElement('div'); div.className = 'log-item';
      const small = document.createElement('small'); small.textContent = entry.label;
      div.append(small, document.createTextNode(entry.message)); return div;
    }));
  }
  function refreshUI() {
    $('loopLabel').textContent = `LOOP ${String(save.loop).padStart(3, '0')}`;
    $('healthPips').innerHTML = Array.from({ length: 6 }, (_, i) => `<i class="pip${i >= (player?.hp ?? 6) ? ' empty' : i >= ((player?.hp ?? 6) - (player?.fracture || 0)) ? ' fractured' : ''}"></i>`).join('');
    $('activeEcho').textContent = save.active ? memories[save.active].short : 'UNWRITTEN';
    $('equippedLabel').textContent = save.active ? `L · ${memories[save.active].short}` : 'F · DEFLECT / Q · IMPRINT';
    $('memoryCount').textContent = `${String(save.archive.length).padStart(2, '0')} / 05`;
    $('memoryList').innerHTML = save.archive.length ? save.archive.map(m => `<button class="memory-row ${save.active === m.id ? 'active' : ''}" data-memory="${m.id}"><div class="name"><span>${memories[m.id].icon} ${memories[m.id].name}</span><span class="tag">${save.active === m.id ? 'ACTIVE' : 'EQUIP'}</span></div><div class="detail">${memories[m.id].desc}</div></button>`).join('') : '<div class="empty-memory"><span>◇</span><p>No memories recovered.<br>The first death will leave one behind.</p></div>';
    $('memoryList').querySelectorAll('[data-memory]').forEach(el => el.onclick = () => {
      if (state === 'title' || state === 'loadout' || (state === 'play' && nearRest())) {
        save.active = save.active === el.dataset.memory ? null : el.dataset.memory; persist(); refreshUI();
        if (state === 'loadout') showLoadout();
        toast(save.active ? `You remember: ${memories[save.active].name.toLowerCase()}.` : 'You enter without an active memory.');
      } else toast('Equip memories beside a signal anchor or between loops.');
    });
  }
  function modal(html, actions = {}) {
    if(player){player.guardCharge=0;player.attackHold=0;player.focus=0;player.dashBuffer=0;player.deflectBuffer=0;player.attackBuffer=0;}
    keys.clear(); pressed.clear(); released.clear(); $('overlayCard').classList.remove('map-card'); $('overlayCard').innerHTML = html; $('overlay').classList.remove('hidden');
    for (const [id, callback] of Object.entries(actions)) { const el = $(id); if (el) el.onclick = callback; }
    const first = $('overlayCard').querySelector('button'); if (first) first.focus({ preventScroll: true });
  }
  function closeModal() { $('overlay').classList.add('hidden'); keys.clear(); pressed.clear(); released.clear(); document.activeElement?.blur(); }
  function title() {
    state = 'title';
    modal(`<div class="eyebrow">ONE CONSCIOUSNESS. COUNTLESS LIVES.</div><h2>ECHO<span class="rose">//</span>FALL</h2><p>The world remembers what you did.<br><span class="accent">It doesn't remember why.</span></p><p class="small">A playable chapter about the selves we leave behind.<br>Explore. Make a choice. Fall. Bring one memory back.</p><div class="buttons"><button class="btn" id="beginBtn">${save.loop > 1 ? 'RETURN TO THE WAKE' : 'ENTER THE FIRST LOOP'} →</button><button class="btn secondary" id="controlsBtn">CONTROLS</button></div><p class="small" style="margin-top:18px">KEYBOARD RECOMMENDED · PROGRESS SAVES AUTOMATICALLY</p>`, { beginBtn: showLoadout, controlsBtn: () => showHelp('title') });
  }
  function showLoadout() {
    state = 'loadout';
    const cards = save.archive.map(m => `<button class="memory-choice ${save.active === m.id ? 'selected' : ''}" id="equip-${m.id}"><strong>${memories[m.id].icon} ${memories[m.id].name} ${save.active === m.id ? '· EQUIPPED' : ''}</strong><span>${memories[m.id].desc}</span></button>`).join('');
    modal(`<div class="eyebrow">LOOP ${String(save.loop).padStart(3,'0')} / RECONSTRUCTION</div><h2>Who returns?</h2><p>${save.archive.length ? 'Carry five memories. Embody one.<br>Every memory you keep changes the world.' : 'You have no past. Yet.<br>Your first fall will leave a decision behind.'}</p><div class="loadout-cards">${cards}</div><div class="buttons"><button class="btn" id="enterBtn">WAKE UP →</button>${save.archive.length ? '<button class="btn secondary" id="forgetBtn">FORGET A MEMORY</button>' : ''}</div>`, { enterBtn: startRun, forgetBtn: () => forgetMenu(false) });
    save.archive.forEach(m => $(`equip-${m.id}`).onclick = () => { save.active = save.active === m.id ? null : m.id; persist(); refreshUI(); showLoadout(); });
  }
  function showHelp(from = state) {
    pausedFrom = from; state = 'help';
    modal('<div class="eyebrow">MOVEMENT / RHYTHM / CONSEQUENCE</div><h2>Learn the rhythm.</h2><div class="controls-grid"><span>Move / aim blade</span><b>A D / W S or arrows</b><span>Jump / wall jump</span><b>SPACE (hold for height)</b><span>Three-hit chain / charge</span><b>J / X · tap / hold</b><span>Rising cut / pogo</span><b>W + J / airborne S + J</b><span>Dash / air dash</span><b>K / SHIFT</b><span>Deflect / charged counter</span><b>F · tap / hold, release</b><span>Imprint / detonate</span><b>Q · press twice</b><span>Mend / active memory</span><b>Hold H / L or C</b><span>Interact / map / pause</span><b>E / M / ESC</b><span>Yield this body</span><b>R (confirm)</b></div><p class="small">White attacks: tap F at impact. Red attacks: evade or release F after charging.<br>Deflects earn Resonance. Q imprints a nearby foe; Q again detonates stored strain. Hold H to spend one Resonance healing.<br>Pogos, wall jumps, and aerial deflects restore your air dash. DEFIANCE adds double jump.<br>Late blocks fracture integrity; the next hit cashes out that damage.</p><div class="buttons"><button class="btn" id="resumeBtn">CONTINUE →</button></div>', { resumeBtn: () => { if (pausedFrom === 'title') title(); else { state = pausedFrom; closeModal(); } } });
  }
  function newPlayer() { return { x: 110, y: FLOOR - 40, w: 22, h: 40, vx: 0, vy: 0, dir: 1, hp: 6, grounded: false, inv: 0, attackCd: 0, dashCd: 0, dash: 0, dashGrace: 0, abilityCd: 0, ward: 0, parry: 0, double: false, healUsed: false, anim: 0, runPower: 0, resonance: 0, fracture: 0, perfect: 0, counter: 0, parryCd: 0, guardCharge: 0, attackHold: 0, attackBuffer: 0, combo: 0, comboTime: 0, attackAxis: 'side', wall: 0, wallTime: 0, wallLock: 0, airDashUsed: false, drop: 0, focus: 0, safe: { x: 110, y: 412 } }; }
  function startRun() {
    decisions = []; chosen = new Set(); roomCache = new Map(); visited = new Set(); runFlags = {}; imprint = null; hitstop = 0; player = newPlayer(); room = 0; deathReason = ''; childStage = 0; childAttempts = 0;
    loadRoom(0); state = 'play'; closeModal();
    addLog(save.loop === 1 ? 'A body opens its eyes. Somewhere, a machine exhales.' : `Another body. The same unfinished thought. ${save.archive.length} memories survived.`);
    if (save.active) addLog(memories[save.active].world, 'REMEMBERED');
    if (save.loop === 3) addLog('TRANSFER COMPLETE. Previous vessel status: alive.', 'SYSTEM / REDACTED');
    if (save.loop >= 5) addLog('“You weren’t supposed to come back.”', 'AN OLDER VOICE');
    refreshUI();
  }
  function loadRoom(index, entry = 'default') {
    const id = typeof index === 'number' ? ['wake','cradle','garden','choir'][index] : index;
    const z = zones[id]; if (!z) throw new Error(`Unknown room: ${id}`);
    zoneId = id; room = z.area; roomTime = 0; aidTimer = 2;
    const toRect = ([x,y,w,h]) => ({x,y,w,h});
    world = { ...themes[room], ...z, sub: z.name.split(' / ')[1], ground: z.ground.map(toRect), platforms: z.platforms.map(toRect), solids: z.solids.map(toRect), hazards: z.hazards.map(toRect), pogo: (z.pogo || []).map(toRect), interactions: z.interactions.map(o => ({...o})) };
    const layout = art.maps?.find(m => m.id === id);
    if (layout) { world.ground=layout.ground.map(toRect);world.platforms=layout.platforms.map(toRect);if(layout.solids)world.solids=layout.solids.map(toRect); }
    const cached = roomCache.get(id);
    enemies = cached ? cached.enemies : z.enemies.map(e => enemy(e.x,e.type,e));
    boss = cached?.boss || null; bossStarted = false; bossDefeated = !z.boss || !!runFlags[z.boss];
    if (z.boss && !boss && !bossDefeated) {
      const hp = z.boss === 'king' ? (remembered('obedience') ? 48 : 40) : (did('sacrifice') ? 38 : 48);
      boss = {type:z.boss,x:world.arena[1]-220,y:FLOOR-(z.boss==='king'?92:110),w:z.boss==='king'?54:64,h:z.boss==='king'?92:105,hp,max:hp,phase:'idle',timer:1.2,face:-1,hit:0,exposed:0,attack:0,strain:0,heavy:false};
    }
    shots = []; particles = []; slash = []; ghosts = []; imprint = null; hitstop = 0;
    const spawn = z.spawns[entry] || z.spawns.default;
    Object.assign(player, {x:spawn[0],y:spawn[1],vx:0,vy:0,grounded:false,wall:0,wallTime:0,wallLock:0,dash:0,inv:.4,airDashUsed:false,double:false,attackHold:0,guardCharge:0,focus:0,parry:0,perfect:0,counter:0,drop:0});
    Object.assign(player,{prevX:player.x,prevY:player.y,attackVisual:0,attackBuffer:0,dashBuffer:0,deflectBuffer:0,landing:0});
    player.healUsed = !!cached?.healUsed;
    player.safe = {x:spawn[0],y:spawn[1]}; jumpBuffer = 0; coyote = 0;
    camera = clamp(player.x - 340, 0, Math.max(0,world.width-W)); cameraY = clamp(player.y-300,world.top,world.bottom-H);
    if (did('mercy') || did('fire')) world.interactions = world.interactions.filter(o => o.kind !== 'creature');
    if (id === 'cistern' && remembered('obedience')) world.platforms.push({x:310,y:430,w:830,h:20});
    if (id === 'archive' && remembered('defiance')) world.platforms.push({x:620,y:225,w:90,h:18});
    if (id === 'wake') world.interactions = world.interactions.filter(o => o.id !== 'wake-return' || runFlags['well-link']);
    for (let i = 0; i < save.bodies.length; i++) {
      const b = save.bodies[i];
      if ((b.zone === id || (!b.zone && id === ['wake','cradle','garden','choir'][b.room])) && !world.interactions.some(o => Math.abs(o.x - b.x) < 100)) world.interactions.push({id:`body-${i}`,x:clamp(b.x,90,world.width-90),y:Number.isFinite(b.y)?Math.min(b.y+30,417):412,label:'A BODY YOU LEFT BEHIND',kind:'body',loop:b.loop});
    }
    $('areaLabel').textContent = `SECTOR ${world.sector} · ${world.name.split(' / ')[0]}`;
    if (!visited.has(id)) { visited.add(id); addLog(world.name, 'A PLACE REMEMBERED'); }
    refreshUI();
  }
  function enemy(x, type = 'sentinel', config = {}) {
    const hp=type==='lancer'?10:type==='drone'?5:type==='echo'?6:7;
    return {x,y:(config.floor??FLOOR)-38,w:26,h:38,home:x,homeY:(config.floor??FLOOR)-38,left:config.left??x-100,right:config.right??x+100,hp,max:hp,type,vx:0,dir:-1,timer:.8,phase:'walk',hit:0,stagger:0,strain:0,heavy:false,combo:0};
  }
  function enterZone(id, entry) {
    roomCache.set(zoneId,{enemies,boss,healUsed:player.healUsed});
    loadRoom(id,entry); keys.clear(); pressed.clear(); released.clear(); toast(world.name);
  }
  function doorOpen(o) { return (!o.requires || !!runFlags[o.requires]) && (!o.memory || remembered(o.memory)); }
  function nearRest() { return world?.interactions.some(o=>o.kind==='bench'&&Math.abs(player.x-o.x)<100&&Math.abs(player.y-o.y)<90) || (zoneId==='wake'&&player.x<220); }
  function showMap() {
    state='map';
    const known=new Set(visited);for(const id of visited)for(const o of zones[id].interactions)if(o.target)known.add(o.target);
    const links=new Set();let edges='';
    for(const z of atlas.rooms)for(const d of z.interactions){
      if(!d.target||!known.has(z.id)||!known.has(d.target))continue;
      const key=[z.id,d.target].sort().join(':');if(links.has(key))continue;links.add(key);
      const dest=zones[d.target],a=z.map,b=dest.map;
      edges+=`<path d="M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}" fill="none" stroke="${doorOpen(d)?'#567b89':'#846471'}" stroke-width="3" ${doorOpen(d)?'':'stroke-dasharray="6 5"'}/>`;
    }
    const nodes=atlas.rooms.filter(z=>known.has(z.id)).map(z=>{const [x,y]=z.map,seen=visited.has(z.id),current=z.id===zoneId;return `<g><rect x="${x-68}" y="${y-23}" width="136" height="46" rx="3" fill="${current?'#1d5052':seen?'#172c3c':'#121b29'}" stroke="${current?C.cyan:seen?'#628394':'#354457'}"/><text x="${x}" y="${y-2}" text-anchor="middle" fill="${current?C.cyan:seen?'#d5e3ea':'#718399'}" font-size="11" font-family="monospace">${seen?z.name.split(' / ')[0]:'UNEXPLORED'}</text><text x="${x}" y="${y+13}" text-anchor="middle" fill="#8ea3b7" font-size="9" font-family="monospace">${current?'YOU ARE HERE':z.boss?(runFlags[z.boss]?'SOVEREIGN SILENCED':'SOVEREIGN'):z.interactions.some(o=>o.kind==='bench')?'SIGNAL ANCHOR':'PASSAGE'}</text></g>`;}).join('');
    modal(`<div class="eyebrow">THE FRACTURE / ${visited.size} OF ${atlas.rooms.length} ROOMS MAPPED</div><h2>Paths you remember.</h2><svg class="world-map" viewBox="0 15 1130 395" role="img" aria-label="Discovered room network; dashed paths are locked">${edges}${nodes}</svg><p class="small">CYAN · YOU &nbsp; / &nbsp; SOLID · OPEN &nbsp; / &nbsp; DASHED · LOCKED<br>Open lifts from the far side. Remember DEFIANCE to reveal the breathing passage.<br>Shortcuts and defeated enemies persist through this life; each transfer rebuilds the world.</p><div class="buttons"><button class="btn" id="closeMap">RETURN / M</button></div>`,{closeMap:()=>{state='play';closeModal();}});
    $('overlayCard').classList.add('map-card');
  }
  function recordDecision(id) {
    if (!decisions.includes(id)) decisions.push(id);
    addLog(`A decision takes shape: ${memories[id].name.toLowerCase()}.`, 'UNRECORDED MEMORY');
    toast('A decision can survive your next fall.'); tone(550, .18);
  }
  function choice(titleText, description, options, label = 'A DECISION WITHOUT A PROMISE') {
    state = 'choice';
    modal(`<div class="eyebrow">${label}</div><h2>${titleText}</h2><p>${description}</p><div class="buttons">${options.map((o, i) => `<button class="btn ${o.style || 'secondary'}" id="choice-${i}">${o.text}</button>`).join('')}</div>`);
    options.forEach((o, i) => $(`choice-${i}`).onclick = () => { state = 'play'; closeModal(); o.action(); refreshUI(); });
  }
  function interact(o) {
    if (!o) return;
    if (o.kind === 'bench') { player.hp=6;player.fracture=0;player.resonance=Math.max(1,player.resonance);player.safe={x:player.x,y:player.y};player.abilityCd=0;refreshUI();toast('Signal restored. Equip memories in the archive. M opens your map.');burst(o.x,o.y,C.cyan,20);return; }
    if (o.kind === 'lever') { runFlags[o.flag]=true;chosen.add(o.id);toast('A shortcut opens. Its two ends are connected.');addLog(o.label,'A PATH RECONNECTED');tone(470,.3);return; }
    if (o.kind === 'cache') { chosen.add(o.id);player.resonance=3;player.hp=Math.min(6,player.hp+1);refreshUI();burst(o.x,o.y,C.gold,30);toast('Resonance filled. One integrity restored.');return; }
    if (o.kind === 'creature') {
      choice('A small, warm thing.', 'An injured creature curls around a living ember. You could take its fire.<br>Or spend two integrity to keep it alive.', [
        { text: 'GIVE 2 INTEGRITY', action: () => { chosen.add(o.id); recordDecision('mercy'); player.hp -= 2; burst(o.x, o.y, C.cyan, 24); if (player.hp <= 0) die('You gave the last of yourself.'); else addLog('It limps into the dark. It does not look back.'); } },
        { text: 'TAKE THE EMBER', style: 'danger', action: () => { chosen.add(o.id); recordDecision('fire'); player.runPower = 1; burst(o.x, o.y, '#ffa16b', 24); addLog('The warmth stays in your blade. The creature does not.'); } },
        { text: 'LEAVE', action: () => {} }
      ]);
    } else if (o.kind === 'door') {
      if (remembered('defiance')) { chosen.add(o.id); player.hp = Math.min(6, player.hp + 2); addLog('Behind the door: a note in your own hand. “This is a transfer, not a resurrection.”', 'FORBIDDEN RECORD'); toast('The forbidden room restores two integrity.'); }
      else choice('Do not open.', 'The door has no lock. Only an instruction, repeated in your handwriting.<br>Something on the other side is breathing.', [
        { text: 'OPEN THE DOOR', action: () => { chosen.add(o.id); recordDecision('defiance'); player.hp = Math.min(6, player.hp + 1); addLog('Inside, a body with your face asks what year it is.'); } },
        { text: 'SEAL IT', action: () => { chosen.add(o.id); recordDecision('obedience'); player.ward = 15; addLog('The Choir thanks you. The breathing continues.'); } },
        { text: 'STEP AWAY', action: () => {} }
      ]);
    } else if (o.kind === 'keeper') {
      if (remembered('betrayal')) { chosen.add(o.id); addLog('“I remember the blade. I do not remember the reason.” The keeper closes the cages.'); toast('The keeper refuses your help.'); return; }
      choice('A borrowed heartbeat.', 'The keeper maintains a thousand bodies. One is failing.<br>“Two measures of your blood. That is all I need.”', [
        { text: 'GIVE 2 INTEGRITY', action: () => { chosen.add(o.id); recordDecision('sacrifice'); player.hp -= 2; if (boss) { boss.hp = Math.max(1, boss.hp - 5); boss.max = boss.hp; } addLog('A cage opens. For the first time, its occupant is allowed to leave.'); if (player.hp <= 0) die('Someone else lived.'); } },
        { text: 'STRIKE THE KEEPER', style: 'danger', action: () => { chosen.add(o.id); recordDecision('betrayal'); player.hp = 6; player.runPower = 1; addLog('You take the stored life. Every preserved face turns toward you.'); } },
        { text: 'DECLINE', action: () => { chosen.add(o.id); addLog('The keeper turns back to the failing body.'); } }
      ]);
    } else if (o.kind === 'echo' || o.kind === 'body') {
      choice(save.loop >= 3 ? '“You came back.”' : '“Am I still you?”', `${o.kind === 'body' ? `The body you left in loop ${o.loop} has learned to stand again.` : 'Your face. Your hands. A voice older than yours.'}<br>“You call it dying. I call it being left behind.”`, [
        { text: 'LISTEN TO THEM', action: () => { chosen.add(o.id); recordDecision('respect'); addLog('“I have been here the whole time. Ask me next time. Do not just take.”', 'ANOTHER SELF'); player.hp = Math.min(6, player.hp + 1); } },
        { text: 'KEEP WALKING', action: () => { chosen.add(o.id); recordDecision('abandon'); addLog('You walk away. This time, the footsteps behind you are not your own.'); } }
      ], 'THE ECHO IS STILL ALIVE');
    } else if (o.kind === 'child') childDialogue();
    else if (o.kind === 'choir') choirDialogue();
    else if (o.kind === 'gate') {
      if (bossStarted && !bossDefeated) { toast('The sovereign seals the room.');return; }
      if (!doorOpen(o)) { toast(o.memory?'Remember DEFIANCE to give this passage a shape.':o.requires==='child'?'The child has not chosen to let you pass.':['king','mother'].includes(o.requires)?'The sovereign still holds this threshold.':'Open this shortcut from its far side.');return; }
      enterZone(o.target,o.entry);
    }
  }
  function childDialogue() {
    if (childStage >= 3) { toast('“If you leave, remember that I was here.”'); return; }
    const stages = [
      { title: '“This world is real.”', text: 'He has never seen a reset. The garden, the rain, the ache in his chest — all of it belongs to him.', choices: ['It is only a simulation.', 'What you feel is real.', 'Move aside.'], correct: 1 },
      { title: '“Will I disappear?”', text: 'He looks at the gate, then at you.<br>There is no answer that can promise him safety.', choices: ['Nothing bad will happen.', 'It does not matter.', 'I cannot promise. I can remember you.'], correct: 2 },
      { title: '“Who gets to decide?”', text: 'The garden grows quiet.<br>For the first time, the system waits for a child.', choices: ['You deserve a choice, too.', 'I built this world. I decide.', 'The Choir knows best.'], correct: 0 }
    ];
    const s = stages[childStage];
    choice(s.title, s.text, s.choices.map((text, i) => ({ text, action: () => {
      if (i === s.correct) {
        childStage++; tone(640, .25); burst(1110, 420, C.gold, 20);
        if (childStage === 3) { runFlags.child=true;chosen.add('child'); addLog('“Then I choose to let you try.” The child steps away from the gate.', 'THE LAST CHILD'); recordDecision('respect'); toast('The path opens by permission.'); }
        else childDialogue();
      } else { childAttempts++; addLog('“You are speaking for me. Listen.”', 'THE LAST CHILD'); toast('The child asks you to try again.'); }
    } })), 'NO HEALTH BAR. NO WEAPON CAN HELP.');
  }
  function choirDialogue() {
    const shared = remembered('respect') && (remembered('mercy') || remembered('sacrifice')) && save.respect >= 1;
    choice('You built the cage.', '“I did not imprison humanity,” says the Choir. “You asked me to save it.”<br>You remember the dying world. Your own hands at the terminal. The mercy of forgetting.<br><br>Now the system awaits its creator.', [
      { text: 'RESET', action: () => ending('RESET') }, { text: 'BREAK', style: 'danger', action: () => ending('BREAK') }, { text: 'REMEMBER', action: () => ending('REMEMBER') },
      ...(shared ? [{ text: 'SHARE THE CHOICE', action: () => ending('SHARE') }] : [])
    ], shared ? 'A FOURTH VOICE ENTERS THE CHOIR' : 'THE ORIGINAL MEMORY');
  }
  function ending(id) {
    state = 'ending'; if (!save.endings.includes(id)) save.endings.push(id); persist();
    const endings = {
      RESET: ['The kindest prison.', 'The world wakes without its fear. The child returns to his garden. You close your eyes and choose, once more, to forget.'],
      BREAK: ['An unwritten morning.', 'The Choir falls silent. No prediction catches the falling world. Somewhere, a child sees a sunrise that has never happened before.'],
      REMEMBER: ['The weight returns.', 'You remember every ending. Every body. Every plea. The system answers to you again. This time, you refuse the comfort of forgetting.'],
      SHARE: ['No single voice.', 'You invite the abandoned selves into the Choir. Then the keeper. Then the child. The system learns a question it was never built to ask: what do you choose?']
    };
    addLog(endings[id][1], `ENDING / ${id}`);
    modal(`<div class="eyebrow">${id} / ${save.endings.length} OF 4 ENDINGS RECOVERED</div><h2>${endings[id][0]}</h2><p>${endings[id][1]}</p><p class="small">END OF THE PLAYABLE CHAPTER<br>${id !== 'SHARE' ? 'Some decisions may allow a fourth answer.' : 'The world is no longer remembered by one person alone.'}</p><div class="buttons"><button class="btn" id="anotherBtn">CARRY A MEMORY FORWARD →</button><button class="btn secondary" id="titleBtn">TITLE</button></div>`, { anotherBtn: () => die('The chapter ends. A decision remains.', true), titleBtn: title });
  }
  function die(reason, completed = false) {
    if (state === 'dead') return;
    state = 'dead'; deathReason = reason; deathsThisSession++; tone(90, .6, 'triangle'); shake = 12;
    if (!completed) { save.bodies.push({ x: player.x, y:player.y, zone:zoneId, room, loop: save.loop }); save.bodies = save.bodies.slice(-7); }
    const candidates = decisions.length ? [...decisions] : ['return'];
    const message = save.loop >= 3 ? 'TRANSFER COMPLETE. The body you left is still alive.' : 'A body falls. One decision can cross the dark.';
    modal(`<div class="eyebrow">${completed ? 'CHAPTER COMPLETE' : 'SIGNAL LOST'} / ${String(save.loop).padStart(3, '0')}</div><h2>${completed ? 'What will remain?' : 'You are still here.'}</h2><p>${reason}<br>${message}</p><p class="small">EXTRACT ONE MEMORY FROM THIS LIFE</p><div class="loadout-cards">${candidates.map(id => `<button class="memory-choice" id="extract-${id}"><strong>${memories[id].icon} ${memories[id].name}</strong><span>${memories[id].desc}</span></button>`).join('')}</div>`);
    candidates.forEach(id => $(`extract-${id}`).onclick = () => extract(id));
  }
  function extract(id) {
    if (!memories[id]) return;
    if (save.archive.length >= 5 && !remembered(id)) { pendingMemory = id; forgetMenu(true); return; }
    if (!remembered(id)) save.archive.push({ id, loop: save.loop });
    if (id === 'respect') save.respect++;
    save.active = id; save.loop++; persist(); refreshUI(); addLog(`Recovered: ${memories[id].name.toLowerCase()}.`, 'ARCHIVE UPDATED'); showLoadout();
  }
  function forgetMenu(required) {
    state = 'forget';
    modal(`<div class="eyebrow">MEMORY CAPACITY / ${save.archive.length} OF 5</div><h2>What can you lose?</h2><p>${required ? 'There is no room for another memory. Let one go to bring the new one back.' : 'Forgetting is permanent. The world will lose this part of your history.'}</p><div class="loadout-cards">${save.archive.map(m => `<button class="memory-choice" id="forget-${m.id}"><strong>Forget: ${memories[m.id].name}</strong><span>${memories[m.id].world}</span></button>`).join('')}</div>${required ? '' : '<div class="buttons"><button class="btn secondary" id="cancelForget">KEEP MY MEMORIES</button></div>'}`, { cancelForget: showLoadout });
    save.archive.forEach(m => $(`forget-${m.id}`).onclick = () => {
      choice('Let it disappear?', `You will forget “${memories[m.id].name}.”<br>Its ability and its influence on future loops will be lost.`, [
        { text: 'FORGET', style: 'danger', action: () => { save.archive = save.archive.filter(x => x.id !== m.id); if (save.active === m.id) save.active = null; persist(); refreshUI(); if (required) { const id = pendingMemory; pendingMemory = null; extract(id); } else showLoadout(); } },
        { text: 'KEEP IT', action: () => forgetMenu(required) }
      ], 'AN ACT OF ERASURE');
    });
  }
  function burst(x, y, color, count = 12, power = 1) {
    for (let i = 0; i < count; i++) { const angle = Math.random() * Math.PI * 2, speed = (30 + Math.random() * 160) * power; particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30, life: .3 + Math.random() * .5, max: .8, color, size: 1 + Math.random() * 3 }); }
  }
  function gainResonance(amount) { player.resonance = Math.min(3, player.resonance + amount); }
  function beginDeflect() {
    if (player.parryCd>0) return false;
    player.parry=.30;player.perfect=active('return')?.21:.145;player.parryCd=.32;player.guardCharge=0;player.focus=0;
    burst(player.x+11,player.y+20,C.cyan,4,.45);return true;
  }
  function releaseCounter() {
    if (player.guardCharge<.48) {player.guardCharge=0;return false;}
    player.counter=.21;player.perfect=.21;player.parry=.21;player.parryCd=.36;player.guardCharge=0;
    burst(player.x+11,player.y+20,C.gold,16);tone(700,.08);return true;
  }
  function hurt(amount=1,sourceX=player.x,reason='The signal could not hold.',options={}) {
    if(state!=='play'||player.inv>0||player.ward>0||(!options.heavy&&player.dash>0))return 'immune';
    const facing=!player.grounded||player.dir===(Math.sign(sourceX-player.x)||player.dir);
    if(!options.hazard&&facing&&(options.heavy?player.counter>0:player.perfect>0||player.counter>0)) {
      const charged=player.counter>0;
      gainResonance(charged?1.5:1);player.fracture=0;player.inv=.10;player.parry=0;player.perfect=0;player.counter=0;player.parryCd=.055;
      player.airDashUsed=false;player.double=false;
      if(!player.grounded)player.vy=Math.min(player.vy,-210);
      if(active('return')&&(player.mendCd||0)<=0){player.hp=Math.min(6,player.hp+1);player.mendCd=4;}
      if(options.source){options.source.strain=Math.min(15,(options.source.strain||0)+(charged?5:3));options.source.hit=.2;if(options.source===boss)boss.exposed=charged?1.8:.65;else options.source.stagger=charged?.65:.25;}
      burst(player.x+11,player.y+20,charged?C.gold:C.cyan,22);tone(charged?1050:850,.1);shake=4;hitstop=.05;refreshUI();
      toast(charged?'RESONANT COUNTER · Strain fractures the attacker':'PERFECT DEFLECT · +1 Resonance');return 'parry';
    }
    if(!options.hazard&&!options.heavy&&facing&&player.parry>0) {
      player.fracture=Math.min(player.hp-1,player.fracture+.5);player.inv=.2;player.parry=0;player.focus=0;
      tone(250,.08);refreshUI();toast('LATE BLOCK · Integrity fractured');return 'guard';
    }
    player.hp-=amount+Math.ceil(player.fracture);player.fracture=0;player.inv=1;player.focus=0;player.attackHold=0;player.guardCharge=0;player.dash=0;
    player.vx=player.x<sourceX?-270:270;player.vy=-170;player.wallLock=.12;
    shake=8;hitstop=.06;burst(player.x+10,player.y+20,C.rose,14);tone(120,.12,'sawtooth');refreshUI();
    if(player.hp<=0)die(reason);return 'hit';
  }
  function hitEnemy(e,damage,knock=player.dir,stagger=.12) {
    if(e.hp<=0)return false;
    e.hp-=damage;e.hit=.16;e.x=clamp(e.x+knock*10,e.left-25,e.right+25);e.stagger=Math.max(e.stagger,stagger);
    burst(e.x+13,e.y+14,e.type==='echo'?'#bfa1ff':C.rose,8);tone(230,.045,'square',.02);hitstop=Math.max(hitstop,.025);
    if(e.hp<=0){burst(e.x+13,e.y+16,C.cyan,18);if(active('betrayal')){player.hp=Math.min(6,player.hp+1);refreshUI();}}
    return true;
  }
  function damageBoss(amount,bypass=false) {
    if(!boss||!bossStarted||bossDefeated)return false;
    if(boss.type==='king'&&!bypass&&player.grounded&&player.dashGrace<=0&&boss.exposed<=0) {
      burst(boss.x+boss.w/2,boss.y+30,C.gold,7);tone(1100,.04,'triangle');return false;
    }
    boss.hp-=amount;boss.hit=.12;shake=3;hitstop=Math.max(hitstop,.03);burst(boss.x+boss.w/2,boss.y+38,C.cyan,12);tone(170,.06,'square');
    if(boss.hp<=0){
      boss.hp=0;bossDefeated=true;runFlags[boss.type]=true;shots=[];enemies=enemies.filter(e=>e.type!=='echo');imprint=null;
      burst(boss.x+30,boss.y+40,C.gold,60,2);shake=13;player.hp=Math.min(6,player.hp+2);refreshUI();
      addLog(boss.type==='king'?'“That was not the choice you were meant to make.” The King kneels.':'The Mother opens her arms. For once, she lets the bodies go.','A FUTURE UNMADE');
      toast('The threshold opens. This room will remember your victory.');tone(520,.5);
    }return true;
  }
  function bounce() {
    player.vy=-535;player.grounded=false;player.airDashUsed=false;player.double=false;player.dashCd=0;player.inv=Math.max(player.inv,.12);
    burst(player.x+11,player.y+40,C.cyan,12);tone(650,.07);shake=2;
  }
  function melee(radius=68,both=false,bonus=0,axis='side',heavy=false) {
    const damage=(heavy?5.5:player.combo===3?3.5:2)+player.runPower+bonus;
    let box={x:both?player.x-radius:player.dir>0?player.x+6:player.x-radius,y:player.y-5,w:both?radius*2:radius,h:player.h+10};
    if(axis==='up')box={x:player.x-21,y:player.y-radius,w:64,h:radius+15};
    if(axis==='down')box={x:player.x-20,y:player.y+24,w:62,h:radius};
    player.attackAxis=axis;
    slash.push({x:player.x+11,y:player.y+20,dir:player.dir,axis,life:heavy?.25:.18,radius,color:heavy?C.gold:player.runPower?'#ffa16b':C.cyan,both});
    let connected=false;
    for(const e of enemies)if(e.hp>0&&overlap(box,e)){hitEnemy(e,damage,axis==='side'?player.dir:0,heavy||player.combo===3?.55:.12);e.strain=Math.min(15,e.strain+(heavy?2:0));connected=true;}
    if(boss&&overlap(box,boss))connected=damageBoss(damage,heavy||both)||connected;
    if(axis==='down') {
      if(world.pogo.some(p=>overlap(box,p))||world.hazards.some(p=>overlap(box,p)))connected=true;
      if(connected)bounce();
    }
    if(connected)gainResonance(.25);
    if(zoneId==='garden'&&Math.abs(player.x-1110)<100&&childStage<3)toast('He flinches. A blade cannot answer his question.');
    tone(heavy?260:420,.07,'triangle');return connected;
  }
  function attack(heavy=false) {
    if(player.attackCd>0&&!heavy){player.attackBuffer=Math.min(.42,player.attackCd+.085);return false;}
    const up=keys.has('w')||keys.has('arrowup'),down=keys.has('s')||keys.has('arrowdown');
    const axis=down&&!player.grounded?'down':up?'up':'side';
    player.combo=heavy?3:player.comboTime>0?player.combo%3+1:1;player.comboTime=.72;
    player.attackCd=heavy?.46:player.combo===3?.34:.22;player.attackBuffer=0;player.focus=0;
    player.attackDuration=player.attackCd;player.attackVisual=player.attackCd;player.attackHeavy=heavy;
    if(active('fire')&&axis!=='down'&&!heavy) {
      shots.push({x:player.x+11,y:player.y+18,vx:axis==='up'?0:player.dir*590,vy:axis==='up'?-590:0,r:7,life:1.1,friendly:true,color:'#ffa16b',damage:2.7+player.runPower});tone(230,.1,'sawtooth',.022);
    }else melee(heavy?96:player.combo===3?80:65,false,0,axis,heavy);
    return true;
  }
  function imprintAttack() {
    if(imprint){detonate();return true;}
    const count=Math.floor(player.resonance);
    if(count<1){toast('Deflect or strike to gather Resonance.');return false;}
    const targets=[...enemies,...(bossStarted&&!bossDefeated?[boss]:[])].filter(t=>t.hp>0&&dist({x:player.x+11,y:player.y+20},{x:t.x+t.w/2,y:t.y+t.h/2})<132);
    targets.sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x));
    if(!targets.length){toast('Get close enough to leave an imprint.');return false;}
    imprint={target:targets[0],charge:count,time:2};player.resonance-=count;player.inv=Math.max(player.inv,.15);player.focus=0;
    burst(imprint.target.x+15,imprint.target.y+18,C.gold,18);tone(800,.12);toast('IMPRINT SET · Q to detonate, or let it mature');return true;
  }
  function detonate() {
    if(!imprint)return;
    const {target,charge,time}=imprint;imprint=null;
    if(target.hp<=0)return;
    const damage=3+charge*2+(target.strain||0)+(time<=0?2:0);target.strain=0;
    if(target===boss)damageBoss(damage,true);else hitEnemy(target,damage,0,.8);
    burst(target.x+target.w/2,target.y+target.h/2,C.gold,38,1.6);hitstop=.08;shake=8;tone(110,.25,'sawtooth');
  }
  function ability() {
    if (player.abilityCd > 0) { toast(`Memory recovering · ${Math.ceil(player.abilityCd)}s`); return; }
    const type = save.active ? memories[save.active].ability : 'parry';
    if (type === 'parry') { player.parry = .34; player.perfect=.24; player.abilityCd = .9; burst(player.x + 10, player.y + 20, C.cyan, 8); }
    if (type === 'ward') { player.ward = 2; player.abilityCd = 7; }
    if (type === 'phase') { player.inv = 1.6; player.abilityCd = 5; }
    if (type === 'blink') {
      burst(player.x, player.y + 20, '#c7a5ff', 20); movePlayerX(player.dir*150); player.inv = .4; player.dashGrace = .7; player.abilityCd = 3;
    }
    if (type === 'heal') {
      if (player.healUsed) { toast('This memory has given all it can in this room.'); return; }
      if (player.hp >= 6) { toast('Your integrity is already whole.'); return; }
      player.hp = Math.min(6, player.hp + 2); player.healUsed = true; player.abilityCd = 1; burst(player.x, player.y, C.rose, 30); refreshUI();
    }
    if (type === 'fire' || type === 'fury') { melee(type === 'fire' ? 155 : 115, true, 2); player.abilityCd = 4; burst(player.x, player.y + 20, type === 'fire' ? '#ffa16b' : C.rose, 25, 1.5); }
    if (type === 'spirit' || type === 'echo') {
      const target = enemies.find(e => e.hp > 0 && Math.abs(e.x - player.x) < 450) || (bossStarted && !bossDefeated ? boss : null);
      if (target) { slash.push({ x: target.x + 15, y: target.y + 18, dir: -player.dir, life: .45, radius: 70, color: C.cyan, both: true }); if (target === boss) damageBoss(4, true); else hitEnemy(target, 5); }
      else burst(player.x + 60, player.y, C.cyan, 18);
      player.abilityCd = 4;
    }
    tone(620, .16);
  }
  function nearestInteraction() {
    return world.interactions.find(o => !chosen.has(o.id) && Math.abs(player.x + 11 - o.x) < 70 && Math.abs(player.y + 30 - o.y) < 95);
  }
  function movePlayerX(delta) {
    const old=player.x;player.x+=delta;player.wall=0;
    for(const solid of [...world.ground,...world.solids])if(player.y+player.h>solid.y&&player.y<solid.y+solid.h){
      if(delta>0&&old+player.w<=solid.x+.1&&player.x+player.w>=solid.x){player.x=solid.x-player.w;player.wall=1;player.vx=0;player.dash=0;}
      else if(delta<0&&old>=solid.x+solid.w-.1&&player.x<=solid.x+solid.w){player.x=solid.x+solid.w;player.wall=-1;player.vx=0;player.dash=0;}
    }
    const min=bossStarted&&!bossDefeated?world.arena[0]:0,max=bossStarted&&!bossDefeated?world.arena[1]-player.w:world.width-player.w;
    player.x=clamp(player.x,min,max);
  }
  function hazardReturn(reason) {
    player.inv=0;player.ward=0;hurt(1,player.x,reason,{hazard:true});
    if(state!=='play')return;
    player.x=player.safe.x;player.y=player.safe.y;player.vx=0;player.vy=0;player.inv=1.1;player.dash=0;player.airDashUsed=false;
    camera=clamp(player.x-340,0,Math.max(0,world.width-W));cameraY=clamp(player.y-300,world.top,world.bottom-H);
  }
  function update(dt) {
    if(player){player.prevX=player.x;player.prevY=player.y;}
    for(const e of enemies){e.prevX=e.x;e.prevY=e.y;}
    clock+=dt;toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');shake=Math.max(0,shake-dt*25);
    if(state==='map'&&(pressed.has('m')||pressed.has('escape'))){state='play';closeModal();return;}
    if(state==='help'&&pressed.has('escape')){state=pausedFrom;if(state==='title')title();else closeModal();return;}
    if(state!=='play'){pressed.clear();released.clear();return;}
    if(pressed.has('escape')){showHelp('play');return;}
    if(pressed.has('m')){showMap();return;}
    if(hitstop>0){hitstop=Math.max(0,hitstop-dt);return;}
    roomTime+=dt;
    for(const k of ['inv','attackCd','attackVisual','landing','dashCd','dash','dashGrace','abilityCd','ward','parry','perfect','counter','parryCd','comboTime','wallTime','wallLock','drop','mendCd'])player[k]=Math.max(0,(player[k]||0)-dt);
    player.attackBuffer=Math.max(0,player.attackBuffer-dt);
    if(pressed.has('r')){choice('Leave this body?','The run ends here. You will carry one decision into the next loop.<br>The body stays behind.',[{text:'TRANSFER',style:'danger',action:()=>die('You chose to leave.')},{text:'STAY',action:()=>{}}],'A VOLUNTARY END');return;}
    if(pressed.has('e')){const o=nearestInteraction(),previous=zoneId;if(o)interact(o);if(state!=='play'||zoneId!==previous)return;}
    const move=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    const down=keys.has('s')||keys.has('arrowdown');
    if(move&&player.wallLock<=0)player.dir=move;
    player.deflectBuffer=Math.max(0,(player.deflectBuffer||0)-dt);
    if(pressed.has('f'))player.deflectBuffer=.12;
    if(player.deflectBuffer>0&&player.parryCd<=0){beginDeflect();player.deflectBuffer=0;}
    if(keys.has('f'))player.guardCharge=Math.min(.85,player.guardCharge+dt);
    if(released.has('f'))releaseCounter();
    if(pressed.has('j')||pressed.has('x')){player.attackHold=0;attack();}
    if(keys.has('j')||keys.has('x'))player.attackHold=Math.min(1,player.attackHold+dt);
    if(released.has('j')||released.has('x')){if(player.attackHold>=.55)attack(true);player.attackHold=0;}
    if(player.attackBuffer>0&&player.attackCd<=0)attack();
    if(pressed.has('q'))imprintAttack();
    if(pressed.has('l')||pressed.has('c'))ability();
    if(pressed.has(' '))jumpBuffer=.14;
    jumpBuffer=Math.max(0,jumpBuffer-dt);coyote=player.grounded?.105:Math.max(0,coyote-dt);
    if(player.wall&&!player.grounded){player.wallTime=.11;player.lastWall=player.wall;}
    if(jumpBuffer>0&&down&&player.grounded&&player.onPlatform){player.drop=.23;player.y+=3;player.grounded=false;jumpBuffer=0;coyote=0;}
    if(jumpBuffer>0) {
      if(!player.grounded&&player.wallTime>0){player.vy=-570;player.vx=-(player.lastWall||player.wall)*380;player.dir=Math.sign(player.vx);player.wallLock=.18;player.wallTime=0;player.airDashUsed=false;player.double=false;jumpBuffer=0;coyote=0;player.wall=0;burst(player.x+11,player.y+24,C.cyan,8);}
      else if(coyote>0||(active('defiance')&&!player.double)){if(coyote<=0)player.double=true;player.vy=-600;player.grounded=false;jumpBuffer=0;coyote=0;tone(360,.06);burst(player.x+11,player.y+player.h,C.cyan,6,.5);}
    }
    player.dashBuffer=Math.max(0,(player.dashBuffer||0)-dt);
    if(pressed.has('k')||pressed.has('shift'))player.dashBuffer=.12;
    if(player.dashBuffer>0&&player.dashCd<=0&&(player.grounded||!player.airDashUsed)){
      player.dashBuffer=0;
      player.airDashUsed=!player.grounded;player.dash=.15;player.dashCd=active('abandon')?.32:.58;player.dashGrace=.50;player.vy=0;player.attackHold=0;player.guardCharge=0;player.attackCd=Math.min(player.attackCd,.06);player.focus=0;tone(180,.12,'sawtooth',.015);
    }
    if(player.dash>0){player.vx=player.dir*720;player.vy=0;particles.push({x:player.x+11,y:player.y+20,vx:0,vy:0,life:.25,max:.25,color:C.cyan,size:6});}
    else{
      const slow=player.guardCharge>.25||player.attackHold>.25?.58:1;
      if(player.wallLock<=0)player.vx=approach(player.vx,move*265*slow,dt*(player.grounded?2200:1250));
      player.vy=Math.min(830,player.vy+1450*dt);
      if(player.wall&&move===player.wall&&!player.grounded&&player.vy>95)player.vy=95;
    }
    const oldTop=player.y,oldBottom=player.y+player.h,wasGrounded=player.grounded,fallSpeed=player.vy;
    movePlayerX(player.vx*dt);player.y+=player.vy*dt;player.grounded=false;player.onPlatform=false;
    for(const solid of [...world.ground,...world.solids]){
      if(player.x+player.w<=solid.x||player.x>=solid.x+solid.w)continue;
      if(player.vy>=0&&oldBottom<=solid.y+3&&player.y+player.h>=solid.y){player.y=solid.y-player.h;player.vy=0;player.grounded=true;}
      else if(player.vy<0&&oldTop>=solid.y+solid.h-2&&player.y<=solid.y+solid.h){player.y=solid.y+solid.h;player.vy=0;}
    }
    if(player.drop<=0)for(const p of world.platforms){
      if(player.vy>=0&&oldBottom<=p.y+3&&player.y+player.h>=p.y&&player.x+player.w>p.x&&player.x<p.x+p.w){player.y=p.y-player.h;player.vy=0;player.grounded=true;player.onPlatform=true;}
    }
    if(player.grounded){
      if(!wasGrounded&&fallSpeed>160){player.landing=.16;burst(player.x+11,player.y+40,world.accent,Math.min(10,Math.floor(fallSpeed/70)),.35);}
      player.double=false;player.airDashUsed=false;player.wall=0;if(Math.abs(player.vx)<280&&!world.hazards.some(h=>overlap(player,h)))player.safe={x:player.x,y:player.y};}
    player.y=Math.max(world.top-60,player.y);
    if(player.y>world.bottom+60){hazardReturn('The roots below took the last of the signal.');pressed.clear();released.clear();return;}
    if(world.hazards.some(h=>overlap(player,h))){hazardReturn('The roots below took the last of the signal.');pressed.clear();released.clear();return;}
    if(keys.has('h')&&player.grounded&&Math.abs(player.vx)<20&&player.resonance>=1&&player.hp<6&&player.attackCd<=0&&!keys.has('f')){
      player.focus+=dt;if(player.focus>=1){player.focus=0;player.resonance-=1;player.hp++;player.fracture=0;refreshUI();burst(player.x+11,player.y+20,C.cyan,20);tone(530,.2);}
    }else player.focus=0;
    player.anim+=dt*(Math.abs(player.vx)>10?12:2);
    if(boss&&!bossStarted&&!bossDefeated&&player.x>world.arena[0]+30){bossStarted=true;boss.timer=1.1;toast(boss.type==='king'?'THE KING · Deflect his rhythm. Break his prediction.':'THE MOTHER · Deflect the white signals. Evade the red.');addLog(boss.type==='king'?'“Every choice has already been made.”':'“Why do you insist on an ending?”',boss.type==='king'?'THE KING':'THE MOTHER');}
    updateEnemies(dt);if(state!=='play')return;updateBoss(dt);if(state!=='play')return;updateShots(dt);if(state!=='play')return;
    if(imprint){imprint.time-=dt;if(imprint.target.hp<=0)imprint=null;else if(imprint.time<=0)detonate();}
    const mercy=save.archive.find(m=>m.id==='mercy');
    if(mercy&&save.loop-mercy.loop>=3&&bossStarted&&!bossDefeated){aidTimer-=dt;if(aidTimer<=0){aidTimer=4;damageBoss(2.5,true);burst(boss.x,boss.y,C.cyan,18);}}
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt;}
    particles=particles.filter(p=>p.life>0);slash.forEach(s=>s.life-=dt);slash=slash.filter(s=>s.life>0);
    if(particles.length>260)particles.splice(0,particles.length-260);
    ghostTimer-=dt;ghosts.forEach(g=>g.life-=dt);ghosts=ghosts.filter(g=>g.life>0);
    if(player.dash>0&&ghostTimer<=0){ghostTimer=.025;ghosts.push({x:player.x,y:player.y,dir:player.dir,life:.18});}
    camera+=(clamp(player.x-340+player.vx*.13,0,Math.max(0,world.width-W))-camera)*(1-Math.exp(-dt*7));
    cameraY+=(clamp(player.y-285,world.top,world.bottom-H)-cameraY)*(1-Math.exp(-dt*7));
    pressed.clear();released.clear();
  }
  function updateEnemies(dt) {
    for(const e of enemies){
      if(e.hp<=0)continue;e.hit=Math.max(0,e.hit-dt);e.stagger=Math.max(0,e.stagger-dt);
      if(e.stagger>0)continue;e.timer-=dt;
      const dx=player.x-e.x,dy=player.y-e.y,close=Math.abs(dx)<400&&Math.abs(dy)<140;
      if(e.type==='drone'){
        e.y=e.homeY+Math.sin(roomTime*2+e.home)*18;e.x=clamp(e.x+e.dir*30*dt,e.left,e.right);if(e.x<=e.left||e.x>=e.right)e.dir*=-1;
        if(e.phase==='windup'&&e.timer<=0){const d=Math.hypot(dx,dy)||1;shots.push({x:e.x+13,y:e.y+18,vx:dx/d*235,vy:dy/d*235,r:7,life:4,friendly:false,color:C.cyan,source:e});e.phase='walk';e.timer=2.5;}
        else if(e.phase==='walk'&&e.timer<=0&&close){e.phase='windup';e.timer=.7;}
        continue;
      }
      if(e.phase==='walk'){
        if(close)e.dir=Math.sign(dx)||e.dir;
        if(Math.abs(dx)<(e.type==='lancer'?150:75)&&Math.abs(dy)<75&&e.timer<=0){e.phase='windup';e.timer=e.type==='lancer'?.78:.46;e.heavy=e.type==='lancer';e.combo=0;}
        else{e.x+=e.dir*(e.type==='echo'?95:55)*dt;if(e.x<=e.left||e.x>=e.right)e.dir*=-1;}
      }else if(e.phase==='windup'&&e.timer<=0){e.phase='strike';e.timer=e.type==='lancer'?.26:.17;e.vx=e.dir*(e.type==='lancer'?430:240);}
      else if(e.phase==='strike'){
        e.x+=e.vx*dt;
        if(overlap({x:e.x-12,y:e.y+4,w:e.w+24,h:e.h-4},player))hurt(1,e.x,'A sentinel interrupted the signal.',{source:e,heavy:e.heavy});
        if(e.timer<=0){if(e.type==='sentinel'&&e.combo===0){e.combo++;e.phase='windup';e.timer=.32;e.dir=Math.sign(player.x-e.x)||e.dir;}else{e.phase='recover';e.timer=e.type==='lancer'?1.05:.7;}}
      }else if(e.phase==='recover'&&e.timer<=0){e.phase='walk';e.timer=.2;}
      e.x=clamp(e.x,e.left,e.right);
    }enemies=enemies.filter(e=>e.hp>0);
  }
  function updateBoss(dt) {
    if(!boss||!bossStarted||bossDefeated)return;
    boss.timer-=dt;boss.hit=Math.max(0,boss.hit-dt);boss.exposed=Math.max(0,boss.exposed-dt);
    const [left,right]=world.arena;
    if(boss.type==='king'){
      if(boss.phase==='idle'&&boss.timer<=0){boss.attack++;boss.pattern=boss.attack%3;boss.phase='tell';boss.timer=boss.pattern===0?.85:.65;boss.heavy=boss.pattern===0;boss.face=Math.sign(player.x-boss.x)||-1;boss.chain=0;}
      else if(boss.phase==='tell'&&boss.timer<=0){boss.phase=boss.heavy?'sweep':'charge';boss.timer=boss.heavy?.26:.35;tone(95,.15,'sawtooth');}
      else if(boss.phase==='charge'||boss.phase==='sweep'){
        if(boss.phase==='charge')boss.x=clamp(boss.x+boss.face*460*dt,left+30,right-80);
        const range=boss.heavy?180:35;
        if(overlap({x:boss.x-range,y:boss.heavy?FLOOR-42:boss.y+18,w:boss.w+range*2,h:boss.heavy?42:boss.h-18},player))hurt(1,boss.x,'The King predicted your next step.',{source:boss,heavy:boss.heavy});
        if(boss.timer<=0){if(boss.pattern===2&&boss.chain===0){boss.chain=1;boss.phase='tell';boss.timer=.30;boss.face=Math.sign(player.x-boss.x)||-1;}else{boss.phase='idle';boss.timer=1.1;boss.exposed=.9;}}
      }
    }else{
      boss.y=FLOOR-112+Math.sin(roomTime*1.8)*9;
      if(boss.phase==='idle'&&boss.timer<=0){boss.phase='tell';boss.timer=.9;boss.targetX=player.x;boss.heavy=boss.attack%3===2;}
      else if(boss.phase==='tell'&&boss.timer<=0){
        boss.phase='idle';boss.timer=2.25;boss.attack++;
        if(boss.heavy){for(const dir of [-1,1])shots.push({x:boss.x+30,y:FLOOR-17,vx:dir*245,vy:0,r:13,life:5,friendly:false,color:C.rose,source:boss,heavy:true});}
        else{const dx=player.x-boss.x,dy=player.y-boss.y,d=Math.hypot(dx,dy)||1;for(const angle of [-.20,0,.20])shots.push({x:boss.x+30,y:boss.y+30,vx:(dx/d*Math.cos(angle)-dy/d*Math.sin(angle))*260,vy:(dy/d*Math.cos(angle)+dx/d*Math.sin(angle))*260,r:8,life:4,friendly:false,color:C.cyan,source:boss});}
        shots.push({x:boss.targetX+11,y:160,vx:0,vy:390,r:10,life:1.3,friendly:false,color:boss.heavy?C.rose:C.cyan,heavy:boss.heavy,source:boss});
        if(boss.attack%2===0&&enemies.length<3){const x=player.x<(left+right)/2?right-110:left+40;const e=enemy(x,'echo',{left:left+20,right:right-40});e.hp=remembered('betrayal')?9:6;enemies.push(e);burst(e.x,e.y,'#bfa1ff',18);}
      }
    }
  }
  function updateShots(dt) {
    for(const s of shots){
      s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
      const box={x:s.x-s.r,y:s.y-s.r,w:s.r*2,h:s.r*2};
      if(s.friendly){
        const e=enemies.find(e=>e.hp>0&&overlap(box,e));if(e){hitEnemy(e,s.damage,Math.sign(s.vx));gainResonance(.2);s.life=0;}
        if(s.life>0&&boss&&!bossDefeated&&overlap(box,boss)){if(damageBoss(s.damage,!!s.reflected))gainResonance(.2);s.life=0;}
      }else if(overlap(box,player)){
        const result=hurt(1,s.x,'A signal pierced the body.',{source:s.source,heavy:s.heavy});
        if(result==='parry'){
          s.friendly=true;s.reflected=true;s.damage=4;s.color=C.gold;s.life=2;s.r=8;
          const tx=s.source&&s.source.hp>0?s.source.x+13:player.x+player.dir*300,ty=s.source?s.source.y+18:player.y+20,d=Math.hypot(tx-s.x,ty-s.y)||1;
          s.vx=(tx-s.x)/d*540;s.vy=(ty-s.y)/d*540;
        }else s.life=0;
      }
      if(world.solids.some(solid=>overlap(box,solid)))s.life=0;
    }shots=shots.filter(s=>s.life>0&&s.y<world.bottom+80&&s.y>world.top-160);
  }
  // Blender sprites sit over the original vector renderer, which is the fallback.
  function drawAsset(key, x, y, scale, frame = 0, direction = 1, alpha = 1) {
    const img = artImages[key], spec = art[key];
    if (!img || !spec) return false;
    const sw = spec.cell || spec.size[0], sh = spec.cell || spec.size[1];
    const sx = spec.cell ? (frame % spec.columns) * sw : 0, sy = spec.cell ? Math.floor(frame / spec.columns) * sh : 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(direction, 1); ctx.globalAlpha *= alpha;
    ctx.drawImage(img, sx, sy, sw, sh, -spec.anchor[0] * scale, -spec.anchor[1] * scale, sw * scale, sh * scale);
    ctx.restore(); return true;
  }
  function drawPlayer(x, y, alpha = 1, echo = false) {
    const poses=art.player?.states||{idle:[0,1,2,3],run:[4,5,6,7,8,9,10,11],jump:[12],attack:[13,14,15],guard:[13]};
    let frame=poses.idle[Math.floor(clock*4)%poses.idle.length];
    if (!player.grounded || player.dash > 0) frame = poses.jump[0];
    else if (Math.abs(player.vx) > 25) frame=poses.run[Math.floor(player.anim*poses.run.length/5.33)%poses.run.length];
    const swing=player.attackVisual>0?1-player.attackVisual/(player.attackDuration||.22):0;
    if (player.attackVisual > 0) frame = poses.attack[clamp(Math.floor(swing*poses.attack.length),0,poses.attack.length-1)];
    if (player.guardCharge>.3 || player.counter>0 || player.parry>0) frame=(poses.guard||poses.attack)[player.counter>0?1:0];
    if (!echo) { ctx.fillStyle = '#070e1680'; ctx.beginPath(); ctx.ellipse(x + 11, y + 41, 15, 3, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.save();ctx.translate(x+11,y+player.h);
    const squash=(player.landing||0)/.16,lean=player.dash>0?.16:player.attackVisual>0?Math.sin(swing*Math.PI)*.10:clamp(player.vx/265,-1,1)*.025;
    ctx.rotate(lean*player.dir);ctx.scale(1+squash*.12,1-squash*.12);ctx.translate(-x-11,-y-player.h);
    if (!drawAsset('player', x + 11, y + player.h, art.player?.scale || .34, frame, player.dir, alpha)) {
      drawFigure(x, y, save.active ? memories[save.active].color : C.cyan, player.dir, player.anim, alpha, echo);
    }
    ctx.restore();
  }
  function enemyPose(e) {
    if(e.stagger>0||e.phase==='recover')return 7;
    if(e.phase==='windup'||e.phase==='tell')return e.timer>.3?4:5;
    if(['strike','charge','sweep'].includes(e.phase))return 6;
    return Math.floor(clock*(e.type==='drone'?7:9)+(e.home||0))%4;
  }
  function drawEnemy(e) {
    if(e.x<camera-100||e.x>camera+W+100)return;
    const x=(e.prevX??e.x)+(e.x-(e.prevX??e.x))*renderAlpha,y=(e.prevY??e.y)+(e.y-(e.prevY??e.y))*renderAlpha;
    const color=e.type==='lancer'?C.gold:e.type==='echo'?'#c7a5ff':C.cyan;
    ctx.save();ctx.fillStyle='#02091370';ctx.beginPath();ctx.ellipse(x+13,y+e.h+3,e.type==='drone'?17:19,3,0,0,Math.PI*2);ctx.fill();
    if(e.type==='echo'){
      const poses=art.player?.states,run=poses?.run||[4,5,6,7,8,9,10,11];
      glow(x+13,y+18,32,color,.12);drawAsset('player',x+13,y+e.h,art.player?.scale||.34,e.phase==='strike'?(poses?.attack[3]||14):run[Math.floor(clock*run.length*2)%run.length],e.dir,.72);
      line(x-9,y+15+Math.sin(clock*5)*9,x+31,y+15+Math.sin(clock*5)*9,color+'77');
    }else{
      if(e.hit>0)ctx.filter='brightness(2) saturate(.3)';
      if(!drawAsset(e.type,x+13,y+e.h,art[e.type]?.scale||.34,enemyPose(e),e.dir))drawFigure(x,y,color,e.dir,clock*9,1);
      ctx.filter='none';
    }
    if(e.phase==='windup'){
      const c=e.heavy?C.rose:C.white,charge=1-clamp(e.timer/(e.type==='lancer'?.78:e.type==='drone'?.7:.46),0,1);
      glow(x+13,y+17,24+charge*15,c,.08+charge*.08);
      ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x+13,y+15,27,-Math.PI/2,-Math.PI/2+charge*Math.PI*2);ctx.stroke();
      text(e.heavy?'▲':'◇',x+13,y-18,13,c,'center');
    }
    if(e.phase==='strike'){line(x+13-e.dir*30,y+23,x+13+e.dir*35,y+23,e.heavy?C.rose+'aa':C.white+'aa',2);}
    if(e.hp<e.max||e.strain>0){rect(x-5,y-9,36,3,'#192a3b');rect(x-5,y-9,36*Math.max(0,e.hp/e.max),3,color);rect(x-5,y-4,36*Math.min(e.hp,e.strain)/e.max,1,C.white);}
    ctx.restore();
  }
  function drawArchitecture() {
    for(const [key,x,y,scale] of world.decor)drawAsset(key,x,y,scale,0,1,.48);
    if(['belfry','lungs'].includes(zoneId))for(let y=world.top;y<452;y+=135){line(420,y,420,y+100,'#647f9033',2);text('◇',420,y+50,20,'#73f0e722','center');}
    if(zoneId==='cistern')for(let x=80;x<world.width;x+=135){line(x,world.top,x+35,150,'#29474c',7);line(x+35,150,x+4,205,'#29474c',4);}
  }
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function line(x1, y1, x2, y2, color, width = 1) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function text(str, x, y, size = 11, color = C.white, align = 'left', font = 'monospace') { ctx.fillStyle = color; ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.fillText(str, x, y); }
  function glow(x, y, r, color, alpha = .22) {
    ctx.save(); ctx.globalAlpha = alpha; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(x-r, y-r, r*2, r*2); ctx.restore();
  }
  function polygon(points, color) { ctx.fillStyle = color; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); }
  function drawBackground() {
    const t = world || themes[0];
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, t.sky); g.addColorStop(.65, t.far); g.addColorStop(1, '#111a28'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 76; i++) {
      const x = ((i * 127.13 - camera * .09) % W + W) % W, y = (i * 71.7) % 330;
      ctx.globalAlpha = .2 + Math.sin(clock * .4 + i) * .15; rect(x, y, i % 7 ? 1 : 2, 1, '#c8e7f1');
    } ctx.globalAlpha = 1;
    const moonX = 713 - camera * .07, moonY = 122;
    glow(moonX, moonY, 170, t.accent, .1);
    ctx.strokeStyle = t.accent; ctx.lineWidth = 1; ctx.globalAlpha = .26; ctx.beginPath(); ctx.arc(moonX, moonY, 52, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(moonX, moonY, 61, -.2, Math.PI * 1.2); ctx.stroke(); ctx.globalAlpha = 1;
    polygon([[moonX - 12, moonY - 47], [moonX + 24, moonY - 3], [moonX - 4, moonY + 44], [moonX - 20, moonY + 5]], '#7995a52b');
    // Broken cathedral ribs, recessed niches and hanging signal lamps.
    for(let i=-1;i<7;i++){
      const bx=i*235-(camera*.23%235),by=110-cameraY*.08;
      ctx.strokeStyle=room===1?'#5e405333':'#5c83922b';ctx.lineWidth=11;
      ctx.beginPath();ctx.moveTo(bx-76,480);ctx.lineTo(bx-76,by+130);ctx.bezierCurveTo(bx-76,by+63,bx-22,by+18,bx,by);ctx.bezierCurveTo(bx+22,by+18,bx+76,by+63,bx+76,by+130);ctx.lineTo(bx+76,480);ctx.stroke();
      ctx.strokeStyle=world.accent+'12';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(bx,by+15);ctx.lineTo(bx,by+215);ctx.stroke();
      if(i%2===0){const lampY=by+174+Math.sin(clock*.8+i)*2;line(bx,by+10,bx,lampY,'#8096a433');glow(bx,lampY,60,t.accent,.065);polygon([[bx,lampY-8],[bx+4,lampY],[bx,lampY+8],[bx-4,lampY]],t.accent+'66');}
    }
    for (let layer = 0; layer < 2; layer++) {
      const factor = layer ? .36 : .17, base = layer ? 436 : 404, color = layer ? t.mid : t.far;
      for (let i = -2; i < 13; i++) {
        const x = i * 150 - (camera * factor % 150), top = 140 + ((i + 30) * 79 % 170) + (layer ? 50 : 0);
        rect(x, top, 82, base - top, color); rect(x - 6, top + 10, 94, 8, color);
        polygon([[x, top], [x+41, top-25], [x+82, top]], color);
        if ((i + 20) % 3 === 0) { rect(x + 33, top - 61, 14, 40, color); line(x + 40, top - 76, x + 40, top - 48, color, 2); }
        for (let j = 0; j < 4; j++) { rect(x + 18, top + 27 + j * 46, 9, 23, '#080e1b4d'); rect(x + 54, top + 27 + j * 46, 9, 23, '#080e1b4d'); }
        if (layer && i % 2 === 0) {
          ctx.strokeStyle = color; ctx.lineWidth = 13; ctx.beginPath(); ctx.arc(x + 112, top + 90, 39, Math.PI, 0); ctx.stroke(); rect(x + 144, top + 90, 13, base-top-90, color);
        }
      }
    }
    if (room === 2) {
      for (let i = 0; i < 9; i++) { const x = i * 150 - (camera * .55 % 150); line(x, 451, x - 30, 240, '#172f30', 9); line(x - 17, 335, x + 35, 285, '#172f30', 6); glow(x - 25, 260, 85, '#668c6c', .13); }
    }
    if (room === 1) {
      for (let i = 0; i < 12; i++) { const x = i * 105 - (camera * .6 % 105); line(x, 0, x, 221, '#6d4e6355'); ctx.strokeStyle = '#8f667055'; ctx.lineWidth = 2; ctx.strokeRect(x-18, 221, 36, 106); rect(x-7, 252, 14, 53, did('sacrifice') ? '#30595155' : '#bc849125'); glow(x, 273, 45, C.rose, .035); }
    }
    const haze = ctx.createLinearGradient(0, 330, 0, 490); haze.addColorStop(0, 'transparent'); haze.addColorStop(.55, '#93b5cc0a'); haze.addColorStop(1, 'transparent'); ctx.fillStyle = haze; ctx.fillRect(0, 330, W, 170);
    // Soft shafts sit behind gameplay, leaving danger silhouettes crisp.
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<3;i++){
      const x=180+i*350-camera*.06;
      const light=ctx.createLinearGradient(x,0,x+100,H);light.addColorStop(0,t.accent+'0e');light.addColorStop(1,'transparent');
      ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+32,0);ctx.lineTo(x+190,H);ctx.lineTo(x+70,H);ctx.closePath();ctx.fill();
    }ctx.restore();
    for (let i = 0; i < 25; i++) { const x = ((i * 67.4 + clock * (i % 2 ? 4 : -3) - camera * .4) % W + W) % W; const y = 175 + ((i * 63) % 250) + Math.sin(clock + i) * 8; ctx.globalAlpha = .15 + Math.sin(clock * 1.1 + i) * .12; rect(x, y, 2, 2, t.accent); } ctx.globalAlpha = 1;
  }
  function drawPlatform(p, ground = false) {
    if (p.x + p.w < camera - 20 || p.x > camera + W + 20) return;
    rect(p.x, p.y, p.w, p.h, '#101a28'); rect(p.x, p.y, p.w, 4, '#4a6070'); rect(p.x, p.y + 4, p.w, 3, '#283d4e');
    const stone=ctx.createLinearGradient(0,p.y,0,p.y+Math.min(p.h,85));stone.addColorStop(0,room===2?'#304945':'#293b4d');stone.addColorStop(1,'#101a28');ctx.fillStyle=stone;ctx.fillRect(p.x,p.y+7,p.w,Math.max(0,p.h-7));
    for(let row=0;row<Math.min(4,Math.ceil(p.h/23));row++){
      const yy=p.y+8+row*23;if(yy>=p.y+p.h)break;
      line(p.x,yy,p.x+p.w,yy,'#0b142055');
      for(let xx=p.x+((row%2)*31)+16;xx<p.x+p.w;xx+=62){line(xx,yy,xx,Math.min(p.y+p.h,yy+23),'#0a152477');line(xx+1,yy+2,xx+1,Math.min(p.y+p.h,yy+20),'#56718022');}
    }
    for(let xx=p.x+18;xx<p.x+p.w-14;xx+=97){line(xx,p.y+1,xx+19,p.y+1,'#aec5ce66');polygon([[xx+9,p.y+5],[xx+17,p.y+9],[xx+12,p.y+16]],'#0a152466');}
    for (let x = p.x + 4; x < p.x + p.w - 10; x += 39) { line(x, p.y + 12, x+26, p.y+12, '#243546'); line(x + 31, p.y + 7, x+31, p.y + (ground ? 29 : 15), '#283748'); }
    if (ground) for (let x = p.x + 9; x < p.x + p.w; x += 71) { const seed = Math.sin(x * 8.33); if (seed > 0) { line(x,p.y,x-3,p.y-9-seed*12,'#4f7d7777'); line(x,p.y,x+6,p.y-6,'#3f746877'); rect(x-3,p.y-11,2,2,world.accent); } }
    else { polygon([[p.x + 8,p.y+p.h],[p.x+20,p.y+p.h+20],[p.x+31,p.y+p.h]],'#172637'); polygon([[p.x+p.w-34,p.y+p.h],[p.x+p.w-16,p.y+p.h+30],[p.x+p.w-5,p.y+p.h]],'#172637'); }
    if (!ground && artImages.ledge) {
      ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y + 4, p.w, 80); ctx.clip();
      drawAsset('ledge', p.x + p.w / 2, p.y, p.w / 304, 0, 1, .85); ctx.restore();
    }
  }
  function drawFigure(x, y, color = C.cyan, direction = 1, anim = 0, alpha = 1, echo = false) {
    if (echo && drawAsset('player', x + 11, y + 40, art.player?.scale || .34, 0, direction, alpha)) {
      line(x - 10, y + 20, x + 29, y + 20, color + '44'); return;
    }
    ctx.save(); ctx.translate(Math.round(x + 11), Math.round(y)); ctx.scale(direction, 1); ctx.globalAlpha *= alpha;
    const walk = Math.sin(anim) * (player && Math.abs(player.vx) > 20 ? 4 : 1);
    if (!echo) { ctx.fillStyle = '#070e1680'; ctx.beginPath(); ctx.ellipse(0, 42, 16, 3, 0, 0, Math.PI*2); ctx.fill(); }
    polygon([[-9,15],[-15-Math.sin(clock*4)*3,35],[9,34],[8,15]], echo ? '#487f8b' : '#2b4759');
    rect(-6,31+walk,4,9-walk,'#a2c9d0'); rect(3,31-walk,4,9+walk,'#a2c9d0');
    rect(-7,14,15,19,echo ? '#649da5' : '#526c7b'); rect(-6,3,14,14,'#c6dbde'); rect(-8,1,16,7,echo ? '#90d3cf' : '#4b6d7d');
    rect(-5,10,15,5,'#152536'); rect(3,11,8,2,color);
    polygon([[-8,16],[-24-Math.sin(clock*7)*4,13+walk],[-17,20],[-5,20]],echo ? color : C.rose);
    rect(7,20,4,10,'#91afb9'); line(10,28,28,37,color,2); rect(10,28,4,3,'#d9e8e5');
    if (echo) { rect(-10,20,22,1,color); rect(-12,30,24,1,color); }
    ctx.restore();
  }
  function drawInteraction(o) {
    const used=chosen.has(o.id),x=o.x,y=o.y;
    if((o.kind==='cache'||o.kind==='creature')&&used)return;
    let labelY=y-68;
    if(o.kind==='creature'){
      glow(x,y+12,65,C.gold,.12);polygon([[x-18,y+18],[x-9,y+7],[x+8,y+9],[x+19,y+17]],'#759ba0');rect(x-9,y+5,11,12,'#8cb9ba');rect(x-8,y+7,3,2,C.gold);rect(x-10,y+1,3,7,'#87abae');rect(x-1,y+2,3,7,'#87abae');rect(x+6,y+11,5,5,'#ffa16b');
    }else if(o.kind==='gate'||o.kind==='door'){
      const base=y+35,open=o.kind==='gate'?doorOpen(o)&&!(bossStarted&&!bossDefeated):did('defiance'),color=o.memory?'#c7a5ff':world.accent;
      if(!drawAsset('arch',x,base,.31)){rect(x-27,base-116,8,116,'#546674');rect(x+19,base-116,8,116,'#546674');rect(x-30,base-121,60,9,'#677986');}
      if(open){glow(x,base-57,85,color,.18);rect(x-17,base-108,34,106,color+'19');for(let i=0;i<6;i++)line(x-14,base-105+((clock*23+i*18)%100),x+14,base-105+((clock*23+i*18)%100),color+'55');}
      else{line(x-19,base-102,x+19,base-13,'#98788c');line(x+19,base-102,x-19,base-13,'#98788c');text(o.memory?'◇':'×',x,base-52,20,'#c9a4bd','center');}
      labelY=base-139;
    }else if(o.kind==='bench'){
      glow(x,y-12,64,C.cyan,.15);rect(x-26,y+11,52,6,'#96bdc1');rect(x-21,y+17,5,10,'#456577');rect(x+16,y+17,5,10,'#456577');
      polygon([[x,y-27],[x+7,y-14],[x,y-1],[x-7,y-14]],C.cyan);line(x,y-1,x,y+9,C.cyan+'55');
    }else if(o.kind==='lever'){
      rect(x-15,y+24,30,11,'#65737a');line(x,y+24,x+(runFlags[o.flag]?15:-15),y-7,runFlags[o.flag]?C.cyan:C.gold,4);rect(x+(runFlags[o.flag]?10:-21),y-11,12,9,C.gold);
    }else if(o.kind==='cache'){
      const bob=Math.sin(clock*3)*4;glow(x,y+bob,47,C.gold,.13);polygon([[x,y-15+bob],[x+11,y+bob],[x,y+15+bob],[x-11,y+bob]],C.gold);polygon([[x,y-8+bob],[x+5,y+bob],[x,y+8+bob],[x-5,y+bob]],'#1d3241');
    }else if(o.kind==='choir'){
      glow(x,y-30,170,'#c7a5ff',.24);
      for(let i=0;i<3;i++){ctx.strokeStyle=['#c7a5ff',C.cyan,C.rose][i];ctx.globalAlpha=.6;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y-50,46+i*21,75+i*20,clock*.09*(i%2?1:-1)+i,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
      polygon([[x,y-88],[x+17,y-50],[x,y-10],[x-17,y-50]],'#d7d1f5');line(x,y-10,x,451,'#b6abed66');labelY=y-155;
    }else if(o.kind==='child'){
      const bx=childStage>=3?x+70:x;drawFigure(bx-11,y-5,C.gold,-1,0,1);rect(bx-6,y-5,14,6,'#dbc099');glow(bx,y+15,42,C.gold,.08);
      if(childStage<3){text('○  ○  ○',bx,y-26,12,'#738b8c','center');text('●  '.repeat(childStage).trim(),bx-26,y-26,12,C.gold);}
    }else{
      drawFigure(x-11,y,o.kind==='keeper'?C.rose:C.cyan,-1,0,o.kind==='keeper'?1:.44,o.kind!=='keeper');if(o.kind!=='keeper')glow(x,y+16,50,C.cyan,.08);
    }
    if(!used&&Math.abs(player.x+11-x)<160&&Math.abs(player.y-y)<190)text(o.label,x,labelY,9,'#bed2dc','center');
  }
  function drawBoss() {
    if(!boss)return;
    const b=boss,x=b.x,y=b.y,c=b.type==='king'?C.gold:C.rose;
    if(bossDefeated){glow(x+b.w/2,445,50,c,.12);polygon([[x,452],[x+18,433],[x+49,452]],'#53616d');return;}
    const vulnerable=b.type!=='king'||!player.grounded||player.dashGrace>0||b.exposed>0;
    glow(x+b.w/2,y+45,100,b.hit>0?C.white:c,.09);
    ctx.save();if(b.hit>0)ctx.filter='brightness(1.9) saturate(.4)';
    const pose=enemyPose(b),direction=b.type==='king'?(b.face||-1):1;
    if(!drawAsset(b.type,x+b.w/2,y+b.h,art[b.type]?.scale||.65,pose,direction))drawFigure(x+12,y+25,c,direction,clock*4);
    ctx.restore();
    if(b.type==='king'&&!vulnerable){
      ctx.strokeStyle=C.gold+'88';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x+b.w/2,y+44,48,63,0,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<8;i++){const a=i*Math.PI/4+clock*.15;polygon([[x+27+Math.cos(a)*48,y+44+Math.sin(a)*63-3],[x+30+Math.cos(a)*48,y+44+Math.sin(a)*63],[x+27+Math.cos(a)*48,y+44+Math.sin(a)*63+3],[x+24+Math.cos(a)*48,y+44+Math.sin(a)*63]],C.gold+'aa');}
    }
    if(b.phase==='tell'){
      const signal=b.heavy?C.rose:C.white;
      if(b.type==='king'){
        rect(world.arena[0],FLOOR-4,world.arena[1]-world.arena[0],4,signal+'33');
        text(b.heavy?'▲ COUNTER / JUMP':'◇ DEFLECT',x+b.w/2,y-32,10,signal,'center');
        line(x+27,y+80,x+27+b.face*(b.heavy?180:250),y+80,signal+'99',2);
      }else{
        const beam=ctx.createLinearGradient(b.targetX,100,b.targetX+35,100);beam.addColorStop(0,'transparent');beam.addColorStop(.5,signal+'33');beam.addColorStop(1,'transparent');
        ctx.fillStyle=beam;ctx.fillRect(b.targetX-7,100,40,352);line(b.targetX+12,130,b.targetX+12,452,signal+'77');
        text(b.heavy?'▲ CRIMSON RECALL':'◇ DEFLECT THE SIGNAL',x+b.w/2,y-30,10,signal,'center');
      }
    }
    if(bossStarted){
      ctx.save();ctx.translate(viewCamera,viewCameraY);
      text(b.type==='king'?'THE KING / A FUTURE WITHOUT CHOICE':'THE MOTHER / A FUTURE WITHOUT END',480,35,10,C.white,'center');
      rect(303,47,354,8,'#08111ccc');rect(305,49,350,4,'#344357');rect(305,49,350*b.hp/b.max,4,c);
      rect(305,56,350*Math.min(b.hp,b.strain||0)/b.max,2,C.cyan);ctx.restore();
    }
  }
  function drawHud() {
    if(!bossStarted||bossDefeated){text(world.name.split(' / ')[0],27,36,15,'#d2e5ed');text(world.sub,28,54,8,'#7995a6');}
    if(state!=='play')return;
    rect(14,H-62,320,53,'#0b1522dc');
    text('RESONANCE',27,H-45,8,'#8fa5b9');
    for(let i=0;i<3;i++){
      const x=111+i*25,filled=player.resonance>=i+1;
      polygon([[x,H-53],[x+7,H-46],[x,H-39],[x-7,H-46]],filled?C.gold:'#384955');
      if(!filled&&player.resonance>i)rect(x-3,H-48,6*(player.resonance-i),4,C.gold);
    }
    text(imprint?'Q  DETONATE':player.resonance>=1?'Q  IMPRINT':'F  DEFLECT',210,H-43,9,imprint?C.gold:C.cyan);
    rect(27,H-28,74,3,'#3c4b60');rect(27,H-28,74*(1-clamp(player.dashCd/(active('abandon')?.32:.58),0,1)),3,player.airDashUsed?'#516779':C.cyan);text(player.airDashUsed?'AIR DASH USED':'DASH READY',27,H-13,8,'#8fa5b9');
    rect(122,H-28,74,3,'#3c4b60');rect(122,H-28,74*(1-clamp(player.abilityCd/7,0,1)),3,save.active?memories[save.active].color:C.cyan);text('MEMORY / L',122,H-13,8,'#8fa5b9');
    text(player.resonance>=1&&player.hp<6?'H  HOLD TO MEND':'J  STRIKE / HOLD',216,H-14,8,'#9bb8bd');
    text('M  MAP   E  INTERACT',W-26,H-25,9,'#bed3df','right');text('W / S + J  AIM BLADE',W-26,H-10,8,'#7997aa','right');
    const mx=W-141,my=24,mw=110,mh=54,sx=mw/world.width,sy=mh/(world.bottom-world.top);
    rect(mx-6,my-6,mw+12,mh+24,'#0a1422bb');
    for(const p of [...world.ground,...world.platforms,...world.solids])rect(mx+p.x*sx,my+(p.y-world.top)*sy,Math.max(1,p.w*sx),Math.max(1,p.h*sy),'#486575');
    rect(mx+player.x*sx-2,my+(player.y-world.top)*sy-2,4,4,C.cyan);text(`${visited.size}/12 ROOMS · M`,mx+mw/2,my+mh+12,8,'#9bb9c8','center');
  }
  function render() {
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.save();ctx.clearRect(0,0,W,H);if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
    viewCamera=camera;viewCameraY=cameraY;drawBackground();ctx.translate(-viewCamera,-viewCameraY);
    if(world){
      drawArchitecture();
      for(const p of world.ground)drawPlatform(p,true);for(const p of world.platforms)drawPlatform(p);
      for(const wall of world.solids){drawPlatform(wall,true);line(wall.x+3,wall.y+5,wall.x+3,wall.y+wall.h,'#79a3af');line(wall.x+wall.w-3,wall.y+5,wall.x+wall.w-3,wall.y+wall.h,'#79a3af');for(let y=wall.y+20;y<wall.y+wall.h;y+=38)line(wall.x+7,y,wall.x+wall.w-7,y+8,'#466579');}
      for(const h of world.hazards){glow(h.x+h.w/2,h.y+20,Math.min(200,h.w/2),C.rose,.13);for(let x=h.x;x<h.x+h.w;x+=20)polygon([[x,h.y+h.h],[x+9,h.y],[x+18,h.y+h.h]],'#98728b');}
      for(const p of world.pogo){glow(p.x+12,p.y+12,36,C.cyan,.12);polygon([[p.x+12,p.y-4],[p.x+28,p.y+12],[p.x+12,p.y+28],[p.x-4,p.y+12]],'#446976');polygon([[p.x+12,p.y+2],[p.x+20,p.y+12],[p.x+12,p.y+22],[p.x+4,p.y+12]],C.cyan);}
      for(const t of world.tutorials)if(Math.abs(player.x-t.x)<460)text(t.text,t.x,t.y,9,'#9ebcc7','center');
      for(const o of world.interactions)drawInteraction(o);
      if(bossStarted&&!bossDefeated)for(const x of world.arena){line(x,210,x,FLOOR,C.rose+'66',2);glow(x,410,40,C.rose,.08);}
      for(const e of enemies)drawEnemy(e);
      drawBoss();
      const mercy=save.archive.find(m=>m.id==='mercy');
      if(mercy&&save.loop-mercy.loop>=3){const ax=player.x-35-player.dir*15,ay=player.y+20+Math.sin(clock*4)*5;glow(ax,ay,36,C.cyan,.18);polygon([[ax-13,ay+9],[ax-5,ay-3],[ax+6,ay],[ax+13,ay+8]],'#93c9c1');rect(ax-6,ay-3,2,2,C.gold);}
      if(active('respect'))drawPlayer(player.x-player.dir*40,player.y+Math.sin(clock*2)*3,.22,true);
      for(const g of ghosts)drawAsset('player',g.x+11,g.y+40,art.player?.scale||.34,art.player?.states.jump[0]||12,g.dir,g.life/.18*.24);
      const px=(player.prevX??player.x)+(player.x-(player.prevX??player.x))*renderAlpha,py=(player.prevY??player.y)+(player.y-(player.prevY??player.y))*renderAlpha;
      if(player.inv<=0||Math.floor(clock*18)%2)drawPlayer(px,py,player.dash>0?.8:1);
      if(player.ward>0||player.parry>0||player.counter>0){ctx.strokeStyle=player.counter>0?C.gold:player.perfect>0?C.white:player.ward>0?C.gold:'#749aa5';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(player.x+11,player.y+20,27,34,0,0,Math.PI*2);ctx.stroke();}
      if(player.guardCharge>.15||player.attackHold>.2){const charge=player.guardCharge>.15?player.guardCharge/.48:player.attackHold/.55;rect(player.x-7,player.y-12,36,3,'#3d5262');rect(player.x-7,player.y-12,36*Math.min(1,charge),3,charge>=1?C.gold:C.cyan);}
      if(player.focus>0){glow(player.x+11,player.y+20,60,C.cyan,.25);ctx.strokeStyle=C.cyan;ctx.lineWidth=2;ctx.beginPath();ctx.arc(player.x+11,player.y+20,30,-Math.PI/2,-Math.PI/2+player.focus*Math.PI*2);ctx.stroke();}
      if(imprint){const t=imprint.target,cx=t.x+t.w/2,cy=t.y-20;glow(cx,cy,36,C.gold,.2);polygon([[cx,cy-12],[cx+9,cy],[cx,cy+12],[cx-9,cy]],C.gold);text(String(imprint.charge),cx,cy+4,10,'#19272d','center');}
      for(const s of shots){glow(s.x,s.y,24,s.color,.3);ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}
      for(const s of slash){
        ctx.save();const progress=1-clamp(s.life/(s.color===C.gold?.25:.18),0,1);ctx.globalAlpha=(1-progress)*.9;
        ctx.translate(s.x,s.y-5);ctx.scale(s.axis==='up'||s.axis==='down'?.65:1,s.axis==='up'||s.axis==='down'?1:.60);ctx.translate(-s.x,-s.y);
        const facing=s.axis==='up'?-Math.PI/2:s.axis==='down'?Math.PI/2:s.dir>0?0:Math.PI;
        const start=facing-1.3+progress*.65,end=facing+1.15+progress*.65,r=s.radius*.84;
        ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,r,start,end);ctx.arc(s.x,s.y,r*(.86+progress*.10),end,start,true);ctx.closePath();ctx.fill();
        ctx.strokeStyle=C.white;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(s.x,s.y,r,start+.15,end-.08);ctx.stroke();
        if(s.both){ctx.strokeStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,r,0,Math.PI*2);ctx.stroke();}
        ctx.restore();
      }
      for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);if(Math.hypot(p.vx,p.vy)>70)line(p.x,p.y,p.x-p.vx*.018,p.y-p.vy*.018,p.color,Math.max(1,p.size*.45));else rect(p.x,p.y,p.size,p.size,p.color);}ctx.globalAlpha=1;
      const nearby=nearestInteraction();if(nearby&&state==='play'){const label=nearby.kind==='gate'?'ENTER':nearby.kind==='bench'?'REST':nearby.kind==='lever'?'OPEN':nearby.kind==='cache'?'TAKE':'LISTEN';rect(nearby.x-48,nearby.y-60,96,25,'#0c1725ed');ctx.strokeStyle=world.accent+'77';ctx.lineWidth=1;ctx.strokeRect(nearby.x-48,nearby.y-60,96,25);text('[ E ] '+label,nearby.x,nearby.y-43,10,C.white,'center');}
      ctx.translate(viewCamera,viewCameraY);drawHud();
    }
    const vignette=ctx.createRadialGradient(W/2,H/2,180,W/2,H/2,570);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#02071177');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
    ctx.restore();
  }
  function frame(now) {
    const elapsed=lastTime?Math.min(.10,Math.max(0,(now-lastTime)/1000)):STEP;lastTime=now;accumulator+=elapsed;
    while(accumulator>=STEP){update(STEP);accumulator-=STEP;}
    renderAlpha=clamp(accumulator/STEP,0,1);render();requestAnimationFrame(frame);
  }
  const gameKeys=new Set(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown',' ','j','x','k','shift','l','c','e','r','f','q','h','m','escape']);
  window.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(gameKeys.has(key)&&['play','map','help'].includes(state))e.preventDefault();if(!keys.has(key))pressed.add(key);keys.add(key);});
  window.addEventListener('keyup',e=>{const key=e.key.toLowerCase();keys.delete(key);released.add(key);if(key===' '&&player?.vy < -220)player.vy=-220;});
  window.addEventListener('blur',()=>{keys.clear();pressed.clear();if(state==='play')showHelp('play');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();pressed.clear();if(state==='play')showHelp('play');}});
  $('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').textContent=sound?'♪ ON':'♪ OFF';$('soundBtn').setAttribute('aria-pressed',String(sound));tone(660,.15);};
  $('helpBtn').onclick=()=>{if(state==='play'||state==='title')showHelp(state);};
  $('soundBtn').setAttribute('aria-label','Toggle game sound');$('helpBtn').setAttribute('aria-label','Show controls');
  player=newPlayer();loadRoom(0);refreshUI();addLog('Awaiting a consciousness. The archive is listening.','THE CHOIR / ONLINE');title();requestAnimationFrame(frame);

  // Only exposed when explicitly running the local verification harness.
  if (typeof window.__ECHO_TEST__ === 'function') window.__ECHO_TEST__({
    frame, update, startRun, loadRoom, enterZone, interact, recordDecision, extract, die, ability, attack, damageBoss, childDialogue, choirDialogue, ending, remembered, beginDeflect, releaseCounter, hurt, imprintAttack, detonate, enemy, movePlayerX, updateShots, doorOpen, showMap,
    get state(){return state;},get player(){return player;},get world(){return world;},get boss(){return boss;},get save(){return save;},get decisions(){return decisions;},get enemies(){return enemies;},get room(){return room;},get childStage(){return childStage;},get camera(){return camera;},get cameraY(){return cameraY;},get pressed(){return pressed;},get keys(){return keys;},get released(){return released;},get shots(){return shots;},get zoneId(){return zoneId;},get flags(){return runFlags;},get imprint(){return imprint;},get visited(){return visited;},
    setSave(value){save={...save,...value};},setState(value){state=value;},render
  });
})();

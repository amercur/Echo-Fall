'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
function boot(store=new Map(),withArt=false,options={}){
  const elements=new Map(),drawnImages=[],listeners={};let documentState;
  const gradient={addColorStop(){}};
  const canvas=new Proxy(options.context||{globalAlpha:1},{get:(obj,p)=>{
    if(p==='drawImage')return (...args)=>{drawnImages.push(args);if(options.context)options.context.drawImage(args[0].native,...args.slice(1));};
    if(options.context){const value=obj[p];return typeof value==='function'?value.bind(obj):value;}
    return p==='createLinearGradient'||p==='createRadialGradient'?()=>gradient:p in obj?obj[p]:()=>{};
  },set:(obj,p,value)=>{obj[p]=value;return true;}});
  function element(id){
    if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',dataset:{},children:[],onclick:null,classList:{add(){},remove(){}},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},querySelector(){return this.querySelectorAll()[0]||null;},querySelectorAll(){return [...this.innerHTML.matchAll(/<(button|input)\b([^>]*?)id="([^"]+)"([^>]*)>/g)].filter(m=>!m[0].includes('disabled')).map(m=>{const el=element(m[3]);el.tagName=m[1].toUpperCase();el.type=(m[0].match(/type="([^"]+)"/)||[])[1]||'';el.value=(m[0].match(/value="([^"]+)"/)||[])[1]||'';return el;});},setAttribute(){},focus(){documentState.activeElement=this;},blur(){documentState.activeElement=null;},click(){this.onclick?.();},getContext:()=>canvas});
    return elements.get(id);
  }
  let game;
  documentState={getElementById:element,createElement:()=>element(Symbol()),createTextNode:text=>text,addEventListener(){},activeElement:null};
  const context=vm.createContext({console,Math,Set,Map,JSON,navigator:{getGamepads:()=>options.gamepads||[]},window:{...options.window,addEventListener:(name,fn)=>{listeners[name]=fn;},__ECHO_TEST__:value=>{game=value;}},document:documentState,localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)},requestAnimationFrame(){}});
  vm.runInContext(fs.readFileSync(path.join(root,'world-data.js'),'utf8'),context);
  if(withArt){
    context.Image=class{set src(value){this.path=value;this.native=options.images?.get(value);const png=fs.readFileSync(path.join(root,value));assert.equal(png.toString('ascii',1,4),'PNG');this.width=this.naturalWidth=png.readUInt32BE(16);this.height=this.naturalHeight=png.readUInt32BE(20);this.onload();}};
    vm.runInContext(fs.readFileSync(path.join(root,'assets/art-manifest.js'),'utf8'),context);
  }
  vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8'),context,{filename:'game.js'});
  const click=id=>{assert.equal(typeof element(id).onclick,'function',`Missing action ${id}`);element(id).onclick();};
  const tick=(seconds,dt=1/120)=>{for(let t=0;t<seconds;t+=dt)game.update(dt);};
  const down=key=>listeners.keydown({key,preventDefault(){}}),up=key=>listeners.keyup({key});
  return {game,store,element,click,tick,down,up,drawnImages};
}
module.exports={boot};

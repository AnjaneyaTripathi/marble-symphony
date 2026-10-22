import { describe, expect, it } from 'vitest';
import { PhysicsWorld, MAX_MARBLES, MAX_MARBLE_SPEED } from './world';
import { ImpactCooldown } from './cooldown';
import { createObject } from '../model/defaults';
import type { EmitterObject, BarObject, FunnelObject, CatcherObject } from '../model/types';

const emitter = {...createObject('emitter',500,60),speed:0} as EmitterObject;
const bar = {...createObject('bar',500,230),length:250,bounce:.25} as BarObject;

describe('impact gating',()=>{
  it('rejects weak contacts and repeated impacts until the pair cooldown expires',()=>{
    const gate=new ImpactCooldown(.12);
    expect(gate.accept(1,'bar',0,.2)).toBe(false);
    expect(gate.accept(1,'bar',0,4)).toBe(true);
    expect(gate.accept(1,'bar',.06,4)).toBe(false);
    expect(gate.accept(2,'bar',.06,4)).toBe(true);
    expect(gate.accept(1,'bar',.13,4)).toBe(true);
    gate.forget(1);expect(gate.accept(1,'bar',.14,4)).toBe(true);
  });
});
describe('Matter world',()=>{
  it('produces a real collision event and does not repeatedly sound a resting marble',()=>{
    const hits:number[]=[];const world=new PhysicsWorld(({strength})=>hits.push(strength));
    world.setObjects([emitter,{...bar,bounce:0}]);world.emit(emitter);
    for(let i=0;i<250;i++)world.step();
    expect(hits.length).toBeGreaterThan(0);expect(hits.length).toBeLessThan(5);expect(hits[0]).toBeGreaterThan(1);
    const settledHits=hits.length;for(let i=0;i<250;i++)world.step();expect(hits.length).toBe(settledHits);
    expect(world.marbles.size).toBe(1);world.destroy();
  });
  it('reset clears transient bodies and keeps the design and static geometry',()=>{
    const world=new PhysicsWorld();const objects=[emitter,bar];world.setObjects(objects);
    const design=JSON.stringify(world.objects),body=world.objectBodies.get(bar.id)?.[0];
    world.emit(emitter);world.step();world.reset();
    expect(world.marbles.size).toBe(0);expect(world.time).toBe(0);
    expect(JSON.stringify(world.objects)).toBe(design);expect(world.objectBodies.get(bar.id)?.[0]).toBe(body);
    world.emit(emitter);expect(world.marbles.size).toBe(1);world.destroy();
  });
  it('guides a falling off-center marble through actual funnel walls into a catcher',()=>{
    const funnel={...createObject('funnel',500,300),width:220} as FunnelObject;
    const catcher={...createObject('catcher',500,390),width:200,musical:true} as CatcherObject;
    const source={...emitter,x:440};const hits:string[]=[];
    const world=new PhysicsWorld(({object})=>hits.push(object.id));world.setObjects([source,funnel,catcher]);world.emit(source);
    let guided=false;
    for(let i=0;i<700;i++){world.step();for(const marble of world.marbles.values())if(marble.body.position.y>345&&Math.abs(marble.body.position.x-500)<35)guided=true;}
    expect(guided).toBe(true);expect(hits).toContain(catcher.id);expect(world.marbles.size).toBe(0);world.destroy();
  });
  it('caps bodies, cleans escaped and aged marbles, and never changes design during physics',()=>{
    const world=new PhysicsWorld();world.setObjects([emitter]);const design=JSON.stringify(world.objects);
    for(let i=0;i<MAX_MARBLES+20;i++)world.emit(emitter);
    expect(world.marbles.size).toBe(MAX_MARBLES);
    world.reset();world.emit(emitter);
    for(let i=0;i<1000;i++)world.step();expect(world.marbles.size).toBe(0);expect(JSON.stringify(world.objects)).toBe(design);
    world.setObjects([emitter,bar]);world.emit(emitter);world.time=46;world.step();expect(world.marbles.size).toBe(0);world.destroy();
  });
  it('keeps 120 marbles and 100 energetic objects finite and bounded under sustained load',()=>{
    const objects=Array.from({length:100},(_,i)=>({...createObject('bumper',70+(i%10)*115,170+Math.floor(i/10)*58),radius:15,bounce:1.5} as const));
    const world=new PhysicsWorld();world.setObjects(objects);
    for(let i=0;i<120;i++)world.emit({...emitter,x:70+(i%20)*55,y:10-Math.floor(i/20)*24,speed:12,rotation:i%2?20:-20});
    for(let i=0;i<600;i++){
      world.step();expect(world.marbles.size).toBeLessThanOrEqual(120);
      for(const marble of world.marbles.values()){
        expect(Number.isFinite(marble.body.position.x)&&Number.isFinite(marble.body.position.y)).toBe(true);
        expect(marble.body.speed).toBeLessThanOrEqual(MAX_MARBLE_SPEED+1e-6);
      }
    }
    expect(world.objectBodies.size).toBe(100);world.destroy();
  });
});

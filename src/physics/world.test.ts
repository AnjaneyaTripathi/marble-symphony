import { describe, expect, it } from 'vitest';
import { PhysicsWorld, MAX_MARBLES, MAX_MARBLE_SPEED } from './world';
import { ImpactCooldown } from './cooldown';
import { createObject } from '../model/defaults';
import type { EmitterObject, BarObject, FunnelObject, CatcherObject, RampObject } from '../model/types';

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

describe('marble contact geometry',()=>{
  const release = (world: PhysicsWorld, x: number, y: number, radius: number) => {
    const source={...emitter,x,y:y-27,marbleSize:radius,speed:0,rotation:0};
    world.emit(source);
    return [...world.marbles.values()][0]!;
  };

  it('uses smooth, consistently-sized physical marble geometry',()=>{
    for(const radius of [5,6,8,10,18,20]){
      const world=new PhysicsWorld();world.setObjects([]);
      const marble=release(world,500,80,radius);
      expect(marble.body.circleRadius).toBe(radius);
      const [first,second]=marble.body.vertices;
      const midpoint={x:(first!.x+second!.x)/2,y:(first!.y+second!.y)/2};
      const edgeRadius=Math.hypot(midpoint.x-marble.body.position.x,midpoint.y-marble.body.position.y);
      // The collision mesh follows the declared radius within 0.02 px. A
      // decagon at the smallest supported radius misses this by about 0.24 px.
      expect(radius-edgeRadius).toBeLessThanOrEqual(.02);
      world.destroy();
    }
  });

  it.each([-1,1] as const)('continues downhill on 3°, 5°, and 10° %s slopes for every supported marble size',(direction)=>{
    for(const radius of [5,6,8,10,18,20]){
      for(const angle of [3,5,10]){
        const rotation=direction*angle;
        const ramp={...createObject('ramp',500,310),length:600,rotation,friction:.04,bounce:0} as RampObject;
        const highSideX=500-direction*180;
        const surfaceY=310+Math.tan(rotation*Math.PI/180)*(highSideX-500)-6/Math.cos(rotation*Math.PI/180);
        const world=new PhysicsWorld();world.setObjects([ramp]);
        const marble=release(world,highSideX,surfaceY-radius-2,radius);
        const positions=[marble.body.position.x*direction];
        for(let step=0;step<480;step++){world.step();if((step+1)%120===0)positions.push(marble.body.position.x*direction);}
        for(let window=1;window<positions.length;window++){
          // A whole one-second window must keep moving downhill: a tiny initial
          // nudge followed by a facet stall or uphill reversal is a regression.
          expect(positions[window]! - positions[window-1]!).toBeGreaterThan(.75);
        }
        world.destroy();
      }
    }
  });

  it('keeps a marble quiet on a flat ramp and does not invent sideways motion in free fall',()=>{
    const flat={...createObject('ramp',500,310),length:600,rotation:0,friction:.04,bounce:0} as RampObject;
    const world=new PhysicsWorld();world.setObjects([flat]);
    const resting=release(world,500,210,10);
    for(let step=0;step<900;step++)world.step();
    expect(resting.body.position.x).toBeCloseTo(500,0);
    expect(resting.body.speed).toBeLessThan(.08);
    world.reset();world.setObjects([]);
    const falling=release(world,420,30,10);
    for(let step=0;step<180;step++)world.step();
    expect(falling.body.position.x).toBeCloseTo(420,5);
    world.destroy();
  });

  it('keeps the editor material settings on the actual static bodies',()=>{
    const ramp={...createObject('ramp',420,300),friction:.73,bounce:.11} as RampObject;
    const silentBar={...createObject('bar',700,300),bounce:0} as BarObject;
    const world=new PhysicsWorld();world.setObjects([ramp,silentBar]);
    const rampBody=world.objectBodies.get(ramp.id)?.[0];
    const barBody=world.objectBodies.get(silentBar.id)?.[0];
    expect(rampBody?.friction).toBeCloseTo(.73);
    expect(rampBody?.restitution).toBeCloseTo(.11);
    expect(barBody?.restitution).toBe(0);
    world.destroy();
  });

  it('applies bounce and friction settings to collision behaviour',()=>{
    const rebound=(bounce:number)=>{
      const bar={...createObject('bar',500,310),length:400,bounce} as BarObject;
      const world=new PhysicsWorld();world.setObjects([bar]);const marble=release(world,500,190,10);
      let upward=0;
      for(let step=0;step<240;step++){world.step();upward=Math.min(upward,marble.body.velocity.y);}
      world.destroy();return upward;
    };
    const travel=(friction:number)=>{
      const ramp={...createObject('ramp',500,310),length:600,rotation:10,friction,bounce:0} as RampObject;
      const world=new PhysicsWorld();world.setObjects([ramp]);const marble=release(world,320,263,10);const start=marble.body.position.x;
      for(let step=0;step<240;step++)world.step();const distance=marble.body.position.x-start;world.destroy();return distance;
    };
    const quietRebound=rebound(0), livelyRebound=rebound(.9);
    const slipperyTravel=travel(.01), grippyTravel=travel(.8);
    expect(livelyRebound).toBeLessThan(quietRebound-.5);
    expect(Math.abs(slipperyTravel-grippyTravel)).toBeGreaterThan(.5);
  });

  it('keeps a settled pile of marbles finite and quiet',()=>{
    const floor={...createObject('ramp',500,420),length:700,rotation:0,friction:.04,bounce:0} as RampObject;
    const world=new PhysicsWorld();world.setObjects([floor]);
    for(let row=0;row<6;row++)for(let column=0;column<6;column++)release(world,445+column*22,160+row*19,10);
    for(let step=0;step<1200;step++)world.step();
    expect(world.marbles.size).toBe(36);
    for(const marble of world.marbles.values()){
      expect(Number.isFinite(marble.body.position.x)&&Number.isFinite(marble.body.position.y)).toBe(true);
      expect(marble.body.speed).toBeLessThan(.15);
    }
    world.destroy();
  });
});

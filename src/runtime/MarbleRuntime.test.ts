import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {MAX_ACCUMULATED_SECONDS,MarbleRuntime} from './MarbleRuntime';
import {Synth} from '../audio/Synth';
import {sampleDocument} from '../model/test-fixtures';
import * as renderer from '../canvas/renderer';

class CanvasStub extends EventTarget {
  dataset:Record<string,string>={};
  style:Record<string,string>={};
  width=800;height=600;
  getContext(){return {};}
  getBoundingClientRect(){return{width:800,height:600,left:0,top:0};}
  setAttribute(){}
}

beforeEach(()=>{
  vi.stubGlobal('window',{matchMedia:()=>({matches:false}),devicePixelRatio:1});
  vi.stubGlobal('document',new EventTarget());
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
  vi.stubGlobal('requestAnimationFrame',()=>1);
  vi.stubGlobal('cancelAnimationFrame',()=>{});
  vi.spyOn(renderer,'render').mockImplementation(()=>{});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

function runtime(){
  const instance=new MarbleRuntime(new CanvasStub() as unknown as HTMLCanvasElement,{
    onEdit:vi.fn(),onSelect:vi.fn(),onPlace:vi.fn(),onStatus:vi.fn(),onHint:vi.fn(),onNote:vi.fn(),
  });
  instance.setDocument(sampleDocument());return instance;
}

let clock=0;
function tick(instance:MarbleRuntime, milliseconds:number){
  clock=milliseconds;
  (instance as unknown as {tick:(timestamp:number)=>void}).tick(clock);
}

async function start(instance:MarbleRuntime){
  vi.spyOn(Synth.prototype,'initialize').mockResolvedValue();
  await instance.start();
}

describe('fixed-step timing',()=>{
  beforeEach(()=>{
    clock=0;
    vi.spyOn(performance,'now').mockImplementation(()=>clock);
    vi.spyOn(Synth.prototype,'currentTime','get').mockImplementation(()=>clock/1000);
  });

  it.each([60,30,10])('keeps physics near real time at %i FPS',async(fps)=>{
    const instance=runtime();await start(instance);
    // Establish a non-zero RAF timestamp; browsers use a non-zero monotonic
    // time, while this deterministic clock begins at zero.
    tick(instance,1);
    for(let frame=1;frame<=fps;frame++)tick(instance,1+frame*1000/fps);
    // At 10 FPS this used to advance only half a second per wall-clock second
    // because the accumulator was capped at six 120 Hz steps.
    expect(instance.physics.time).toBeGreaterThan(.98);
    expect(instance.physics.time).toBeLessThanOrEqual(1);
    instance.destroy();
  });

  it('limits a long stalled frame to the bounded catch-up budget',async()=>{
    const instance=runtime();await start(instance);
    tick(instance,1);tick(instance,5_001);
    expect(instance.physics.time).toBeCloseTo(MAX_ACCUMULATED_SECONDS,8);
    instance.destroy();
  });

  it('does not replay paused time or emissions on resume',async()=>{
    const instance=runtime();const emit=vi.spyOn(instance.physics,'emit');await start(instance);
    tick(instance,100);
    const beforePause={time:instance.physics.time,emissions:emit.mock.calls.length};
    instance.pause();
    tick(instance,5_000);
    expect(instance.physics.time).toBe(beforePause.time);
    expect(emit).toHaveBeenCalledTimes(beforePause.emissions);

    await start(instance);
    tick(instance,5_100);
    expect(instance.physics.time-beforePause.time).toBeCloseTo(MAX_ACCUMULATED_SECONDS,8);
    // The new transport origin schedules only the current release, never the
    // five seconds of releases that elapsed while playback was paused.
    expect(emit.mock.calls.length-beforePause.emissions).toBeLessThanOrEqual(1);
    instance.destroy();
  });
});

describe('single-step audio initialization',()=>{
  for(const action of ['pause','reset','destroy'] as const)it(`does not release or advance after ${action} cancels a pending step`,async()=>{
    let resume!:()=>void;
    vi.spyOn(Synth.prototype,'initialize').mockImplementation(()=>new Promise<void>(resolve=>{resume=resolve;}));
    const instance=runtime(),emit=vi.spyOn(instance.physics,'emit'),advance=vi.spyOn(instance.physics,'step');
    const pending=instance.step();instance[action]();resume();await pending;
    expect(emit).not.toHaveBeenCalled();expect(advance).not.toHaveBeenCalled();expect(instance.physics.marbles.size).toBe(0);
    if(action!=='destroy')instance.destroy();
  });
  it('releases and advances normally after audio initialization resolves',async()=>{
    vi.spyOn(Synth.prototype,'initialize').mockResolvedValue();
    const instance=runtime();await instance.step();
    expect(instance.physics.marbles.size).toBe(1);expect(instance.physics.time).toBeCloseTo(1/120);instance.destroy();
  });
});

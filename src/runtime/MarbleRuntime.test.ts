import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {MarbleRuntime} from './MarbleRuntime';
import {Synth} from '../audio/Synth';
import {sampleDocument} from '../model/test-fixtures';

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
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

function runtime(){
  const instance=new MarbleRuntime(new CanvasStub() as unknown as HTMLCanvasElement,{
    onEdit:vi.fn(),onSelect:vi.fn(),onPlace:vi.fn(),onStatus:vi.fn(),onHint:vi.fn(),onNote:vi.fn(),
  });
  instance.setDocument(sampleDocument());return instance;
}

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

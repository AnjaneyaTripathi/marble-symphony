import {describe,it,expect} from 'vitest';
import {presets} from '../presets';
import {validateDocument} from '../model/validation';
import type {EmitterObject} from '../model/types';
import {PhysicsWorld} from './world';
import {Transport} from '../audio/Transport';

describe('authored machines',()=>{
  for(const preset of presets)it(`${preset.name} creates real musical impacts and remains bounded`,()=>{
    const doc=validateDocument(preset.document);
    const hits=new Map<string,number>();const pitches=new Set<number>();let caught=0;
    const world=new PhysicsWorld(({object})=>{hits.set(object.id,(hits.get(object.id)??0)+1);if(object.type==='catcher')caught++;if('note'in object&&!(('musical'in object)&&!object.musical))pitches.add(object.note);});
    world.setObjects(doc.objects);const transport=new Transport(doc.music);transport.start(0);
    const emitters=doc.objects.filter((o):o is EmitterObject=>o.type==='emitter');
    let releases:ReturnType<Transport['poll']>=[];
    for(let frame=0;frame<3600;frame++){
      const now=frame/120;releases.push(...transport.poll(now,emitters));
      releases=releases.filter(event=>{if(event.time<=now){world.emit(emitters.find(o=>o.id===event.emitterId)!);return false;}return true;});
      world.step();expect(world.marbles.size).toBeLessThanOrEqual(120);
    }
    expect(pitches.size).toBeGreaterThanOrEqual(3);expect(caught).toBeGreaterThan(0);
    const instruments=doc.objects.filter(o=>o.type==='bar'||((o.type==='bumper'||o.type==='catcher')&&o.musical));
    for(const instrument of instruments)expect(hits.get(instrument.id),`The ${instrument.type} at ${instrument.x}, ${instrument.y} should actually be played`).toBeGreaterThan(0);
    if(preset.id==='first-melody')expect([...pitches].filter(note=>[60,64,67,72,48].includes(note))).toEqual([60,64,67,72,48]);
    transport.pause();for(let frame=0;frame<6000;frame++)world.step();expect(world.marbles.size).toBe(0);world.destroy();
  });
});

import { describe, expect, it } from 'vitest';
import { createObject } from './defaults';
import { parseDocument, serializeDocument, validateDocument } from './validation';
import { sampleDocument } from './test-fixtures';
describe('document validation', () => {
  it('round trips every supported object and music setting', () => {
    const document = sampleDocument();
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });
  it.each([NaN,Infinity,-Infinity, -201,1401])('rejects invalid x coordinate %s', x => {
    const document = sampleDocument(); document.objects[0].x = x;
    expect(()=>validateDocument(document)).toThrow('position');
  });
  it('rejects unsupported versions, malformed JSON, duplicate ids, and excess objects', () => {
    expect(()=>validateDocument({...sampleDocument(),version:2})).toThrow('version');
    expect(()=>parseDocument('{bad')).toThrow('JSON');
    const document = sampleDocument(); document.objects[1].id=document.objects[0].id;
    expect(()=>validateDocument(document)).toThrow('unique');
    expect(()=>validateDocument({...sampleDocument(),objects:Array.from({length:201},()=>createObject('ramp',100,100))})).toThrow('200');
  });
  it('rejects dimensions, launch speed, text length, note, and music bounds', () => {
    const document = sampleDocument();
    expect(()=>validateDocument({...document,objects:[{...createObject('emitter',100,100),speed:99}]})).toThrow('speed');
    expect(()=>validateDocument({...document,objects:[{...createObject('ramp',100,100),length:0}]})).toThrow('length');
    expect(()=>validateDocument({...document,objects:[{...createObject('text',100,100),text:'x'.repeat(161)}]})).toThrow('Label');
    expect(()=>validateDocument({...document,objects:[{...createObject('bar',100,100),note:60.5}]})).toThrow('MIDI');
    expect(()=>validateDocument({...document,music:{...document.music,bpm:0}})).toThrow('Tempo');
  });
  it('strips unknown state and preserves labels as plain text', () => {
    const document = sampleDocument(); const label = document.objects.find(o=>o.type==='text')!;
    label.text='<script>alert(1)</script>';
    expect(validateDocument({...document,engine:{}})).toEqual(document);
    expect(()=>parseDocument(' '.repeat(300001))).toThrow('large');
  });
});

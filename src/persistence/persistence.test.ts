import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleDocument } from '../model/test-fixtures';
import { createObject } from '../model/defaults';
import { decodeShare, encodeShare, MAX_SHARE_LENGTH } from './share';
import { deleteNamed, listSaves, loadAutosave, loadNamed, saveAutosave, saveNamed } from './storage';
describe('portable share documents',()=>{
  it('round trips all objects, unicode, and settings in a bounded compact fragment',()=>{
    const document=sampleDocument();const hash=encodeShare(document);expect(hash.startsWith('#machine=')).toBe(true);expect(decodeShare(hash)).toEqual(document);expect(decodeShare('')).toBeNull();expect(decodeShare('#other')).toBeNull();
  });
  it('rejects invalid, oversized and unsupported share data',()=>{
    expect(()=>decodeShare('#machine=%bad')).toThrow();
    expect(()=>decodeShare('#machine='+ 'a'.repeat(MAX_SHARE_LENGTH))).toThrow('large');
    expect(()=>decodeShare('#machine='+btoa('[2,0,[],[],true]').replace(/=+$/,''))).toThrow('unsupported');
    const document=sampleDocument();document.objects=Array.from({length:200},()=>({...createObject('text',100,100),text:'x'.repeat(160)}));
    expect(()=>encodeShare(document)).toThrow('Export');
  });
});
describe('device persistence',()=>{
  beforeEach(()=>{
    const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
  });
  afterEach(()=>vi.unstubAllGlobals());
  it('recovers autosave and creates, updates, loads and deletes named saves',()=>{
    expect(loadAutosave()).toBeNull();const document=sampleDocument();saveAutosave(document);expect(loadAutosave()).toEqual(document);
    const saved=saveNamed(document);expect(listSaves()).toHaveLength(1);expect(loadNamed(saved.id)).toEqual(document);
    document.music.bpm=120;expect(saveNamed(document).id).toBe(saved.id);expect(loadNamed(saved.id).music.bpm).toBe(120);deleteNamed(saved.id);expect(listSaves()).toHaveLength(0);
  });
  it('surfaces unavailable storage and quota errors with export recovery advice',()=>{
    vi.stubGlobal('localStorage',{getItem:()=>{throw new Error()},setItem:()=>{throw new Error()}});
    expect(()=>loadAutosave()).toThrow('unavailable');expect(()=>saveAutosave(sampleDocument())).toThrow('export');
  });
});

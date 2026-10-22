import { createObject } from './defaults';
import { OBJECT_TYPES } from './types';
import type { MachineDocument } from './types';
export function sampleDocument(): MachineDocument {
  return {version:1,name:'A small machine 🎵',music:{bpm:96,root:0,scale:'major',masterVolume:0.6,muted:false,snapNotes:false,snapDivision:'eighth'},editor:{gridSnap:true},objects:OBJECT_TYPES.map((type,index)=>createObject(type,100+index*100,200))};
}

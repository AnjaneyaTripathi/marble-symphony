import type { MachineObject, ObjectType } from './types';

let sequence = 0;
export function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `object-${Date.now().toString(36)}-${++sequence}`;
}
export function createObject(type: ObjectType, x: number, y: number): MachineObject {
  const base = { id: newId(), x, y, rotation: 0 };
  switch (type) {
    case 'emitter': return { ...base, type, speed: 0, marbleSize: 10, division: 'quarter', beatOffset: 0, enabled: true, color: '#e9a137' };
    case 'ramp': return { ...base, type, length: 180, friction: 0.04, bounce: 0.2, color: '#8b9c91' };
    case 'bar': return { ...base, type, length: 150, note: 60, voice: 'marimba', volume: 0.7, bounce: 0.55, color: '#e59385' };
    case 'bumper': return { ...base, type, radius: 30, bounce: 1.1, musical: true, note: 67, voice: 'bell', volume: 0.6, color: '#8ea8cb' };
    case 'funnel': return { ...base, type, width: 180, color: '#c49b64' };
    case 'catcher': return { ...base, type, width: 150, musical: false, note: 48, voice: 'warm', volume: 0.5, color: '#7d9a8c' };
    case 'text': return { ...base, type, text: 'A little music', fontSize: 26, color: '#74746b' };
  }
}

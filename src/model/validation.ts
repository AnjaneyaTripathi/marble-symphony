import { OBJECT_TYPES } from './types';
import type { MachineDocument, MachineObject } from './types';

export const MAX_OBJECTS = 200;
export const MAX_DOCUMENT_LENGTH = 300_000;
type RecordValue = Record<string, unknown>;
function record(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as RecordValue;
}
function number(value: unknown, label: string, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`${label} must be ${integer ? 'a whole number' : 'a number'} between ${min} and ${max}.`);
  return value;
}
function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`);
  return value;
}
function string(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) throw new Error(`${label} must contain ${min}–${max} characters.`);
  return value;
}
function choice<T extends string>(value: unknown, label: string, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw new Error(`${label} is not supported.`);
  return value as T;
}
function color(value: unknown): string {
  const result = string(value, 'Color', 7, 7);
  if (!/^#[0-9a-f]{6}$/i.test(result)) throw new Error('Color must be a six-digit hex color.');
  return result;
}
export function validateDocument(input: unknown): MachineDocument {
  const doc = record(input, 'Project');
  if (doc.version !== 1) throw new Error('This project version is not supported. Please use a version 1 Marble Symphony file.');
  const music = record(doc.music, 'Music settings');
  const editor = record(doc.editor, 'Editor preferences');
  if (!Array.isArray(doc.objects) || doc.objects.length > MAX_OBJECTS) throw new Error(`A project may contain at most ${MAX_OBJECTS} objects.`);
  const ids = new Set<string>();
  const objects = doc.objects.map((raw, index): MachineObject => {
    const obj = record(raw, `Object ${index + 1}`);
    const id = string(obj.id, 'Object ID', 1, 100);
    if (ids.has(id)) throw new Error('Object IDs must be unique.');
    ids.add(id);
    const type = choice(obj.type, 'Object type', OBJECT_TYPES);
    const base = { id, x: number(obj.x, 'Horizontal position', -200, 1400), y: number(obj.y, 'Vertical position', -200, 1050), rotation: number(obj.rotation, 'Rotation', -360, 360), color: color(obj.color) };
    const note = () => number(obj.note, 'MIDI note', 24, 96, true);
    const voice = () => choice(obj.voice, 'Voice', ['marimba','bell','warm'] as const);
    const volume = () => number(obj.volume, 'Volume', 0, 1);
    switch (type) {
      case 'emitter': return { ...base, type, speed:number(obj.speed,'Launch speed',0,12),marbleSize:number(obj.marbleSize,'Marble size',5,20),division:choice(obj.division,'Division',['quarter','eighth','sixteenth'] as const),beatOffset:number(obj.beatOffset,'Beat offset',0,16),enabled:bool(obj.enabled,'Emitter enabled') };
      case 'ramp': return { ...base,type,length:number(obj.length,'Ramp length',40,600),friction:number(obj.friction,'Friction',0,1),bounce:number(obj.bounce,'Bounce',0,1.5) };
      case 'bar': return { ...base,type,length:number(obj.length,'Bar length',40,500),note:note(),voice:voice(),volume:volume(),bounce:number(obj.bounce,'Bounce',0,1.5) };
      case 'bumper': return { ...base,type,radius:number(obj.radius,'Bumper radius',12,100),bounce:number(obj.bounce,'Bounce',0,1.5),musical:bool(obj.musical,'Musical bumper'),note:note(),voice:voice(),volume:volume() };
      case 'funnel': return { ...base,type,width:number(obj.width,'Funnel width',80,400) };
      case 'catcher': return { ...base,type,width:number(obj.width,'Catcher width',50,600),musical:bool(obj.musical,'Musical catcher'),note:note(),voice:voice(),volume:volume() };
      case 'text': return { ...base,type,text:string(obj.text,'Label',0,160),fontSize:number(obj.fontSize,'Font size',12,64) };
    }
  });
  return { version:1, name:string(doc.name,'Project name',1,80),music:{ bpm:number(music.bpm,'Tempo',40,200),root:number(music.root,'Root note',0,11,true),scale:choice(music.scale,'Scale',['major','minor','pentatonic','chromatic'] as const),masterVolume:number(music.masterVolume,'Master volume',0,1),muted:bool(music.muted,'Mute'),snapNotes:bool(music.snapNotes,'Snap notes'),snapDivision:choice(music.snapDivision,'Snap division',['quarter','eighth','sixteenth'] as const) },objects,editor:{gridSnap:bool(editor.gridSnap,'Grid snap')} };
}
export function serializeDocument(doc: MachineDocument): string { return JSON.stringify(validateDocument(doc)); }
export function parseDocument(json: string): MachineDocument {
  if (json.length > MAX_DOCUMENT_LENGTH) throw new Error('This project file is too large (maximum 300 KB).');
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('This file does not contain valid JSON.'); }
  return validateDocument(value);
}

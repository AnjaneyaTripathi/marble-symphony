export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 850;
export const SCHEMA_VERSION = 1;
export type ObjectType = 'emitter' | 'ramp' | 'bar' | 'bumper' | 'funnel' | 'catcher' | 'text';
export type Division = 'quarter' | 'eighth' | 'sixteenth';
export type Voice = 'marimba' | 'bell' | 'warm';
export type Scale = 'major' | 'minor' | 'pentatonic' | 'chromatic';
export interface BaseObject { id: string; type: ObjectType; x: number; y: number; rotation: number }
export interface EmitterObject extends BaseObject { type:'emitter'; speed:number; marbleSize:number; division:Division; beatOffset:number; enabled:boolean; color:string }
export interface RampObject extends BaseObject { type:'ramp'; length:number; friction:number; bounce:number; color:string }
export interface BarObject extends BaseObject { type:'bar'; length:number; note:number; voice:Voice; volume:number; bounce:number; color:string }
export interface BumperObject extends BaseObject { type:'bumper'; radius:number; bounce:number; musical:boolean; note:number; voice:Voice; volume:number; color:string }
export interface FunnelObject extends BaseObject { type:'funnel'; width:number; color:string }
export interface CatcherObject extends BaseObject { type:'catcher'; width:number; musical:boolean; note:number; voice:Voice; volume:number; color:string }
export interface TextObject extends BaseObject { type:'text'; text:string; fontSize:number; color:string }
export type MachineObject = EmitterObject | RampObject | BarObject | BumperObject | FunnelObject | CatcherObject | TextObject;
export interface MusicSettings { bpm:number; root:number; scale:Scale; masterVolume:number; muted:boolean; snapNotes:boolean; snapDivision:Division }
export interface EditorPreferences { gridSnap:boolean }
export interface MachineDocument { version:1; name:string; music:MusicSettings; objects:MachineObject[]; editor:EditorPreferences }
export const OBJECT_TYPES: ObjectType[] = ['emitter','ramp','bar','bumper','funnel','catcher','text'];

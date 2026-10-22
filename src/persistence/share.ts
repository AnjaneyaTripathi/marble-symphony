import type { MachineDocument, ObjectType } from '../model/types';
import { MAX_DOCUMENT_LENGTH, parseDocument, serializeDocument } from '../model/validation';
export const MAX_SHARE_LENGTH = 12_000;
const fields: Record<ObjectType,string[]> = {
  emitter:['speed','marbleSize','division','beatOffset','enabled','color'],
  ramp:['length','friction','bounce','color'],
  bar:['length','note','voice','volume','bounce','color'],
  bumper:['radius','bounce','musical','note','voice','volume','color'],
  funnel:['width','color'], catcher:['width','musical','note','voice','volume','color'],
  text:['text','fontSize','color'],
};
const musicFields = ['bpm','root','scale','masterVolume','muted','snapNotes','snapDivision'] as const;
export function encodeShare(doc: MachineDocument): string {
  const clean = JSON.parse(serializeDocument(doc)) as MachineDocument;
  const packed = [1,clean.name,musicFields.map(key => clean.music[key]),clean.objects.map(object => {
    const row = object as unknown as Record<string,unknown>;
    return [object.id,object.type,object.x,object.y,object.rotation,...fields[object.type].map(key => row[key])];
  }),clean.editor.gridSnap];
  const bytes = new TextEncoder().encode(JSON.stringify(packed));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const hash = `#machine=${encoded}`;
  if (hash.length > MAX_SHARE_LENGTH) throw new Error('This machine is too large for a reliable share link. Export a project file instead.');
  return hash;
}
export function decodeShare(hash: string): MachineDocument | null {
  if (!hash || hash === '#') return null;
  if (!hash.startsWith('#machine=')) return null;
  if (hash.length > MAX_SHARE_LENGTH) throw new Error('This share link is too large. Ask for an exported project file instead.');
  let json: string;
  try {
    const encoded = hash.slice(9);
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error();
    const binary = atob(encoded.replace(/-/g,'+').replace(/_/g,'/'));
    json = new TextDecoder('utf-8', { fatal:true }).decode(Uint8Array.from(binary,c => c.charCodeAt(0)));
  } catch { throw new Error('This share link is damaged or incomplete.'); }
  if (!json || json.length > MAX_DOCUMENT_LENGTH) throw new Error('This share link is damaged or contains an oversized project.');
  let packed: unknown;
  try { packed = JSON.parse(json); } catch { throw new Error('This share link is damaged or incomplete.'); }
  if (!Array.isArray(packed) || packed.length !== 5 || packed[0] !== 1 || !Array.isArray(packed[2]) || !Array.isArray(packed[3])) throw new Error('This share link has an unsupported format.');
  const music = Object.fromEntries(musicFields.map((key,index) => [key, packed[2][index]]));
  const objects = packed[3].map((row:unknown) => {
    if (!Array.isArray(row) || typeof row[1] !== 'string' || !Object.hasOwn(fields,row[1])) throw new Error('This share link contains an invalid object.');
    const keys = fields[row[1] as ObjectType];
    return {id:row[0],type:row[1],x:row[2],y:row[3],rotation:row[4],...Object.fromEntries(keys.map((key,index) => [key,row[index+5]]))};
  });
  return parseDocument(JSON.stringify({version:packed[0],name:packed[1],music,objects,editor:{gridSnap:packed[4]}}));
}

import type { MachineDocument } from '../model/types';
import { parseDocument, serializeDocument, validateDocument } from '../model/validation';
import { newId } from '../model/defaults';
const AUTOSAVE_KEY = 'marble-symphony.autosave.v1';
const SAVES_KEY = 'marble-symphony.saves.v1';
export interface SavedProject { id:string; name:string; updatedAt:number; document:MachineDocument }
function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { throw new Error('Local storage is unavailable. You can still build and export a project file.'); }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { throw new Error('Could not save on this device. Storage may be full or unavailable; export a project file to keep your work.'); }
}
export function loadAutosave(): MachineDocument | null { const value = read(AUTOSAVE_KEY); return value === null ? null : parseDocument(value); }
export function saveAutosave(doc: MachineDocument): void { write(AUTOSAVE_KEY, serializeDocument(doc)); }
export function listSaves(): SavedProject[] {
  const value = read(SAVES_KEY);
  if (value === null) return [];
  try {
    const list: unknown = JSON.parse(value);
    if (!Array.isArray(list) || list.length > 100) throw new Error();
    return list.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error();
      const row = item as Record<string, unknown>;
      if (typeof row.id !== 'string' || row.id.length > 100 || typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt)) throw new Error();
      const document = validateDocument(row.document);
      return {id:row.id, name:document.name, updatedAt:row.updatedAt, document};
    }).sort((a,b) => b.updatedAt-a.updatedAt);
  } catch { throw new Error('Saved projects on this device are damaged. Your current machine can still be exported.'); }
}
export function saveNamed(doc: MachineDocument): SavedProject {
  const document = validateDocument(doc);
  const list = listSaves();
  const existing = list.find(item => item.name === document.name);
  const saved = {id:existing?.id ?? newId(), name:document.name, updatedAt:Date.now(), document};
  const next = [saved,...list.filter(item => item.id !== saved.id)];
  if (next.length > 100) throw new Error('You have reached 100 local saves. Delete a save or export this project.');
  write(SAVES_KEY,JSON.stringify(next));
  return saved;
}
export function loadNamed(id: string): MachineDocument {
  const item = listSaves().find(item => item.id === id);
  if (!item) throw new Error('This local save no longer exists.');
  return item.document;
}
export function deleteNamed(id: string): void { write(SAVES_KEY,JSON.stringify(listSaves().filter(item => item.id !== id))); }

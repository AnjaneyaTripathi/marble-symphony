import type { MachineDocument } from '../model/types';
const clone = (doc: MachineDocument): MachineDocument => JSON.parse(JSON.stringify(doc)) as MachineDocument;
export class DesignHistory {
  private entries: MachineDocument[];
  private cursor = 0;
  constructor(initial: MachineDocument) { this.entries = [clone(initial)]; }
  get current(): MachineDocument { return clone(this.entries[this.cursor]); }
  get canUndo(): boolean { return this.cursor > 0; }
  get canRedo(): boolean { return this.cursor < this.entries.length - 1; }
  commit(next: MachineDocument): MachineDocument {
    if (JSON.stringify(next) === JSON.stringify(this.entries[this.cursor])) return this.current;
    this.entries = this.entries.slice(0, this.cursor + 1);
    this.entries.push(clone(next));
    if (this.entries.length > 100) this.entries.shift();
    this.cursor = this.entries.length - 1;
    return this.current;
  }
  undo(): MachineDocument { if (this.canUndo) this.cursor--; return this.current; }
  redo(): MachineDocument { if (this.canRedo) this.cursor++; return this.current; }
  reset(doc: MachineDocument): MachineDocument { this.entries = [clone(doc)]; this.cursor = 0; return this.current; }
}

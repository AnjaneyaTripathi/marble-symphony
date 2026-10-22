import { describe, expect, it } from 'vitest';
import { DesignHistory } from './history';
import { createObject } from '../model/defaults';
import { sampleDocument } from '../model/test-fixtures';
describe('design undo history',()=>{
  it('undoes and redoes add, property edit, move, and delete in order',()=>{
    const original=sampleDocument(); const history=new DesignHistory(original);
    const added={...history.current,objects:[...history.current.objects,createObject('ramp',500,500)]}; history.commit(added);
    const edited=history.current; edited.name='Edited'; history.commit(edited);
    const moved=history.current; moved.objects[0].x=800; history.commit(moved);
    const deleted=history.current; deleted.objects.splice(0,1); history.commit(deleted);
    expect(history.undo()).toEqual(moved); expect(history.undo()).toEqual(edited); expect(history.undo()).toEqual(added); expect(history.undo()).toEqual(original);
    expect(history.canUndo).toBe(false); expect(history.redo()).toEqual(added); expect(history.redo()).toEqual(edited); expect(history.redo()).toEqual(moved); expect(history.redo()).toEqual(deleted); expect(history.canRedo).toBe(false);
  });
  it('clones state, discards redo after a new edit, ignores duplicate commits and resets',()=>{
    const original=sampleDocument();const history=new DesignHistory(original);
    original.name='Mutated'; expect(history.current.name).not.toBe('Mutated');
    const changed=history.current;changed.name='New';history.commit(changed);history.undo();
    const branch=history.current;branch.name='Branch';history.commit(branch);expect(history.canRedo).toBe(false);
    history.commit(branch);history.undo();expect(history.canUndo).toBe(false);
    history.reset(changed);expect(history.current).toEqual(changed);expect(history.canUndo).toBe(false);
  });
});

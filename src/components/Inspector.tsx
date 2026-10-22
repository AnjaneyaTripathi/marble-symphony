import { Copy, Trash2, RotateCw, SlidersHorizontal, MousePointer2 } from 'lucide-react';
import type { MachineDocument, MachineObject } from '../model/types';

export const objectLabels = { emitter: 'Marble emitter', ramp: 'Ramp', bar: 'Musical bar', bumper: 'Bumper', funnel: 'Funnel', catcher: 'Catcher', text: 'Text label' };
const pitchNames = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export function formatNote(note: number) { return `${pitchNames[note % 12]}${Math.floor(note / 12) - 1}`; }
const scales = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], pentatonic: [0, 2, 4, 7, 9], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };

interface Props { document: MachineDocument; selected: MachineObject | undefined; onSelect: (id: string) => void; onChange: (patch: Partial<MachineObject>) => void; onDuplicate: () => void; onDelete: () => void }
export default function Inspector({ document, selected, onSelect, onChange, onDuplicate, onDelete }: Props) {
  const numeric = (key: string, label: string, min: number, max: number, step = 1, suffix = '') => {
    const value = (selected as unknown as Record<string, number>)[key];
    return <label className="field" key={key}><span>{label}</span><div className="number-wrap"><input aria-label={label} type="number" min={min} max={max} step={step} value={Number(value.toFixed(3))} onChange={e => { const next = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(next)) onChange({ [key]: Math.min(max, Math.max(min, next)) } as Partial<MachineObject>); }} />{suffix && <span>{suffix}</span>}</div></label>;
  };
  return <aside className="inspector panel-content" aria-label="Object inspector">
    <div className="panel-heading"><SlidersHorizontal size={15} /><h2>Fine tune</h2><span className="eyebrow">INSPECTOR</span></div>
    {selected ? <>
      <div className="selected-heading"><span className={`type-mark ${selected.type}`} /><div><h3>{objectLabels[selected.type]}</h3><p>Make it your own.</p></div><span className="selected-dot" title="Selected object" /></div>
      <div className="field-grid">{numeric('x', 'Position X', -200, 1400)}{numeric('y', 'Position Y', -200, 1050)}</div>
      <label className="field"><span>Rotation</span><div className="rotation-field"><RotateCw size={14} /><input aria-label="Rotation" type="number" min={-360} max={360} value={Math.round(selected.rotation)} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value)) onChange({ rotation: Math.max(-360, Math.min(360, value)) }); }} /><span>°</span><button title="Rotate 15 degrees" aria-label="Rotate 15 degrees" onClick={() => onChange({ rotation: (selected.rotation + 15) % 360 })}>+15°</button></div></label>
      <div className="inspector-divider" />
      {selected.type === 'emitter' && <>
        <label className="switch-field"><span>Emitter enabled</span><input type="checkbox" checked={selected.enabled} onChange={e => onChange({ enabled: e.target.checked })} /></label>
        <label className="field"><span>Release a marble every</span><select value={selected.division} onChange={e => onChange({ division: e.target.value as 'quarter' })}><option value="quarter">Quarter note · ¼</option><option value="eighth">Eighth note · ⅛</option><option value="sixteenth">Sixteenth note · ¹⁄₁₆</option></select></label>
        {numeric('beatOffset', 'Beat offset', 0, 16, 0.25, 'beats')}
        {numeric('speed', 'Launch speed', 0, 12, 0.5)}
        {numeric('marbleSize', 'Marble radius', 5, 20, 1, 'px')}
        <p className="field-help">Rotation sets the launch direction. Zero points down.</p>
      </>}
      {(selected.type === 'ramp' || selected.type === 'bar') && numeric('length', 'Length', 40, selected.type === 'bar' ? 500 : 600, 5, 'px')}
      {selected.type === 'ramp' && numeric('friction', 'Friction', 0, 1, 0.01)}
      {selected.type === 'bumper' && numeric('radius', 'Radius', 12, 100, 1, 'px')}
      {(selected.type === 'funnel' || selected.type === 'catcher') && numeric('width', 'Width', selected.type === 'funnel' ? 80 : 50, selected.type === 'funnel' ? 400 : 600, 5, 'px')}
      {(selected.type === 'ramp' || selected.type === 'bar' || selected.type === 'bumper') && numeric('bounce', 'Bounce', 0, 1.5, 0.05)}
      {(selected.type === 'bumper' || selected.type === 'catcher') && <label className="switch-field"><span>Play a note on impact</span><input type="checkbox" checked={selected.musical} onChange={e => onChange({ musical: e.target.checked })} /></label>}
      {'note' in selected && <div className="sound-settings">
        <div className="field-grid"><label className="field"><span>Pitch</span><select aria-label="Pitch" value={selected.note % 12} onChange={e => onChange({ note: Math.min(96, Math.floor(selected.note / 12) * 12 + Number(e.target.value)) })}>{pitchNames.map((name, index) => (scales[document.music.scale].includes((index - document.music.root + 12) % 12) || index === selected.note % 12) && <option key={index} value={index}>{name}{!scales[document.music.scale].includes((index - document.music.root + 12) % 12) ? ' (outside scale)' : ''}</option>)}</select></label><label className="field"><span>Octave</span><select aria-label="Octave" value={Math.floor(selected.note / 12) - 1} onChange={e => onChange({ note: Math.min(96, (Number(e.target.value) + 1) * 12 + selected.note % 12) })}>{[1, 2, 3, 4, 5, 6, 7].map(o => <option key={o}>{o}</option>)}</select></label></div>
        <label className="field"><span>Voice</span><select value={selected.voice} onChange={e => onChange({ voice: e.target.value as 'marimba' })}><option value="marimba">Soft marimba</option><option value="bell">Gentle bell</option><option value="warm">Warm keys</option></select></label>
        <label className="field"><span>Note volume <small>{Math.round(selected.volume * 100)}%</small></span><input aria-label="Note volume" type="range" min="0" max="1" step="0.01" value={selected.volume} onChange={e => onChange({ volume: Number(e.target.value) })} /></label>
      </div>}
      {selected.type === 'text' && <><label className="field"><span>Label text</span><textarea aria-label="Label text" rows={3} maxLength={160} value={selected.text} onChange={e => onChange({ text: e.target.value })} /></label>{numeric('fontSize', 'Text size', 12, 64, 1, 'px')}</>}
      <label className="field color-field"><span>Object color</span><input type="color" aria-label="Object color" value={selected.color} onChange={e => onChange({ color: e.target.value })} /></label>
      <div className="object-actions"><button onClick={onDuplicate}><Copy size={14} />Duplicate</button><button className="danger-text" onClick={onDelete}><Trash2 size={14} />Delete</button></div>
    </> : <div className="empty-inspector"><div><MousePointer2 size={23} strokeWidth={1.4} /></div><h3>A little adjustment.<br />A whole new melody.</h3><p>Select an object on the canvas to explore its settings.</p><span>Or add something from the shelf.</span></div>}
    <div className="object-list-heading"><span>OBJECTS</span><span>{document.objects.length}</span></div>
    <div className="object-list" role="list" aria-label="Machine objects">{document.objects.map((object, index) => <div role="listitem" key={object.id}><button className={selected?.id === object.id ? 'is-selected' : ''} onClick={() => onSelect(object.id)}><span className={`type-mark ${object.type}`} style={{ backgroundColor: object.color }} /><span>{object.type === 'text' ? object.text.slice(0, 22) || 'Text label' : objectLabels[object.type]}</span>{'note' in object ? <small>{formatNote(object.note)}</small> : <small>{String(index + 1).padStart(2, '0')}</small>}</button></div>)}</div>
  </aside>;
}

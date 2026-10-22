import { useEffect, useRef, useState } from 'react';
import { X, RotateCcw, StepForward, Volume2, VolumeX, Undo2, Redo2 } from 'lucide-react';
import type { MachineDocument, MusicSettings } from '../model/types';
import TempoInput from './TempoInput';

interface Props { document: MachineDocument; playing: boolean; onMusic: (patch: Partial<MusicSettings>) => void; onRename: (name: string) => void; onClose: () => void; onReset: () => void; onStep: () => void; onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean }
export default function PlaybackSettings({ document, playing, onMusic, onRename, onClose, onReset, onStep, onUndo, onRedo, canUndo, canRedo }: Props) {
  const [name, setName] = useState(document.name);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { const previous = window.document.activeElement as HTMLElement; close.current?.focus(); return () => previous?.focus(); }, []);
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><section className="playback-dialog save-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onKeyDown={e => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Tab') { const elements = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input')); const first = elements[0], last = elements.at(-1); if (e.shiftKey && window.document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && window.document.activeElement === last) { e.preventDefault(); first?.focus(); } }
  }}><button ref={close} className="icon-button modal-close" aria-label="Close project settings" onClick={onClose}><X size={19} /></button><span className="eyebrow">YOUR LITTLE WORKSHOP</span><h2 id="settings-title">Project & playback</h2><p className="dialog-intro">The essentials, always within reach.</p>
    <label className="field"><span>Project name</span><input aria-label="Project name" maxLength={80} value={name} onChange={e => setName(e.target.value)} onBlur={() => { const next = name.trim() || 'Untitled machine'; setName(next); onRename(next); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
    <label className="field"><span>Tempo · BPM</span><TempoInput value={document.music.bpm} onCommit={bpm => onMusic({ bpm })} /></label>
    <label className="field"><span>Master volume <small>{Math.round(document.music.masterVolume * 100)}%</small></span><input aria-label="Master volume" type="range" min={0} max={1} step={0.01} value={document.music.masterVolume} onChange={e => onMusic({ masterVolume: Number(e.target.value) })} /></label>
    <button className="settings-action" onClick={() => onMusic({ muted: !document.music.muted })}>{document.music.muted ? <VolumeX size={17} /> : <Volume2 size={17} />} {document.music.muted ? 'Unmute audio' : 'Mute audio'}<small>Playback keeps moving</small></button>
    <div className="settings-action-grid"><button className="settings-action" onClick={onReset}><RotateCcw size={17} />Reset marbles</button><button className="settings-action" disabled={playing} onClick={onStep}><StepForward size={17} />Single step</button><button className="settings-action" disabled={!canUndo} onClick={onUndo}><Undo2 size={17} />Undo</button><button className="settings-action" disabled={!canRedo} onClick={onRedo}><Redo2 size={17} />Redo</button></div><p className="storage-footnote">Reset clears marbles and effects while preserving your design. Single step advances physics while paused.</p>
  </section></div>;
}

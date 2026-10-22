import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, StepForward, Volume2, VolumeX, ArrowUpRight, Undo2, Redo2, MousePointer2, Hand, Grid2X2, Minus, Plus, Scan, X, Music2, SlidersHorizontal, PackageOpen, Sparkles, Circle, Type, Triangle, Magnet, Disc3, Settings2 } from 'lucide-react';
import type { MachineDocument, MachineObject, ObjectType, MusicSettings } from './model/types';
import { createObject, newId } from './model/defaults';
import { DesignHistory } from './editor/history';
import { presets, blankDocument } from './presets';
import { MarbleRuntime, type RuntimeStatus, type NoteActivity } from './runtime/MarbleRuntime';
import Inspector, { objectLabels, formatNote } from './components/Inspector';
import SaveDialog from './components/SaveDialog';
import PlaybackSettings from './components/PlaybackSettings';
import TempoInput from './components/TempoInput';
import { loadAutosave, saveAutosave } from './persistence/storage';
import { decodeShare } from './persistence/share';
import { scaleNoteOptions } from './audio/music';

function getInitialDocument(fallback: MachineDocument): { document: MachineDocument; message?: string; shared?: boolean; recovered?: boolean; consumedHash?: string } {
  let message = '';
  const consumedHash = window.location.hash.startsWith('#machine=') ? window.location.hash : undefined;
  try { const shared = decodeShare(window.location.hash); if (shared) return { document: shared, shared: true, consumedHash, message: 'A little symphony, shared with you. Press Start music to explore.' }; }
  catch (error) { message = error instanceof Error ? error.message : 'This share link could not be opened.'; }
  try { const saved = loadAutosave(); if (saved) return { document: saved, recovered: true, consumedHash, message: message || 'Welcome back. Your last machine was recovered from this device.' }; }
  catch (error) { message ||= error instanceof Error ? error.message : 'Local storage is unavailable. Export your work to keep it.'; }
  return { document: fallback, message, consumedHash };
}

const palette: { title: string; items: ObjectType[] }[] = [{ title: 'THE STRUCTURE', items: ['ramp', 'funnel', 'catcher'] }, { title: 'THE SOUND', items: ['bar', 'bumper'] }, { title: 'THE EXTRAS', items: ['emitter', 'text'] }];
const objectDetails = { ramp: 'Give it a little direction', funnel: 'Bring things together', catcher: 'A soft place to land', bar: 'A note with every touch', bumper: 'Bounce into a new sound', emitter: 'Where the rhythm begins', text: 'Leave a little note' };
const icons = { ramp: Minus, funnel: Triangle, catcher: Magnet, bar: Music2, bumper: Disc3, emitter: Circle, text: Type };
const initialStatus: RuntimeStatus = { playing: false, marbles: 0, notes: 0, beat: 0, audioReady: false, zoom: 1 };

export default function App() {
  const [initial] = useState(() => getInitialDocument(presets[0].document));
  const history = useRef(new DesignHistory(initial.document));
  const [document, setDocument] = useState<MachineDocument>(history.current.current);
  const [projectName, setProjectName] = useState(initial.document.name);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<ObjectType | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [activity, setActivity] = useState<NoteActivity[]>([]);
  const [hint, setHint] = useState(initial.message || 'A little gravity. A little melody. Make something lovely.');
  const [showWelcome, setShowWelcome] = useState(true);
  const [showSave, setShowSave] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [drawer, setDrawer] = useState<'palette' | 'inspector' | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [dirty, setDirty] = useState(Boolean(initial.recovered));
  const [savedLabel, setSavedLabel] = useState('Saved on this device');
  const [historyVersion, setHistoryVersion] = useState(0);
  const runtime = useRef<MarbleRuntime | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef(document);
  documentRef.current = document;
  const projectNameRef = useRef(projectName);
  projectNameRef.current = projectName;
  const selected = document.objects.find(o => o.id === selectedId);

  const pauseForEdit = useCallback(() => {
    if (runtime.current?.getStatus?.().playing) { runtime.current.pause(); setHint('Paused for a little fine tuning. Press play when you’re ready.'); }
  }, []);
  const commit = useCallback((next: MachineDocument) => {
    runtime.current?.pause();
    const committed = history.current.commit(next); documentRef.current = committed; setDocument(committed); setHistoryVersion(v => v + 1); setDirty(true); setSavedLabel('Saving locally…');
  }, []);
  const addObject = useCallback((type: ObjectType, x: number, y: number) => {
    if (documentRef.current.objects.length >= 100) { setHint('This machine has reached its 100-object limit.'); return; }
    const object = createObject(type, x, y);
    if ('note' in object) object.note = 60 + documentRef.current.music.root;
    commit({ ...documentRef.current, objects: [...documentRef.current.objects, object] });
    setSelectedId(object.id); setPlacement(null); setHint(`${objectLabels[type]} added. Give it your own twist in the inspector.`);
  }, [commit]);

  useEffect(() => {
    if (!canvas.current) return;
    const instance = new MarbleRuntime(canvas.current, {
      onEdit: objects => { commit({ ...documentRef.current, objects }); setHint('A little adjustment, a new possibility. Press play to hear it.'); },
      onSelect: setSelectedId,
      onPlace: addObject,
      onStatus: setStatus,
      onHint: setHint,
      onNote: event => setActivity(old => [...old.slice(-7), event]),
    });
    runtime.current = instance; instance.setDocument(documentRef.current);
    return () => { instance.destroy(); runtime.current = null; };
  }, [commit, addObject]);
  useEffect(() => { runtime.current?.setDocument(document); }, [document]);
  useEffect(() => { if (initial.consumedHash && window.location.hash === initial.consumedHash) { try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* The imported document remains usable if history is restricted. */ } } }, [initial]);
  useEffect(() => { setProjectName(document.name); }, [document.name]);
  useEffect(() => { runtime.current?.setEditor({ selectedId, placement, gridSnap: document.editor.gridSnap, panMode }); }, [selectedId, placement, document.editor.gridSnap, panMode]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { saveAutosave(document); setSavedLabel('Saved on this device'); }
      catch (error) { setSavedLabel('Local save unavailable'); setHint(error instanceof Error ? error.message : 'Local storage is unavailable. Export your machine to keep it.'); }
    }, 650);
    return () => clearTimeout(timer);
  }, [document]);
  useEffect(() => {
    const flush = () => {
      const current = documentRef.current;
      const name = projectNameRef.current.trim() || current.name;
      try { saveAutosave(name === current.name ? current : { ...current, name }); }
      catch { /* Regular autosave already explains how to export when storage is unavailable. */ }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const togglePlay = useCallback(async () => {
    if (status.playing) { runtime.current?.pause(); setHint('Take a breath. Move a piece. Find a new melody.'); }
    else { setHasStarted(true); setHint('Listen to the little things. Every collision plays a note.'); await runtime.current?.start(); }
  }, [status.playing]);
  const undo = useCallback(() => { runtime.current?.pause(); const next = history.current.undo(); if (next) { documentRef.current = next; setDocument(next); setHistoryVersion(v => v + 1); setDirty(true); setSelectedId(id => next.objects.some(o => o.id === id) ? id : null); } }, []);
  const redo = useCallback(() => { runtime.current?.pause(); const next = history.current.redo(); if (next) { documentRef.current = next; setDocument(next); setHistoryVersion(v => v + 1); setDirty(true); setSelectedId(id => next.objects.some(o => o.id === id) ? id : null); } }, []);
  const remove = useCallback(() => {
    if (!selectedId) return; commit({ ...documentRef.current, objects: documentRef.current.objects.filter(o => o.id !== selectedId) }); setSelectedId(null); setHint('Object removed. Undo is always here.');
  }, [selectedId, commit]);
  const duplicate = () => {
    if (!selected || document.objects.length >= 100) return;
    const object = { ...selected, id: newId(), x: Math.min(1400, selected.x + 24), y: Math.min(1050, selected.y + 24) };
    commit({ ...document, objects: [...document.objects, object] }); setSelectedId(object.id);
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, select, textarea, [contenteditable="true"]') || showSave || showSettings) return;
      if (event.key === 'Escape') { setPlacement(null); setSelectedId(null); setPanMode(false); runtime.current?.cancelInteraction(); setDrawer(null); }
      if (event.code === 'Space') { event.preventDefault(); void togglePlay(); }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [togglePlay, remove, undo, redo, showSave, showSettings]);
  const music = (patch: Partial<MusicSettings>) => {
    // Musical settings apply immediately; geometry and its history stay separate from the running world.
    const previous = documentRef.current;
    const settings = { ...previous.music, ...patch };
    let objects = previous.objects;
    if (patch.root !== undefined) {
      const distance = patch.root - previous.music.root;
      objects = objects.map(o => 'note' in o ? { ...o, note: Math.max(24, Math.min(96, o.note + distance)) } : o);
      setHint('The whole machine has moved to a new root note.');
    }
    if (patch.scale !== undefined && patch.scale !== 'chromatic') {
      const notes = scaleNoteOptions(settings.root, settings.scale);
      objects = objects.map(o => 'note' in o ? { ...o, note: notes.reduce((best, note) => Math.abs(note - o.note) < Math.abs(best - o.note) ? note : best, notes[0]) } : o);
      setHint('Instrument notes are tuned to the nearest note in your new scale.');
    }
    const next = { ...previous, music: settings, objects };
    history.current.commit(next); documentRef.current = next; setDocument(next); setHistoryVersion(v => v + 1); setDirty(true);
  };
  const replace = (next: MachineDocument, force = false) => {
    if (!force && dirty && !window.confirm('Replace this machine? Current changes will be replaced. Cancel and save a named copy or export first to keep them.')) return false;
    runtime.current?.pause(); runtime.current?.reset(); history.current.reset(next); documentRef.current = next; setDocument(next); setSelectedId(null); setPlacement(null); setActivity([]); setDirty(false); setHistoryVersion(v => v + 1); setDrawer(null); setHint('A new little world, ready to play.'); window.setTimeout(() => runtime.current?.fit(), 50); return true;
  };
  const replaceRef = useRef(replace);
  replaceRef.current = replace;
  useEffect(() => {
    const loadFragment = () => {
      const hash = window.location.hash;
      if (!hash.startsWith('#machine=')) return;
      try {
        const shared = decodeShare(hash);
        if (shared && replaceRef.current(shared)) { setShowSave(false); setShowSettings(false); setHint('A little symphony, shared with you. Press play to explore.'); }
      } catch (error) { setHint(error instanceof Error ? error.message : 'This share link could not be opened. Your current machine is safe.'); }
      finally { if (window.location.hash === hash) { try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* Keep the current document usable if browser history is restricted. */ } } }
    };
    window.addEventListener('hashchange', loadFragment);
    return () => window.removeEventListener('hashchange', loadFragment);
  }, []);
  const selectPalette = (type: ObjectType) => { if (status.playing) { runtime.current?.pause(); setHint('Paused to place an object. Tap an open spot on the canvas.'); } else setHint(`Place your ${objectLabels[type].toLowerCase()}: click an open spot on the canvas. Escape cancels.`); setPlacement(type); setPanMode(false); setDrawer(null); };
  void historyVersion;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => e.preventDefault()} aria-label="Marble Symphony home"><span className="brand-symbol"><i /><i /><i /></span><span>marble<span className="brand-serif">symphony</span><small>A LITTLE GRAVITY. A LOT OF POSSIBILITY.</small></span></a>
      <div className="header-divider" />
      <div className="project-control"><input aria-label="Project name" maxLength={80} value={projectName} onChange={e => setProjectName(e.target.value)} onBlur={() => { const name = projectName.trim() || "Untitled machine"; setProjectName(name); if (name !== document.name) commit({ ...document, name }); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setProjectName(document.name); } }} /><span><span className="local-dot" />{savedLabel}</span></div>
      <div className="playback-controls"><button className={`play-button ${status.playing ? 'playing' : ''}`} onClick={() => void togglePlay()}>{status.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}<span>{status.playing ? 'Pause' : hasStarted ? 'Resume music' : 'Start music'}</span></button><button className="icon-button" title="Reset marbles (preserves your design)" aria-label="Reset marbles" onClick={() => { runtime.current?.reset(); setActivity([]); setHint('A fresh start. Your machine is right where you left it.'); }}><RotateCcw size={17} /></button><button className="icon-button step-button" title="Advance one physics step while paused" aria-label="Single step" disabled={status.playing} onClick={() => void runtime.current?.step()}><StepForward size={17} /></button></div>
      <div className="tempo-control"><label htmlFor="tempo">TEMPO</label><div><TempoInput id="tempo" ariaLabel="TEMPO" value={document.music.bpm} onCommit={bpm => music({ bpm })} /><span>BPM</span></div></div>
      <div className="volume-control"><button className="icon-button" title={document.music.muted ? 'Unmute audio' : 'Mute audio'} aria-label={document.music.muted ? 'Unmute audio' : 'Mute audio'} onClick={() => music({ muted: !document.music.muted })}>{document.music.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><input aria-label="Master volume" title="Master volume" type="range" min="0" max="1" step="0.01" value={document.music.masterVolume} onChange={e => music({ masterVolume: Number(e.target.value) })} /></div>
      <button className="save-button" aria-label="Save & share" onClick={() => setShowSave(true)}><span>Save & share</span><ArrowUpRight size={17} /></button>
    </header>

    <main className="workspace">
      {drawer && <button className="drawer-backdrop" aria-label="Close panel" onClick={() => setDrawer(null)} />}
      <section className={`palette sidebar ${drawer === 'palette' ? 'drawer-open' : ''}`} aria-label="Object shelf">
        <div className="panel-heading"><PackageOpen size={16} /><h2>The shelf</h2><button className="drawer-close icon-button" aria-label="Close object shelf" onClick={() => setDrawer(null)}><X size={16} /></button></div>
        <p className="panel-intro">Small pieces.<br />Endless possibilities.</p>
        <div className="palette-groups">{palette.map(group => <div className="palette-group" key={group.title}><div className="eyebrow group-title">{group.title}</div>{group.items.map(type => { const Icon = icons[type]; return <button key={type} className={`palette-item ${placement === type ? 'active' : ''}`} aria-label={`Add ${objectLabels[type]}`} draggable onDragStart={e => { pauseForEdit(); e.dataTransfer.setData('application/x-marble-object', type); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => selectPalette(type)}><span className={`palette-thumbnail ${type}`}><Icon size={24} strokeWidth={type === 'ramp' ? 4 : 1.7} /></span><span><strong>{objectLabels[type]}</strong><small>{objectDetails[type]}</small></span><Plus size={13} className="palette-plus" /></button>; })}</div>)}</div>
        <div className="shelf-tip"><span>↗</span><p>Drag a piece in, or click<br />then place it on the canvas.</p></div>
        <div className="preset-heading"><span className="eyebrow">A LITTLE INSPIRATION</span><Sparkles size={13} /></div>
        <div className="preset-list">{presets.map((preset, index) => <button key={preset.id} onClick={() => replace(preset.document)} className={`preset-card preset-${index} ${document.name === preset.name ? 'current' : ''}`}><span className="preset-art"><i /><i /><i /><i /><i /></span><span><strong>{preset.name}</strong><small>{index === 0 ? 'A gentle place to begin' : index === 1 ? 'Space to let the bells ring' : 'A playful kind of rhythm'}</small></span><ArrowUpRight size={14} /></button>)}</div>
        <button className="blank-button" onClick={() => replace(blankDocument())}><Plus size={14} />Start with a blank canvas</button>
        <div className="shelf-footer">MADE FOR YOUR CURIOSITY <span>✦</span></div>
      </section>

      <section className="canvas-section" aria-label="Machine workspace">
        <div className="canvas-topline"><div className="workspace-heading"><span className="eyebrow">YOUR MUSICAL PLAYGROUND</span><h1>{document.name || 'Untitled machine'}<span>✳</span></h1></div><span className={`play-state ${status.playing ? 'live' : ''}`}><i /><span className="play-state-long">{status.playing ? 'MAKING MUSIC' : 'PAUSED · READY TO TINKER'}</span><span className="play-state-short">{status.playing ? 'PLAYING' : 'PAUSED'}</span></span></div>
        <div className="canvas-toolbar"><div className="toolbar-group"><button className="mobile-panel-button icon-button" aria-label="Open object shelf" title="Object shelf" onClick={() => setDrawer('palette')}><PackageOpen size={17} /></button><button className={`icon-button ${!panMode && !placement ? 'active' : ''}`} title="Select and move objects" aria-label="Select tool" onClick={() => { setPanMode(false); setPlacement(null); }}><MousePointer2 size={16} /></button><button className={`icon-button ${panMode ? 'active' : ''}`} title="Pan the canvas (or hold middle mouse)" aria-label="Pan tool" onClick={() => { setPanMode(v => !v); setPlacement(null); }}><Hand size={17} /></button><span className="toolbar-divider" /><button className={`icon-button ${document.editor.gridSnap ? 'active' : ''}`} title="Snap to grid" aria-label="Snap to grid" aria-pressed={document.editor.gridSnap} onClick={() => commit({ ...document, editor: { ...document.editor, gridSnap: !document.editor.gridSnap } })}><Grid2X2 size={16} /></button></div><div className="toolbar-center">{placement ? <span className="placement-hint">Click to place {objectLabels[placement].toLowerCase()} <button aria-label="Cancel placement" onClick={() => setPlacement(null)}><X size={13} /></button></span> : <span><span className="tiny-key">↖</span> A world of your own making</span>}</div><div className="toolbar-group"><button className="icon-button" title="Undo (⌘/Ctrl Z)" aria-label="Undo" disabled={!history.current.canUndo} onClick={undo}><Undo2 size={16} /></button><button className="icon-button" title="Redo (⌘/Ctrl Shift Z)" aria-label="Redo" disabled={!history.current.canRedo} onClick={redo}><Redo2 size={16} /></button><span className="toolbar-divider" /><button className="icon-button" aria-label="Zoom out" onClick={() => runtime.current?.zoomBy(0.8)}><Minus size={15} /></button><span className="zoom-value">{Math.round(status.zoom * 100)}%</span><button className="icon-button" aria-label="Zoom in" onClick={() => runtime.current?.zoomBy(1.25)}><Plus size={15} /></button><button className="icon-button" title="Fit machine to view" aria-label="Fit machine" onClick={() => runtime.current?.fit()}><Scan size={16} /></button><button className="mobile-panel-button icon-button" aria-label="Open inspector" title="Inspector" onClick={() => setDrawer('inspector')}><SlidersHorizontal size={17} /></button><button className="mobile-panel-button icon-button" aria-label="Project and playback settings" title="Project and playback settings" onClick={() => setShowSettings(true)}><Settings2 size={17} /></button></div></div>
        <div className={`canvas-wrap ${placement ? 'is-placing' : ''} ${panMode ? 'is-panning' : ''}`}><canvas ref={canvas} aria-label="Marble machine canvas" tabIndex={0} />
          {showWelcome && <div className="welcome-card"><div className="welcome-star">✳</div><div><strong>Meet your first little symphony.</strong><p>Press <b>Start music</b> and follow the marbles.<br />Pause to move a piece. There’s no wrong way to play.</p></div><button className="icon-button" aria-label="Dismiss introduction" onClick={() => setShowWelcome(false)}><X size={14} /></button></div>}
          <div className="canvas-corner-note"><span>GRAVITY IS THE COMPOSER.</span><span>YOU SET THE STAGE.</span></div>
        </div>
        <div className="canvas-status"><span><i className={status.playing ? 'status-dot live' : 'status-dot'} /><span data-testid="marble-count">{status.marbles} marbles</span> <span className="status-slash">/ 120</span></span><span>{document.objects.length} objects</span><span className="note-count" data-testid="note-count">{status.notes} notes played</span><span className="status-shortcut"><kbd>space</kbd> play / pause</span></div>
      </section>

      <div className={`inspector-sidebar sidebar ${drawer === 'inspector' ? 'drawer-open' : ''}`}><button className="drawer-close inspector-close icon-button" aria-label="Close inspector" onClick={() => setDrawer(null)}><X size={16} /></button><Inspector document={document} selected={selected} onSelect={id => { setSelectedId(id); runtime.current?.cancelInteraction(); }} onChange={patch => { if (status.playing) setHint('Paused for a little fine tuning.'); commit({ ...document, objects: document.objects.map(o => o.id === selectedId ? { ...o, ...patch } as MachineObject : o) }); }} onDuplicate={duplicate} onDelete={remove} /></div>
    </main>

    <footer className="music-dock"><div className="dock-title"><Music2 size={19} /><span>The musical<br /><strong>little details</strong></span></div><div className="dock-field"><label htmlFor="root-note">ROOT NOTE</label><select id="root-note" value={document.music.root} onChange={e => music({ root: Number(e.target.value) })}>{['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'].map((n, i) => <option key={n} value={i}>{n}</option>)}</select></div><div className="dock-field scale-field"><label htmlFor="scale">SCALE</label><select id="scale" value={document.music.scale} onChange={e => music({ scale: e.target.value as 'major' })}><option value="pentatonic">Pentatonic</option><option value="major">Major</option><option value="minor">Minor</option><option value="chromatic">Chromatic</option></select></div><div className="dock-divider" /><div className="rhythm-control"><label title="Schedule impact notes to the next subdivision. Adds a small intentional delay."><input type="checkbox" checked={document.music.snapNotes} onChange={e => music({ snapNotes: e.target.checked })} /><span>Snap notes to rhythm<small>A little delay, a tighter groove.</small></span></label><select aria-label="Note snap subdivision" disabled={!document.music.snapNotes} value={document.music.snapDivision} onChange={e => music({ snapDivision: e.target.value as 'quarter' })}><option value="quarter">¼</option><option value="eighth">⅛</option><option value="sixteenth">¹⁄₁₆</option></select></div><div className="dock-divider" /><div className="note-activity" aria-label="Recent musical notes"><span className="eyebrow">THE LAST LITTLE NOTES</span><div>{activity.length ? activity.map((note, index) => <span className="activity-note" key={`${note.id}-${index}`} style={{ '--note-color': note.color } as React.CSSProperties}>{formatNote(note.note)}</span>) : <span className="activity-empty">Waiting for the first hello <span>♪</span></span>}</div></div><div className="beat-indicator" aria-label={`Beat ${Math.floor(status.beat % 4) + 1}`}>{[0, 1, 2, 3].map(i => <i key={i} className={status.playing && Math.floor(status.beat % 4) === i ? 'on' : ''} />)}</div></footer>
    <div className="hint-bar" role="status"><span><span>✦</span>{hint}</span><span className="hint-signature">PLAY. TINKER. REPEAT.</span></div>
    {showSave && <SaveDialog document={document} onClose={() => setShowSave(false)} onLoad={next => { const loaded = replace(next); if (loaded) setShowSave(false); return loaded; }} onSaved={() => setDirty(false)} onMessage={setHint} />}
    {showSettings && <PlaybackSettings document={document} playing={status.playing} onMusic={music} onRename={name => { if (name !== document.name) commit({ ...document, name }); }} onClose={() => setShowSettings(false)} onReset={() => { runtime.current?.reset(); setActivity([]); }} onStep={() => void runtime.current?.step()} onUndo={undo} onRedo={redo} canUndo={history.current.canUndo} canRedo={history.current.canRedo} />}
  </div>;
}

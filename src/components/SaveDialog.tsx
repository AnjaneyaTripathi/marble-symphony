import { useEffect, useRef, useState } from 'react';
import { X, Download, Upload, Link2, HardDrive, Save, Trash2, ArrowRight, Check, Copy } from 'lucide-react';
import type { MachineDocument } from '../model/types';
import { parseDocument, serializeDocument } from '../model/validation';
import { listSaves, saveNamed, loadNamed, deleteNamed, type SavedProject } from '../persistence/storage';
import { encodeShare } from '../persistence/share';

interface Props { document: MachineDocument; onClose: () => void; onLoad: (document: MachineDocument) => boolean; onSaved: () => void; onMessage: (message: string) => void }
export default function SaveDialog({ document, onClose, onLoad, onSaved, onMessage }: Props) {
  const [saves, setSaves] = useState<SavedProject[]>([]);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [shareLink, setShareLink] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const priorFocus = useRef<HTMLElement | null>(null);
  const refresh = () => { try { setSaves(listSaves()); } catch { setError('Local storage is unavailable. You can still export a file or share a link.'); } };
  useEffect(() => { priorFocus.current = window.document.activeElement as HTMLElement; close.current?.focus(); refresh(); const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'Tab') { const elements = Array.from(window.document.querySelectorAll<HTMLElement>('.save-dialog button:not(:disabled), .save-dialog input:not([tabindex="-1"]), .save-dialog textarea')); const first = elements[0], last = elements.at(-1); if (e.shiftKey && window.document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && window.document.activeElement === last) { e.preventDefault(); first?.focus(); } } }; window.addEventListener('keydown', onKey); return () => { window.removeEventListener('keydown', onKey); priorFocus.current?.focus(); }; }, []);
  const exportFile = () => {
    try {
      const blob = new Blob([serializeDocument(document)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), anchor = window.document.createElement('a');
      anchor.href = url; anchor.download = `${document.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'marble-symphony'}.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback('A little symphony, ready to take with you.'); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not export this machine.'); }
  };
  const importFile = async (selected: File | undefined) => {
    if (!selected) return;
    try {
      if (selected.size > 300_000) throw new Error('This file is too large. Choose a Marble Symphony JSON file smaller than 300 KB.');
      const next = parseDocument(await selected.text()); if (onLoad(next)) onMessage('Machine imported. Your notes have a new home.');
    } catch (err) { setError(err instanceof Error ? err.message : 'This file could not be read. Choose a valid Marble Symphony JSON file.'); }
    if (file.current) file.current.value = '';
  };
  const share = async () => {
    try {
      const hash = encodeShare(document);
      const url = new URL(window.location.href); url.hash = hash;
      setShareLink(url.href); setError('');
      try { await navigator.clipboard.writeText(url.href); setFeedback('Share link copied. Send a little music to someone.'); }
      catch { setFeedback('Copy the link below to share your machine.'); }
    } catch (err) { setError(`${err instanceof Error ? err.message : 'This machine is too large for a share link.'} Export JSON to share it as a file.`); }
  };
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><section className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-title"><button className="icon-button modal-close" ref={close} aria-label="Close save and share" onClick={onClose}><X size={19} /></button><span className="eyebrow">GOOD THINGS ARE WORTH KEEPING</span><h2 id="save-title">A symphony to keep.<br /><em>Or to pass along.</em></h2><p className="dialog-intro">Your machine, just the way you made it.</p>
    <div className="save-primary"><HardDrive size={23} /><div><strong>Save on this device</strong><p>Keep a named copy in this browser.</p></div><button className="dark-button" onClick={() => { try { saveNamed(document); refresh(); setFeedback('Named copy saved on this device.'); setError(''); onSaved(); } catch (err) { setError(err instanceof Error ? err.message : 'Local storage is unavailable or full. Export JSON to keep this machine.'); } }}><Save size={14} />Save locally</button></div>
    <div className="portable-actions"><button onClick={exportFile}><Download size={20} /><span><strong>Export JSON</strong><small>A portable file. Yours to keep.</small></span><ArrowRight size={15} /></button><button onClick={() => file.current?.click()}><Upload size={20} /><span><strong>Import JSON</strong><small>Open a machine from a file.</small></span><ArrowRight size={15} /></button></div><input className="visually-hidden" ref={file} tabIndex={-1} aria-label="Import JSON" type="file" accept=".json,application/json" onChange={e => void importFile(e.target.files?.[0])} />
    <button className="share-link-button" onClick={() => void share()}><Link2 size={18} /><span><strong>Create a share link</strong><small>The full machine, tucked into a link. No account needed.</small></span><ArrowUpRightIcon /></button>
    {shareLink && <label className="field share-link-field"><span>Your portable link</span><textarea aria-label="Share link" readOnly value={shareLink} onFocus={e => e.target.select()} rows={2} /></label>}
    {feedback && <p className="dialog-feedback" role="status"><Check size={14} />{feedback}</p>}{error && <p className="dialog-error" role="alert">{error}</p>}
    <div className="saved-heading"><span className="eyebrow">SAVED ON THIS DEVICE</span><span>{saves.length} {saves.length === 1 ? 'machine' : 'machines'}</span></div><div className="saved-projects">{saves.length ? saves.map(save => <div key={save.id}><span><strong>{save.name}</strong><small>{new Date(save.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {save.document.objects.length} objects</small></span><button aria-label={`Load ${save.name}`} onClick={() => { try { onLoad(loadNamed(save.id)); } catch (err) { setError(err instanceof Error ? err.message : 'This save could not be opened.'); } }}>Open<ArrowRight size={13} /></button><button className="icon-button" aria-label={`Delete saved ${save.name}`} title="Delete saved copy" onClick={() => { if (window.confirm(`Delete the saved copy of “${save.name}”?`)) { try { deleteNamed(save.id); refresh(); } catch { setError('Could not delete this saved copy.'); } } }}><Trash2 size={14} /></button></div>) : <p className="no-saves">Your saved machines will feel right at home here.</p>}</div><p className="storage-footnote">Local saves stay in this browser. Export a file or a share link to back up your work or move to another device.</p>
  </section></div>;
}
function ArrowUpRightIcon() { return <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 15 15 5M5 5h10v10" /></svg>; }

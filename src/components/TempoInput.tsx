import { useEffect, useRef, useState } from 'react';

interface TempoInputProps {
  value: number;
  onCommit: (bpm: number) => void;
  id?: string;
  ariaLabel?: string;
  className?: string;
}

const MIN_BPM = 40;
const MAX_BPM = 200;

/** Keeps a pending tempo change out of the document until it is applied. */
export default function TempoInput({ value, onCommit, id, ariaLabel = 'Tempo BPM', className }: TempoInputProps) {
  const [draft, setDraft] = useState(() => String(value));
  const committedValue = useRef(value);
  const skipNextBlur = useRef(false);

  // Presets, undo, and the other settings panel replace the draft. Re-renders
  // with the same BPM leave an in-progress edit alone.
  useEffect(() => {
    if (committedValue.current !== value) {
      committedValue.current = value;
      setDraft(String(value));
    }
  }, [value]);

  const restore = () => setDraft(String(value));
  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      restore();
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      restore();
      return;
    }
    const next = Math.max(MIN_BPM, Math.min(MAX_BPM, parsed));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return <input
    id={id}
    className={className}
    aria-label={ariaLabel}
    title="Enter a tempo, then press Enter or click away to apply it"
    type="number"
    min={MIN_BPM}
    max={MAX_BPM}
    step="any"
    value={draft}
    onChange={event => {
      skipNextBlur.current = false;
      setDraft(event.currentTarget.value);
    }}
    onBlur={event => {
      if (skipNextBlur.current) {
        skipNextBlur.current = false;
        return;
      }
      commit(event.currentTarget.value);
    }}
    onKeyDown={event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        skipNextBlur.current = true;
        commit(event.currentTarget.value);
        event.currentTarget.blur();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        skipNextBlur.current = true;
        restore();
        event.currentTarget.blur();
      }
    }}
  />;
}

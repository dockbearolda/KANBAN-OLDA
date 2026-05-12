import { useEffect, useRef } from 'react';
import { SUBCATS } from '../constants.js';
import useFocusTrap from '../hooks/useFocusTrap.js';

const SUBCAT_ORDER = ['dtf', 'pressage', 'roland_uv', 'trotec', 'autres'];

export default function ProductionPicker({ open, onPick, onCancel }) {
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/20 transition-opacity duration-150 ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      aria-hidden={!open}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Choisir un secteur de production"
        className={`bg-white rounded-2xl shadow-xl px-3 py-2.5 flex items-center gap-2 transition-all duration-150 ease-out ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase pl-1 pr-1">
          Secteur
        </span>
        {SUBCAT_ORDER.map((sub) => (
          <button
            key={sub}
            type="button"
            onClick={() => onPick(sub)}
            className="h-9 px-3 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-900 hover:text-white hover:border-slate-900 text-slate-700 text-xs font-semibold tracking-wider transition-colors"
          >
            {SUBCATS[sub]}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import './OrderCard.css';

const PIP_COLORS = {
  L: '#E2A04C',
  C: '#3FAE73',
  M: '#2D8FCF',
  J: '#B86844',
};

/* ─── Inline contenteditable (span, for contact line) ───────────────────── */
function InlineField({ value, onChange, placeholder, className = '', tabIndex }) {
  const ref = useRef(null);
  const saved = useRef(value);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.textContent = value ?? '';
    }
    saved.current = value;
  }, [value]);

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); ref.current.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); ref.current.textContent = saved.current ?? ''; ref.current.blur(); }
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={() => onChange(ref.current.textContent ?? '')}
      onKeyDown={handleKeyDown}
      tabIndex={tabIndex ?? 0}
      className={`oc-inline ${className}`}
      data-placeholder={placeholder}
    />
  );
}

/* ─── Block contenteditable (div, for title / product / model) ──────────── */
function BlockField({ value, onChange, placeholder, className = '', tabIndex }) {
  const ref = useRef(null);
  const saved = useRef(value);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.textContent = value ?? '';
    }
    saved.current = value;
  }, [value]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ref.current.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); ref.current.textContent = saved.current ?? ''; ref.current.blur(); }
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={() => onChange(ref.current.textContent ?? '')}
      onKeyDown={handleKeyDown}
      tabIndex={tabIndex ?? 0}
      className={`oc-field ${className}`}
      data-placeholder={placeholder}
    />
  );
}

/* ─── Debounce hook ──────────────────────────────────────────────────────── */
function useDebounced(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn]);
}

/* ─── OrderCard ──────────────────────────────────────────────────────────── */
export default function OrderCard({ data, onChange, onDelete, prodBadge }) {
  const [s, setS] = useState(data);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Sync state from external data changes (socket updates)
  useEffect(() => { setS(data); }, [data]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function close(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const emit = useDebounced((payload) => {
    onChange?.(payload);
    document.dispatchEvent(new CustomEvent('card:change', { detail: payload, bubbles: true }));
  }, 600);

  function patch(updates) {
    const next = { ...s, ...updates };
    setS(next);
    emit(next);
  }

  function stopDrag(e) { e.stopPropagation(); }

  return (
    <article className={`oc-card${s.urgent ? ' is-urgent' : ''}`}>

      {/* ── Header: titre + menu ──────────────────────────────────────── */}
      <header className="oc-header">
        <BlockField
          value={s.title}
          onChange={(v) => patch({ title: v })}
          placeholder="TITRE COMMANDE"
          className="oc-title"
          tabIndex={1}
        />
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }} onPointerDown={stopDrag} onMouseDown={stopDrag}>
          <button
            type="button"
            className="oc-menu-btn"
            aria-label="Menu"
            onClick={() => setMenuOpen(v => !v)}
          >⋯</button>
          {menuOpen && onDelete && (
            <div className="oc-menu-dropdown">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete(); }}
              >Supprimer</button>
            </div>
          )}
        </div>
      </header>

      {/* ── Contact: prénom · téléphone ───────────────────────────────── */}
      <div className="oc-contact">
        <InlineField
          value={s.contactName}
          onChange={(v) => patch({ contactName: v })}
          placeholder="Prénom"
          tabIndex={2}
        />
        <span className="oc-sep">·</span>
        <InlineField
          value={s.phone}
          onChange={(v) => patch({ phone: v })}
          placeholder="Téléphone"
          className="oc-mono"
          tabIndex={3}
        />
      </div>

      {/* ── Grid 2 cols: Produit / Quantité ──────────────────────────── */}
      <div className="oc-grid2">
        <div className="oc-group">
          <label className="oc-label">Produit</label>
          <BlockField
            value={s.product}
            onChange={(v) => patch({ product: v })}
            placeholder="T-shirt"
            tabIndex={4}
          />
        </div>
        <div className="oc-group">
          <label className="oc-label">Quantité</label>
          <input
            type="text"
            value={s.qty ?? ''}
            onChange={(e) => patch({ qty: e.target.value })}
            onPointerDown={stopDrag}
            onMouseDown={stopDrag}
            placeholder="0"
            className="oc-native"
            tabIndex={5}
          />
        </div>
      </div>

      {/* ── Note ─────────────────────────────────────────────────────── */}
      <div className="oc-group oc-mt">
        <label className="oc-label">Note</label>
        <BlockField
          value={s.model}
          onChange={(v) => patch({ model: v })}
          placeholder="NS300 BLEU"
          className="oc-mono"
          tabIndex={6}
        />
      </div>

      {/* ── Échéance + Urgent ────────────────────────────────────────── */}
      <div className="oc-group oc-mt">
        <label className="oc-label">Échéance</label>
        <div className="oc-date-row">
          <input
            type="date"
            value={s.dueDate ?? ''}
            onChange={(e) => patch({ dueDate: e.target.value })}
            onPointerDown={stopDrag}
            onMouseDown={stopDrag}
            className="oc-native"
            tabIndex={7}
          />
          <button
            type="button"
            className={`oc-urgent${s.urgent ? ' oc-urgent--on' : ''}`}
            onClick={() => patch({ urgent: !s.urgent })}
            onPointerDown={stopDrag}
            onMouseDown={stopDrag}
            tabIndex={8}
          >
            {s.urgent && <span className="oc-pulse" />}
            Urgent
          </button>
        </div>
      </div>

      <hr className="oc-divider" />

      {/* ── Footer: statuts + badge ───────────────────────────────────── */}
      <footer className="oc-footer">
        <div className="oc-pips" onPointerDown={stopDrag} onMouseDown={stopDrag}>
          {['L', 'C', 'M', 'J'].map((key) => {
            const on = s.statuses?.[key];
            return (
              <button
                key={key}
                type="button"
                className={`oc-pip${on ? ' oc-pip--on' : ''}`}
                style={on ? { background: PIP_COLORS[key] } : {}}
                onClick={() => patch({ statuses: { ...s.statuses, [key]: !on } })}
                aria-pressed={on}
                tabIndex={9}
              >
                {key}
              </button>
            );
          })}
          {prodBadge && (
            <span className="oc-prod-badge">{prodBadge}</span>
          )}
        </div>
      </footer>

    </article>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../api.js';

const PATCH_DEBOUNCE_MS = 300;

function EditableField({
  value,
  placeholder,
  onCommit,
  onEnterNext,
  className = '',
  multiline = false,
  type = 'text',
  inputRef,
  ...rest
}) {
  const [draft, setDraft] = useState(value ?? '');
  const localRef = useRef(null);
  const ref = inputRef || localRef;

  useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(value ?? '');
  }, [value, ref]);

  function commit() {
    if ((draft ?? '') !== (value ?? '')) onCommit(draft);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(value ?? '');
      ref.current?.blur();
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      commit();
      if (onEnterNext) onEnterNext();
      else ref.current?.blur();
    } else if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
      ref.current?.blur();
    }
  }

  const Comp = multiline ? 'textarea' : 'input';

  return (
    <Comp
      ref={ref}
      type={multiline ? undefined : type}
      value={draft ?? ''}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      rows={multiline ? 2 : undefined}
      className={`bg-transparent w-full outline-none rounded px-1 -mx-1 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-slate-300 transition-colors ${className}`}
      {...rest}
    />
  );
}

function ClientRow({ client, isNew, onPatch, onDelete, onClearNewFocus }) {
  const [expanded, setExpanded] = useState(isNew || false);
  const nameRef = useRef(null);
  const companyRef = useRef(null);
  const cityRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const notesRef = useRef(null);

  useEffect(() => {
    if (isNew && companyRef.current) {
      companyRef.current.focus();
      companyRef.current.select?.();
      onClearNewFocus?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDelete(e) {
    e.stopPropagation();
    const label = client.company || client.name || 'ce client';
    if (window.confirm(`Supprimer ${label} ?`)) onDelete(client.id);
  }

  return (
    <div
      className="group relative px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200/70"
      onClick={() => setExpanded(true)}
    >
      {!expanded ? (
        <>
          <div className="flex items-baseline gap-2 min-h-[20px]">
            {client.company && (
              <span className="font-semibold text-sm text-slate-800 truncate">{client.company}</span>
            )}
            {client.name && (
              <span className="text-xs text-slate-600 truncate">— {client.name}</span>
            )}
            {!client.company && !client.name && (
              <span className="text-slate-400 font-normal italic text-sm">Sans nom</span>
            )}
          </div>
          {(client.city || client.email || client.phone) && (
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {client.city}
              {client.city && (client.email || client.phone) && <span className="mx-1.5">·</span>}
              {client.email}
              {client.email && client.phone && <span className="mx-1.5">·</span>}
              {client.phone}
            </div>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 transition"
            aria-label="Supprimer le client"
            title="Supprimer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </>
      ) : (
        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-1.5">
              <EditableField
                inputRef={companyRef}
                value={client.company}
                placeholder="Société"
                className="font-semibold text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                onCommit={(v) => onPatch(client.id, { company: v })}
                onEnterNext={() => nameRef.current?.focus()}
              />
              <EditableField
                inputRef={nameRef}
                value={client.name}
                placeholder="Contact (prénom)"
                className="text-xs text-slate-600 placeholder:text-slate-400"
                onCommit={(v) => onPatch(client.id, { name: v })}
                onEnterNext={() => cityRef.current?.focus()}
              />
              <EditableField
                inputRef={cityRef}
                value={client.city}
                placeholder="Ville"
                className="text-xs text-slate-600 placeholder:text-slate-400"
                onCommit={(v) => onPatch(client.id, { city: v })}
                onEnterNext={() => emailRef.current?.focus()}
              />
              <EditableField
                inputRef={emailRef}
                type="email"
                value={client.email}
                placeholder="Email"
                className="text-xs text-slate-500 placeholder:text-slate-400"
                onCommit={(v) => onPatch(client.id, { email: v })}
                onEnterNext={() => phoneRef.current?.focus()}
              />
              <EditableField
                inputRef={phoneRef}
                value={client.phone}
                placeholder="Téléphone"
                className="text-xs text-slate-500 placeholder:text-slate-400"
                onCommit={(v) => onPatch(client.id, { phone: v })}
                onEnterNext={() => notesRef.current?.focus()}
              />
              <EditableField
                inputRef={notesRef}
                multiline
                value={client.notes}
                placeholder="Notes…"
                className="text-xs text-slate-500 placeholder:text-slate-400 resize-none"
                onCommit={(v) => onPatch(client.id, { notes: v })}
              />
            </div>
            <button
              type="button"
              onClick={handleDelete}
              className="text-slate-400 hover:text-red-600 w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 transition shrink-0"
              aria-label="Supprimer le client"
              title="Supprimer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-[11px] text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded"
            >
              Replier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientsPanel({ open, onClose, clients, setClients }) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [newClientId, setNewClientId] = useState(null);

  // Debounced PATCH buffer per client id
  const pendingRef = useRef(new Map());

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const refetch = useCallback(async () => {
    try {
      const data = await api.getClients();
      setClients(data);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, [setClients]);

  const patchClient = useCallback((id, partial) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...partial } : c)));

    const cur = pendingRef.current.get(id) || { patch: {}, timer: null };
    cur.patch = { ...cur.patch, ...partial };
    if (cur.timer) clearTimeout(cur.timer);
    cur.timer = setTimeout(async () => {
      const toSend = cur.patch;
      pendingRef.current.delete(id);
      try {
        const fresh = await api.updateClient(id, toSend);
        setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...fresh } : c)));
      } catch (err) {
        console.error('PATCH client failed, refetching', err);
        refetch();
      }
    }, PATCH_DEBOUNCE_MS);
    pendingRef.current.set(id, cur);
  }, [setClients, refetch]);

  const deleteClient = useCallback(async (id) => {
    let snapshot;
    setClients((prev) => { snapshot = prev; return prev.filter((c) => c.id !== id); });
    try {
      await api.deleteClient(id);
    } catch (err) {
      console.error('DELETE client failed, rolling back', err);
      if (snapshot) setClients(snapshot);
      setError(err.message || String(err));
    }
  }, [setClients]);

  const createClient = useCallback(async () => {
    try {
      const created = await api.createClient({ name: '' });
      setClients((prev) => [created, ...prev]);
      setNewClientId(created.id);
    } catch (err) {
      console.error('CREATE client failed', err);
      setError(err.message || String(err));
    }
  }, [setClients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const haystack = `${c.name ?? ''} ${c.company ?? ''} ${c.city ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, query]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-900/30 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Clients"
        aria-hidden={!open}
        className={`fixed top-0 right-0 h-full w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-200/70 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-slate-800 text-lg tracking-tight">Clients</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center"
            aria-label="Fermer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-200/70 shrink-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par société, contact ou ville…"
            className="w-full h-9 px-3 rounded-lg bg-slate-100 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-300 focus:outline-none transition-colors"
          />
        </div>

        {error && (
          <div className="mx-5 mt-3 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">
            {error}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {clients.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-12 px-4">
              Aucun client. Ajoute le premier ↓
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-12 px-4">
              Aucun résultat pour « {query} ».
            </div>
          ) : (
            <div className="flex flex-col">
              {filtered.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  isNew={c.id === newClientId}
                  onPatch={patchClient}
                  onDelete={deleteClient}
                  onClearNewFocus={() => setNewClientId(null)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200/70 shrink-0">
          <button
            type="button"
            onClick={createClient}
            className="w-full h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center justify-center gap-1.5"
          >
            <span className="text-lg leading-none">+</span>
            <span>Nouveau client</span>
          </button>
        </div>
      </aside>
    </>
  );
}

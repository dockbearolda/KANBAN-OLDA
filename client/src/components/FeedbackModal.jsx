import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api.js';
import { socket, isOwnEcho } from '../socket.js';
import { useUser } from '../UserContext.jsx';
import useFocusTrap from '../hooks/useFocusTrap.js';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FeedbackModal({ open, onClose }) {
  const { currentUser } = useUser();
  const [items, setItems] = useState([]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const formRef = useRef(null);
  const textareaRef = useRef(null);
  useFocusTrap(formRef, open);

  const refetch = useCallback(async () => {
    try {
      const data = await api.getFeedback();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, []);

  useEffect(() => {
    if (open) {
      refetch();
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, refetch]);

  useEffect(() => {
    function onCreated(p) {
      if (isOwnEcho(p)) return;
      setItems((prev) => (prev.some((x) => x.id === p.item.id) ? prev : [p.item, ...prev]));
    }
    function onUpdated(p) {
      if (isOwnEcho(p)) return;
      setItems((prev) => prev.map((x) => (x.id === p.item.id ? p.item : x)));
    }
    function onDeleted(p) {
      if (isOwnEcho(p)) return;
      setItems((prev) => prev.filter((x) => x.id !== p.id));
    }
    socket.on('feedback:created', onCreated);
    socket.on('feedback:updated', onUpdated);
    socket.on('feedback:deleted', onDeleted);
    return () => {
      socket.off('feedback:created', onCreated);
      socket.off('feedback:updated', onUpdated);
      socket.off('feedback:deleted', onDeleted);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createFeedback({ body: text, author: currentUser || '' });
      setItems((prev) => [created, ...prev]);
      setBody('');
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleResolved(item) {
    const next = item.resolved ? 0 : 1;
    setItems((prev) =>
      prev
        .map((x) => (x.id === item.id ? { ...x, resolved: next } : x))
        .sort((a, b) => (a.resolved - b.resolved) || (b.id - a.id))
    );
    try {
      await api.updateFeedback(item.id, { resolved: next });
    } catch (err) {
      setError(err.message || String(err));
      refetch();
    }
  }

  async function remove(item) {
    if (!window.confirm('Supprimer ce signalement ?')) return;
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    try {
      await api.deleteFeedback(item.id);
    } catch (err) {
      setError(err.message || String(err));
      refetch();
    }
  }

  const openCount = items.filter((i) => !i.resolved).length;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center bg-black/30 transition-opacity duration-150 pt-16 ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={!open}
    >
      <div
        ref={formRef}
        role="dialog"
        aria-modal="true"
        aria-label="Signaler un problème"
        className={`w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl p-6 transition-all duration-150 ease-out flex flex-col max-h-[80vh] ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Signaler un problème
            {openCount > 0 && (
              <span className="ml-2 text-xs font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                {openCount} en attente
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center"
            aria-label="Fermer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
            Décrire le problème
          </label>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Ex. impossible de modifier le téléphone après avoir sélectionné un client…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none text-sm resize-none"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={submitting || !body.trim()}
              className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium disabled:opacity-50"
            >
              Envoyer
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-2 px-3 py-2 bg-red-50 text-red-700 text-xs rounded border border-red-200">
            {error}
          </div>
        )}

        <div className="mt-4 -mx-1 px-1 overflow-y-auto flex-1 border-t border-slate-100 pt-3">
          {items.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-8">
              Aucun signalement pour le moment.
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className={`group rounded-lg border px-3 py-2 ${
                    it.resolved ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200/70'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <label className="flex items-center mt-0.5 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!it.resolved}
                        onChange={() => toggleResolved(it)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        aria-label={it.resolved ? 'Marquer comme non réglé' : 'Marquer comme réglé'}
                      />
                    </label>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm whitespace-pre-wrap break-words ${it.resolved ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                        {it.body}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-2">
                        {it.author && <span className="font-medium text-slate-500">{it.author}</span>}
                        <span>{formatDate(it.created_at)}</span>
                        {it.resolved && it.resolved_at && (
                          <span className="text-emerald-600">· réglé {formatDate(it.resolved_at)}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(it)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 transition shrink-0"
                      aria-label="Supprimer"
                      title="Supprimer"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

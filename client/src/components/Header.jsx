import { useEffect, useRef, useState } from 'react';
import { USERS, VIEW_ALL } from '../constants.js';
import { useUser } from '../UserContext.jsx';
import * as api from '../api.js';
import { socket } from '../socket.js';

const USER_COLORS = {
  L: 'bg-amber-500',
  C: 'bg-emerald-500',
  M: 'bg-sky-500',
  J: 'bg-violet-500',
  [VIEW_ALL]: 'bg-slate-700',
};

const USER_LABELS = {
  L: 'Utilisateur L',
  C: 'Utilisateur C',
  M: 'Utilisateur M',
  J: 'Utilisateur J',
  [VIEW_ALL]: 'Toutes les cartes',
};

export default function Header({ onNewOrder, onOpenClients, onOpenFeedback, searchQuery = '', onSearchChange }) {
  const { currentUser, setCurrentUser } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFeedbackCount, setOpenFeedbackCount] = useState(0);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  // Focus search with "/" (like GitHub), unless typing in another input/editable.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (!t) return;
      const tag = (t.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || t.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Light badge poll: fetch feedback list at mount and subscribe to socket
  // events so the badge stays accurate without opening the modal.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await api.getFeedback();
        if (cancelled) return;
        setOpenFeedbackCount(list.filter((i) => !i.resolved).length);
      } catch {
        /* ignore — badge is non-critical */
      }
    }
    load();
    socket.on('feedback:created', load);
    socket.on('feedback:updated', load);
    socket.on('feedback:deleted', load);
    return () => {
      cancelled = true;
      socket.off('feedback:created', load);
      socket.off('feedback:updated', load);
      socket.off('feedback:deleted', load);
    };
  }, []);

  return (
    <header className="h-14 bg-white border-b border-slate-200/70 flex items-center px-5 gap-4 sticky top-0 z-30">
      <button
        onClick={onNewOrder}
        className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center gap-1.5"
      >
        <span className="text-lg leading-none">+</span>
        <span>Nouvelle commande</span>
      </button>

      <div className="flex-1 max-w-md relative">
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              if (searchQuery) {
                e.preventDefault();
                onSearchChange?.('');
              } else {
                e.currentTarget.blur();
              }
            }
          }}
          placeholder="Rechercher (titre, client, téléphone, produit, note)…"
          aria-label="Rechercher dans les commandes"
          className="w-full h-9 pl-9 pr-9 rounded-lg bg-slate-100 hover:bg-slate-50 focus:bg-white text-sm text-slate-800 placeholder:text-slate-400 border border-transparent focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => { onSearchChange?.(''); searchRef.current?.focus(); }}
            aria-label="Effacer la recherche"
            title="Effacer"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        {!searchQuery && (
          <kbd className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 h-5 px-1.5 items-center rounded border border-slate-300 bg-white text-[10px] font-mono text-slate-400 pointer-events-none">
            /
          </kbd>
        )}
      </div>

      <button
        onClick={onOpenClients}
        className="h-9 px-3 rounded-lg text-sm text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
        title="Clients"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span>Clients</span>
      </button>

      <button
        onClick={onOpenFeedback}
        className="relative h-9 px-3 rounded-lg text-sm text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
        title="Signaler un problème"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>Problème</span>
        {openFeedbackCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
            {openFeedbackCount}
          </span>
        )}
      </button>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={`${USER_COLORS[currentUser]} h-9 min-w-9 px-3 rounded-full text-white text-sm font-semibold flex items-center justify-center shadow-card`}
          aria-label="Filtrer par utilisateur"
          title={USER_LABELS[currentUser]}
        >
          {currentUser === VIEW_ALL ? 'Tous' : currentUser}
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-card border border-slate-200/70 py-1.5 z-40">
            <div className="px-3 py-1 text-xs uppercase tracking-wide text-slate-400">Afficher</div>
            <button
              onClick={() => {
                setCurrentUser(VIEW_ALL);
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 ${currentUser === VIEW_ALL ? 'text-slate-900 font-medium' : 'text-slate-600'}`}
            >
              <span className={`${USER_COLORS[VIEW_ALL]} w-6 h-6 rounded-full text-white text-[10px] font-semibold flex items-center justify-center`}>
                ALL
              </span>
              <span>Tous les collègues</span>
            </button>
            <div className="border-t border-slate-100 my-1" />
            {USERS.map((u) => (
              <button
                key={u}
                onClick={() => {
                  setCurrentUser(u);
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 ${u === currentUser ? 'text-slate-900 font-medium' : 'text-slate-600'}`}
              >
                <span className={`${USER_COLORS[u]} w-6 h-6 rounded-full text-white text-xs font-semibold flex items-center justify-center`}>
                  {u}
                </span>
                <span>Utilisateur {u}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

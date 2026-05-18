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

export default function Header({ onNewOrder, onOpenClients, onOpenFeedback }) {
  const { currentUser, setCurrentUser } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFeedbackCount, setOpenFeedbackCount] = useState(0);
  const menuRef = useRef(null);

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

      <div className="flex-1 max-w-md">
        <input
          type="text"
          disabled
          placeholder="Rechercher…"
          className="w-full h-9 px-3 rounded-lg bg-slate-100 text-sm text-slate-500 placeholder:text-slate-400 disabled:cursor-not-allowed focus:outline-none"
        />
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

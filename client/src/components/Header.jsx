import { useEffect, useRef, useState } from 'react';
import { USERS, VIEW_ALL } from '../constants.js';
import { useUser } from '../UserContext.jsx';

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

export default function Header({ onNewOrder, onOpenClients }) {
  const { currentUser, setCurrentUser } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
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

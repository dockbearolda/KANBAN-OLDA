import { createContext, useContext, useEffect, useState } from 'react';
import { USERS } from './constants.js';

const STORAGE_KEY = 'kanban_user';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved && USERS.includes(saved) ? saved : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (currentUser) localStorage.setItem(STORAGE_KEY, currentUser);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [currentUser]);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { UserProvider, useUser } from './UserContext.jsx';
import Welcome from './components/Welcome.jsx';
import Header from './components/Header.jsx';
import Board from './components/Board.jsx';
import * as api from './api.js';
import { socket, isOwnEcho } from './socket.js';

const ClientsPanel = lazy(() => import('./components/ClientsPanel.jsx'));

function Shell() {
  const { currentUser } = useUser();
  const [clientsOpen, setClientsOpen] = useState(false);
  const [clientsTouched, setClientsTouched] = useState(false);
  const [clients, setClients] = useState([]);
  const [newOrderOpen, setNewOrderOpen] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      const data = await api.getClients();
      setClients(data);
    } catch (err) {
      console.error('Failed to load clients', err);
    }
  }, []);

  useEffect(() => {
    if (currentUser) loadClients();
  }, [currentUser, loadClients]);

  // Realtime sync for clients — same pattern as orders in Board.jsx.
  useEffect(() => {
    if (!currentUser) return;
    function onCreated(p) {
      if (isOwnEcho(p)) return;
      setClients((prev) =>
        prev.some((c) => c.id === p.client.id) ? prev : [p.client, ...prev]
      );
    }
    function onUpdated(p) {
      if (isOwnEcho(p)) return;
      setClients((prev) => prev.map((c) => (c.id === p.client.id ? p.client : c)));
    }
    function onDeleted(p) {
      if (isOwnEcho(p)) return;
      setClients((prev) => prev.filter((c) => c.id !== p.id));
    }
    function onReconnect() {
      loadClients();
    }
    socket.on('client:created', onCreated);
    socket.on('client:updated', onUpdated);
    socket.on('client:deleted', onDeleted);
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.off('client:created', onCreated);
      socket.off('client:updated', onUpdated);
      socket.off('client:deleted', onDeleted);
      socket.io.off('reconnect', onReconnect);
    };
  }, [currentUser, loadClients]);

  const handleOpenClients = useCallback(() => {
    setClientsTouched(true);
    setClientsOpen(true);
  }, []);

  const handleCloseClients = useCallback(() => setClientsOpen(false), []);
  const handleNewOrder = useCallback(() => setNewOrderOpen(true), []);
  const handleCloseNewOrder = useCallback(() => setNewOrderOpen(false), []);

  // Keyboard shortcuts (Chrome Windows). Ctrl+N is reserved by Chrome for a
  // new window, so we use Ctrl+Alt+N to avoid the conflict. Ctrl+K toggles
  // the clients panel — borrowed from the "command palette" convention.
  useEffect(() => {
    if (!currentUser) return;
    function onKey(e) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'n' && e.altKey) {
        e.preventDefault();
        setNewOrderOpen(true);
      } else if (k === 'k') {
        e.preventDefault();
        setClientsTouched(true);
        setClientsOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentUser]);

  if (!currentUser) return <Welcome />;

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <Header
        onNewOrder={handleNewOrder}
        onOpenClients={handleOpenClients}
      />
      <Board
        clients={clients}
        setClients={setClients}
        newOrderOpen={newOrderOpen}
        onCloseNewOrder={handleCloseNewOrder}
      />
      {clientsTouched && (
        <Suspense fallback={null}>
          <ClientsPanel
            open={clientsOpen}
            onClose={handleCloseClients}
            clients={clients}
            setClients={setClients}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <Shell />
    </UserProvider>
  );
}

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { COLUMNS, SUBCATS, VIEW_ALL } from '../constants.js';
import * as api from '../api.js';
import { socket, isOwnEcho } from '../socket.js';
import { useUser } from '../UserContext.jsx';
import Card from './Card.jsx';
import ProductionPicker from './ProductionPicker.jsx';
import NewOrderModal from './NewOrderModal.jsx';

const PATCH_DEBOUNCE_MS = 300;

/* Merge server orders into local state while preserving in-progress edits.
 * - For orders with a pending PATCH (debounce buffer not yet flushed), overlay
 *   the patch onto the server row so the user's unsaved input wins.
 * - For orders with an in-flight move/delete, keep the local version entirely
 *   (the server may still be processing our own mutation). */
function mergeOrders(serverOrders, currentOrders, pendingMap, inFlight) {
  const currentById = new Map(currentOrders.map((o) => [o.id, o]));
  return serverOrders.map((server) => {
    if (inFlight.has(server.id)) {
      return currentById.get(server.id) ?? server;
    }
    const pending = pendingMap.get(server.id)?.patch;
    if (pending) {
      return { ...server, ...pending };
    }
    return server;
  });
}

/* ---------- helpers ---------- */

function zoneId(status, subcat) {
  if (status === 'production' && !subcat) return 'zone:production';
  if (status === 'production') return `zone:production:${subcat}`;
  return `zone:${status}`;
}

function parseZoneId(id) {
  if (!id || typeof id !== 'string' || !id.startsWith('zone:')) return null;
  const rest = id.slice(5);
  const [status, subcat] = rest.split(':');
  return { status, subcat: subcat || null };
}

function cardSortableId(id) {
  return `card:${id}`;
}

function cardIdFromSortable(sid) {
  if (typeof sid !== 'string' || !sid.startsWith('card:')) return null;
  return Number(sid.slice(5));
}

/* Compute a new position number that places an item at targetIndex within a sorted list. */
function computePosition(sortedZoneItemsWithoutActive, targetIndex) {
  const list = sortedZoneItemsWithoutActive;
  if (list.length === 0) return 1000;
  if (targetIndex <= 0) {
    return (list[0].position ?? 0) - 1000;
  }
  if (targetIndex >= list.length) {
    return (list[list.length - 1].position ?? 0) + 1000;
  }
  const prev = list[targetIndex - 1].position ?? 0;
  const next = list[targetIndex].position ?? 0;
  return (prev + next) / 2;
}

export default function Board({ clients = [], setClients, onSync, newOrderOpen = false, onCloseNewOrder }) {
  const { currentUser } = useUser();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusId, setFocusId] = useState(null);

  // drag-and-drop state
  const [activeId, setActiveId] = useState(null); // card:<id> while dragging
  const [pendingMove, setPendingMove] = useState(null); // { orderId, snapshot } when modal is open

  // pending PATCH debounce buffer
  const pendingRef = useRef(new Map());
  // orders currently in an optimistic mutation we initiated (move/delete) —
  // we don't want the poller to overwrite our local copy while it's pending.
  const inFlightRef = useRef(new Set());
  // current ETag for /api/orders (used by both refetch and the poller)
  const etagRef = useRef(null);
  // refs that mirror state so the poller closure can read latest values
  const draggingRef = useRef(false);
  const pickerOpenRef = useRef(false);

  const reportSync = useCallback(() => {
    if (onSync) onSync(Date.now());
  }, [onSync]);

  const refetch = useCallback(async () => {
    try {
      // Force a fresh read on explicit refetch (after a failure): pass no ETag.
      const result = await api.fetchOrdersWithETag(null);
      if (!result.notModified) {
        etagRef.current = result.etag;
        setOrders((prev) => mergeOrders(result.data, prev, pendingRef.current, inFlightRef.current));
      }
      setError(null);
      reportSync();
    } catch (err) {
      setError(err.message || String(err));
    }
  }, [reportSync]);

  useEffect(() => {
    (async () => {
      await refetch();
      setLoading(false);
    })();
  }, [refetch]);

  // Realtime sync via Socket.io. Mutations from any peer are broadcast and
  // applied directly to local state — no polling. The originating tab ignores
  // its own echo (already applied optimistically).
  useEffect(() => {
    function applyRemoteOrder(remote) {
      setOrders((prev) => {
        // While the user is actively dragging the same card, keep local copy.
        if (inFlightRef.current.has(remote.id)) return prev;
        const pending = pendingRef.current.get(remote.id)?.patch;
        const merged = pending ? { ...remote, ...pending } : remote;
        const idx = prev.findIndex((o) => o.id === remote.id);
        if (idx === -1) return [...prev, merged];
        const next = prev.slice();
        next[idx] = merged;
        return next;
      });
    }

    function onCreated(payload) {
      if (isOwnEcho(payload)) return;
      applyRemoteOrder(payload.order);
      reportSync();
    }
    function onUpdated(payload) {
      if (isOwnEcho(payload)) return;
      applyRemoteOrder(payload.order);
      reportSync();
    }
    function onMoved(payload) {
      if (isOwnEcho(payload)) return;
      applyRemoteOrder(payload.order);
      reportSync();
    }
    function onDeleted(payload) {
      if (isOwnEcho(payload)) return;
      setOrders((prev) => prev.filter((o) => o.id !== payload.id));
      reportSync();
    }
    function onInvalidated() {
      refetch();
    }
    // After a reconnect, do a full refetch to catch any missed events.
    function onReconnect() {
      refetch();
    }

    socket.on('order:created', onCreated);
    socket.on('order:updated', onUpdated);
    socket.on('order:moved', onMoved);
    socket.on('order:deleted', onDeleted);
    socket.on('orders:invalidated', onInvalidated);
    socket.io.on('reconnect', onReconnect);

    return () => {
      socket.off('order:created', onCreated);
      socket.off('order:updated', onUpdated);
      socket.off('order:moved', onMoved);
      socket.off('order:deleted', onDeleted);
      socket.off('orders:invalidated', onInvalidated);
      socket.io.off('reconnect', onReconnect);
    };
  }, [refetch, reportSync]);

  // Keep refs in sync with state for the poller closure
  useEffect(() => { draggingRef.current = activeId != null; }, [activeId]);
  useEffect(() => { pickerOpenRef.current = pendingMove != null; }, [pendingMove]);

  /* ---------------- mutation helpers ---------------- */

  const patchOrder = useCallback((id, partial) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...partial } : o)));

    const cur = pendingRef.current.get(id) || { patch: {}, timer: null };
    cur.patch = { ...cur.patch, ...partial };
    if (cur.timer) clearTimeout(cur.timer);
    cur.timer = setTimeout(async () => {
      const toSend = cur.patch;
      pendingRef.current.delete(id);
      inFlightRef.current.add(id);
      try {
        const fresh = await api.updateOrder(id, toSend);
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...fresh } : o)));
      } catch (err) {
        console.error('PATCH failed, refetching', err);
        refetch();
      } finally {
        inFlightRef.current.delete(id);
      }
    }, PATCH_DEBOUNCE_MS);
    pendingRef.current.set(id, cur);
  }, [refetch]);

  const deleteOrderLocal = useCallback(async (id) => {
    let snapshot;
    setOrders((prev) => { snapshot = prev; return prev.filter((o) => o.id !== id); });
    inFlightRef.current.add(id);
    try {
      await api.deleteOrder(id);
    } catch (err) {
      console.error('DELETE failed, rolling back', err);
      if (snapshot) setOrders(snapshot);
    } finally {
      inFlightRef.current.delete(id);
    }
  }, []);

  const createInColumn = useCallback(async ({ status, prod_subcat = null }) => {
    try {
      const minPositionInZone = orders
        .filter((o) =>
          o.status === status &&
          (status !== 'production' || (o.prod_subcat || 'autres') === (prod_subcat || 'autres'))
        )
        .reduce((min, o) => Math.min(min, o.position ?? 0), Infinity);
      const position = Number.isFinite(minPositionInZone) ? minPositionInZone - 1000 : 1000;

      const created = await api.createOrder({
        status,
        prod_subcat,
        title: '',
        qty: 0,
        product: '',
        note: '',
        position,
      });
      setOrders((prev) => [...prev, created]);
      setFocusId(created.id);
      return created;
    } catch (err) {
      console.error('CREATE failed', err);
      setError(err.message || String(err));
      return null;
    }
  }, [orders]);

  const createFromModal = useCallback(async (data) => {
    const minPositionInZone = orders
      .filter((o) => o.status === 'demande')
      .reduce((min, o) => Math.min(min, o.position ?? 0), Infinity);
    const position = Number.isFinite(minPositionInZone) ? minPositionInZone - 1000 : 1000;

    const titleLower = data.title ? data.title.toLowerCase().trim() : '';
    let matchedClient = titleLower
      ? clients.find(
          (c) =>
            (c.name ?? '').toLowerCase() === titleLower ||
            (c.company ?? '').toLowerCase() === titleLower
        )
      : null;

    const phone = (data.phone ?? '').trim();

    if (matchedClient && phone && phone !== (matchedClient.phone ?? '')) {
      api.updateClient(matchedClient.id, { phone }).catch((err) =>
        console.error('Update client phone failed', err)
      );
    }

    if (!matchedClient && titleLower && phone) {
      try {
        matchedClient = await api.createClient({ company: data.title.trim(), phone });
        if (matchedClient && setClients) {
          setClients((prev) =>
            prev.some((c) => c.id === matchedClient.id) ? prev : [matchedClient, ...prev]
          );
        }
      } catch (err) {
        console.error('Auto-create client failed', err);
      }
    }

    const created = await api.createOrder({
      status: 'demande',
      prod_subcat: null,
      title: data.title ?? '',
      product: data.product ?? '',
      qty: data.qty ?? 0,
      note: data.note ?? '',
      assignees: data.assignees ?? '',
      client_id: matchedClient ? matchedClient.id : null,
      position,
    });
    setOrders((prev) => [...prev, created]);
    setFocusId(null);
  }, [orders, clients, setClients]);

  /* ---------------- grouping ---------------- */

  // Filter by selected user (assignees include the user). When VIEW_ALL,
  // every card is visible — that's the default state on first load.
  const visibleOrders = useMemo(() => {
    if (currentUser === VIEW_ALL) return orders;
    return orders.filter((o) => {
      const a = o.assignees;
      if (!a) return false;
      return String(a).split(',').map((s) => s.trim()).includes(currentUser);
    });
  }, [orders, currentUser]);

  // Stable per-zone arrays: when a zone's items haven't changed (same orders
  // in the same order, same object refs), reuse the previous array. This lets
  // React.memo on Column / CardList short-circuit re-renders of unaffected
  // columns when a single card is edited.
  const prevByColumnRef = useRef(new Map());
  const byColumn = useMemo(() => {
    const next = new Map();
    for (const col of COLUMNS) {
      if (col.sub) {
        for (const sub of col.sub) next.set(`${col.id}:${sub}`, []);
      } else {
        next.set(col.id, []);
      }
    }
    const sorted = [...visibleOrders].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
    for (const o of sorted) {
      if (o.status === 'production') {
        const key = `production:${o.prod_subcat || 'autres'}`;
        (next.get(key) || next.get('production:autres')).push(o);
      } else if (next.has(o.status)) {
        next.get(o.status).push(o);
      }
    }
    // Reuse previous array refs when shallow content matches.
    const prev = prevByColumnRef.current;
    for (const [key, arr] of next) {
      const old = prev.get(key);
      if (old && old.length === arr.length && old.every((o, i) => o === arr[i])) {
        next.set(key, old);
      }
    }
    prevByColumnRef.current = next;
    return next;
  }, [visibleOrders]);

  function countFor(col) {
    if (!col.sub) return byColumn.get(col.id)?.length ?? 0;
    return col.sub.reduce((n, s) => n + (byColumn.get(`${col.id}:${s}`)?.length ?? 0), 0);
  }

  function itemsInZone(status, subcat) {
    if (status === 'production') return byColumn.get(`production:${subcat || 'autres'}`) || [];
    return byColumn.get(status) || [];
  }

  /* ---------------- DnD ---------------- */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const applyMove = useCallback(async (orderId, targetStatus, targetSubcat, targetIndex) => {
    // Take a snapshot for rollback BEFORE mutating
    let snapshot;
    let computedPosition;

    setOrders((prev) => {
      snapshot = prev;
      // Build the target zone list excluding active (using prev, fresh)
      const inZone = prev
        .filter((o) =>
          o.id !== orderId &&
          o.status === targetStatus &&
          (targetStatus !== 'production' || (o.prod_subcat || 'autres') === (targetSubcat || 'autres'))
        )
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);

      const safeIndex = Math.max(0, Math.min(targetIndex ?? inZone.length, inZone.length));
      computedPosition = computePosition(inZone, safeIndex);

      return prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: targetStatus,
              prod_subcat: targetStatus === 'production' ? (targetSubcat || null) : null,
              position: computedPosition,
            }
          : o
      );
    });

    inFlightRef.current.add(orderId);
    try {
      const fresh = await api.moveOrder(orderId, {
        status: targetStatus,
        prod_subcat: targetStatus === 'production' ? (targetSubcat || null) : null,
        position: computedPosition,
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...fresh } : o)));
    } catch (err) {
      console.error('MOVE failed, rolling back', err);
      if (snapshot) setOrders(snapshot);
      setError(err.message || String(err));
    } finally {
      inFlightRef.current.delete(orderId);
    }
  }, []);

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return; // invalid drop → snap back, no change

    const orderId = cardIdFromSortable(active.id);
    if (orderId == null) return;
    const activeOrder = orders.find((o) => o.id === orderId);
    if (!activeOrder) return;

    let targetStatus = null;
    let targetSubcat = null;
    let targetIndex = null;

    // Case A: dropped over another card → adopt its zone
    if (typeof over.id === 'string' && over.id.startsWith('card:')) {
      const overId = cardIdFromSortable(over.id);
      if (overId === orderId) return;
      const overOrder = orders.find((o) => o.id === overId);
      if (!overOrder) return;
      targetStatus = overOrder.status;
      targetSubcat = overOrder.prod_subcat ?? null;
      const inZone = itemsInZone(targetStatus, targetSubcat).filter((o) => o.id !== orderId);
      targetIndex = inZone.findIndex((o) => o.id === overId);
      if (targetIndex < 0) targetIndex = inZone.length;
    } else {
      // Case B: dropped on a zone
      const zone = parseZoneId(over.id);
      if (!zone) return;
      targetStatus = zone.status;
      targetSubcat = zone.subcat;
      const inZone = itemsInZone(targetStatus, targetSubcat).filter((o) => o.id !== orderId);
      targetIndex = inZone.length; // end
    }

    // Entering production from any other column → always ask which sector
    if (targetStatus === 'production' && activeOrder.status !== 'production') {
      setPendingMove({ orderId });
      return;
    }

    // Skip if dropping in same zone at the same spot (no visual change)
    const sameZone =
      activeOrder.status === targetStatus &&
      (activeOrder.prod_subcat || null) === (targetSubcat || null);
    if (sameZone) {
      const inZoneAll = itemsInZone(targetStatus, targetSubcat);
      const currentIndex = inZoneAll.findIndex((o) => o.id === orderId);
      if (currentIndex === targetIndex) return;
    }

    applyMove(orderId, targetStatus, targetSubcat, targetIndex);
  }

  /* ---------------- modal handlers ---------------- */

  function handlePickSubcat(subcat) {
    if (!pendingMove) return;
    const { orderId } = pendingMove;
    setPendingMove(null);
    const inZone = itemsInZone('production', subcat).filter((o) => o.id !== orderId);
    applyMove(orderId, 'production', subcat, inZone.length);
  }

  function handleCancelPicker() {
    // No state to revert (drop hasn't been applied optimistically yet)
    setPendingMove(null);
  }

  /* ---------------- render ---------------- */

  const draggedOrder = activeId
    ? orders.find((o) => o.id === cardIdFromSortable(activeId))
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">
            {error}
          </div>
        )}
        <div className="flex gap-5 p-5 min-h-full items-start">
          {COLUMNS.map((col, i) => (
            <Column
              key={col.id}
              column={col}
              count={countFor(col)}
              byColumn={byColumn}
              focusId={focusId}
              setFocusId={setFocusId}
              onPatch={patchOrder}
              onDelete={deleteOrderLocal}
              onAdd={createInColumn}
              loading={loading}
              // Show skeleton placeholders only in the first two columns
              // (avoid a noisy initial flash across the whole board).
              showSkeleton={loading && i < 2}
              dragging={activeId != null}
              clients={clients}
            />
          ))}
        </div>
      </div>

      <datalist id="clients-list">
        {clients.map((c) => (
          <option key={c.id} value={c.name}>{c.company || ''}</option>
        ))}
      </datalist>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {draggedOrder ? <DragGhost order={draggedOrder} /> : null}
      </DragOverlay>

      <ProductionPicker
        open={pendingMove != null}
        onPick={handlePickSubcat}
        onCancel={handleCancelPicker}
      />

      <NewOrderModal
        open={newOrderOpen}
        onClose={onCloseNewOrder}
        onSubmit={createFromModal}
        clients={clients}
      />
    </DndContext>
  );
}

/* ---------------- subcomponents ---------------- */

const Column = memo(function Column({ column, count, byColumn, focusId, setFocusId, onPatch, onDelete, onAdd, loading, showSkeleton, dragging, clients }) {
  // Stable add-handler captured here so memoized CardList doesn't re-render
  // just because Board re-rendered with a new inline arrow.
  const addToThisColumn = useCallback(
    () => onAdd({ status: column.id, prod_subcat: null }),
    [onAdd, column.id]
  );

  if (column.sub) {
    return (
      <ProductionColumn
        column={column}
        count={count}
        byColumn={byColumn}
        focusId={focusId}
        setFocusId={setFocusId}
        onPatch={onPatch}
        onDelete={onDelete}
        onAdd={onAdd}
        loading={loading}
        dragging={dragging}
        clients={clients}
      />
    );
  }

  const items = byColumn.get(column.id) || [];

  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      <div className="px-1 mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wider text-slate-500">{column.label}</h2>
        <span className="text-xs text-slate-400 tabular-nums">{loading ? '…' : count}</span>
      </div>
      <DroppableZone
        id={zoneId(column.id, null)}
        className="bg-white/40 rounded-xl p-2 flex-1 min-h-[200px]"
      >
        {showSkeleton && items.length === 0 ? (
          <CardSkeletons count={3} />
        ) : (
          <CardList
            items={items}
            focusId={focusId}
            setFocusId={setFocusId}
            onPatch={onPatch}
            onDelete={onDelete}
            onAdd={addToThisColumn}
            clients={clients}
          />
        )}
      </DroppableZone>
    </div>
  );
});

const ProductionColumn = memo(function ProductionColumn({ column, count, byColumn, focusId, setFocusId, onPatch, onDelete, onAdd, loading, dragging, clients }) {
  // Column-level (ambiguous) drop zone — only visible while dragging
  const { setNodeRef: setColRef, isOver: colIsOver } = useDroppable({
    id: zoneId('production', null),
    data: { type: 'zone', status: 'production', subcat: null },
  });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      <div className="px-1 mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wider text-slate-500">{column.label}</h2>
        <span className="text-xs text-slate-400 tabular-nums">{loading ? '…' : count}</span>
      </div>

      {dragging && (
        <div
          ref={setColRef}
          className={`mb-3 rounded-xl border-2 border-dashed px-3 py-3 text-center text-[11px] font-semibold tracking-wider uppercase transition-colors ${
            colIsOver
              ? 'border-slate-700 bg-slate-900 text-white'
              : 'border-slate-300 bg-white/40 text-slate-400'
          }`}
        >
          Lâcher ici pour choisir la machine
        </div>
      )}

      <div className="flex flex-col gap-3">
        {column.sub.map((sub) => (
          <SubSection
            key={sub}
            sub={sub}
            items={byColumn.get(`${column.id}:${sub}`) || EMPTY_ARRAY}
            focusId={focusId}
            setFocusId={setFocusId}
            onPatch={onPatch}
            onDelete={onDelete}
            onAdd={onAdd}
            clients={clients}
          />
        ))}
      </div>
    </div>
  );
});

const EMPTY_ARRAY = [];

const SubSection = memo(function SubSection({ sub, items, focusId, setFocusId, onPatch, onDelete, onAdd, clients }) {
  const addToThisSub = useCallback(
    () => onAdd({ status: 'production', prod_subcat: sub }),
    [onAdd, sub]
  );
  return (
    <DroppableZone
      id={zoneId('production', sub)}
      className="bg-white/40 rounded-xl p-2"
    >
      <div className="text-[10px] font-bold tracking-wider text-slate-400 mb-2 px-1 flex items-center justify-between">
        <span>{SUBCATS[sub]}</span>
        <span className="text-slate-400 tabular-nums">{items.length}</span>
      </div>
      <CardList
        items={items}
        focusId={focusId}
        setFocusId={setFocusId}
        onPatch={onPatch}
        onDelete={onDelete}
        onAdd={addToThisSub}
        clients={clients}
      />
    </DroppableZone>
  );
});

const DroppableZone = memo(function DroppableZone({ id, className, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'ring-2 ring-slate-300' : ''}`}
    >
      {children}
    </div>
  );
});

const CardList = memo(function CardList({ items, focusId, setFocusId, onPatch, onDelete, onAdd, clients }) {
  const ids = items.map((o) => cardSortableId(o.id));
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="text-left text-xs text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg px-2 py-1.5 transition-colors"
        >
          + Ajouter
        </button>
        {items.map((o) => (
          <Card
            key={o.id}
            order={o}
            clients={clients}
            autoFocusField={focusId === o.id ? 'title' : null}
            onMounted={() => {
              if (focusId === o.id) setFocusId(null);
            }}
            onPatch={(partial) => onPatch(o.id, partial)}
            onDelete={() => onDelete(o.id)}
            onEnterCreate={onAdd}
          />
        ))}
      </div>
    </SortableContext>
  );
});

/* Visual ghost rendered in DragOverlay (matches Card look, but static). */
const CardSkeletons = memo(function CardSkeletons({ count = 3 }) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-[78px]" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
});

const DragGhost = memo(function DragGhost({ order }) {
  return (
    <div className="bg-white rounded-lg border border-slate-300 shadow-xl p-3 w-72 rotate-1">
      <div className="font-semibold text-sm text-slate-800 truncate">
        {order.title || <span className="text-slate-400">Sans titre</span>}
      </div>
      {(order.qty || order.product) && (
        <div className="text-sm text-slate-600 mt-1 truncate">
          <span className="tabular-nums">{order.qty ?? 0}</span>
          <span className="text-slate-400 mx-1">×</span>
          <span>{order.product}</span>
        </div>
      )}
      {order.note && (
        <div className="text-xs text-slate-500 mt-1 line-clamp-2">{order.note}</div>
      )}
    </div>
  );
});

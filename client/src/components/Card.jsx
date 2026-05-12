import { memo, useEffect, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SUBCATS } from '../constants.js';
import OrderCard from './OrderCard.jsx';

function parseAssignees(str) {
  if (!str) return [];
  return String(str).split(',').map((s) => s.trim()).filter(Boolean);
}

function CardImpl({ order, clients = [], onPatch, onDelete, onMounted }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `card:${order.id}`,
    data: {
      type: 'card',
      orderId: order.id,
      status: order.status,
      prod_subcat: order.prod_subcat ?? null,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  useEffect(() => { onMounted?.(); }, []);

  // Find matched client
  const titleLower = (order.title ?? '').trim().toLowerCase();
  const client = useMemo(() => {
    let c = order.client_id ? clients.find((x) => x.id === order.client_id) : null;
    if (!c && titleLower) {
      c = clients.find((x) =>
        (x.name ?? '').toLowerCase() === titleLower ||
        (x.company ?? '').toLowerCase() === titleLower
      ) || null;
      if (!c) {
        const hits = clients.filter((x) => {
          const n = (x.name ?? '').toLowerCase();
          const co = (x.company ?? '').toLowerCase();
          return (n && n.startsWith(titleLower)) || (co && co.startsWith(titleLower));
        });
        if (hits.length === 1) c = hits[0];
      }
    }
    return c ?? null;
  }, [clients, order.client_id, titleLower]);

  // Map order → OrderCard data format (memoised for stable reference)
  const assignees = parseAssignees(order.assignees);
  const data = useMemo(() => ({
    id: order.id,
    title: client?.company || order.title || '',
    contactName: client?.name || '',
    phone: client?.phone || '',
    product: order.product || '',
    qty: order.qty ? String(order.qty) : '',
    model: order.note || '',
    dueDate: order.due_date || '',
    statuses: {
      L: assignees.includes('L'),
      C: assignees.includes('C'),
      M: assignees.includes('M'),
      J: assignees.includes('J'),
    },
    urgent: Boolean(order.urgent),
  }), [order, client]);

  function handleChange(updated) {
    const newAssignees = Object.entries(updated.statuses)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(',');

    const trimmed = (updated.title ?? '').trim();
    const match = trimmed
      ? clients.find((c) =>
          (c.name ?? '').toLowerCase() === trimmed.toLowerCase() ||
          (c.company ?? '').toLowerCase() === trimmed.toLowerCase()
        )
      : null;

    const patch = {
      title: updated.title,
      product: updated.product,
      qty: updated.qty === '' ? 0 : (isNaN(Number(updated.qty)) ? 0 : Number(updated.qty)),
      note: updated.model,
      due_date: updated.dueDate || null,
      assignees: newAssignees,
      urgent: updated.urgent ? 1 : 0,
    };

    if (match && match.id !== order.client_id) patch.client_id = match.id;
    else if (!match && order.client_id) patch.client_id = null;

    onPatch(patch);
  }

  const prodBadge = order.status === 'production' && order.prod_subcat
    ? SUBCATS[order.prod_subcat]
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`card-enter cursor-grab active:cursor-grabbing${isDragging ? ' ring-2 ring-slate-300 rounded-[18px]' : ''}`}
    >
      <OrderCard
        data={data}
        onChange={handleChange}
        onDelete={onDelete}
        prodBadge={prodBadge}
      />
    </div>
  );
}

const Card = memo(CardImpl, (prev, next) => {
  if (prev.clients !== next.clients) return false;
  const a = prev.order, b = next.order;
  if (a === b) return true;
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.qty === b.qty &&
    a.product === b.product &&
    a.note === b.note &&
    a.status === b.status &&
    a.prod_subcat === b.prod_subcat &&
    a.urgent === b.urgent &&
    a.due_date === b.due_date &&
    a.assignees === b.assignees &&
    a.client_id === b.client_id &&
    a.position === b.position
  );
});

export default Card;

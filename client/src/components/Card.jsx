import { memo, useEffect, useMemo, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SUBCATS } from '../constants.js';
import OrderCard from './OrderCard.jsx';

function parseAssignees(str) {
  if (!str) return [];
  return String(str).split(',').map((s) => s.trim()).filter(Boolean);
}

function findClientByTitle(clients, title) {
  const t = (title ?? '').trim().toLowerCase();
  if (!t) return null;
  const exact = clients.find(
    (c) =>
      (c.name ?? '').toLowerCase() === t ||
      (c.company ?? '').toLowerCase() === t
  );
  if (exact) return exact;
  const prefix = clients.filter((c) => {
    const n = (c.name ?? '').toLowerCase();
    const co = (c.company ?? '').toLowerCase();
    return (n && n.startsWith(t)) || (co && co.startsWith(t));
  });
  return prefix.length === 1 ? prefix[0] : null;
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

  // Map order → OrderCard data format. The order row is the single source of
  // truth — what you see on the card is what's saved on the order. The linked
  // client is only used to autofill empty fields when the title changes.
  const assignees = parseAssignees(order.assignees);
  const data = useMemo(() => ({
    id: order.id,
    title: order.title ?? '',
    contactName: order.contact_name ?? '',
    phone: order.phone ?? '',
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
  }), [order]);

  // Remember the last title we autofilled from to avoid re-applying autofill
  // after the user has cleared a field intentionally.
  const lastAutofillTitleRef = useRef((order.title ?? '').toLowerCase());

  function handleChange(updated) {
    const newAssignees = Object.entries(updated.statuses)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(',');

    const patch = {
      title: updated.title,
      contact_name: updated.contactName ?? '',
      phone: updated.phone ?? '',
      product: updated.product,
      qty: updated.qty === '' ? 0 : (isNaN(Number(updated.qty)) ? 0 : Number(updated.qty)),
      note: updated.model,
      due_date: updated.dueDate || null,
      assignees: newAssignees,
      urgent: updated.urgent ? 1 : 0,
    };

    const trimmedTitle = (updated.title ?? '').trim();
    const titleLower = trimmedTitle.toLowerCase();
    const match = findClientByTitle(clients, trimmedTitle);

    // Autofill from a newly matched client only when the title actually
    // changed and the corresponding field is currently empty — never override
    // what the user has typed.
    if (match && titleLower !== lastAutofillTitleRef.current) {
      if (!patch.phone && match.phone) patch.phone = match.phone;
      if (!patch.contact_name && match.name) patch.contact_name = match.name;
      lastAutofillTitleRef.current = titleLower;
    }
    if (!match) {
      lastAutofillTitleRef.current = titleLower;
    }

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
        status={order.status}
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
    a.contact_name === b.contact_name &&
    a.phone === b.phone &&
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

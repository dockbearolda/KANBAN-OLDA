import { useEffect, useRef, useState } from 'react';
import { USERS } from '../constants.js';
import { useUser } from '../UserContext.jsx';
import useFocusTrap from '../hooks/useFocusTrap.js';

const USER_DOT = {
  L: 'bg-amber-500',
  C: 'bg-emerald-500',
  M: 'bg-sky-500',
  J: 'bg-violet-500',
};

export default function NewOrderModal({ open, onClose, onSubmit, clients = [] }) {
  const { currentUser } = useUser();
  const [client, setClient] = useState('');
  const [matchedClient, setMatchedClient] = useState(null);
  const [contactName, setContactName] = useState('');
  const [contactNameTouched, setContactNameTouched] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [product, setProduct] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const clientRef = useRef(null);
  const formRef = useRef(null);
  useFocusTrap(formRef, open);

  useEffect(() => {
    if (!open) return;
    setClient('');
    setMatchedClient(null);
    setContactName('');
    setContactNameTouched(false);
    setPhone('');
    setPhoneTouched(false);
    setProduct('');
    setQty('');
    setNote('');
    setAssignees(currentUser ? [currentUser] : []);
    setDueDate('');
    setUrgent(false);
    setSubmitting(false);
    setTimeout(() => clientRef.current?.focus(), 0);
  }, [open, currentUser]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function handleClientChange(value) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      setClient(value);
      setMatchedClient(null);
      if (!phoneTouched) setPhone('');
      if (!contactNameTouched) setContactName('');
      return;
    }
    const match = clients.find(
      (c) =>
        (c.name ?? '').toLowerCase() === trimmed ||
        (c.company ?? '').toLowerCase() === trimmed
    );
    setMatchedClient(match ?? null);
    setClient(match?.company || value);
    if (!phoneTouched) setPhone(match?.phone ?? '');
    if (!contactNameTouched) setContactName(match?.name ?? '');
  }

  function toggleAssignee(u) {
    setAssignees((prev) =>
      prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: client.trim(),
        contact_name: contactName.trim(),
        phone: phone.trim(),
        product: product.trim(),
        qty: qty === '' ? 0 : Number(qty),
        note: note.trim(),
        assignees: assignees.join(','),
        due_date: dueDate || null,
        urgent: urgent ? 1 : 0,
      });
      onClose();
    } catch (err) {
      console.error('Create order failed', err);
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/30 transition-opacity duration-150 ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={!open}
    >
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Nouvelle commande"
        className={`w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl p-6 transition-all duration-150 ease-out ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <h2 className="text-base font-semibold text-slate-800">Nouvelle commande</h2>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Client
            </label>
            <input
              ref={clientRef}
              type="text"
              value={client}
              onChange={(e) => handleClientChange(e.target.value)}
              list="clients-list"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Contact
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => { setContactName(e.target.value); setContactNameTouched(true); }}
              placeholder="Prénom"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Téléphone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneTouched(true); }}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Produit
            </label>
            <input
              type="text"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Quantité
            </label>
            <input
              type="number"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Assigné à
            </label>
            <div className="flex items-center gap-2">
              {USERS.map((u) => {
                const active = assignees.includes(u);
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => toggleAssignee(u)}
                    className={`w-9 h-9 rounded-full text-sm font-semibold flex items-center justify-center transition ${
                      active
                        ? `${USER_DOT[u]} text-white`
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                    aria-pressed={active}
                  >
                    {u}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
                &nbsp;
              </label>
              <button
                type="button"
                onClick={() => setUrgent((v) => !v)}
                className={`h-10 px-4 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${
                  urgent
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500'
                }`}
              >
                Urgent
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-800 px-3 py-2"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium disabled:opacity-50"
          >
            Créer
          </button>
        </div>
      </form>
    </div>
  );
}

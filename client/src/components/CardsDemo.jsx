import OrderCard from './OrderCard.jsx';

const DEMO = {
  id: 'demo-1',
  title: 'LOVE BOAT',
  contactName: 'Chris',
  phone: '06 90 18 33 37',
  product: 'T-shirt',
  qty: '50',
  model: 'NS300 BLEU',
  dueDate: '2026-05-29',
  statuses: { L: true, C: true, M: true, J: false },
  urgent: false,
};

export default function CardsDemo() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF7F1',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
      gap: '24px',
      fontFamily: "'Geist', 'Inter', sans-serif",
    }}>
      <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#74695B', fontFamily: "'Geist Mono', monospace" }}>
        cards-demo
      </p>
      <OrderCard
        data={DEMO}
        onChange={(d) => console.log('card:change', d)}
      />
    </div>
  );
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import CardsDemo from './components/CardsDemo.jsx';
import './index.css';

const isDemo = window.location.pathname === '/cards-demo';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isDemo ? <CardsDemo /> : <App />}
  </React.StrictMode>,
);

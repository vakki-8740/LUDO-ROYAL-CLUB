import React, { useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

// /payment-success: backend se ASLI status poochta hai.
// Redirect khulna = payment proof NAHI. Sirf Success par paisa.
// States: checking -> Success / Pending (wait) / Failed / not-found.
export default function PaymentSuccess({ txnId, toast, go }) {
  const [state, setState] = useState('checking'); // checking|success|pending|failed|error
  const [amount, setAmount] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const pay = await getDoc(doc(db, 'settings', 'payment'));
        const server = pay.exists() ? (pay.data().serverUrl || '').replace(/\/+$/, '') : '';
        if (!server) throw new Error('server');
        const r = await fetch(server + '/status.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txnId })
        });
        const j = await r.json();
        if (!alive) return;
        if (!j.success) throw new Error(j.error || 'na');
        setAmount(j.amount || 0);
        if (j.status === 'Success') {
          setState('success');
          clearInterval(timer.current);
        } else if (j.status === 'Rejected' || j.status === 'cancelled' || j.status === 'failed') {
          setState('failed');
          clearInterval(timer.current);
        } else {
          setState('pending');
        }
      } catch (e) {
        if (alive) setState('error');
        clearInterval(timer.current);
      }
    }
    check();
    timer.current = setInterval(check, 4000); // har 4 sec backend se poocho
    const stop = setTimeout(() => clearInterval(timer.current), 5 * 60 * 1000); // 5 min max
    return () => {
      alive = false;
      clearInterval(timer.current);
      clearTimeout(stop);
    };
  }, [txnId]);

  return (
    <div className="section active">
      <TopBar title="Payment Status" onBack={() => go('wallet')} />
      <div className="deposit-page-card" style={{ textAlign: 'center' }}>
        {state === 'checking' && (
          <>
            <span className="loader-dot" style={{ width: 26, height: 26 }}></span>
            <h3 style={{ marginTop: 10 }}>Status check ho raha hai...</h3>
          </>
        )}
        {state === 'pending' && (
          <>
            <span className="loader-dot" style={{ width: 26, height: 26 }}></span>
            <h3 style={{ marginTop: 10 }}>Payment ka wait ho raha hai...</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              ₹{amount} — pay kar diya to thoda ruko, verify hote hi balance aayega.
            </p>
          </>
        )}
        {state === 'success' && (
          <>
            <i className="fas fa-check-circle" style={{ fontSize: 56, color: 'var(--success)' }}></i>
            <h3 style={{ marginTop: 10 }}>Payment Success! 🎉</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>₹{amount} wallet me jud gaya hai.</p>
            <button className="dp-btn" style={{ marginTop: 10 }} onClick={() => go('wallet')}>
              Wallet Dekho
            </button>
          </>
        )}
        {state === 'failed' && (
          <>
            <i className="fas fa-times-circle" style={{ fontSize: 56, color: 'var(--danger)' }}></i>
            <h3 style={{ marginTop: 10 }}>Payment Fail Ho Gaya</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Paisa nahi kata hoga. Dobara try karo.</p>
            <button className="dp-btn" style={{ marginTop: 10 }} onClick={() => go('deposit')}>
              Dobara Try Karo
            </button>
          </>
        )}
        {state === 'error' && (
          <>
            <i className="fas fa-exclamation-triangle" style={{ fontSize: 56, color: 'var(--warning)' }}></i>
            <h3 style={{ marginTop: 10 }}>Status pata nahi chala</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Internet check karke dobara aao, ya history dekho.</p>
            <button className="dp-btn" style={{ marginTop: 10 }} onClick={() => go('wallet')}>
              Wallet Dekho
            </button>
          </>
        )}
      </div>
    </div>
  );
}

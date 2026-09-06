import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

const FALLBACK_AMOUNTS = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000];

// Deposit: SIRF chips. Chip tap -> server PENDING order ->
// PayU page (hidden form post) -> wapas success page (status polling).
// Paisa sirf server verify ke baad judta hai.
export default function Deposit({ profile, uid, toast, go }) {
  const [amounts, setAmounts] = useState(FALLBACK_AMOUNTS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'app'))
      .then((d) => {
        if (d.exists() && d.data().depositOptions) {
          const arr = String(d.data().depositOptions)
            .split(',')
            .map((x) => parseInt(x))
            .filter((x) => x > 0);
          if (arr.length) setAmounts(arr);
        }
      })
      .catch(() => {});
  }, []);

  async function tapChip(amt) {
    let minDep = 100;
    try {
      const d = await getDoc(doc(db, 'settings', 'app'));
      if (d.exists() && d.data().minDeposit) minDep = parseFloat(d.data().minDeposit);
    } catch (e) {}
    if (!amt || amt < minDep) return toast('Minimum deposit ₹' + minDep, '#ff3b30');
    setBusy(true);
    try {
      const pay = await getDoc(doc(db, 'settings', 'payment'));
      const server = pay.exists() ? (pay.data().serverUrl || '').replace(/\/+$/, '') : '';
      if (!server) throw new Error('Payment server set nahi hai. Admin se bolo.');
      // 1) Backend PENDING order (amount server whitelist check)
      const r = await fetch(server + '/payu-order.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          userId: uid,
          userName: profile.name || '',
          email: profile.email || '',
          phone: profile.mobile || ''
        })
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Order nahi bana');
      // 2) PayU page par hidden form post (Razorpay page NAHI khulta)
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = j.payu_url;
      Object.keys(j.fields).forEach((k) => {
        const inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = k;
        inp.value = j.fields[k];
        form.appendChild(inp);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
      setBusy(false);
    }
  }

  return (
    <div id="deposit-page-section" className="section active">
      <TopBar title="Deposit Money" onBack={() => go('wallet')} />
      <div className="deposit-page-card">
        <div className="dp-label">Amount chuno (tap karte hi payment khulega)</div>
        <div className="dp-chips">
          {amounts.map((amt) => (
            <div key={amt} className="dp-chip" onClick={() => !busy && tapChip(amt)}>
              ₹{amt}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
          {busy ? 'Order ban raha hai...' : 'Payment ke baad verify hokar balance khud jud jayega'}
        </p>
      </div>
    </div>
  );
}

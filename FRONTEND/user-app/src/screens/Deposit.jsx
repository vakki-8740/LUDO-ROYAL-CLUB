import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

const FALLBACK_AMOUNTS = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000];

// Deposit: SIRF chips (custom amount nahi). Chip tap -> PENDING order ->
// us chip ka payment link (admin set) -> pay karo -> success page status check.
export default function Deposit({ profile, uid, toast, go }) {
  const [amounts, setAmounts] = useState(FALLBACK_AMOUNTS);
  const [links, setLinks] = useState({});
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
    getDoc(doc(db, 'settings', 'paylinks'))
      .then((d) => {
        if (d.exists() && d.data().links) setLinks(d.data().links);
      })
      .catch(() => {});
  }, []);

  async function serverUrl() {
    const pay = await getDoc(doc(db, 'settings', 'payment'));
    const server = pay.exists() ? (pay.data().serverUrl || '').replace(/\/+$/, '') : '';
    if (!server) throw new Error('Payment server set nahi hai. Admin se bolo.');
    return server;
  }

  async function tapChip(amt) {
    const url = links[String(amt)];
    if (!url) return toast('₹' + amt + ' ka link abhi nahi laga. Thodi der baad try karo.', '#ff9500');
    setBusy(true);
    try {
      const server = await serverUrl();
      // 1) Backend PENDING order (unique txnId, amount server whitelist check)
      const r = await fetch(server + '/create-order.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, userId: uid, userName: profile.name || '' })
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Order nahi bana');
      // 2) Payment link kholo (Razorpay page), wapas aane par status page
      window.open(url, '_blank');
      go('success:' + j.txnId);
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
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
            <div
              key={amt}
              className="dp-chip"
              onClick={() => !busy && tapChip(amt)}
              style={{ opacity: links[String(amt)] ? 1 : 0.45 }}
            >
              ₹{amt}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
          Payment ke baad verify hokar balance khud jud jayega
        </p>
      </div>
    </div>
  );
}

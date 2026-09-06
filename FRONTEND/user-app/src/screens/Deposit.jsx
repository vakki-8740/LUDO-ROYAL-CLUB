import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { todayStr } from '../lib.js';
import { TopBar } from '../components/ui.jsx';

const FALLBACK_AMOUNTS = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000];

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error('Razorpay load nahi hua. Internet check karo.'));
    document.body.appendChild(s);
  });
}

export default function Deposit({ profile, uid, toast, go }) {
  const [amounts, setAmounts] = useState(FALLBACK_AMOUNTS);
  const [custom, setCustom] = useState('');
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

  // Razorpay UPI payment -> Pending record -> admin approve -> balance
  async function submit() {
    const amt = parseInt(custom);
    let minDep = 100;
    try {
      const d = await getDoc(doc(db, 'settings', 'app'));
      if (d.exists() && d.data().minDeposit) minDep = parseFloat(d.data().minDeposit);
    } catch (e) {}
    if (!amt || amt < minDep) return toast('Minimum deposit ₹' + minDep, '#ff3b30');
    setBusy(true);
    try {
      // Key ID admin panel se (Settings > Razorpay)
      const k = await getDoc(doc(db, 'settings', 'razorpay'));
      const keyId = k.exists() ? (k.data().keyId || '') : '';
      if (!keyId) throw new Error('Online payment abhi band hai. Thodi der baad try karo.');
      await loadRazorpayScript();

      const paymentId = await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: keyId,
          amount: amt * 100, // paise
          currency: 'INR',
          name: 'Ludo Royal Club',
          description: 'Wallet Deposit ₹' + amt,
          prefill: { name: profile.name || '', email: profile.email || '' },
          theme: { color: '#007aff' },
          handler: (resp) => resolve(resp.razorpay_payment_id || ''),
          modal: { ondismiss: () => reject(new Error('cancelled')) }
        });
        rzp.on('payment.failed', (r) => reject(new Error((r.error && r.error.description) || 'Payment fail')));
        rzp.open();
      });

      await addDoc(collection(db, 'transactions'), {
        userId: uid,
        userName: profile.name || '',
        type: 'Deposit',
        amount: amt,
        status: 'Pending',
        details: { method: 'razorpay', razorpay_payment_id: paymentId },
        date: todayStr(),
        timestamp: serverTimestamp()
      });
      toast('Payment mil gaya! Verify hokar balance aayega.', '#34c759');
      setCustom('');
      setTimeout(() => go('wallet'), 1200);
    } catch (e) {
      if (e && e.message !== 'cancelled') toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="deposit-page-section" className="section active">
      <TopBar title="Deposit Money" onBack={() => go('wallet')} />
      <div className="deposit-page-card">
        <div className="dp-label">Select Amount</div>
        <div className="dp-chips">
          {amounts.map((amt) => (
            <div
              key={amt}
              className={`dp-chip ${parseInt(custom) === amt ? 'selected' : ''}`}
              onClick={() => setCustom(String(amt))}
            >
              ₹{amt}
            </div>
          ))}
        </div>
        <div className="dp-divider"><span>or enter custom amount</span></div>
        <div className="dp-custom">
          <span className="dp-rupee">₹</span>
          <input type="number" placeholder="Enter amount (min ₹100)" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
        <button className="dp-btn" onClick={submit} disabled={busy}>
          <i className="fas fa-plus-circle"></i> {busy ? 'Wait...' : 'Pay Online (UPI)'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
          Payment ke baad admin verify karke balance dalega
        </p>
      </div>
    </div>
  );
}

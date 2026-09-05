import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, increment, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { todayStr } from '../lib.js';
import { TopBar } from '../components/ui.jsx';

const FALLBACK_AMOUNTS = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000];

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
      await addDoc(collection(db, 'transactions'), {
        userId: uid,
        userName: profile.name || '',
        type: 'Deposit',
        amount: amt,
        status: 'Success',
        date: todayStr(),
        timestamp: serverTimestamp()
      });
      await updateDoc(doc(db, 'users', uid), {
        balance: increment(amt),
        totalDeposit: increment(amt)
      });
      toast('₹' + amt + ' deposited successfully!', '#34c759');
      setCustom('');
      setTimeout(() => go('wallet'), 1200);
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
          <i className="fas fa-plus-circle"></i> {busy ? 'Wait...' : 'Deposit'}
        </button>
      </div>
    </div>
  );
}

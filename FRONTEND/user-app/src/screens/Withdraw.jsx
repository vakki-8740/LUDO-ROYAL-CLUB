import React, { useState } from 'react';
import { addDoc, collection, doc, getDoc, increment, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { todayStr } from '../lib.js';
import { TopBar } from '../components/ui.jsx';

export default function Withdraw({ profile, uid, toast, go }) {
  const [holder, setHolder] = useState('');
  const [upi, setUpi] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    let minW = 195,
      maxW = 50000;
    try {
      const d = await getDoc(doc(db, 'settings', 'app'));
      if (d.exists()) {
        if (d.data().minWithdraw) minW = parseFloat(d.data().minWithdraw);
        if (d.data().maxWithdraw) maxW = parseFloat(d.data().maxWithdraw);
      }
    } catch (e) {}
    const amt = parseFloat(amount);
    if (!amt || amt < minW) return toast('Minimum withdraw ₹' + minW, '#ff3b30');
    if (amt > maxW) return toast('Maximum withdraw ₹' + maxW, '#ff3b30');
    if ((profile.balance || 0) < amt) return toast('Insufficient balance', '#ff3b30');
    if (!holder.trim()) return toast('Account holder name required', '#ff3b30');
    if (!upi.trim()) return toast('UPI ID required', '#ff3b30');
    setBusy(true);
    try {
      await updateDoc(doc(db, 'users', uid), { balance: increment(-amt) });
      await addDoc(collection(db, 'transactions'), {
        userId: uid,
        userName: profile.name || '',
        type: 'Withdraw',
        amount: amt,
        status: 'Pending',
        details: { method: 'upi', accountHolder: holder.trim(), upiId: upi.trim() },
        date: todayStr(),
        timestamp: serverTimestamp()
      });
      toast('Withdrawal request submitted!', '#ff9500');
      setAmount('');
      setHolder('');
      setUpi('');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="withdraw-page-section" className="section active">
      <TopBar title="Withdraw Money" onBack={() => go('wallet')} />
      <div className="wallet-card" style={{ marginBottom: 16 }}>
        <div className="wallet-card-top">
          <span className="wallet-label">Available Balance</span>
        </div>
        <div className="wallet-amount" style={{ fontSize: 28 }}>₹<span>{profile.balance || 0}</span></div>
      </div>
      <div className="notice-card" style={{ marginBottom: 16 }}>
        <div className="notice-icon"><i className="fas fa-info-circle"></i></div>
        <div className="notice-text">
          <strong>Notice:-</strong> Minimum Withdraw ₹195 • Maximum Withdraw ₹50,000<br />
          Withdrawal 5 मिनट में हो जाएगा ⏱️
        </div>
      </div>
      <div className="deposit-page-card">
        <div className="dp-label"><i className="fas fa-paper-plane" style={{ color: 'var(--primary)' }}></i> Withdraw To UPI</div>
        <div className="wp-field"><i className="fas fa-user"></i><input type="text" placeholder="Account Holder Name" value={holder} onChange={(e) => setHolder(e.target.value)} /></div>
        <div className="wp-field"><i className="fas fa-mobile-alt"></i><input type="text" placeholder="UPI ID (e.g. name@upi)" value={upi} onChange={(e) => setUpi(e.target.value)} /></div>
        <div className="wp-field"><i className="fas fa-rupee-sign"></i><input type="number" placeholder="Enter amount (₹195 - ₹50,000)" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <button className="dp-btn" onClick={submit} disabled={busy}>
          <i className="fas fa-paper-plane"></i> {busy ? 'Wait...' : 'Withdraw'}
        </button>
      </div>
    </div>
  );
}

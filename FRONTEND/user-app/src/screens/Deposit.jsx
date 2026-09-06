import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { todayStr } from '../lib.js';
import { TopBar } from '../components/ui.jsx';

const FALLBACK_AMOUNTS = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000];

export default function Deposit({ profile, uid, toast, go }) {
  const [amounts, setAmounts] = useState(FALLBACK_AMOUNTS);
  const [custom, setCustom] = useState('');

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

  async function next() {
    const amt = parseInt(custom);
    let minDep = 100;
    try {
      const d = await getDoc(doc(db, 'settings', 'app'));
      if (d.exists() && d.data().minDeposit) minDep = parseFloat(d.data().minDeposit);
    } catch (e) {}
    if (!amt || amt < minDep) return toast('Minimum deposit ₹' + minDep, '#ff3b30');
    go('payqr:' + amt);
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
        <button className="dp-btn" onClick={next}>
          <i className="fas fa-arrow-right"></i> Next
        </button>
      </div>
    </div>
  );
}

// Naya page: QR + UTR -> request admin ko (approve par hi paisa)
export function PayQr({ amount, profile, uid, toast, go }) {
  const [qrUrl, setQrUrl] = useState('');
  const [upiId, setUpiId] = useState('');
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'deposit_qr'))
      .then((d) => {
        if (d.exists()) {
          setQrUrl(d.data().qrUrl || '');
          setUpiId(d.data().upiId || '');
        }
      })
      .catch(() => {});
  }, []);

  async function submit() {
    const u = utr.trim();
    if (!u) return toast('UTR / Transaction number dalo', '#ff3b30');
    setBusy(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        userId: uid,
        userName: profile.name || '',
        type: 'Deposit',
        amount: parseInt(amount),
        status: 'Pending',
        details: { method: 'qr_utr', utr: u },
        date: todayStr(),
        timestamp: serverTimestamp()
      });
      toast('Request bhej di! Approve hote hi balance aayega.', '#34c759');
      setTimeout(() => go('wallet'), 1200);
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section active">
      <TopBar title={`Pay ₹${amount}`} onBack={() => go('deposit')} />
      <div className="deposit-page-card" style={{ textAlign: 'center' }}>
        <div className="dp-label">QR scan karke pay karo</div>
        {qrUrl ? (
          <img src={qrUrl} alt="Pay QR" style={{ width: 220, height: 220, borderRadius: 12, margin: '0 auto 10px' }} />
        ) : (
          <div style={{ padding: 20, fontSize: 14, color: 'var(--text-muted)' }}>
            QR jald aa raha hai{upiId ? ` — UPI ID: ${upiId}` : ''}
          </div>
        )}
        {upiId && <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>UPI ID: {upiId}</div>}
        <div className="dp-label" style={{ textAlign: 'left' }}>UTR / Transaction Number</div>
        <div className="wp-field"><i className="fas fa-receipt"></i><input type="text" placeholder="12-digit UTR dalo" value={utr} onChange={(e) => setUtr(e.target.value)} /></div>
        <button className="dp-btn" onClick={submit} disabled={busy}>
          <i className="fas fa-paper-plane"></i> {busy ? 'Wait...' : 'Request Bhejo'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
          Admin approve karega tabhi paisa judega
        </p>
      </div>
    </div>
  );
}

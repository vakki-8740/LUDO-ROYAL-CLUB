import React, { useEffect, useRef, useState } from 'react';
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { todayStr } from '../lib.js';
import { TopBar } from '../components/ui.jsx';

const FALLBACK_AMOUNTS = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000];
const QR_SECONDS = 600; // 10:00 timer (server QR expiry se match)

// Deposit: APNA page — QR + timer. Razorpay page NAHI khulta.
// Server QR banata hai, webhook payment par khud balance dalta hai.
export default function Deposit({ profile, uid, toast, go }) {
  const [amounts, setAmounts] = useState(FALLBACK_AMOUNTS);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState(null); // {txnId, imageUrl, amount, left}
  const [showPopup, setShowPopup] = useState(false);
  const timerRef = useRef(null);

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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function fmt(sec) {
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }

  // 1) Pending record + server se QR
  async function getQr() {
    const amt = parseInt(custom);
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
      const ref = await addDoc(collection(db, 'transactions'), {
        userId: uid,
        userName: profile.name || '',
        type: 'Deposit',
        amount: amt,
        status: 'Pending',
        details: { method: 'qr' },
        date: todayStr(),
        timestamp: serverTimestamp()
      });
      const r = await fetch(server + '/create-qr.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, txnId: ref.id, userId: uid })
      });
      const j = await r.json();
      if (!j.success) {
        await updateDoc(doc(db, 'transactions', ref.id), { status: 'cancelled' });
        throw new Error(j.error || 'QR nahi bana');
      }
      startQr({ txnId: ref.id, imageUrl: j.image_url, amount: amt });
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  // 2) Timer + auto-success popup (webhook balance dalte hi)
  function startQr(info) {
    if (timerRef.current) clearInterval(timerRef.current);
    setQr({ ...info, left: QR_SECONDS });
    const unsub = onSnapshot(doc(db, 'transactions', info.txnId), (snap) => {
      if (snap.exists() && snap.data().status === 'Success') {
        if (timerRef.current) clearInterval(timerRef.current);
        unsub();
        setQr(null);
        setShowPopup(true);
      }
    });
    timerRef.current = setInterval(() => {
      setQr((q) => {
        if (!q) { clearInterval(timerRef.current); return q; }
        if (q.left <= 1) {
          clearInterval(timerRef.current);
          unsub();
          return { ...q, left: 0 };
        }
        return { ...q, left: q.left - 1 };
      });
    }, 1000);
  }

  async function cancelQr() {
    if (!qr) return;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await updateDoc(doc(db, 'transactions', qr.txnId), { status: 'cancelled' });
    } catch (e) {}
    setQr(null);
    setCustom('');
  }

  function closePopup() {
    setShowPopup(false);
    setCustom('');
    go('wallet');
  }

  // QR screen
  if (qr) {
    const expired = qr.left <= 0;
    return (
      <div id="deposit-page-section" className="section active">
        <TopBar title="Scan & Pay" onBack={cancelQr} />
        <div className="deposit-page-card" style={{ textAlign: 'center' }}>
          <div className="dp-label">₹{qr.amount} pay karo</div>
          {!expired ? (
            <>
              <img src={qr.imageUrl} alt="Pay QR" style={{ width: 220, height: 220, borderRadius: 12, margin: '0 auto 10px' }} />
              <div style={{ fontSize: 26, fontWeight: 800, color: qr.left < 60 ? 'var(--danger)' : 'var(--text)' }}>
                {fmt(qr.left)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 14px' }}>
                <span className="loader-dot"></span> Payment ka wait ho raha hai...
              </div>
              <button className="dp-btn" style={{ background: 'var(--danger)' }} onClick={cancelQr}>
                <i className="fas fa-times"></i> Cancel
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Time khatam! Dobara QR banao.</div>
              <button className="dp-btn" onClick={cancelQr}>
                <i className="fas fa-sync-alt"></i> Wapas
              </button>
            </>
          )}
        </div>

        {/* Payment milte hi popup */}
        {showPopup && (
          <div className="popup-overlay" style={{ display: 'flex' }}>
            <div className="popup" style={{ textAlign: 'center' }}>
              <i className="fas fa-check-circle" style={{ fontSize: 56, color: 'var(--success)' }}></i>
              <div className="popup-header" style={{ marginTop: 10 }}>Payment Received! 🎉</div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>₹{qr.amount} wallet me jud gaya hai.</p>
              <button className="btn" onClick={closePopup} style={{ marginTop: 8 }}>OK</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Amount screen
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
        <button className="dp-btn" onClick={getQr} disabled={busy}>
          <i className="fas fa-qrcode"></i> {busy ? 'QR ban raha hai...' : 'Get QR Code'}
        </button>
      </div>

      {showPopup && (
        <div className="popup-overlay" style={{ display: 'flex' }}>
          <div className="popup" style={{ textAlign: 'center' }}>
            <i className="fas fa-check-circle" style={{ fontSize: 56, color: 'var(--success)' }}></i>
            <div className="popup-header" style={{ marginTop: 10 }}>Payment Received! 🎉</div>
            <button className="btn" onClick={closePopup} style={{ marginTop: 8 }}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

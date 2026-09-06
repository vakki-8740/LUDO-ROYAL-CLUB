import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, limit, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

// KYC request card: VIEW (detail, no edit) + CANCEL (sirf pending par)
function KycMailCard({ mail, uid, toast }) {
  const [openView, setOpenView] = useState(false);
  const [req, setReq] = useState(null);
  const [busy, setBusy] = useState(false);

  async function toggleView() {
    if (!openView && mail.refId) {
      try {
        const d = await getDoc(doc(db, 'kyc_requests', mail.refId));
        if (d.exists()) setReq(d.data());
      } catch (e) {}
    }
    setOpenView(!openView);
    try {
      await updateDoc(doc(db, 'users', uid, 'mails', mail.id), { read: true });
    } catch (e) {}
  }

  async function cancelReq() {
    if (!mail.refId) return;
    if (!confirm('KYC request cancel karein?')) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'kyc_requests', mail.refId), { status: 'cancelled' });
      await updateDoc(doc(db, 'users', uid), { kycStatus: 'none' });
      setReq({ ...(req || {}), status: 'cancelled' });
      toast('KYC request cancelled', '#ff9500');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  const st = (req && req.status) || 'pending';
  return (
    <div className="mail-item" style={{ borderLeft: '3px solid var(--warning)' }}>
      <div className="mail-subject">{mail.subject || 'KYC Request'} •</div>
      <div className="mail-body">{mail.body || ''}</div>
      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: st === 'approved' ? 'var(--success)' : st === 'rejected' || st === 'cancelled' ? 'var(--danger)' : 'var(--warning)' }}>
        Status: {st === 'pending' ? 'Request Processing...' : st}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn" style={{ background: 'var(--primary)', color: '#fff', padding: '8px 14px', fontSize: 13 }} onClick={toggleView}>
          <i className="fas fa-eye"></i> {openView ? 'Band Karo' : 'View'}
        </button>
        {st === 'pending' && (
          <button className="btn" style={{ background: 'var(--danger)', color: '#fff', padding: '8px 14px', fontSize: 13 }} onClick={cancelReq} disabled={busy}>
            <i className="fas fa-times"></i> {busy ? 'Wait...' : 'Cancel'}
          </button>
        )}
      </div>
      {openView && (
        <div style={{ marginTop: 10, padding: 10, background: 'var(--bg)', borderRadius: 10, fontSize: 13 }}>
          <div style={{ marginBottom: 6 }}><strong>Mobile:</strong> {(req && req.mobile) || '--'}</div>
          <div style={{ marginBottom: 6 }}><strong>UID:</strong> {uid}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Photos Telegram channel me bheji gayi hain. Edit nahi ho sakta.</div>
        </div>
      )}
    </div>
  );
}

export function Mail({ uid, go, toast }) {  const [mails, setMails] = useState([]);

  useEffect(() => {
    getDocs(query(collection(db, 'users', uid, 'mails'), orderBy('timestamp', 'desc'), limit(50)))
      .then((snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setMails(arr);
      })
      .catch(() => {});
  }, [uid]);

  async function open(id) {
    try {
      await updateDoc(doc(db, 'users', uid, 'mails', id), { read: true });
      setMails((ms) => ms.map((m) => (m.id === id ? { ...m, read: true } : m)));
    } catch (e) {}
  }

  return (
    <div id="mail-section" className="section active">
      <TopBar title="Inbox" onBack={() => go('home')} />
      <div id="mails-container">
        {mails.length ? (
          mails.map((m) =>
            m.kind === 'kyc' ? (
              <KycMailCard key={m.id} mail={m} uid={uid} toast={toast} />
            ) : (
              <div key={m.id} className="mail-item" onClick={() => open(m.id)} style={m.read ? { opacity: 0.7 } : {}}>
                <div className="mail-subject">{m.subject || 'No Subject'}{m.read ? '' : ' •'}</div>
                <div className="mail-body">{m.body || ''}</div>
              </div>
            )
          )
        ) : (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 14 }}>No mails yet</div>
        )}
      </div>
    </div>
  );
}

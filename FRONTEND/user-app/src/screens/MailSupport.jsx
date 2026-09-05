import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

export function Mail({ uid, go }) {
  const [mails, setMails] = useState([]);

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
          mails.map((m) => (
            <div key={m.id} className="mail-item" onClick={() => open(m.id)} style={m.read ? { opacity: 0.7 } : {}}>
              <div className="mail-subject">{m.subject || 'No Subject'}{m.read ? '' : ' •'}</div>
              <div className="mail-body">{m.body || ''}</div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 14 }}>No mails yet</div>
        )}
      </div>
    </div>
  );
}

export function Support({ go }) {
  const [s, setS] = useState(null);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'support'))
      .then((d) => setS(d.exists() ? d.data() : {}))
      .catch(() => setS({}));
  }, []);

  return (
    <div id="support-section" className="section active">
      <TopBar title="Support Team" onBack={() => go('home')} />
      <div id="support-content">
        {s && (s.whatsapp || s.telegram || s.chat) ? (
          <>
            {s.logo ? (
              <img src={s.logo} style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 15, objectFit: 'cover' }} alt="" />
            ) : (
              <i className="fas fa-headset" style={{ fontSize: 60, color: 'var(--primary)', marginBottom: 15 }}></i>
            )}
            <h3 style={{ marginBottom: 20 }}>Contact Support Team</h3>
            {s.whatsapp && <a href={s.whatsapp} target="_blank" rel="noreferrer" className="btn" style={{ background: '#25D366' }}><i className="fab fa-whatsapp"></i> WhatsApp</a>}
            {s.telegram && <a href={s.telegram} target="_blank" rel="noreferrer" className="btn" style={{ background: '#0088cc' }}><i className="fab fa-telegram"></i> Telegram</a>}
            {s.chat && <a href={s.chat} target="_blank" rel="noreferrer" className="btn" style={{ background: 'var(--primary)' }}><i className="fas fa-comment"></i> Live Chat</a>}
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Support information not available.</p>
        )}
      </div>
    </div>
  );
}

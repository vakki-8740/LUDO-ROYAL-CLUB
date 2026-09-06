import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

// Support: Email + Telegram + Online Chat (sab admin panel se manage)
const CARDS = [
  {
    key: 'email',
    title: 'Email Support',
    desc: 'Apni problem mail par bhejo',
    icon: './SUPPORT-ICONS/EMAIL-LOGO.jpg',
    color: '#EA4335'
  },
  {
    key: 'telegram',
    title: 'Telegram',
    desc: 'Telegram par baat karo',
    icon: './SUPPORT-ICONS/TELEGRAM-LOGO.jpg',
    color: '#0088cc'
  },
  {
    key: 'chat',
    title: 'Online Chat',
    desc: 'Live chat kholo',
    icon: './SUPPORT-ICONS/CHAT-LOGO.jpg',
    color: '#34c759'
  }
];

export function Support({ go, profile }) {
  const [s, setS] = useState(null);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'support'))
      .then((d) => setS(d.exists() ? d.data() : {}))
      .catch(() => setS({}));
  }, []);

  function tap(key) {
    if (!s) return;
    if (key === 'email') {
      if (!s.email) return;
      const subject = encodeURIComponent('Ludo Royal Club Support - ' + (profile.userId || ''));
      const body = encodeURIComponent(
        'Name: ' + (profile.name || '') + '\nUser ID: ' + (profile.userId || '') + '\n\nMeri problem:\n'
      );
      window.location.href = `mailto:${s.email}?subject=${subject}&body=${body}`;
    } else if (key === 'telegram') {
      if (s.telegram) window.open(s.telegram, '_blank');
    } else if (key === 'chat') {
      if (s.chat) window.open(s.chat, '_blank');
    }
  }

  return (
    <div id="support-section" className="section active">
      <TopBar title="Support Team" onBack={() => go('home')} />
      <div style={{ textAlign: 'center', padding: '10px 20px 0' }}>
        <h3 style={{ marginBottom: 6 }}>Contact Support Team</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Neeche kisi par tap karo
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CARDS.map((c) => {
          const val = s ? s[c.key] : undefined;
          const off = s !== null && !val;
          return (
            <div
              key={c.key}
              className="pa-item"
              onClick={() => tap(c.key)}
              style={{ opacity: off ? 0.5 : 1 }}
            >
              <img
                src={c.icon}
                alt={c.title}
                style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {off ? 'Jald aa raha hai' : c.desc}
                </div>
              </div>
              <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)' }}></i>
            </div>
          );
        })}
      </div>
    </div>
  );
}

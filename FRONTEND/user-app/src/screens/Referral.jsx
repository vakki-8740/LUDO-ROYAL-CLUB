import React, { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

export default function Referral({ profile, toast, go }) {
  const code = profile.referralCode || profile.userId || '------';
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!code || code === '------') return;
    getDocs(query(collection(db, 'users'), where('referredBy', '==', code), limit(50)))
      .then((snap) => {
        const arr = [];
        snap.forEach((d) => arr.push(d.data()));
        setUsers(arr);
      })
      .catch(() => {});
  }, [code]);

  function copy() {
    try {
      navigator.clipboard.writeText(code);
    } catch (e) {}
    toast('Referral code copied!', '#34c759');
  }

  function wa() {
    const msg = encodeURIComponent(`Join Ludo Royal Club and win real money! Use my referral code: ${code}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  function tg() {
    const msg = encodeURIComponent(`Join Ludo Royal Club and win real money! Use my referral code: ${code}`);
    window.open(`https://t.me/share/url?url=&text=${msg}`, '_blank');
  }

  return (
    <div id="referral-section" className="section active">
      <TopBar title="Referral" onBack={() => go('home')} />
      <div className="referral-card">
        <div className="rc-title">Refer &amp; Earn 2% Commission</div>
        <div className="rc-code">{code}</div>
        <button className="btn" onClick={copy}><i className="fas fa-copy"></i> Copy Referral Link</button>
        <div className="rc-share">
          <button className="btn" style={{ background: '#25D366' }} onClick={wa}>
            <i className="fab fa-whatsapp"></i> WhatsApp
          </button>
          <button className="btn" style={{ background: '#0088cc' }} onClick={tg}>
            <i className="fab fa-telegram"></i> Telegram
          </button>
        </div>
      </div>
      <div className="section-subtitle">Your Referrals</div>
      <div id="referral-users-list">
        {users.length ? (
          users.map((u, i) => (
            <div className="history-item" key={i}>
              <div className="hi-left">
                <div className="hi-icon" style={{ background: 'rgba(0,122,255,0.12)', color: 'var(--primary)' }}>
                  <i className="fas fa-user"></i>
                </div>
                <div>
                  <div className="hi-detail">{u.name || 'Player'}</div>
                  <div className="hi-date">ID: {u.userId || '--'}</div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            No referrals yet — share your code!
          </div>
        )}
      </div>
    </div>
  );
}

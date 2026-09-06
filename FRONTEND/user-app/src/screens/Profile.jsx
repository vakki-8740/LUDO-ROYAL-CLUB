import React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';
import { winAmount } from './Wallet.jsx';
import { logoutAll } from './Login.jsx';

export default function Profile({ profile, uid, toast, go, onLogout }) {
  const logo = profile.profileLogo || profile.photoURL;

  async function editName() {
    const name = prompt('Enter new name:', profile.name || '');
    if (name && name.trim()) {
      try {
        await updateDoc(doc(db, 'users', uid), { name: name.trim() });
        toast('Name updated!', '#34c759');
      } catch (e) {
        toast('Error: ' + e.message, '#ff3b30');
      }
    }
  }

  async function logout() {
    await logoutAll();
    onLogout();
  }

  return (
    <div id="profile-section" className="section active">
      <TopBar title="Profile" onBack={() => go('home')} />
      <div className="profile-card">
        <div className="profile-avatar">
          {logo ? (
            <img src={logo} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" />
          ) : (
            (profile.name || '?')[0].toUpperCase()
          )}
        </div>
        <div className="profile-name">{profile.name || 'User'}</div>
        <div className="profile-id">ID: {profile.userId || '---'}</div>
      </div>

      <div className="profile-stats-card">
        <div className="p-stat">
          <div className="p-stat-icon green"><i className="fas fa-arrow-down"></i></div>
          <span className="p-stat-label">Deposit</span>
          <strong>₹{profile.totalDeposit || 0}</strong>
        </div>
        <div className="p-stat-divider"></div>
        <div className="p-stat">
          <div className="p-stat-icon red"><i className="fas fa-arrow-up"></i></div>
          <span className="p-stat-label">Withdraw</span>
          <strong>₹{profile.totalWithdraw || 0}</strong>
        </div>
        <div className="p-stat-divider"></div>
        <div className="p-stat">
          <div className="p-stat-icon orange"><i className="fas fa-trophy"></i></div>
          <span className="p-stat-label">Win</span>
          <strong>₹{winAmount(profile)}</strong>
        </div>
      </div>

      <div className="profile-actions" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="pa-item" onClick={editName}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(0,122,255,0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            <i className="fas fa-edit"></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Name</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Apna naam badlo</div>
          </div>
          <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)' }}></i>
        </div>
        <div className="pa-item" onClick={() => go('kyc')}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,149,0,0.12)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            <i className="fas fa-id-card"></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>KYC Verification</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aadhaar + mobile submit karo</div>
          </div>
          <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)' }}></i>
        </div>
        <div className="pa-item" onClick={logout}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,59,48,0.12)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            <i className="fas fa-sign-out-alt"></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Logout</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Account se bahar niklo</div>
          </div>
          <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)' }}></i>
        </div>
      </div>
    </div>
  );
}

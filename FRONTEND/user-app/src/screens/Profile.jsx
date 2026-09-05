import React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';
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
          <strong>₹{profile.totalWin || 0}</strong>
        </div>
      </div>

      <div className="profile-actions">
        <div className="pa-item" onClick={editName}><i className="fas fa-edit"></i> Edit Name</div>
        <div className="pa-item" onClick={logout}>
          <i className="fas fa-sign-out-alt" style={{ color: 'var(--danger)' }}></i> Logout
        </div>
      </div>
    </div>
  );
}

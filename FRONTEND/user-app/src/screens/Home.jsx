import React, { useState } from 'react';
import { RulesPopup } from './Popups.jsx';

export default function Home({ profile, go }) {
  const [rules, setRules] = useState(false);
  const kycDone = profile && profile.kycStatus === 'approved';

  return (
    <div id="home-section" className="section active">
      {!kycDone && (
        <div className="kyc-pending-card" id="kyc-pending-card">
          <div className="kyc-pending-left">
            <i className="fas fa-id-card"></i>
            <span>KYC Pending</span>
          </div>
          <button className="kyc-complete-btn" onClick={() => go('wallet')}>Complete Here</button>
        </div>
      )}

      <div className="notice-card">
        <div className="notice-icon"><i className="fas fa-exclamation-triangle"></i></div>
        <div className="notice-text">
          <strong>Notice:-</strong> सभि PLAYERS उसी Name से पैसा डाले जिस Name से KYC है अलगे Name से डालेगे तो
          आपका पैसा Hold हो जाएगा !!! WhatsApp 8082547350
        </div>
      </div>

      <div className="section-title-row">
        <div className="section-title">Choose Your Game</div>
        <button className="rules-btn" onClick={() => setRules(true)}>
          <i className="fas fa-book"></i> Rules
        </button>
      </div>

      <div className="games-grid" id="games-grid">
        {[0, 1].map((i) => (
          <div className="game-card" key={i} onClick={() => go('lobby')}>
            <div className="game-image">
              <img src="./IMAGES/B-IMAGE.jpg" alt="Classic Ludo" />
            </div>
            <div className="game-name">Classic Ludo</div>
          </div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: 20 }}>Quick Actions</div>
      <div className="quick-actions">
        <div className="qa-card" onClick={() => go('wallet')}>
          <i className="fas fa-plus-circle" style={{ color: 'var(--success)', fontSize: 28 }}></i>
          <span>Deposit</span>
        </div>
        <div className="qa-card" onClick={() => go('wallet')}>
          <i className="fas fa-arrow-up" style={{ color: 'var(--danger)', fontSize: 28 }}></i>
          <span>Withdraw</span>
        </div>
        <div className="qa-card" onClick={() => go('profile')}>
          <i className="fas fa-user" style={{ color: 'var(--primary)', fontSize: 28 }}></i>
          <span>Profile</span>
        </div>
        <div className="qa-card" onClick={() => go('referral')}>
          <i className="fas fa-share-alt" style={{ color: '#ff9500', fontSize: 28 }}></i>
          <span>Referral</span>
        </div>
      </div>

      {rules && <RulesPopup onClose={() => setRules(false)} />}
    </div>
  );
}

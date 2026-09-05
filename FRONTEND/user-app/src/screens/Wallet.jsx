import React from 'react';
import { TopBar } from '../components/ui.jsx';

export default function Wallet({ profile, go }) {
  return (
    <div id="wallet-section" className="section active">
      <TopBar title="Wallet" onBack={() => go('home')} />

      <div className="wallet-card">
        <div className="wallet-card-top">
          <span className="wallet-label">Available Balance</span>
        </div>
        <div className="wallet-amount">₹<span>{profile.balance || 0}</span></div>
        <div className="wallet-actions">
          <button className="wallet-btn deposit" onClick={() => go('deposit')}>
            <i className="fas fa-plus"></i> Deposit
          </button>
          <button className="wallet-btn withdrawal" onClick={() => go('withdraw')}>
            <i className="fas fa-arrow-up"></i> Withdrawal
          </button>
        </div>
      </div>

      <div className="wallet-stats">
        <div className="wallet-stat-card">
          <div className="wsc-icon green"><i className="fas fa-arrow-down"></i></div>
          <div className="wsc-info">
            <span>Deposits</span>
            <strong>₹<span>{profile.totalDeposit || 0}</span></strong>
          </div>
        </div>
        <div className="wallet-stat-card">
          <div className="wsc-icon red"><i className="fas fa-arrow-up"></i></div>
          <div className="wsc-info">
            <span>Withdraws</span>
            <strong>₹<span>{profile.totalWithdraw || 0}</span></strong>
          </div>
        </div>
        <div className="wallet-stat-card">
          <div className="wsc-icon orange"><i className="fas fa-trophy"></i></div>
          <div className="wsc-info">
            <span>Winnings</span>
            <strong>₹<span>{profile.totalWin || 0}</span></strong>
          </div>
        </div>
      </div>

      <button className="view-history-btn" onClick={() => go('history')}>
        <i className="fas fa-clock"></i>
        <span>View Transaction History</span>
        <i className="fas fa-chevron-right"></i>
      </button>
    </div>
  );
}

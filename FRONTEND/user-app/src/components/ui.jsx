import React from 'react';

export function TopBar({ title, onBack }) {
  return (
    <div className="top-bar">
      <i className="fas fa-arrow-left" onClick={onBack} style={{ fontSize: 20, cursor: 'pointer' }}></i>
      <span>{title}</span>
      <span></span>
    </div>
  );
}

export function Empty({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>{text}</div>
  );
}

export function OpenBetCard({ bet, onPlay, isNew, myUid }) {
  const canPlay = bet.creatorId !== myUid;
  return (
    <div className={`bet-card-new ${isNew ? 'bet-slide-in' : ''}`}>
      <div className="open-bet-top">
        <span className="open-bet-label">Challenge set by</span>
        <span className="open-bet-amount">₹{bet.amount || 0}</span>
      </div>
      <div className="open-bet-bottom">
        <div className="open-bet-user">
          <div className="open-bet-avatar"><img src={bet.creatorLogo} alt="" /></div>
          <div className="open-bet-name">{bet.creatorName || 'Player'}</div>
        </div>
        {canPlay && (
          <button className="open-bet-play" onClick={() => onPlay(bet)}>Play</button>
        )}
      </div>
    </div>
  );
}

export function PlayingBetCard({ bet }) {
  return (
    <div className="bet-card-new playing">
      <div className="bet-card-top">
        <div className="bet-user">
          <div className="bet-user-avatar"><img src={bet.creatorLogo} alt="" /></div>
          <div className="bet-user-name">{bet.creatorName || 'Player'}</div>
        </div>
        <div className="bet-vs-center">
          <div className="bet-amount-green">+₹{bet.amount || 0}</div>
        </div>
        <div className="bet-user">
          <div className="bet-user-avatar"><img src={bet.joinerLogo} alt="" /></div>
          <div className="bet-user-name">{bet.joinerName || 'Player'}</div>
        </div>
      </div>
      <div className={`bet-status-badge ${bet.status}`}>
        {bet.status === 'playing' ? 'LIVE NOW' : 'COMPLETED'}
      </div>
    </div>
  );
}

export function HistoryItem({ item }) {
  const isDeposit = item.type === 'Deposit';
  return (
    <div className="history-item">
      <div className="hi-left">
        <div
          className="hi-icon"
          style={{
            background: isDeposit ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)',
            color: isDeposit ? 'var(--success)' : 'var(--danger)'
          }}
        >
          <i className={`fas ${isDeposit ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
        </div>
        <div>
          <div className="hi-detail">{item.type}</div>
          <div className="hi-date">{item.date || ''}</div>
        </div>
      </div>
      <div>
        <div className="hi-amount" style={{ color: isDeposit ? 'var(--success)' : 'var(--danger)' }}>
          {isDeposit ? '+' : '-'}₹{item.amount || 0}
        </div>
        <div
          style={{
            fontSize: 11,
            color:
              item.status === 'Success'
                ? 'var(--success)'
                : item.status === 'Pending'
                ? 'var(--warning)'
                : 'var(--danger)',
            textAlign: 'right'
          }}
        >
          {item.status || ''}
        </div>
      </div>
    </div>
  );
}

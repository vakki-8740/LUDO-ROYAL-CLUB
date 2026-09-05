import React, { useState } from 'react';
import '../pagesContent.js';

const PAGE_TITLES = {
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
  about: 'About Us',
  gst: 'GST',
  rules: 'Game Rules'
};

export function pageTitle(type) {
  return PAGE_TITLES[type] || 'Page';
}

export function pageHtml(type) {
  const c = window.PAGE_CONTENT && window.PAGE_CONTENT[type];
  return c || '<p style="text-align:center;color:var(--text-muted);padding:20px;">Content not available.</p>';
}

export function RulesPopup({ onClose }) {
  const items = [
    ['fa-users', 'var(--primary)', 'No. Of Max Players:', '2 players'],
    ['fa-chess', 'var(--warning)', 'Tokens:', '4 tokens each, all open at the start 🎲'],
    ['fa-bullseye', 'var(--danger)', 'Objective:', 'Move all 4 tokens to the final home position before your opponent.'],
    ['fa-clock', 'var(--success)', 'Game Duration:', '10-minute timer ⏰'],
    ['fa-dice', 'var(--primary)', 'Movement:', 'Roll the die and move tokens. Rolling a 6 gives an extra turn.'],
    ['fa-crosshairs', 'var(--danger)', 'Killing:', "Land on an opponent's token to send them back to start."]
  ];
  return (
    <div id="rules-overlay" className="rules-overlay show" onClick={onClose}>
      <div className="rules-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="rules-handle"></div>
        <div className="rules-header">
          <i className="fas fa-book" style={{ color: 'var(--primary)' }}></i>
          <span>Game Rules</span>
          <i className="fas fa-times" onClick={onClose} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}></i>
        </div>
        <div className="rules-body">
          {items.map(([icon, color, head, body], i) => (
            <div className="rule-item" key={i}>
              <i className={`fas ${icon}`} style={{ color }}></i>
              <div>
                <strong>{head}</strong> {body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CreateBetPopup({ onClose, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [room, setRoom] = useState('');
  return (
    <div id="create-bet-overlay" className="popup-overlay" style={{ display: 'flex' }} onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">Create Bet</div>
        <input type="number" placeholder="Enter Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input type="text" placeholder="Enter Room Code" value={room} onChange={(e) => setRoom(e.target.value)} />
        <button className="btn" onClick={() => onSubmit(amount, room)}>Submit</button>
        <button className="btn" style={{ background: 'var(--text-muted)', marginTop: 10 }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

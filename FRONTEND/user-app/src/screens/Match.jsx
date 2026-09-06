import React, { useState } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

function fmtTime(ts) {
  try {
    if (ts && ts.toDate) return ts.toDate().toLocaleString();
  } catch (e) {}
  return '--';
}

// Match page: room-code exchange -> dono confirm -> LIVE
// Creator: room code bharega. Joiner: code milega + copy + confirm.
export default function Match({ betId, bets, uid, toast, go }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const bet = bets.find((b) => b.id === betId);
  if (!bet) {
    return (
      <div className="section active">
        <TopBar title="Match" onBack={() => go('lobby')} />
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Match nahi mila (cancel/complete ho gaya).
        </div>
      </div>
    );
  }

  const isCreator = bet.creatorId === uid;
  const oppName = isCreator ? bet.joinerName : bet.creatorName;
  const oppLogo = isCreator ? bet.joinerLogo : bet.creatorLogo;
  const live = bet.status === 'playing';

  function copyCode() {
    try {
      navigator.clipboard.writeText(bet.roomCode || '');
      toast('Room code copied!', '#34c759');
    } catch (e) {}
  }

  // Creator: room code bhejo
  async function sendRoomCode() {
    const rc = (code || '').trim().toUpperCase();
    if (!rc) return toast('Room code dalo', '#ff3b30');
    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(doc(db, 'bets', bet.id));
        if (!snap.exists()) throw new Error('Match nahi mila');
        const d = snap.data();
        if (d.creatorId !== uid) throw new Error('Sirf bet lagane wala code bhej sakta hai');
        const upd = { roomCode: rc, creatorConfirmed: true };
        if (d.joinerConfirmed) upd.status = 'playing';
        tx.update(doc(db, 'bets', bet.id), upd);
      });
      toast('Room code bhej diya!', '#34c759');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  // Joiner: confirm dabao -> dono confirm to LIVE
  async function confirmJoin() {
    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(doc(db, 'bets', bet.id));
        if (!snap.exists()) throw new Error('Match nahi mila');
        const d = snap.data();
        if (!d.roomCode) throw new Error('Room code abhi nahi aaya. Thoda ruko.');
        const upd = { joinerConfirmed: true };
        if (d.creatorConfirmed) upd.status = 'playing';
        tx.update(doc(db, 'bets', bet.id), upd);
      });
      toast('Confirmed! Good luck 🍀', '#34c759');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section active">
      <TopBar title="Match" onBack={() => go('lobby')} />

      {/* Amount + timing + opponent — dono ko same dikhta hai */}
      <div className="wallet-card" style={{ textAlign: 'center' }}>
        <div className="wallet-label">Bet Amount</div>
        <div className="wallet-amount">₹{bet.amount || 0}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Timing: {fmtTime(bet.matchedAt || bet.timestamp)}
        </div>
      </div>

      <div className="bet-card-new playing">
        <div className="bet-card-top">
          <div className="bet-user">
            <div className="bet-user-avatar">
              {bet.creatorLogo ? <img src={bet.creatorLogo} alt="" /> : '?'}
            </div>
            <div className="bet-user-name">{bet.creatorName || 'Player'}</div>
          </div>
          <div className="bet-vs-center">
            <div className="bet-amount-green">VS</div>
          </div>
          <div className="bet-user">
            <div className="bet-user-avatar">
              {bet.joinerLogo ? <img src={bet.joinerLogo} alt="" /> : '?'}
            </div>
            <div className="bet-user-name">{bet.joinerName || 'Player'}</div>
          </div>
        </div>
        <div className={`bet-status-badge ${live ? 'playing' : ''}`}>
          {live ? 'LIVE NOW' : 'ROOM CODE EXCHANGE'}
        </div>
      </div>

      {live ? (
        <div className="deposit-page-card" style={{ textAlign: 'center' }}>
          <div className="dp-label">User vs User match shuru! Game me jao aur khelo 🍀</div>
          {bet.roomCode && (
            <div className="rc-code" style={{ color: 'var(--text)' }}>
              {bet.roomCode}
            </div>
          )}
          <button className="dp-btn" style={{ background: 'var(--primary)' }} onClick={copyCode}>
            <i className="fas fa-copy"></i> Copy Room Code
          </button>
        </div>
      ) : isCreator ? (
        /* ===== CREATOR SIDE ===== */
        <div className="deposit-page-card">
          <div className="dp-label">
            Opponent: <strong>{oppName || 'Player'}</strong> tumhare sath khelna chahta hai
          </div>
          {!bet.roomCode ? (
            <>
              <div className="dp-label">Room Code bharo (is code se match hogi)</div>
              <div className="dp-custom">
                <input
                  type="text"
                  placeholder="ROOM CODE"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <button className="dp-btn" onClick={sendRoomCode} disabled={busy}>
                <i className="fas fa-check"></i> {busy ? 'Wait...' : 'Confirm'}
              </button>
            </>
          ) : bet.joinerConfirmed ? (
            <div style={{ textAlign: 'center', padding: 10 }}>
              <span className="loader-dot"></span> Match live ho raha hai...
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 10 }}>
              <div className="rc-code" style={{ color: 'var(--text)' }}>{bet.roomCode}</div>
              <span className="loader-dot"></span> Opponent ke confirm ka wait...
            </div>
          )}
        </div>
      ) : (
        /* ===== JOINER SIDE ===== */
        <div className="deposit-page-card">
          <div className="dp-label">
            Opponent: <strong>{oppName || 'Player'}</strong> (bet lagane wala)
          </div>
          {!bet.roomCode ? (
            <div style={{ textAlign: 'center', padding: 10 }}>
              <span className="loader-dot"></span>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                Room code aa raha hai... creator bhej raha hai
              </div>
            </div>
          ) : (
            <>
              <div className="dp-label">Room Code mil gaya! Copy karo aur game me jao:</div>
              <div className="rc-code" style={{ color: 'var(--text)' }}>{bet.roomCode}</div>
              <div className="rc-share" style={{ marginBottom: 10 }}>
                <button className="btn" style={{ background: 'var(--primary)', color: '#fff' }} onClick={copyCode}>
                  <i className="fas fa-copy"></i> Copy
                </button>
              </div>
              {!bet.joinerConfirmed && (
                <button className="dp-btn" onClick={confirmJoin} disabled={busy}>
                  <i className="fas fa-check"></i> {busy ? 'Wait...' : 'Confirm'}
                </button>
              )}
              {bet.joinerConfirmed && !live && (
                <div style={{ textAlign: 'center', padding: 10 }}>
                  <span className="loader-dot"></span> Match live ho raha hai...
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

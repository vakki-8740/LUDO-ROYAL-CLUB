import React, { useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, increment, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { randomLogo } from '../lib.js';
import { Empty, OpenBetCard, PlayingBetCard, TopBar } from '../components/ui.jsx';
import { CreateBetPopup } from './Popups.jsx';

export default function Lobby({ bets, profile, uid, toast, go }) {
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return bets;
    return bets.filter(
      (b) =>
        (b.creatorName || '').toLowerCase().includes(s) ||
        (b.joinerName || '').toLowerCase().includes(s) ||
        String(b.amount || '').includes(s) ||
        (b.status || '').toLowerCase().includes(s) ||
        (b.roomCode || '').toLowerCase().includes(s)
    );
  }, [bets, q]);

  // Bet lagao: SIRF amount. Room code tab jab koi join karega (match page par).
  async function submitBet(amountStr) {
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) return toast('Enter valid amount', '#ff3b30');
    if ((profile.balance || 0) <= 0) return toast('Add money to wallet first!', '#ff9500');
    if ((profile.balance || 0) < amount) return toast('Insufficient balance!', '#ff3b30');
    setBusy(true);
    try {
      await updateDoc(doc(db, 'users', uid), { balance: increment(-amount) });
      await addDoc(collection(db, 'bets'), {
        creatorId: uid,
        creatorName: profile.name || 'Player',
        creatorLogo: profile.profileLogo || randomLogo(),
        amount,
        roomCode: '',
        status: 'waiting',
        joinerId: '',
        joinerName: '',
        joinerLogo: '',
        creatorConfirmed: false,
        joinerConfirmed: false,
        matchedAt: null,
        timestamp: serverTimestamp()
      });
      toast('Bet lag gayi! Opponent ka wait karo...', '#34c759');
      setShowCreate(false);
      go('lobby');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  // Apni waiting bet cancel (paisa wapas)
  async function cancelBet(bet) {
    if (!confirm('Bet cancel karein? Paisa wapas milega.')) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'bets', bet.id));
      await updateDoc(doc(db, 'users', uid), { balance: increment(bet.amount || 0) });
      toast('Bet cancelled, paisa wapas!', '#34c759');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  // Play dabao: match page khulega (room code creator bhejega)
  async function joinBet(bet) {
    const amount = parseFloat(bet.amount);
    if (!amount || amount <= 0) return toast('Invalid bet amount!', '#ff3b30');
    if ((profile.balance || 0) < amount) return toast('Insufficient balance!', '#ff3b30');
    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const bSnap = await tx.get(doc(db, 'bets', bet.id));
        if (!bSnap.exists()) throw new Error('Bet not found');
        const d = bSnap.data();
        if (d.status !== 'waiting') throw new Error('Bet already taken');
        if (d.creatorId === uid) throw new Error("You can't join your own bet");
        const uSnap = await tx.get(doc(db, 'users', uid));
        if ((uSnap.data().balance || 0) < d.amount) throw new Error('Insufficient balance!');
        tx.update(doc(db, 'users', uid), { balance: increment(-d.amount) });
        tx.update(doc(db, 'bets', bet.id), {
          status: 'joined',
          joinerId: uid,
          joinerName: profile.name || 'Player',
          joinerLogo: profile.profileLogo || randomLogo(),
          matchedAt: serverTimestamp()
        });
      });
      go('match:' + bet.id);
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="lobby-section" className="section active">
      <div className="top-bar">
        <i className="fas fa-arrow-left" onClick={() => go('home')} style={{ fontSize: 20, cursor: 'pointer' }}></i>
        <span>Game Lobby</span>
        <button
          className="create-btn-sm"
          disabled={busy}
          onClick={() => {
            if ((profile.balance || 0) <= 0) return toast('Add money to wallet first!', '#ff9500');
            setShowCreate(true);
          }}
        >
          <i className="fas fa-plus"></i> Create Bet
        </button>
      </div>

      <div className="search-bar">
        <i className="fas fa-search"></i>
        <input type="text" placeholder="Search by name, amount..." value={q} onChange={(e) => setQ(e.target.value)} />
        {q && (
          <i className="fas fa-times search-clear" onClick={() => setQ('')} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}></i>
        )}
      </div>

      <div className="lobby-section-title">
        <i className="fas fa-fire" style={{ color: 'var(--warning)' }}></i> All Bets
      </div>

      {/* SAB ek hi list me: meri bets + sabki bets */}
      <div id="open-bets-container">
        {filtered.length ? (
          filtered.map((b) => {
            const mine = b.creatorId === uid || b.joinerId === uid;
            // Meri waiting bet: loading + cancel
            if (b.status === 'waiting' && b.creatorId === uid) {
              return (
                <div className="bet-card-new waiting-pulse" key={b.id}>
                  <div className="open-bet-top">
                    <span className="open-bet-label">
                      <span className="loader-dot"></span> Opponent ka wait ho raha hai...
                    </span>
                    <span className="open-bet-amount">₹{b.amount || 0}</span>
                  </div>
                  <div className="open-bet-bottom">
                    <div className="open-bet-user">
                      <div className="open-bet-avatar"><img src={b.creatorLogo} alt="" /></div>
                      <div className="open-bet-name">{b.creatorName || 'Player'} (You)</div>
                    </div>
                    <button className="open-bet-play" style={{ background: 'var(--danger)' }} onClick={() => cancelBet(b)}>
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }
            // Meri active match (joined/playing): tap -> match page
            if ((b.status === 'joined' || b.status === 'playing') && mine) {
              const opp = b.creatorId === uid ? b.joinerName : b.creatorName;
              return (
                <div className="bet-card-new" key={b.id} onClick={() => go('match:' + b.id)} style={{ cursor: 'pointer' }}>
                  <div className="open-bet-top">
                    <span className="open-bet-label">
                      vs {opp || 'Player'} (You) {b.status === 'joined' ? '• room code exchange' : '• LIVE'}
                    </span>
                    <span className="open-bet-amount">₹{b.amount || 0}</span>
                  </div>
                  <div className="open-bet-bottom">
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Match page kholo →</span>
                    <button className="open-bet-play" onClick={() => go('match:' + b.id)}>Open</button>
                  </div>
                </div>
              );
            }
            // Kisi aur ki open bet: Play
            if (b.status === 'waiting') {
              return <OpenBetCard key={b.id} bet={b} onPlay={joinBet} myUid={uid} />;
            }
            // Baaki (live/completed): display
            return <PlayingBetCard key={b.id} bet={b} />;
          })
        ) : (
          <Empty text={q ? 'No bets found' : 'No bets yet'} />
        )}
      </div>

      {showCreate && <CreateBetPopup onClose={() => setShowCreate(false)} onSubmit={submitBet} />}
    </div>
  );
}

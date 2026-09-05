import React, { useMemo, useState } from 'react';
import { addDoc, collection, doc, increment, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
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

  const openBets = filtered.filter((b) => b.status === 'waiting');
  const playingBets = filtered.filter((b) => b.status === 'playing' || b.status === 'completed');

  async function submitBet(amountStr, room) {
    const amount = parseFloat(amountStr);
    const roomCode = (room || '').trim().toUpperCase();
    if (!amount || amount <= 0) return toast('Enter valid amount', '#ff3b30');
    if (!roomCode) return toast('Enter room code', '#ff3b30');
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
        roomCode,
        status: 'waiting',
        joinerId: '',
        joinerName: '',
        joinerLogo: '',
        timestamp: serverTimestamp()
      });
      toast('Bet created! Waiting for opponent...', '#34c759');
      setShowCreate(false);
      go('lobby');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  async function joinBet(bet) {
    const amount = parseFloat(bet.amount);
    if (!amount || amount <= 0) return toast('Invalid bet amount!', '#ff3b30');
    if ((profile.balance || 0) < amount) return toast('Insufficient balance!', '#ff3b30');
    setBusy(true);
    try {
      const roomCode = await runTransaction(db, async (tx) => {
        const bSnap = await tx.get(doc(db, 'bets', bet.id));
        if (!bSnap.exists()) throw new Error('Bet not found');
        const d = bSnap.data();
        if (d.status !== 'waiting') throw new Error('Bet already taken');
        if (d.creatorId === uid) throw new Error("You can't join your own bet");
        const uSnap = await tx.get(doc(db, 'users', uid));
        if ((uSnap.data().balance || 0) < d.amount) throw new Error('Insufficient balance!');
        tx.update(doc(db, 'users', uid), { balance: increment(-d.amount) });
        tx.update(doc(db, 'bets', bet.id), {
          status: 'playing',
          joinerId: uid,
          joinerName: profile.name || 'Player',
          joinerLogo: profile.profileLogo || randomLogo()
        });
        return d.roomCode;
      });
      toast(`Room Code: ${roomCode} (copied!)`, '#007aff');
      try {
        await navigator.clipboard.writeText(roomCode);
      } catch (e) {}
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
        <i className="fas fa-fire" style={{ color: 'var(--warning)' }}></i> Open Battles (Classic)
      </div>
      <div id="open-bets-container">
        {openBets.length ? (
          openBets.map((b) => <OpenBetCard key={b.id} bet={b} onPlay={joinBet} myUid={uid} />)
        ) : (
          <Empty text={q ? 'No open battles found' : 'No open battles'} />
        )}
      </div>

      <div className="lobby-section-title">
        <i className="fas fa-play-circle" style={{ color: 'var(--success)' }}></i> Currently Playing
      </div>
      <div id="playing-bets-container">
        {playingBets.length ? (
          playingBets.map((b) => <PlayingBetCard key={b.id} bet={b} />)
        ) : (
          <Empty text={q ? 'No active games found' : 'No active games'} />
        )}
      </div>

      <button className="refresh-btn" onClick={() => toast('Bets refreshed!', '#34c759')}>
        <i className="fas fa-sync-alt"></i> Load More Bets
      </button>

      {showCreate && <CreateBetPopup onClose={() => setShowCreate(false)} onSubmit={submitBet} />}
    </div>
  );
}

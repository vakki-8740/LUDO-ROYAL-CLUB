import React, { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { HistoryItem, TopBar } from '../components/ui.jsx';

const TABS = [
  ['all', 'All'],
  ['Deposit', 'Deposits'],
  ['Withdraw', 'Withdrawals']
];

export default function History({ uid, go }) {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);

  useEffect(() => {
    // NOTE: orderBy lagane par Firestore composite index maangta hai,
    // isliye sort code me (nayi pehle)
    getDocs(query(collection(db, 'transactions'), where('userId', '==', uid), limit(50)))
      .then((snap) => {
        const arr = [];
        snap.forEach((d) => {
          const t = d.data();
          arr.push({ id: d.id, type: t.type || '', amount: t.amount || 0, status: t.status || '', date: t.date || '', ts: t.timestamp && t.timestamp.toMillis ? t.timestamp.toMillis() : 0 });
        });
        arr.sort((a, b) => b.ts - a.ts);
        setItems(arr);
      })
      .catch(() => {});
  }, [uid]);

  const shown = tab === 'all' ? items : items.filter((i) => i.type === tab);

  return (
    <div id="history-page-section" className="section active">
      <TopBar title="Transaction History" onBack={() => go('wallet')} />
      <div className="history-tabs">
        {TABS.map(([val, label]) => (
          <span key={val} className={`history-tab ${tab === val ? 'active' : ''}`} onClick={() => setTab(val)}>
            {label}
          </span>
        ))}
      </div>
      <div id="history-page-list">
        {shown.length ? (
          shown.map((it) => <HistoryItem key={it.id} item={it} />)
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
            No transactions found
          </div>
        )}
      </div>
    </div>
  );
}

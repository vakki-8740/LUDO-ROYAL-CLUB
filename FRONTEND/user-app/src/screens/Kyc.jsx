import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { compressPhoto } from '../lib.js';
import { TopBar } from '../components/ui.jsx';

// KYC: Aadhaar front + back photo TELEGRAM channel me (UID ke saath),
// Firestore me sirf UID + mobile. Photos admin panel me NAHI aati.
async function sendPhotoToTelegram(botToken, chatId, photoFile, caption) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('photo', photoFile);
  form.append('caption', caption);
  const res = await fetch('https://api.telegram.org/bot' + botToken + '/sendPhoto', {
    method: 'POST',
    body: form
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.description || 'Telegram send fail');
}

// KYC: Aadhaar front + back photo + mobile number -> admin ke paas jayega
export default function Kyc({ profile, uid, toast, go }) {
  const [mobile, setMobile] = useState('');
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [frontPrev, setFrontPrev] = useState('');
  const [backPrev, setBackPrev] = useState('');
    const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [status, setStatus] = useState(profile.kycStatus || 'none');

  useEffect(() => {
    getDocs(query(collection(db, 'kyc_requests'), where('userId', '==', uid), limit(5)))
      .then((snap) => {
        let latest = null, latestTs = -1;
        snap.forEach((d) => {
          const t = d.data().timestamp;
          const ms = t && t.toMillis ? t.toMillis() : 0;
          if (ms >= latestTs) { latestTs = ms; latest = d.data(); }
        });
        if (latest) setStatus(latest.status || 'pending');
      })
      .catch(() => {});
  }, [uid]);

  function pick(setFile, setPrev, e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setPrev(URL.createObjectURL(f));
  }

  async function submit() {
    // KYC EK BAAR: pending/approved request hai to dobara nahi
    if (status === 'pending' || status === 'approved') {
      toast('Tumhari KYC request pehle se hai', '#ff9500');
      return;
    }
    const mob = mobile.replace(/\D/g, '');
    if (mob.length !== 10) return toast('Sahi 10-digit mobile number dalo', '#ff3b30');
    if (!front) return toast('Aadhaar FRONT photo lagao', '#ff3b30');
    if (!back) return toast('Aadhaar BACK photo lagao', '#ff3b30');
    setBusy(true);
    setStep('Photos taiyaar ho rahi hain...');
    try {
      // Telegram settings admin ne dali hain (admin panel > Settings)
      const cfgSnap = await getDoc(doc(db, 'settings', 'kyc_telegram'));
      const cfg = cfgSnap.exists() ? cfgSnap.data() : {};
      if (!cfg.botToken || !cfg.chatId) throw new Error('KYC abhi band hai. Thodi der baad try karo.');
      // Photos halki karo + DONO ek saath bhejo (fast)
      const [frontSmall, backSmall] = await Promise.all([compressPhoto(front), compressPhoto(back)]);
      setStep('Request bheji ja rahi hai...');
      const head = `KYC\nUID: ${uid}\nName: ${profile.name || 'Player'}\nMobile: ${mob}\n`;
      const [reqRef] = await Promise.all([
        (async () => {
          await sendPhotoToTelegram(cfg.botToken, cfg.chatId, frontSmall, head + 'Aadhaar FRONT');
          await sendPhotoToTelegram(cfg.botToken, cfg.chatId, backSmall, head + 'Aadhaar BACK');
          return addDoc(collection(db, 'kyc_requests'), {
            userId: uid,
            userName: profile.name || 'Player',
            mobile: mob,
            status: 'pending',
            timestamp: serverTimestamp()
          });
        })()
      ]);
      // Inbox (notification) me KYC request ka mail — yahin se view + cancel hoga
      await Promise.all([
        addDoc(collection(db, 'users', uid, 'mails'), {
          subject: 'KYC Request Sent 📝',
          body: 'Tumhari KYC request bhej di gayi hai. Neeche View dabakar dekho, Cancel dabakar wapas lo.',
          from: 'Admin',
          read: false,
          kind: 'kyc',
          refId: reqRef.id,
          timestamp: serverTimestamp()
        }),
        updateDoc(doc(db, 'users', uid), { kycStatus: 'pending' })
      ]);
      setStatus('pending');
      toast('KYC submit ho gayi! Admin check karega.', '#34c759');
      setTimeout(() => go('profile'), 1500);
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'approved') {
    return (
      <div className="section active">
        <TopBar title="KYC" onBack={() => go('profile')} />
        <div className="deposit-page-card" style={{ textAlign: 'center' }}>
          <i className="fas fa-check-circle" style={{ fontSize: 50, color: 'var(--success)' }}></i>
          <h3 style={{ marginTop: 10 }}>KYC Approved!</h3>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="section active">
        <TopBar title="KYC" onBack={() => go('profile')} />
        <div className="deposit-page-card" style={{ textAlign: 'center' }}>
          <span className="loader-dot"></span>
          <h3 style={{ marginTop: 10 }}>Request Processing...</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tumhari KYC request bhej di gayi hai. Inbox me dekho ya cancel karo.</p>
          <button className="dp-btn" style={{ background: 'var(--primary)', marginTop: 10 }} onClick={() => go('mail')}>
            <i className="fas fa-envelope"></i> Inbox Dekho
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section active">
      <TopBar title="KYC Verification" onBack={() => go('profile')} />
      <div className="deposit-page-card">
        <div className="dp-label"><i className="fas fa-mobile-alt" style={{ color: 'var(--primary)' }}></i> Mobile Number</div>
        <div className="wp-field"><i className="fas fa-phone"></i><input type="tel" placeholder="10-digit mobile number" value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>

        <div className="dp-label"><i className="fas fa-id-card" style={{ color: 'var(--primary)' }}></i> Aadhaar FRONT Photo</div>
        <label className="dp-btn" style={{ background: 'var(--primary)', marginBottom: 10 }}>
          <i className="fas fa-camera"></i> {frontPrev ? 'Badlo' : 'Photo Lagao'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pick(setFront, setFrontPrev, e)} />
        </label>
        {frontPrev && <img src={frontPrev} alt="front" style={{ width: '100%', borderRadius: 12, marginBottom: 14 }} />}

        <div className="dp-label"><i className="fas fa-id-card" style={{ color: 'var(--primary)' }}></i> Aadhaar BACK Photo</div>
        <label className="dp-btn" style={{ background: 'var(--primary)', marginBottom: 10 }}>
          <i className="fas fa-camera"></i> {backPrev ? 'Badlo' : 'Photo Lagao'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pick(setBack, setBackPrev, e)} />
        </label>
        {backPrev && <img src={backPrev} alt="back" style={{ width: '100%', borderRadius: 12, marginBottom: 14 }} />}

        <button className="dp-btn" onClick={submit} disabled={busy}>
          <i className="fas fa-paper-plane"></i> {busy ? 'Submit ho raha hai...' : 'Submit KYC'}
        </button>
      </div>

      {/* Sending popup: animation + step, phir UI apne aap Processing par */}
      {busy && (
        <div className="popup-overlay" style={{ display: 'flex' }}>
          <div className="popup" style={{ textAlign: 'center' }}>
            <span className="loader-dot" style={{ width: 26, height: 26 }}></span>
            <div className="popup-header" style={{ marginTop: 10 }}>KYC Sending...</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{step || 'Taiyaar ho raha hai...'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

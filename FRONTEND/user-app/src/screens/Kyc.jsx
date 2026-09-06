import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { compressImage, uploadToImgbb } from '../lib.js';
import { TopBar } from '../components/ui.jsx';

// KYC: Aadhaar front + back photo + mobile number -> admin ke paas jayega
export default function Kyc({ profile, uid, toast, go }) {
  const [mobile, setMobile] = useState('');
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [frontPrev, setFrontPrev] = useState('');
  const [backPrev, setBackPrev] = useState('');
  const [busy, setBusy] = useState(false);
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
    const mob = mobile.replace(/\D/g, '');
    if (mob.length !== 10) return toast('Sahi 10-digit mobile number dalo', '#ff3b30');
    if (!front) return toast('Aadhaar FRONT photo lagao', '#ff3b30');
    if (!back) return toast('Aadhaar BACK photo lagao', '#ff3b30');
    setBusy(true);
    try {
      toast('Photos upload ho rahi hain...', '#007aff');
      const frontB64 = await compressImage(front);
      const frontUrl = await uploadToImgbb(frontB64);
      const backB64 = await compressImage(back);
      const backUrl = await uploadToImgbb(backB64);
      await addDoc(collection(db, 'kyc_requests'), {
        userId: uid,
        userName: profile.name || 'Player',
        mobile: mob,
        frontUrl,
        backUrl,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      await updateDoc(doc(db, 'users', uid), { kycStatus: 'pending' });
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
          <h3 style={{ marginTop: 10 }}>KYC Pending hai</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Admin check kar raha hai, thoda wait karo.</p>
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
    </div>
  );
}

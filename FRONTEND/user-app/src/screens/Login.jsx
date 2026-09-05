import React, { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase.js';

export default function Login({ toast }) {
  const [busy, setBusy] = useState(false);

  async function onGoogle() {
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast('Google se login ho gaya!', '#34c759');
    } catch (err) {
      const msg = (err && err.message) || 'Login failed';
      if (msg.includes('popup-closed')) toast('Popup band ho gaya. Dobara try karo.', '#ff3b30');
      else if (msg.includes('operation-not-allowed'))
        toast('Google login Firebase me OFF hai. Console me enable karo.', '#ff3b30');
      else toast('Login failed: ' + msg, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="login-page" className="page">
      <div className="login-container">
        <div className="login-logo">
          <img
            src="./logo.png"
            alt="Ludo Royal Club"
            style={{ width: 110, height: 110, borderRadius: 28, objectFit: 'cover', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
          />
          <h1>Ludo Royal Club</h1>
          <p>Play &amp; Win Real Money</p>
        </div>
        <div className="login-form">
          <button className="login-btn google-btn" onClick={onGoogle} disabled={busy}>
            <i className="fab fa-google"></i> {busy ? 'Wait...' : 'Login with Google'}
          </button>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>
            Secure login — sirf Google se
          </p>
        </div>
      </div>
    </div>
  );
}

export async function logoutAll() {
  try {
    await signOut(auth);
  } catch (e) {}
}

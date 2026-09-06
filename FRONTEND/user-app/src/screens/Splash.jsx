import React from 'react';

// Opening splash: logo animation, jab tak auto-login check ho raha hai
export default function Splash() {
  return (
    <div className="splash-screen">
      <img src="./logo.png" alt="Ludo Royal Club" className="splash-logo" />
      <h1 className="splash-title">Ludo Royal Club</h1>
      <div className="splash-loader">
        <span></span><span></span><span></span>
      </div>
    </div>
  );
}

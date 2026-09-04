// LUDO ROYAL CLUB — Firebase Auth (Google login only)
// env.js se config aata hai. Firestore ki zaroorat nahi — sirf Auth use hota hai.
(function () {
    const config = window.FIREBASE_CONFIG || {};
    if (!config.apiKey || !config.projectId) {
        console.error('Firebase config missing! FRONTEND/user/env.js check karo');
        return;
    }
    try {
        if (window.firebase && firebase.apps && firebase.apps.length === 0) {
            firebase.initializeApp({
                apiKey: config.apiKey,
                authDomain: config.authDomain,
                databaseURL: config.databaseURL,
                projectId: config.projectId,
                storageBucket: config.storageBucket,
                messagingSenderId: config.messagingSenderId,
                appId: config.appId
            });
            console.log('Firebase Auth ready:', config.projectId);
        }
    } catch (e) {
        console.error('Firebase init failed:', e);
    }
})();

// LUDO ROYAL CLUB — Firebase Auth (Google login only)
// Config: pehle env.js (window.FIREBASE_CONFIG) se, nahi mila to built-in default.
// (env.js git me push nahi hota, isliye Vercel par fallback kaam aata hai.)
(function () {
    var DEFAULT_CONFIG = {
        apiKey: "AIzaSyCiuhqX-mjBB6eRjljirzIyuJv0wKVRj58",
        authDomain: "ludojoy-ca35c.firebaseapp.com",
        databaseURL: "https://ludojoy-ca35c-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ludojoy-ca35c",
        storageBucket: "ludojoy-ca35c.firebasestorage.app",
        messagingSenderId: "591882703572",
        appId: "1:591882703572:web:862fa9a649e4723c3b6141"
    };
    var config = window.FIREBASE_CONFIG || DEFAULT_CONFIG;
    if (!config.apiKey || !config.projectId) {
        console.error('Firebase config missing!');
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

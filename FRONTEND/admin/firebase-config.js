// LUDO ROYAL CLUB — Firebase (Auth + Firestore)
// Poora backend Firebase hai: Auth (Google login) + Firestore (database + realtime).
// Config yahin built-in hai taaki Vercel par bina env file ke chale.
(function () {
    var CONFIG = {
        apiKey: "AIzaSyCiuhqX-mjBB6eRjljirzIyuJv0wKVRj58",
        authDomain: "ludojoy-ca35c.firebaseapp.com",
        databaseURL: "https://ludojoy-ca35c-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ludojoy-ca35c",
        storageBucket: "ludojoy-ca35c.firebasestorage.app",
        messagingSenderId: "591882703572",
        appId: "1:591882703572:web:862fa9a649e4723c3b6141"
    };

    function fail(msg) { console.error(msg); return false; }

    if (!window.firebase) {
        console.error('Firebase SDK load nahi hua (internet / ad-blocker check karo)');
        window.FirebaseReady = Promise.resolve(false);
        return;
    }
    try {
        if (!firebase.apps || firebase.apps.length === 0) firebase.initializeApp(CONFIG);
        // Firestore handle — user app + admin dono `db` use karte hain
        window.db = firebase.firestore();
        console.log('Firebase ready:', CONFIG.projectId);
        window.FirebaseReady = Promise.resolve(true);
    } catch (e) {
        console.error('Firebase init failed:', e);
        window.FirebaseReady = Promise.resolve(false);
    }
})();

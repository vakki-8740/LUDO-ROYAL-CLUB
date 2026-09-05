// LUDO ROYAL CLUB — Firebase Auth init
// Config FRONTEND me nahi rehti. BACKEND API se aati hai:
//   BACKEND/api/firebase_config.php  ->  api.php?action=getFirebaseConfig
// Har cheez ke liye frontend backend ko call karta hai — config ke liye bhi.
// window.FirebaseReady: Promise (true = Google login ready, false = koi problem)
window.FirebaseReady = (function () {
    function fail(msg) { console.error(msg); return false; }

    if (!window.firebase) {
        console.error('Firebase SDK load nahi hua (internet / ad-blocker check karo)');
        return Promise.resolve(false);
    }
    if (firebase.apps && firebase.apps.length) return Promise.resolve(true);

    // Backend fixed URL (Vercel se relative path nahi chalta)
    var API = 'https://ludoroyalclub.free.nf/api/api.php?action=getFirebaseConfig';

    // Fallback: agar backend down ho to bhi login na ruke (same values as backend file)
    var FALLBACK = {
        apiKey: "AIzaSyCiuhqX-mjBB6eRjljirzIyuJv0wKVRj58",
        authDomain: "ludojoy-ca35c.firebaseapp.com",
        databaseURL: "https://ludojoy-ca35c-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ludojoy-ca35c",
        storageBucket: "ludojoy-ca35c.firebasestorage.app",
        messagingSenderId: "591882703572",
        appId: "1:591882703572:web:862fa9a649e4723c3b6141"
    };

    function initWith(cfg) {
        if (!cfg || !cfg.apiKey || !cfg.projectId) return fail('Backend se Firebase config nahi mila');
        try {
            firebase.initializeApp({
                apiKey: cfg.apiKey,
                authDomain: cfg.authDomain,
                databaseURL: cfg.databaseURL,
                projectId: cfg.projectId,
                storageBucket: cfg.storageBucket,
                messagingSenderId: cfg.messagingSenderId,
                appId: cfg.appId
            });
            console.log('Firebase Auth ready (backend config):', cfg.projectId);
            return true;
        } catch (e) {
            return fail('Firebase init failed: ' + (e && e.message));
        }
    }

    return fetch(API)
        .then(function (r) { return r.json(); })
        .then(function (j) {
            if (j && j.success && j.config) return initWith(j.config);
            console.warn('Backend config fail, fallback use ho raha hai');
            return initWith(FALLBACK);
        })
        .catch(function (e) {
            console.warn('Backend unreachable, fallback config:', e);
            return initWith(FALLBACK);
        });
})();

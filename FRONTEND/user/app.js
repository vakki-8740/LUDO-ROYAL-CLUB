// =====================================================
// LUDO ROYAL CLUB — User App (Firebase: Auth + Firestore)
// Backend = Firebase. Har data kaam seedha Firestore se.
// Collections: users, bets, transactions, mails (sub), kyc_requests, games, settings
// =====================================================

let currentUser = null;   // Firebase Auth user
let currentData = null;   // Firestore users/{uid} data
let allBets = [];
let betsUnsub = null;

const userLogos = [
    'USERS-LOGO/photo_2026-09-02_16-25-41.jpg',
    'USERS-LOGO/photo_2026-09-02_16-26-05.jpg',
    'USERS-LOGO/photo_2026-09-02_16-26-06.jpg',
    'USERS-LOGO/photo_2026-09-02_16-26-07.jpg',
    'USERS-LOGO/photo_2026-09-02_16-26-23.jpg',
    'USERS-LOGO/photo_2026-09-02_16-26-24.jpg',
    'USERS-LOGO/photo_2026-09-02_16-26-26.jpg',
    'USERS-LOGO/photo_2026-09-02_16-26-27.jpg',
    'USERS-LOGO/photo_2026-09-02_16-26-29.jpg'
];

function getRandomLogo() {
    return userLogos[Math.floor(Math.random() * userLogos.length)];
}

// ==================== HELPERS ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
}

function showToast(msg, bg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.background = bg || 'rgba(28,28,30,0.95)';
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

function showLoading() { document.getElementById('loading-overlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }

// Har balance display ek saath refresh (header / wallet / withdraw)
function updateBalanceUI() {
    if (!currentData) return;
    const bal = currentData.balance || 0;
    const h = document.getElementById('header-balance'); if (h) h.textContent = bal;
    const w = document.getElementById('wallet-balance'); if (w) w.textContent = bal;
    const wb = document.getElementById('withdraw-balance'); if (wb) wb.textContent = bal;
}

function generateUserId() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

function todayStr() {
    const d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function copyText(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
}

// Firestore handle (firebase-config.js se)
function fs() {
    if (!window.db) throw new Error('Database taiyaar nahi. Page refresh karo.');
    return window.db;
}

// ==================== AUTH (Google-only) ====================
async function loginWithGoogle() {
    if (!window.firebase || !firebase.auth) {
        showToast('Google login load nahi hua. Internet check karo.', '#ff3b30');
        return;
    }
    if (window.FirebaseReady) {
        const ok = await window.FirebaseReady;
        if (!ok || !window.db) { showToast('Login taiyaar nahi hua. Page refresh karo.', '#ff3b30'); return; }
    }
    showLoading();
    try {
        const cred = await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
        await ensureUserDoc(cred.user);
        afterLogin();
        showToast('Google se login ho gaya!', '#34c759');
    } catch (err) {
        hideLoading();
        const msg = (err && err.message) || 'Login failed';
        if (msg.includes('popup-closed')) showToast('Popup band ho gaya. Dobara try karo.', '#ff3b30');
        else if (msg.includes('operation-not-allowed')) showToast('Google login Firebase me OFF hai. Console me enable karo.', '#ff3b30');
        else showToast('Login failed: ' + msg, '#ff3b30');
    }
}

// users/{uid} lao ya naye user ke liye banao + welcome mail
async function ensureUserDoc(g) {
    const ref = fs().collection('users').doc(g.uid);
    const snap = await ref.get();
    if (snap.exists) {
        currentData = snap.data();
        if (currentData.status === 'blocked') {
            await firebase.auth().signOut();
            currentUser = null; currentData = null;
            throw new Error('Ye account blocked hai. Support se baat karo.');
        }
        // Google photo pehli baar save karo
        if (!currentData.profileLogo && g.photoURL) {
            await ref.update({ profileLogo: g.photoURL });
            currentData.profileLogo = g.photoURL;
        }
        return;
    }
    // Naya user — referral link se aaya ho to pakdo (?ref=CODE)
    let referredBy = '';
    try {
        const q = new URLSearchParams(window.location.search).get('ref');
        if (q) referredBy = String(q).trim().slice(0, 20);
    } catch (e) {}
    const data = {
        name: g.displayName || 'Player',
        email: g.email || '',
        photoURL: g.photoURL || '',
        profileLogo: g.photoURL || getRandomLogo(),
        userId: generateUserId(),
        balance: 0,
        totalDeposit: 0,
        totalWithdraw: 0,
        totalWin: 0,
        status: 'active',
        referralCode: generateUserId(),
        referredBy: referredBy,
        referralCommission: 0,
        kycStatus: 'none',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(data);
    currentData = data;
    // Welcome mail (settings me jo hai, nahi to default)
    let msg = 'Welcome ' + data.name + '! Start playing and winning real money. Good luck!';
    try {
        const w = await fs().collection('settings').doc('welcome').get();
        if (w.exists && w.data().message) msg = w.data().message;
    } catch (e) {}
    await ref.collection('mails').add({
        subject: 'Welcome to Ludo Royal Club! 🎉',
        body: msg,
        from: 'Admin',
        read: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// Reload par Google session se auto-login
if (window.FirebaseReady) {
    window.FirebaseReady.then(function (ok) {
        if (!ok || !window.firebase || !firebase.auth) return;
        firebase.auth().onAuthStateChanged(async (g) => {
            if (g && !currentData) {
                const lp = document.getElementById('login-page');
                if (lp && lp.style.display === 'none') return;
                try {
                    currentUser = g;
                    await ensureUserDoc(g);
                    afterLogin();
                } catch (e) { /* login page par hi raho */ }
            }
        });
    });
} else if (window.firebase && firebase.auth) {
    firebase.auth().onAuthStateChanged(async (g) => {
        if (g && !currentData) {
            try { currentUser = g; await ensureUserDoc(g); afterLogin(); } catch (e) {}
        }
    });
}

function afterLogin() {
    hideLoading();
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('home-page').style.display = 'flex';
    updateUI();
    loadRealtimeData();
}

function logoutUser() {
    currentUser = null;
    currentData = null;
    stopBetsPolling();
    try { if (window.firebase && firebase.auth) firebase.auth().signOut(); } catch (e) {}
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('home-page').style.display = 'none';
}

// ==================== REALTIME BETS ====================
function loadRealtimeData() {
    stopBetsPolling();
    betsUnsub = fs().collection('bets').orderBy('timestamp', 'desc').limit(100)
        .onSnapshot(snap => {
            allBets = [];
            snap.forEach(d => allBets.push({ id: d.id, ...d.data() }));
            renderBets();
        }, err => console.error('Bets load failed:', err));
    // Apna profile live (admin balance change turant dikhe)
    if (currentUser) {
        fs().collection('users').doc(currentUser.uid).onSnapshot(snap => {
            if (snap.exists) { currentData = snap.data(); updateUI(); }
        });
    }
}

function stopBetsPolling() {
    if (betsUnsub) { betsUnsub(); betsUnsub = null; }
}

// ==================== UI UPDATES ====================
function updateUI() {
    if (!currentData) return;
    updateBalanceUI();
    document.getElementById('profile-name').textContent = currentData.name || 'User';
    document.getElementById('profile-id').textContent = 'ID: ' + (currentData.userId || '--');
    document.getElementById('ref-code').textContent = currentData.referralCode || currentData.userId || '------';
    document.getElementById('p-total-deposit').textContent = '₹' + (currentData.totalDeposit || 0);
    document.getElementById('p-total-withdraw').textContent = '₹' + (currentData.totalWithdraw || 0);
    document.getElementById('p-total-win').textContent = '₹' + (currentData.totalWin || 0);
    document.getElementById('w-total-deposit').textContent = currentData.totalDeposit || 0;
    document.getElementById('w-total-withdraw').textContent = currentData.totalWithdraw || 0;
    document.getElementById('w-total-win').textContent = currentData.totalWin || 0;

    const avatarEl = document.getElementById('profile-avatar');
    const logo = currentData.profileLogo || currentData.photoURL;
    if (logo) {
        avatarEl.innerHTML = `<img src="${logo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
        avatarEl.textContent = (currentData.name || '?')[0].toUpperCase();
    }

    renderDepositPageOpts();
    checkKYCStatusHome();
}

function checkKYCStatusHome() {
    if (!currentData) return;
    document.getElementById('kyc-pending-card').style.display =
        currentData.kycStatus === 'approved' ? 'none' : 'flex';
}

// ==================== NAVIGATION ====================
function navigateTo(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
    const navMap = { 'home-section': 0, 'lobby-section': 1, 'wallet-section': 2, 'profile-section': 3 };
    if (navMap[sectionId] !== undefined) document.querySelectorAll('.bn-item')[navMap[sectionId]].classList.add('active');
    document.getElementById('main-content').scrollTop = 0;
}

function goToDeposit() {
    navigateTo('deposit-page-section');
    renderDepositPageOpts();
}

async function renderDepositPageOpts() {
    let amounts = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000];
    try {
        const d = await fs().collection('settings').doc('app').get();
        if (d.exists && d.data().depositOptions) {
            amounts = String(d.data().depositOptions).split(',').map(x => parseInt(x)).filter(x => x > 0);
        }
    } catch (e) {}
    document.getElementById('deposit-page-opts').innerHTML = amounts.map(amt =>
        `<div class="dp-chip" onclick="selectDepositPageChip(this, ${amt})">₹${amt}</div>`
    ).join('');
}

function selectDepositPageChip(el, amt) {
    document.querySelectorAll('.dp-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('custom-deposit-page').value = amt;
}

async function depositMoneyPage() {
    const amt = parseInt(document.getElementById('custom-deposit-page').value);
    let minDep = 100;
    try {
        const d = await fs().collection('settings').doc('app').get();
        if (d.exists && d.data().minDeposit) minDep = parseFloat(d.data().minDeposit);
    } catch (e) {}
    if (!amt || amt < minDep) { showToast('Minimum deposit ₹' + minDep, '#ff3b30'); return; }

    showLoading();
    try {
        const uid = currentUser.uid;
        await fs().collection('transactions').add({
            userId: uid,
            userName: currentData.name || '',
            type: 'Deposit',
            amount: amt,
            status: 'Success',
            date: todayStr(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        await fs().collection('users').doc(uid).update({
            balance: firebase.firestore.FieldValue.increment(amt),
            totalDeposit: firebase.firestore.FieldValue.increment(amt)
        });
        currentData.balance = (currentData.balance || 0) + amt;
        currentData.totalDeposit = (currentData.totalDeposit || 0) + amt;
        updateBalanceUI();
        hideLoading();
        showToast('₹' + amt + ' deposited successfully!', '#34c759');
        document.getElementById('custom-deposit-page').value = '';
        document.querySelectorAll('.dp-chip').forEach(c => c.classList.remove('selected'));
        setTimeout(() => navigateTo('wallet-section'), 1500);
    } catch (e) {
        hideLoading();
        showToast('Error: ' + e.message, '#ff3b30');
    }
}

function goToWithdraw() {
    updateBalanceUI();
    navigateTo('withdraw-page-section');
}

async function withdrawMoneyPage() {
    let minW = 195, maxW = 50000;
    try {
        const d = await fs().collection('settings').doc('app').get();
        if (d.exists) {
            if (d.data().minWithdraw) minW = parseFloat(d.data().minWithdraw);
            if (d.data().maxWithdraw) maxW = parseFloat(d.data().maxWithdraw);
        }
    } catch (e) {}
    const amount = parseFloat(document.getElementById('withdraw-amount-page').value);
    if (!amount || amount < minW) { showToast('Minimum withdraw ₹' + minW, '#ff3b30'); return; }
    if (amount > maxW) { showToast('Maximum withdraw ₹' + maxW, '#ff3b30'); return; }
    if ((currentData.balance || 0) < amount) { showToast('Insufficient balance', '#ff3b30'); return; }
    const holder = document.getElementById('w-holder-page').value.trim();
    const upi = document.getElementById('w-upi-page').value.trim();
    if (!holder) { showToast('Account holder name required', '#ff3b30'); return; }
    if (!upi) { showToast('UPI ID required', '#ff3b30'); return; }

    showLoading();
    try {
        const uid = currentUser.uid;
        // Paisa turant kat ta hai (pending). Admin reject karega to wapas milega.
        await fs().collection('users').doc(uid).update({
            balance: firebase.firestore.FieldValue.increment(-amount)
        });
        await fs().collection('transactions').add({
            userId: uid,
            userName: currentData.name || '',
            type: 'Withdraw',
            amount: amount,
            status: 'Pending',
            details: { method: 'upi', accountHolder: holder, upiId: upi },
            date: todayStr(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        currentData.balance = (currentData.balance || 0) - amount;
        updateBalanceUI();
        hideLoading();
        showToast('Withdrawal request submitted!', '#ff9500');
        document.getElementById('withdraw-amount-page').value = '';
        document.getElementById('w-holder-page').value = '';
        document.getElementById('w-upi-page').value = '';
    } catch (e) {
        hideLoading();
        showToast('Error: ' + e.message, '#ff3b30');
    }
}

function goToHistory() {
    navigateTo('history-page-section');
    loadHistoryPage();
}

function toggleMenu() {
    document.getElementById('side-menu').classList.toggle('open');
    document.getElementById('menu-overlay').style.display = document.getElementById('side-menu').classList.contains('open') ? 'block' : 'none';
}

function openPage(type) {
    const titles = { privacy: 'Privacy Policy', terms: 'Terms & Conditions', about: 'About Us', gst: 'GST', rules: 'Game Rules' };
    document.getElementById('pages-title').textContent = titles[type] || 'Page';
    document.getElementById('main-content').scrollTop = 0;
    const localContent = window.PAGE_CONTENT && window.PAGE_CONTENT[type];
    document.getElementById('pages-content').innerHTML = localContent ||
        '<p style="text-align:center;color:var(--text-muted);padding:20px;">Content not available.</p>';
    navigateTo('pages-section');
}

// ==================== RULES POPUP ====================
function openRulesPopup() {
    document.getElementById('rules-overlay').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeRulesPopup() {
    document.getElementById('rules-overlay').classList.remove('show');
    document.body.style.overflow = '';
}

// ==================== BETS ====================
let previousBetIds = [];

function betCardOpen(b, isNew) {
    const canPlay = b.creatorId !== (currentUser && currentUser.uid);
    const creatorLogo = b.creatorLogo || getRandomLogo();
    return `
        <div class="bet-card-new ${isNew ? 'bet-slide-in' : ''}">
            <div class="open-bet-top">
                <span class="open-bet-label">Challenge set by</span>
                <span class="open-bet-amount">₹${b.amount || 0}</span>
            </div>
            <div class="open-bet-bottom">
                <div class="open-bet-user">
                    <div class="open-bet-avatar"><img src="${creatorLogo}" alt=""></div>
                    <div class="open-bet-name">${b.creatorName || 'Player'}</div>
                </div>
                ${canPlay ? `<button class="open-bet-play" onclick="joinBet('${b.id}','${b.amount}')">Play</button>` : ''}
            </div>
        </div>`;
}

function betCardPlaying(b) {
    const creatorLogo = b.creatorLogo || getRandomLogo();
    const joinerLogo = b.joinerLogo || getRandomLogo();
    return `
        <div class="bet-card-new playing">
            <div class="bet-card-top">
                <div class="bet-user">
                    <div class="bet-user-avatar"><img src="${creatorLogo}" alt=""></div>
                    <div class="bet-user-name">${b.creatorName || 'Player'}</div>
                </div>
                <div class="bet-vs-center">
                    <img src="icons/VS ICON/photo_2026-09-02_16-29-08-removebg-preview.png" alt="VS" class="bet-vs-img">
                    <div class="bet-amount-green">+₹${b.amount || 0}</div>
                </div>
                <div class="bet-user">
                    <div class="bet-user-avatar"><img src="${joinerLogo}" alt=""></div>
                    <div class="bet-user-name">${b.joinerName || 'Player'}</div>
                </div>
            </div>
            <div class="bet-status-badge ${b.status}">${b.status === 'playing' ? 'LIVE NOW' : 'COMPLETED'}</div>
        </div>`;
}

function renderBets() {
    const openContainer = document.getElementById('open-bets-container');
    const playingContainer = document.getElementById('playing-bets-container');
    const openBets = allBets.filter(b => b.status === 'waiting');
    const playingBets = allBets.filter(b => b.status === 'playing' || b.status === 'completed');

    const ids = allBets.map(b => b.id);
    const isNewBet = previousBetIds.length > 0 && ids.some(id => !previousBetIds.includes(id));
    previousBetIds = [...ids];

    openContainer.innerHTML = openBets.length
        ? openBets.map((b, i) => betCardOpen(b, isNewBet && i === 0)).join('')
        : '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No open battles</div>';
    playingContainer.innerHTML = playingBets.length
        ? playingBets.map(betCardPlaying).join('')
        : '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No active games</div>';
}

function filterBets() {
    const q = document.getElementById('search-bets').value.toLowerCase().trim();
    document.getElementById('search-clear').style.display = q ? 'block' : 'none';
    const openContainer = document.getElementById('open-bets-container');
    const playingContainer = document.getElementById('playing-bets-container');
    const filtered = q ? allBets.filter(b =>
        (b.creatorName || '').toLowerCase().includes(q) ||
        (b.joinerName || '').toLowerCase().includes(q) ||
        String(b.amount || '').includes(q) ||
        (b.status || '').toLowerCase().includes(q) ||
        (b.roomCode || '').toLowerCase().includes(q)) : allBets;
    const openBets = filtered.filter(b => b.status === 'waiting');
    const playingBets = filtered.filter(b => b.status === 'playing' || b.status === 'completed');
    openContainer.innerHTML = openBets.length
        ? openBets.map(b => betCardOpen(b, false)).join('')
        : '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No open battles found</div>';
    playingContainer.innerHTML = playingBets.length
        ? playingBets.map(betCardPlaying).join('')
        : '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No active games found</div>';
}

function clearSearch() {
    document.getElementById('search-bets').value = '';
    document.getElementById('search-clear').style.display = 'none';
    renderBets();
}

function showCreateBet() {
    if (!currentData) return;
    if ((currentData.balance || 0) <= 0) { showToast('Add money to wallet first!', '#ff9500'); return; }
    document.getElementById('bet-amount').value = '';
    document.getElementById('bet-room').value = '';
    document.getElementById('create-bet-overlay').style.display = 'flex';
}

function closePopup(e, id) {
    if (e.target === e.currentTarget) document.getElementById(id).style.display = 'none';
}

async function submitBet() {
    const amount = parseFloat(document.getElementById('bet-amount').value);
    const roomCode = document.getElementById('bet-room').value.trim().toUpperCase();
    if (!amount || amount <= 0) { showToast('Enter valid amount', '#ff3b30'); return; }
    if (!roomCode) { showToast('Enter room code', '#ff3b30'); return; }
    if ((currentData.balance || 0) < amount) { showToast('Insufficient balance!', '#ff3b30'); return; }

    showLoading();
    try {
        const uid = currentUser.uid;
        await fs().collection('users').doc(uid).update({
            balance: firebase.firestore.FieldValue.increment(-amount)
        });
        await fs().collection('bets').add({
            creatorId: uid,
            creatorName: currentData.name || 'Player',
            creatorLogo: currentData.profileLogo || getRandomLogo(),
            amount: amount,
            roomCode: roomCode,
            status: 'waiting',
            joinerId: '',
            joinerName: '',
            joinerLogo: '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        currentData.balance = (currentData.balance || 0) - amount;
        updateBalanceUI();
        hideLoading();
        showToast('Bet created! Waiting for opponent...', '#34c759');
        document.getElementById('create-bet-overlay').style.display = 'none';
        navigateTo('lobby-section');
    } catch (e) {
        hideLoading();
        showToast('Error: ' + e.message, '#ff3b30');
    }
}

async function joinBet(betId, amount) {
    amount = parseFloat(amount);
    if (!amount || amount <= 0) { showToast('Invalid bet amount!', '#ff3b30'); return; }
    if ((currentData.balance || 0) < amount) { showToast('Insufficient balance!', '#ff3b30'); return; }

    showLoading();
    try {
        const uid = currentUser.uid;
        const betRef = fs().collection('bets').doc(betId);
        const userRef = fs().collection('users').doc(uid);
        // Transaction: do player ek hi bet join na kar payein + balance safe
        const roomCode = await fs().runTransaction(async (tx) => {
            const b = await tx.get(betRef);
            if (!b.exists) throw new Error('Bet not found');
            const d = b.data();
            if (d.status !== 'waiting') throw new Error('Bet already taken');
            if (d.creatorId === uid) throw new Error("You can't join your own bet");
            const u = await tx.get(userRef);
            if ((u.data().balance || 0) < d.amount) throw new Error('Insufficient balance!');
            tx.update(userRef, { balance: firebase.firestore.FieldValue.increment(-d.amount) });
            tx.update(betRef, {
                status: 'playing',
                joinerId: uid,
                joinerName: currentData.name || 'Player',
                joinerLogo: currentData.profileLogo || getRandomLogo()
            });
            return d.roomCode;
        });
        currentData.balance = (currentData.balance || 0) - amount;
        updateBalanceUI();
        hideLoading();
        showToast(`Room Code: ${roomCode} (copied!)`, '#007aff');
        copyText(roomCode);
    } catch (e) {
        hideLoading();
        showToast('Error: ' + e.message, '#ff3b30');
    }
}

// Refresh button (realtime pehle se live hai — ye manual reload hai)
function loadSampleBets() {
    renderBets();
    showToast('Bets refreshed!', '#34c759');
}

// ==================== HISTORY ====================
function historyDocToItem(d) {
    const t = d.data();
    return { id: d.id, type: t.type || '', amount: t.amount || 0, status: t.status || '', date: t.date || '' };
}

async function loadHistoryPage() {
    try {
        const snap = await fs().collection('transactions')
            .where('userId', '==', currentUser.uid)
            .orderBy('timestamp', 'desc').limit(50).get();
        const items = [];
        snap.forEach(d => items.push(historyDocToItem(d)));
        renderHistoryPage(items, 'all');
    } catch (e) { console.error('History page load failed:', e); }
}

async function filterHistoryPage(type, el) {
    document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    try {
        const snap = await fs().collection('transactions')
            .where('userId', '==', currentUser.uid)
            .orderBy('timestamp', 'desc').limit(50).get();
        const items = [];
        snap.forEach(d => items.push(historyDocToItem(d)));
        renderHistoryPage(items, type);
    } catch (e) { console.error('History filter failed:', e); }
}

function renderHistoryPage(items, filter) {
    const container = document.getElementById('history-page-list');
    const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);
    if (!filtered.length) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">No transactions found</div>';
        return;
    }
    container.innerHTML = filtered.map(item => {
        const isDeposit = item.type === 'Deposit';
        return `
            <div class="history-item">
                <div class="hi-left">
                    <div class="hi-icon" style="background:${isDeposit ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)'};color:${isDeposit ? 'var(--success)' : 'var(--danger)'}">
                        <i class="fas ${isDeposit ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                    </div>
                    <div>
                        <div class="hi-detail">${item.type}</div>
                        <div class="hi-date">${item.date || ''}</div>
                    </div>
                </div>
                <div>
                    <div class="hi-amount" style="color:${isDeposit ? 'var(--success)' : 'var(--danger)'}">${isDeposit ? '+' : '-'}₹${item.amount || 0}</div>
                    <div style="font-size:11px;color:${item.status === 'Success' ? 'var(--success)' : item.status === 'Pending' ? 'var(--warning)' : 'var(--danger)'};text-align:right;">${item.status || ''}</div>
                </div>
            </div>`;
    }).join('');
}

// ==================== REFERRAL ====================
function myRefCode() {
    return (currentData && (currentData.referralCode || currentData.userId)) || '';
}

function copyReferral() {
    copyText(myRefCode());
    showToast('Referral code copied!', '#34c759');
    loadReferralUsers();
}

function shareWhatsApp() {
    const msg = encodeURIComponent(`Join Ludo Royal Club and win real money! Use my referral code: ${myRefCode()}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function shareTelegram() {
    const msg = encodeURIComponent(`Join Ludo Royal Club and win real money! Use my referral code: ${myRefCode()}`);
    window.open(`https://t.me/share/url?url=&text=${msg}`, '_blank');
}

async function loadReferralUsers() {
    const box = document.getElementById('referral-users-list');
    if (!box) return;
    try {
        const code = myRefCode();
        if (!code) { box.innerHTML = ''; return; }
        const snap = await fs().collection('users').where('referredBy', '==', code).limit(50).get();
        if (snap.empty) {
            box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No referrals yet — share your code!</div>';
            return;
        }
        let html = '';
        snap.forEach(d => {
            const u = d.data();
            html += `<div class="history-item"><div class="hi-left"><div class="hi-icon" style="background:rgba(0,122,255,0.12);color:var(--primary);"><i class="fas fa-user"></i></div><div><div class="hi-detail">${u.name || 'Player'}</div><div class="hi-date">ID: ${u.userId || '--'}</div></div></div></div>`;
        });
        box.innerHTML = html;
    } catch (e) { console.error('Referrals load failed:', e); }
}

// Referral section khulne par list load karo
document.querySelectorAll('.section').forEach(s => {
    new MutationObserver(() => {
        if (s.id === 'referral-section' && s.classList.contains('active')) loadReferralUsers();
        if (s.id === 'support-section' && s.classList.contains('active')) loadSupport();
        if (s.id === 'mail-section' && s.classList.contains('active')) loadMails();
    }).observe(s, { attributes: true, attributeFilter: ['class'] });
});

// ==================== PROFILE ====================
async function editProfileName() {
    const newName = prompt('Enter new name:', (currentData && currentData.name) || '');
    if (newName && newName.trim()) {
        try {
            await fs().collection('users').doc(currentUser.uid).update({ name: newName.trim() });
            currentData.name = newName.trim();
            document.getElementById('profile-name').textContent = currentData.name;
            showToast('Name updated!', '#34c759');
        } catch (e) {
            showToast('Error: ' + e.message, '#ff3b30');
        }
    }
}

// ==================== MAIL ====================
async function loadMails() {
    const container = document.getElementById('mails-container');
    try {
        const snap = await fs().collection('users').doc(currentUser.uid)
            .collection('mails').orderBy('timestamp', 'desc').limit(50).get();
        if (snap.empty) {
            container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:14px;">No mails yet</div>';
            return;
        }
        let html = '';
        snap.forEach(d => {
            const m = d.data();
            html += `
            <div class="mail-item" onclick="markMailRead('${d.id}', this)" style="${m.read ? 'opacity:0.7;' : ''}">
                <div class="mail-subject">${m.subject || 'No Subject'}${m.read ? '' : ' •'}</div>
                <div class="mail-body">${m.body || ''}</div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:14px;">Could not load mails</div>';
    }
}

async function markMailRead(mailId, el) {
    try {
        await fs().collection('users').doc(currentUser.uid).collection('mails').doc(mailId).update({ read: true });
        if (el) el.style.opacity = '0.7';
    } catch (e) { /* non-critical */ }
}

// ==================== SUPPORT ====================
async function loadSupport() {
    const container = document.getElementById('support-content');
    try {
        const d = await fs().collection('settings').doc('support').get();
        const s = d.exists ? d.data() : {};
        if (s && (s.whatsapp || s.telegram || s.chat)) {
            container.innerHTML = `
                ${s.logo ? `<img src="${s.logo}" style="width:80px;height:80px;border-radius:50%;margin-bottom:15px;object-fit:cover;">` : '<i class="fas fa-headset" style="font-size:60px;color:var(--primary);margin-bottom:15px;"></i>'}
                <h3 style="margin-bottom:20px;">Contact Support Team</h3>
                ${s.whatsapp ? `<a href="${s.whatsapp}" target="_blank" class="btn" style="background:#25D366;"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
                ${s.telegram ? `<a href="${s.telegram}" target="_blank" class="btn" style="background:#0088cc;"><i class="fab fa-telegram"></i> Telegram</a>` : ''}
                ${s.chat ? `<a href="${s.chat}" target="_blank" class="btn" style="background:var(--primary);"><i class="fas fa-comment"></i> Live Chat</a>` : ''}`;
        } else {
            container.innerHTML = '<p style="color:var(--text-muted);">Support information not available.</p>';
        }
    } catch (e) {
        container.innerHTML = '<p style="color:var(--text-muted);">Support information not available.</p>';
    }
}

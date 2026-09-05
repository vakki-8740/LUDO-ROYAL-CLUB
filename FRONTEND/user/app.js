let currentUser = null;
let allBets = [];
let allUsers = [];
let selectedDeposit = 0;

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
    const index = Math.floor(Math.random() * userLogos.length);
    return userLogos[index];
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

// FIX: Central helper to refresh every balance display after wallet changes,
// so the header / wallet / deposit / withdraw screens never show a stale amount.
function updateBalanceUI() {
    if (!currentUser) return;
    const bal = currentUser.balance || 0;
    const h = document.getElementById('header-balance'); if (h) h.textContent = bal;
    const w = document.getElementById('wallet-balance'); if (w) w.textContent = bal;
    const d = document.getElementById('deposit-balance'); if (d) d.textContent = bal;
    const wb = document.getElementById('withdraw-balance'); if (wb) wb.textContent = bal;
}

function generateUserId() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ==================== PHP API ====================
// Backend: https://ludoroyalclub.free.nf (PHP host).
// Vercel (frontend) se relative path nahi chalta, isliye absolute URL.
const API_URL = 'https://ludoroyalclub.free.nf/api/api.php';
let betsTimer = null;

async function apiCall(action, data = {}) {
    const res = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
        method: 'POST',
        credentials: 'include', // InfinityFree bot-check cookie bhejo (warna HTML aata hai, JSON nahi)
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    let json;
    try { json = await res.json(); }
    catch (e) { throw new Error('Server error (HTTP ' + res.status + ')'); }
    if (!res.ok || json.success === false) throw new Error(json.error || 'Request failed');
    return json;
}

// ==================== AUTH (Google-only) ====================
// Flow: Firebase Google popup -> Google profile -> PHP backend login/auto-register.
// Firebase config BACKEND API se aati hai (firebase-config.js -> window.FirebaseReady).
async function loginWithGoogle() {
    if (!window.firebase || !firebase.auth) {
        showToast('Google login load nahi hua. Internet check karo.', '#ff3b30');
        return;
    }
    // Backend se Firebase config aane ka wait karo
    if (window.FirebaseReady) {
        const ok = await window.FirebaseReady;
        if (!ok) { showToast('Login taiyaar nahi hua. Page refresh karo.', '#ff3b30'); return; }
    }
    showLoading();
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const cred = await firebase.auth().signInWithPopup(provider);
        const g = cred.user || {};
        const res = await apiCall('login', {
            google_uid: g.uid || '',
            email: g.email || '',
            name: g.displayName || 'Player',
            profileLogo: g.photoURL || getRandomLogo()
        });
        currentUser = res.user;
        afterLogin();
        showToast('Google se login ho gaya!', '#34c759');
    } catch (err) {
        hideLoading();
        const msg = (err && err.message) || 'Login failed';
        if (msg.includes('popup-closed')) showToast('Popup band ho gaya. Dobara try karo.', '#ff3b30');
        else if (msg.includes('operation-not-allowed')) showToast('Google login Firebase me OFF hai. Console me enable karo.', '#ff3b30');
        else if (msg.includes('auth/')) showToast('Google error: ' + msg, '#ff3b30');
        else showToast('Login failed: ' + msg, '#ff3b30');
    }
}

// Page reload par: Firebase config ready hone ke baad, agar Google session
// hai to backend se auto-login.
if (window.FirebaseReady) {
    window.FirebaseReady.then(function (ok) {
        if (!ok || !window.firebase || !firebase.auth) return;
        firebase.auth().onAuthStateChanged(async (g) => {
            if (g && !currentUser) {
                const lp = document.getElementById('login-page');
                if (lp && lp.style.display === 'none') return;
                try {
                    const res = await apiCall('login', {
                        google_uid: g.uid || '',
                        email: g.email || '',
                        name: g.displayName || 'Player',
                        profileLogo: g.photoURL || getRandomLogo()
                    });
                    currentUser = res.user;
                    afterLogin();
                } catch (e) { /* login page par hi raho */ }
            }
        });
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
    stopBetsPolling();
    try { if (window.firebase && firebase.auth) firebase.auth().signOut(); } catch (e) {}
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('home-page').style.display = 'none';
}

// ==================== REAL-TIME DATA (API polling) ====================
// Firebase onSnapshot is gone — bets are now refreshed from the PHP API every 5s.
async function loadRealtimeData() {
    await refreshBets();
    if (betsTimer) clearInterval(betsTimer);
    betsTimer = setInterval(refreshBets, 5000);
}

async function refreshBets() {
    try {
        const res = await apiCall('getBets');
        allBets = res.bets;
        renderBets();
    } catch (e) {
        console.error('Bets load failed:', e);
    }
}

function stopBetsPolling() {
    if (betsTimer) { clearInterval(betsTimer); betsTimer = null; }
}

// ==================== UI UPDATES ====================
function updateUI() {
    if (!currentUser) return;
    document.getElementById('header-balance').textContent = currentUser.balance || 0;
    document.getElementById('wallet-balance').textContent = currentUser.balance || 0;
    document.getElementById('profile-name').textContent = currentUser.name || 'User';
    document.getElementById('profile-id').textContent = 'ID: ' + (currentUser.userId || currentUser.id);
    document.getElementById('ref-code').textContent = currentUser.referralCode || currentUser.userId;
    document.getElementById('p-total-deposit').textContent = '₹' + (currentUser.totalDeposit || 0);
    document.getElementById('p-total-withdraw').textContent = '₹' + (currentUser.totalWithdraw || 0);
    document.getElementById('p-total-win').textContent = '₹' + (currentUser.totalWin || 0);
    document.getElementById('w-total-deposit').textContent = currentUser.totalDeposit || 0;
    document.getElementById('w-total-withdraw').textContent = currentUser.totalWithdraw || 0;
    document.getElementById('w-total-win').textContent = currentUser.totalWin || 0;
    if (document.getElementById('deposit-balance')) document.getElementById('deposit-balance').textContent = currentUser.balance || 0;
    if (document.getElementById('withdraw-balance')) document.getElementById('withdraw-balance').textContent = currentUser.balance || 0;
    
    const avatarEl = document.getElementById('profile-avatar');
    if (currentUser.profileLogo) {
        avatarEl.innerHTML = `<img src="${currentUser.profileLogo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else if (currentUser.photoURL) {
        avatarEl.innerHTML = `<img src="${currentUser.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
        avatarEl.textContent = (currentUser.name || '?')[0].toUpperCase();
    }
    
    // FIX: loadDepositOptions() did not exist anywhere — calling it threw a TypeError
    // that CRASHED updateUI(), so checkKYCStatusHome() (KYC popup) and loadRealtimeData()
    // (bets/demo bets) never ran. Replaced with the real renderDepositPageOpts() function.
    renderDepositPageOpts();
    // FIX: removed checkKYCStatus() call — this function never existed anywhere,
    // so it threw an error and broke checkKYCStatusHome() below it
    checkKYCStatusHome();
}

function checkKYCStatusHome() {
    if (!currentUser) return;
    const kycCard = document.getElementById('kyc-pending-card');
    // MySQL: KYC status ab users table ke kyc_status column se aata hai
    if (currentUser.kycStatus === 'approved') {
        kycCard.style.display = 'none';
    } else {
        kycCard.style.display = 'flex';
    }
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

function renderDepositPageOpts() {
    const amounts = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000];
    const container = document.getElementById('deposit-page-opts');
    container.innerHTML = amounts.map(amt =>
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
    // FIX: 'error' was not a valid background color (toast became invisible) — use the danger red
    if (!amt || amt < 100) { showToast('Minimum deposit ₹100', '#ff3b30'); return; }

    showLoading();
    try {
        // PHP API: atomic SQL transaction — balance + totalDeposit + 'Success' transaction record
        const res = await apiCall('deposit', { user_id: currentUser.id, amount: amt });
        currentUser.balance = res.balance;
        currentUser.totalDeposit = res.totalDeposit;
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
    document.getElementById('withdraw-balance').textContent = currentUser.balance || 0;
    navigateTo('withdraw-page-section');
}
// REMOVED: showWithdrawNotice() / forceCloseWithdrawNotice() — the separate Notice popup
// was removed. The withdrawal timing + limits are shown in the notice card on the page.

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
    const pagesEl = document.getElementById('pages-content');
    document.getElementById('main-content').scrollTop = 0;
    // Page texts ab local pages-content.js se aate hain (PREVECY-TXTS.txt se formatted karke( —
    // isse har baar DB ban na padta, aur pages hamesha dikhte hain.
    const localContent = window.PAGE_CONTENT && window.PAGE_CONTENT[type];
    if (localContent) {
        pagesEl.innerHTML = localContent;
        navigateTo('pages-section');
        return;
    }
    // Fallback: DB settings se (agar admin ne kuch custom set kiya ho to)
    apiCall('getSettings', { key: 'app' }).then(res => {
        const d = res.settings || {};
        const content = d[type] || '<p style="text-align:center;color:var(--text-muted);padding:20px;">Content not available.</p>';
        pagesEl.innerHTML = content.replace(/\n/g, '<br>');
    }).catch(() => {
        pagesEl.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Content not available.</p>';
    });
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

function renderBets() {
    const openContainer = document.getElementById('open-bets-container');
    const playingContainer = document.getElementById('playing-bets-container');
    
    const openBets = allBets.filter(b => b.status === 'waiting');
    const playingBets = allBets.filter(b => b.status === 'playing' || b.status === 'completed');
    
    const currentBetIds = allBets.map(b => b.id);
    const isNewBet = previousBetIds.length > 0 && currentBetIds.some(id => !previousBetIds.includes(id));
    previousBetIds = [...currentBetIds];
    
    if (!openBets.length) {
        openContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No open battles</div>';
    } else {
        openContainer.innerHTML = openBets.map((b, index) => {
            const isCreator = b.creatorId === currentUser.id || b.creatorId === currentUser.userId;
            const canPlay = !isCreator;
            const creatorLogo = b.creatorLogo || getRandomLogo();
            const isNew = isNewBet && index === 0;
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
                </div>
            `;
        }).join('');
    }
    
    if (!playingBets.length) {
        playingContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No active games</div>';
    } else {
        playingContainer.innerHTML = playingBets.map(b => {
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
                </div>
            `;
        }).join('');
    }
}

function filterBets() {
    const q = document.getElementById('search-bets').value.toLowerCase().trim();
    const clearBtn = document.getElementById('search-clear');
    clearBtn.style.display = q ? 'block' : 'none';
    
    let filtered = allBets;
    if (q) {
        filtered = allBets.filter(b => {
            const creator = (b.creatorName || '').toLowerCase();
            const joiner = (b.joinerName || '').toLowerCase();
            const amount = String(b.amount || '');
            const status = (b.status || '').toLowerCase();
            const room = (b.roomCode || '').toLowerCase();
            return creator.includes(q) || joiner.includes(q) || amount.includes(q) || status.includes(q) || room.includes(q);
        });
    }
    
    const openContainer = document.getElementById('open-bets-container');
    const playingContainer = document.getElementById('playing-bets-container');
    
    const openBets = filtered.filter(b => b.status === 'waiting');
    const playingBets = filtered.filter(b => b.status === 'playing' || b.status === 'completed');
    
    if (!openBets.length) {
        openContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No open battles found</div>';
    } else {
        openContainer.innerHTML = openBets.map(b => {
            const isCreator = b.creatorId === currentUser.id || b.creatorId === currentUser.userId;
            const canPlay = !isCreator;
            const creatorLogo = b.creatorLogo || getRandomLogo();
            return `
                <div class="bet-card-new">
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
                </div>
            `;
        }).join('');
    }
    
    if (!playingBets.length) {
        playingContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No active games found</div>';
    } else {
        playingContainer.innerHTML = playingBets.map(b => {
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
                </div>
            `;
        }).join('');
    }
}

function clearSearch() {
    document.getElementById('search-bets').value = '';
    document.getElementById('search-clear').style.display = 'none';
    filterBets();
}

function showCreateBet() {
    if (!currentUser) return;
    if ((currentUser.balance || 0) <= 0) { showToast('Add money to wallet first!', '#ff9500'); return; }
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
    if ((currentUser.balance || 0) < amount) { showToast('Insufficient balance!', '#ff3b30'); return; }

    showLoading();
    try {
        // PHP API: atomic SQL transaction (row lock) — balance deduct + bet insert together
        const res = await apiCall('createBet', {
            user_id: currentUser.id, amount: amount, room_code: roomCode, creatorLogo: getRandomLogo()
        });
        currentUser.balance = res.balance;
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
    if ((currentUser.balance || 0) < amount) { showToast('Insufficient balance!', '#ff3b30'); return; }

    showLoading();
    try {
        // PHP API: SELECT ... FOR UPDATE row locking — same race-condition safety
        // (two players can never join the same bet)
        const res = await apiCall('joinBet', {
            user_id: currentUser.id, bet_id: betId, joiner_logo: getRandomLogo(), amount: amount
        });
        currentUser.balance = res.balance;
        updateBalanceUI();
        hideLoading();
        showToast(`Room Code: ${res.roomCode} (copied!)`, '#007aff');
        copyText(res.roomCode);
    } catch (e) {
        hideLoading();
        showToast('Error: ' + e.message, '#ff3b30');
    }
}

function copyText(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => {});
    }
}

// ==================== WALLET ====================

// ==================== DEPOSIT PAGE ====================
let selectedDepositPage = 0;

// ==================== WITHDRAW PAGE ====================
// FIX: removed checkKYCStatusPage() / toggleWithdrawFieldsPage() / submitKYFPage() —
// the KYC gate was removed from the withdraw page (per requirement the form now only
// asks for Holder Name, UPI ID and Amount), so these functions are no longer needed.
async function withdrawMoneyPage() {
    const amount = parseFloat(document.getElementById('withdraw-amount-page').value);
    // FIX: withdrawal limits updated — minimum ₹195, maximum ₹50,000
    if (!amount || amount < 195) { showToast('Minimum withdraw ₹195', '#ff3b30'); return; }
    if (amount > 50000) { showToast('Maximum withdraw ₹50,000', '#ff3b30'); return; }
    if ((currentUser.balance || 0) < amount) { showToast('Insufficient balance', '#ff3b30'); return; }
    // FIX: simplified withdraw form — only Holder Name + UPI ID + Amount (per requirement)
    const holder = document.getElementById('w-holder-page').value.trim();
    const upi = document.getElementById('w-upi-page').value.trim();
    if (!holder) { showToast('Account holder name required', '#ff3b30'); return; }
    if (!upi) { showToast('UPI ID required', '#ff3b30'); return; }

    showLoading();
    try {
        // PHP API: atomic SQL transaction — balance deducts IMMEDIATELY, transaction
        // saved with status 'Pending'. Admin rejection refunds the amount.
        const res = await apiCall('withdraw', {
            user_id: currentUser.id, amount: amount, holder: holder, upi: upi
        });
        currentUser.balance = res.balance;
        updateBalanceUI();
        hideLoading();
        showToast('Withdrawal request submitted!', '#ff9500');
        document.getElementById('withdraw-amount-page').value = '';
    } catch (e) {
        hideLoading();
        showToast('Error: ' + e.message, '#ff3b30');
    }
}

// ==================== HISTORY ====================
// Real entries only — every deposit ('Success') and every withdrawal request
// ('Pending' → 'Success'/'Rejected' after admin action) is saved by the PHP API.
async function loadHistory() {
    try {
        const res = await apiCall('getTransactions', { user_id: currentUser.id });
        renderHistory(res.transactions, 'all');
    } catch (e) { console.error('History load failed:', e); }
}

async function loadHistoryPage() {
    try {
        const res = await apiCall('getTransactions', { user_id: currentUser.id });
        renderHistoryPage(res.transactions, 'all');
    } catch (e) { console.error('History page load failed:', e); }
}

async function filterHistoryPage(type, el) {
    document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    try {
        const res = await apiCall('getTransactions', { user_id: currentUser.id });
        renderHistoryPage(res.transactions, type);
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
            </div>
        `;
    }).join('');
}

function filterHistory(type, el) {
    document.querySelectorAll('.hf').forEach(h => h.classList.remove('active'));
    el.classList.add('active');
    apiCall('getTransactions', { user_id: currentUser.id }).then(res => {
        renderHistory(res.transactions, type);
    }).catch(() => {});
}

function renderHistory(items, filter) {
    const container = document.getElementById('history-list');
    const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);
    if (!filtered.length) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:14px;">No history found</div>';
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
            </div>
        `;
    }).join('');
}

// ==================== REFERRAL ====================
function copyReferral() {
    const code = currentUser.referralCode || currentUser.userId;
    copyText(code);
    showToast('Referral code copied!', '#34c759');
}

function shareWhatsApp() {
    const code = currentUser.referralCode || currentUser.userId;
    const msg = encodeURIComponent(`Join Ludo Royal Club and win real money! Use my referral code: ${code}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function shareTelegram() {
    const code = currentUser.referralCode || currentUser.userId;
    const msg = encodeURIComponent(`Join Ludo Royal Club and win real money! Use my referral code: ${code}`);
    window.open(`https://t.me/share/url?url=&text=${msg}`, '_blank');
}

// ==================== PROFILE ====================
async function editProfileName() {
    const newName = prompt('Enter new name:', currentUser.name || '');
    if (newName && newName.trim()) {
        try {
            const res = await apiCall('updateName', { user_id: currentUser.id, name: newName.trim() });
            // update local state + profile UI so the new name shows immediately
            currentUser.name = res.user.name;
            const pn = document.getElementById('profile-name');
            if (pn) pn.textContent = currentUser.name;
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
        const res = await apiCall('getMails', { user_id: currentUser.id });
        const mails = res.mails;
        if (!mails.length) {
            container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:14px;">No mails yet</div>';
            return;
        }
        container.innerHTML = mails.map(m => `
            <div class="mail-item" onclick="markMailRead('${m.id}')">
                <div class="mail-subject">${m.subject || 'No Subject'}</div>
                <div class="mail-body">${m.body || ''}</div>
                <div class="mail-date">${m.date || ''}</div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:14px;">Could not load mails</div>';
    }
}

async function markMailRead(mailId) {
    try { await apiCall('markMailRead', { user_id: currentUser.id, mail_id: mailId }); }
    catch (e) { /* non-critical */ }
}

// ==================== SUPPORT ====================
async function loadSupport() {
    const container = document.getElementById('support-content');
    try {
        const res = await apiCall('getSettings', { key: 'support' });
        const d = res.settings || {};
        if (Object.keys(d).length) {
            container.innerHTML = `
                ${d.logo ? `<img src="${d.logo}" style="width:80px;height:80px;border-radius:50%;margin-bottom:15px;object-fit:cover;">` : '<i class="fas fa-headset" style="font-size:60px;color:var(--primary);margin-bottom:15px;"></i>'}
                <h3 style="margin-bottom:20px;">Contact Support Team</h3>
                ${d.whatsapp ? `<a href="${d.whatsapp}" target="_blank" class="btn" style="background:#25D366;"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
                ${d.telegram ? `<a href="${d.telegram}" target="_blank" class="btn" style="background:#0088cc;"><i class="fab fa-telegram"></i> Telegram</a>` : ''}
                ${d.chat ? `<a href="${d.chat}" target="_blank" class="btn" style="background:var(--primary);"><i class="fas fa-comment"></i> Live Chat</a>` : ''}
            `;
        } else {
            container.innerHTML = '<p style="color:var(--text-muted);">Support information not available.</p>';
        }
    } catch (e) {
        container.innerHTML = '<p style="color:var(--text-muted);">Support information not available.</p>';
    }
}

// ==================== INIT ====================
// Google session restore AUTH section me (onAuthStateChanged) hota hai.
// Yahan sirf support/mails observer rehta hai.

// Load support / mails when their sections are shown
const supportObserver = new MutationObserver(() => {
    const supportSection = document.getElementById('support-section');
    if (supportSection.classList.contains('active')) {
        loadSupport();
    }
    const mailSection = document.getElementById('mail-section');
    if (mailSection.classList.contains('active')) {
        loadMails();
    }
});
document.querySelectorAll('.section').forEach(s => {
    supportObserver.observe(s, { attributes: true, attributeFilter: ['class'] });
});

// =====================================================
// LUDO ROYAL CLUB — Admin Panel (100% Firebase, HTML)
// Login = username + password. Password Firebase Auth me secure rehta hai
// (code me nahi — GitHub public hai). Username sirf vakkiadmin chalega.
// CONSOLE SETUP (ek baar): Authentication > Sign-in method > Email/Password ON,
// phir Users > Add user > email = ADMIN_EMAILS wala, password = vakki8740.
// TODO: ADMIN_EMAILS me apna Gmail dalo + firestore.rules me wahi email.
// =====================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
}

// TODO: yahan apna Gmail likho (rules file me bhi same email hona chahiye)
const ADMIN_EMAILS = ['ludoroyalclub46@gmail.com'];
const ADMIN_USERNAME = 'vakki8740';

let allUsers = [], allTrx = [], allBets = [], allGames = [];
let unsubs = [];

function showToast(msg, bg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.background = bg || 'rgba(28,28,30,0.95)'; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

function loading(btn, state) {
    if (state) { btn.disabled = true; btn.querySelector('.btn-text').style.display = 'none'; btn.querySelector('.spinner').style.display = 'inline-block'; }
    else { btn.disabled = false; btn.querySelector('.btn-text').style.display = 'inline'; btn.querySelector('.spinner').style.display = 'none'; }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('mobile-open');
    document.querySelector('.sidebar-overlay').classList.toggle('mobile-open');
}

function switchTab(tab, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
    if (el) el.classList.add('active');
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.querySelector('.sidebar-overlay').classList.remove('mobile-open');
}

function closeModal(e, id) { if (e.target === e.currentTarget) document.getElementById(id).style.display = 'none'; }
function forceCloseModal(id) { document.getElementById(id).style.display = 'none'; }

function switchUdTab(tab, el) {
    document.querySelectorAll('.ud-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const uid = document.getElementById('edit-u-id').value;
    if (tab === 'profile') showUserProfile(uid);
    else if (tab === 'wallet') showUserWallet(uid);
    else if (tab === 'referral') showUserReferral(uid);
}

function isAdminEmail(email) {
    return ADMIN_EMAILS.map(e => e.toLowerCase()).includes((email || '').toLowerCase());
}

// ==================== LOGIN (username + password) ====================
async function handleLogin(btn) {
    loading(btn, true);
    try {
        if (!window.FirebaseReady) throw new Error('Firebase taiyaar nahi. Refresh karo.');
        const ok = await window.FirebaseReady;
        if (!ok) throw new Error('Firebase taiyaar nahi. Refresh karo.');
        const username = document.getElementById('admin-username').value.trim();
        const pass = document.getElementById('admin-pass').value;
        if (username !== ADMIN_USERNAME) throw new Error('Galat username');
        if (!pass) throw new Error('Password dalo');
        // Password Firebase Auth se match hota hai (console me bana admin user)
        const cred = await firebase.auth().signInWithEmailAndPassword(ADMIN_EMAILS[0], pass);
        const email = cred.user.email || '';
        if (!isAdminEmail(email)) {
            await firebase.auth().signOut();
            throw new Error('Ye account admin nahi hai');
        }
        enterAdmin();
    } catch (e) {
        const msg = (e && e.code === 'auth/invalid-credential') ? 'Galat username ya password' : (e && e.message) || 'Login failed';
        showToast(msg.includes('Firebase taiyaar') || msg.includes('Galat') ? msg : 'Login failed: ' + msg, 'var(--danger)');
    }
    loading(btn, false);
}

function enterAdmin() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-layout').style.display = 'flex';
    loadAllData();
}

// Reload par admin session wapas
if (window.FirebaseReady) {
    window.FirebaseReady.then(ok => {
        if (!ok) return;
        firebase.auth().onAuthStateChanged(g => {
            if (g && isAdminEmail(g.email)) enterAdmin();
        });
    });
}

function logout() {
    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];
    dataLoaded = false;
    firebase.auth().signOut().catch(() => {});
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('admin-layout').style.display = 'none';
}

// ==================== LOAD DATA (realtime) ====================
let dataLoaded = false;
function loadAllData() {
    if (dataLoaded) return; // double-subscribe se bacho (session restore + login)
    dataLoaded = true;
    loadUsers();
    loadTransactions();
    loadBets();
    loadWinClaims();
    loadGames();
    loadSettings();
    loadKYC();
    loadReferralStats();
}

function track(unsub) { unsubs.push(unsub); return unsub; }

// ==================== USERS ====================
function loadUsers() {
    track(db.collection('users').onSnapshot(snap => {
        allUsers = [];
        snap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
        renderUsers();
        renderReferrals();
        updateStats();
    }));
}

function userRow(u) {
    return `
        <tr>
            <td><strong>${u.name || 'Unknown'}</strong><br><small style="color:var(--text-muted);">${u.email || ''}</small></td>
            <td>${u.userId || u.id}</td>
            <td>₹${u.balance || 0}</td>
            <td><span style="color:${u.status === 'blocked' ? 'var(--danger)' : 'var(--success)'}">${u.status === 'blocked' ? 'Blocked' : 'Active'}</span></td>
            <td class="action-btns">
                <button class="btn" style="padding:6px 12px;font-size:12px;" onclick="viewUser('${u.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn btn-warning" style="padding:6px 12px;font-size:12px;" onclick="openBalanceModal('${u.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn ${u.status === 'blocked' ? 'btn-success' : 'btn-danger'}" style="padding:6px 12px;font-size:12px;" onclick="toggleUserStatus('${u.id}')">${u.status === 'blocked' ? 'Unblock' : 'Block'}</button>
            </td>
        </tr>`;
}

function renderUsers() {
    const list = document.getElementById('user-list');
    list.innerHTML = allUsers.length
        ? allUsers.map(userRow).join('')
        : '<tr><td colspan="5" style="text-align:center;">No users found</td></tr>';
}

function filterUsers() {
    const q = document.getElementById('search-users').value.toLowerCase();
    const filtered = allUsers.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        String(u.userId || u.id).toLowerCase().includes(q));
    document.getElementById('user-list').innerHTML = filtered.length
        ? filtered.map(userRow).join('')
        : '<tr><td colspan="5" style="text-align:center;">No matching users</td></tr>';
}

async function toggleUserStatus(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    const newStatus = user.status === 'blocked' ? 'active' : 'blocked';
    await db.collection('users').doc(uid).update({ status: newStatus });
    showToast(`User ${newStatus === 'blocked' ? 'blocked' : 'unblocked'}`, newStatus === 'blocked' ? 'var(--danger)' : 'var(--success)');
}

function viewUser(uid) {
    document.getElementById('edit-u-id').value = uid;
    document.getElementById('user-detail-modal').style.display = 'flex';
    showUserProfile(uid);
}

function showUserProfile(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    document.getElementById('ud-avatar').textContent = (user.name || '?')[0].toUpperCase();
    document.getElementById('ud-user-name').textContent = user.name || 'Unknown';
    document.getElementById('ud-user-id').textContent = 'ID: ' + (user.userId || uid);
    const badge = document.getElementById('ud-status-badge');
    badge.textContent = user.status === 'blocked' ? 'Blocked' : 'Active';
    badge.style.color = user.status === 'blocked' ? 'var(--danger)' : 'var(--success)';
    document.getElementById('ud-body').innerHTML = `
        <div style="margin-bottom:15px;"><strong>Email:</strong> ${user.email || 'N/A'}</div>
        <div style="margin-bottom:15px;"><strong>KYC:</strong> ${user.kycStatus || 'none'}</div>
        <div style="margin-bottom:15px;"><strong>Total Deposit:</strong> ₹${user.totalDeposit || 0}</div>
        <div style="margin-bottom:15px;"><strong>Total Withdraw:</strong> ₹${user.totalWithdraw || 0}</div>
        <div style="margin-bottom:15px;"><strong>Total Win (Balance − Deposit):</strong> ₹${Math.max(0, (user.balance || 0) - (user.totalDeposit || 0))}</div>
    `;
}

// FIX: purana code kabhi-na-bana field padhta tha (hamesha "No deposits").
// Ab asli transactions collection se aata hai.
function showUserWallet(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    document.getElementById('ud-body').innerHTML = `
        <div style="margin-bottom:15px;"><strong>Current Balance:</strong> ₹${user.balance || 0}</div>
        <div style="margin-bottom:15px;"><strong>Transaction History:</strong></div>
        <div style="max-height:200px;overflow-y:auto;" id="ud-trx-history">Loading...</div>
    `;
    db.collection('transactions').where('userId', '==', uid).limit(20).get()
        .then(snap => {
            const items = [];
            snap.forEach(d => items.push(d.data()));
            items.sort((a, b) => {
                const ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : 0;
                const tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : 0;
                return tb - ta;
            });
            const el = document.getElementById('ud-trx-history');
            if (!items.length) { el.innerHTML = '<div style="padding:8px;font-size:13px;color:var(--text-muted);">No transactions</div>'; return; }
            el.innerHTML = items.map(t => `
                <div style="padding:8px;border-bottom:1px solid #f2f2f7;font-size:13px;">
                    ${t.type === 'Deposit' ? '+' : '-'}₹${t.amount || 0} · ${t.type || ''} - ${t.date || ''}
                    <span style="color:${t.status === 'Success' ? 'var(--success)' : t.status === 'Pending' ? 'var(--warning)' : 'var(--danger)'};float:right;">${t.status || ''}</span>
                </div>`).join('');
        })
        .catch(() => {
            const el = document.getElementById('ud-trx-history');
            if (el) el.innerHTML = '<div style="padding:8px;font-size:13px;color:var(--text-muted);">Could not load transactions</div>';
        });
}

function showUserReferral(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    const code = user.referralCode || user.userId || uid;
    const refUsers = allUsers.filter(u => u.referredBy === code);
    document.getElementById('ud-body').innerHTML = `
        <div style="margin-bottom:15px;"><strong>Referral Code:</strong> ${code}</div>
        <div style="margin-bottom:15px;"><strong>Referred Users:</strong> ${refUsers.length}</div>
        <div style="margin-bottom:15px;"><strong>Total Commission:</strong> ₹${user.referralCommission || 0}</div>
        ${refUsers.length ? `<div style="max-height:200px;overflow-y:auto;">${refUsers.map(u => `<div style="padding:8px;border-bottom:1px solid #f2f2f7;font-size:13px;">${u.name || 'Unknown'} (${u.userId || u.id})</div>`).join('')}</div>` : ''}
    `;
}

function openBalanceModal(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    document.getElementById('edit-u-id').value = uid;
    document.getElementById('edit-u-name').textContent = user.name || 'Unknown';
    document.getElementById('edit-u-bal').value = user.balance || 0;
    document.getElementById('edit-balance-modal').style.display = 'flex';
}

async function saveBalance(btn, mode) {
    loading(btn, true);
    const uid = document.getElementById('edit-u-id').value;
    const amt = parseFloat(document.getElementById('edit-u-bal').value);
    if (isNaN(amt) || amt < 0) { showToast('Sahi amount dalo', 'var(--danger)'); loading(btn, false); return; }
    try {
        const ref = db.collection('users').doc(uid);
        if (mode === 'add') {
            // Admin bonus: balance + win dono badhe (win = balance - deposit)
            await ref.update({
                balance: firebase.firestore.FieldValue.increment(amt),
                totalWin: firebase.firestore.FieldValue.increment(amt)
            });
            await db.collection('transactions').add({
                userId: uid, userName: (allUsers.find(u => u.id === uid) || {}).name || '',
                type: 'Win', amount: amt, status: 'Success', date: todayStr(),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('₹' + amt + ' add ho gaya', 'var(--success)');
        } else if (mode === 'deduct') {
            await db.runTransaction(async (tx) => {
                const u = await tx.get(ref);
                const bal = Math.max(0, ((u.exists ? u.data().balance : 0) || 0) - amt);
                tx.update(ref, { balance: bal });
            });
            await db.collection('transactions').add({
                userId: uid, userName: (allUsers.find(u => u.id === uid) || {}).name || '',
                type: 'Penalty', amount: amt, status: 'Success', date: todayStr(),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('₹' + amt + ' deduct ho gaya', 'var(--warning)');
        } else {
            await ref.update({ balance: amt });
            showToast('Balance set ho gaya', 'var(--success)');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'var(--danger)');
    }
    document.getElementById('edit-balance-modal').style.display = 'none';
    loading(btn, false);
}

function todayStr() {
    const d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

// ==================== TRANSACTIONS ====================
function loadTransactions() {
    track(db.collection('transactions').orderBy('timestamp', 'desc').limit(200).onSnapshot(snap => {
        allTrx = [];
        snap.forEach(d => allTrx.push({ id: d.id, ...d.data() }));
        renderTrx();
        updateStats();
    }));
}

function trxRow(t) {
    const user = allUsers.find(u => u.id === t.userId);
    return `
        <tr>
            <td>${t.userName || (user && user.name) || 'Unknown'}<br><small style="color:var(--text-muted);">${user && user.userId ? user.userId : ''}</small></td>
            <td>${t.type || 'N/A'}</td>
            <td>₹${t.amount || 0}</td>
            <td>${t.date || 'N/A'}</td>
            <td><span style="color:${t.status === 'Success' ? 'var(--success)' : t.status === 'Pending' ? 'var(--warning)' : 'var(--danger)'}">${t.status || 'Pending'}</span></td>
            <td class="action-btns">
                ${t.status === 'Pending' ? `
                    <button class="btn btn-success" style="padding:6px 12px;font-size:12px;" onclick="approveTrx('${t.id}')">Approve</button>
                    <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="rejectTrx('${t.id}')">Reject</button>
                ` : '<span style="color:var(--text-muted);font-size:12px;">--</span>'}
            </td>
        </tr>`;
}

function renderTrx() {
    document.getElementById('trx-list').innerHTML = allTrx.length
        ? allTrx.map(trxRow).join('')
        : '<tr><td colspan="6" style="text-align:center;">No transactions</td></tr>';
}

function filterTrx() {
    const q = document.getElementById('search-trx').value.toLowerCase();
    const type = document.getElementById('filter-trx-type').value;
    const status = document.getElementById('filter-trx-status').value;
    const filtered = allTrx.filter(t => {
        const user = allUsers.find(u => u.id === t.userId);
        const name = ((t.userName || '') + ' ' + ((user && user.name) || '')).toLowerCase();
        if (q && !name.includes(q)) return false;
        if (type && t.type !== type) return false;
        if (status && t.status !== status) return false;
        return true;
    });
    document.getElementById('trx-list').innerHTML = filtered.length
        ? filtered.map(trxRow).join('')
        : '<tr><td colspan="6" style="text-align:center;">No matching transactions</td></tr>';
}

async function approveTrx(id) {
    const trx = allTrx.find(t => t.id === id);
    if (!trx) return;
    try {
        // Deposit: pehle balance me paise dalo (Razorpay online payment admin verify ke baad)
        if (trx.type === 'Deposit') {
            await db.runTransaction(async (tx) => {
                const ref = db.collection('users').doc(trx.userId);
                tx.update(ref, {
                    balance: firebase.firestore.FieldValue.increment(trx.amount || 0),
                    totalDeposit: firebase.firestore.FieldValue.increment(trx.amount || 0)
                });
            });
            await db.collection('transactions').doc(id).update({ status: 'Success' });
            showToast('Deposit approved, balance me paisa aaya', 'var(--success)');
            return;
        }
        await db.collection('transactions').doc(id).update({ status: 'Success' });
        if (trx.type === 'Withdraw') {
            // Balance pehle hi kat chuka hai (request ke time). Sirf lifetime total badhao.
            // Double-deduction bug se bacho: balance mat chhedo.
            await db.collection('users').doc(trx.userId).update({
                totalWithdraw: firebase.firestore.FieldValue.increment(trx.amount || 0)
            });
        }
        showToast('Transaction approved', 'var(--success)');
    } catch (e) {
        showToast('Error: ' + e.message, 'var(--danger)');
    }
}

async function rejectTrx(id) {
    const trx = allTrx.find(t => t.id === id);
    if (!trx) return;
    try {
        await db.collection('transactions').doc(id).update({ status: 'Rejected' });
        if (trx.type === 'Withdraw') {
            // Paisa wapas: reject par refund (warna user ka paisa gayab)
            await db.runTransaction(async (tx) => {
                const ref = db.collection('users').doc(trx.userId);
                const u = await tx.get(ref);
                const bal = ((u.exists ? u.data().balance : 0) || 0) + (trx.amount || 0);
                tx.update(ref, { balance: bal });
            });
            showToast('Withdrawal rejected & amount refunded', 'var(--success)');
        } else if (trx.type === 'Deposit') {
            await db.runTransaction(async (tx) => {
                const ref = db.collection('users').doc(trx.userId);
                const u = await tx.get(ref);
                const bal = Math.max(0, ((u.exists ? u.data().balance : 0) || 0) - (trx.amount || 0));
                tx.update(ref, { balance: bal });
            });
            showToast('Transaction rejected', 'var(--danger)');
        } else {
            showToast('Transaction rejected', 'var(--danger)');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'var(--danger)');
    }
}

// ==================== KYC ====================
function loadKYC() {
    track(db.collection('kyc_requests').orderBy('timestamp', 'desc').onSnapshot(snap => {
        const list = document.getElementById('kyc-list');
        const requests = [];
        snap.forEach(d => requests.push({ id: d.id, ...d.data() }));
        if (!requests.length) { list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No KYC requests</td></tr>'; return; }
        list.innerHTML = requests.map(r => `
            <tr>
                <td>${r.userName || 'Unknown'}</td>
                <td><small>${r.userId || '--'}</small></td>
                <td>${r.mobile || '--'}</td>
                <td><span style="color:${r.status === 'approved' ? 'var(--success)' : r.status === 'rejected' ? 'var(--danger)' : 'var(--warning)'}">${r.status || 'pending'}</span></td>
                <td class="action-btns">
                    ${(!r.status || r.status === 'pending') ? `
                        <button class="btn btn-success" style="padding:6px 12px;font-size:12px;" onclick="approveKYC('${r.id}','${r.userId || ''}')">Approve</button>
                        <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="rejectKYC('${r.id}','${r.userId || ''}')">Reject</button>
                    ` : '<span style="color:var(--text-muted);font-size:12px;">--</span>'}
                </td>
            </tr>`).join('');
    }));
}

async function approveKYC(reqId, userId) {
    await db.collection('kyc_requests').doc(reqId).update({ status: 'approved' });
    if (userId) await db.collection('users').doc(userId).update({ kycStatus: 'approved' });
    showToast('KYC approved', 'var(--success)');
}

async function rejectKYC(reqId, userId) {
    await db.collection('kyc_requests').doc(reqId).update({ status: 'rejected' });
    if (userId) await db.collection('users').doc(userId).update({ kycStatus: 'rejected' });
    showToast('KYC rejected', 'var(--danger)');
}

// ==================== BETS ====================
function loadBets() {
    track(db.collection('bets').orderBy('timestamp', 'desc').limit(200).onSnapshot(snap => {
        allBets = [];
        snap.forEach(d => allBets.push({ id: d.id, ...d.data() }));
        renderBets();
        updateStats();
    }));
}

function renderBets() {
    const list = document.getElementById('bets-list');
    if (!allBets.length) { list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No bets</td></tr>'; return; }
    list.innerHTML = allBets.map(b => `
        <tr>
            <td>${b.creatorName || 'Unknown'}</td>
            <td>${b.joinerName || '--'}</td>
            <td>₹${b.amount || 0}</td>
            <td>${b.roomCode || '--'}</td>
            <td><span style="color:${b.status === 'completed' ? 'var(--success)' : b.status === 'playing' ? 'var(--primary)' : 'var(--warning)'}">${b.status || 'waiting'}</span></td>
        </tr>`).join('');
}

// Result set karo (winner ka paisa + win total). Loser ka paisa pehle hi kat chuka hai.
// Platform fee 5%: 100+100=200 pot -> winner ko 190. (Payout admin khud dekhta hai.)
async function settleBet(betId, winnerUid) {
    const bet = allBets.find(b => b.id === betId);
    if (!bet || bet.status !== 'playing') return 0;
    const prize = Math.floor((bet.amount || 0) * 2 * 0.95);
    await db.collection('bets').doc(betId).update({ status: 'completed', winnerId: winnerUid });
    await db.collection('users').doc(winnerUid).update({
        balance: firebase.firestore.FieldValue.increment(prize),
        totalWin: firebase.firestore.FieldValue.increment(prize)
    });
    return prize;
}

// ==================== WIN CLAIMS (screenshot proof) ====================
// Photo Telegram channel me jati hai (UID ke saath). Yahan sirf approve/reject.
// Approve -> bet completed + winner ko prize. Phir payment admin khud karega.
function loadWinClaims() {
    track(db.collection('win_claims').orderBy('timestamp', 'desc').limit(200).onSnapshot(snap => {
        const list = document.getElementById('winclaims-list');
        const claims = [];
        snap.forEach(d => claims.push({ id: d.id, ...d.data() }));
        if (!claims.length) { list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No win claims</td></tr>'; return; }
        list.innerHTML = claims.map(c => {
            const prize = Math.floor((c.betAmount || 0) * 2 * 0.95);
            return `
            <tr>
                <td>${c.userName || 'Unknown'}<br><small style="color:var(--text-muted);">${c.userId || ''}</small></td>
                <td>₹${c.betAmount || 0} (${c.betId || '--'})</td>
                <td>₹${prize}</td>
                <td><span style="color:${c.status === 'approved' ? 'var(--success)' : c.status === 'rejected' ? 'var(--danger)' : 'var(--warning)'}">${c.status || 'pending'}</span></td>
                <td class="action-btns">
                    ${(!c.status || c.status === 'pending') ? `
                        <button class="btn btn-success" style="padding:6px 12px;font-size:12px;" onclick="approveWinClaim('${c.id}')">Approve</button>
                        <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="rejectWinClaim('${c.id}')">Reject</button>
                    ` : '<span style="color:var(--text-muted);font-size:12px;">--</span>'}
                </td>
            </tr>`;
        }).join('');
    }));
}

async function approveWinClaim(claimId) {
    try {
        const d = await db.collection('win_claims').doc(claimId).get();
        if (!d.exists) return;
        const c = d.data();
        if (c.status && c.status !== 'pending') { showToast('Pehle se decided hai', '#ff9500'); return; }
        const prize = await settleBet(c.betId, c.userId);
        await db.collection('win_claims').doc(claimId).update({ status: 'approved', prize });
        await db.collection('transactions').add({
            userId: c.userId, userName: c.userName || '',
            type: 'Win', amount: prize, status: 'Success', date: todayStr(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Approved! Winner ko ₹' + prize + ' mila. Payment kar do.', 'var(--success)');
    } catch (e) {
        showToast('Error: ' + e.message, 'var(--danger)');
    }
}

async function rejectWinClaim(claimId) {
    await db.collection('win_claims').doc(claimId).update({ status: 'rejected' });
    showToast('Win claim rejected', 'var(--danger)');
}

// ==================== GAMES ====================
function loadGames() {
    track(db.collection('games').onSnapshot(snap => {
        allGames = [];
        snap.forEach(d => allGames.push({ id: d.id, ...d.data() }));
        renderGames();
    }));
}

function renderGames() {
    const list = document.getElementById('games-list');
    if (!allGames.length) { list.innerHTML = '<tr><td colspan="4" style="text-align:center;">No games added</td></tr>'; return; }
    list.innerHTML = allGames.map(g => `
        <tr>
            <td>${g.logo ? `<img src="${g.logo}" style="width:40px;height:40px;border-radius:8px;">` : '<i class="fas fa-gamepad" style="font-size:30px;color:var(--text-muted);"></i>'}</td>
            <td>${g.name || 'Unnamed'}</td>
            <td><span style="color:${g.status === 'active' ? 'var(--success)' : 'var(--danger)'}">${g.status || 'disabled'}</span></td>
            <td class="action-btns">
                <button class="btn btn-warning" style="padding:6px 12px;font-size:12px;" onclick="editGame('${g.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="deleteGame('${g.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

// Edit mode: purana bug tha — Edit dabate hi game delete ho jata tha.
// Ab sirf form bharta hai, Save par update hota hai.
let editingGameId = null;

async function saveGame(btn) {
    loading(btn, true);
    const name = document.getElementById('g-name').value.trim();
    const logo = document.getElementById('g-logo').value.trim();
    const status = document.getElementById('g-status').value;
    if (!name) { showToast('Game name required', 'var(--danger)'); loading(btn, false); return; }
    try {
        if (editingGameId) {
            await db.collection('games').doc(editingGameId).update({ name, logo, status });
            editingGameId = null;
        } else {
            await db.collection('games').add({ name, logo, status, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
        document.getElementById('g-name').value = '';
        document.getElementById('g-logo').value = '';
        showToast('Game saved', 'var(--success)');
    } catch (e) {
        showToast('Error: ' + e.message, 'var(--danger)');
    }
    loading(btn, false);
}

function editGame(id) {
    const game = allGames.find(g => g.id === id);
    if (!game) return;
    editingGameId = id;
    document.getElementById('g-name').value = game.name || '';
    document.getElementById('g-logo').value = game.logo || '';
    document.getElementById('g-status').value = game.status || 'active';
    showToast('Edit mode: press Save to update', 'var(--warning)');
}

async function deleteGame(id) {
    if (!confirm('Delete this game?')) return;
    if (editingGameId === id) editingGameId = null;
    await db.collection('games').doc(id).delete();
    showToast('Game deleted', 'var(--danger)');
}

// ==================== REFERRALS (computed — koi alag collection nahi) ====================
// REMOVED: purana 'referrals' collection kabhi banta hi nahi tha (hamesha khaali).
// Ab users se gin ke dikhta hai: referredBy + referralCommission.
function loadReferralStats() {
    renderReferrals();
}

function renderReferrals() {
    const list = document.getElementById('referral-list');
    const earners = allUsers.filter(u => (u.referralCommission || 0) > 0 ||
        allUsers.some(x => x.referredBy && x.referredBy === (u.referralCode || u.userId)));
    if (!earners.length) { list.innerHTML = '<tr><td colspan="3" style="text-align:center;">No referral data</td></tr>'; return; }
    list.innerHTML = earners.map(u => {
        const code = u.referralCode || u.userId;
        const count = allUsers.filter(x => x.referredBy === code).length;
        return `
        <tr>
            <td>${u.name || 'Unknown'} (${u.userId || u.id})</td>
            <td>${count}</td>
            <td>₹${u.referralCommission || 0}</td>
        </tr>`;
    }).join('');
}

async function saveReferralSettings(btn) {
    loading(btn, true);
    const commission = parseFloat(document.getElementById('r-commission').value);
    if (isNaN(commission) || commission < 0) { showToast('Invalid commission', 'var(--danger)'); loading(btn, false); return; }
    await db.collection('settings').doc('referral').set({ commission }, { merge: true });
    showToast('Referral commission updated', 'var(--success)');
    loading(btn, false);
}

// ==================== MAIL ====================
// FIX: purana code 5-digit userId ko doc-id samajhta tha (mail kabhi pahunchta hi nahi tha).
// Ab userId field se dhoondh ke sahi doc me likhta hai.
async function sendMail(btn) {
    loading(btn, true);
    const subject = document.getElementById('m-subject').value.trim();
    const body = document.getElementById('m-body').value.trim();
    const type = document.getElementById('m-recipients').value;
    const userIdInput = document.getElementById('m-user-id').value.trim();
    if (!subject || !body) { showToast('Subject and body required', 'var(--danger)'); loading(btn, false); return; }
    let targets = allUsers;
    if (type === 'single') {
        if (!userIdInput) { showToast('User ID required', 'var(--danger)'); loading(btn, false); return; }
        targets = allUsers.filter(u => String(u.userId) === userIdInput || u.id === userIdInput);
        if (!targets.length) { showToast('User not found', 'var(--danger)'); loading(btn, false); return; }
    }
    try {
        for (const u of targets) {
            await db.collection('users').doc(u.id).collection('mails').add({
                subject, body, from: 'Admin', read: false,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        showToast(`Mail sent to ${targets.length} user(s)`, 'var(--success)');
        document.getElementById('m-subject').value = '';
        document.getElementById('m-body').value = '';
    } catch (e) {
        showToast('Error: ' + e.message, 'var(--danger)');
    }
    loading(btn, false);
}

document.getElementById('m-recipients').addEventListener('change', function () {
    document.getElementById('m-user-id').style.display = this.value === 'single' ? 'block' : 'none';
});

async function saveWelcomeMsg(btn) {
    loading(btn, true);
    const msg = document.getElementById('m-welcome').value.trim();
    if (!msg) { showToast('Welcome message required', 'var(--danger)'); loading(btn, false); return; }
    await db.collection('settings').doc('welcome').set({ message: msg }, { merge: true });
    showToast('Welcome message saved', 'var(--success)');
    loading(btn, false);
}

// ==================== SUPPORT ====================
async function saveSupport(btn) {
    loading(btn, true);
    const data = {
        email: document.getElementById('s-email').value.trim(),
        telegram: document.getElementById('s-telegram').value.trim(),
        chat: document.getElementById('s-chat').value.trim()
    };
    await db.collection('settings').doc('support').set(data, { merge: true });
    showToast('Support settings saved', 'var(--success)');
    loading(btn, false);
}

// ==================== SETTINGS ====================
function loadSettings() {
    db.collection('settings').doc('app').get().then(d => {
        if (d.exists) {
            const s = d.data();
            document.getElementById('s-deposit-opts').value = s.depositOptions || '100,200,300,400,500,1000,2000,5000';
            document.getElementById('s-min-deposit').value = s.minDeposit || 100;
            document.getElementById('s-min-withdraw').value = s.minWithdraw || 195;
            if (document.getElementById('s-max-withdraw')) document.getElementById('s-max-withdraw').value = s.maxWithdraw || 50000;
        }
    }).catch(() => {});
    db.collection('settings').doc('referral').get().then(d => {
        if (d.exists && d.data().commission !== undefined) document.getElementById('r-commission').value = d.data().commission;
    }).catch(() => {});
    db.collection('settings').doc('welcome').get().then(d => {
        if (d.exists && d.data().message) document.getElementById('m-welcome').value = d.data().message;
    }).catch(() => {});
    db.collection('settings').doc('support').get().then(d => {
        if (d.exists) {
            const s = d.data();
            document.getElementById('s-email').value = s.email || '';
            document.getElementById('s-telegram').value = s.telegram || '';
            document.getElementById('s-chat').value = s.chat || '';
        }
    }).catch(() => {});
    // PayU keys (display)
    db.collection('settings').doc('payu').get().then(d => {
        if (d.exists) {
            document.getElementById('s-payu-key').value = d.data().key || '';
            document.getElementById('s-payu-salt').value = d.data().salt || '';
        }
    }).catch(() => {});
    // Payment links
    db.collection('settings').doc('paylinks').get().then(d => {
        if (d.exists) {
            const links = d.data().links || {};
            document.getElementById('s-pay-links').value =
                Object.keys(links).map(k => k + '=' + links[k]).join('\n');
        }
    }).catch(() => {});
    // Payment server
    db.collection('settings').doc('payment').get().then(d => {
        if (d.exists) document.getElementById('s-pay-server').value = d.data().serverUrl || '';
    }).catch(() => {});
    // KYC Telegram (bot token + channel chat id)
    db.collection('settings').doc('kyc_telegram').get().then(d => {
        if (d.exists) {
            document.getElementById('s-tg-bot').value = d.data().botToken || '';
            document.getElementById('s-tg-chat').value = d.data().chatId || '';
        }
    }).catch(() => {});
    // Win proof Telegram (alag bot + channel)
    db.collection('settings').doc('win_telegram').get().then(d => {
        if (d.exists) {
            document.getElementById('s-win-bot').value = d.data().botToken || '';
            document.getElementById('s-win-chat').value = d.data().chatId || '';
        }
    }).catch(() => {});
}

// KYC Telegram: bot token + channel chat id (Aadhaar photos channel me jayengi)
// Payment Links: har chip amount ka alag Razorpay link (fixed-amount link banao)
async function savePayLinks(btn) {
    loading(btn, true);
    const links = {};
    document.getElementById('s-pay-links').value.split('\n').forEach(line => {
        const i = line.indexOf('=');
        if (i > 0) {
            const amt = parseInt(line.slice(0, i).trim());
            const url = line.slice(i + 1).trim();
            if (amt > 0 && url) links[String(amt)] = url;
        }
    });
    await db.collection('settings').doc('paylinks').set({ links }, { merge: true });
    showToast('Payment links saved (' + Object.keys(links).length + ')', 'var(--success)');
    loading(btn, false);
}

// Payment Server URL (QR + webhook wala PHP host)
async function savePaymentServer(btn) {
    loading(btn, true);
    const serverUrl = document.getElementById('s-pay-server').value.trim().replace(/\/+$/, '');
    if (!serverUrl) { showToast('Server URL dalo', 'var(--danger)'); loading(btn, false); return; }
    await db.collection('settings').doc('payment').set({ serverUrl }, { merge: true });
    showToast('Payment server saved', 'var(--success)');
    loading(btn, false);
}

// PayU Test Key + Salt (display ke liye; asli verify server config se hota hai)
async function savePayU(btn) {
    loading(btn, true);
    const key = document.getElementById('s-payu-key').value.trim();
    const salt = document.getElementById('s-payu-salt').value.trim();
    if (!key || !salt) { showToast('Key aur Salt dono dalo', 'var(--danger)'); loading(btn, false); return; }
    await db.collection('settings').doc('payu').set({ key, salt }, { merge: true });
    showToast('PayU saved (Salt server config me bhi dalna hai)', 'var(--success)');
    loading(btn, false);
}

async function saveKycTelegram(btn) {
    loading(btn, true);
    const botToken = document.getElementById('s-tg-bot').value.trim();
    const chatId = document.getElementById('s-tg-chat').value.trim();
    if (!botToken || !chatId) { showToast('Bot token aur chat ID dono dalo', 'var(--danger)'); loading(btn, false); return; }
    await db.collection('settings').doc('kyc_telegram').set({ botToken, chatId }, { merge: true });
    showToast('Telegram saved', 'var(--success)');
    loading(btn, false);
}

// Win Proof Telegram: alag bot token + channel chat id (jeet ke screenshot yahan jayenge)
async function saveWinTelegram(btn) {
    loading(btn, true);
    const botToken = document.getElementById('s-win-bot').value.trim();
    const chatId = document.getElementById('s-win-chat').value.trim();
    if (!botToken || !chatId) { showToast('Bot token aur chat ID dono dalo', 'var(--danger)'); loading(btn, false); return; }
    await db.collection('settings').doc('win_telegram').set({ botToken, chatId }, { merge: true });
    showToast('Telegram saved', 'var(--success)');
    loading(btn, false);
}

async function saveAppSettings(btn) {    loading(btn, true);
    const data = {
        depositOptions: document.getElementById('s-deposit-opts').value,
        minDeposit: parseFloat(document.getElementById('s-min-deposit').value) || 100,
        minWithdraw: parseFloat(document.getElementById('s-min-withdraw').value) || 195,
        maxWithdraw: parseFloat((document.getElementById('s-max-withdraw') || {}).value) || 50000
    };
    await db.collection('settings').doc('app').set(data, { merge: true });
    showToast('Settings saved', 'var(--success)');
    loading(btn, false);
}

// ==================== STATS ====================
function fmtDate(ts) {
    try {
        if (ts && ts.toDate) return ts.toDate().toLocaleString();
    } catch (e) {}
    return 'N/A';
}

function updateStats() {
    document.getElementById('stat-users').textContent = allUsers.length || 0;
    const totalDep = allTrx.filter(t => t.type === 'Deposit' && t.status === 'Success').reduce((s, t) => s + (t.amount || 0), 0);
    const totalWit = allTrx.filter(t => t.type === 'Withdraw' && t.status === 'Success').reduce((s, t) => s + (t.amount || 0), 0);
    document.getElementById('stat-deposit').textContent = '₹' + totalDep;
    document.getElementById('stat-withdraw').textContent = '₹' + totalWit;
    document.getElementById('stat-bets').textContent = allBets.filter(b => b.status === 'waiting' || b.status === 'playing').length;

    db.collection('kyc_requests').where('status', '==', 'pending').get().then(snap => {
        document.getElementById('stat-pending-kyc').textContent = snap.size || 0;
    }).catch(() => {});

    const recent = allBets.slice(0, 10);
    const rList = document.getElementById('recent-bets-list');
    if (!recent.length) { rList.innerHTML = '<tr><td colspan="4" style="text-align:center;">No recent bets</td></tr>'; return; }
    rList.innerHTML = recent.map(b => `
        <tr>
            <td>${b.creatorName || '?'} ${b.joinerName ? 'vs ' + b.joinerName : '(waiting)'}</td>
            <td>₹${b.amount || 0}</td>
            <td><span style="color:${b.status === 'completed' ? 'var(--success)' : b.status === 'playing' ? 'var(--primary)' : 'var(--warning)'}">${b.status || 'waiting'}</span></td>
            <td>${fmtDate(b.timestamp)}</td>
        </tr>`).join('');
}

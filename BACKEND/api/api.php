<?php
// =====================================================
// LUDO ROYAL CLUB - PHP REST API (single router)
// Usage: api.php?action=<action>   (POST JSON body / GET params)
// =====================================================
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$in = body();

switch ($action) {

    // ---------- AUTH ----------
    case 'login': {
        require_fields($in, ['username']);
        $username = strtolower(trim($in['username']));
        $username = preg_replace('/\s+/', '_', $username);
        $displayName = trim($in['name'] ?? $in['username']);

        $st = $pdo->prepare("SELECT * FROM users WHERE username = ? LIMIT 1");
        $st->execute([$username]);
        $row = $st->fetch();

        if (!$row) {
            // New user — auto register
            $pdo->beginTransaction();
            try {
                $userId = unique_rand_id($pdo, 'user_id');
                $refCode = unique_rand_id($pdo, 'referral_code');
                $logo = $in['profileLogo'] ?? '';
                $st = $pdo->prepare("INSERT INTO users (username, name, user_id, profile_logo, referral_code) VALUES (?,?,?,?,?)");
                $st->execute([$username, $displayName, $userId, $logo, $refCode]);
                $newId = (int)$pdo->lastInsertId();

                // Welcome mail
                $st = $pdo->prepare("SELECT key_value FROM settings WHERE key_name = 'welcome' LIMIT 1");
                $st->execute();
                $welcome = $st->fetch();
                $msg = $welcome ? (json_decode($welcome['key_value'], true)['message'] ?? '') : '';
                if (!$msg) $msg = "Welcome {$displayName}! Start playing and winning real money. Good luck!";
                $st = $pdo->prepare("INSERT INTO mails (user_id, subject, body) VALUES (?,?,?)");
                $st->execute([$newId, 'Welcome to Ludo Royal Club! 🎉', $msg]);

                $pdo->commit();
                json_out(['success' => true, 'user' => map_user(get_user_row($pdo, $newId)), 'isNew' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                json_out(['success' => false, 'error' => 'Register failed: ' . $e->getMessage()], 500);
            }
        }
        json_out(['success' => true, 'user' => map_user($row), 'isNew' => false]);
    }

    case 'getUser': {
        require_fields($in, ['user_id']);
        json_out(['success' => true, 'user' => map_user(get_user_row($pdo, $in['user_id']))]);
    }

    case 'updateName': {
        require_fields($in, ['user_id', 'name']);
        $st = $pdo->prepare("UPDATE users SET name = ? WHERE id = ?");
        $st->execute([trim($in['name']), (int)$in['user_id']]);
        json_out(['success' => true, 'user' => map_user(get_user_row($pdo, $in['user_id']))]);
    }

    // ---------- WALLET ----------
    case 'deposit': {
        require_fields($in, ['user_id', 'amount']);
        $amount = (float)$in['amount'];
        if ($amount < 100) json_out(['success' => false, 'error' => 'Minimum deposit ₹100'], 400);

        $pdo->beginTransaction();
        try {
            $u = get_user_row($pdo, $in['user_id'], true); // lock row
            $st = $pdo->prepare("UPDATE users SET balance = balance + ?, total_deposit = total_deposit + ? WHERE id = ?");
            $st->execute([$amount, $amount, (int)$in['user_id']]);
            $st = $pdo->prepare("INSERT INTO transactions (user_id, type, amount, status, date) VALUES (?, 'Deposit', ?, 'Success', ?)");
            $st->execute([(int)$in['user_id'], $amount, date('d/m/Y')]);
            $pdo->commit();
            json_out(['success' => true, 'balance' => (float)$u['balance'] + $amount, 'totalDeposit' => (float)$u['total_deposit'] + $amount]);
        } catch (Exception $e) {
            $pdo->rollBack();
            json_out(['success' => false, 'error' => 'Deposit failed: ' . $e->getMessage()], 500);
        }
    }

    case 'withdraw': {
        require_fields($in, ['user_id', 'amount', 'holder', 'upi']);
        $amount = (float)$in['amount'];
        if ($amount < 195)  json_out(['success' => false, 'error' => 'Minimum withdraw ₹195'], 400);
        if ($amount > 50000) json_out(['success' => false, 'error' => 'Maximum withdraw ₹50,000'], 400);

        $pdo->beginTransaction();
        try {
            $u = get_user_row($pdo, $in['user_id'], true); // lock row
            if ((float)$u['balance'] < $amount) {
                $pdo->rollBack();
                json_out(['success' => false, 'error' => 'Insufficient balance'], 400);
            }
            // Balance deducts IMMEDIATELY (pending money can't be spent on bets).
            // Admin rejection refunds the amount.
            $st = $pdo->prepare("UPDATE users SET balance = balance - ? WHERE id = ?");
            $st->execute([$amount, (int)$in['user_id']]);
            $details = json_encode(['method' => 'upi', 'accountHolder' => $in['holder'], 'upiId' => $in['upi']]);
            $st = $pdo->prepare("INSERT INTO transactions (user_id, type, amount, status, details, date) VALUES (?, 'Withdraw', ?, 'Pending', ?, ?)");
            $st->execute([(int)$in['user_id'], $amount, $details, date('d/m/Y')]);
            $newBal = (float)$u['balance'] - $amount;
            $pdo->commit();
            json_out(['success' => true, 'balance' => $newBal]);
        } catch (Exception $e) {
            $pdo->rollBack();
            json_out(['success' => false, 'error' => 'Withdraw failed: ' . $e->getMessage()], 500);
        }
    }

    case 'getTransactions': {
        require_fields($in, ['user_id']);
        $st = $pdo->prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50");
        $st->execute([(int)$in['user_id']]);
        $items = array_map('map_transaction', $st->fetchAll());
        json_out(['success' => true, 'transactions' => $items]);
    }

    // ---------- BETS ----------
    case 'getBets': {
        $st = $pdo->query("SELECT * FROM bets ORDER BY id DESC LIMIT 100");
        $bets = array_map('map_bet', $st->fetchAll());
        json_out(['success' => true, 'bets' => $bets]);
    }

    case 'createBet': {
        require_fields($in, ['user_id', 'amount', 'room_code']);
        $amount = (float)$in['amount'];
        $roomCode = strtoupper(trim($in['room_code']));
        if ($amount <= 0) json_out(['success' => false, 'error' => 'Invalid bet amount'], 400);
        if ($roomCode === '') json_out(['success' => false, 'error' => 'Room code required'], 400);

        $pdo->beginTransaction();
        try {
            $u = get_user_row($pdo, $in['user_id'], true); // lock row
            if ((float)$u['balance'] < $amount) {
                $pdo->rollBack();
                json_out(['success' => false, 'error' => 'Insufficient balance!'], 400);
            }
            $st = $pdo->prepare("UPDATE users SET balance = balance - ? WHERE id = ?");
            $st->execute([$amount, (int)$in['user_id']]);
            $st = $pdo->prepare("INSERT INTO bets (creator_id, creator_name, creator_user_id, creator_logo, amount, room_code, status) VALUES (?,?,?,?,?,?,'waiting')");
            $st->execute([(int)$in['user_id'], $u['name'], $u['user_id'], $in['creatorLogo'] ?? '', $amount, $roomCode]);
            $newBal = (float)$u['balance'] - $amount;
            $pdo->commit();
            json_out(['success' => true, 'balance' => $newBal]);
        } catch (Exception $e) {
            $pdo->rollBack();
            json_out(['success' => false, 'error' => 'Bet failed: ' . $e->getMessage()], 500);
        }
    }

    case 'joinBet': {
        require_fields($in, ['user_id', 'bet_id', 'joiner_logo']);

        $pdo->beginTransaction();
        try {
            // Lock the bet row — prevents two players joining the same bet (race condition)
            $st = $pdo->prepare("SELECT * FROM bets WHERE id = ? FOR UPDATE");
            $st->execute([(int)$in['bet_id']]);
            $bet = $st->fetch();
            if (!$bet) { $pdo->rollBack(); json_out(['success' => false, 'error' => 'Bet not found'], 404); }
            if ($bet['status'] !== 'waiting') { $pdo->rollBack(); json_out(['success' => false, 'error' => 'Bet already taken'], 400); }
            if ($bet['creator_id'] !== null && (int)$bet['creator_id'] === (int)$in['user_id']) {
                $pdo->rollBack();
                json_out(['success' => false, 'error' => "You can't join your own bet"], 400);
            }

            $u = get_user_row($pdo, $in['user_id'], true); // lock row
            $amount = (float)$bet['amount']; // use the bet's own amount
            if ((float)$u['balance'] < $amount) {
                $pdo->rollBack();
                json_out(['success' => false, 'error' => 'Insufficient balance!'], 400);
            }
            $st = $pdo->prepare("UPDATE users SET balance = balance - ? WHERE id = ?");
            $st->execute([$amount, (int)$in['user_id']]);
            $st = $pdo->prepare("UPDATE bets SET status = 'playing', joiner_id = ?, joiner_name = ?, joiner_logo = ? WHERE id = ?");
            $st->execute([(int)$in['user_id'], $u['name'], $in['joiner_logo'], (int)$in['bet_id']]);
            $newBal = (float)$u['balance'] - $amount;
            $roomCode = $bet['room_code'];
            $pdo->commit();
            json_out(['success' => true, 'roomCode' => $roomCode, 'balance' => $newBal]);
        } catch (Exception $e) {
            $pdo->rollBack();
            json_out(['success' => false, 'error' => 'Join failed: ' . $e->getMessage()], 500);
        }
    }

    // ---------- KYC ----------
    case 'submitKyc': {
        require_fields($in, ['user_id', 'name', 'aadhar', 'front', 'back']);
        $st = $pdo->prepare("INSERT INTO kyc_requests (user_id, aadhar_name, aadhar_number, front_image, back_image, status) VALUES (?,?,?,?,?, 'pending')");
        $st->execute([(int)$in['user_id'], trim($in['name']), trim($in['aadhar']), $in['front'], $in['back']]);
        $st = $pdo->prepare("UPDATE users SET kyc_status = 'pending' WHERE id = ?");
        $st->execute([(int)$in['user_id']]);
        json_out(['success' => true]);
    }

    case 'getKycStatus': {
        require_fields($in, ['user_id']);
        $st = $pdo->prepare("SELECT status, created_at FROM kyc_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1");
        $st->execute([(int)$in['user_id']]);
        $row = $st->fetch();
        json_out(['success' => true, 'kyc' => $row ? ['status' => $row['status'], 'createdAt' => $row['created_at']] : ['status' => 'none']]);
    }

    // ---------- MAILS ----------
    case 'getMails': {
        require_fields($in, ['user_id']);
        $st = $pdo->prepare("SELECT * FROM mails WHERE user_id = ? ORDER BY id DESC LIMIT 50");
        $st->execute([(int)$in['user_id']]);
        $mails = array_map('map_mail', $st->fetchAll());
        json_out(['success' => true, 'mails' => $mails]);
    }

    case 'markMailRead': {
        require_fields($in, ['user_id', 'mail_id']);
        $st = $pdo->prepare("UPDATE mails SET is_read = 1 WHERE id = ? AND user_id = ?");
        $st->execute([(int)$in['mail_id'], (int)$in['user_id']]);
        json_out(['success' => true]);
    }

    // ---------- SETTINGS / GAMES ----------
    case 'getSettings': {
        require_fields($in, ['key']);
        $st = $pdo->prepare("SELECT key_value FROM settings WHERE key_name = ? LIMIT 1");
        $st->execute([$in['key']]);
        $row = $st->fetch();
        json_out(['success' => true, 'settings' => $row ? (json_decode($row['key_value'], true) ?: []) : []]);
    }

    case 'getGames': {
        $st = $pdo->query("SELECT id, name, logo, status FROM games WHERE status = 'active' ORDER BY id DESC");
        json_out(['success' => true, 'games' => $st->fetchAll()]);
    }

    default:
        json_out(['success' => false, 'error' => 'Unknown action: ' . $action], 404);
}
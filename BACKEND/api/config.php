<?php
// =====================================================
// LUDO ROYAL CLUB - PHP Backend Configuration (XAMPP / MySQL)
// =====================================================

$DB_HOST = 'localhost';
$DB_NAME = 'ludo_royal_club';
$DB_USER = 'root';      // XAMPP default
$DB_PASS = '';          // XAMPP default (empty)

// ---- JSON headers + CORS ----
// InfinityFree bot-check cookie (?i=1) cross-origin fetch me bhejne ke liye
// credentials chahiye — aur credentials ke saath '*' origin nahi chalta,
// isliye Vercel frontend ko naam se allow kiya hai.
$FRONTEND_URL = 'https://ludoroyalclub.vercel.app';
$reqOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
header('Content-Type: application/json; charset=utf-8');
if ($reqOrigin === $FRONTEND_URL) {
    header('Access-Control-Allow-Origin: ' . $FRONTEND_URL);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

// ---- PDO connection ----
try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    json_out(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()], 500);
}

// ---- Helpers ----
function json_out($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

// Read JSON body (POST) — falls back to $_POST/$_GET
function body() {
    static $cache = null;
    if ($cache === null) {
        $raw = file_get_contents('php://input');
        $cache = json_decode($raw, true);
        if (!is_array($cache)) $cache = $_POST;
    }
    return $cache;
}

function require_fields($data, $fields) {
    foreach ($fields as $f) {
        if (!isset($data[$f]) || $data[$f] === '' || $data[$f] === null) {
            json_out(['success' => false, 'error' => ucfirst($f) . ' is required'], 400);
        }
    }
}

// Random unique 5-digit id (like the old generateUserId())
function unique_rand_id($pdo, $column) {
    for ($i = 0; $i < 25; $i++) {
        $v = (string)random_int(10000, 99999);
        $st = $pdo->prepare("SELECT id FROM users WHERE {$column} = ? LIMIT 1");
        $st->execute([$v]);
        if (!$st->fetch()) return $v;
    }
    return (string)time();
}

// ---- Row -> camelCase mappers (so the existing JS keeps working) ----
function map_user($u) {
    return [
        'id'                 => (int)$u['id'],
        'username'           => $u['username'],
        'name'               => $u['name'],
        'email'              => $u['email'] ?? '',
        'googleUid'          => $u['google_uid'] ?? '',
        'userId'             => $u['user_id'],
        'profileLogo'        => $u['profile_logo'],
        'balance'            => (float)$u['balance'],
        'totalDeposit'       => (float)$u['total_deposit'],
        'totalWithdraw'      => (float)$u['total_withdraw'],
        'totalWin'           => (float)$u['total_win'],
        'status'             => $u['status'],
        'referralCode'       => $u['referral_code'],
        'referredBy'         => $u['referred_by'],
        'referralCommission' => (float)$u['referral_commission'],
        'kycStatus'          => $u['kyc_status'],
        'createdAt'          => $u['created_at'],
    ];
}

function map_bet($b) {
    return [
        'id'           => (int)$b['id'],
        'creatorId'    => $b['creator_id'] !== null ? (int)$b['creator_id'] : null,
        'creatorName'  => $b['creator_name'],
        'creatorUserId'=> $b['creator_user_id'],
        'creatorLogo'  => $b['creator_logo'],
        'amount'       => (float)$b['amount'],
        'roomCode'     => $b['room_code'],
        'status'       => $b['status'],
        'joinerId'     => $b['joiner_id'] !== null ? (int)$b['joiner_id'] : null,
        'joinerName'   => $b['joiner_name'],
        'joinerLogo'   => $b['joiner_logo'],
        'createdAt'    => $b['created_at'],
    ];
}

function map_transaction($t) {
    return [
        'id'     => (int)$t['id'],
        'type'   => $t['type'],
        'amount' => (float)$t['amount'],
        'status' => $t['status'],
        'date'   => $t['date'],
        'details'=> $t['details'],
    ];
}

function map_mail($m) {
    return [
        'id'      => (int)$m['id'],
        'subject' => $m['subject'],
        'body'    => $m['body'],
        'from'    => $m['from_name'],
        'read'    => (bool)$m['is_read'],
        'date'    => date('d M Y, h:i A', strtotime($m['created_at'])),
    ];
}

// Fetch a user row by numeric id (with row lock inside a transaction when needed)
function get_user_row($pdo, $id, $forUpdate = false) {
    $sql = "SELECT * FROM users WHERE id = ?" . ($forUpdate ? " FOR UPDATE" : "");
    $st = $pdo->prepare($sql);
    $st->execute([(int)$id]);
    $u = $st->fetch();
    if (!$u) json_out(['success' => false, 'error' => 'User not found'], 404);
    return $u;
}
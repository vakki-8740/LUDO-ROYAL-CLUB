<?php
// =====================================================
// POST {amount, userId, userName, email, phone}
// -> amount whitelist check -> PENDING txn -> PayU form fields + HASH
// -> app hidden form PayU ko post karega (TEST/LIVE config se).
// Paisa yahan NAHI judta — sirf payu-return verify ke baad.
// =====================================================
require __DIR__ . '/firebase.php';

$cfg = fb_cfg();
fb_cors($cfg);

$ALLOWED = [100, 200, 300, 400, 500, 1000, 2000, 5000];

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];
    $amount = (int)($in['amount'] ?? 0);
    $userId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['userId'] ?? ''));
    $userName = substr(trim((string)($in['userName'] ?? 'Player')), 0, 60);
    $email = substr(trim((string)($in['email'] ?? 'noreply@example.com')), 0, 80);
    $phone = preg_replace('/[^0-9]/', '', (string)($in['phone'] ?? ''));
    if (!in_array($amount, $ALLOWED, true)) throw new Exception('Invalid amount');
    if ($userId === '') throw new Exception('userId chahiye');
    if ($phone === '') $phone = '9999999999';

    $key = $cfg['payu_key'] ?? '';
    $salt = $cfg['payu_salt'] ?? '';
    $base = rtrim($cfg['payu_base'] ?? 'https://test.payu.in', '/');
    $front = rtrim($cfg['frontend_base'] ?? '', '/');
    if ($key === '' || $salt === '' || $front === '') throw new Exception('Server config adhuri hai');

    $token = fb_token($cfg);
    $body = ['fields' => [
        'userId'   => ['stringValue' => $userId],
        'userName' => ['stringValue' => $userName],
        'type'     => ['stringValue' => 'Deposit'],
        'amount'   => ['integerValue' => (string)$amount],
        'status'   => ['stringValue' => 'Pending'],
        'details'  => ['mapValue' => ['fields' => ['method' => ['stringValue' => 'payu']]]],
        'date'     => ['stringValue' => date('d/m/Y')],
    ]];
    [$code, $j] = fs_curl('POST', fs_base($cfg) . '/transactions', $token, $body);
    if ($code !== 200 || !isset($j['name'])) throw new Exception('Order create fail');
    $parts = explode('/', $j['name']);
    $txnid = end($parts);

    $productinfo = 'Wallet Deposit';
    $hashStr = implode('|', [$key, $txnid, $amount, $productinfo, $userName, $email, '', '', '', '', '', '', '', '', '', $salt]);
    $hash = strtolower(hash('sha512', $hashStr));

    echo json_encode([
        'success'   => true,
        'txnId'     => $txnid,
        'payu_url'  => $base . '/_payment',
        'fields'    => [
            'key'         => $key,
            'txnid'       => $txnid,
            'amount'      => $amount,
            'productinfo' => $productinfo,
            'firstname'   => $userName,
            'email'       => $email,
            'phone'       => $phone,
            'surl'        => $front . '/?pay=' . $txnid . '&st=ok',
            'furl'        => $front . '/?pay=' . $txnid . '&st=fail',
            'hash'        => $hash,
        ],
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

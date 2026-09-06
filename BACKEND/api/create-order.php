<?php
// =====================================================
// POST {amount, userId, userName}
// -> amount server whitelist me hona chahiye (frontend trust nahi)
// -> Firestore me PENDING transaction banao (unique Order/Txn ID)
// -> {success, txnId}
// Paisa yahan NAHI judta — sirf webhook verify ke baad.
// =====================================================
require __DIR__ . '/firebase.php';

$cfg = fb_cfg();
fb_cors($cfg);

// Server-side allowed amounts (config me badal sakte ho)
$ALLOWED = [100, 200, 300, 400, 500, 1000, 2000, 5000];

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];
    $amount = (int)($in['amount'] ?? 0);
    $userId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['userId'] ?? ''));
    $userName = substr(trim((string)($in['userName'] ?? '')), 0, 80);
    if (!in_array($amount, $ALLOWED, true)) throw new Exception('Invalid amount');
    if ($userId === '') throw new Exception('userId chahiye');

    $token = fb_token($cfg);
    $base = fs_base($cfg);
    $body = ['fields' => [
        'userId'   => ['stringValue' => $userId],
        'userName' => ['stringValue' => $userName],
        'type'     => ['stringValue' => 'Deposit'],
        'amount'   => ['integerValue' => (string)$amount],
        'status'   => ['stringValue' => 'Pending'],
        'details'  => ['mapValue' => ['fields' => ['method' => ['stringValue' => 'paylink']]]],
        'date'     => ['stringValue' => date('d/m/Y')],
    ]];
    [$code, $j] = fs_curl('POST', $base . '/transactions', $token, $body);
    if ($code !== 200 || !isset($j['name'])) throw new Exception('Order create fail');
    $parts = explode('/', $j['name']);
    echo json_encode(['success' => true, 'txnId' => end($parts), 'amount' => $amount]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

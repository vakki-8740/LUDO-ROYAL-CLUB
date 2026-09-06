<?php
// =====================================================
// POST {txnId} -> {success, status, amount}
// Payment-success page YAHIN se asli status poochta hai.
// Redirect khulna = payment proof NAHI.
// =====================================================
require __DIR__ . '/firebase.php';

$cfg = fb_cfg();
fb_cors($cfg);

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];
    $txnId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['txnId'] ?? ''));
    if ($txnId === '') throw new Exception('txnId chahiye');

    $token = fb_token($cfg);
    $txn = fs_doc_get($cfg, $token, 'transactions/' . $txnId);
    if (!$txn) throw new Exception('Transaction nahi mili');
    echo json_encode([
        'success' => true,
        'status'  => $txn['status'] ?? 'Pending',
        'amount'  => (int)($txn['amount'] ?? 0),
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

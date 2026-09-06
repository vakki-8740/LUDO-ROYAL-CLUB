<?php
// =====================================================
// POST {amount, txnId, userId}
// -> Razorpay UPI QR (10 min valid, notes me txnId)
// -> {success, qr_id, image_url, close_by}
// QR tumhare apne page par dikhega (Razorpay page NAHI khulega).
// =====================================================
require __DIR__ . '/firebase.php';

$cfg = fb_cfg();
fb_cors($cfg);

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];
    $amount = (int)($in['amount'] ?? 0);
    $txnId  = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['txnId'] ?? ''));
    $userId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['userId'] ?? ''));
    if ($amount < 100) throw new Exception('Minimum deposit ₹100');
    if ($amount > 100000) throw new Exception('Amount zyada hai');
    if ($txnId === '' || $userId === '') throw new Exception('txnId/userId chahiye');

    [$code, $qr] = rzp_api($cfg, 'POST', '/payments/qr_codes', [
        'type'          => 'upi_qr',
        'usage'         => 'single_use',
        'fixed_amount'  => true,
        'payment_amount'=> $amount * 100, // paise
        'description'   => 'Ludo Royal Club deposit Rs.' . $amount,
        'close_by'      => time() + 600, // 10 min (app timer se match)
        'notes'         => ['txn' => $txnId, 'user' => $userId],
    ]);
    if ($code < 200 || $code >= 300 || !isset($qr['id'])) {
        throw new Exception('QR fail: ' . substr(json_encode($qr), 0, 200));
    }
    echo json_encode([
        'success'   => true,
        'qr_id'     => $qr['id'],
        'image_url' => $qr['image_url'] ?? '',
        'close_by'  => $qr['close_by'] ?? (time() + 600),
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

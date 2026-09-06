<?php
// =====================================================
// Razorpay WEBHOOK (Dashboard me URL lagao, event: payment.captured)
// Payment hote hi: signature check -> Firestore auto-credit.
// Tum offline raho tab bhi paisa khud jud jayega.
// =====================================================
require __DIR__ . '/firebase.php';

$cfg = fb_cfg();
// Webhook me CORS nahi chahiye, sirf JSON
header('Content-Type: application/json; charset=utf-8');

try {
    $raw = file_get_contents('php://input');
    $sig = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';
    $calc = hash_hmac('sha256', $raw, $cfg['webhook_secret'] ?? '');
    if ($sig === '' || !hash_equals($calc, $sig)) {
        throw new Exception('Bad signature');
    }
    $p = json_decode($raw, true) ?: [];
    $event = $p['event'] ?? '';
    $pay = $p['payload']['payment']['entity'] ?? null;
    if (!$pay) throw new Exception('No payment entity');

    // UPI auto-capture: captured (authorized ko backup rakha hai)
    $pstatus = $pay['status'] ?? '';
    if (!in_array($event, ['payment.captured', 'payment.authorized'], true)) {
        echo json_encode(['success' => true, 'skip' => 'event ' . $event]);
        exit;
    }
    if (!in_array($pstatus, ['captured', 'authorized'], true)) {
        echo json_encode(['success' => true, 'skip' => 'status ' . $pstatus]);
        exit;
    }

    $txnId = $pay['notes']['txn'] ?? '';
    $paidRs = (int)round(($pay['amount'] ?? 0) / 100);
    $payId = $pay['id'] ?? '';
    if ($txnId === '') throw new Exception('notes.txn missing');

    $token = fb_token($cfg);
    $txn = fs_doc_get($cfg, $token, 'transactions/' . $txnId);
    if (!$txn) throw new Exception('Transaction nahi mili');
    // Double-credit se bacho: sirf Pending wali
    if (($txn['status'] ?? '') !== 'Pending') {
        echo json_encode(['success' => true, 'skip' => 'already ' . ($txn['status'] ?? '')]);
        exit;
    }
    if ((int)($txn['amount'] ?? 0) !== $paidRs) {
        throw new Exception('Amount mismatch: txn ' . ($txn['amount'] ?? 0) . ' vs paid ' . $paidRs);
    }
    $uid = $txn['userId'] ?? '';
    if ($uid === '') throw new Exception('userId missing');
    $amt = (int)$txn['amount'];

    $txnName = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/transactions/' . $txnId;
    $userName = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/users/' . $uid;

    fs_commit($cfg, $token, [
        [
            'update' => [
                'name'   => $txnName,
                'fields' => [
                    'status' => ['stringValue' => 'Success'],
                    'details' => ['mapValue' => ['fields' => [
                        'method' => ['stringValue' => 'razorpay_qr'],
                        'razorpay_payment_id' => ['stringValue' => $payId],
                    ]]],
                ],
            ],
            'updateMask' => ['fieldPaths' => ['status', 'details']],
        ],
        [
            'updateTransforms' => [
                'document' => $userName,
                'fieldTransforms' => [
                    ['fieldPath' => 'balance', 'increment' => ['integerValue' => (string)$amt]],
                    ['fieldPath' => 'totalDeposit', 'increment' => ['integerValue' => (string)$amt]],
                ],
            ],
        ],
    ]);

    echo json_encode(['success' => true, 'credited' => $amt]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

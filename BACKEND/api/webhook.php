<?php
// =====================================================
// Razorpay WEBHOOK (Dashboard me URL lagao.
// Events: payment.captured (QR) + payment_link.paid (payment links).
// Verify: signature + order/link match + amount match + idempotent.
// Sirf verify ke BAAD wallet credit. Redirect = proof NAHI.
// =====================================================
require __DIR__ . '/firebase.php';

$cfg = fb_cfg();
// Webhook me CORS nahi chahiye, sirf JSON
header('Content-Type: application/json; charset=utf-8');

// Ek transaction ko ek hi baar credit (idempotency)
function credit_once($cfg, $token, $txnId, $payId, $method) {
    $txn = fs_doc_get($cfg, $token, 'transactions/' . $txnId);
    if (!$txn) throw new Exception('Transaction nahi mili');
    if (($txn['status'] ?? '') !== 'Pending') {
        echo json_encode(['success' => true, 'skip' => 'already ' . ($txn['status'] ?? '')]);
        exit;
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
                        'method' => ['stringValue' => $method],
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
    exit;
}

try {
    $raw = file_get_contents('php://input');
    $sig = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';
    $calc = hash_hmac('sha256', $raw, $cfg['webhook_secret'] ?? '');
    if ($sig === '' || !hash_equals($calc, $sig)) {
        throw new Exception('Bad signature');
    }
    $p = json_decode($raw, true) ?: [];
    $event = $p['event'] ?? '';

    // ---- A) Payment Links: payment_link.paid ----
    // NOTE: dashboard me haath se bani link me order ID nahi hota,
    // isliye match = signature + amount + 15-min window + single candidate.
    // Confusion ho to Pending rehta hai (admin manual approve = backup).
    if ($event === 'payment_link.paid') {
        $link = $p['payload']['payment_link']['entity'] ?? null;
        $pay = $p['payload']['payment']['entity'] ?? null;
        if (!$link || !$pay) throw new Exception('No link/payment entity');
        if (($link['status'] ?? '') !== 'paid') {
            echo json_encode(['success' => true, 'skip' => 'link not paid']);
            exit;
        }
        $paidRs = (int)round(($pay['amount'] ?? $link['amount_paid'] ?? 0) / 100);
        $payId = $pay['id'] ?? '';
        // txnId notes me ho to direct (API wali links), warna amount+window match
        $txnId = $link['notes']['txn'] ?? ($pay['notes']['txn'] ?? '');
        $token = fb_token($cfg);
        if ($txnId === '') {
            [$qc, $qj] = fs_curl('POST', fs_base($cfg) . ':runQuery', $token, [
                'structuredQuery' => [
                    'from' => [['collectionId' => 'transactions']],
                    'where' => ['fieldFilter' => [
                        'field' => ['fieldPath' => 'status'],
                        'op' => 'EQUAL',
                        'value' => ['stringValue' => 'Pending'],
                    ]],
                    'limit' => 50,
                ],
            ]);
            $cands = [];
            foreach (($qj && is_array($qj) ? $qj : []) as $row) {
                if (!isset($row['document']['fields'])) continue;
                $f = [];
                foreach ($row['document']['fields'] as $k => $v) $f[$k] = fs_val($v);
                if (($f['type'] ?? '') !== 'Deposit' || (int)($f['amount'] ?? 0) !== $paidRs) continue;
                $ts = $f['timestamp'] ?? null;
                $ms = 0;
                if (is_string($ts)) $ms = (int)(strtotime($ts) * 1000);
                if ($ms > 0 && (round(microtime(true) * 1000) - $ms) > 15 * 60 * 1000) continue;
                $parts = explode('/', $row['document']['name']);
                $cands[] = end($parts);
            }
            if (count($cands) !== 1) {
                echo json_encode(['success' => true, 'skip' => 'manual needed (' . count($cands) . ' candidates)']);
                exit;
            }
            $txnId = $cands[0];
        } else {
            $txn = fs_doc_get($cfg, $token, 'transactions/' . $txnId);
            if (!$txn) throw new Exception('Transaction nahi mili');
            if ((int)($txn['amount'] ?? 0) !== $paidRs) {
                throw new Exception('Amount mismatch: txn ' . ($txn['amount'] ?? 0) . ' vs paid ' . $paidRs);
            }
        }
        credit_once($cfg, $token, $txnId, $payId, 'paylink');
    }

    // ---- B) QR / direct: payment.captured ----
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
    if ((int)($txn['amount'] ?? 0) !== $paidRs) {
        throw new Exception('Amount mismatch: txn ' . ($txn['amount'] ?? 0) . ' vs paid ' . $paidRs);
    }
    credit_once($cfg, $token, $txnId, $payId, 'razorpay_qr');
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

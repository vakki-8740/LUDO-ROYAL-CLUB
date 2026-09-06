<?php
// =====================================================
// PayU RETURN (surl/furl dono yahin aate hain).
// 1) Response HASH verify (salt se) — nakli callback block.
// 2) Verify API se double-check (server-to-server, source of truth).
// 3) Dono OK + amount match + PENDING hi hai -> credit (idempotent).
// 4) Frontend success page par redirect (?pay=txnId).
// Redirect khulna = proof NAHI; success page backend status check karta hai.
// =====================================================
require __DIR__ . '/firebase.php';

$cfg = fb_cfg();
header('Content-Type: text/html; charset=utf-8');

function payu_go($front, $txnid, $ok) {
    $url = rtrim($front, '/') . '/?pay=' . urlencode($txnid) . ($ok ? '' : '&st=fail');
    header('Location: ' . $url);
    exit;
}

try {
    $in = $_POST;
    $txnid = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['txnid'] ?? ''));
    $status = strtolower(trim((string)($in['status'] ?? '')));
    if ($txnid === '') throw new Exception('txnid missing');

    $key = $cfg['payu_key'] ?? '';
    $salt = $cfg['payu_salt'] ?? '';
    $base = rtrim($cfg['payu_base'] ?? 'https://test.payu.in', '/');
    $front = rtrim($cfg['frontend_base'] ?? '', '/');
    if ($key === '' || $salt === '' || $front === '') throw new Exception('Server config adhuri');

    // --- 1) Response hash verify ---
    // sequence: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
    $seq = [$salt, $status, '', '', '', '', '', '', '', '', ''];
    $seq[] = $in['udf5'] ?? '';
    $seq[] = $in['udf4'] ?? '';
    $seq[] = $in['udf3'] ?? '';
    $seq[] = $in['udf2'] ?? '';
    $seq[] = $in['udf1'] ?? '';
    $seq[] = $in['email'] ?? '';
    $seq[] = $in['firstname'] ?? '';
    $seq[] = $in['productinfo'] ?? '';
    $seq[] = $in['amount'] ?? '';
    $seq[] = $in['txnid'] ?? '';
    $seq[] = $key;
    $calc = strtolower(hash('sha512', implode('|', $seq)));
    if (!isset($in['hash']) || !hash_equals($calc, strtolower($in['hash']))) {
        throw new Exception('Hash mismatch');
    }
    if ($status !== 'success') {
        // Fail: paisa mat chhedo, frontend ko fail dikhega
        payu_go($front, $txnid, false);
    }

    // --- 2) Verify API (source of truth) ---
    $vhash = strtolower(hash('sha512', implode('|', [$key, 'verify_payment', $txnid, $salt])));
    $ch = curl_init($base . '/merchant/postservice?form=2');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'key' => $key, 'command' => 'verify_payment',
            'hash' => $vhash, 'var1' => $txnid,
        ]),
        CURLOPT_TIMEOUT => 25,
    ]);
    $out = curl_exec($ch);
    curl_close($ch);
    $vj = json_decode((string)$out, true) ?: [];
    $td = $vj['transaction_details'][$txnid] ?? null;
    if (!$td) throw new Exception('Verify API: transaction nahi mili');
    if (strtolower($td['status'] ?? '') !== 'success') {
        payu_go($front, $txnid, false);
    }
    $paidRs = (int)round((float)($td['amt'] ?? $td['amount'] ?? 0));
    $payId = $td['mihpayid'] ?? '';

    // --- 3) Credit (idempotent: sirf Pending) ---
    $token = fb_token($cfg);
    $txn = fs_doc_get($cfg, $token, 'transactions/' . $txnid);
    if (!$txn) throw new Exception('Order nahi mila');
    if ((int)($txn['amount'] ?? 0) !== $paidRs) {
        throw new Exception('Amount mismatch');
    }
    if (($txn['status'] ?? '') === 'Pending') {
        $uid = $txn['userId'] ?? '';
        if ($uid === '') throw new Exception('userId missing');
        $amt = (int)$txn['amount'];
        $txnName = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/transactions/' . $txnid;
        $userName = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/users/' . $uid;
        fs_commit($cfg, $token, [
            ['update' => [
                'name' => $txnName,
                'fields' => [
                    'status' => ['stringValue' => 'Success'],
                    'details' => ['mapValue' => ['fields' => [
                        'method' => ['stringValue' => 'payu'],
                        'razorpay_payment_id' => ['stringValue' => $payId],
                    ]]],
                ],
            ], 'updateMask' => ['fieldPaths' => ['status', 'details']]],
            ['updateTransforms' => [
                'document' => $userName,
                'fieldTransforms' => [
                    ['fieldPath' => 'balance', 'increment' => ['integerValue' => (string)$amt]],
                    ['fieldPath' => 'totalDeposit', 'increment' => ['integerValue' => (string)$amt]],
                ],
            ]],
        ]);
    }
    payu_go($front, $txnid, true);
} catch (Exception $e) {
    // Fail safe: frontend fail page (paisa bilkul mat chhedo)
    try {
        $front = rtrim((fb_cfg()['frontend_base'] ?? ''), '/');
        if ($front !== '') { payu_go($front, preg_replace('/[^A-Za-z0-9_-]/', '', (string)($_POST['txnid'] ?? '')), false); }
    } catch (Exception $e2) {}
    http_response_code(400);
    echo 'Payment failed: ' . htmlspecialchars($e->getMessage());
}

<?php
// =====================================================
// LUDO ROYAL CLUB - Payment Server CONFIG
// Render par: Dashboard > Environment me neeche wali keys banao.
// (config.php git me NAHI jayegi — sirf TEMPLATE commit hota hai.)
//
// RENDER ENV VARS (same naam se banana):
//   RZP_KEY_ID, RZP_KEY_SECRET, WEBHOOK_SECRET,
//   FIREBASE_PROJECT_ID, FIREBASE_SERVICE_JSON,
//   ALLOWED_ORIGINS  (comma wali list chalegi)
// =====================================================

$env = function ($k, $d = '') {
    $v = getenv($k);
    return ($v === false || $v === '') ? $d : $v;
};

return [
    // Razorpay Dashboard > Settings > API Keys (TEST mode pehle)
    'rzp_key_id'     => $env('RZP_KEY_ID', 'rzp_test_PASTE_HERE'),
    'rzp_key_secret' => $env('RZP_KEY_SECRET', 'PASTE_SECRET_HERE'),

    // Razorpay Dashboard > Settings > Webhooks ka Secret (khud banaya hua)
    'webhook_secret' => $env('WEBHOOK_SECRET', 'PASTE_WEBHOOK_SECRET_HERE'),

    // Firebase Console > Project settings > Service accounts > JSON key
    'firebase_project_id'   => $env('FIREBASE_PROJECT_ID', 'ludojoy-ca35c'),
    'firebase_service_json' => $env('FIREBASE_SERVICE_JSON', '{ "type": "service_account", ... YAHAN_POORA_JSON ... }'),

    // Kaunse frontend ko allow karna hai
    'allowed_origins' => $env('ALLOWED_ORIGINS', 'https://ludoroyalclub.vercel.app'),
];

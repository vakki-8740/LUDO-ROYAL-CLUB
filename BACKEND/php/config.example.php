<?php
// =====================================================
// LUDO ROYAL CLUB - Payment Server CONFIG (TEMPLATE)
// STEP: is file ko copy karke naam rakho  config.php
// (same folder me), phir apni REAL values bharo.
// config.php git me NAHI jayegi (secret safe).
// =====================================================
return [
    // Razorpay Dashboard > Settings > API Keys (TEST mode pehle)
    'rzp_key_id'     => 'rzp_test_PASTE_HERE',
    'rzp_key_secret' => 'PASTE_SECRET_HERE',

    // Razorpay Dashboard > Settings > Webhooks > Add webhook
    // URL: https://TUMHARA-HOST/api/webhook.php, event: payment.captured
    // Wahan jo Secret banega wo yahan:
    'webhook_secret' => 'PASTE_WEBHOOK_SECRET_HERE',

    // Firebase Console > Project settings > Service accounts
    // > Generate new private key (JSON) — us file ka poora content:
    'firebase_project_id'   => 'ludojoy-ca35c',
    'firebase_service_json' => '{ "type": "service_account", ... YAHAN_POORA_JSON ... }',

    // Kaunse frontend ko allow karna hai (comma wali list bhi chalegi)
    'allowed_origins' => 'https://ludoroyalclub.vercel.app',
];

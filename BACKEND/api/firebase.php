<?php
// =====================================================
// Firebase Admin REST (composer nahi chahiye).
// Service-account JWT -> OAuth token -> Firestore REST.
// Sirf server par chalta hai (secret yahin rehta hai).
// =====================================================

function fb_b64url($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function fb_cfg() {
    $f = __DIR__ . '/config.php';
    if (!file_exists($f)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Server config missing (config.php banao)']);
        exit;
    }
    return require $f;
}

function fb_cors($cfg) {
    $allowed = array_map('trim', explode(',', $cfg['allowed_origins'] ?? ''));
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    }
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Content-Type: application/json; charset=utf-8');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
}

// OAuth access token (1 ghante cache)
function fb_token($cfg) {
    $cacheFile = sys_get_temp_dir() . '/lrc_fb_tok_' . md5($cfg['firebase_project_id']) . '.json';
    if (file_exists($cacheFile)) {
        $c = json_decode(@file_get_contents($cacheFile), true);
        if ($c && isset($c['exp']) && $c['exp'] > time() + 120 && isset($c['token'])) {
            return $c['token'];
        }
    }
    $sa = json_decode($cfg['firebase_service_json'], true);
    if (!$sa || !isset($sa['private_key'], $sa['client_email'])) {
        throw new Exception('Firebase service JSON galat hai');
    }
    $now = time();
    $header = fb_b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claim = fb_b64url(json_encode([
        'iss'   => $sa['client_email'],
        'scope' => 'https://www.googleapis.com/auth/datastore',
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now - 30,
        'exp'   => $now + 3600,
    ]));
    $sig = '';
    if (!openssl_sign($header . '.' . $claim, $sig, $sa['private_key'], OPENSSL_ALGO_SHA256)) {
        throw new Exception('JWT sign fail (openssl check karo)');
    }
    $jwt = $header . '.' . $claim . '.' . fb_b64url($sig);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
        CURLOPT_TIMEOUT => 20,
    ]);
    $out = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = json_decode((string)$out, true);
    if ($code !== 200 || !isset($j['access_token'])) {
        throw new Exception('Google token fail: ' . substr((string)$out, 0, 200));
    }
    @file_put_contents($cacheFile, json_encode(['token' => $j['access_token'], 'exp' => $now + 3500]));
    return $j['access_token'];
}

function fs_base($cfg) {
    return 'https://firestore.googleapis.com/v1/projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents';
}

function fs_curl($method, $url, $token, $body = null) {
    $ch = curl_init($url);
    $headers = ['Authorization: Bearer ' . $token, 'Content-Type: application/json'];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 25,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $out = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, json_decode((string)$out, true)];
}

// Firestore value -> simple PHP
function fs_val($v) {
    if (!is_array($v)) return null;
    if (isset($v['stringValue'])) return $v['stringValue'];
    if (isset($v['integerValue'])) return (int)$v['integerValue'];
    if (isset($v['doubleValue'])) return (float)$v['doubleValue'];
    if (isset($v['booleanValue'])) return (bool)$v['booleanValue'];
    if (isset($v['nullValue'])) return null;
    if (isset($v['mapValue'])) {
        $m = [];
        foreach (($v['mapValue']['fields'] ?? []) as $k => $vv) $m[$k] = fs_val($vv);
        return $m;
    }
    return null;
}

function fs_doc_get($cfg, $token, $path) {
    [$code, $j] = fs_curl('GET', fs_base($cfg) . '/' . $path, $token);
    if ($code === 404) return null;
    if ($code !== 200 || !isset($j['fields'])) throw new Exception('Firestore read fail');
    $doc = ['__name' => $j['name'] ?? ''];
    foreach ($j['fields'] as $k => $v) $doc[$k] = fs_val($v);
    return $doc;
}

// Commit (transforms + updates ek saath, atomic)
function fs_commit($cfg, $token, $writes) {
    [$code, $j] = fs_curl('POST', fs_base($cfg) . ':commit', $token, ['writes' => $writes]);
    if ($code !== 200) throw new Exception('Firestore write fail: ' . substr(json_encode($j), 0, 200));
    return $j;
}

function rzp_api($cfg, $method, $path, $body = null) {
    $ch = curl_init('https://api.razorpay.com/v1' . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_USERPWD => $cfg['rzp_key_id'] . ':' . $cfg['rzp_key_secret'],
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 25,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $out = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, json_decode((string)$out, true)];
}

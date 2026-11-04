<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

function admin_start_session(): void
{
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('store_admin');
    session_set_cookie_params([
        'lifetime'=>0,
        'path'=>'/',
        'secure'=>true,
        'httponly'=>true,
        'samesite'=>'Strict',
    ]);
    session_start();
}

function admin_require_login(): void
{
    if (empty($_SESSION['admin_authenticated'])) {
        api_json(['error'=>'Autenticação necessária.'], 401);
    }
}

admin_start_session();
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'csrf') {
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    api_json(['csrf'=>$_SESSION['csrf']]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'orders') {
    admin_require_login();
    $orders = api_db()->query('SELECT id, customer_name, customer_email, items_json, amount_cents, status, mp_payment_id, created_at, updated_at FROM orders ORDER BY created_at DESC LIMIT 500')->fetchAll();
    foreach ($orders as &$order) {
        $order['items'] = json_decode($order['items_json'], true) ?: [];
        unset($order['items_json']);
        $order['amount_cents'] = (int)$order['amount_cents'];
    }
    unset($order);
    api_json(['orders'=>$orders]);
}

api_require_method('POST');
api_require_same_origin(true);
$input = api_read_json();
$csrf = (string)($input['csrf'] ?? '');
if (empty($_SESSION['csrf']) || !hash_equals((string)$_SESSION['csrf'], $csrf)) {
    api_json(['error'=>'Sessão expirada. Atualize a página e tente novamente.'], 403);
}

if (($input['action'] ?? '') === 'login') {
    $passwordHash = api_env('ADMIN_PASSWORD_HASH');
    $password = $input['password'] ?? '';
    $db = api_db();
    $remoteAddress = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $clientKey = hash_hmac('sha256', $remoteAddress, $passwordHash !== '' ? $passwordHash : __FILE__);
    $attempt = $db->prepare('SELECT attempts, window_started FROM admin_login_attempts WHERE client_key=:client');
    $attempt->execute([':client'=>$clientKey]);
    $rate = $attempt->fetch();
    $now = time();
    if ($rate && (int)$rate['window_started'] > $now - 900 && (int)$rate['attempts'] >= 5) {
        api_json(['error'=>'Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.'], 429);
    }
    if (!is_string($password) || strlen($password) < 1 || strlen($password) > 1024
        || $passwordHash === '' || !password_verify($password, $passwordHash)) {
        $upsert = $db->prepare('
            INSERT INTO admin_login_attempts (client_key, attempts, window_started)
            VALUES (:client, 1, :now)
            ON CONFLICT(client_key) DO UPDATE SET
                attempts=CASE WHEN window_started <= :cutoff THEN 1 ELSE attempts + 1 END,
                window_started=CASE WHEN window_started <= :reset_cutoff THEN :now ELSE window_started END
        ');
        $upsert->execute([':client'=>$clientKey, ':now'=>$now, ':cutoff'=>$now - 900, ':reset_cutoff'=>$now - 900]);
        $db->prepare('DELETE FROM admin_login_attempts WHERE window_started <= :cutoff')->execute([':cutoff'=>$now - 900]);
        usleep(300000);
        api_json(['error'=>'Credenciais inválidas ou painel não configurado.'], 401);
    }
    $db->prepare('DELETE FROM admin_login_attempts WHERE client_key=:client')->execute([':client'=>$clientKey]);
    session_regenerate_id(true);
    $_SESSION['admin_authenticated'] = true;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    api_json(['authenticated'=>true, 'csrf'=>$_SESSION['csrf']]);
}

if (($input['action'] ?? '') === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', ['expires'=>time()-42000, 'path'=>$params['path'], 'secure'=>$params['secure'], 'httponly'=>true, 'samesite'=>'Strict']);
    }
    session_destroy();
    api_json(['authenticated'=>false]);
}

api_json(['error'=>'Ação inválida.'], 400);

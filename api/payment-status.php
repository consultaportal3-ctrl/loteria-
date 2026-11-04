<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

api_require_method('GET');
$token = $_GET['token'] ?? '';
if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
    api_json(['error' => 'Pedido não encontrado.'], 404);
}
$query = api_db()->prepare('SELECT status, amount_cents, expires_at, created_at, updated_at FROM orders WHERE token_hash=:token');
$query->execute([':token'=>hash('sha256', $token)]);
$order = $query->fetch();
if (!$order) {
    api_json(['error' => 'Pedido não encontrado.'], 404);
}
api_json([
    'status'=>$order['status'],
    'amount'=>(int)$order['amount_cents'],
    'expiresAt'=>$order['expires_at'],
    'updatedAt'=>$order['updated_at'],
]);

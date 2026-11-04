<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

api_require_method('POST');
$secret = api_env('MP_WEBHOOK_SECRET');
$signature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
$requestId = $_SERVER['HTTP_X_REQUEST_ID'] ?? '';
$dataId = $_GET['data_id'] ?? $_GET['data.id'] ?? '';
if ($secret === '' || $signature === '' || $requestId === '' || !is_string($dataId) || $dataId === '') {
    api_json(['error' => 'Notificação inválida.'], 401);
}
$parts = [];
foreach (explode(',', $signature) as $part) {
    $pair = explode('=', trim($part), 2);
    if (count($pair) === 2) {
        $parts[$pair[0]] = $pair[1];
    }
}
$timestamp = $parts['ts'] ?? '';
$provided = $parts['v1'] ?? '';
if (!ctype_digit($timestamp) || !preg_match('/^[a-f0-9]{64}$/i', $provided) || abs(time() - (int)$timestamp) > 300) {
    api_json(['error' => 'Assinatura inválida ou expirada.'], 401);
}
$manifest = 'id:' . strtolower($dataId) . ';request-id:' . $requestId . ';ts:' . $timestamp . ';';
$expected = hash_hmac('sha256', $manifest, $secret);
if (!hash_equals($expected, strtolower($provided))) {
    api_json(['error' => 'Assinatura inválida.'], 401);
}
$event = api_read_json();
$eventId = $requestId;
$paymentId = (string)$dataId;
if (($event['type'] ?? '') !== 'payment' || strlen($eventId) > 200 || !preg_match('/^\d+$/', $paymentId)) {
    api_json(['error' => 'Notificação incompleta.'], 400);
}
$db = api_db();
$exists = $db->prepare('SELECT 1 FROM webhook_events WHERE event_id=:event');
$exists->execute([':event'=>$eventId]);
if ($exists->fetchColumn()) {
    api_json(['received'=>true]);
}

$token = api_require_test_gateway();
[$status, $payment] = api_mp_request($token, 'GET', '/v1/payments/' . rawurlencode($paymentId));
if ($status < 200 || $status >= 300 || (string)($payment['id'] ?? '') !== $paymentId) {
    error_log('Mercado Pago webhook could not validate payment ' . $paymentId . ', HTTP ' . $status);
    api_json(['error' => 'Pagamento não pôde ser validado.'], 502);
}
$orderId = (string)($payment['external_reference'] ?? '');
$query = $db->prepare('SELECT id, amount_cents, status, mp_payment_id FROM orders WHERE id=:id');
$query->execute([':id'=>$orderId]);
$order = $query->fetch();
if (!$order
    || ($order['mp_payment_id'] !== null && (string)$order['mp_payment_id'] !== $paymentId)
    || ($payment['currency_id'] ?? '') !== 'BRL'
    || !isset($payment['transaction_amount'])
    || (int)round((float)$payment['transaction_amount'] * 100) !== (int)$order['amount_cents']
    || (($payment['metadata']['order_id'] ?? '') !== $orderId)) {
    api_json(['error' => 'O pagamento não corresponde ao pedido.'], 409);
}

$paymentStatus = (string)($payment['status'] ?? '');
$allowed = ['approved','pending','rejected','cancelled','refunded','charged_back','in_process'];
if (!in_array($paymentStatus, $allowed, true)) {
    api_json(['error' => 'Status de pagamento não reconhecido.'], 422);
}
$db->beginTransaction();
try {
    $db->prepare('INSERT INTO webhook_events (event_id,payment_id,received_at) VALUES (:event,:payment,:received)')
        ->execute([':event'=>$eventId, ':payment'=>$paymentId, ':received'=>api_now()]);
    $finalStatuses = ['refunded','charged_back'];
    if (!in_array($order['status'], $finalStatuses, true)
        && ($order['status'] !== 'approved' || in_array($paymentStatus, ['approved','refunded','charged_back'], true))) {
        $update = $db->prepare('UPDATE orders SET status=:status, mp_payment_id=:payment_value, updated_at=:updated WHERE id=:id AND (mp_payment_id IS NULL OR mp_payment_id=:payment_guard)');
        $update->execute([':status'=>$paymentStatus, ':payment_value'=>$paymentId, ':payment_guard'=>$paymentId, ':updated'=>api_now(), ':id'=>$orderId]);
        if ($update->rowCount() !== 1) {
            $db->rollBack();
            api_json(['error' => 'O pedido foi alterado durante a confirmação.'], 409);
        }
    } elseif ($order['mp_payment_id'] === null) {
        $update = $db->prepare('UPDATE orders SET mp_payment_id=:payment_value, updated_at=:updated WHERE id=:id AND mp_payment_id IS NULL');
        $update->execute([':payment_value'=>$paymentId, ':updated'=>api_now(), ':id'=>$orderId]);
        if ($update->rowCount() !== 1) {
            $db->rollBack();
            api_json(['error' => 'O pedido foi alterado durante a confirmação.'], 409);
        }
    }
    $db->commit();
} catch (Throwable $error) {
    $db->rollBack();
    error_log('Webhook order update failed: ' . $error->getMessage());
    api_json(['error' => 'Não foi possível registrar a notificação.'], 503);
}
api_json(['received'=>true]);

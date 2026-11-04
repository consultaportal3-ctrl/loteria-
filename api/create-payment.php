<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

api_require_method('POST');
api_require_same_origin(true);
$input = api_read_json();
$buyer = $input['buyer'] ?? null;
if (!is_array($buyer)) {
    api_json(['error' => 'Informe os dados do comprador.'], 422);
}
$name = trim((string)($buyer['name'] ?? ''));
$email = trim((string)($buyer['email'] ?? ''));
$nameParts = preg_split('/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY);
if (mb_strlen($name, 'UTF-8') < 3 || mb_strlen($name, 'UTF-8') > 100 || !is_array($nameParts) || count($nameParts) < 2
    || filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($email) > 254) {
    api_json(['error' => 'Informe seu nome completo e um e-mail válido.'], 422);
}
[$items, $amountCents] = api_price_items($input['items'] ?? null);
$token = api_require_test_gateway();
$baseUrl = api_env('APP_BASE_URL');
$base = parse_url($baseUrl);
if (!is_array($base) || ($base['scheme'] ?? '') !== 'https' || empty($base['host'])) {
    api_json(['error' => 'Configure APP_BASE_URL como o endereço HTTPS público do ambiente de testes.'], 503);
}
$business = api_public_business_config();
$operator = $business['publicName'];
if (api_env('MP_WEBHOOK_SECRET') === '') {
    api_json(['error' => 'Configure a assinatura de webhook do Mercado Pago no servidor antes de gerar o PIX.'], 503);
}

$orderId = bin2hex(random_bytes(16));
$publicToken = bin2hex(random_bytes(32));
$now = api_now();
$db = api_db();
$insert = $db->prepare('INSERT INTO orders (id, token_hash, customer_name, customer_email, items_json, amount_cents, status, created_at, updated_at) VALUES (:id,:token,:name,:email,:items,:amount,:status,:created,:updated)');
$insert->execute([
    ':id'=>$orderId, ':token'=>hash('sha256', $publicToken), ':name'=>$name,
    ':email'=>$email, ':items'=>json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ':amount'=>$amountCents, ':status'=>'creating', ':created'=>$now, ':updated'=>$now,
]);

$notificationUrl = rtrim($baseUrl, '/') . '/api/webhook.php';
$payload = [
    'transaction_amount' => $amountCents / 100,
    'description' => 'Pedido de demonstração - ' . $operator,
    'payment_method_id' => 'pix',
    'payer' => ['email'=>$email, 'first_name'=>array_shift($nameParts), 'last_name'=>implode(' ', $nameParts)],
    'external_reference' => $orderId,
    'notification_url' => $notificationUrl,
    'metadata' => ['order_id'=>$orderId, 'environment'=>'test'],
];
[$status, $payment] = api_mp_request($token, 'POST', '/v1/payments', $payload, $orderId);
$transaction = $payment['point_of_interaction']['transaction_data'] ?? [];
$paymentId = isset($payment['id']) ? (string)$payment['id'] : null;
$qr = is_array($transaction) ? ($transaction['qr_code'] ?? null) : null;
$qrImage = is_array($transaction) ? ($transaction['qr_code_base64'] ?? null) : null;
if ($status < 200 || $status >= 300 || $paymentId === null || !is_string($qr) || !is_string($qrImage)) {
    $update = $db->prepare("UPDATE orders SET status='failed', updated_at=:updated WHERE id=:id");
    $update->execute([':updated'=>api_now(), ':id'=>$orderId]);
    error_log('Mercado Pago did not create a PIX payment; HTTP ' . $status . ', order ' . $orderId);
    api_json(['error' => 'Não foi possível criar o PIX de teste. Confira a configuração do Mercado Pago.'], 502);
}

$update = $db->prepare("UPDATE orders SET status=CASE WHEN status IN ('approved','refunded','charged_back') THEN status ELSE :status END, mp_payment_id=:payment_value, qr_code=:qr, qr_base64=:image, expires_at=:expires, updated_at=:updated WHERE id=:id AND (mp_payment_id IS NULL OR mp_payment_id=:payment_guard)");
$update->execute([
    ':status'=>$payment['status'] ?? 'pending', ':payment_value'=>$paymentId, ':payment_guard'=>$paymentId, ':qr'=>$qr,
    ':image'=>$qrImage, ':expires'=>$payment['date_of_expiration'] ?? null,
    ':updated'=>api_now(), ':id'=>$orderId,
]);
if ($update->rowCount() !== 1) {
    error_log('Payment creation could not link the Mercado Pago payment to order ' . $orderId);
    api_json(['error' => 'Não foi possível vincular o PIX ao pedido. Entre em contato com o suporte.'], 503);
}
api_json([
    'orderId'=>$orderId,
    'orderToken'=>$publicToken,
    'status'=>$payment['status'] ?? 'pending',
    'amount'=>$amountCents,
    'qrCode'=>$qr,
    'qrCodeBase64'=>$qrImage,
    'expiresAt'=>$payment['date_of_expiration'] ?? null,
    'environment'=>'test',
    'operator'=>$operator,
    'legalName'=>$business['legalName'],
    'taxId'=>$business['taxId'],
    'address'=>$business['address'],
    'contactEmail'=>$business['contactEmail'],
    'privacyUrl'=>$business['privacyUrl'],
    'termsUrl'=>$business['termsUrl'],
]);

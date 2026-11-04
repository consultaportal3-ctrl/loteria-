<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

api_require_method('GET');
api_require_test_gateway();
$baseUrl = api_env('APP_BASE_URL');
$base = parse_url($baseUrl);
if (!is_array($base) || ($base['scheme'] ?? '') !== 'https' || empty($base['host'])) {
    api_json(['error' => 'O checkout está indisponível: configure APP_BASE_URL com o endereço HTTPS público do ambiente de testes.'], 503);
}
if (api_env('MP_WEBHOOK_SECRET') === '') {
    api_json(['error' => 'O checkout está indisponível até configurar a assinatura Webhook do Mercado Pago.'], 503);
}
api_db();
$business = api_public_business_config();
api_json(['environment'=>'test'] + $business);

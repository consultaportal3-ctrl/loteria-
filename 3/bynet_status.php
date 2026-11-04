<?php
http_response_code(410);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode(['ok'=>false,'error'=>'Este checkout foi desativado. Consulte apenas pedidos do ambiente de testes no painel.']);

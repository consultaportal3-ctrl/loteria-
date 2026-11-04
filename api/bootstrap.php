<?php
declare(strict_types=1);

const API_MAX_BODY_BYTES = 65536;

function api_json(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function api_require_method(string ...$methods): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        api_json(['error' => 'Método não permitido.'], 405);
    }
}

function api_read_json(): array
{
    $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > API_MAX_BODY_BYTES) {
        api_json(['error' => 'Requisição muito grande.'], 413);
    }

    $raw = file_get_contents('php://input', false, null, 0, API_MAX_BODY_BYTES + 1);
    if ($raw === false || strlen($raw) > API_MAX_BODY_BYTES) {
        api_json(['error' => 'Requisição inválida.'], 400);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        api_json(['error' => 'JSON inválido.'], 400);
    }
    return $data;
}

function api_require_same_origin(bool $required = false): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        if ($required) {
            api_json(['error' => 'A origem da requisição não pôde ser validada.'], 403);
        }
        return;
    }
    $isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && $_SERVER['HTTPS'] !== 'off';
    $requestScheme = $isHttps ? 'https' : 'http';
    $originParts = parse_url($origin);
    $requestParts = parse_url($requestScheme . '://' . ($_SERVER['HTTP_HOST'] ?? ''));
    if (!is_array($originParts) || !is_array($requestParts)
        || strtolower((string)($originParts['scheme'] ?? '')) !== $requestScheme
        || strcasecmp((string)($originParts['host'] ?? ''), (string)($requestParts['host'] ?? '')) !== 0
        || (int)($originParts['port'] ?? ($requestScheme === 'https' ? 443 : 80))
            !== (int)($requestParts['port'] ?? ($requestScheme === 'https' ? 443 : 80))) {
        api_json(['error' => 'Origem não autorizada.'], 403);
    }
}

function api_env(string $name, string $default = ''): string
{
    $value = getenv($name);
    return $value === false ? $default : trim($value);
}

function api_public_business_config(): array
{
    $config = [
        'publicName'=>api_env('BUSINESS_PUBLIC_NAME'),
        'legalName'=>api_env('BUSINESS_LEGAL_NAME'),
        'taxId'=>strtoupper(api_env('BUSINESS_CNPJ')),
        'address'=>api_env('BUSINESS_ADDRESS'),
        'contactEmail'=>api_env('BUSINESS_CONTACT_EMAIL'),
        'privacyUrl'=>api_env('BUSINESS_PRIVACY_URL'),
        'termsUrl'=>api_env('BUSINESS_TERMS_URL'),
    ];
    foreach ($config as $value) {
        if ($value === '') {
            api_json(['error' => 'Configure a identidade jurídica, contato e políticas públicas do operador antes de habilitar o checkout.'], 503);
        }
    }
    if (!preg_match('/^[A-Z0-9]{12}\d{2}$/', $config['taxId'])
        || filter_var($config['contactEmail'], FILTER_VALIDATE_EMAIL) === false
        || filter_var($config['privacyUrl'], FILTER_VALIDATE_URL) === false
        || filter_var($config['termsUrl'], FILTER_VALIDATE_URL) === false
        || parse_url($config['privacyUrl'], PHP_URL_SCHEME) !== 'https'
        || parse_url($config['termsUrl'], PHP_URL_SCHEME) !== 'https') {
        api_json(['error' => 'CNPJ, contato e políticas do operador devem estar válidos e públicos via HTTPS.'], 503);
    }
    return $config;
}

function api_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dataDir = api_env('APP_DATA_DIR');
    if ($dataDir === '' || !is_dir($dataDir) || !is_writable($dataDir)) {
        api_json(['error' => 'O armazenamento seguro do servidor não está configurado.'], 503);
    }
    $realDataDir = realpath($dataDir);
    $publicRoot = realpath(dirname(__DIR__));
    if ($realDataDir === false || $publicRoot === false) {
        api_json(['error' => 'O armazenamento do servidor não pôde ser validado.'], 503);
    }
    $rootPrefix = rtrim(str_replace('\\', '/', $publicRoot), '/') . '/';
    $normalizedDataDir = rtrim(str_replace('\\', '/', $realDataDir), '/') . '/';
    if (str_starts_with(strtolower($normalizedDataDir), strtolower($rootPrefix))) {
        api_json(['error' => 'APP_DATA_DIR deve ficar fora da pasta pública do site.'], 503);
    }
    if (!chmod($realDataDir, 0700)) {
        api_json(['error' => 'Não foi possível restringir o acesso ao diretório de pedidos.'], 503);
    }

    try {
        $pdo = new PDO('sqlite:' . $realDataDir . DIRECTORY_SEPARATOR . 'store.sqlite', null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA busy_timeout = 5000');
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                token_hash TEXT NOT NULL UNIQUE,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                items_json TEXT NOT NULL,
                amount_cents INTEGER NOT NULL,
                status TEXT NOT NULL,
                mp_payment_id TEXT UNIQUE,
                qr_code TEXT,
                qr_base64 TEXT,
                expires_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )'
        );
        if (!chmod($realDataDir . DIRECTORY_SEPARATOR . 'store.sqlite', 0600)) {
            api_json(['error' => 'Não foi possível restringir as permissões do banco de pedidos.'], 503);
        }
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS webhook_events (
                event_id TEXT PRIMARY KEY,
                payment_id TEXT NOT NULL,
                received_at TEXT NOT NULL
            )'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS admin_login_attempts (
                client_key TEXT PRIMARY KEY,
                attempts INTEGER NOT NULL,
                window_started INTEGER NOT NULL
            )'
        );
    } catch (Throwable $error) {
        error_log('Store database initialization failed: ' . $error->getMessage());
        api_json(['error' => 'O armazenamento do servidor está indisponível.'], 503);
    }
    return $pdo;
}

function api_choose(int $n, int $k): int
{
    if ($k < 0 || $n < $k) {
        return 0;
    }
    $result = 1;
    for ($i = 1; $i <= $k; $i++) {
        $result = (int)round($result * ($n - $i + 1) / $i);
    }
    return $result;
}

function api_valid_numbers(mixed $numbers, int $minCount, int $maxCount, int $minValue, int $maxValue): bool
{
    return is_array($numbers)
        && count($numbers) >= $minCount
        && count($numbers) <= $maxCount
        && count(array_unique($numbers, SORT_REGULAR)) === count($numbers)
        && array_reduce($numbers, static fn(bool $valid, mixed $number): bool =>
            $valid && is_int($number) && $number >= $minValue && $number <= $maxValue, true);
}

function api_price_items(mixed $items): array
{
    if (!is_array($items) || count($items) < 1 || count($items) > 30) {
        api_json(['error' => 'O carrinho deve conter de 1 a 30 combinações.'], 422);
    }
    $prices = [
        'mega' => [600, 6, 20, 1, 60, [1,2,3,4,6,8,9,12]],
        'facil' => [350, 15, 20, 1, 25, [1,2,3,4,6,8,9,12,18,24]],
        'quina' => [300, 5, 15, 1, 80, [1,3,6,12,18,24]],
        'milionaria' => [600, 6, 12, 1, 50, [1,2,3,4,5]],
        'mania' => [300, 50, 50, 0, 99, [1,2,3,4,6,8,9,12]],
        'timemania' => [350, 10, 10, 1, 80, [1,3,6,9,12]],
        'dupla' => [300, 6, 15, 1, 50, [1,2,3,4,6,8,9,12]],
        'dia' => [250, 7, 15, 1, 31, [1,3,6,9,12,18,24]],
    ];
    $names = [
        'mega' => 'Mega-Sena', 'facil' => 'Lotofácil', 'quina' => 'Quina',
        'milionaria' => '+Milionária', 'mania' => 'Lotomania', 'timemania' => 'Timemania',
        'dupla' => 'Dupla Sena', 'dia' => 'Dia de Sorte', 'loteca' => 'Loteca',
        'super' => 'Super Sete',
    ];
    $total = 0;
    $normalized = [];

    foreach ($items as $item) {
        if (!is_array($item) || !is_string($item['game'] ?? null) || !isset($names[$item['game']])) {
            api_json(['error' => 'O carrinho contém uma modalidade inválida.'], 422);
        }
        $game = $item['game'];
        $repeats = $item['repeats'] ?? 1;
        if (!is_int($repeats) || $repeats < 1 || $repeats > 24) {
            api_json(['error' => 'A quantidade de concursos é inválida.'], 422);
        }
        $price = 0;
        $description = $names[$game];
        if ($game === 'loteca') {
            $picks = $item['picks'] ?? null;
            if (!is_array($picks) || count($picks) !== 14 || array_reduce($picks, static fn(bool $ok, mixed $pick): bool => $ok && is_int($pick) && $pick >= 1 && $pick <= 7, true) !== true) {
                api_json(['error' => 'Os palpites da Loteca são inválidos.'], 422);
            }
            $doubles = count(array_filter($picks, static fn(int $pick): bool => count(array_filter([1,2,4], static fn(int $bit): bool => ($pick & $bit) !== 0)) === 2));
            $triples = count(array_filter($picks, static fn(int $pick): bool => $pick === 7));
            $limits = [9,8,6,5,3,1,0];
            if ($triples > 6 || $doubles > $limits[$triples] || ($doubles === 0 && $triples === 0)) {
                api_json(['error' => 'A aposta da Loteca excede os limites de duplos ou triplos.'], 422);
            }
            $price = 200 * (2 ** $doubles) * (3 ** $triples);
            $normalized[] = ['game'=>$game,'name'=>$description,'picks'=>$picks,'repeats'=>1];
        } elseif ($game === 'super') {
            $columns = $item['columns'] ?? null;
            if (!is_array($columns) || count($columns) !== 7 || !in_array($repeats, [1,3,6,9,12], true)
                || array_reduce($columns, static fn(bool $valid, mixed $column): bool => $valid && is_array($column), true) !== true) {
                api_json(['error' => 'A aposta do Super Sete é inválida.'], 422);
            }
            $digits = 0;
            $combinations = 1;
            foreach ($columns as $column) {
                if (!is_array($column) || count($column) < 1 || count($column) > 3 || count(array_unique($column, SORT_REGULAR)) !== count($column)
                    || array_reduce($column, static fn(bool $ok, mixed $digit): bool => $ok && is_int($digit) && $digit >= 0 && $digit <= 9, true) !== true) {
                    api_json(['error' => 'As colunas do Super Sete são inválidas.'], 422);
                }
                $digits += count($column);
                $combinations *= count($column);
            }
            if (($digits <= 14 && count(array_filter($columns, static fn(array $column): bool => count($column) > 2)) > 0)
                || ($digits > 14 && count(array_filter($columns, static fn(array $column): bool => count($column) < 2)) > 0)) {
                api_json(['error' => 'A distribuição do Super Sete é inválida.'], 422);
            }
            $price = 300 * $combinations * $repeats;
            $normalized[] = ['game'=>$game,'name'=>$description,'columns'=>$columns,'repeats'=>$repeats];
        } else {
            [$unitPrice,$minCount,$maxCount,$minValue,$maxValue,$repeatOptions] = $prices[$game];
            $numbers = $item['numbers'] ?? null;
            if (!in_array($repeats, $repeatOptions, true)
                || !api_valid_numbers($numbers, $minCount, $maxCount, $minValue, $maxValue)) {
                api_json(['error' => 'Os números ou a quantidade de concursos são inválidos.'], 422);
            }
            $price = $unitPrice * api_choose(count($numbers), $minCount) * $repeats;
            $entry = ['game'=>$game,'name'=>$description,'numbers'=>$numbers,'repeats'=>$repeats];
            if ($game === 'milionaria') {
                $trevos = $item['trevos'] ?? null;
                if (!api_valid_numbers($trevos, 2, 6, 1, 6)) {
                    api_json(['error' => 'Os trevos da +Milionária são inválidos.'], 422);
                }
                $price *= api_choose(count($trevos), 2);
                $entry['trevos'] = $trevos;
            }
            if ($game === 'dia' && (!is_int($item['month'] ?? null) || $item['month'] < 0 || $item['month'] > 11)) {
                api_json(['error' => 'O mês da sorte é inválido.'], 422);
            }
            if ($game === 'dia') {
                $entry['month'] = $item['month'];
            }
            if ($game === 'timemania' && (!is_string($item['team'] ?? null) || trim($item['team']) === '' || strlen($item['team']) > 320)) {
                api_json(['error' => 'Informe o Time do Coração.'], 422);
            }
            if ($game === 'timemania') {
                $entry['team'] = trim($item['team']);
            }
            if ($game === 'mega' && ($item['special'] ?? '') === 'virada') {
                $entry['special'] = 'virada';
                $entry['repeats'] = 1;
                $price = $unitPrice * api_choose(count($numbers), $minCount);
            }
            $normalized[] = $entry;
        }
        if ($price <= 0 || $price > 20000000) {
            api_json(['error' => 'O valor da combinação está fora do limite permitido.'], 422);
        }
        $total += $price;
    }
    if ($total < 100 || $total > 20000000) {
        api_json(['error' => 'O total do pedido deve estar entre R$ 1,00 e R$ 200.000,00.'], 422);
    }
    return [$normalized, $total];
}

function api_now(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

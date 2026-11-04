<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

api_require_method('GET');
api_json(api_public_business_config());

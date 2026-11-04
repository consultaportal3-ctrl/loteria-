<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
api_json(['error'=>'Endpoint legado desativado. Utilize o simulador local BlackCat.', 'simulation'=>true], 410);

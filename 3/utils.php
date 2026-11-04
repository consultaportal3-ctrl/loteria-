<?php
function makeCurlRequest($url, $method = 'POST', $data = [], $headers = []) {
    $ch = curl_init();

    $defaultHeaders = [
        'Content-Type: application/json'
    ];

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    if (!empty($data)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge($defaultHeaders, $headers));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if (curl_errno($ch)) {
        return [
            'status' => 500,
            'error' => curl_error($ch),
            'data' => null
        ];
    }

    curl_close($ch);

    return [
        'status' => $httpCode,
        'data' => $response
    ];
}

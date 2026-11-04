<?php
class DataValidator {
    public function sanitizeValue($value) {
        return preg_replace('/[^\d.,]/', '', $value);
    }

    public function sanitizeEmail($email) {
        return filter_var($email, FILTER_SANITIZE_EMAIL);
    }

    public function validateMonetaryValue($value) {
        if (!preg_match('/^\d+([.,]\d{1,2})?$/', $value)) {
            throw new ApiException('Valor inválido', 400, 'INVALID_VALUE');
        }
    }

    public function validateEmail($email) {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new ApiException('Email inválido', 400, 'INVALID_EMAIL');
        }
    }
}

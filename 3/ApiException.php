<?php
class ApiException extends Exception {
    protected $errorCode;

    public function __construct($message, $code = 400, $errorCode = 'API_ERROR') {
        parent::__construct($message, $code);
        $this->errorCode = $errorCode;
    }

    public function getErrorCode() {
        return $this->errorCode;
    }
}

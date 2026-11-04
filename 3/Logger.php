<?php
class Logger {
    private $logDir;

    public function __construct($logDir) {
        $this->logDir = rtrim($logDir, '/');
        if (!is_dir($this->logDir)) {
            mkdir($this->logDir, 0777, true);
        }
    }

    public function logError($error) {
        $logFile = $this->logDir . '/error_' . date('Y-m-d') . '.log';
        $message = "[" . date('Y-m-d H:i:s') . "] ";

        if ($error instanceof Throwable || $error instanceof Exception) {
            $message .= $error->getMessage() . "\n" . $error->getTraceAsString() . "\n";
        } else {
            $message .= print_r($error, true) . "\n";
        }

        file_put_contents($logFile, $message, FILE_APPEND);
    }
}

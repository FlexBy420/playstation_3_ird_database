<?php
$file = $_GET['file'];
$filePath = __DIR__ . DIRECTORY_SEPARATOR . $file;

if (file_exists($filePath)) {
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . basename($file) . '"');
    readfile($filePath);
} else {
    echo 'File not found.';
}
?>
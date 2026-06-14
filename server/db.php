<?php
/**
 * KẾT NỐI DATABASE — dự án DATN (Hotel Booking).
 *
 * Cách dùng trong file PHP khác:
 *     require __DIR__ . '/db.php';
 *     $rows = $pdo->query('SELECT * FROM rooms')->fetchAll();
 *
 * Thông số mặc định khớp với Laragon (root / không mật khẩu / database "datn").
 * Nếu máy bạn khác, chỉ cần sửa 4 dòng cấu hình bên dưới.
 */

$DB_HOST = '127.0.0.1';   // hoặc 'localhost'
$DB_NAME = 'datn';        // tên database đã import từ hotelbookingdb.sql
$DB_USER = 'root';
$DB_PASS = '';            // Laragon mặc định để trống

try {
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,   // báo lỗi rõ ràng
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,         // trả về mảng kết hợp
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    // Dừng và in lỗi để dễ chẩn đoán (chưa bật MySQL, sai mật khẩu, chưa import SQL...)
    die('❌ Kết nối database thất bại: ' . $e->getMessage());
}

// Sau dòng này, biến $pdo đã sẵn sàng để dùng.

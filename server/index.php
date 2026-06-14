<?php
/**
 * Trang kiểm tra kết nối database.
 * Mở http://localhost:8000 (khi chạy bằng start.bat) để xem kết nối có thành công không.
 */
require __DIR__ . '/db.php';

// Lấy danh sách bảng để xác nhận đã import SQL đúng.
$tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
?>
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Kiểm tra kết nối DATN</title>
  <style>
    body { font-family: system-ui, Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; color: #1f2933; }
    .ok { background: #e6f4ea; border: 1px solid #34a853; color: #137333; padding: 14px 18px; border-radius: 8px; font-size: 18px; }
    code { background: #f1f3f4; padding: 2px 6px; border-radius: 4px; }
    ul { columns: 2; }
    li { margin: 2px 0; }
    .meta { color: #5f6368; margin-top: 8px; }
  </style>
</head>
<body>
  <h1>DATN — Hotel Booking</h1>
  <p class="ok">✅ Kết nối database thành công!</p>
  <p class="meta">
    Database: <code>datn</code> &middot;
    Số bảng: <strong><?= count($tables) ?></strong> &middot;
    PHP: <code><?= PHP_VERSION ?></code>
  </p>

  <h3>Danh sách bảng</h3>
  <ul>
    <?php foreach ($tables as $t): ?>
      <li><?= htmlspecialchars($t) ?></li>
    <?php endforeach; ?>
  </ul>

  <p class="meta">
    File kết nối dùng chung: <code>server/db.php</code> —
    các thành viên chỉ cần <code>require 'db.php';</code> rồi dùng biến <code>$pdo</code>.
  </p>
</body>
</html>

# Kết nối Database — DATN (Hotel Booking)

Phần này chỉ lo **kết nối tới MySQL** bằng PHP (PDO). Logic nghiệp vụ do các thành viên tự viết thêm.

## Có gì trong thư mục này

| File | Công dụng |
|------|-----------|
| `db.php` | File kết nối dùng chung. `require` file này là có sẵn biến `$pdo` để truy vấn. |
| `index.php` | Trang test: mở lên để kiểm tra kết nối có thành công không. |
| `start.bat` / `start.ps1` | Chạy nhanh server PHP để test (tự bật driver `pdo_mysql`). |

## Cách chạy (3 bước)

1. **Import database**: mở Laragon → bật **MySQL**, vào HeidiSQL/phpMyAdmin tạo database tên `datn` rồi import file `hotelbookingdb.sql`.
2. **Bật MySQL** trong Laragon (nút *Start All*).
3. **Bấm đúp `start.bat`** → mở trình duyệt vào <http://localhost:8000>.
   Nếu thấy dòng **"✅ Kết nối database thành công!"** kèm danh sách bảng là đã chạy được.

## Dùng trong code của bạn

```php
<?php
require __DIR__ . '/db.php';   // sửa đường dẫn cho đúng vị trí file của bạn

// Ví dụ: lấy danh sách phòng
$rooms = $pdo->query('SELECT * FROM rooms')->fetchAll();

// Ví dụ: truy vấn có tham số (an toàn, chống SQL injection)
$stmt = $pdo->prepare('SELECT * FROM accounts WHERE email = ?');
$stmt->execute(['admin@gmail.com']);
$account = $stmt->fetch();
```

## Cấu hình kết nối

Mặc định khớp với Laragon. Nếu máy bạn khác (có mật khẩu root, tên DB khác...), sửa 4 dòng đầu trong `db.php`:

```php
$DB_HOST = '127.0.0.1';
$DB_NAME = 'datn';
$DB_USER = 'root';
$DB_PASS = '';
```

## Lỗi thường gặp

- **could not find driver** → driver `pdo_mysql` chưa bật. Hãy chạy bằng `start.bat` (script đã tự bật driver), đừng gọi `php` trực tiếp.
- **Kết nối database thất bại / Access denied** → kiểm tra MySQL đã bật chưa, tên DB / mật khẩu trong `db.php` đã đúng chưa.
- **Unknown database 'datn'** → chưa import `hotelbookingdb.sql` hoặc đặt sai tên database.

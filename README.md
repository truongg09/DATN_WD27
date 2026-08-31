# HotelHub — Web đặt phòng khách sạn

Đồ án web đặt phòng khách sạn gồm 3 vai trò: khách hàng, nhân viên/lễ tân và quản trị viên.

- **Frontend**: React 19 + TypeScript + Vite + Ant Design (thư mục `src/`)
- **Backend**: Node.js + Express + MySQL (thư mục `backend/`)

## Yêu cầu môi trường

| Phần mềm | Phiên bản |
|---|---|
| Node.js | 18 trở lên (khuyến nghị 20+) |
| MySQL | 8.0 trở lên (XAMPP / Laragon / MySQL Server đều được) |

## Cài đặt và chạy

### 1. Tải mã nguồn

```bash
git clone -b dev https://github.com/truongg09/DATN_WD27.git
cd DATN_WD27
```

### 2. Tạo cơ sở dữ liệu

Tạo database rỗng tên `hotelbookingdb`, sau đó nạp dữ liệu mẫu từ file `hotelbookingdb.sql`.

Cách 1 — dùng phpMyAdmin: tạo database `hotelbookingdb` (collation `utf8mb4_0900_ai_ci`), vào tab **Import**, chọn file `hotelbookingdb.sql` rồi bấm Go.

Cách 2 — dùng dòng lệnh:

```bash
mysql -u root -p -e "CREATE DATABASE hotelbookingdb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -u root -p hotelbookingdb < hotelbookingdb.sql
```

> `hotelbookingdb.sql` ở thư mục gốc là **file SQL duy nhất** của dự án, đã chứa đầy đủ 33 bảng kèm dữ liệu mẫu. Import xong là dùng được ngay.
>
> Backend vẫn tự kiểm tra và bổ sung bảng/cột còn thiếu mỗi lần khởi động, nên nếu database của bạn được tạo từ bản SQL cũ thì chỉ cần chạy lại backend một lần là đủ.

### 3. Cài thư viện

Chỉ cần **một lệnh duy nhất ở thư mục gốc**, nó tự cài luôn cho `backend/`:

```bash
npm install
```

### 4. Tạo file cấu hình backend

```bash
cd backend
cp .env.example .env      # Windows: copy .env.example .env
cd ..
```

Mở `backend/.env` và sửa `DB_PASSWORD` nếu MySQL của bạn có mật khẩu. Các giá trị còn lại để mặc định là chạy được.

### 5. Chạy dự án

Cần **hai cửa sổ terminal**, cùng đứng ở thư mục gốc.

Cửa sổ 1 — máy chủ API:

```bash
npm run server
```

Khởi động thành công sẽ thấy dòng `Server is running on port 3001`.

Cửa sổ 2 — giao diện web:

```bash
npm run dev
```

Truy cập **http://localhost:5173**

## Tài khoản đăng nhập mẫu

Mật khẩu của toàn bộ tài khoản mẫu là `123456`.

| Vai trò | Email |
|---|---|
| Quản trị viên | admin@gmail.com |
| Nhân viên | staff1@gmail.com |
| Khách hàng | customer1@gmail.com |

> Mật khẩu trong file SQL đang lưu dạng chữ thường. Lần đầu khởi động, backend tự băm lại toàn bộ bằng bcrypt — bạn vẫn đăng nhập bằng `123456`, nhưng **hãy đổi mật khẩu quản trị viên** trước khi dùng thật.

## Cấu hình sau khi cài

Đăng nhập bằng tài khoản quản trị viên rồi vào **Cài đặt thanh toán** để điền số tài khoản ngân hàng thật của khách sạn. Mã QR thanh toán được sinh từ thông tin này; nếu để mặc định thì QR quét ra sẽ không chuyển được tiền.

## Các lệnh khác

Tất cả đều chạy ở **thư mục gốc**.

| Lệnh | Tác dụng |
|---|---|
| `npm install` | Cài thư viện cho cả frontend và backend |
| `npm run dev` | Chạy frontend chế độ phát triển |
| `npm run server` | Chạy máy chủ API (cổng 3001) |
| `npm run build` | Đóng gói frontend ra thư mục `dist/` |
| `npm run lint` | Kiểm tra lint |

## Xử lý lỗi thường gặp

**Backend báo `ER_ACCESS_DENIED_ERROR`** — sai tài khoản MySQL. Kiểm tra lại `DB_USER` và `DB_PASSWORD` trong `backend/.env`.

**Backend báo `ER_BAD_DB_ERROR`** — chưa tạo database. Quay lại bước 2.

**Trang web trắng hoặc báo Network Error** — backend chưa chạy. Kiểm tra terminal của backend và mở thử http://localhost:3001/api/health.

**Đăng nhập báo sai mật khẩu** — nếu đã từng chạy backend rồi import lại file SQL, hãy khởi động lại backend một lần để nó băm lại mật khẩu.

**Cổng 3001 đã bị chiếm** — đổi `PORT` trong `backend/.env`, đồng thời tạo file `.env` ở thư mục gốc với nội dung `VITE_API_URL=http://localhost:<cổng mới>/api`.

# TÀI LIỆU BÀN GIAO & THEO DÕI TRIỂN KHAI
## CHỨC NĂNG: QUẢN LÝ SỨC CHỨA & KHÁCH PHÁT SINH (CAPACITY & EXTRA GUEST MANAGEMENT)

> **Lưu ý quan trọng cho các AI Subagent / AI Agent ở các phiên tiếp theo:**
> File này là nguồn thông tin duy nhất và toàn diện về trạng thái, quy tắc nghiệp vụ, công thức và tiến độ của chức năng "Quản lý sức chứa & khách phát sinh".
> **ĐỌC KỸ FILE NÀY VÀ ĐỌC CODE THỰC TẾ TRƯỚC KHI THỰC HIỆN BẤT KỲ BƯỚC TIẾP THEO NÀO.**

---

## I. NGUYÊN TẮC NGHIỆP VỤ CỐ ĐỊNH (FIXED BUSINESS RULES)

### 1. Quy tắc Đặt phòng & Hạng phòng
- **Một Booking chỉ được chọn duy nhất 01 Hạng phòng (Room Type).**
- **Có thể đặt nhiều phòng ($N$ phòng) cùng thuộc Hạng phòng đó.**
- *Ví dụ:*
  - `2 phòng Standard`: **HỢP LỆ**
  - `3 phòng Deluxe`: **HỢP LỆ**
  - `1 phòng Standard + 1 phòng Deluxe`: **KHÔNG HỢP LỆ** (Hệ thống không hỗ trợ trộn hạng phòng trong 1 booking).

### 2. Các thông số Sức chứa & Đơn giá Phụ thu của Hạng phòng (`room_types`)
Mỗi hạng phòng trong cơ sở dữ liệu sẽ quản lý 5 thông số cốt lõi:
1. `adultCapacity`: Sức chứa người lớn tiêu chuẩn cho 1 phòng.
2. `childCapacity`: Sức chứa trẻ em tiêu chuẩn cho 1 phòng.
3. `maxOccupancy`: Tổng sức chứa tối đa cho 1 phòng (bao gồm cả NL + TE).
4. `extraAdultFee`: Đơn giá phụ thu người lớn phát sinh / người / đêm.
5. `extraChildFee`: Đơn giá phụ thu trẻ em phát sinh / người / đêm.

### 3. Phân biệt Sức chứa Tiêu chuẩn vs Sức chứa Tối đa
- **Sức chứa tiêu chuẩn (1 phòng):** = `adultCapacity` + `childCapacity`.
- **Giới hạn tối đa (1 phòng):** = `maxOccupancy`.
- **Khách phát sinh:** Nếu số khách lớn hơn sức chứa tiêu chuẩn nhưng **chưa vượt quá** `maxOccupancy` $\rightarrow$ Tính là khách phát sinh, **cho phép đặt** và **tính phụ thu**.
- **Khách vượt giới hạn:** Nếu số khách vượt quá `maxOccupancy` $\rightarrow$ **Từ chối đặt phòng**, cảnh báo giao diện yêu cầu khách tăng số lượng phòng.

---

## II. CÔNG THỨC TÍNH TOÁN VÀ XÁC ĐỊNH PHỤ THU

Giả sử khách đặt **$Q$** phòng ($Q = \text{roomQuantity} \ge 1$) của cùng 1 Hạng phòng trong **$N$** đêm ($\text{nights}$):

### 1. Tính Tổng Sức chứa cho $Q$ phòng
$$\text{totalAdultCapacity} = \text{adultCapacity} \times Q$$
$$\text{totalChildCapacity} = \text{childCapacity} \times Q$$
$$\text{totalMaxOccupancy} = \text{maxOccupancy} \times Q$$

### 2. Xác định Số lượng Khách Phát sinh
$$\text{extraAdults} = \max(0, \text{adults} - \text{totalAdultCapacity})$$
$$\text{extraChildren} = \max(0, \text{children} - \text{totalChildCapacity})$$

### 3. Điều kiện Hợp lệ của Booking (Validation)
$$\text{Vượt sức chứa tối đa nếu: } (\text{adults} + \text{children}) > \text{totalMaxOccupancy}$$
- Nếu vượt: Booking **KHÔNG HỢP LỆ** $\rightarrow$ Hệ thống chặn không cho tạo/cập nhật booking và thông báo yêu cầu tăng số lượng phòng.

### 4. Công thức Tính Phụ thu Khách Phát sinh (Extra Guest Fee)
$$\text{extraAdultAmount} = \text{extraAdults} \times \text{extraAdultFee} \times \text{nights}$$
$$\text{extraChildAmount} = \text{extraChildren} \times \text{extraChildFee} \times \text{nights}$$
$$\text{totalExtraGuestFee} = \text{extraAdultAmount} + \text{extraChildAmount}$$

### 5. Quy tắc Security & Snapshot Giá
- **Backend Validation Strict:** Frontend chỉ thực hiện tính toán để **Preview (xem trước)** cho người dùng. Backend **BẮT BUỘC** phải tự tính toán và validate lại toàn bộ số khách phát sinh và số tiền phụ thu khi nhận request tạo/cập nhật booking. **TUYỆT ĐỐI KHÔNG TIN TƯỞNG** số tiền phụ thu do frontend truyền lên.
- **Price Snapshot:** Đơn giá phụ thu (`extraAdultFee`, `extraChildFee`) và tổng tiền phụ thu (`occupancySurcharge`) của booking được chốt **snapshot** ngay thời điểm đặt phòng (lưu vào chi tiết booking / hóa đơn). Sau này Admin có thay đổi đơn giá ở danh mục hạng phòng thì các booking cũ **KHÔNG BỊ THAY ĐỔI** tiền.

---

## III. TRẠNG THÁI HỆ THỐNG HIỆN TẠI (CURRENT SYSTEM STATE)

*(Cập nhật tại phiên khởi tạo: 2026-08-10)*

1. **Cơ sở dữ liệu (Database):**
   - Bảng `room_types` chỉ có cột `capacity` (INT).
   - Chưa có các cột: `adultCapacity`, `childCapacity`, `maxOccupancy`, `extraAdultFee`, `extraChildFee`.
   - Tiền phụ thu hiện tại đang ghi ở `booking_details.occupancySurcharge` (chưa có bảng riêng `booking_surcharges`).

2. **Backend Logic:**
   - Phụ thu trẻ em hiện tại đang tính trong `backend/services/bookingService.js` (`calcChildSurcharge`) dựa trên cài đặt chung toàn hệ thống `children_policy` ở bảng `app_settings`.
   - `bookingService.js` đang check sức chứa bằng `adults + adultsFromChildren > room.capacity`.
   - Cần nâng cấp `bookingService.js`, `roomTypeService.js`, `bookingModel.js`, `rooms.js`.

3. **Frontend UI:**
   - Giao diện Admin (`RoomTypeManagement.tsx`) chỉ nhập 1 ô "Sức chứa (người)".
   - Giao diện Khách hàng (`Booking.tsx`) có UI `multiRooms` nhưng cho phép thêm các dòng chọn hạng phòng khác nhau (cần sửa thành: Chọn 1 hạng phòng duy nhất, nhưng cho phép điều chỉnh Số lượng phòng $Q \ge 1$).

---

## IV. KẾ HOẠCH BẰNG CÁC BƯỚC THỰC HIỆN (STEP-BY-STEP ROADMAP)

- [x] **Bước 1: Schema Migration & Cập nhật CSDL (DONE)**
  - Cập nhật `hotelbookingdb.sql` thêm 5 cột vào `room_types`: `adultCapacity`, `childCapacity`, `maxOccupancy`, `extraAdultFee`, `extraChildFee`.
  - Cập nhật `backend/ensure-operational-schema.js` để tự động check và `ALTER TABLE room_types ADD COLUMN...` nếu chưa có cột.
  - Thêm lời gọi `ensureOperationalSchema()` tự động khi `backend/server.js` khởi động.

- [x] **Bước 2: Backend Core - CRUD Hạng phòng & Phân loại Sức chứa (DONE)**
  - Cập nhật `backend/routes/rooms.js`: API tạo/sửa hạng phòng nhận, validate & lưu 5 trường sức chứa/phụ thu mới.
  - Cập nhật `backend/services/roomTypeService.js`: Trả về các trường sức chứa/phụ thu mới và cập nhật `fitsGuests` trong tìm kiếm hạng phòng theo `maxOccupancy`.

- [x] **Bước 3: Backend Core - Validation Booking & Tính toán Phụ thu (Snapshot) (DONE)**
  - Cập nhật `backend/validators/bookingValidator.js`: Validate `roomQuantity >= 1` và ràng buộc 1 booking chỉ chọn phòng thuộc cùng 1 hạng phòng.
  - Cập nhật `backend/services/bookingService.js`:
    - Viết `distributeGuestsAcrossRooms` phân bổ adults/children đều cho $Q$ phòng sao cho không detail nào vượt `maxOccupancy`.
    - Viết `calcExtraGuestSurcharge` tính toán khách phát sinh và tạo structured snapshot JSON `extraGuestSnapshot`.
    - Kiểm tra `totalGuests <= totalMaxOccupancy` (từ chối 400 nếu vượt).
    - Tự động gán $Q$ phòng trống thuộc hạng phòng được chọn (khóa FOR UPDATE, từ chối 409 nếu không đủ $Q$ phòng).
  - Cập nhật `backend/models/bookingModel.js`:
    - Lưu `extraGuestSnapshot` (JSON) vào bảng `bookings`.
    - Chỉ gán `occupancySurcharge = totalExtraGuestFee` cho `booking_details[0]`, các detail $1..Q-1$ gán `= 0`.
  - Cập nhật `backend/routes/reports.js`: Sửa query doanh thu theo loại phòng để `occupancySurcharge` không bị nhân đôi với `nights`.
  - Tạo bộ test tự động `backend/test-step3.js` kiểm thử 11/11 case **PASS 100%**.

- [x] **Bước 4: Frontend Admin - Giao diện Quản lý Hạng phòng (DONE)**
  - Cập nhật `src/types/room.ts` định nghĩa đầy đủ 5 thuộc tính sức chứa & phụ thu.
  - Cập nhật `src/pages/Admin/RoomTypeManagement.tsx` (Form Thêm/Sửa 5 field, Frontend Validation `maxOccupancy >= adultCapacity + childCapacity`, Cột Bảng hiển thị đẹp gọn & Modal Xem chi tiết).
  - Không sửa `RoomManagement.tsx` vì không thuộc phạm vi quản lý đơn giá/sức chứa hạng phòng.
  - Viết `backend/test-step4.js` kiểm thử integration 4/4 test cases **PASS 100%**.
  - Kiểm tra `npx tsc --noEmit` **PASS 0 lỗi**.

- [x] **Bước 5: Frontend Client - Tìm kiếm & Chi tiết Hạng phòng (DONE)**
  - Cập nhật `src/pages/RoomList/RoomList.tsx` & `RoomList.css`: Hiển thị rõ ràng Sức chứa tiêu chuẩn (`X NL + Y TE`), Sức chứa tối đa (`Z khách/phòng`), Đơn giá phụ thu phát sinh gọn đẹp; Cảnh báo chi tiết khi tìm kiếm nhiều khách/nhiều phòng; Diễn đạt giá rõ `/ phòng / đêm` và tính base theo số phòng tối thiểu (`minimumRooms`), ghi chú rõ `* Chưa gồm phụ thu khách phát sinh`.
  - Cập nhật `src/pages/RoomTypeDetail/RoomTypeDetail.tsx` & `RoomTypeDetail.css`: Thêm Section riêng "Chính sách sức chứa & phụ thu" trình bày rõ Sức chứa tiêu chuẩn, Sức chứa tối đa và Phụ thu phát sinh (/người/đêm); Diễn đạt giá trong Booking Widget rõ ràng `/ phòng / đêm`.
  - Không sửa `RoomDetail.tsx` (trang cũ không dùng, client routing sử dụng `/room-types/:id`).
  - Kiểm tra `npx tsc --noEmit` **PASS 0 lỗi**.

- [ ] **Bước 6: Frontend Client - Giao diện Đặt phòng & Preview Phụ thu**
  - Cập nhật `src/pages/Booking/Booking.tsx`:
    - Ràng buộc chỉ chọn 1 hạng phòng, cho phép chọn số lượng phòng $Q$.
    - Tự động tính toán & hiển thị preview khách phát sinh (ví dụ: `1 người lớn x 200.000đ x 3 đêm = 600.000đ`).
    - Nếu không có khách phát sinh $\rightarrow$ Ẩn box phụ thu.
    - Nếu `adults + children > totalMaxOccupancy` $\rightarrow$ Hiển thị cảnh báo màu đỏ yêu cầu tăng số lượng phòng và vô hiệu hóa nút thanh toán/đặt phòng.

- [ ] **Bước 7: Kiểm thử Toàn bộ Luồng (End-to-End Verification)**
  - Kiểm thử tạo booking từ Admin & Customer.
  - Kiểm thử snapshot giá khi Admin đổi đơn giá phụ thu trong tương lai.

---

## V. NHẬT KÝ THAY ĐỔI & BÀN GIAO (HANDOFF LOG)

| Ngày / Phiên | Đã làm gì | File đã sửa | Database thay đổi | Logic & Hàm liên quan | Việc chưa làm | Lỗi/Vấn đề tồn tại | Bước tiếp theo |
|---|---|---|---|---|---|---|---|
| **2026-08-10 (Khởi tạo)** | Phân tích toàn bộ codebase, xác định các vị trí xử lý sức chứa hiện tại, khởi tạo tài liệu bàn giao `docs/CAPACITY_HANDOFF.md`. | - `docs/CAPACITY_HANDOFF.md` | Chưa thay đổi | Chưa thay đổi | Toàn bộ các bước từ Bước 1 đến Bước 7 | Chưa có | Thực hiện **Bước 1**: Migration & Cập nhật CSDL. |
| **2026-08-10 (Step 1)** | **HOÀN THÀNH STEP 1 (Database Schema):**<br>- Giữ nguyên field `capacity` cũ để tránh breaking change.<br>- Bổ sung 5 field mới vào `room_types` với giá trị mặc định hợp lý.<br>- Đồng bộ schema khởi tạo và cơ chế auto-migration khi server khởi động.<br>- Kiểm tra server chạy thành công. | - `hotelbookingdb.sql`<br>- `backend/ensure-operational-schema.js`<br>- `backend/server.js`<br>- `docs/CAPACITY_HANDOFF.md` | Đã thêm 5 cột vào `room_types`:<br>`adultCapacity` INT DEFAULT 2,<br>`childCapacity` INT DEFAULT 1,<br>`maxOccupancy` INT DEFAULT 3,<br>`extraAdultFee` DECIMAL(15,2) DEFAULT 200000.00,<br>`extraChildFee` DECIMAL(15,2) DEFAULT 100000.00. | `ensureOperationalSchema()` trong `backend/ensure-operational-schema.js`, tự động gọi tại `backend/server.js` khi startup. | Các bước 2, 3, 4, 5, 6, 7. | Các API backend & UI frontend hiện tại chưa trả về/nhập/sửa 5 trường mới này. | Thực hiện **STEP 2 (Backend Core - CRUD Hạng phòng & Phân loại Sức chứa)**. |
| **2026-08-10 (Step 2)** | **HOÀN THÀNH STEP 2 (Backend Core CRUD Hạng phòng):**<br>- Cập nhật `GET /api/rooms/types`, `GET /api/rooms/types/search`, `GET /api/rooms/types/:id` trả về đủ 5 trường sức chứa/phụ thu mới.<br>- Cập nhật `POST /api/rooms/types` & `PUT /api/rooms/types/:id` nhận và lưu 5 trường mới.<br>- Bổ sung hàm backend validation `validateCapacityFields`.<br>- Chạy bộ test tự động 6/6 test PASS. | - `backend/routes/rooms.js`<br>- `backend/services/roomTypeService.js`<br>- `backend/test-step2.js`<br>- `docs/CAPACITY_HANDOFF.md` | Giữ nguyên schema Step 1. | - `validateCapacityFields` trong `backend/routes/rooms.js`.<br>- `POST /api/rooms/types` & `PUT /api/rooms/types/:id`.<br>- `TYPE_SELECT` & `buildTypeEntry` & `searchRoomTypes` trong `backend/services/roomTypeService.js`. | Các bước 3, 4, 5, 6, 7. | Booking service (`bookingService.js`) và Frontend UI chưa được cập nhật theo logic sức chứa mới. | Sửa điểm lệch Step 2 trước khi qua Step 3. |
| **2026-08-10 (Step 2 Fix UI)** | **ĐỒNG BỘ HIỂN THỊ UI THEO MAXOCCUPANCY:**<br>- Chuyển toàn bộ hiển thị "Tối đa X khách" trên giao diện sang `maxOccupancy ?? capacity`.<br>- Hiển thị cảnh báo số phòng tối thiểu (`minimumRooms`) khi `fitsOneRoom = false`.<br>- Đã kiểm tra TypeScript build thành công (`npx tsc --noEmit` pass 0 lỗi).<br>- Test search kết quả đúng với Family, Suite (maxOccupancy 6), Standard (maxOccupancy 2). | - `src/services/roomService.ts`<br>- `src/types/room.ts`<br>- `src/pages/RoomList/RoomList.tsx`<br>- `src/pages/RoomTypeDetail/RoomTypeDetail.tsx`<br>- `src/components/FeaturedRooms/FeaturedRooms.tsx`<br>- `src/pages/RoomDetail/RoomDetail.tsx`<br>- `src/pages/Admin/RoomManagement.tsx`<br>- `src/pages/Admin/RoomTypeManagement.tsx`<br>- `docs/CAPACITY_HANDOFF.md` | Giữ nguyên schema Step 1. | Frontend card / detail / table display logic (`maxOccupancy ?? capacity`). | Các bước 3, 4, 5, 6, 7. | Booking service (`bookingService.js`) chưa được cập nhật theo logic sức chứa mới (sẽ làm ở Step 3). | Thực hiện **STEP 3 (Backend Core - Validation Booking & Tính toán Phụ thu Snapshot)**. |
| **2026-08-10 (Step 3A Analysis)** | **HOÀN THÀNH PHÂN TÍCH LUỒNG BOOKING BACKEND (STEP 3A):**<br>- Rà soát toàn bộ `bookingService.js`, `bookingModel.js`, `bookingValidator.js` và DB schemas.<br>- Xác định luồng tạo booking hiện tại (chỉ hỗ trợ 1 room_detail / 1 room per booking).<br>- Phân tích nguy cơ nhân đôi tiền `occupancySurcharge` khi $Q > 1$ nếu lặp trên từng `booking_details`.<br>- Phân định vai trò `children_policy` (phân loại tuổi $\ge 12$ tuổi thành người lớn) với `extraAdultFee`/`extraChildFee` (đơn giá phụ thu theo hạng phòng).<br>- Đề xuất phương án thiết kế hàm `calcExtraGuestSurcharge` và lưu snapshot chuẩn xác.<br>- Chưa sửa code implementation. | - `docs/CAPACITY_HANDOFF.md` | Giữ nguyên schema Step 1. | Phân tích luồng booking backend, báo giá, kiểm tra sức chứa và snapshot phụ thu. | Bước 3B (Implementation), Bước 4, 5, 6, 7. | Booking service chưa được cập nhật code (sẽ làm ở Step 3B). | Thực hiện **STEP 3B (Backend Core Implementation & Unit Test)**. |
| **2026-08-10 (Step 3B Implementation)** | **HOÀN THÀNH BƯỚC 3 (BACKEND CORE BOOKING & SNAPSHOT CAPACITY):**<br>- Thêm cột `extraGuestSnapshot` (JSON) vào bảng `bookings` và auto-migration khi server start.<br>- Thêm helper `distributeGuestsAcrossRooms` chia đều khách vào $Q$ phòng, đảm bảo không phòng nào vượt `maxOccupancy`.<br>- Thêm helper `calcExtraGuestSurcharge` tính phụ thu và tạo structured snapshot JSON.<br>- Cập nhật `createBooking` gán $Q$ phòng trống cùng hạng phòng, lưu snapshot vào `bookings`, chỉ gán phụ thu ở `booking_details[0]`.<br>- Sửa query `reports.js` tránh double count `occupancySurcharge` x `nights`.<br>- Viết `backend/test-step3.js` kiểm thử 11/11 test cases **PASS 100%**. | - `backend/ensure-operational-schema.js`<br>- `hotelbookingdb.sql`<br>- `backend/validators/bookingValidator.js`<br>- `backend/services/bookingService.js`<br>- `backend/models/bookingModel.js`<br>- `backend/routes/reports.js`<br>- `backend/test-step3.js`<br>- `docs/CAPACITY_HANDOFF.md` | Thêm cột `extraGuestSnapshot` (JSON) vào bảng `bookings`. | - `distributeGuestsAcrossRooms`<br>- `calcExtraGuestSurcharge`<br>- `createBooking` & `updateBookingStayFull`<br>- `BOOKING_SELECT` | Các bước 4, 5, 6, 7. | Chưa có. Backend core booking capacity đã hoạt động hoàn toàn chính xác. | Thực hiện **STEP 4 (Frontend Admin - Giao diện Quản lý Hạng phòng)**. |
| **2026-08-10 (Step 4 Implementation)** | **HOÀN THÀNH BƯỚC 4 (FRONTEND ADMIN QUẢN LÝ HẠNG PHÒNG):**<br>- Cập nhật `src/types/room.ts` có đủ 5 field sức chứa & phụ thu.<br>- Nâng cấp `RoomTypeManagement.tsx`: Form thêm/sửa hỗ trợ đủ 5 field với default hợp lý khi tạo mới, load đúng dữ liệu cũ khi edit.<br>- Thêm Frontend Validation (`maxOccupancy >= adultCapacity + childCapacity`, `adultCapacity >= 1`, `childCapacity >= 0`, `extraAdultFee >= 0`, `extraChildFee >= 0`).<br>- Giữ đủ 5 field khi đổi trạng thái (quick status change), tránh reset dữ liệu.<br>- Thiết kế cột "Sức chứa" & "Phụ thu phát sinh" trên Bảng danh sách đẹp mắt, không làm tràn giao diện.<br>- Cập nhật Modal Chi tiết hiển thị rõ ràng thông số sức chứa & phụ thu.<br>- Viết & chạy test script `backend/test-step4.js` pass **4/4 (100%)**.<br>- Kiểm tra `npx tsc --noEmit` pass **0 lỗi**. | - `src/types/room.ts`<br>- `src/pages/Admin/RoomTypeManagement.tsx`<br>- `backend/test-step4.js`<br>- `docs/CAPACITY_HANDOFF.md` | Giữ nguyên schema Step 3. | - Form Thêm/Sửa & Validation trong `RoomTypeManagement.tsx`<br>- `handleQuickStatusChange` & `handleModalSubmit`<br>- Custom Table Column renders | Các bước 5, 6, 7. | Chưa có. Giao diện Admin quản lý hạng phòng đã hoạt động hoàn chỉnh. | Thực hiện **STEP 5 (Frontend Client - Tìm kiếm & Chi tiết Hạng phòng)**. |
| **2026-08-10 (Step 5 Implementation)** | **HOÀN THÀNH BƯỚC 5 (FRONTEND CLIENT TÌM KIẾM & CHI TIẾT HẠNG PHÒNG):**<br>- Cập nhật `RoomList.tsx` & `RoomList.css`: Hiển thị rõ ràng Sức chứa tiêu chuẩn (`X NL + Y TE` - kể cả TE=0), Sức chứa tối đa (`Z khách/phòng`), Đơn giá phụ thu phát sinh gọn đẹp; Cảnh báo rõ ràng khi tìm nhiều khách/nhiều phòng; Diễn đạt giá rõ `/ phòng / đêm` và nhân base theo `minimumRooms`, ghi chú `Chưa gồm phụ thu khách phát sinh`.<br>- Cập nhật `RoomTypeDetail.tsx` & `RoomTypeDetail.css`: Thêm Section riêng "Chính sách sức chứa & phụ thu" trình bày đầy đủ tiêu chuẩn, tối đa, đơn giá phụ thu và lời giải thích rõ ràng; Diễn đạt giá widget rõ `/ phòng / đêm`.<br>- Không sửa `RoomDetail.tsx` (trang cũ không sử dụng).<br>- Kiểm tra `npx tsc --noEmit` pass **0 lỗi**. | - `src/pages/RoomList/RoomList.tsx`<br>- `src/pages/RoomList/RoomList.css`<br>- `src/pages/RoomTypeDetail/RoomTypeDetail.tsx`<br>- `src/pages/RoomTypeDetail/RoomTypeDetail.css`<br>- `docs/CAPACITY_HANDOFF.md` | Giữ nguyên schema Step 3. | - Card Specs & Extra Fee display (`RoomList.tsx`)<br>- Capacity Policy Section (`RoomTypeDetail.tsx`)<br>- Multi-room & Capacity search warning logic | Các bước 6, 7. | Chưa có. Giao diện Client hiển thị sức chứa & phụ thu hoạt động đúng yêu cầu. | Thực hiện **STEP 6 (Frontend Client - Giao diện Đặt phòng & Preview Phụ thu)**. |

---

> **HƯỚNG DẪN DÀNH CHO AI TIẾP THEO:**
> 1. Mở file `docs/CAPACITY_HANDOFF.md` này ra đọc trước tiên.
> 2. Xem bảng Nhật ký thay đổi ở Mục V để biết bước tiếp theo cần làm là gì.
> 3. Sau khi hoàn thành công việc của bạn, hãy cập nhật mục checklist tại Mục IV và thêm 1 dòng mới vào bảng Nhật ký thay đổi tại Mục V trước khi kết thúc câu trả lời.

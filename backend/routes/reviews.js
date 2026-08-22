const express = require("express");
const db = require("../config/db");
const { optionalAuth, requireAuth, isStaff } = require("../middleware/auth");

const router = express.Router();

// Tra mã khách hàng từ tài khoản đang đăng nhập. Dùng để chỉ cho phép thao tác
// trên đánh giá của chính mình, thay vì tin vào customerId do client gửi lên.
const getCustomerIdOfCurrentUser = async (req) => {
  const [rows] = await db.query("SELECT id FROM customers WHERE accountId = ?", [
    req.user?.userId,
  ]);
  return rows.length > 0 ? Number(rows[0].id) : null;
};

// Chặn mọi request không phải admin/staff cho các thao tác quản trị
// (duyệt/từ chối, ẩn/hiện, phản hồi, xóa phản hồi, xóa review vĩnh viễn).
// Bắt buộc chạy SAU requireAuth để đảm bảo req.user đã tồn tại.
function requireAdmin(req, res, next) {
  const role = req.user?.role;
  if (role !== "admin" && role !== "staff") {
    return res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này" });
  }
  return next();
}

// -----------------------------------------------------------------------
// Đã xác nhận với middleware/auth.js thật của dự án:
//   - optionalAuth: không bắt buộc đăng nhập, nếu có Bearer token hợp lệ
//     thì gắn payload JWT vào req.user = { userId, email, role }.
//   - Route GET "/" dùng optionalAuth (không dùng requireAuth) vì khách
//     vãng lai vẫn phải xem được review đã approved.
//
// TRẠNG THÁI ĐÁNH GIÁ (status):
//   - pending  : mới gửi, đang chờ admin/staff duyệt (KHÔNG hiển thị công khai)
//   - approved : đã duyệt, hiển thị công khai
//   - hidden   : bị admin/staff ẩn hoặc từ chối duyệt (KHÔNG hiển thị công khai)
// -----------------------------------------------------------------------

const VALID_STATUSES = ["pending", "approved", "hidden"];

function isPrivilegedRequester(req) {
  const role = req.user?.role;
  return role === "admin" || role === "staff";
}

// Get all reviews with customer name and booking details
// Query params hỗ trợ:
//   bookingIds=1,2,3   lọc theo danh sách bookingId
//   status=pending|approved|hidden   lọc theo trạng thái kiểm duyệt (CHỈ admin/staff mới được dùng)
//   rating=1..5        lọc theo số sao
//   keyword=...        tìm theo tên khách hoặc nội dung bình luận
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { bookingIds, status, rating, keyword } = req.query;
    const privileged = isPrivilegedRequester(req);

    let query = `
      SELECT 
        r.id,
        r.bookingId,
        r.customerId,
        r.rating,
        r.comment,
        r.status,
        r.images,
        r.adminReply,
        r.repliedAt,
        r.hideReason,
        r.createdAt,
        COALESCE(c.fullName, a.email) AS customerName,
        bk.status AS bookingStatus,
        COALESCE(room_info.primary_room_id, bk.room_id) AS roomId,
        COALESCE(room_info.room_numbers, rm_fallback.roomNumber) AS roomNumber,
        COALESCE(room_info.primary_room_type_id, rm_fallback.roomTypeId) AS roomTypeId,
        COALESCE(room_info.room_type_names, rt_fallback.typeName) AS roomTypeName,
        COALESCE(room_info.room_type_details, CONCAT(COALESCE(rm_fallback.roomNumber, '—'), ' · ', COALESCE(rt_fallback.typeName, 'Phòng'))) AS roomTypeDetails
      FROM reviews r
      LEFT JOIN customers c ON r.customerId = c.id
      LEFT JOIN accounts a ON c.accountId = a.id
      LEFT JOIN bookings bk ON r.bookingId = bk.id
      LEFT JOIN (
        SELECT
          bd.bookingId,
          MIN(bd.roomId) AS primary_room_id,
          MIN(COALESCE(bd.roomTypeId, rm.roomTypeId)) AS primary_room_type_id,
          GROUP_CONCAT(DISTINCT rm.roomNumber ORDER BY rm.roomNumber SEPARATOR ', ') AS room_numbers,
          GROUP_CONCAT(DISTINCT rt.typeName ORDER BY rt.typeName SEPARATOR ', ') AS room_type_names,
          GROUP_CONCAT(
            DISTINCT CONCAT(COALESCE(rm.roomNumber, '—'), ' · ', COALESCE(rt.typeName, 'Phòng'))
            ORDER BY rm.roomNumber
            SEPARATOR '\n'
          ) AS room_type_details
        FROM booking_details bd
        LEFT JOIN rooms rm ON rm.id = bd.roomId
        LEFT JOIN room_types rt ON rt.id = COALESCE(bd.roomTypeId, rm.roomTypeId)
        WHERE rm.roomNumber IS NOT NULL
        GROUP BY bd.bookingId
      ) room_info ON room_info.bookingId = bk.id
      LEFT JOIN rooms rm_fallback ON rm_fallback.id = bk.room_id
      LEFT JOIN room_types rt_fallback ON rt_fallback.id = rm_fallback.roomTypeId
    `;
    const conditions = [];
    const params = [];

    if (bookingIds) {
      const ids = String(bookingIds)
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0);

      if (ids.length > 0) {
        conditions.push(`r.bookingId IN (${ids.map(() => "?").join(",")})`);
        params.push(...ids);
      }
    }

    // === ĐIỂM SỬA QUAN TRỌNG ===
    // Trước đây: chỉ lọc status khi client TỰ truyền query param status,
    // nên nếu trang khách hàng quên truyền status=approved thì review đã
    // ẩn vẫn lọt ra ngoài. Giờ ép cứng ở server theo 3 trường hợp:
    //   - admin/staff        => được phép lọc theo status tuỳ ý (pending/approved/hidden),
    //     hoặc xem tất cả (bao gồm cả pending) nếu không truyền status.
    //   - khách đã đăng nhập => thấy review approved của MỌI người, CỘNG THÊM
    //     review của CHÍNH MÌNH dù đang pending/hidden (để họ còn xem/sửa lại được,
    //     không bị lỗi "đặt phòng đã được đánh giá" khi review cũ chưa duyệt/đang ẩn).
    //   - khách vãng lai (chưa đăng nhập) => chỉ thấy status = 'approved'.
    if (privileged) {
      if (status && VALID_STATUSES.includes(status)) {
        conditions.push("r.status = ?");
        params.push(status);
      }
    } else if (req.user?.userId) {
      conditions.push("(r.status = 'approved' OR a.id = ?)");
      params.push(req.user.userId);
    } else {
      conditions.push("r.status = 'approved'");
    }

    if (rating && Number.isInteger(Number(rating))) {
      conditions.push("r.rating = ?");
      params.push(Number(rating));
    }

    if (keyword && String(keyword).trim()) {
      conditions.push("(c.fullName LIKE ? OR a.email LIKE ? OR r.comment LIKE ?)");
      const like = `%${String(keyword).trim()}%`;
      params.push(like, like, like);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // Ưu tiên hiển thị review đang "pending" lên trên cùng để admin/staff
    // xử lý trước, các review còn lại sắp theo ngày tạo mới nhất.
    query += " ORDER BY FIELD(r.status, 'pending', 'approved', 'hidden'), r.createdAt DESC";

    const [reviews] = await db.query(query, params);

    // images được lưu dạng JSON text trong DB, parse ra mảng cho frontend
    const data = reviews.map((r) => ({
      ...r,
      images: (() => {
        if (!r.images) return [];
        if (Array.isArray(r.images)) return r.images;
        try {
          return JSON.parse(r.images);
        } catch {
          return [];
        }
      })(),
    }));

    res.json({ data });
  } catch (error) {
    console.error("Get reviews error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Đếm số lượng đánh giá đang chờ duyệt (pending) cho badge thông báo admin
router.get("/pending-count", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [[row]] = await db.query(
      "SELECT COUNT(*) AS count FROM reviews WHERE status = 'pending'"
    );
    res.json({ data: { pendingCount: Number(row?.count || 0) } });
  } catch (error) {
    console.error("Get pending reviews count error:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
});

// Get single review by bookingId (dùng để mở modal xem/sửa đánh giá đã có)
// LƯU Ý: route này phải khai báo TRƯỚC mọi route dạng "/:id" phía dưới,
// nếu không Express sẽ hiểu nhầm "booking" là 1 giá trị :id
router.get("/booking/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [reviews] = await db.query(
      "SELECT id, bookingId, customerId, rating, comment, status, images, adminReply, repliedAt, hideReason, createdAt FROM reviews WHERE bookingId = ? LIMIT 1",
      [bookingId],
    );

    if (reviews.length === 0) {
      return res
        .status(404)
        .json({ message: "Chưa có đánh giá cho đặt phòng này" });
    }

    res.json({ data: reviews[0] });
  } catch (error) {
    console.error("Get review by booking error:", error);
    res
      .status(500)
       .json({ message: "Lỗi máy chủ nội bộ", error: error.message });
  }
});

// Create a review
// Đánh giá mới luôn ở trạng thái "pending" (chờ duyệt) - KHÔNG hiển thị công
// khai ngay. Admin/staff phải duyệt (PATCH /:id/status) thì mới hiển thị.
router.post("/", requireAuth, async (req, res) => {
  try {
    const { bookingId, rating, comment, images } = req.body;

    if (!bookingId || !rating) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp bookingId và rating" });
    }

    if (Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ message: "Rating phải từ 1 đến 5" });
    }

    const [bookings] = await db.query(
      `SELECT bk.id, bk.customerId, bk.status,
              COALESCE(bd.roomId, bk.room_id) AS roomId,
              rm.roomNumber, rt.id AS roomTypeId, rt.typeName AS roomTypeName
       FROM bookings bk
       LEFT JOIN booking_details bd ON bd.bookingId = bk.id
       LEFT JOIN rooms rm ON rm.id = COALESCE(bd.roomId, bk.room_id)
       LEFT JOIN room_types rt ON rt.id = rm.roomTypeId
       WHERE bk.id = ?`,
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đặt phòng" });
    }

    const booking = bookings[0];

    // Chỉ chủ đơn mới được đánh giá. Trước đây customerId lấy thẳng từ body nên
    // ai cũng gửi được đánh giá đứng tên khách khác.
    if (!isStaff(req.user)) {
      const currentCustomerId = await getCustomerIdOfCurrentUser(req);
      if (!currentCustomerId || currentCustomerId !== Number(booking.customerId)) {
        return res
          .status(403)
          .json({ message: "Bạn chỉ có thể đánh giá đơn đặt phòng của mình" });
      }
    }

    if (booking.status !== "checked_out") {
      return res
        .status(400)
        .json({ message: "Chỉ có thể đánh giá sau khi trả phòng" });
    }

    const [existing] = await db.query(
      "SELECT id FROM reviews WHERE bookingId = ?",
      [bookingId],
    );

    if (existing.length > 0) {
      return res
        .status(400)
        .json({ message: "Đặt phòng này đã được đánh giá" });
    }

    const reviewCustomerId = booking.customerId;
    const imagesJson =
      Array.isArray(images) && images.length > 0 ? JSON.stringify(images) : null;

    const [result] = await db.query(
      `
      INSERT INTO reviews (bookingId, customerId, rating, comment, status, images, createdAt)
      VALUES (?, ?, ?, ?, 'pending', ?, NOW())
    `,
      [bookingId, reviewCustomerId, rating, comment || "", imagesJson],
    );

    res.status(201).json({
      message: "Gửi đánh giá thành công, đánh giá của bạn đang chờ duyệt",
      data: {
        id: result.insertId,
        bookingId: booking.id,
        status: "pending",
        roomId: booking.roomId,
        roomNumber: booking.roomNumber,
        roomTypeId: booking.roomTypeId,
        roomTypeName: booking.roomTypeName
      },
    });
  } catch (error) {
    console.error("Create review error:", error);
    res
      .status(500)
      .json({ message: "Lỗi máy chủ nội bộ", error: error.message });
  }
});

// Update a review (nội dung/rating - dùng cho khách chỉnh sửa review của họ)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, images } = req.body;

    if (rating !== undefined && (Number(rating) < 1 || Number(rating) > 5)) {
      return res.status(400).json({ message: "Rating phải từ 1 đến 5" });
    }

    // Lấy đầy đủ thông tin review cũ để so sánh (không chỉ id như trước)
    const [existingRows] = await db.query(
      "SELECT id, customerId, status, rating, comment, images FROM reviews WHERE id = ?",
      [id],
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }
    const existing = existingRows[0];

    // Câu UPDATE bên dưới chỉ lọc theo id nên nếu không đối chiếu chủ sở hữu ở
    // đây thì ai cũng sửa được đánh giá của người khác.
    if (!isStaff(req.user)) {
      const currentCustomerId = await getCustomerIdOfCurrentUser(req);
      if (!currentCustomerId || currentCustomerId !== Number(existing.customerId)) {
        return res
          .status(403)
          .json({ message: "Bạn chỉ có thể sửa đánh giá của mình" });
      }
    }

    let existingImages = [];
    if (existing.images) {
      try {
        existingImages = Array.isArray(existing.images) ? existing.images : JSON.parse(existing.images);
      } catch {
        existingImages = [];
      }
    }

    const imagesProvided = images !== undefined;
    const newImages = imagesProvided && Array.isArray(images) ? images : existingImages;

    // Nếu review đang bị ẩn/từ chối, chặn submit nếu nội dung mới giống hệt nội dung cũ
    // (tránh khách gửi lại y nguyên nội dung vi phạm để "spam" chờ admin duyệt)
    const newRating = rating !== undefined ? Number(rating) : existing.rating;
    const newComment = (comment ?? existing.comment ?? "").trim().toLowerCase();
    const oldComment = (existing.comment ?? "").trim().toLowerCase();
    const imagesChanged =
      imagesProvided && JSON.stringify([...newImages].sort()) !== JSON.stringify([...existingImages].sort());
    const contentChanged = newRating !== existing.rating || newComment !== oldComment || imagesChanged;

    if (existing.status === "hidden" && !contentChanged) {
      return res.status(400).json({
        message: "Nội dung chưa thay đổi, vui lòng chỉnh sửa trước khi gửi lại",
      });
    }

    // Sửa nội dung thì phải duyệt lại, dù đánh giá đang ở trạng thái nào.
    //
    // Trước đây chỉ áp cho đánh giá đang bị ẩn, nên đánh giá ĐÃ DUYỆT sửa nội
    // dung vẫn giữ nguyên 'approved': khách viết bài sạch để được duyệt rồi sửa
    // thành nội dung bẩn, và nó lên thẳng trang công khai không qua ai xem lại.
    const shouldResendForReview =
      contentChanged && ["hidden", "approved"].includes(existing.status);

    const setClauses = ["rating = COALESCE(?, rating)", "comment = COALESCE(?, comment)"];
    const params = [rating ?? null, comment ?? null];

    if (imagesProvided) {
      setClauses.push("images = ?");
      params.push(Array.isArray(images) && images.length > 0 ? JSON.stringify(images) : null);
    }

    if (shouldResendForReview) {
      setClauses.push("status = ?", "hideReason = NULL");
      params.push("pending");
    }

    params.push(id);

    await db.query(
      `UPDATE reviews SET ${setClauses.join(", ")} WHERE id = ?`,
      params,
    );

    res.json({
      message: shouldResendForReview
        ? "Cập nhật đánh giá thành công, đánh giá đang chờ duyệt lại"
        : "Cập nhật đánh giá thành công",
      data: { resentForReview: shouldResendForReview },
    });
  } catch (error) {
    console.error("Update review error:", error);
    res
      .status(500)
      .json({ message: "Lỗi máy chủ nội bộ", error: error.message });
  }
});

// Helper: gửi notification cho khách hàng (bảng notifications theo accountId)
async function notifyCustomerOfReview(reviewId, title, content) {
  try {
    const [rows] = await db.query(
      `SELECT c.accountId
       FROM reviews r
       LEFT JOIN customers c ON r.customerId = c.id
       WHERE r.id = ?`,
      [reviewId],
    );
    const accountId = rows[0]?.accountId;
    if (!accountId) return; // không xác định được tài khoản -> bỏ qua, không chặn luồng chính

    await db.query(
      "INSERT INTO notifications (accountId, title, content, isRead, createdAt) VALUES (?, ?, ?, 0, NOW())",
      [accountId, title, content],
    );
  } catch (err) {
    // Lỗi gửi thông báo không nên làm fail cả request chính
    console.error("Notify customer error:", err);
  }
}

// Duyệt / Từ chối / Ẩn đánh giá - admin dùng thay cho xóa vĩnh viễn
// Body: { status: 'approved' | 'hidden', reason?: string }
// `reason` chỉ áp dụng khi status = 'hidden', dùng để lưu lý do và báo cho khách.
//
// Endpoint này xử lý CẢ 3 tình huống nghiệp vụ dựa trên trạng thái TRƯỚC ĐÓ:
//   - pending  -> approved : DUYỆT đánh giá lần đầu
//   - pending  -> hidden   : TỪ CHỐI đánh giá (không đạt yêu cầu nội dung)
//   - approved -> hidden   : ẨN đánh giá đang hiển thị (vi phạm/khiếu nại)
//   - hidden   -> approved : HIỂN THỊ LẠI đánh giá đã từng bị ẩn/từ chối
router.patch("/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!["approved", "hidden"].includes(status)) {
      return res
        .status(400)
        .json({ message: "status phải là 'approved' hoặc 'hidden'" });
    }

    const [existing] = await db.query("SELECT id, status FROM reviews WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }

    const wasPending = existing[0].status === "pending";
    const hideReason = status === "hidden" ? (reason ? String(reason).trim() : null) : null;

    await db.query(
      "UPDATE reviews SET status = ?, hideReason = ? WHERE id = ?",
      [status, hideReason, id],
    );

    // === Thông báo cho khách hàng khi trạng thái thay đổi ===
    if (status === "hidden") {
      const title = wasPending
        ? "Đánh giá của bạn đã bị từ chối"
        : "Đánh giá của bạn đã bị ẩn";
      const content = wasPending
        ? hideReason
          ? `Đánh giá bạn gửi chưa được duyệt. Lý do: ${hideReason}`
          : "Đánh giá bạn gửi chưa được duyệt vì không đáp ứng quy định nội dung. Bạn có thể chỉnh sửa và gửi lại."
        : hideReason
          ? `Đánh giá bạn gửi đã bị quản trị viên ẩn khỏi trang công khai. Lý do: ${hideReason}`
          : "Đánh giá bạn gửi đã bị quản trị viên ẩn khỏi trang công khai vì vi phạm quy định nội dung.";
      await notifyCustomerOfReview(id, title, content);
    } else {
      const title = wasPending
        ? "Đánh giá của bạn đã được duyệt"
        : "Đánh giá của bạn đã được hiển thị lại";
      const content = wasPending
        ? "Đánh giá bạn gửi đã được duyệt và hiển thị công khai trên trang khách sạn."
        : "Đánh giá bạn gửi đã được hiển thị công khai trở lại.";
      await notifyCustomerOfReview(id, title, content);
    }

    res.json({ message: "Cập nhật trạng thái thành công" });
  } catch (error) {
    console.error("Update review status error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Admin phản hồi công khai cho 1 đánh giá
router.post("/:id/reply", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    if (!reply || !String(reply).trim()) {
      return res.status(400).json({ message: "Nội dung phản hồi không được để trống" });
    }

    const [existing] = await db.query("SELECT id FROM reviews WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }

    await db.query(
      "UPDATE reviews SET adminReply = ?, repliedAt = NOW() WHERE id = ?",
      [String(reply).trim(), id],
    );

    await notifyCustomerOfReview(
      id,
      "Khách sạn đã phản hồi đánh giá của bạn",
      "Khách sạn vừa gửi phản hồi cho đánh giá của bạn. Vào xem chi tiết nhé!",
    );

    res.json({ message: "Phản hồi đánh giá thành công" });
  } catch (error) {
    console.error("Reply review error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Xóa phản hồi của admin
router.delete("/:id/reply", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      "UPDATE reviews SET adminReply = NULL, repliedAt = NULL WHERE id = ?",
      [id],
    );
    res.json({ message: "Xóa phản hồi thành công" });
  } catch (error) {
    console.error("Delete reply error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Delete a review (xóa vĩnh viễn - nên hạn chế dùng, ưu tiên PATCH status='hidden')
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM reviews WHERE id = ?", [id]);
    res.json({ message: "Xóa đánh giá thành công" });
  } catch (error) {
    console.error("Delete review error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

module.exports = router;
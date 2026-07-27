const express = require("express");
const db = require("../config/db");

const router = express.Router();

// Get all reviews with customer name and booking details
// Query params hỗ trợ:
//   bookingIds=1,2,3   lọc theo danh sách bookingId
//   status=approved|hidden   lọc theo trạng thái kiểm duyệt
//   rating=1..5        lọc theo số sao
//   keyword=...        tìm theo tên khách hoặc nội dung bình luận
router.get("/", async (req, res) => {
  try {
    const { bookingIds, status, rating, keyword } = req.query;

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
        r.createdAt,
        COALESCE(c.fullName, a.email) AS customerName,
        bk.status AS bookingStatus,
        COALESCE(bd.roomId, bk.room_id) AS roomId,
        rm.roomNumber,
        rm.roomTypeId,
        rt.typeName AS roomTypeName
      FROM reviews r
      LEFT JOIN customers c ON r.customerId = c.id
      LEFT JOIN accounts a ON c.accountId = a.id
      LEFT JOIN bookings bk ON r.bookingId = bk.id
      LEFT JOIN booking_details bd ON bd.bookingId = bk.id
      LEFT JOIN rooms rm ON COALESCE(bd.roomId, bk.room_id) = rm.id
      LEFT JOIN room_types rt ON rm.roomTypeId = rt.id
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

    if (status && ["approved", "hidden"].includes(status)) {
      conditions.push("r.status = ?");
      params.push(status);
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

    query += " ORDER BY r.createdAt DESC";

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

// Get single review by bookingId (dùng để mở modal xem/sửa đánh giá đã có)
// LƯU Ý: route này phải khai báo TRƯỚC mọi route dạng "/:id" phía dưới,
// nếu không Express sẽ hiểu nhầm "booking" là 1 giá trị :id
router.get("/booking/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [reviews] = await db.query(
      "SELECT id, bookingId, customerId, rating, comment, status, images, adminReply, repliedAt, createdAt FROM reviews WHERE bookingId = ? LIMIT 1",
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
router.post("/", async (req, res) => {
  try {
    const { bookingId, customerId, rating, comment, images } = req.body;

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

    const reviewCustomerId = customerId || booking.customerId;
    const imagesJson =
      Array.isArray(images) && images.length > 0 ? JSON.stringify(images) : null;

    const [result] = await db.query(
      `
      INSERT INTO reviews (bookingId, customerId, rating, comment, status, images, createdAt)
      VALUES (?, ?, ?, ?, 'approved', ?, NOW())
    `,
      [bookingId, reviewCustomerId, rating, comment || "", imagesJson],
    );

    res.status(201).json({
      message: "Tạo đánh giá thành công",
      data: {
        id: result.insertId,
        bookingId: booking.id,
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
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (rating !== undefined && (Number(rating) < 1 || Number(rating) > 5)) {
      return res.status(400).json({ message: "Rating phải từ 1 đến 5" });
    }

    const [existing] = await db.query(
      "SELECT id FROM reviews WHERE id = ?",
      [id],
    );
    if (existing.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }

    await db.query(
      "UPDATE reviews SET rating = COALESCE(?, rating), comment = COALESCE(?, comment) WHERE id = ?",
      [rating ?? null, comment ?? null, id],
    );

    res.json({ message: "Cập nhật đánh giá thành công" });
  } catch (error) {
    console.error("Update review error:", error);
    res
      .status(500)
      .json({ message: "Lỗi máy chủ nội bộ", error: error.message });
  }
});

// Toggle trạng thái kiểm duyệt (ẩn / hiện) - admin dùng thay cho xóa vĩnh viễn
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "hidden"].includes(status)) {
      return res
        .status(400)
        .json({ message: "status phải là 'approved' hoặc 'hidden'" });
    }

    const [existing] = await db.query("SELECT id FROM reviews WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }

    await db.query("UPDATE reviews SET status = ? WHERE id = ?", [status, id]);

    res.json({ message: "Cập nhật trạng thái thành công" });
  } catch (error) {
    console.error("Update review status error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Admin phản hồi công khai cho 1 đánh giá
router.post("/:id/reply", async (req, res) => {
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

    res.json({ message: "Phản hồi đánh giá thành công" });
  } catch (error) {
    console.error("Reply review error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Xóa phản hồi của admin
router.delete("/:id/reply", async (req, res) => {
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
router.delete("/:id", async (req, res) => {
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

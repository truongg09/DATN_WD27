const express = require("express");
const db = require("../config/db");

const router = express.Router();

// GET /api/reviews (admin)
router.get("/", async (req, res) => {
  try {
    const [reviews] = await db.query(`
      SELECT
        r.id,
        r.bookingId,
        r.customerId,
        c.fullName,
        r.rating,
        r.comment,
        r.status,
        r.adminReply,
        r.repliedAt,
        r.createdAt
      FROM reviews r
      LEFT JOIN customers c ON r.customerId = c.id
      ORDER BY r.createdAt DESC
    `);

    res.json({ data: reviews });
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/reviews/booking/:bookingId (client)
router.get("/booking/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [reviews] = await db.query(
      `
      SELECT
        r.id,
        r.bookingId,
        r.customerId,
        c.fullName,
        r.rating,
        r.comment,
        r.status,
        r.adminReply,
        r.repliedAt,
        r.createdAt
      FROM reviews r
      LEFT JOIN customers c ON r.customerId = c.id
      WHERE r.bookingId = ?
      LIMIT 1
    `,
      [bookingId],
    );

    res.json({
      data: reviews[0] || null,
    });
  } catch (error) {
    console.error("Get review by booking error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/reviews/:id (admin)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [reviews] = await db.query(
      `
      SELECT
        r.id,
        r.bookingId,
        r.customerId,
        c.fullName,
        r.rating,
        r.comment,
        r.status,
        r.adminReply,
        r.repliedAt,
        r.createdAt
      FROM reviews r
      LEFT JOIN customers c ON r.customerId = c.id
      WHERE r.id = ?
    `,
      [id],
    );

    if (reviews.length === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({ data: reviews[0] });
  } catch (error) {
    console.error("Get review detail error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/reviews (client)
router.post("/", async (req, res) => {
  try {
    const { bookingId, customerId, rating, comment } = req.body;

    if (!bookingId || !customerId || !rating) {
      return res.status(400).json({
        message: "bookingId, customerId and rating are required",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Rating must be between 1 and 5",
      });
    }

    const [bookings] = await db.query(
      "SELECT id, customerId, status FROM bookings WHERE id = ?",
      [bookingId],
    );

    if (bookings.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (Number(bookings[0].customerId) !== Number(customerId)) {
      return res.status(403).json({
        message: "You can only review your own booking",
      });
    }

    if (!["checked_out", "completed"].includes(bookings[0].status)) {
      return res.status(400).json({
        message: "Only checked-out bookings can be reviewed",
      });
    }

    const [existedReview] = await db.query(
      "SELECT id FROM reviews WHERE bookingId = ? AND customerId = ?",
      [bookingId, customerId],
    );

    if (existedReview.length > 0) {
      return res.status(400).json({
        message: "This booking has already been reviewed",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO reviews
        (bookingId, customerId, rating, comment, status)
      VALUES (?, ?, ?, ?, 'pending')
    `,
      [bookingId, customerId, rating, comment || null],
    );

    res.status(201).json({
      message: "Create review successfully",
      data: {
        id: result.insertId,
        bookingId,
        customerId,
        rating,
        comment: comment || null,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/reviews/:id/status (admin)
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatus = ["pending", "approved", "rejected"];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        message: "Status must be pending, approved or rejected",
      });
    }

    const [result] = await db.query(
      "UPDATE reviews SET status = ? WHERE id = ?",
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({ message: "Update review status successfully" });
  } catch (error) {
    console.error("Update review status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/reviews/:id/reply (admin)
router.patch("/:id/reply", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminReply } = req.body;

    if (!adminReply || !adminReply.trim()) {
      return res.status(400).json({
        message: "Admin reply is required",
      });
    }

    const [result] = await db.query(
      `
      UPDATE reviews
      SET adminReply = ?, repliedAt = NOW()
      WHERE id = ?
      `,
      [adminReply.trim(), id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({ message: "Reply review successfully" });
  } catch (error) {
    console.error("Reply review error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/reviews/:id (client)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId, rating, comment } = req.body;

    if (!customerId || !rating) {
      return res.status(400).json({
        message: "customerId and rating are required",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Rating must be between 1 and 5",
      });
    }

    const [reviews] = await db.query(
      "SELECT id, customerId FROM reviews WHERE id = ?",
      [id],
    );

    if (reviews.length === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (Number(reviews[0].customerId) !== Number(customerId)) {
      return res.status(403).json({
        message: "You can only update your own review",
      });
    }

    await db.query(
      `
      UPDATE reviews
      SET rating = ?, comment = ?, status = 'pending'
      WHERE id = ?
    `,
      [rating, comment || null, id],
    );

    res.json({
      message: "Update review successfully",
    });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/reviews/:id/reply (admin)
router.delete("/:id/reply", async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      `
      UPDATE reviews
      SET adminReply = NULL, repliedAt = NULL
      WHERE id = ?
      `,
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({ message: "Delete review reply successfully" });
  } catch (error) {
    console.error("Delete review reply error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/reviews/:id (admin)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM reviews WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({ message: "Delete review successfully" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;

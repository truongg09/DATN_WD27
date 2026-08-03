const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const REVIEW_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "reviews");
if (!fs.existsSync(REVIEW_UPLOAD_DIR)) {
  fs.mkdirSync(REVIEW_UPLOAD_DIR, { recursive: true });
}

const MAX_FILE_SIZE_MB = 5; // khớp với MAX_IMAGE_SIZE_MB phía frontend
const MAX_FILES_PER_REQUEST = 5; // khớp với MAX_REVIEW_IMAGES phía frontend
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, REVIEW_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    cb(null, `review_${uniqueSuffix}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Chỉ chấp nhận file ảnh (jpeg, png, webp, gif)"));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: MAX_FILES_PER_REQUEST,
  },
});

router.post("/review-images", requireAuth, (req, res) => {
  upload.array("images", MAX_FILES_PER_REQUEST)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: `Ảnh phải nhỏ hơn ${MAX_FILE_SIZE_MB}MB` });
      }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        return res
          .status(400)
          .json({ message: `Chỉ được tải tối đa ${MAX_FILES_PER_REQUEST} ảnh mỗi lần` });
      }
      return res.status(400).json({ message: "Tải ảnh lên thất bại" });
    }
    if (err) {
      return res.status(400).json({ message: err.message || "Tải ảnh lên thất bại" });
    }

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "Vui lòng chọn ít nhất 1 ảnh" });
    }

    const origin = `${req.protocol}://${req.get("host")}`;
    const urls = files.map((file) => `${origin}/uploads/reviews/${file.filename}`);

    res.status(201).json({
      message: "Tải ảnh lên thành công",
      data: { urls },
    });
  });
});

module.exports = router;
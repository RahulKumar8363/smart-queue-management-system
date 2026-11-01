const express = require("express");
const router = express.Router();

const {
  adminLogin,
  createStaff
} = require("../controllers/authController");

const verifyAdminToken = require("../middleware/authMiddleware");

// Admin and Super Admin login
router.post("/login", adminLogin);

// Only Super Admin can create staff accounts
router.post(
  "/staff",
  verifyAdminToken,
  (req, res, next) => {
    if (req.admin.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can create staff accounts"
      });
    }

    next();
  },
  createStaff
);

module.exports = router;
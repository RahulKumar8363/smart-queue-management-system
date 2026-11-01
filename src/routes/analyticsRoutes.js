const express = require("express");
const router = express.Router();

const { getAnalytics } = require("../controllers/analyticsController");
const verifyAdminToken = require("../middleware/authMiddleware");

// Public analytics route
router.get("/", getAnalytics);

// Protected admin analytics route
router.get("/admin", verifyAdminToken, getAnalytics);

module.exports = router;
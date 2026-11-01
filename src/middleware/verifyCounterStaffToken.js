const jwt = require("jsonwebtoken");

function verifyCounterStaffToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Please login first."
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const allowedRoles = ["SUPER_ADMIN", "ADMIN", "STAFF"];

    if (!allowedRoles.includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: "Counter staff access required."
      });
    }

    req.admin = decoded;
    next();

  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }
}

module.exports = verifyCounterStaffToken;
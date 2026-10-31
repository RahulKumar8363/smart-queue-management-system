
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");

// ================= ADMIN LOGIN =================
async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Find admin
    const admins = await query(
      `SELECT id, name, email, password, role, status
       FROM admins
       WHERE email = ?
       LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (!admins.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const admin = admins[0];

    // Check account status
    if (admin.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your admin account is inactive"
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      password,
      admin.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error during admin login"
    });
  }
}

module.exports = {
  adminLogin
};

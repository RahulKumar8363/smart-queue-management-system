
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");

// ================= ADMIN / STAFF LOGIN =================
async function adminLogin(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

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

        if (admin.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive"
            });
        }

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
            message: "Login successful",
            token,
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (err) {
        console.error("LOGIN ERROR:", err);

        return res.status(500).json({
            success: false,
            message: "Server error during login"
        });
    }
}


// ================= CREATE STAFF ACCOUNT =================
async function createStaff(req, res) {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        if (name.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: "Name must be within 100 characters"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existing = await query(
            "SELECT id FROM admins WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await query(
            `INSERT INTO admins
             (name, email, password, role, status)
             VALUES (?, ?, ?, 'STAFF', 'ACTIVE')`,
            [name.trim(), normalizedEmail, hashedPassword]
        );

        return res.status(201).json({
            success: true,
            message: "Staff account created successfully"
        });

    } catch (err) {
        console.error("CREATE STAFF ERROR:", err);

        return res.status(500).json({
            success: false,
            message: "Server error while creating staff account"
        });
    }
}


// ================= EXPORT FUNCTIONS =================
module.exports = {
    adminLogin,
    createStaff
};

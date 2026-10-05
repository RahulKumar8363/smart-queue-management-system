const mysql = require("mysql2/promise");
require("dotenv").config();

let pool = null;

// ================= INIT DB =================
async function initDb() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "smart_queue",
      port: process.env.DB_PORT || 3306,

      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // test connection
    const conn = await pool.getConnection();
    conn.release();

    console.log("✅ MySQL Connected Successfully");

  } catch (err) {
    console.error("❌ MySQL Connection Failed:");
    console.error(err.message);
    process.exit(1);
  }
}

// ================= QUERY FUNCTION =================
async function query(sql, params = []) {
  try {
    if (!pool) {
      throw new Error("DB not initialized. Call initDb() first.");
    }

    const [rows] = await pool.execute(sql, params);
    return rows;

  } catch (err) {
    console.error("❌ SQL ERROR:");
    console.error(err.message);
    throw err;
  }
}

// ================= GET CONNECTION =================
async function getConnection() {
  if (!pool) {
    throw new Error("DB not initialized");
  }

  return await pool.getConnection();
}

module.exports = {
  initDb,
  query,
  getConnection
};
require("dotenv").config();

const bcrypt = require("bcryptjs");
const readline = require("readline");
const { query, initDb } = require("../config/db");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function createAdmin() {
  try {
    await initDb();

    const name = (await ask("Admin name: ")).trim();
    const email = (await ask("Admin email: ")).trim().toLowerCase();
    const password = await ask("Create a strong admin password: ");

    if (!name || !email || password.length < 12) {
      throw new Error(
        "Name and email are required; password must be at least 12 characters."
      );
    }

    const existing = await query(
      "SELECT id FROM admins WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing.length > 0) {
      throw new Error("An admin with this email already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await query(
      `INSERT INTO admins (name, email, password, role, status)
       VALUES (?, ?, ?, 'SUPER_ADMIN', 'ACTIVE')`,
      [name, email, hashedPassword]
    );

    console.log("Admin account created successfully.");
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    process.exit();
  }
}

createAdmin();
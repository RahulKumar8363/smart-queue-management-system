const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { initDb } = require("./config/db");
const { initSocket } = require("./socket/queueSocket");

const departmentRoutes = require("./routes/departmentRoutes");
const tokenRoutes = require("./routes/tokenRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();
const server = http.createServer(app);

// ================= SOCKET =================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH"]
  }
});

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve frontend
app.use(express.static(path.join(__dirname, "../public")));

// ================= ROUTES =================
app.use("/api/departments", departmentRoutes);
app.use("/api/tokens", tokenRoutes);
app.use("/api/analytics", analyticsRoutes);

// ================= SOCKET INIT =================
initSocket(io);

// ================= HEALTH CHECK =================
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Smart Queue System Running"
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDb();

    server.listen(PORT, () => {
      console.log("====================================================");
      console.log("🚀 Smart Queue Management System Running");
      console.log(`📱 User Portal: http://localhost:${PORT}`);
      console.log(`💻 Admin Panel: http://localhost:${PORT}/admin.html`);
      console.log(`📊 Dashboard:   http://localhost:${PORT}/dashboard.html`);
      console.log("====================================================");
    });

  } catch (err) {
    console.error("❌ Server failed to start:", err);
  }
}

startServer();
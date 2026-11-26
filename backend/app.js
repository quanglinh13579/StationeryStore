const express = require("express");
const { createAuthRouter, requireAdmin, requireAuth } = require("./auth");

function createApp(db) {
  const app = express();
  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS || "http://localhost:5500,http://127.0.0.1:5500")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  app.use((req, res, next) => {
    const origin = req.get("Origin");
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ message: "Origin không được phép." });
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  });

  app.use(express.json({ limit: "10kb" }));
  app.get("/api/health", async (req, res, next) => {
    try {
      await db.execute("SELECT 1");
      return res.json({ status: "ok", database: "connected" });
    } catch (error) {
      return next(error);
    }
  });

  app.use("/api/auth", createAuthRouter(db));
  app.get("/api/admin/check", requireAuth, requireAdmin, (req, res) => {
    return res.json({ message: "Quyền Admin hợp lệ.", user: req.user });
  });

  app.use((req, res) => {
    return res.status(404).json({ message: "Không tìm thấy API." });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === "entity.too.large") {
      return res.status(413).json({ message: "Dữ liệu gửi lên quá lớn." });
    }
    if (error instanceof SyntaxError && "body" in error) {
      return res.status(400).json({ message: "Dữ liệu JSON không hợp lệ." });
    }
    console.error("Lỗi API:", error);
    return res.status(500).json({ message: "Lỗi máy chủ." });
  });

  return app;
}

module.exports = { createApp };

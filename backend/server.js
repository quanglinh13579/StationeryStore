const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { createApp } = require("./app");
const { createDbPool } = require("./db");

function validateEnvironment() {
  const required = ["DB_HOST", "DB_USER", "DB_NAME"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Thiếu cấu hình: ${missing.join(", ")}.`);
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET phải có ít nhất 32 ký tự.");
  }
}

async function startServer() {
  validateEnvironment();
  const db = createDbPool();
  const port = Number(process.env.PORT || 3000);

  try {
    await db.execute("SELECT 1");
    const app = createApp(db);
    app.listen(port, () => {
      console.log(`StationeryStore API đang chạy tại http://localhost:${port}`);
    });
  } catch (error) {
    await db.end();
    throw error;
  }
}

startServer().catch((error) => {
  console.error("Không thể khởi động API:", error.message);
  process.exitCode = 1;
});

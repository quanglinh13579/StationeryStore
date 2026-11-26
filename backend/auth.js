const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 10;
const MAX_BCRYPT_PASSWORD_BYTES = 72;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET phải có ít nhất 32 ký tự.");
  }
  return secret;
}

function createToken(user) {
  return jwt.sign(
    {
      name: user.name,
      email: user.email,
      role: user.role,
    },
    getJwtSecret(),
    {
      subject: String(user.id),
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    },
  );
}

function getPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

function requireAuth(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Vui lòng đăng nhập." });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (
      typeof payload !== "object" ||
      typeof payload.sub !== "string" ||
      !["user", "admin"].includes(payload.role)
    ) {
      return res.status(401).json({ message: "Token không hợp lệ." });
    }

    req.user = {
      id: Number(payload.sub),
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch {
    return res
      .status(401)
      .json({ message: "Token không hợp lệ hoặc đã hết hạn." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Bạn không có quyền Admin." });
  }
  return next();
}

function createAuthRouter(db) {
  const router = express.Router();

  router.post("/register", async (req, res) => {
    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        message: "Họ tên phải có từ 2 đến 100 ký tự.",
      });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Email không hợp lệ." });
    }
    if (!/^\+?[0-9\s().-]{8,20}$/.test(phone)) {
      return res.status(400).json({ message: "Số điện thoại không hợp lệ." });
    }
    if (
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > MAX_BCRYPT_PASSWORD_BYTES
    ) {
      return res.status(400).json({
        message: "Mật khẩu phải có ít nhất 8 ký tự và tối đa 72 byte.",
      });
    }

    try {
      const [existingUsers] = await db.execute(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email],
      );
      if (existingUsers.length > 0) {
        return res.status(409).json({ message: "Email này đã được đăng ký." });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const [result] = await db.execute(
        "INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'user')",
        [name, email, phone, passwordHash],
      );
      const user = {
        id: result.insertId,
        name,
        email,
        phone,
        role: "user",
      };

      return res.status(201).json({
        message: "Đăng ký thành công.",
        token: createToken(user),
        user: getPublicUser(user),
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Email này đã được đăng ký." });
      }
      console.error("Không thể đăng ký tài khoản:", error);
      return res.status(500).json({ message: "Không thể tạo tài khoản." });
    }
  });

  router.post("/login", async (req, res) => {
    const body = req.body || {};
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      return res.status(400).json({
        message: "Vui lòng nhập email và mật khẩu hợp lệ.",
      });
    }

    try {
      const [users] = await db.execute(
        "SELECT id, full_name AS name, email, phone, password_hash, role FROM users WHERE email = ? LIMIT 1",
        [email],
      );
      const user = users[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res
          .status(401)
          .json({ message: "Email hoặc mật khẩu không đúng." });
      }

      const publicUser = getPublicUser(user);
      return res.json({
        message: "Đăng nhập thành công.",
        token: createToken(publicUser),
        user: publicUser,
      });
    } catch (error) {
      console.error("Không thể đăng nhập:", error);
      return res.status(500).json({ message: "Không thể đăng nhập lúc này." });
    }
  });

  router.get("/me", requireAuth, (req, res) => {
    return res.json({ user: req.user });
  });

  return router;
}

module.exports = {
  createAuthRouter,
  createToken,
  getJwtSecret,
  requireAdmin,
  requireAuth,
};

const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

process.env.JWT_SECRET =
  "test-only-secret-that-is-at-least-thirty-two-characters";

const bcrypt = require("bcryptjs");
const { createApp } = require("./app");
const { requireAdmin } = require("./auth");

function createFakeDb() {
  const users = [];
  let nextId = 1;

  return {
    users,
    async execute(sql, values = []) {
      if (sql === "SELECT 1") return [[{ 1: 1 }], []];
      if (sql.startsWith("SELECT id FROM users WHERE email")) {
        return [users.filter((user) => user.email === values[0]), []];
      }
      if (sql.startsWith("INSERT INTO users")) {
        const [name, email, phone, passwordHash] = values;
        const user = {
          id: nextId++,
          name,
          email,
          phone,
          password_hash: passwordHash,
          role: "user",
        };
        users.push(user);
        return [{ insertId: user.id }, []];
      }
      if (sql.startsWith("SELECT id, full_name AS name")) {
        const user = users.find((item) => item.email === values[0]);
        return [user ? [{ ...user }] : [], []];
      }
      throw new Error(`Truy vấn không được hỗ trợ trong test: ${sql}`);
    },
  };
}

async function withApi(callback) {
  const db = createFakeDb();
  const server = createApp(db).listen(0);
  await once(server, "listening");
  const address = server.address();
  try {
    return await callback(`http://127.0.0.1:${address.port}`, db);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postJson(url, body, token) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("đăng ký lưu mật khẩu đã hash và luôn tạo role user", async () => {
  await withApi(async (baseUrl, db) => {
    const response = await postJson(`${baseUrl}/api/auth/register`, {
      name: "Nguyen Van A",
      email: "  Linh@example.com ",
      phone: "0912345678",
      password: "MatKhau123",
      role: "admin",
    });
    const result = await response.json();

    assert.equal(response.status, 201);
    assert.equal(result.user.email, "linh@example.com");
    assert.equal(result.user.role, "user");
    assert.equal(result.user.password_hash, undefined);
    assert.notEqual(db.users[0].password_hash, "MatKhau123");
    assert.equal(
      await bcrypt.compare("MatKhau123", db.users[0].password_hash),
      true,
    );
  });
});

test("từ chối email trùng và dữ liệu đăng ký sai", async () => {
  await withApi(async (baseUrl) => {
    const validUser = {
      name: "Nguyen Van A",
      email: "linh@example.com",
      phone: "0912345678",
      password: "MatKhau123",
    };
    const first = await postJson(`${baseUrl}/api/auth/register`, validUser);
    const duplicate = await postJson(`${baseUrl}/api/auth/register`, validUser);
    const invalid = await postJson(`${baseUrl}/api/auth/register`, {
      ...validUser,
      password: "123",
    });

    assert.equal(first.status, 201);
    assert.equal(duplicate.status, 409);
    assert.equal(invalid.status, 400);
  });
});

test("đăng nhập trả JWT, /me kiểm tra token và từ chối mật khẩu sai", async () => {
  await withApi(async (baseUrl) => {
    await postJson(`${baseUrl}/api/auth/register`, {
      name: "Nguyen Van A",
      email: "linh@example.com",
      phone: "0912345678",
      password: "MatKhau123",
    });
    const login = await postJson(`${baseUrl}/api/auth/login`, {
      email: "LINH@example.com",
      password: "MatKhau123",
    });
    const result = await login.json();
    const profile = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${result.token}` },
    });
    const profileResult = await profile.json();
    const wrongPassword = await postJson(`${baseUrl}/api/auth/login`, {
      email: "linh@example.com",
      password: "sai-mat-khau",
    });
    const unauthorizedProfile = await fetch(`${baseUrl}/api/auth/me`);

    assert.equal(login.status, 200);
    assert.ok(result.token);
    assert.equal(profile.status, 200);
    assert.equal(profileResult.user.role, "user");
    assert.equal(wrongPassword.status, 401);
    assert.equal(unauthorizedProfile.status, 401);
  });
});

test("middleware không cho User đi qua quyền Admin", () => {
  const req = { user: { role: "user" } };
  let statusCode = 200;
  let responseBody;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(statusCode, 403);
  assert.equal(responseBody.message, "Bạn không có quyền Admin.");
  assert.equal(nextCalled, false);
});

test("middleware cho phép tài khoản có role Admin", () => {
  const req = { user: { role: "admin" } };
  let nextCalled = false;

  requireAdmin(
    req,
    {
      status() {
        throw new Error("Admin không được nhận lỗi quyền.");
      },
      json() {
        throw new Error("Admin không được nhận lỗi quyền.");
      },
    },
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, true);
});

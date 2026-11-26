const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

process.env.JWT_SECRET =
  "test-only-secret-that-is-at-least-thirty-two-characters";

const { createApp } = require("./app");
const { createToken } = require("./auth");

function createAdminTestDb() {
  const queries = [];
  return {
    queries,
    async execute(sql) {
      queries.push(sql);
      if (sql.includes("AS totalProducts")) {
        return [
          [
            {
              totalProducts: "8",
              totalOrders: "12",
              totalRevenue: "345000",
            },
          ],
          [],
        ];
      }
      if (sql.startsWith("SELECT COUNT(*) AS total FROM products p")) {
        return [[{ total: 1 }], []];
      }
      if (sql.startsWith("SELECT p.id, p.slug")) {
        return [
          [
            {
              id: 1,
              slug: "test-notebook",
              name: "Sổ kiểm thử",
              description: "Sổ dùng để kiểm thử",
              image_url: "assets/test-notebook.png",
              price: "25000",
              original_price: null,
              stock: 5,
              rating: "0.0",
              review_count: 0,
              is_popular: 0,
              is_latest: 1,
              is_active: 1,
              category_slugs: "notebook",
            },
          ],
          [],
        ];
      }
      if (sql.includes("SELECT c.slug, c.name, c.description, c.is_active")) {
        return [
          [
            {
              slug: "notebook",
              name: "Sổ & vở",
              description: "",
              isActive: 1,
              productsCount: "4",
            },
          ],
          [],
        ];
      }
      if (sql.startsWith("SELECT COUNT(*) AS total FROM users WHERE role")) {
        return [[{ total: 1 }], []];
      }
      if (sql.startsWith("SELECT id, full_name AS name")) {
        return [
          [
            {
              id: 5,
              name: "Nguyen Van A",
              email: "customer@example.test",
              phone: "0912345678",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          ],
          [],
        ];
      }
      throw new Error(`Truy vấn không được hỗ trợ trong test: ${sql}`);
    },
  };
}

test("Admin APIs trả dữ liệu thật đã lọc và từ chối user thường", async () => {
  const db = createAdminTestDb();
  const server = createApp(db).listen(0);
  await once(server, "listening");

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin`;
    const adminToken = createToken({
      id: 1,
      name: "Admin",
      email: "admin@example.test",
      role: "admin",
    });
    const userToken = createToken({
      id: 2,
      name: "User",
      email: "user@example.test",
      role: "user",
    });
    const unauthenticated = await fetch(`${baseUrl}/dashboard`);
    const forbidden = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const headers = { Authorization: `Bearer ${adminToken}` };
    const dashboardResponse = await fetch(`${baseUrl}/dashboard`, { headers });
    const dashboard = await dashboardResponse.json();
    const productsResponse = await fetch(
      `${baseUrl}/products?page=1&limit=20&status=all`,
      { headers },
    );
    const products = await productsResponse.json();
    const categoriesResponse = await fetch(`${baseUrl}/categories`, {
      headers,
    });
    const categories = await categoriesResponse.json();
    const customersResponse = await fetch(`${baseUrl}/customers`, {
      headers,
    });
    const customers = await customersResponse.json();

    assert.equal(unauthenticated.status, 401);
    assert.equal(forbidden.status, 403);
    assert.equal(dashboardResponse.status, 200);
    assert.deepEqual(dashboard.dashboard, {
      totalProducts: 8,
      totalOrders: 12,
      totalRevenue: 345000,
    });
    assert.equal(products.products[0].isActive, true);
    assert.equal(products.products[0].price, 25000);
    assert.equal(categories.categories[0].productsCount, 4);
    assert.equal(customers.customers[0].email, "customer@example.test");
    assert.equal("password_hash" in customers.customers[0], false);
    assert.equal(
      db.queries.some((sql) => sql.includes("password_hash")),
      false,
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

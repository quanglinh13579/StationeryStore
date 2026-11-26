const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

process.env.JWT_SECRET =
  "test-only-secret-that-is-at-least-thirty-two-characters";

const express = require("express");
const { createToken } = require("./auth");
const { createCustomerRouter } = require("./commerce");

test("danh sách yêu thích sắp xếp tương thích MySQL ONLY_FULL_GROUP_BY", async () => {
  let favoriteQuery = "";
  const db = {
    async execute(sql) {
      favoriteQuery = sql;
      return [
        [
          {
            id: 1,
            slug: "integration-pencil",
            name: "Bút kiểm thử",
            description: "",
            category_slugs: "pen",
            image_url: "https://example.test/pencil.png",
            price: 1000,
            original_price: null,
            stock: 5,
            rating: 4.5,
            review_count: 2,
            is_popular: 0,
            is_latest: 1,
          },
        ],
        [],
      ];
    },
  };
  const app = express();
  app.use("/api", createCustomerRouter(db));
  const server = app.listen(0);
  await once(server, "listening");

  try {
    const token = createToken({
      id: 7,
      name: "Test User",
      email: "test@example.test",
      role: "user",
    });
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/favorites`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.products[0].id, "integration-pencil");
    assert.match(favoriteQuery, /ORDER BY MAX\(f\.created_at\) DESC/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

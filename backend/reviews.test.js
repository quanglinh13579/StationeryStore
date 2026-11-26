const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

process.env.JWT_SECRET =
  "test-only-secret-that-is-at-least-thirty-two-characters";

const { createApp } = require("./app");
const { createToken } = require("./auth");

function createReviewDb() {
  const product = {
    id: 8,
    slug: "test-product",
    name: "Test Product",
    rating: 4,
    reviewCount: 10,
  };
  let insertedReview;
  let nextReviewId = 1;

  return {
    product,
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        async execute(sql, values = []) {
          const query = sql.trimStart();
          if (query.includes("FROM products WHERE slug =")) {
            return [
              [{ id: product.id, slug: product.slug, name: product.name }],
              [],
            ];
          }
          if (query.startsWith("INSERT INTO reviews")) {
            insertedReview = {
              id: nextReviewId++,
              product_id: values[0],
              reviewer_name: values[1],
              rating: values[2],
              comment: values[3],
              created_at: "2026-01-01T00:00:00.000Z",
            };
            return [{ insertId: insertedReview.id }, []];
          }
          if (query.startsWith("UPDATE products")) {
            product.rating =
              Math.round(
                ((product.rating * product.reviewCount + values[0]) /
                  (product.reviewCount + 1)) *
                  10,
              ) / 10;
            product.reviewCount += 1;
            return [{ affectedRows: 1 }, []];
          }
          if (query.startsWith("SELECT reviewer_name AS name")) {
            return [
              [
                {
                  name: insertedReview.reviewer_name,
                  productId: product.slug,
                  product: product.name,
                  rating: insertedReview.rating,
                  comment: insertedReview.comment,
                  createdAt: insertedReview.created_at,
                },
              ],
              [],
            ];
          }
          if (query.startsWith("SELECT rating, review_count AS reviewCount")) {
            return [
              [{ rating: product.rating, reviewCount: product.reviewCount }],
              [],
            ];
          }
          throw new Error(`Truy vấn không được hỗ trợ trong test: ${sql}`);
        },
      };
    },
  };
}

test("chỉ User đăng nhập mới gửi được nhận xét và điểm được cập nhật", async () => {
  const db = createReviewDb();
  const server = createApp(db).listen(0);
  await once(server, "listening");

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/reviews`;
    const anonymous = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: "test-product",
        rating: 5,
        comment: "Sản phẩm rất tốt.",
      }),
    });
    assert.equal(anonymous.status, 401);

    const token = createToken({
      id: 12,
      name: "Người đánh giá",
      email: "reviewer@example.test",
      role: "user",
    });
    const invalid = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId: "test-product",
        rating: 6,
        comment: "Sản phẩm rất tốt.",
      }),
    });
    assert.equal(invalid.status, 400);

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId: "test-product",
        rating: 5,
        comment: "Sản phẩm rất tốt.",
        name: "Tên giả mạo",
      }),
    });
    const result = await response.json();

    assert.equal(response.status, 201);
    assert.equal(result.review.name, "Người đánh giá");
    assert.equal(result.product.reviewCount, 11);
    assert.equal(result.product.rating, 4.1);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

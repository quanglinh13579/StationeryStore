const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

process.env.JWT_SECRET =
  "test-only-secret-that-is-at-least-thirty-two-characters";

const express = require("express");
const { createToken } = require("./auth");
const { createCustomerRouter } = require("./commerce");
const { createApp } = require("./app");
const {
  createMomoPayment,
  IPN_FIELDS,
  signFields,
} = require("./momo");

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

test("checkout yêu cầu khóa idempotency, từ chối ví điện tử và giỏ trống", async () => {
  const db = {
    async execute(sql) {
      if (sql.startsWith("SELECT id FROM orders WHERE user_id = ?")) {
        return [[], []];
      }
      throw new Error(`Truy vấn không được hỗ trợ trong test: ${sql}`);
    },
  };
  const server = createApp(db).listen(0);
  await once(server, "listening");

  try {
    const token = createToken({
      id: 7,
      name: "Test User",
      email: "test@example.test",
      role: "user",
    });
    const url = `http://127.0.0.1:${server.address().port}/api/orders`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const validBody = {
      customer: {
        name: "Test User",
        phone: "0912345678",
        address: "123 Duong ABC",
      },
      items: [{ productId: "test-product", quantity: 1 }],
      paymentMethod: "cod",
    };

    const missingKey = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(validBody),
    });
    assert.equal(missingKey.status, 400);

    const unsupportedPayment = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "checkout-test-wallet" },
      body: JSON.stringify({ ...validBody, paymentMethod: "e_wallet" }),
    });
    assert.equal(unsupportedPayment.status, 400);

    const emptyCart = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "checkout-test-empty" },
      body: JSON.stringify({ ...validBody, items: [] }),
    });
    assert.equal(emptyCart.status, 400);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("đặt hàng ghi mốc trạng thái ban đầu trong transaction", async () => {
  const history = [];
  let committed = false;
  const db = {
    async execute(sql) {
      if (sql.startsWith("SELECT id FROM orders WHERE user_id = ?")) {
        return [[], []];
      }
      throw new Error(`Truy vấn không được hỗ trợ trong test: ${sql}`);
    },
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {
          committed = true;
        },
        async rollback() {},
        release() {},
        async execute(sql, values) {
          if (sql.includes("SELECT ci.id AS cartItemId")) {
            return [
              [
                {
                  cartItemId: 4,
                  cartQuantity: 1,
                  productId: 9,
                  slug: "test-notebook",
                  name: "Sổ kiểm thử",
                  image: "assets/test-notebook.png",
                  price: "25000",
                  stock: 5,
                },
              ],
              [],
            ];
          }
          if (sql.startsWith("INSERT INTO orders")) {
            return [{ insertId: 31 }, []];
          }
          if (sql.includes("INSERT INTO order_status_history")) {
            history.push(values);
            return [{ affectedRows: 1 }, []];
          }
          if (sql.startsWith("UPDATE products SET stock = stock - ?")) {
            return [{ affectedRows: 1 }, []];
          }
          if (sql.startsWith("INSERT INTO order_items")) {
            return [{ insertId: 1 }, []];
          }
          if (sql.startsWith("DELETE FROM cart_items")) {
            return [{ affectedRows: 1 }, []];
          }
          throw new Error(`Truy vấn không được hỗ trợ trong test: ${sql}`);
        },
      };
    },
  };
  const server = createApp(db).listen(0);
  await once(server, "listening");

  try {
    const token = createToken({
      id: 7,
      name: "Test User",
      email: "test@example.test",
      role: "user",
    });
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "checkout-track-001",
        },
        body: JSON.stringify({
          customer: {
            name: "Test User",
            phone: "0912345678",
            address: "123 Duong ABC",
          },
          items: [{ productId: "test-notebook", quantity: 1, variant: "" }],
          paymentMethod: "cod",
        }),
      },
    );
    const result = await response.json();

    assert.equal(response.status, 201);
    assert.equal(result.order.id, 31);
    assert.equal(committed, true);
    assert.deepEqual(history, [[31, 7]]);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("MoMo IPN chỉ xác nhận thanh toán khi chữ ký hợp lệ", async () => {
  const previousEnvironment = {
    partnerCode: process.env.MOMO_PARTNER_CODE,
    accessKey: process.env.MOMO_ACCESS_KEY,
    secretKey: process.env.MOMO_SECRET_KEY,
    redirectUrl: process.env.MOMO_REDIRECT_URL,
    ipnUrl: process.env.MOMO_IPN_URL,
  };
  process.env.MOMO_PARTNER_CODE = "PARTNER";
  process.env.MOMO_ACCESS_KEY = "ACCESS";
  process.env.MOMO_SECRET_KEY = "test-secret";
  process.env.MOMO_REDIRECT_URL = "http://localhost:5500/checkout.html";
  process.env.MOMO_IPN_URL = "https://example.test/api/payments/momo/ipn";
  let updatedPayment = false;
  const db = {
    async execute() {
      throw new Error("IPN phải dùng transaction connection.");
    },
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        async execute(sql) {
          if (sql.includes("FROM orders WHERE order_number = ?")) {
            return [
              [
                {
                  id: 1,
                  userId: 7,
                  paymentMethod: "momo",
                  paymentStatus: "pending",
                  status: "pending",
                  total: "10000",
                  requestId: "request-1",
                  transactionId: null,
                },
              ],
              [],
            ];
          }
          if (sql.includes("SET payment_status = 'paid'")) {
            updatedPayment = true;
            return [{ affectedRows: 1 }, []];
          }
          throw new Error(`Truy vấn không được hỗ trợ trong test: ${sql}`);
        },
      };
    },
  };
  const server = createApp(db).listen(0);
  await once(server, "listening");

  try {
    const body = {
      partnerCode: "PARTNER",
      accessKey: "ACCESS",
      requestId: "request-1",
      amount: "10000",
      orderId: "NN-TEST",
      orderInfo: "Thanh toan don hang NN-TEST",
      orderType: "momo_wallet",
      transId: "transaction-1",
      resultCode: "0",
      message: "Successful.",
      payType: "qr",
      responseTime: "1710000000000",
      extraData: "",
    };
    body.signature = signFields(IPN_FIELDS, body, process.env.MOMO_SECRET_KEY);
    const url = `http://127.0.0.1:${server.address().port}/api/payments/momo/ipn`;
    const validResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const validResult = await validResponse.json();
    assert.equal(validResponse.status, 200);
    assert.equal(validResult.paymentStatus, "paid");
    assert.equal(updatedPayment, true);

    body.signature = `${body.signature.slice(0, -1)}0`;
    const invalidResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(invalidResponse.status, 400);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    if (previousEnvironment.partnerCode === undefined) {
      delete process.env.MOMO_PARTNER_CODE;
    } else {
      process.env.MOMO_PARTNER_CODE = previousEnvironment.partnerCode;
    }
    if (previousEnvironment.accessKey === undefined) {
      delete process.env.MOMO_ACCESS_KEY;
    } else {
      process.env.MOMO_ACCESS_KEY = previousEnvironment.accessKey;
    }
    if (previousEnvironment.secretKey === undefined) {
      delete process.env.MOMO_SECRET_KEY;
    } else {
      process.env.MOMO_SECRET_KEY = previousEnvironment.secretKey;
    }
    if (previousEnvironment.redirectUrl === undefined) {
      delete process.env.MOMO_REDIRECT_URL;
    } else {
      process.env.MOMO_REDIRECT_URL = previousEnvironment.redirectUrl;
    }
    if (previousEnvironment.ipnUrl === undefined) {
      delete process.env.MOMO_IPN_URL;
    } else {
      process.env.MOMO_IPN_URL = previousEnvironment.ipnUrl;
    }
  }
});

test("MoMo tạo URL Sandbox với chữ ký và mã đơn riêng", async () => {
  const originalFetch = global.fetch;
  let requestPayload;
  global.fetch = async (url, options) => {
    assert.equal(url, "https://test-payment.momo.vn/v2/gateway/api/create");
    requestPayload = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return {
          partnerCode: "PARTNER",
          requestId: "request-2",
          orderId: "NN-TEST-2",
          resultCode: 0,
          payUrl: "https://payment.momo.vn/pay/test",
        };
      },
    };
  };

  try {
    const payment = await createMomoPayment(
      {
        partnerCode: "PARTNER",
        accessKey: "ACCESS",
        secretKey: "test-secret",
        createUrl: "https://test-payment.momo.vn/v2/gateway/api/create",
        redirectUrl: "http://localhost:5500/checkout.html",
        ipnUrl: "https://example.test/api/payments/momo/ipn",
      },
      {
        id: 2,
        orderNumber: "NN-TEST-2",
        total: 25000,
        momoRequestId: "request-2",
      },
    );
    assert.equal(payment.paymentUrl, "https://payment.momo.vn/pay/test");
    assert.equal(requestPayload.amount, "25000");
    assert.equal(requestPayload.requestType, "captureWallet");
    assert.equal(
      requestPayload.signature,
      signFields(
        [
          "accessKey",
          "amount",
          "extraData",
          "ipnUrl",
          "orderId",
          "orderInfo",
          "partnerCode",
          "redirectUrl",
          "requestId",
          "requestType",
        ],
        requestPayload,
        "test-secret",
      ),
    );
    const redirectUrl = new URL(requestPayload.redirectUrl);
    assert.equal(redirectUrl.searchParams.get("paymentReturn"), "momo");
    assert.equal(redirectUrl.searchParams.get("localOrderId"), "2");
  } finally {
    global.fetch = originalFetch;
  }
});

test("khách hàng chỉ xem đơn của mình, gồm sản phẩm và lịch sử trạng thái", async () => {
  const order = {
    id: 12,
    orderNumber: "NN-TRACK-12",
    status: "shipping",
    note: "",
    recipientName: "Test User",
    phone: "0912345678",
    address: "123 Duong ABC",
    paymentMethod: "cod",
    paymentStatus: "unpaid",
    subtotal: "25000",
    discount: "0",
    delivery: "30000",
    total: "55000",
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
  };
  const item = {
    productId: "test-notebook",
    name: "Sổ kiểm thử",
    image: "assets/test-notebook.png",
    price: "25000",
    quantity: 1,
    variant: "",
  };
  const statusHistory = [
    { status: "pending", changedAt: new Date("2026-02-01T10:00:00.000Z") },
    { status: "confirmed", changedAt: new Date("2026-02-01T11:00:00.000Z") },
    { status: "preparing", changedAt: new Date("2026-02-01T12:00:00.000Z") },
    { status: "shipping", changedAt: new Date("2026-02-01T13:00:00.000Z") },
  ];
  const db = {
    async execute(sql, values) {
      if (sql.includes("FROM orders WHERE user_id = ?")) {
        return [values[0] === 7 ? [order] : [], []];
      }
      if (sql.includes("FROM order_items WHERE order_id IN")) {
        return [[{ ...item, orderId: 12 }], []];
      }
      if (sql.includes("FROM orders WHERE id = ? AND user_id = ?")) {
        return [values[1] === 7 ? [order] : [], []];
      }
      if (sql.includes("FROM order_items WHERE order_id = ?")) {
        return [[item], []];
      }
      if (sql.includes("FROM order_status_history WHERE order_id = ?")) {
        return [statusHistory, []];
      }
      throw new Error(`Truy vấn không được hỗ trợ trong test: ${sql}`);
    },
  };
  const server = createApp(db).listen(0);
  await once(server, "listening");

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/orders`;
    const ownerToken = createToken({
      id: 7,
      name: "Test User",
      email: "owner@example.test",
      role: "user",
    });
    const otherToken = createToken({
      id: 8,
      name: "Other User",
      email: "other@example.test",
      role: "user",
    });
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const listResponse = await fetch(baseUrl, { headers: ownerHeaders });
    const list = await listResponse.json();
    const detailResponse = await fetch(`${baseUrl}/12`, {
      headers: ownerHeaders,
    });
    const detail = await detailResponse.json();
    const privateResponse = await fetch(`${baseUrl}/12`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });

    assert.equal(listResponse.status, 200);
    assert.equal(list.orders[0].items[0].name, "Sổ kiểm thử");
    assert.equal(list.orders[0].items[0].image, "assets/test-notebook.png");
    assert.equal(list.orders[0].items[0].quantity, 1);
    assert.equal(detailResponse.status, 200);
    assert.equal(detail.order.statusHistory.length, 4);
    assert.equal(detail.order.statusHistory[2].status, "preparing");
    assert.equal(detail.order.estimatedDeliveryAt, null);
    assert.equal(privateResponse.status, 404);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("Admin chỉ chuyển đơn qua bước đang chuẩn bị sau khi xác nhận và lưu lịch sử", async () => {
  let orderStatus = "confirmed";
  const statusHistory = [
    { status: "pending", changedAt: new Date("2026-02-01T10:00:00.000Z") },
    { status: "confirmed", changedAt: new Date("2026-02-01T11:00:00.000Z") },
  ];
  const db = {
    async execute(sql) {
      throw new Error(`Truy vấn phải dùng transaction connection: ${sql}`);
    },
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        async execute(sql, values) {
          if (sql.includes("FROM orders WHERE id = ? FOR UPDATE")) {
            return [
              [
                {
                  id: 12,
                  status: orderStatus,
                  paymentMethod: "cod",
                  paymentStatus: "unpaid",
                },
              ],
              [],
            ];
          }
          if (sql.startsWith("UPDATE orders SET status = ?")) {
            orderStatus = values[0];
            return [{ affectedRows: 1 }, []];
          }
          if (sql.includes("INSERT INTO order_status_history")) {
            statusHistory.push({
              status: values[1],
              changedAt: new Date("2026-02-01T12:00:00.000Z"),
            });
            return [{ affectedRows: 1 }, []];
          }
          if (sql.startsWith("SELECT id, order_number AS orderNumber")) {
            return [
              [
                {
                  id: 12,
                  orderNumber: "NN-TRACK-12",
                  status: orderStatus,
                  recipientName: "Test User",
                  note: "",
                  phone: "0912345678",
                  address: "123 Duong ABC",
                  paymentMethod: "cod",
                  couponCode: null,
                  paymentStatus: "unpaid",
                  paymentUrl: null,
                  momoTransactionId: null,
                  momoResultCode: null,
                  subtotal: "25000",
                  discount: "0",
                  delivery: "30000",
                  total: "55000",
                  createdAt: new Date("2026-02-01T10:00:00.000Z"),
                },
              ],
              [],
            ];
          }
          if (sql.includes("FROM order_items WHERE order_id = ?")) {
            return [[], []];
          }
          if (sql.includes("FROM order_status_history WHERE order_id = ?")) {
            return [statusHistory, []];
          }
          throw new Error(`Truy vấn không được hỗ trợ trong test: ${sql}`);
        },
      };
    },
  };
  const server = createApp(db).listen(0);
  await once(server, "listening");

  try {
    const token = createToken({
      id: 1,
      name: "Admin",
      email: "admin@example.test",
      role: "admin",
    });
    const url = `http://127.0.0.1:${server.address().port}/api/admin/orders/12/status`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const skippedStep = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "shipping" }),
    });
    assert.equal(skippedStep.status, 409);
    assert.equal(orderStatus, "confirmed");

    const preparingResponse = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "preparing" }),
    });
    const result = await preparingResponse.json();
    assert.equal(preparingResponse.status, 200);
    assert.equal(result.order.status, "preparing");
    assert.equal(result.order.statusHistory.at(-1).status, "preparing");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

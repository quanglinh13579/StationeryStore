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

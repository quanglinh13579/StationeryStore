const crypto = require("node:crypto");
const express = require("express");
const { ApiError, asyncRoute } = require("./errors");

const CREATE_FIELDS = [
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
];
const IPN_FIELDS = [
  "accessKey",
  "amount",
  "extraData",
  "message",
  "orderId",
  "orderInfo",
  "orderType",
  "partnerCode",
  "payType",
  "requestId",
  "responseTime",
  "resultCode",
  "transId",
];

function getMomoConfig() {
  const config = {
    partnerCode: process.env.MOMO_PARTNER_CODE,
    accessKey: process.env.MOMO_ACCESS_KEY,
    secretKey: process.env.MOMO_SECRET_KEY,
    createUrl:
      process.env.MOMO_CREATE_URL ||
      "https://test-payment.momo.vn/v2/gateway/api/create",
    redirectUrl: process.env.MOMO_REDIRECT_URL,
    ipnUrl: process.env.MOMO_IPN_URL,
  };
  if (
    !config.partnerCode ||
    !config.accessKey ||
    !config.secretKey ||
    !config.redirectUrl ||
    !config.ipnUrl
  ) {
    throw new ApiError(
      503,
      "MoMo chưa được cấu hình. Hãy thêm Sandbox credentials vào .env.",
    );
  }
  try {
    const createUrl = new URL(config.createUrl);
    const redirectUrl = new URL(config.redirectUrl);
    const ipnUrl = new URL(config.ipnUrl);
    if (
      createUrl.protocol !== "https:" ||
      !["http:", "https:"].includes(redirectUrl.protocol) ||
      ipnUrl.protocol !== "https:"
    ) {
      throw new Error("invalid URL scheme");
    }
  } catch {
    throw new ApiError(500, "Cấu hình URL MoMo không hợp lệ.");
  }
  return config;
}

function signFields(fields, values, secretKey) {
  const raw = fields
    .map((field) => `${field}=${values[field] ?? ""}`)
    .join("&");
  return crypto.createHmac("sha256", secretKey).update(raw).digest("hex");
}

function verifySignature(fields, values, signature, secretKey) {
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const expected = Buffer.from(signFields(fields, values, secretKey), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function createMomoPayment(config, order) {
  const redirectUrl = new URL(config.redirectUrl);
  redirectUrl.searchParams.set("paymentReturn", "momo");
  redirectUrl.searchParams.set("localOrderId", String(order.id));
  const payload = {
    partnerCode: config.partnerCode,
    accessKey: config.accessKey,
    requestId: order.momoRequestId,
    amount: String(order.total),
    orderId: order.orderNumber,
    orderInfo: `Thanh toan don hang ${order.orderNumber}`,
    redirectUrl: redirectUrl.toString(),
    ipnUrl: config.ipnUrl,
    requestType: "captureWallet",
    extraData: "",
    lang: "vi",
  };
  payload.signature = signFields(CREATE_FIELDS, payload, config.secretKey);

  let response;
  try {
    const result = await fetch(config.createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    response = await result.json();
    if (!result.ok) throw new Error("MoMo returned an error.");
  } catch {
    throw new ApiError(502, "Không thể tạo giao dịch với MoMo.");
  }

  const resultCode = Number(response?.resultCode);
  if (
    response?.partnerCode !== config.partnerCode ||
    response?.requestId !== order.momoRequestId ||
    response?.orderId !== order.orderNumber ||
    !Number.isInteger(resultCode)
  ) {
    throw new ApiError(502, "Phản hồi MoMo không khớp với đơn hàng.");
  }
  if (resultCode !== 0) return { resultCode, response };
  if (typeof response.payUrl !== "string") {
    throw new ApiError(502, "MoMo không trả về URL thanh toán.");
  }
  try {
    if (new URL(response.payUrl).protocol !== "https:") {
      throw new Error("invalid URL scheme");
    }
  } catch {
    throw new ApiError(502, "URL thanh toán MoMo không hợp lệ.");
  }
  return { resultCode, paymentUrl: response.payUrl };
}

async function applyMomoResult(db, result) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute(
      `SELECT id, user_id AS userId, payment_method AS paymentMethod,
              payment_status AS paymentStatus, status, total_amount AS total,
              momo_request_id AS requestId, momo_transaction_id AS transactionId
       FROM orders WHERE order_number = ? FOR UPDATE`,
      [result.orderId],
    );
    const order = orders[0];
    if (!order) throw new ApiError(404, "Không tìm thấy đơn thanh toán MoMo.");
    if (
      order.paymentMethod !== "momo" ||
      order.requestId !== result.requestId ||
      Number(order.total) !== Number(result.amount)
    ) {
      throw new ApiError(400, "Thông tin IPN MoMo không khớp với đơn hàng.");
    }

    const resultCode = Number(result.resultCode);
    if (!Number.isInteger(resultCode)) {
      throw new ApiError(400, "Mã kết quả MoMo không hợp lệ.");
    }
    if (order.paymentStatus === "paid") {
      if (resultCode !== 0 || String(order.transactionId) !== String(result.transId)) {
        throw new ApiError(409, "Giao dịch MoMo đã được xử lý.");
      }
      await connection.commit();
      return "paid";
    }
    if (["failed", "cancelled"].includes(order.paymentStatus)) {
      if (resultCode === 0) {
        throw new ApiError(409, "Đơn MoMo đã đóng trước khi thanh toán.");
      }
      await connection.commit();
      return order.paymentStatus;
    }
    if (order.paymentStatus !== "pending" || order.status !== "pending") {
      throw new ApiError(409, "Đơn hàng không còn chờ thanh toán MoMo.");
    }

    if (resultCode === 0) {
      if (!result.transId) throw new ApiError(400, "Thiếu mã giao dịch MoMo.");
      await connection.execute(
        `UPDATE orders SET payment_status = 'paid',
         momo_transaction_id = ?, momo_result_code = ? WHERE id = ?`,
        [String(result.transId), resultCode, order.id],
      );
      await connection.commit();
      return "paid";
    }

    const paymentStatus = resultCode === 1006 ? "cancelled" : "failed";
    await connection.execute(
      `UPDATE orders SET status = 'cancelled', payment_status = ?,
       momo_result_code = ? WHERE id = ?`,
      [paymentStatus, resultCode, order.id],
    );
    const [items] = await connection.execute(
      `SELECT product_id AS productId, quantity, variant
       FROM order_items WHERE order_id = ? AND product_id IS NOT NULL`,
      [order.id],
    );
    await connection.execute(
      "INSERT INTO carts (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)",
      [order.userId],
    );
    const [carts] = await connection.execute(
      "SELECT id FROM carts WHERE user_id = ? LIMIT 1",
      [order.userId],
    );
    for (const item of items) {
      await connection.execute(
        "UPDATE products SET stock = stock + ? WHERE id = ?",
        [item.quantity, item.productId],
      );
      await connection.execute(
        `INSERT INTO cart_items (cart_id, product_id, quantity, variant)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [carts[0].id, item.productId, item.quantity, item.variant],
      );
    }
    await connection.commit();
    return paymentStatus;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function createMomoRouter(db) {
  const router = express.Router();
  router.post(
    "/momo/ipn",
    asyncRoute(async (req, res) => {
      const config = getMomoConfig();
      const body = req.body || {};
      if (
        body.partnerCode !== config.partnerCode ||
        body.accessKey !== config.accessKey ||
        !verifySignature(IPN_FIELDS, body, body.signature, config.secretKey)
      ) {
        throw new ApiError(400, "Chữ ký IPN MoMo không hợp lệ.");
      }
      if (
        typeof body.orderId !== "string" ||
        typeof body.requestId !== "string" ||
        !Number.isSafeInteger(Number(body.amount)) ||
        !Number.isInteger(Number(body.resultCode))
      ) {
        throw new ApiError(400, "Dữ liệu IPN MoMo không hợp lệ.");
      }
      const paymentStatus = await applyMomoResult(db, {
        orderId: body.orderId,
        requestId: body.requestId,
        amount: Number(body.amount),
        resultCode: Number(body.resultCode),
        transId: body.transId,
      });
      return res.json({ resultCode: 0, paymentStatus });
    }),
  );
  return router;
}

module.exports = {
  applyMomoResult,
  createMomoPayment,
  createMomoRouter,
  getMomoConfig,
  IPN_FIELDS,
  signFields,
  verifySignature,
};

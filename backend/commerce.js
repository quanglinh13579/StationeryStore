const express = require("express");
const crypto = require("node:crypto");
const { requireAuth, requireAdmin } = require("./auth");
const { PRODUCT_SELECT, mapProduct } = require("./catalog");
const { ApiError, asyncRoute, requireInteger } = require("./errors");
const { applyMomoResult, createMomoPayment, getMomoConfig } = require("./momo");

const ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "shipping",
  "completed",
  "cancelled",
]);
const ORDER_TRANSITIONS = {
  pending: new Set(["confirmed", "cancelled"]),
  confirmed: new Set(["shipping", "cancelled"]),
  shipping: new Set(["completed"]),
  completed: new Set(),
  cancelled: new Set(),
};
const PAYMENT_METHODS = new Set(["cod", "bank_transfer", "momo"]);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;
const SHIPPING_THRESHOLD = 350000;
const SHIPPING_FEE = 30000;

async function withTransaction(db, callback) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function readVariant(value) {
  const variant = typeof value === "string" ? value.trim() : "";
  if (variant.length > 100) throw new ApiError(400, "Phân loại quá dài.");
  return variant;
}

async function getCartItems(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT p.slug AS id, p.name, p.image_url AS image, p.price,
            p.original_price AS originalPrice, p.stock, ci.quantity, ci.variant
     FROM carts c
     JOIN cart_items ci ON ci.cart_id = c.id
     JOIN products p ON p.id = ci.product_id
     WHERE c.user_id = ? AND p.is_active = 1
     ORDER BY ci.id`,
    [userId],
  );
  return rows.map((row) => ({
    ...row,
    price: Number(row.price),
    originalPrice:
      row.originalPrice === null ? null : Number(row.originalPrice),
    stock: Number(row.stock),
    quantity: Number(row.quantity),
    lineTotal: Number(row.price) * Number(row.quantity),
  }));
}

async function readCart(connection, userId) {
  const items = await getCartItems(connection, userId);
  return {
    items,
    totalItems: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.lineTotal, 0),
  };
}

async function getCartId(connection, userId) {
  await connection.execute(
    "INSERT INTO carts (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)",
    [userId],
  );
  const [rows] = await connection.execute(
    "SELECT id FROM carts WHERE user_id = ? LIMIT 1",
    [userId],
  );
  return rows[0].id;
}

async function getFavoriteProducts(db, userId) {
  const [rows] = await db.execute(
    `${PRODUCT_SELECT}
     INNER JOIN favorites f ON f.product_id = p.id AND f.user_id = ?
     WHERE p.is_active = 1
     GROUP BY p.id
     ORDER BY MAX(f.created_at) DESC, p.id DESC`,
    [userId],
  );
  return rows.map(mapProduct);
}

function createCustomerRouter(db) {
  const router = express.Router();
  router.use(requireAuth);

  router.get(
    "/cart",
    asyncRoute(async (req, res) => {
      return res.json(await readCart(db, req.user.id));
    }),
  );

  router.post(
    "/cart/items",
    asyncRoute(async (req, res) => {
      const body = req.body || {};
      const productId =
        typeof body.productId === "string" ? body.productId.trim() : "";
      const quantity = requireInteger(body.quantity, "Số lượng", 1, 1000);
      const variant = readVariant(body.variant);
      if (!productId) throw new ApiError(400, "Thiếu mã sản phẩm.");

      const cart = await withTransaction(db, async (connection) => {
        const [products] = await connection.execute(
          "SELECT id, stock FROM products WHERE slug = ? AND is_active = 1 FOR UPDATE",
          [productId],
        );
        if (products.length === 0) {
          throw new ApiError(404, "Không tìm thấy sản phẩm.");
        }
        const product = products[0];
        const cartId = await getCartId(connection, req.user.id);
        const [existingItems] = await connection.execute(
          "SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant = ? FOR UPDATE",
          [cartId, product.id, variant],
        );
        const nextQuantity =
          quantity + (existingItems[0] ? Number(existingItems[0].quantity) : 0);
        if (nextQuantity > Number(product.stock)) {
          throw new ApiError(409, "Số lượng vượt quá tồn kho hiện tại.");
        }
        if (existingItems[0]) {
          await connection.execute(
            "UPDATE cart_items SET quantity = ? WHERE id = ?",
            [nextQuantity, existingItems[0].id],
          );
        } else {
          await connection.execute(
            "INSERT INTO cart_items (cart_id, product_id, quantity, variant) VALUES (?, ?, ?, ?)",
            [cartId, product.id, quantity, variant],
          );
        }
        return readCart(connection, req.user.id);
      });
      return res.status(200).json({ message: "Đã cập nhật giỏ hàng.", ...cart });
    }),
  );

  router.patch(
    "/cart/items/:productId",
    asyncRoute(async (req, res) => {
      const quantity = requireInteger(req.body?.quantity, "Số lượng", 1, 1000);
      const variant = readVariant(req.body?.variant);
      const cart = await withTransaction(db, async (connection) => {
        const [items] = await connection.execute(
          `SELECT ci.id, p.stock
           FROM carts c
           JOIN cart_items ci ON ci.cart_id = c.id
           JOIN products p ON p.id = ci.product_id
           WHERE c.user_id = ? AND p.slug = ? AND ci.variant = ?
           FOR UPDATE`,
          [req.user.id, req.params.productId, variant],
        );
        if (items.length === 0) throw new ApiError(404, "Không tìm thấy món hàng.");
        if (quantity > Number(items[0].stock)) {
          throw new ApiError(409, "Số lượng vượt quá tồn kho hiện tại.");
        }
        await connection.execute(
          "UPDATE cart_items SET quantity = ? WHERE id = ?",
          [quantity, items[0].id],
        );
        return readCart(connection, req.user.id);
      });
      return res.json({ message: "Đã cập nhật số lượng.", ...cart });
    }),
  );

  router.delete(
    "/cart/items/:productId",
    asyncRoute(async (req, res) => {
      const variant = readVariant(req.query.variant);
      await db.execute(
        `DELETE ci FROM cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         JOIN products p ON p.id = ci.product_id
         WHERE c.user_id = ? AND p.slug = ? AND ci.variant = ?`,
        [req.user.id, req.params.productId, variant],
      );
      return res.json({
        message: "Đã xóa sản phẩm khỏi giỏ hàng.",
        ...(await readCart(db, req.user.id)),
      });
    }),
  );

  router.delete(
    "/cart",
    asyncRoute(async (req, res) => {
      await db.execute(
        `DELETE ci FROM cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         WHERE c.user_id = ?`,
        [req.user.id],
      );
      return res.json({ message: "Đã xóa giỏ hàng.", items: [], totalItems: 0, subtotal: 0 });
    }),
  );

  router.get(
    "/favorites",
    asyncRoute(async (req, res) => {
      return res.json({
        products: await getFavoriteProducts(db, req.user.id),
      });
    }),
  );

  router.post(
    "/favorites",
    asyncRoute(async (req, res) => {
      const productId =
        typeof req.body?.productId === "string"
          ? req.body.productId.trim()
          : "";
      if (!productId) throw new ApiError(400, "Thiếu mã sản phẩm.");
      const [products] = await db.execute(
        "SELECT id FROM products WHERE slug = ? AND is_active = 1 LIMIT 1",
        [productId],
      );
      if (products.length === 0) {
        throw new ApiError(404, "Không tìm thấy sản phẩm.");
      }
      await db.execute(
        "INSERT IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)",
        [req.user.id, products[0].id],
      );
      return res.status(201).json({
        message: "Đã thêm vào danh sách yêu thích.",
        products: await getFavoriteProducts(db, req.user.id),
      });
    }),
  );

  router.delete(
    "/favorites/:productId",
    asyncRoute(async (req, res) => {
      await db.execute(
        `DELETE f FROM favorites f
         JOIN products p ON p.id = f.product_id
         WHERE f.user_id = ? AND p.slug = ?`,
        [req.user.id, req.params.productId],
      );
      return res.json({
        message: "Đã xóa khỏi danh sách yêu thích.",
        products: await getFavoriteProducts(db, req.user.id),
      });
    }),
  );

  router.get(
    "/orders",
    asyncRoute(async (req, res) => {
      const [orders] = await db.execute(
        `SELECT id, order_number AS orderNumber, status, order_note AS note,
                payment_method AS paymentMethod, payment_status AS paymentStatus,
                subtotal, discount_amount AS discount, shipping_fee AS delivery,
                total_amount AS total, created_at AS createdAt
         FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
        [req.user.id],
      );
      return res.json({
        orders: orders.map((order) => ({
          ...order,
          subtotal: Number(order.subtotal),
          discount: Number(order.discount),
          delivery: Number(order.delivery),
          total: Number(order.total),
        })),
      });
    }),
  );

  router.get(
    "/orders/:orderId",
    asyncRoute(async (req, res) => {
      const orderId = requireInteger(req.params.orderId, "Mã đơn hàng", 1);
      const order = await getOrderDetails(db, orderId, req.user.id);
      if (!order) throw new ApiError(404, "Không tìm thấy đơn hàng.");
      return res.json({ order });
    }),
  );

  router.post(
    "/orders/:orderId/cancel",
    asyncRoute(async (req, res) => {
      const orderId = requireInteger(req.params.orderId, "Mã đơn hàng", 1);
      const order = await withTransaction(db, async (connection) => {
        const [orders] = await connection.execute(
          `SELECT id, status, payment_method AS paymentMethod,
                  payment_status AS paymentStatus
           FROM orders WHERE id = ? AND user_id = ? FOR UPDATE`,
          [orderId, req.user.id],
        );
        if (orders.length === 0) {
          throw new ApiError(404, "Không tìm thấy đơn hàng.");
        }
        if (orders[0].status !== "pending") {
          throw new ApiError(
            409,
            "Chỉ có thể hủy đơn hàng đang chờ xác nhận.",
          );
        }
        if (
          orders[0].paymentMethod === "momo" &&
          ["pending", "paid"].includes(orders[0].paymentStatus)
        ) {
          throw new ApiError(
            409,
            "Không thể hủy đơn MoMo đang chờ thanh toán hoặc đã thanh toán.",
          );
        }

        const [items] = await connection.execute(
          "SELECT product_id AS productId, quantity FROM order_items WHERE order_id = ? AND product_id IS NOT NULL",
          [orderId],
        );
        for (const item of items) {
          await connection.execute(
            "UPDATE products SET stock = stock + ? WHERE id = ?",
            [item.quantity, item.productId],
          );
        }
        await connection.execute(
          "UPDATE orders SET status = 'cancelled' WHERE id = ?",
          [orderId],
        );
        return getOrderDetails(connection, orderId, req.user.id);
      });
      return res.json({ message: "Đã hủy đơn hàng.", order });
    }),
  );

  router.post(
    "/orders",
    asyncRoute(async (req, res) => {
      const idempotencyKey = req.get("Idempotency-Key") || "";
      if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
        throw new ApiError(
          400,
          "Thiếu hoặc sai khóa Idempotency-Key (8-100 ký tự).",
        );
      }

      const previousOrder = await getOrderByIdempotencyKey(
        db,
        req.user.id,
        idempotencyKey,
      );
      if (previousOrder) {
        if (
          previousOrder.paymentMethod === "momo" &&
          previousOrder.paymentStatus === "pending" &&
          !previousOrder.paymentUrl
        ) {
          previousOrder.paymentUrl = await startMomoPayment(
            db,
            previousOrder,
            getMomoConfig(),
          );
        }
        return res.status(200).json({
          message: "Yêu cầu đặt hàng này đã được xử lý.",
          order: previousOrder,
        });
      }

      const body = req.body || {};
      const customer = body.customer || {};
      const name =
        typeof customer.name === "string" ? customer.name.trim() : "";
      const phone =
        typeof customer.phone === "string"
          ? customer.phone.replace(/[\s-]/g, "")
          : "";
      const address =
        typeof customer.address === "string" ? customer.address.trim() : "";
      const note = typeof body.note === "string" ? body.note.trim() : "";
      const paymentMethod =
        typeof body.paymentMethod === "string" ? body.paymentMethod : "";
      const couponCode =
        typeof body.couponCode === "string"
          ? body.couponCode.trim().toUpperCase()
          : "";
      const requestedItems = Array.isArray(body.items) ? body.items : [];
      if (name.length < 2 || name.length > 100) {
        throw new ApiError(400, "Tên người nhận phải có từ 2 đến 100 ký tự.");
      }
      if (!/^(0\d{9}|\+84\d{9})$/.test(phone)) {
        throw new ApiError(400, "Số điện thoại người nhận không hợp lệ.");
      }
      if (address.length < 5 || address.length > 500) {
        throw new ApiError(400, "Địa chỉ nhận hàng không hợp lệ.");
      }
      if (note.length > 1000) {
        throw new ApiError(
          400,
          "Ghi chú đơn hàng không được vượt quá 1000 ký tự.",
        );
      }
      if (!PAYMENT_METHODS.has(paymentMethod)) {
        throw new ApiError(400, "Phương thức thanh toán không hợp lệ.");
      }
      if (couponCode && couponCode !== "NETNHO10") {
        throw new ApiError(400, "Mã giảm giá không hợp lệ.");
      }
      if (requestedItems.length === 0 || requestedItems.length > 50) {
        throw new ApiError(400, "Đơn hàng phải có từ 1 đến 50 sản phẩm.");
      }
      const momoConfig = paymentMethod === "momo" ? getMomoConfig() : null;
      const momoRequestId =
        paymentMethod === "momo" ? crypto.randomUUID() : null;

      const normalizedItems = requestedItems.map((item) => ({
        productId:
          typeof item.productId === "string" ? item.productId.trim() : "",
        quantity: requireInteger(item.quantity, "Số lượng", 1, 1000),
        variant: readVariant(item.variant),
      }));
      const uniqueItems = new Set(
        normalizedItems.map((item) =>
          JSON.stringify([item.productId, item.variant]),
        ),
      );
      if (
        normalizedItems.some((item) => !item.productId) ||
        uniqueItems.size !== normalizedItems.length
      ) {
        throw new ApiError(400, "Danh sách sản phẩm không hợp lệ.");
      }

      let order;
      try {
        order = await withTransaction(db, async (connection) => {
          const orderItems = [];
          for (const requested of normalizedItems) {
            const [rows] = await connection.execute(
              `SELECT ci.id AS cartItemId, ci.quantity AS cartQuantity, p.id AS productId,
                      p.slug, p.name, p.image_url AS image, p.price, p.stock
               FROM carts c
               JOIN cart_items ci ON ci.cart_id = c.id
               JOIN products p ON p.id = ci.product_id
               WHERE c.user_id = ? AND p.slug = ? AND ci.variant = ? AND p.is_active = 1
               FOR UPDATE`,
              [req.user.id, requested.productId, requested.variant],
            );
            const row = rows[0];
            if (!row) {
              throw new ApiError(409, "Giỏ hàng đã thay đổi. Vui lòng tải lại.");
            }
            if (Number(row.cartQuantity) !== requested.quantity) {
              throw new ApiError(409, "Số lượng trong giỏ đã thay đổi.");
            }
            if (requested.quantity > Number(row.stock)) {
              throw new ApiError(409, `Sản phẩm ${row.name} không đủ tồn kho.`);
            }
            orderItems.push({
              ...row,
              quantity: requested.quantity,
              variant: requested.variant,
              price: Number(row.price),
            });
          }

          const subtotal = orderItems.reduce(
            (total, item) => total + item.price * item.quantity,
            0,
          );
          const discount =
            couponCode === "NETNHO10" ? Math.round(subtotal * 0.1) : 0;
          const delivery =
            subtotal - discount >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
          const total = subtotal - discount + delivery;
          const orderNumber = `NN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
          const [orderResult] = await connection.execute(
            `INSERT INTO orders
             (order_number, user_id, idempotency_key, recipient_name, phone,
              address, order_note, payment_method, payment_status,
              momo_request_id, discount_code, subtotal, discount_amount,
              shipping_fee, total_amount, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
              orderNumber,
              req.user.id,
              idempotencyKey,
              name,
              phone,
              address,
              note,
              paymentMethod,
              paymentMethod === "momo" ? "pending" : "unpaid",
              momoRequestId,
              couponCode || null,
              subtotal,
              discount,
              delivery,
              total,
            ],
          );

          for (const item of orderItems) {
            const [stockResult] = await connection.execute(
              "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
              [item.quantity, item.productId, item.quantity],
            );
            if (stockResult.affectedRows !== 1) {
              throw new ApiError(409, `Sản phẩm ${item.name} vừa hết hàng.`);
            }
            await connection.execute(
              `INSERT INTO order_items
               (order_id, product_id, product_slug, product_name, image_url, unit_price, quantity, variant)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                orderResult.insertId,
                item.productId,
                item.slug,
                item.name,
                item.image,
                item.price,
                item.quantity,
                item.variant,
              ],
            );
            await connection.execute(
              "DELETE FROM cart_items WHERE id = ?",
              [item.cartItemId],
            );
          }

          return {
            id: orderResult.insertId,
            orderNumber,
            status: "pending",
            customer: { name, phone, address },
            note,
            items: orderItems.map((item) => ({
              productId: item.slug,
              name: item.name,
              image: item.image,
              price: item.price,
              quantity: item.quantity,
              variant: item.variant,
              lineTotal: item.price * item.quantity,
            })),
            subtotal,
            discount,
            delivery,
            total,
            paymentMethod,
            paymentStatus: paymentMethod === "momo" ? "pending" : "unpaid",
            createdAt: new Date().toISOString(),
          };
        });
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY" || error.status === 409) {
          const existingOrder = await getOrderByIdempotencyKey(
            db,
            req.user.id,
            idempotencyKey,
          );
          if (existingOrder) {
            if (
              existingOrder.paymentMethod === "momo" &&
              existingOrder.paymentStatus === "pending" &&
              !existingOrder.paymentUrl
            ) {
              existingOrder.paymentUrl = await startMomoPayment(
                db,
                existingOrder,
                getMomoConfig(),
              );
            }
            return res.status(200).json({
              message: "Yêu cầu đặt hàng này đã được xử lý.",
              order: existingOrder,
            });
          }
        }
        throw error;
      }
      if (paymentMethod === "momo") {
        order.paymentUrl = await startMomoPayment(db, order, momoConfig);
      }
      return res.status(201).json({ message: "Đặt hàng thành công.", order });
    }),
  );

  return router;
}

async function startMomoPayment(db, order, config) {
  const [rows] = await db.execute(
    "SELECT momo_request_id AS requestId FROM orders WHERE id = ?",
    [order.id],
  );
  const requestId = rows[0]?.requestId;
  if (!requestId) throw new ApiError(500, "Thiếu mã yêu cầu thanh toán MoMo.");

  const payment = await createMomoPayment(config, {
    id: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
    momoRequestId: requestId,
  });
  if (payment.resultCode !== 0) {
    await applyMomoResult(db, {
      orderId: order.orderNumber,
      requestId,
      amount: Number(order.total),
      resultCode: payment.resultCode,
      transId: payment.response.transId,
    });
    throw new ApiError(502, "MoMo không thể tạo giao dịch thanh toán.");
  }
  await db.execute(
    "UPDATE orders SET momo_pay_url = ? WHERE id = ? AND payment_status = 'pending'",
    [payment.paymentUrl, order.id],
  );
  order.paymentUrl = payment.paymentUrl;
  return payment.paymentUrl;
}

async function getOrderByIdempotencyKey(db, userId, idempotencyKey) {
  const [rows] = await db.execute(
    "SELECT id FROM orders WHERE user_id = ? AND idempotency_key = ? LIMIT 1",
    [userId, idempotencyKey],
  );
  return rows.length === 0
    ? null
    : getOrderDetails(db, rows[0].id, userId);
}

async function getOrderDetails(db, orderId, userId = null) {
  const values = [orderId];
  const ownership = userId === null ? "" : " AND user_id = ?";
  if (userId !== null) values.push(userId);
  const [orders] = await db.execute(
    `SELECT id, order_number AS orderNumber, status,
            recipient_name AS recipientName, order_note AS note,
            phone, address, payment_method AS paymentMethod, discount_code AS couponCode,
            payment_status AS paymentStatus, momo_pay_url AS paymentUrl,
            momo_transaction_id AS momoTransactionId,
            momo_result_code AS momoResultCode,
            subtotal, discount_amount AS discount, shipping_fee AS delivery,
            total_amount AS total, created_at AS createdAt
     FROM orders WHERE id = ?${ownership} LIMIT 1`,
    values,
  );
  if (orders.length === 0) return null;
  const [items] = await db.execute(
    `SELECT product_slug AS productId, product_name AS name, image_url AS image,
            unit_price AS price, quantity, variant
     FROM order_items WHERE order_id = ? ORDER BY id`,
    [orderId],
  );
  const order = orders[0];
  return {
    ...order,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    delivery: Number(order.delivery),
    total: Number(order.total),
    items: items.map((item) => ({
      ...item,
      price: Number(item.price),
      quantity: Number(item.quantity),
      lineTotal: Number(item.price) * Number(item.quantity),
    })),
  };
}

function createAdminOrdersRouter(db) {
  const router = express.Router();
  router.use(requireAuth, requireAdmin);

  router.get(
    "/dashboard",
    asyncRoute(async (req, res) => {
      const [rows] = await db.execute(`
        SELECT
          (SELECT COUNT(*) FROM products) AS totalProducts,
          (SELECT COUNT(*) FROM orders) AS totalOrders,
          (SELECT COALESCE(SUM(total_amount), 0)
           FROM orders WHERE status = 'completed') AS totalRevenue
      `);
      return res.json({
        dashboard: {
          totalProducts: Number(rows[0].totalProducts),
          totalOrders: Number(rows[0].totalOrders),
          totalRevenue: Number(rows[0].totalRevenue),
        },
      });
    }),
  );

  router.get(
    "/customers",
    asyncRoute(async (req, res) => {
      const page = requireInteger(req.query.page || 1, "Trang", 1);
      const limit = requireInteger(req.query.limit || 20, "Số dòng", 1, 100);
      const search =
        typeof req.query.search === "string" ? req.query.search.trim() : "";
      if (search.length > 120) {
        throw new ApiError(400, "Điều kiện tìm kiếm quá dài.");
      }

      const searchSql = search
        ? " AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)"
        : "";
      const searchValues = search
        ? [`%${search}%`, `%${search}%`, `%${search}%`]
        : [];
      const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total FROM users WHERE role = 'user'${searchSql}`,
        searchValues,
      );
      const [customers] = await db.execute(
        `SELECT id, full_name AS name, email, phone, created_at AS createdAt
         FROM users WHERE role = 'user'${searchSql}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...searchValues, limit, (page - 1) * limit],
      );
      const total = Number(countRows[0].total);
      return res.json({
        customers,
        total,
        page,
        limit,
        nextPage: (page - 1) * limit + customers.length < total ? page + 1 : null,
      });
    }),
  );

  router.get(
    "/orders",
    asyncRoute(async (req, res) => {
      const page = requireInteger(req.query.page || 1, "Trang", 1);
      const limit = requireInteger(req.query.limit || 20, "Số dòng", 1, 100);
      const offset = (page - 1) * limit;
      const [countRows] = await db.execute(
        "SELECT COUNT(*) AS total FROM orders",
      );
      const [rows] = await db.execute(
        `SELECT id, order_number AS orderNumber, status, recipient_name AS recipientName,
                phone, address, payment_method AS paymentMethod, subtotal,
                payment_status AS paymentStatus,
                discount_amount AS discount, shipping_fee AS delivery,
                total_amount AS total, created_at AS createdAt
         FROM orders ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
        [limit, offset],
      );
      const orders = [];
      for (const row of rows) {
        orders.push(await getOrderDetails(db, row.id));
      }
      const total = Number(countRows[0].total);
      return res.json({
        orders,
        total,
        page,
        limit,
        nextPage: offset + rows.length < total ? page + 1 : null,
      });
    }),
  );

  router.patch(
    "/orders/:orderId/status",
    asyncRoute(async (req, res) => {
      const orderId = requireInteger(req.params.orderId, "Mã đơn hàng", 1);
      const status =
        typeof req.body?.status === "string" ? req.body.status : "";
      if (!ORDER_STATUSES.has(status)) {
        throw new ApiError(400, "Trạng thái đơn hàng không hợp lệ.");
      }
      const updated = await withTransaction(db, async (connection) => {
        const [orders] = await connection.execute(
          `SELECT id, status, payment_method AS paymentMethod,
                  payment_status AS paymentStatus
           FROM orders WHERE id = ? FOR UPDATE`,
          [orderId],
        );
        if (orders.length === 0) {
          throw new ApiError(404, "Không tìm thấy đơn hàng.");
        }
        const previousStatus = orders[0].status;
        if (
          orders[0].paymentMethod === "momo" &&
          (orders[0].paymentStatus === "pending" ||
            (status === "cancelled" && orders[0].paymentStatus === "paid"))
        ) {
          throw new ApiError(
            409,
            "Không thể cập nhật trạng thái đơn MoMo khi thanh toán đang chờ hoặc đã hoàn tất.",
          );
        }
        if (previousStatus === status) {
          return getOrderDetails(connection, orderId);
        }
        if (!ORDER_TRANSITIONS[previousStatus]?.has(status)) {
          throw new ApiError(
            409,
            "Không thể chuyển đơn hàng sang trạng thái này.",
          );
        }
        if (status === "cancelled") {
          const [items] = await connection.execute(
            "SELECT product_id AS productId, quantity FROM order_items WHERE order_id = ? AND product_id IS NOT NULL",
            [orderId],
          );
          for (const item of items) {
            await connection.execute(
              "UPDATE products SET stock = stock + ? WHERE id = ?",
              [item.quantity, item.productId],
            );
          }
        }
        await connection.execute(
          "UPDATE orders SET status = ? WHERE id = ?",
          [status, orderId],
        );
        return getOrderDetails(connection, orderId);
      });
      return res.json({
        message: "Đã cập nhật trạng thái đơn hàng.",
        order: updated,
      });
    }),
  );

  router.get(
    "/orders/:orderId",
    asyncRoute(async (req, res) => {
      const orderId = requireInteger(req.params.orderId, "Mã đơn hàng", 1);
      const order = await getOrderDetails(db, orderId);
      if (!order) throw new ApiError(404, "Không tìm thấy đơn hàng.");
      return res.json({ order });
    }),
  );

  return router;
}

module.exports = {
  createAdminOrdersRouter,
  createCustomerRouter,
};

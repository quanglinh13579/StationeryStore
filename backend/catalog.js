const express = require("express");
const { requireAdmin, requireAuth } = require("./auth");
const { ApiError, asyncRoute, requireInteger } = require("./errors");

const PRODUCT_SELECT = `
  SELECT
    p.id,
    p.slug,
    p.name,
    p.description,
    p.image_url,
    p.price,
    p.original_price,
    p.stock,
    p.rating,
    p.review_count,
    p.is_popular,
    p.is_latest,
    GROUP_CONCAT(DISTINCT c.slug ORDER BY c.slug SEPARATOR ',') AS category_slugs
  FROM products p
  LEFT JOIN product_categories pc ON pc.product_id = p.id
  LEFT JOIN categories c ON c.id = pc.category_id AND c.is_active = 1
`;

function mapProduct(row) {
  return {
    id: row.slug,
    name: row.name,
    description: row.description,
    category: row.category_slugs ? row.category_slugs.split(",") : [],
    image: row.image_url,
    price: Number(row.price),
    originalPrice:
      row.original_price === null ? null : Number(row.original_price),
    stock: Number(row.stock),
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    popular: Boolean(row.is_popular),
    sale:
      row.original_price !== null &&
      Number(row.original_price) > Number(row.price),
    latest: Boolean(row.is_latest),
  };
}

function addProductFilters(filters) {
  const conditions = ["p.is_active = 1"];
  const values = [];

  if (filters.search) {
    conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
    values.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.category) {
    conditions.push(
      "EXISTS (SELECT 1 FROM product_categories pf JOIN categories cf ON cf.id = pf.category_id WHERE pf.product_id = p.id AND cf.slug = ? AND cf.is_active = 1)",
    );
    values.push(filters.category);
  }
  if (filters.minPrice !== undefined) {
    conditions.push("p.price >= ?");
    values.push(filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    conditions.push("p.price <= ?");
    values.push(filters.maxPrice);
  }
  if (filters.popular) conditions.push("p.is_popular = 1");
  if (filters.latest) conditions.push("p.is_latest = 1");
  if (filters.onSale) {
    conditions.push(
      "p.original_price IS NOT NULL AND p.original_price > p.price",
    );
  }

  return { sql: conditions.join(" AND "), values };
}

function parseBoolean(value, name) {
  if (value === undefined) return false;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new ApiError(400, `Bộ lọc ${name} không hợp lệ.`);
}

function readProductFilters(query) {
  const filters = {
    search: typeof query.search === "string" ? query.search.trim() : "",
    category: typeof query.category === "string" ? query.category.trim() : "",
    popular: parseBoolean(query.popular, "popular"),
    latest: parseBoolean(query.latest, "latest"),
    onSale: parseBoolean(query.onSale, "onSale"),
  };

  if (filters.search.length > 120 || filters.category.length > 80) {
    throw new ApiError(400, "Điều kiện tìm kiếm quá dài.");
  }
  if (query.minPrice !== undefined) {
    filters.minPrice = requireInteger(query.minPrice, "Giá tối thiểu", 0);
  }
  if (query.maxPrice !== undefined) {
    filters.maxPrice = requireInteger(query.maxPrice, "Giá tối đa", 0);
  }
  if (
    filters.minPrice !== undefined &&
    filters.maxPrice !== undefined &&
    filters.minPrice > filters.maxPrice
  ) {
    throw new ApiError(400, "Khoảng giá không hợp lệ.");
  }
  return filters;
}

async function getProducts(db, filters, page, limit) {
  const { sql, values } = addProductFilters(filters);
  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total FROM products p WHERE ${sql}`,
    values,
  );
  const offset = (page - 1) * limit;
  const [rows] = await db.execute(
    `${PRODUCT_SELECT}
     WHERE ${sql}
     GROUP BY p.id
     ORDER BY p.is_latest DESC, p.created_at DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset],
  );
  const total = Number(countRows[0].total);
  return {
    products: rows.map(mapProduct),
    total,
    page,
    limit,
    nextPage: offset + rows.length < total ? page + 1 : null,
  };
}

async function getProductBySlug(db, slug) {
  const [rows] = await db.execute(
    `${PRODUCT_SELECT}
     WHERE p.slug = ? AND p.is_active = 1
     GROUP BY p.id
     LIMIT 1`,
    [slug],
  );
  return rows[0] ? mapProduct(rows[0]) : null;
}

function createCatalogRouter(db) {
  const router = express.Router();

  router.get(
    "/products",
    asyncRoute(async (req, res) => {
      const filters = readProductFilters(req.query);
      const page = requireInteger(req.query.page || 1, "Trang", 1);
      const limit = requireInteger(req.query.limit || 12, "Số dòng", 1, 100);
      if (filters.category) {
        const [categories] = await db.execute(
          "SELECT id FROM categories WHERE slug = ? AND is_active = 1 LIMIT 1",
          [filters.category],
        );
        if (categories.length === 0) {
          throw new ApiError(404, "Không tìm thấy danh mục.");
        }
      }
      return res.json(await getProducts(db, filters, page, limit));
    }),
  );

  router.get(
    "/products/:slug",
    asyncRoute(async (req, res) => {
      const product = await getProductBySlug(db, req.params.slug);
      if (!product) throw new ApiError(404, "Không tìm thấy sản phẩm.");
      return res.json({ product });
    }),
  );

  router.get(
    "/categories",
    asyncRoute(async (req, res) => {
      const [categories] = await db.execute(`
        SELECT c.slug, c.name, c.description, COUNT(DISTINCT p.id) AS productsCount
        FROM categories c
        LEFT JOIN product_categories pc ON pc.category_id = c.id
        LEFT JOIN products p ON p.id = pc.product_id AND p.is_active = 1
        WHERE c.is_active = 1
        GROUP BY c.id
        ORDER BY c.name
      `);
      return res.json({
        categories: categories.map((category) => ({
          ...category,
          productsCount: Number(category.productsCount),
        })),
      });
    }),
  );

  router.get(
    "/categories/:slug/products",
    asyncRoute(async (req, res) => {
      const [categories] = await db.execute(
        "SELECT id FROM categories WHERE slug = ? AND is_active = 1 LIMIT 1",
        [req.params.slug],
      );
      if (categories.length === 0) {
        throw new ApiError(404, "Không tìm thấy danh mục.");
      }
      const filters = readProductFilters({
        ...req.query,
        category: req.params.slug,
      });
      const page = requireInteger(req.query.page || 1, "Trang", 1);
      const limit = requireInteger(req.query.limit || 12, "Số dòng", 1, 100);
      return res.json(await getProducts(db, filters, page, limit));
    }),
  );

  router.get(
    "/categories/:slug",
    asyncRoute(async (req, res) => {
      const [rows] = await db.execute(
        `SELECT c.slug, c.name, c.description, COUNT(DISTINCT p.id) AS productsCount
         FROM categories c
         LEFT JOIN product_categories pc ON pc.category_id = c.id
         LEFT JOIN products p ON p.id = pc.product_id AND p.is_active = 1
         WHERE c.slug = ? AND c.is_active = 1
         GROUP BY c.id
         LIMIT 1`,
        [req.params.slug],
      );
      if (rows.length === 0)
        throw new ApiError(404, "Không tìm thấy danh mục.");
      return res.json({
        category: {
          ...rows[0],
          productsCount: Number(rows[0].productsCount),
        },
      });
    }),
  );

  router.get(
    "/reviews",
    asyncRoute(async (req, res) => {
      const page = requireInteger(req.query.page || 1, "Trang", 1);
      const limit = requireInteger(req.query.limit || 3, "Số dòng", 1, 100);
      const values = [];
      let where = "p.is_active = 1";
      if (req.query.productId) {
        where += " AND p.slug = ?";
        values.push(String(req.query.productId));
      }
      const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total
         FROM reviews r JOIN products p ON p.id = r.product_id
         WHERE ${where}`,
        values,
      );
      const offset = (page - 1) * limit;
      const [rows] = await db.execute(
        `SELECT r.reviewer_name AS name, p.slug AS productId, p.name AS product,
                r.rating, r.comment, r.created_at AS createdAt
         FROM reviews r JOIN products p ON p.id = r.product_id
         WHERE ${where}
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT ? OFFSET ?`,
        [...values, limit, offset],
      );
      const total = Number(countRows[0].total);
      return res.json({
        reviews: rows.map((row) => ({
          ...row,
          rating: Number(row.rating),
        })),
        total,
        page,
        limit,
        nextPage: offset + rows.length < total ? page + 1 : null,
      });
    }),
  );

  router.post(
    "/reviews",
    requireAuth,
    asyncRoute(async (req, res) => {
      const body = req.body || {};
      const productId =
        typeof body.productId === "string" ? body.productId.trim() : "";
      const rating = requireInteger(body.rating, "Số sao", 1, 5);
      const comment =
        typeof body.comment === "string" ? body.comment.trim() : "";
      if (!productId || productId.length > 80) {
        throw new ApiError(400, "Sản phẩm không hợp lệ.");
      }
      if (comment.length < 5 || comment.length > 1000) {
        throw new ApiError(400, "Nhận xét phải có từ 5 đến 1000 ký tự.");
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [products] = await connection.execute(
          "SELECT id, slug, name FROM products WHERE slug = ? AND is_active = 1 LIMIT 1 FOR UPDATE",
          [productId],
        );
        if (products.length === 0) {
          throw new ApiError(404, "Không tìm thấy sản phẩm.");
        }

        const product = products[0];
        const [insertResult] = await connection.execute(
          "INSERT INTO reviews (product_id, reviewer_name, rating, comment) VALUES (?, ?, ?, ?)",
          [product.id, req.user.name, rating, comment],
        );
        await connection.execute(
          `UPDATE products
           SET rating = ROUND(((rating * review_count) + ?) / (review_count + 1), 1),
               review_count = review_count + 1
           WHERE id = ?`,
          [rating, product.id],
        );
        const [reviewRows] = await connection.execute(
          `SELECT reviewer_name AS name, p.slug AS productId, p.name AS product,
                  r.rating, r.comment, r.created_at AS createdAt
           FROM reviews r JOIN products p ON p.id = r.product_id
           WHERE r.id = ?`,
          [insertResult.insertId],
        );
        const [updatedProducts] = await connection.execute(
          "SELECT rating, review_count AS reviewCount FROM products WHERE id = ?",
          [product.id],
        );
        await connection.commit();
        return res.status(201).json({
          message: "Đã gửi nhận xét.",
          review: {
            ...reviewRows[0],
            rating: Number(reviewRows[0].rating),
          },
          product: {
            id: product.slug,
            rating: Number(updatedProducts[0].rating),
            reviewCount: Number(updatedProducts[0].reviewCount),
          },
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),
  );

  return router;
}

function readCategoryInput(body) {
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new ApiError(400, "Mã danh mục không hợp lệ.");
  }
  if (name.length < 2 || name.length > 100) {
    throw new ApiError(400, "Tên danh mục phải có từ 2 đến 100 ký tự.");
  }
  if (description.length > 1000) {
    throw new ApiError(400, "Mô tả danh mục quá dài.");
  }
  return { slug, name, description };
}

function readProductInput(body) {
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const image = typeof body.image === "string" ? body.image.trim() : "";
  const price = Number(body.price);
  const originalPrice =
    body.originalPrice === null || body.originalPrice === undefined
      ? null
      : Number(body.originalPrice);
  const stock = Number(body.stock);
  const categories = Array.isArray(body.categories)
    ? [...new Set(body.categories)]
    : [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new ApiError(400, "Mã sản phẩm không hợp lệ.");
  }
  if (name.length < 2 || name.length > 160) {
    throw new ApiError(400, "Tên sản phẩm phải có từ 2 đến 160 ký tự.");
  }
  if (description.length > 5000 || image.length < 5 || image.length > 2048) {
    throw new ApiError(400, "Mô tả hoặc đường dẫn ảnh không hợp lệ.");
  }
  if (!Number.isSafeInteger(price) || price < 1) {
    throw new ApiError(400, "Giá sản phẩm không hợp lệ.");
  }
  if (
    originalPrice !== null &&
    (!Number.isSafeInteger(originalPrice) || originalPrice < price)
  ) {
    throw new ApiError(400, "Giá gốc phải lớn hơn hoặc bằng giá bán.");
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
    throw new ApiError(400, "Số lượng tồn kho không hợp lệ.");
  }
  if (
    categories.length === 0 ||
    categories.length > 10 ||
    categories.some(
      (category) =>
        typeof category !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category),
    )
  ) {
    throw new ApiError(400, "Danh mục sản phẩm không hợp lệ.");
  }
  return {
    slug,
    name,
    description,
    image,
    price,
    originalPrice,
    stock,
    categories,
    popular: body.popular === true,
    latest: body.latest === true,
  };
}

async function saveProductCategories(connection, productId, categorySlugs) {
  const placeholders = categorySlugs.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `SELECT id, slug FROM categories WHERE is_active = 1 AND slug IN (${placeholders})`,
    categorySlugs,
  );
  if (rows.length !== categorySlugs.length) {
    throw new ApiError(400, "Một hoặc nhiều danh mục không tồn tại.");
  }
  await connection.execute(
    "DELETE FROM product_categories WHERE product_id = ?",
    [productId],
  );
  for (const category of rows) {
    await connection.execute(
      "INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)",
      [productId, category.id],
    );
  }
}

function createAdminCatalogRouter(db) {
  const router = express.Router();
  router.use(requireAuth, requireAdmin);

  router.post(
    "/products",
    asyncRoute(async (req, res) => {
      const product = readProductInput(req.body || {});
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.execute(
          `INSERT INTO products
           (slug, name, description, image_url, price, original_price, stock, is_popular, is_latest)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product.slug,
            product.name,
            product.description,
            product.image,
            product.price,
            product.originalPrice,
            product.stock,
            product.popular,
            product.latest,
          ],
        );
        await saveProductCategories(
          connection,
          result.insertId,
          product.categories,
        );
        await connection.commit();
        return res.status(201).json({
          message: "Đã tạo sản phẩm.",
          product: await getProductBySlug(db, product.slug),
        });
      } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") {
          throw new ApiError(409, "Mã sản phẩm đã tồn tại.");
        }
        throw error;
      } finally {
        connection.release();
      }
    }),
  );

  router.put(
    "/products/:slug",
    asyncRoute(async (req, res) => {
      const product = readProductInput({
        ...req.body,
        slug: req.params.slug,
      });
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [existingProducts] = await connection.execute(
          "SELECT id FROM products WHERE slug = ? LIMIT 1 FOR UPDATE",
          [req.params.slug],
        );
        if (existingProducts.length === 0) {
          throw new ApiError(404, "Không tìm thấy sản phẩm.");
        }
        await connection.execute(
          `UPDATE products
           SET name = ?, description = ?, image_url = ?, price = ?,
               original_price = ?, stock = ?, is_popular = ?, is_latest = ?,
               is_active = 1
           WHERE slug = ?`,
          [
            product.name,
            product.description,
            product.image,
            product.price,
            product.originalPrice,
            product.stock,
            product.popular,
            product.latest,
            req.params.slug,
          ],
        );
        await saveProductCategories(
          connection,
          existingProducts[0].id,
          product.categories,
        );
        await connection.commit();
        return res.json({
          message: "Đã cập nhật sản phẩm.",
          product: await getProductBySlug(db, req.params.slug),
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),
  );

  router.delete(
    "/products/:slug",
    asyncRoute(async (req, res) => {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [products] = await connection.execute(
          "SELECT id FROM products WHERE slug = ? AND is_active = 1 LIMIT 1 FOR UPDATE",
          [req.params.slug],
        );
        if (products.length === 0) {
          throw new ApiError(404, "Không tìm thấy sản phẩm.");
        }
        await connection.execute(
          "DELETE FROM cart_items WHERE product_id = ?",
          [products[0].id],
        );
        await connection.execute("DELETE FROM favorites WHERE product_id = ?", [
          products[0].id,
        ]);
        await connection.execute(
          "UPDATE products SET is_active = 0 WHERE id = ?",
          [products[0].id],
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return res.json({ message: "Đã ẩn sản phẩm khỏi cửa hàng." });
    }),
  );

  router.post(
    "/categories",
    asyncRoute(async (req, res) => {
      const category = readCategoryInput(req.body || {});
      try {
        const [result] = await db.execute(
          "INSERT INTO categories (slug, name, description) VALUES (?, ?, ?)",
          [category.slug, category.name, category.description],
        );
        return res.status(201).json({
          message: "Đã tạo danh mục.",
          category: { ...category, productsCount: 0, id: result.insertId },
        });
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new ApiError(409, "Mã danh mục đã tồn tại.");
        }
        throw error;
      }
    }),
  );

  router.put(
    "/categories/:slug",
    asyncRoute(async (req, res) => {
      const category = readCategoryInput({
        ...req.body,
        slug: req.params.slug,
      });
      const [existingCategories] = await db.execute(
        "SELECT id FROM categories WHERE slug = ? LIMIT 1",
        [category.slug],
      );
      if (existingCategories.length === 0) {
        throw new ApiError(404, "Không tìm thấy danh mục.");
      }
      await db.execute(
        "UPDATE categories SET name = ?, description = ?, is_active = 1 WHERE slug = ?",
        [category.name, category.description, category.slug],
      );
      return res.json({ message: "Đã cập nhật danh mục.", category });
    }),
  );

  router.delete(
    "/categories/:slug",
    asyncRoute(async (req, res) => {
      const [result] = await db.execute(
        "UPDATE categories SET is_active = 0 WHERE slug = ? AND is_active = 1",
        [req.params.slug],
      );
      if (result.affectedRows === 0) {
        throw new ApiError(404, "Không tìm thấy danh mục.");
      }
      return res.json({ message: "Đã ẩn danh mục khỏi cửa hàng." });
    }),
  );

  return router;
}

module.exports = {
  createAdminCatalogRouter,
  createCatalogRouter,
  getProductBySlug,
  mapProduct,
  PRODUCT_SELECT,
};

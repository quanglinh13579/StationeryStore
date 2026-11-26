USE stationery_store;

INSERT INTO categories (slug, name, description) VALUES
  ('notebook', 'Sổ & vở', 'Sổ tay, vở ghi và giấy vẽ.'),
  ('pen', 'Bút & viết', 'Các loại bút viết và bút đánh dấu.'),
  ('color', 'Màu & vẽ', 'Màu vẽ và dụng cụ sáng tạo.'),
  ('accessory', 'Túi & phụ kiện', 'Túi bút và phụ kiện học tập.'),
  ('stationery', 'Văn phòng phẩm', 'Đồ dùng cần thiết cho học tập.'),
  ('desk', 'Đồ dùng bàn học', 'Vật dụng sắp xếp góc học tập.'),
  ('gift', 'Bộ quà tặng', 'Quà tặng học tập và sáng tạo.')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  is_active = 1;

INSERT INTO products
  (slug, name, description, image_url, price, original_price, stock, rating,
   review_count, is_popular, is_latest)
VALUES
  ('notebook-hardcover', 'Sổ tay bìa cứng sáng tạo',
   'Sổ tay nhỏ gọn, phù hợp ghi chú và lên kế hoạch mỗi ngày.',
   'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=600&q=85',
   69000, 98000, 50, 4.9, 86, 1, 1),
  ('pastel-pens', 'Bộ bút màu pastel 4 chiếc',
   'Bộ bút màu pastel phục vụ ghi chú và trang trí.',
   'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=85',
   45000, 59000, 50, 4.8, 65, 1, 1),
  ('canvas-pencil-case', 'Túi bút canvas tiện dụng',
   'Túi bút canvas gọn nhẹ, thuận tiện mang theo.',
   'https://images.unsplash.com/photo-1586074299757-dc655f18518c?auto=format&fit=crop&w=600&q=85',
   85000, 112000, 50, 4.9, 112, 1, 0),
  ('color-notes', 'Giấy ghi chú nhiều màu',
   'Giấy ghi chú nhiều màu cho việc đánh dấu và sắp xếp công việc.',
   'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=85',
   29000, 39000, 50, 4.7, 48, 0, 0),
  ('spiral-notebook', 'Sổ lò xo kẻ ngang 120 trang',
   'Sổ lò xo kẻ ngang tiện dụng cho ghi chép hàng ngày.',
   'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=85',
   52000, 65000, 50, 4.8, 37, 1, 0),
  ('highlighter-set', 'Bộ bút đánh dấu Highlight 6 màu',
   'Bộ bút đánh dấu nhiều màu giúp ghi chú rõ ràng.',
   'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=600&q=85',
   79000, 95000, 50, 4.9, 53, 1, 1),
  ('watercolor-kit', 'Hộp màu nước kèm cọ vẽ',
   'Bộ màu nước kèm cọ dành cho hoạt động vẽ và sáng tạo.',
   'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=600&q=85',
   125000, 149000, 50, 4.8, 29, 0, 1),
  ('desk-organizer', 'Kệ để bút mini để bàn',
   'Kệ mini giúp sắp xếp bút và vật dụng trên bàn học.',
   'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=85',
   99000, NULL, 50, 4.6, 21, 1, 0),
  ('study-stickers', 'Bộ sticker trang trí sổ tay',
   'Sticker trang trí để làm mới sổ tay và đồ dùng học tập.',
   'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=600&q=85',
   35000, NULL, 50, 4.7, 18, 0, 1),
  ('pencil-case-zip', 'Hộp bút khóa kéo màu kem',
   'Hộp bút khóa kéo nhỏ gọn để bảo quản bút viết.',
   'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=600&q=85',
   75000, 89000, 50, 4.8, 42, 1, 1),
  ('sketchbook', 'Sổ vẽ mỹ thuật giấy dày',
   'Sổ vẽ giấy dày phù hợp cho phác thảo và mỹ thuật.',
   'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=600&q=85',
   68000, NULL, 50, 4.9, 31, 0, 1),
  ('geometry-set', 'Bộ thước học sinh 4 món',
   'Bộ thước học sinh gồm các dụng cụ cơ bản cho giờ học.',
   'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=600&q=85',
   25000, NULL, 50, 4.6, 16, 0, 0),
  ('study-gift-set', 'Bộ quà tặng học tập',
   'Bộ quà tặng gồm những món đồ nhỏ cho góc học tập.',
   'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=600&q=85',
   189000, 219000, 50, 4.9, 14, 0, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  image_url = VALUES(image_url),
  price = VALUES(price),
  original_price = VALUES(original_price),
  rating = VALUES(rating),
  review_count = VALUES(review_count),
  is_popular = VALUES(is_popular),
  is_latest = VALUES(is_latest),
  is_active = 1;

INSERT IGNORE INTO product_categories (product_id, category_id)
SELECT p.id, c.id
FROM (
  SELECT 'notebook-hardcover' AS product_slug, 'notebook' AS category_slug
  UNION ALL SELECT 'pastel-pens', 'pen'
  UNION ALL SELECT 'pastel-pens', 'color'
  UNION ALL SELECT 'canvas-pencil-case', 'accessory'
  UNION ALL SELECT 'color-notes', 'stationery'
  UNION ALL SELECT 'color-notes', 'desk'
  UNION ALL SELECT 'spiral-notebook', 'notebook'
  UNION ALL SELECT 'highlighter-set', 'pen'
  UNION ALL SELECT 'highlighter-set', 'color'
  UNION ALL SELECT 'watercolor-kit', 'color'
  UNION ALL SELECT 'watercolor-kit', 'desk'
  UNION ALL SELECT 'desk-organizer', 'stationery'
  UNION ALL SELECT 'desk-organizer', 'desk'
  UNION ALL SELECT 'study-stickers', 'stationery'
  UNION ALL SELECT 'study-stickers', 'desk'
  UNION ALL SELECT 'pencil-case-zip', 'accessory'
  UNION ALL SELECT 'sketchbook', 'notebook'
  UNION ALL SELECT 'sketchbook', 'color'
  UNION ALL SELECT 'geometry-set', 'stationery'
  UNION ALL SELECT 'geometry-set', 'desk'
  UNION ALL SELECT 'study-gift-set', 'gift'
) mapping
JOIN products p ON p.slug = mapping.product_slug
JOIN categories c ON c.slug = mapping.category_slug;

INSERT IGNORE INTO reviews
  (source_key, product_id, reviewer_name, rating, comment)
SELECT 'review-lan-anh', p.id, 'Lan Anh', 5,
       'Sổ có chất giấy đẹp, viết êm và thiết kế nhỏ gọn. Mình rất thích!'
FROM products p WHERE p.slug = 'notebook-hardcover';

INSERT IGNORE INTO reviews
  (source_key, product_id, reviewer_name, rating, comment)
SELECT 'review-hoai-thuong', p.id, 'Hoài Thương', 5,
       'Bút màu lên màu đẹp, giao hàng nhanh và đóng gói cẩn thận.'
FROM products p WHERE p.slug = 'pastel-pens';

INSERT IGNORE INTO reviews
  (source_key, product_id, reviewer_name, rating, comment)
SELECT 'review-chau-nguyen', p.id, 'Châu Nguyễn', 5,
       'Túi bút xinh, chất vải chắc chắn, vừa đủ dùng mỗi ngày.'
FROM products p WHERE p.slug = 'canvas-pencil-case';

INSERT IGNORE INTO reviews
  (source_key, product_id, reviewer_name, rating, comment)
SELECT 'review-minh-khue', p.id, 'Minh Khuê', 5,
       'Màu bìa ngoài đời rất đẹp, giấy dày và không bị lem mực.'
FROM products p WHERE p.slug = 'notebook-hardcover';

INSERT IGNORE INTO reviews
  (source_key, product_id, reviewer_name, rating, comment)
SELECT 'review-quoc-bao', p.id, 'Quốc Bảo', 4,
       'Màu sắc đa dạng, cầm chắc tay. Bé nhà mình rất thích.'
FROM products p WHERE p.slug = 'pastel-pens';

INSERT IGNORE INTO reviews
  (source_key, product_id, reviewer_name, rating, comment)
SELECT 'review-thao-vy', p.id, 'Thảo Vy', 5,
       'Giấy bám tốt, màu pastel dịu mắt, dùng để ghi chú rất tiện.'
FROM products p WHERE p.slug = 'color-notes';

INSERT IGNORE INTO reviews
  (source_key, product_id, reviewer_name, rating, comment)
SELECT 'review-ngoc-ha', p.id, 'Ngọc Hà', 5,
       'Đường may chắc chắn, có nhiều ngăn và giao hàng nhanh.'
FROM products p WHERE p.slug = 'pencil-case-zip';

INSERT IGNORE INTO reviews
  (source_key, product_id, reviewer_name, rating, comment)
SELECT 'review-duc-anh', p.id, 'Đức Anh', 4,
       'Sổ gọn nhẹ, mang đi học tiện. Đóng gói cẩn thận.'
FROM products p WHERE p.slug = 'spiral-notebook';

INSERT IGNORE INTO reviews
  (source_key, product_id, reviewer_name, rating, comment)
SELECT 'review-mai-phuong', p.id, 'Mai Phương', 5,
       'Màu đẹp, giấy dễ viết. Mình sẽ mua thêm cho cả văn phòng.'
FROM products p WHERE p.slug = 'color-notes';

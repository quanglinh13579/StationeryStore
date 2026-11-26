USE stationery_store;

ALTER TABLE orders
  MODIFY COLUMN status
    ENUM('pending', 'confirmed', 'preparing', 'shipping', 'completed', 'cancelled')
    NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS order_status_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  status ENUM('pending', 'confirmed', 'preparing', 'shipping', 'completed', 'cancelled')
    NOT NULL,
  changed_by INT UNSIGNED NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_status_history_order_time (order_id, changed_at, id),
  CONSTRAINT fk_order_status_history_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_status_history_user
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

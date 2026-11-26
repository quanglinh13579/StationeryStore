USE stationery_store;

ALTER TABLE orders
  ADD COLUMN idempotency_key VARCHAR(100) NULL AFTER user_id,
  ADD COLUMN order_note VARCHAR(1000) NOT NULL DEFAULT '' AFTER address,
  ADD UNIQUE KEY uq_orders_user_idempotency (user_id, idempotency_key);

UPDATE orders SET status = 'completed' WHERE status = 'delivered';

ALTER TABLE orders
  MODIFY COLUMN status
    ENUM('pending', 'confirmed', 'shipping', 'completed', 'cancelled')
    NOT NULL DEFAULT 'pending',
  MODIFY COLUMN payment_method
    ENUM('cod', 'bank_transfer', 'e_wallet') NOT NULL;

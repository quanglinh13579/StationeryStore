USE stationery_store;

ALTER TABLE orders
  MODIFY COLUMN payment_method
    ENUM('cod', 'bank_transfer', 'e_wallet', 'momo') NOT NULL,
  ADD COLUMN payment_status
    ENUM('unpaid', 'pending', 'paid', 'failed', 'cancelled')
    NOT NULL DEFAULT 'unpaid' AFTER payment_method,
  ADD COLUMN momo_request_id VARCHAR(100) NULL AFTER payment_status,
  ADD COLUMN momo_transaction_id VARCHAR(100) NULL AFTER momo_request_id,
  ADD COLUMN momo_pay_url VARCHAR(2048) NULL AFTER momo_transaction_id,
  ADD COLUMN momo_result_code INT NULL AFTER momo_pay_url,
  ADD UNIQUE KEY uq_orders_momo_request (momo_request_id),
  ADD UNIQUE KEY uq_orders_momo_transaction (momo_transaction_id);

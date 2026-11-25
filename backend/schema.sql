CREATE DATABASE IF NOT EXISTS verifood CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE verifood;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  brand VARCHAR(120) NOT NULL DEFAULT '',
  category VARCHAR(100) NOT NULL DEFAULT '',
  image VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  question VARCHAR(500) NOT NULL,
  guidance TEXT NULL,
  source_url VARCHAR(2048) NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_checks_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_checks_product_order (product_id, sort_order)
);

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  market_area VARCHAR(120) NOT NULL,
  red_flags JSON NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'unverified',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  device_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reports_product FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_reports_map (created_at),
  INDEX idx_reports_device_created (device_id, created_at)
);

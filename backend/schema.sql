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

CREATE TABLE IF NOT EXISTS batch_verifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  batch_code VARCHAR(100) NOT NULL,
  expiry_date DATE NULL,
  verification_status ENUM('unverified', 'under_review', 'no_alert_recorded', 'alert_recorded') NOT NULL DEFAULT 'unverified',
  nafdac_registration VARCHAR(100) NULL,
  guidance TEXT NOT NULL,
  source_url VARCHAR(2048) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_batch_product FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE KEY uq_batch_product_code (product_id, batch_code),
  INDEX idx_batch_status (verification_status)
);

CREATE TABLE IF NOT EXISTS producer_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(160) NOT NULL,
  producer_name VARCHAR(160) NOT NULL,
  nafdac_registration VARCHAR(100) NULL,
  batch_code VARCHAR(100) NULL,
  contact_email VARCHAR(254) NULL,
  submission_status ENUM('received', 'under_review', 'review_complete') NOT NULL DEFAULT 'received',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_submission_status (submission_status)
);

CREATE TABLE IF NOT EXISTS recall_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  batch_code VARCHAR(100) NULL,
  event_type ENUM('contamination_notice', 'recall_notice', 'safety_advisory') NOT NULL,
  audit_status ENUM('reported', 'under_review', 'notice_recorded', 'closed') NOT NULL DEFAULT 'reported',
  summary VARCHAR(500) NOT NULL,
  source_url VARCHAR(2048) NULL,
  nafdac_hotline VARCHAR(32) NOT NULL DEFAULT '0800-162-3322',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recall_product FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_recall_created (created_at),
  INDEX idx_recall_audit_status (audit_status)
);

INSERT IGNORE INTO products (id, name, brand, category, image) VALUES
  (1, 'Fortified maize cereal, 500 g', 'Green Basket Foods', 'Cereal', NULL),
  (2, 'Tomato paste sachet, 70 g', 'Market Harvest', 'Canned food', NULL);

INSERT IGNORE INTO checks (id, product_id, question, guidance, source_url, sort_order) VALUES
  (1, 1, 'Is a NAFDAC registration number printed clearly?', 'Compare the printed number with official product information.', 'https://nafdac.gov.ng/', 1),
  (2, 1, 'Can you read the batch code and expiry date?', 'Do not use a pack with an unreadable or altered date.', 'https://nafdac.gov.ng/', 2),
  (3, 1, 'Is the package seal intact?', 'Check for tears, leaks, or signs the pack was opened.', 'https://nafdac.gov.ng/', 3),
  (4, 1, 'Does the print look consistent across the pack?', 'Unusual print differences are a reason to seek more information.', 'https://nafdac.gov.ng/', 4),
  (5, 2, 'Is a NAFDAC registration number printed clearly?', 'Compare the printed number with official product information.', 'https://nafdac.gov.ng/', 1),
  (6, 2, 'Can you read the batch code and expiry date?', 'Do not use a pack with an unreadable or altered date.', 'https://nafdac.gov.ng/', 2),
  (7, 2, 'Is the package seal intact?', 'Check for tears, leaks, or signs the pack was opened.', 'https://nafdac.gov.ng/', 3),
  (8, 2, 'Does the print look consistent across the pack?', 'Unusual print differences are a reason to seek more information.', 'https://nafdac.gov.ng/', 4);

INSERT IGNORE INTO reports (id, product_id, market_area, red_flags, status, is_demo, device_id) VALUES
  (1, 1, 'Abeokuta Central', JSON_ARRAY('Expiry date is difficult to read'), 'unverified', TRUE, 'demo-seed');

INSERT IGNORE INTO batch_verifications
  (id, product_id, batch_code, expiry_date, verification_status, nafdac_registration, guidance, source_url)
VALUES
  (1, 1, 'GBF-2608-A', '2027-08-31', 'unverified', NULL, 'No official batch result is available in this sample record. Contact NAFDAC to verify.', 'https://nafdac.gov.ng/');

INSERT IGNORE INTO producer_submissions
  (id, product_name, producer_name, nafdac_registration, batch_code, submission_status)
VALUES
  (1, 'Fortified maize cereal, 500 g', 'Green Basket Foods', NULL, 'GBF-2608-A', 'received');

INSERT IGNORE INTO recall_audit_logs
  (id, product_id, batch_code, event_type, audit_status, summary, source_url, nafdac_hotline, is_demo)
VALUES
  (1, 2, 'MH-2605-B', 'safety_advisory', 'reported', 'Sample advisory record for demonstrating the audit log; confirm current information with NAFDAC.', 'https://nafdac.gov.ng/', '0800-162-3322', TRUE);

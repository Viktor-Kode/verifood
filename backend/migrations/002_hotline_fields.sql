ALTER TABLE reports
  ADD COLUMN nafdac_hotline VARCHAR(32) NOT NULL DEFAULT '0800-162-3322';
ALTER TABLE batch_verifications
  ADD COLUMN nafdac_hotline VARCHAR(32) NOT NULL DEFAULT '0800-162-3322';
ALTER TABLE producer_submissions
  ADD COLUMN nafdac_hotline VARCHAR(32) NOT NULL DEFAULT '0800-162-3322';

UPDATE batch_verifications
SET guidance = CONCAT(guidance, ' Contact NAFDAC at 0800-162-3322.')
WHERE id = 1 AND guidance NOT LIKE '%0800-162-3322%';

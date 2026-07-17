-- MySQL 8.x schema draft for aicc-console.
-- The setup script creates and selects the database from DB_NAME before
-- applying this schema.

CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  status ENUM('DRAFT', 'RUNNING', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  start_at DATETIME(3) NULL,
  end_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_campaigns_status_created_at (status, created_at),
  INDEX idx_campaigns_updated_at (updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
  name VARCHAR(100) NOT NULL,
  role ENUM('HEAD', 'ADMIN', 'OPERATOR', 'VIEWER') NOT NULL DEFAULT 'VIEWER',
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  approved_by CHAR(36) NULL,
  approved_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  INDEX idx_users_status_created_at (status, created_at),
  INDEX idx_users_role_status (role, status)
) ENGINE=InnoDB;

SET @users_force_password_change_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE users ADD COLUMN force_password_change BOOLEAN NOT NULL DEFAULT FALSE AFTER password_hash',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'force_password_change'
);
PREPARE users_force_password_change_stmt FROM @users_force_password_change_sql;
EXECUTE users_force_password_change_stmt;
DEALLOCATE PREPARE users_force_password_change_stmt;

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id CHAR(36) NOT NULL,
  actor_id CHAR(36) NULL,
  target_user_id CHAR(36) NULL,
  action VARCHAR(80) NOT NULL,
  details JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_security_audit_logs_actor_created (actor_id, created_at),
  INDEX idx_security_audit_logs_target_created (target_user_id, created_at),
  INDEX idx_security_audit_logs_action_created (action, created_at),
  CONSTRAINT fk_security_audit_logs_actor_id
    FOREIGN KEY (actor_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_security_audit_logs_target_user_id
    FOREIGN KEY (target_user_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT chk_security_audit_logs_details_json CHECK (details IS NULL OR JSON_VALID(details))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notices (
  id CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('PUBLISHED', 'DRAFT') NOT NULL DEFAULT 'DRAFT',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_notices_status_pinned_updated_at (status, pinned, updated_at),
  INDEX idx_notices_updated_at (updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS author_guides (
  id CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  status ENUM('PUBLISHED', 'DRAFT') NOT NULL DEFAULT 'PUBLISHED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_author_guides_status_updated_at (status, updated_at),
  FULLTEXT INDEX ftx_author_guides_title_content (title, content)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dynnode_posts (
  id VARCHAR(80) NOT NULL,
  title VARCHAR(200) NOT NULL,
  summary TEXT NULL,
  code MEDIUMTEXT NOT NULL,
  sample_ctx JSON NULL,
  ctx_key VARCHAR(120) NOT NULL DEFAULT 'api:API01',
  tags JSON NOT NULL,
  status ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_dynnode_posts_status_updated_at (status, updated_at),
  FULLTEXT INDEX ftx_dynnode_posts_title_summary_code (title, summary, code),
  CONSTRAINT chk_dynnode_posts_sample_ctx_json CHECK (sample_ctx IS NULL OR JSON_VALID(sample_ctx)),
  CONSTRAINT chk_dynnode_posts_tags_json CHECK (JSON_VALID(tags))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contract_deals (
  id VARCHAR(64) NOT NULL,
  status ENUM('LEAD', 'PROPOSAL', 'NEGOTIATION', 'CONTRACTED', 'DONE') NOT NULL DEFAULT 'LEAD',
  title VARCHAR(200) NOT NULL,
  customer VARCHAR(200) NOT NULL,
  owner VARCHAR(100) NOT NULL,
  close_date DATE NOT NULL,
  notes TEXT NULL,
  discount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_contract_deals_status_close_date (status, close_date),
  INDEX idx_contract_deals_owner_close_date (owner, close_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contract_line_items (
  id VARCHAR(64) NOT NULL,
  deal_id VARCHAR(64) NOT NULL,
  name VARCHAR(200) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_contract_line_items_deal_id_sort_order (deal_id, sort_order),
  CONSTRAINT fk_contract_line_items_deal_id
    FOREIGN KEY (deal_id) REFERENCES contract_deals (id)
    ON DELETE CASCADE,
  CONSTRAINT chk_contract_line_items_qty CHECK (qty > 0),
  CONSTRAINT chk_contract_line_items_unit_price CHECK (unit_price >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS business_lines (
  id CHAR(36) NOT NULL,
  jira_key VARCHAR(80) NULL,
  line_number VARCHAR(40) NOT NULL,
  service_type ENUM('B2G', 'STG', 'B2B', 'ETC') NOT NULL DEFAULT 'STG',
  bot_name VARCHAR(200) NOT NULL,
  bot_code VARCHAR(100) NOT NULL,
  requester VARCHAR(100) NOT NULL,
  requested_at DATE NOT NULL,
  ended_at DATE NULL,
  regi_status ENUM('DONE', 'CANCELLED', 'PENDING') NOT NULL DEFAULT 'PENDING',
  memo TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_business_lines_line_number (line_number),
  INDEX idx_business_lines_requested_at (requested_at),
  INDEX idx_business_lines_status_requested_at (regi_status, requested_at),
  INDEX idx_business_lines_service_type (service_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teams (
  id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  division_name VARCHAR(100) NOT NULL DEFAULT '운영단',
  head_user_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_teams_name (name),
  INDEX idx_teams_head_user_id (head_user_id),
  CONSTRAINT fk_teams_head_user_id
    FOREIGN KEY (head_user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS organization_settings (
  id TINYINT NOT NULL DEFAULT 1,
  root_name VARCHAR(100) NOT NULL DEFAULT 'AICC 본부',
  seal_image_url MEDIUMTEXT NULL,
  seal_file_name VARCHAR(255) NULL,
  seal_storage_key VARCHAR(255) NULL,
  seal_updated_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT chk_organization_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB;

INSERT INTO organization_settings (id, root_name)
VALUES (1, 'AICC 본부')
ON DUPLICATE KEY UPDATE root_name = root_name;

CREATE TABLE IF NOT EXISTS user_team_memberships (
  user_id CHAR(36) NOT NULL,
  team_id CHAR(36) NOT NULL,
  team_role ENUM('HEAD', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, team_id),
  INDEX idx_user_team_memberships_team_role (team_id, team_role),
  CONSTRAINT fk_user_team_memberships_user_id
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_team_memberships_team_id
    FOREIGN KEY (team_id) REFERENCES teams (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employee_profiles (
  user_id CHAR(36) NOT NULL,
  team_id CHAR(36) NULL,
  position VARCHAR(50) NOT NULL DEFAULT 'STAFF',
  employment_type ENUM('P', 'E') NOT NULL DEFAULT 'P',
  hire_date DATE NULL,
  years_of_service INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  INDEX idx_employee_profiles_team_position (team_id, position),
  CONSTRAINT fk_employee_profiles_user_id
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_employee_profiles_team_id
    FOREIGN KEY (team_id) REFERENCES teams (id)
    ON DELETE SET NULL,
  CONSTRAINT chk_employee_profiles_years CHECK (years_of_service >= 0)
) ENGINE=InnoDB;

SET @employee_profiles_employment_type_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE employee_profiles ADD COLUMN employment_type ENUM(''P'', ''E'') NOT NULL DEFAULT ''P'' AFTER position',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employee_profiles'
    AND COLUMN_NAME = 'employment_type'
);
PREPARE employee_profiles_employment_type_stmt FROM @employee_profiles_employment_type_sql;
EXECUTE employee_profiles_employment_type_stmt;
DEALLOCATE PREPARE employee_profiles_employment_type_stmt;

CREATE TABLE IF NOT EXISTS employee_profile_details (
  user_id CHAR(36) NOT NULL,
  display_name VARCHAR(100) NULL,
  resident_number_masked VARCHAR(30) NULL,
  address VARCHAR(255) NULL,
  certificate_purpose VARCHAR(120) NULL,
  education TEXT NULL,
  awards TEXT NULL,
  certifications TEXT NULL,
  photo_url MEDIUMTEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_employee_profile_details_user_id
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kakao_user_links (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  kakao_user_key VARCHAR(120) NOT NULL,
  channel_id VARCHAR(120) NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
  verified_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  approved_by CHAR(36) NULL,
  decided_at DATETIME(3) NULL,
  rejected_reason VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_kakao_user_links_user_key (kakao_user_key),
  INDEX idx_kakao_user_links_user_id (user_id),
  INDEX idx_kakao_user_links_status_updated (status, updated_at),
  CONSTRAINT fk_kakao_user_links_user_id
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kakao_link_verifications (
  id CHAR(36) NOT NULL,
  kakao_user_key VARCHAR(120) NOT NULL,
  channel_id VARCHAR(120) NULL,
  user_id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_kakao_link_verifications_user_code (user_id, code_hash, expires_at),
  INDEX idx_kakao_link_verifications_key_created (kakao_user_key, created_at),
  CONSTRAINT fk_kakao_link_verifications_user_id
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kakao_link_sessions (
  id CHAR(36) NOT NULL,
  kakao_user_key VARCHAR(120) NOT NULL,
  channel_id VARCHAR(120) NULL,
  status ENUM('WAITING_EMAIL', 'COMPLETED', 'EXPIRED') NOT NULL DEFAULT 'WAITING_EMAIL',
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_kakao_link_sessions_user_key (kakao_user_key),
  INDEX idx_kakao_link_sessions_status_expires (status, expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kakao_message_logs (
  id CHAR(36) NOT NULL,
  kakao_user_key VARCHAR(120) NULL,
  channel_id VARCHAR(120) NULL,
  direction ENUM('INBOUND', 'OUTBOUND') NOT NULL,
  message_type VARCHAR(60) NOT NULL DEFAULT 'TEXT',
  payload JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_kakao_message_logs_user_created (kakao_user_key, created_at),
  CONSTRAINT chk_kakao_message_logs_payload_json CHECK (payload IS NULL OR JSON_VALID(payload))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leave_policies (
  id CHAR(36) NOT NULL,
  position VARCHAR(50) NOT NULL,
  min_years INT NOT NULL DEFAULT 0,
  max_years INT NULL,
  granted_days DECIMAL(5, 2) NOT NULL DEFAULT 15,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_leave_policies_position_years (position, min_years, max_years),
  CONSTRAINT chk_leave_policies_years CHECK (min_years >= 0 AND (max_years IS NULL OR max_years >= min_years)),
  CONSTRAINT chk_leave_policies_granted CHECK (granted_days >= 0)
) ENGINE=InnoDB;

INSERT INTO leave_policies (id, position, min_years, max_years, granted_days, effective_from)
SELECT '00000000-0000-4000-9000-000000000000', 'ALL', 0, 0, 15, '2026-01-01'
WHERE NOT EXISTS (SELECT 1 FROM leave_policies WHERE id = '00000000-0000-4000-9000-000000000000');

INSERT INTO leave_policies (id, position, min_years, max_years, granted_days, effective_from)
SELECT '00000000-0000-4000-9000-000000000001', 'ALL', 1, 1, 17, '2026-01-01'
WHERE NOT EXISTS (SELECT 1 FROM leave_policies WHERE id = '00000000-0000-4000-9000-000000000001');

INSERT INTO leave_policies (id, position, min_years, max_years, granted_days, effective_from)
SELECT '00000000-0000-4000-9000-000000000002', 'ALL', 2, 2, 19, '2026-01-01'
WHERE NOT EXISTS (SELECT 1 FROM leave_policies WHERE id = '00000000-0000-4000-9000-000000000002');

INSERT INTO leave_policies (id, position, min_years, max_years, granted_days, effective_from)
SELECT '00000000-0000-4000-9000-000000000003', 'ALL', 3, 3, 21, '2026-01-01'
WHERE NOT EXISTS (SELECT 1 FROM leave_policies WHERE id = '00000000-0000-4000-9000-000000000003');

INSERT INTO leave_policies (id, position, min_years, max_years, granted_days, effective_from)
SELECT '00000000-0000-4000-9000-000000000004', 'ALL', 4, 4, 23, '2026-01-01'
WHERE NOT EXISTS (SELECT 1 FROM leave_policies WHERE id = '00000000-0000-4000-9000-000000000004');

INSERT INTO leave_policies (id, position, min_years, max_years, granted_days, effective_from)
SELECT '00000000-0000-4000-9000-000000000005', 'ALL', 5, NULL, 25, '2026-01-01'
WHERE NOT EXISTS (SELECT 1 FROM leave_policies WHERE id = '00000000-0000-4000-9000-000000000005');

CREATE TABLE IF NOT EXISTS leave_balances (
  user_id CHAR(36) NOT NULL,
  balance_year INT NOT NULL,
  granted_days DECIMAL(5, 2) NOT NULL DEFAULT 0,
  used_days DECIMAL(5, 2) NOT NULL DEFAULT 0,
  remaining_days DECIMAL(5, 2) NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, balance_year),
  CONSTRAINT fk_leave_balances_user_id
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT chk_leave_balances_days CHECK (granted_days >= 0 AND used_days >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leave_requests (
  id CHAR(36) NOT NULL,
  requester_id CHAR(36) NOT NULL,
  team_id CHAR(36) NULL,
  request_type ENUM('ANNUAL', 'AM_HALF', 'PM_HALF', 'SICK', 'OFFICIAL', 'COMP', 'BUSINESS_TRIP', 'TRIP_EXPENSE') NOT NULL DEFAULT 'ANNUAL',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  half_day ENUM('AM', 'PM') NULL,
  reason TEXT NULL,
  status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_leave_requests_requester_date (requester_id, start_date),
  INDEX idx_leave_requests_team_date_status (team_id, start_date, status),
  CONSTRAINT fk_leave_requests_requester_id
    FOREIGN KEY (requester_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_leave_requests_team_id
    FOREIGN KEY (team_id) REFERENCES teams (id)
    ON DELETE SET NULL,
  CONSTRAINT chk_leave_requests_date_range CHECK (end_date >= start_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leave_balance_events (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  leave_request_id CHAR(36) NULL,
  event_type ENUM('GRANT', 'USE', 'RESTORE', 'ADJUST') NOT NULL,
  days DECIMAL(5, 2) NOT NULL,
  reason TEXT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_leave_balance_events_user_created (user_id, created_at),
  CONSTRAINT fk_leave_balance_events_user_id
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_leave_balance_events_leave_request_id
    FOREIGN KEY (leave_request_id) REFERENCES leave_requests (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_leave_balance_events_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS approval_steps (
  id CHAR(36) NOT NULL,
  target_type ENUM('LEAVE_REQUEST', 'BUSINESS_TRIP', 'TRIP_EXPENSE') NOT NULL,
  target_id CHAR(36) NOT NULL,
  step_order INT NOT NULL DEFAULT 1,
  approver_id CHAR(36) NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  comment TEXT NULL,
  decided_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_approval_steps_target_step (target_type, target_id, step_order),
  INDEX idx_approval_steps_approver_status (approver_id, status, created_at),
  CONSTRAINT fk_approval_steps_approver_id
    FOREIGN KEY (approver_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trip_expense_requests (
  id CHAR(36) NOT NULL,
  business_trip_request_id CHAR(36) NOT NULL,
  requester_id CHAR(36) NOT NULL,
  team_id CHAR(36) NULL,
  origin VARCHAR(150) NOT NULL,
  destination VARCHAR(150) NOT NULL,
  trip_scope ENUM('IN_CITY', 'OUT_CITY') NOT NULL DEFAULT 'IN_CITY',
  transport_type ENUM('TRAIN', 'CAR', 'BUS', 'TAXI', 'OTHER') NOT NULL DEFAULT 'TRAIN',
  train_fare_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  car_depreciation_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  other_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  lodging_nights INT NOT NULL DEFAULT 0,
  daily_allowance_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  lodging_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  memo TEXT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  settlement_status ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
  settled_by CHAR(36) NULL,
  settled_at DATETIME(3) NULL,
  payment_date DATE NULL,
  payment_account VARCHAR(200) NULL,
  settlement_memo TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_trip_expense_requests_business_trip (business_trip_request_id),
  INDEX idx_trip_expense_requests_requester_status (requester_id, status, created_at),
  INDEX idx_trip_expense_requests_team_status (team_id, status, created_at),
  CONSTRAINT fk_trip_expense_requests_business_trip
    FOREIGN KEY (business_trip_request_id) REFERENCES leave_requests (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_trip_expense_requests_requester
    FOREIGN KEY (requester_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_trip_expense_requests_team
    FOREIGN KEY (team_id) REFERENCES teams (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_trip_expense_requests_settled_by
    FOREIGN KEY (settled_by) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT chk_trip_expense_amounts CHECK (
    train_fare_amount >= 0 AND car_depreciation_amount >= 0 AND other_amount >= 0
    AND lodging_nights >= 0 AND daily_allowance_amount >= 0 AND lodging_amount >= 0 AND total_amount >= 0
  )
) ENGINE=InnoDB;

SET @trip_expense_requests_settlement_status_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE trip_expense_requests ADD COLUMN settlement_status ENUM(''PENDING'', ''PAID'') NOT NULL DEFAULT ''PENDING'' AFTER status',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trip_expense_requests'
    AND COLUMN_NAME = 'settlement_status'
);
PREPARE trip_expense_requests_settlement_status_stmt FROM @trip_expense_requests_settlement_status_sql;
EXECUTE trip_expense_requests_settlement_status_stmt;
DEALLOCATE PREPARE trip_expense_requests_settlement_status_stmt;

SET @trip_expense_requests_settled_by_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE trip_expense_requests ADD COLUMN settled_by CHAR(36) NULL AFTER settlement_status',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trip_expense_requests'
    AND COLUMN_NAME = 'settled_by'
);
PREPARE trip_expense_requests_settled_by_stmt FROM @trip_expense_requests_settled_by_sql;
EXECUTE trip_expense_requests_settled_by_stmt;
DEALLOCATE PREPARE trip_expense_requests_settled_by_stmt;

SET @trip_expense_requests_settled_at_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE trip_expense_requests ADD COLUMN settled_at DATETIME(3) NULL AFTER settled_by',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trip_expense_requests'
    AND COLUMN_NAME = 'settled_at'
);
PREPARE trip_expense_requests_settled_at_stmt FROM @trip_expense_requests_settled_at_sql;
EXECUTE trip_expense_requests_settled_at_stmt;
DEALLOCATE PREPARE trip_expense_requests_settled_at_stmt;

SET @trip_expense_requests_payment_date_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE trip_expense_requests ADD COLUMN payment_date DATE NULL AFTER settled_at',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trip_expense_requests'
    AND COLUMN_NAME = 'payment_date'
);
PREPARE trip_expense_requests_payment_date_stmt FROM @trip_expense_requests_payment_date_sql;
EXECUTE trip_expense_requests_payment_date_stmt;
DEALLOCATE PREPARE trip_expense_requests_payment_date_stmt;

SET @trip_expense_requests_payment_account_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE trip_expense_requests ADD COLUMN payment_account VARCHAR(200) NULL AFTER payment_date',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trip_expense_requests'
    AND COLUMN_NAME = 'payment_account'
);
PREPARE trip_expense_requests_payment_account_stmt FROM @trip_expense_requests_payment_account_sql;
EXECUTE trip_expense_requests_payment_account_stmt;
DEALLOCATE PREPARE trip_expense_requests_payment_account_stmt;

SET @trip_expense_requests_settlement_memo_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE trip_expense_requests ADD COLUMN settlement_memo TEXT NULL AFTER payment_account',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trip_expense_requests'
    AND COLUMN_NAME = 'settlement_memo'
);
PREPARE trip_expense_requests_settlement_memo_stmt FROM @trip_expense_requests_settlement_memo_sql;
EXECUTE trip_expense_requests_settlement_memo_stmt;
DEALLOCATE PREPARE trip_expense_requests_settlement_memo_stmt;

SET @trip_expense_requests_trip_scope_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE trip_expense_requests ADD COLUMN trip_scope ENUM(''IN_CITY'', ''OUT_CITY'') NOT NULL DEFAULT ''IN_CITY'' AFTER destination',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trip_expense_requests'
    AND COLUMN_NAME = 'trip_scope'
);
PREPARE trip_expense_requests_trip_scope_stmt FROM @trip_expense_requests_trip_scope_sql;
EXECUTE trip_expense_requests_trip_scope_stmt;
DEALLOCATE PREPARE trip_expense_requests_trip_scope_stmt;

SET @trip_expense_requests_lodging_nights_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE trip_expense_requests ADD COLUMN lodging_nights INT NOT NULL DEFAULT 0 AFTER other_amount',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trip_expense_requests'
    AND COLUMN_NAME = 'lodging_nights'
);
PREPARE trip_expense_requests_lodging_nights_stmt FROM @trip_expense_requests_lodging_nights_sql;
EXECUTE trip_expense_requests_lodging_nights_stmt;
DEALLOCATE PREPARE trip_expense_requests_lodging_nights_stmt;

SET @trip_expense_requests_daily_allowance_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE trip_expense_requests ADD COLUMN daily_allowance_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER lodging_nights',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trip_expense_requests'
    AND COLUMN_NAME = 'daily_allowance_amount'
);
PREPARE trip_expense_requests_daily_allowance_stmt FROM @trip_expense_requests_daily_allowance_sql;
EXECUTE trip_expense_requests_daily_allowance_stmt;
DEALLOCATE PREPARE trip_expense_requests_daily_allowance_stmt;

SET @trip_expense_requests_lodging_amount_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE trip_expense_requests ADD COLUMN lodging_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER daily_allowance_amount',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trip_expense_requests'
    AND COLUMN_NAME = 'lodging_amount'
);
PREPARE trip_expense_requests_lodging_amount_stmt FROM @trip_expense_requests_lodging_amount_sql;
EXECUTE trip_expense_requests_lodging_amount_stmt;
DEALLOCATE PREPARE trip_expense_requests_lodging_amount_stmt;

CREATE TABLE IF NOT EXISTS trip_expense_attachments (
  id CHAR(36) NOT NULL,
  trip_expense_request_id CHAR(36) NOT NULL,
  storage_provider ENUM('RAILWAY_BUCKET', 'LOCAL_MOCK') NOT NULL DEFAULT 'LOCAL_MOCK',
  storage_key VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_trip_expense_attachments_request (trip_expense_request_id, created_at),
  CONSTRAINT fk_trip_expense_attachments_request
    FOREIGN KEY (trip_expense_request_id) REFERENCES trip_expense_requests (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_trip_expense_attachments_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT chk_trip_expense_attachments_file_size CHECK (file_size >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS family_event_requests (
  id CHAR(36) NOT NULL,
  requester_id CHAR(36) NOT NULL,
  team_id CHAR(36) NULL,
  event_type ENUM('MARRIAGE', 'BIRTH', 'FUNERAL', 'FIRST_BIRTHDAY', 'HOSPITAL', 'OTHER') NOT NULL,
  relation_name VARCHAR(80) NULL,
  event_date DATE NOT NULL,
  location VARCHAR(255) NULL,
  note TEXT NULL,
  support_amount INT NOT NULL DEFAULT 0,
  wreath_required BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_family_event_requests_requester (requester_id, created_at),
  INDEX idx_family_event_requests_team_status (team_id, status, event_date),
  INDEX idx_family_event_requests_status_date (status, event_date),
  CONSTRAINT fk_family_event_requests_requester
    FOREIGN KEY (requester_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_family_event_requests_team
    FOREIGN KEY (team_id) REFERENCES teams (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_family_event_requests_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS post_comments (
  id CHAR(36) NOT NULL,
  target_type ENUM('NOTICE', 'FAMILY_EVENT') NOT NULL,
  target_id VARCHAR(80) NOT NULL,
  parent_id CHAR(36) NULL,
  author_id CHAR(36) NULL,
  author_name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_post_comments_target_created (target_type, target_id, created_at),
  INDEX idx_post_comments_parent_created (parent_id, created_at),
  INDEX idx_post_comments_author_created (author_id, created_at),
  CONSTRAINT fk_post_comments_parent
    FOREIGN KEY (parent_id) REFERENCES post_comments (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_post_comments_author
    FOREIGN KEY (author_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permission_delegations (
  id CHAR(36) NOT NULL,
  delegator_user_id CHAR(36) NOT NULL,
  delegatee_user_id CHAR(36) NOT NULL,
  team_id CHAR(36) NOT NULL,
  permission_scope ENUM('TEAM_MANAGER', 'APPROVAL', 'TEAM_HR', 'TEAM_CALENDAR') NOT NULL DEFAULT 'TEAM_MANAGER',
  starts_at DATE NOT NULL,
  ends_at DATE NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('ACTIVE', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  cancelled_by CHAR(36) NULL,
  cancelled_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  INDEX idx_permission_delegations_delegatee (delegatee_user_id, status, starts_at, ends_at),
  INDEX idx_permission_delegations_team (team_id, status, starts_at, ends_at),
  CONSTRAINT fk_permission_delegations_delegator
    FOREIGN KEY (delegator_user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_permission_delegations_delegatee
    FOREIGN KEY (delegatee_user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_permission_delegations_team
    FOREIGN KEY (team_id) REFERENCES teams (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_permission_delegations_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_permission_delegations_cancelled_by
    FOREIGN KEY (cancelled_by) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT chk_permission_delegations_dates CHECK (ends_at >= starts_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permission_delegation_presets (
  id CHAR(36) NOT NULL,
  team_id CHAR(36) NOT NULL,
  delegator_user_id CHAR(36) NOT NULL,
  default_delegatee_user_id CHAR(36) NOT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_permission_delegation_presets_team_delegator (team_id, delegator_user_id),
  INDEX idx_permission_delegation_presets_delegatee (default_delegatee_user_id),
  CONSTRAINT fk_permission_delegation_presets_team
    FOREIGN KEY (team_id) REFERENCES teams (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_permission_delegation_presets_delegator
    FOREIGN KEY (delegator_user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_permission_delegation_presets_delegatee
    FOREIGN KEY (default_delegatee_user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_permission_delegation_presets_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meeting_resources (
  id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type ENUM('MEETING_ROOM', 'TRAINING_ROOM') NOT NULL DEFAULT 'MEETING_ROOM',
  location VARCHAR(120) NULL,
  capacity INT NOT NULL DEFAULT 1,
  description TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_meeting_resources_type_active (type, active),
  CONSTRAINT chk_meeting_resources_capacity CHECK (capacity > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meeting_reservations (
  id CHAR(36) NOT NULL,
  resource_id CHAR(36) NOT NULL,
  requester_id CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  purpose TEXT NULL,
  starts_at DATETIME(3) NOT NULL,
  ends_at DATETIME(3) NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'CANCELLED') NOT NULL DEFAULT 'APPROVED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_meeting_reservations_resource_time (resource_id, starts_at, ends_at),
  INDEX idx_meeting_reservations_requester_created (requester_id, created_at),
  CONSTRAINT fk_meeting_reservations_resource
    FOREIGN KEY (resource_id) REFERENCES meeting_resources (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_meeting_reservations_requester
    FOREIGN KEY (requester_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT chk_meeting_reservations_time CHECK (ends_at > starts_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  type ENUM('APPROVAL_REQUESTED', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED', 'REQUEST_CANCELLED', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM',
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  target_type VARCHAR(50) NULL,
  target_id CHAR(36) NULL,
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_notifications_user_read_created (user_id, read_at, created_at),
  CONSTRAINT fk_notifications_user_id
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS approval_calendar_syncs (
  id CHAR(36) NOT NULL,
  target_type ENUM('LEAVE_REQUEST', 'BUSINESS_TRIP', 'TRIP_EXPENSE') NOT NULL,
  target_id CHAR(36) NOT NULL,
  provider ENUM('NOTION') NOT NULL DEFAULT 'NOTION',
  sync_status ENUM('PENDING', 'SYNCED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  external_page_id VARCHAR(120) NULL,
  external_url TEXT NULL,
  last_error TEXT NULL,
  synced_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_approval_calendar_syncs_target_provider (target_type, target_id, provider),
  INDEX idx_approval_calendar_syncs_status_created (sync_status, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS calendar_memos (
  id CHAR(36) NOT NULL,
  scope ENUM('PERSONAL', 'TEAM') NOT NULL,
  memo_date DATE NOT NULL,
  memo_text TEXT NOT NULL,
  created_by CHAR(36) NOT NULL,
  team_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_calendar_memos_personal (created_by, memo_date),
  INDEX idx_calendar_memos_team (team_id, memo_date),
  CONSTRAINT fk_calendar_memos_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS operational_assets (
  id CHAR(36) NOT NULL,
  asset_type ENUM('LICENSE', 'CONTRACT', 'CERTIFICATE', 'SECURITY_DOC', 'ETC') NOT NULL DEFAULT 'LICENSE',
  name VARCHAR(180) NOT NULL,
  vendor VARCHAR(160) NOT NULL,
  owner_user_id CHAR(36) NULL,
  team_id CHAR(36) NULL,
  status ENUM('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'REVIEW') NOT NULL DEFAULT 'ACTIVE',
  starts_at DATE NULL,
  expires_at DATE NULL,
  renewal_notice_days INT NOT NULL DEFAULT 30,
  memo TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_operational_assets_status_expires (status, expires_at),
  INDEX idx_operational_assets_team_status (team_id, status),
  CONSTRAINT fk_operational_assets_owner
    FOREIGN KEY (owner_user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS operational_asset_files (
  id CHAR(36) NOT NULL,
  asset_id CHAR(36) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(80) NOT NULL,
  mime_type VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
  file_size BIGINT NOT NULL DEFAULT 0,
  storage_provider VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  storage_key VARCHAR(500) NULL,
  uploaded_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_operational_asset_files_asset_created (asset_id, created_at),
  CONSTRAINT fk_operational_asset_files_asset
    FOREIGN KEY (asset_id) REFERENCES operational_assets (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_operational_asset_files_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS operational_asset_access_logs (
  id CHAR(36) NOT NULL,
  asset_id CHAR(36) NOT NULL,
  file_id CHAR(36) NULL,
  action ENUM('VIEW', 'DOWNLOAD', 'UPLOAD', 'DELETE') NOT NULL,
  actor_id CHAR(36) NULL,
  ip_address VARCHAR(80) NULL,
  user_agent TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_operational_asset_access_logs_asset_created (asset_id, created_at),
  INDEX idx_operational_asset_access_logs_actor_created (actor_id, created_at),
  CONSTRAINT fk_operational_asset_access_logs_asset
    FOREIGN KEY (asset_id) REFERENCES operational_assets (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_operational_asset_access_logs_file
    FOREIGN KEY (file_id) REFERENCES operational_asset_files (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_operational_asset_access_logs_actor
    FOREIGN KEY (actor_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS monitoring_runs (
  run_id VARCHAR(80) NOT NULL,
  campaign_id VARCHAR(64) NOT NULL,
  campaign_name VARCHAR(200) NOT NULL,
  state ENUM('RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'RUNNING',
  started_at DATETIME(3) NOT NULL,
  ended_at DATETIME(3) NULL,
  duration_ms BIGINT NULL,
  processed INT NOT NULL DEFAULT 0,
  success INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  error_code VARCHAR(50) NULL,
  error_count INT NOT NULL DEFAULT 0,
  latency_avg_ms INT NOT NULL DEFAULT 0,
  latency_p95_ms INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (run_id),
  INDEX idx_monitoring_runs_campaign_started_at (campaign_id, started_at),
  INDEX idx_monitoring_runs_state_started_at (state, started_at),
  CONSTRAINT fk_monitoring_runs_campaign_id
    FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS monitoring_run_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id VARCHAR(80) NOT NULL,
  event_at DATETIME(3) NOT NULL,
  level ENUM('INFO', 'WARN', 'ERROR') NOT NULL,
  type ENUM('START', 'PROGRESS', 'ERROR', 'RETRY', 'STOP', 'END') NOT NULL,
  message TEXT NOT NULL,
  meta JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_monitoring_run_events_run_event_at (run_id, event_at),
  CONSTRAINT fk_monitoring_run_events_run_id
    FOREIGN KEY (run_id) REFERENCES monitoring_runs (run_id)
    ON DELETE CASCADE,
  CONSTRAINT chk_monitoring_run_events_meta_json CHECK (meta IS NULL OR JSON_VALID(meta))
) ENGINE=InnoDB;

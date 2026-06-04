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

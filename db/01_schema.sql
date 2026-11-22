-- =====================================================================
-- PropVault CRM — Oracle schema (ATP 19c+ / 23ai)
-- Run as the application schema owner (e.g. PROPVAULT).
-- Design: no fixed entities, no fixed modules per entity.
--   ENTITIES        -> created by admin
--   MODULES         -> code-defined library (seeded, not user-created)
--   ENTITY_MODULES  -> which module each entity gets, with label/order/filter
-- Every business table carries ENTITY_ID; the API scopes every query by it.
-- SOURCE / EXTERNAL_ID are reserved for D365 / Capsule imports.
-- =====================================================================

-- ---------- Core configuration ----------------------------------------

CREATE TABLE entities (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          VARCHAR2(20)  NOT NULL,
  name          VARCHAR2(150) NOT NULL,
  industry      VARCHAR2(150),
  color         VARCHAR2(20)  DEFAULT 'sky' NOT NULL,  -- Tailwind palette name, not hex
  city          VARCHAR2(80),
  active        NUMBER(1)     DEFAULT 1 NOT NULL CHECK (active IN (0,1)),
  sort_order    NUMBER(5)     DEFAULT 0 NOT NULL,
  source        VARCHAR2(20)  DEFAULT 'CRM' NOT NULL,   -- CRM | D365
  external_id   VARCHAR2(100),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT uq_entities_code UNIQUE (code)
);

CREATE TABLE modules (
  code          VARCHAR2(40)  PRIMARY KEY,
  name          VARCHAR2(100) NOT NULL,
  description   VARCHAR2(400),
  phase         NUMBER(2)     DEFAULT 1 NOT NULL,       -- 1 = 26 Dec delivery
  available     NUMBER(1)     DEFAULT 1 NOT NULL CHECK (available IN (0,1))
);

CREATE TABLE entity_modules (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     NUMBER        NOT NULL REFERENCES entities(id),
  module_code   VARCHAR2(40)  NOT NULL REFERENCES modules(code),
  slug          VARCHAR2(60)  NOT NULL,                 -- URL key, e.g. office-units
  label         VARCHAR2(100) NOT NULL,                 -- menu label, e.g. "Office Units"
  sort_order    NUMBER(5)     DEFAULT 0 NOT NULL,
  enabled       NUMBER(1)     DEFAULT 1 NOT NULL CHECK (enabled IN (0,1)),
  filter_config CLOB          CHECK (filter_config IS JSON), -- fixed filter, e.g. {"category":"Office"}
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT uq_entity_modules_slug UNIQUE (entity_id, slug)
);

CREATE TABLE entity_stages (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     NUMBER        NOT NULL REFERENCES entities(id),
  pipeline_code VARCHAR2(40)  DEFAULT 'default' NOT NULL,
  name          VARCHAR2(80)  NOT NULL,
  sort_order    NUMBER(5)     NOT NULL,
  color         VARCHAR2(20)  DEFAULT 'slate' NOT NULL,
  is_won        NUMBER(1)     DEFAULT 0 NOT NULL CHECK (is_won IN (0,1)),
  is_lost       NUMBER(1)     DEFAULT 0 NOT NULL CHECK (is_lost IN (0,1)),
  active        NUMBER(1)     DEFAULT 1 NOT NULL CHECK (active IN (0,1)),
  CONSTRAINT uq_entity_stages UNIQUE (entity_id, pipeline_code, name)
);

CREATE TABLE field_definitions (
  id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_module_id NUMBER        NOT NULL REFERENCES entity_modules(id),
  field_key        VARCHAR2(40)  NOT NULL,              -- stored in ATTRS JSON
  label            VARCHAR2(100) NOT NULL,
  field_type       VARCHAR2(20)  NOT NULL CHECK (field_type IN ('text','number','date','select','multiselect','boolean')),
  options          CLOB          CHECK (options IS JSON),
  required         NUMBER(1)     DEFAULT 0 NOT NULL,
  show_in_list     NUMBER(1)     DEFAULT 0 NOT NULL,
  sort_order       NUMBER(5)     DEFAULT 0 NOT NULL,
  CONSTRAINT uq_field_defs UNIQUE (entity_module_id, field_key)
);

CREATE TABLE dash_widgets (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     NUMBER        REFERENCES entities(id),  -- NULL = group overview
  widget_code   VARCHAR2(40)  NOT NULL,                 -- occupancy, arr, mrr, nps, pipeline_value ...
  config        CLOB          CHECK (config IS JSON),
  sort_order    NUMBER(5)     DEFAULT 0 NOT NULL
);

-- ---------- Users, roles, permissions ---------------------------------

CREATE TABLE app_users (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         VARCHAR2(200) NOT NULL,
  display_name  VARCHAR2(150) NOT NULL,
  entra_oid     VARCHAR2(64),                          -- filled on first SSO login
  global_role   VARCHAR2(30)  CHECK (global_role IN ('group-owner','group-supervisor')),
  active        NUMBER(1)     DEFAULT 1 NOT NULL CHECK (active IN (0,1)),
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT uq_users_oid   UNIQUE (entra_oid)
);

CREATE TABLE user_entities (
  user_id       NUMBER       NOT NULL REFERENCES app_users(id),
  entity_id     NUMBER       NOT NULL REFERENCES entities(id),
  role          VARCHAR2(30) NOT NULL CHECK (role IN ('company-owner','dept-manager','sales-agent','marketing','operation','viewer')),
  department    VARCHAR2(60),
  CONSTRAINT pk_user_entities PRIMARY KEY (user_id, entity_id)
);

CREATE TABLE role_permissions (
  role          VARCHAR2(30) NOT NULL,
  module_code   VARCHAR2(40) NOT NULL REFERENCES modules(code),
  can_view      NUMBER(1) DEFAULT 0 NOT NULL,
  can_create    NUMBER(1) DEFAULT 0 NOT NULL,
  can_edit      NUMBER(1) DEFAULT 0 NOT NULL,
  can_delete    NUMBER(1) DEFAULT 0 NOT NULL,
  can_export    NUMBER(1) DEFAULT 0 NOT NULL,
  CONSTRAINT pk_role_permissions PRIMARY KEY (role, module_code)
);

-- ---------- Business tables (Phase 1 modules) -------------------------
-- Common columns are real columns (indexed, reportable); entity-specific
-- extras live in ATTRS JSON, validated against FIELD_DEFINITIONS.

CREATE TABLE contacts (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     NUMBER        NOT NULL REFERENCES entities(id),
  contact_type  VARCHAR2(20)  DEFAULT 'person' NOT NULL CHECK (contact_type IN ('person','company')),
  name          VARCHAR2(200) NOT NULL,
  company       VARCHAR2(200),
  email         VARCHAR2(200),
  phone         VARCHAR2(40),
  status        VARCHAR2(30)  DEFAULT 'Active' NOT NULL,  -- members: Active/Trial/Paused/Churned
  plan          VARCHAR2(40),
  mrr_amount    NUMBER(14,2),
  start_date    DATE,
  renewal_date  DATE,
  nps           NUMBER(2),
  tags          CLOB CHECK (tags IS JSON),
  notes         VARCHAR2(4000),
  attrs         CLOB CHECK (attrs IS JSON),
  source        VARCHAR2(20)  DEFAULT 'CRM' NOT NULL,     -- CRM | D365 | CAPSULE
  external_id   VARCHAR2(100),
  created_by    NUMBER REFERENCES app_users(id),
  updated_by    NUMBER REFERENCES app_users(id),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  row_version   NUMBER DEFAULT 1 NOT NULL,
  deleted_at    TIMESTAMP WITH TIME ZONE
);

CREATE TABLE units (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     NUMBER        NOT NULL REFERENCES entities(id),
  category      VARCHAR2(40)  NOT NULL,                  -- Office | Retail | Apartment | Space ...
  code          VARCHAR2(40)  NOT NULL,                  -- JS-O-001, SLO-101, GRV-HD
  name          VARCHAR2(150),
  unit_type     VARCHAR2(60),                            -- Serviced Office, Studio, Hot Desk ...
  floor         VARCHAR2(40),
  size_sqm      NUMBER(10,2),
  capacity      NUMBER(6),
  status        VARCHAR2(40)  DEFAULT 'Available' NOT NULL,
  rent_amount   NUMBER(14,2),
  rent_period   VARCHAR2(10)  DEFAULT 'year' CHECK (rent_period IN ('day','month','year')),
  tenant_contact_id NUMBER REFERENCES contacts(id),
  lease_start   DATE,
  lease_end     DATE,
  attrs         CLOB CHECK (attrs IS JSON),              -- view, fitout, furnishing, amenities ...
  source        VARCHAR2(20)  DEFAULT 'CRM' NOT NULL,
  external_id   VARCHAR2(100),
  created_by    NUMBER REFERENCES app_users(id),
  updated_by    NUMBER REFERENCES app_users(id),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  row_version   NUMBER DEFAULT 1 NOT NULL,
  deleted_at    TIMESTAMP WITH TIME ZONE,
  CONSTRAINT uq_units_code UNIQUE (entity_id, code)
);

CREATE TABLE leads (
  id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id       NUMBER        NOT NULL REFERENCES entities(id),
  contact_id      NUMBER REFERENCES contacts(id),
  category        VARCHAR2(40),                          -- Office | Retail | ... (for split menus)
  name            VARCHAR2(200) NOT NULL,
  email           VARCHAR2(200),
  phone           VARCHAR2(40),
  stage_id        NUMBER REFERENCES entity_stages(id),
  lead_source     VARCHAR2(40),
  value_amount    NUMBER(14,2) DEFAULT 0 NOT NULL,
  score           NUMBER(3)    DEFAULT 0 NOT NULL CHECK (score BETWEEN 0 AND 100),
  assignee_id     NUMBER REFERENCES app_users(id),
  quality_owner   VARCHAR2(20) CHECK (quality_owner IN ('Marketing','Leasing','Shared')),
  unit_id         NUMBER REFERENCES units(id),
  last_activity_at TIMESTAMP WITH TIME ZONE,
  notes           VARCHAR2(4000),
  attrs           CLOB CHECK (attrs IS JSON),
  source          VARCHAR2(20)  DEFAULT 'CRM' NOT NULL,
  external_id     VARCHAR2(100),
  created_by      NUMBER REFERENCES app_users(id),
  updated_by      NUMBER REFERENCES app_users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  row_version     NUMBER DEFAULT 1 NOT NULL,
  deleted_at      TIMESTAMP WITH TIME ZONE
);

CREATE TABLE deals (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     NUMBER        NOT NULL REFERENCES entities(id),
  lead_id       NUMBER REFERENCES leads(id),
  contact_id    NUMBER REFERENCES contacts(id),
  unit_id       NUMBER REFERENCES units(id),
  name          VARCHAR2(200) NOT NULL,
  deal_type     VARCHAR2(20)  DEFAULT 'Lease' NOT NULL,
  status        VARCHAR2(20)  DEFAULT 'Draft' NOT NULL,
  amount        NUMBER(14,2)  DEFAULT 0 NOT NULL,
  start_date    DATE,
  end_date      DATE,
  close_date    DATE,
  owner_id      NUMBER REFERENCES app_users(id),
  notes         VARCHAR2(4000),
  attrs         CLOB CHECK (attrs IS JSON),
  source        VARCHAR2(20)  DEFAULT 'CRM' NOT NULL,
  external_id   VARCHAR2(100),
  created_by    NUMBER REFERENCES app_users(id),
  updated_by    NUMBER REFERENCES app_users(id),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  row_version   NUMBER DEFAULT 1 NOT NULL,
  deleted_at    TIMESTAMP WITH TIME ZONE
);

CREATE TABLE activities (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     NUMBER        NOT NULL REFERENCES entities(id),
  lead_id       NUMBER REFERENCES leads(id),
  deal_id       NUMBER REFERENCES deals(id),
  contact_id    NUMBER REFERENCES contacts(id),
  activity_type VARCHAR2(20)  NOT NULL CHECK (activity_type IN ('call','email','meeting','note','task','whatsapp','visit')),
  subject       VARCHAR2(200),
  note          VARCHAR2(4000),
  due_at        TIMESTAMP WITH TIME ZONE,
  done          NUMBER(1) DEFAULT 0 NOT NULL CHECK (done IN (0,1)),
  user_id       NUMBER REFERENCES app_users(id),
  source        VARCHAR2(20)  DEFAULT 'CRM' NOT NULL,
  external_id   VARCHAR2(100),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  row_version   NUMBER DEFAULT 1 NOT NULL,
  deleted_at    TIMESTAMP WITH TIME ZONE
);

CREATE TABLE bookings (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     NUMBER        NOT NULL REFERENCES entities(id),
  unit_id       NUMBER        NOT NULL REFERENCES units(id),
  contact_id    NUMBER REFERENCES contacts(id),
  starts_at     TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at       TIMESTAMP WITH TIME ZONE NOT NULL,
  status        VARCHAR2(20)  DEFAULT 'Confirmed' NOT NULL,
  total_amount  NUMBER(14,2),
  notes         VARCHAR2(2000),
  created_by    NUMBER REFERENCES app_users(id),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  row_version   NUMBER DEFAULT 1 NOT NULL,
  deleted_at    TIMESTAMP WITH TIME ZONE,
  CONSTRAINT ck_bookings_time CHECK (ends_at > starts_at)
);

CREATE TABLE maintenance_requests (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     NUMBER        NOT NULL REFERENCES entities(id),
  unit_id       NUMBER REFERENCES units(id),
  contact_id    NUMBER REFERENCES contacts(id),
  request_type  VARCHAR2(60)  NOT NULL,
  priority      VARCHAR2(10)  DEFAULT 'Medium' NOT NULL CHECK (priority IN ('Low','Medium','High','Urgent')),
  status        VARCHAR2(20)  DEFAULT 'Open' NOT NULL,
  assignee_id   NUMBER REFERENCES app_users(id),
  notes         VARCHAR2(4000),
  due_at        TIMESTAMP WITH TIME ZONE,
  resolved_at   TIMESTAMP WITH TIME ZONE,
  created_by    NUMBER REFERENCES app_users(id),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  row_version   NUMBER DEFAULT 1 NOT NULL,
  deleted_at    TIMESTAMP WITH TIME ZONE
);

CREATE TABLE events (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     NUMBER        NOT NULL REFERENCES entities(id),
  name          VARCHAR2(200) NOT NULL,
  event_type    VARCHAR2(40),
  starts_at     TIMESTAMP WITH TIME ZONE NOT NULL,
  capacity      NUMBER(6),
  registered    NUMBER(6) DEFAULT 0 NOT NULL,
  status        VARCHAR2(20)  DEFAULT 'Upcoming' NOT NULL,
  notes         VARCHAR2(2000),
  created_by    NUMBER REFERENCES app_users(id),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  row_version   NUMBER DEFAULT 1 NOT NULL,
  deleted_at    TIMESTAMP WITH TIME ZONE
);

CREATE TABLE cx_feedback (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     NUMBER        NOT NULL REFERENCES entities(id),
  contact_id    NUMBER REFERENCES contacts(id),
  customer_name VARCHAR2(200),
  feedback_type VARCHAR2(20)  NOT NULL CHECK (feedback_type IN ('NPS','CSAT','Complaint','Suggestion','Compliment')),
  score         NUMBER(2),
  comments      VARCHAR2(4000),
  category      VARCHAR2(30),
  status        VARCHAR2(20)  DEFAULT 'Open' NOT NULL,
  assignee_id   NUMBER REFERENCES app_users(id),
  created_by    NUMBER REFERENCES app_users(id),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  row_version   NUMBER DEFAULT 1 NOT NULL,
  deleted_at    TIMESTAMP WITH TIME ZONE
);

-- ---------- Platform tables -------------------------------------------

CREATE TABLE audit_log (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at            TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  user_id       NUMBER,
  entity_id     NUMBER,
  action        VARCHAR2(20)  NOT NULL,                  -- create | update | delete | login | export | config
  table_name    VARCHAR2(40),
  record_id     NUMBER,
  before_data   CLOB CHECK (before_data IS JSON),
  after_data    CLOB CHECK (after_data IS JSON),
  ip_address    VARCHAR2(64),
  request_id    VARCHAR2(64)
);

CREATE TABLE notifications (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       NUMBER NOT NULL REFERENCES app_users(id),
  entity_id     NUMBER REFERENCES entities(id),
  kind          VARCHAR2(40)  NOT NULL,
  title         VARCHAR2(200) NOT NULL,
  body          VARCHAR2(2000),
  link          VARCHAR2(400),
  read_at       TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE TABLE email_log (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  to_address    VARCHAR2(400) NOT NULL,
  subject       VARCHAR2(300) NOT NULL,
  kind          VARCHAR2(40),
  status        VARCHAR2(20)  DEFAULT 'queued' NOT NULL CHECK (status IN ('queued','sent','failed')),
  error_message VARCHAR2(2000),
  attempts      NUMBER(3) DEFAULT 0 NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  sent_at       TIMESTAMP WITH TIME ZONE
);

-- Prevents scheduled jobs running twice when the app runs on 2 VMs.
CREATE TABLE job_locks (
  job_name      VARCHAR2(60) PRIMARY KEY,
  locked_by     VARCHAR2(100),
  locked_until  TIMESTAMP WITH TIME ZONE,
  last_run_at   TIMESTAMP WITH TIME ZONE,
  last_status   VARCHAR2(20)
);

-- ---------- Indexes ---------------------------------------------------

CREATE INDEX ix_em_entity        ON entity_modules (entity_id, sort_order);
CREATE INDEX ix_stages_entity    ON entity_stages (entity_id, pipeline_code, sort_order);
CREATE INDEX ix_contacts_entity  ON contacts (entity_id, deleted_at, name);
CREATE INDEX ix_contacts_email   ON contacts (entity_id, LOWER(email));
CREATE INDEX ix_contacts_renew   ON contacts (entity_id, renewal_date);
CREATE INDEX ix_units_entity     ON units (entity_id, category, status);
CREATE INDEX ix_units_lease_end  ON units (entity_id, lease_end);
CREATE INDEX ix_leads_entity     ON leads (entity_id, deleted_at, stage_id);
CREATE INDEX ix_leads_assignee   ON leads (assignee_id, deleted_at);
CREATE INDEX ix_leads_activity   ON leads (entity_id, last_activity_at);
CREATE INDEX ix_deals_entity     ON deals (entity_id, deleted_at, status);
CREATE INDEX ix_deals_end        ON deals (entity_id, end_date);
CREATE INDEX ix_act_lead         ON activities (lead_id, created_at);
CREATE INDEX ix_act_entity       ON activities (entity_id, created_at);
CREATE INDEX ix_bookings_unit    ON bookings (unit_id, starts_at, ends_at);
CREATE INDEX ix_maint_entity     ON maintenance_requests (entity_id, status, priority);
CREATE INDEX ix_events_entity    ON events (entity_id, starts_at);
CREATE INDEX ix_cx_entity        ON cx_feedback (entity_id, created_at);
CREATE INDEX ix_audit_record     ON audit_log (table_name, record_id);
CREATE INDEX ix_audit_at         ON audit_log (at);
CREATE INDEX ix_notif_user       ON notifications (user_id, read_at);
CREATE INDEX ix_ext_units        ON units (source, external_id);
CREATE INDEX ix_ext_contacts     ON contacts (source, external_id);
CREATE INDEX ix_ext_leads        ON leads (source, external_id);
CREATE INDEX ix_ext_deals        ON deals (source, external_id);

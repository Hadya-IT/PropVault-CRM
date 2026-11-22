-- Hadya CRM — structure needed to mirror Capsule pipelines. Run ONCE:
--   node scripts/run-sql.js ../db/03_capsule_ddl.sql
-- (If it says "column being added already exists", it has already been run — skip to 04.)

ALTER TABLE entity_stages ADD (
  probability  NUMBER(3)     DEFAULT 0 NOT NULL CHECK (probability BETWEEN 0 AND 100),
  stale_days   NUMBER(4),
  description  VARCHAR2(200)
);

CREATE TABLE lost_reasons (
  id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR2(100) NOT NULL,
  sort_order  NUMBER(5)     DEFAULT 0 NOT NULL,
  active      NUMBER(1)     DEFAULT 1 NOT NULL CHECK (active IN (0,1)),
  CONSTRAINT uq_lost_reasons UNIQUE (name)
);

CREATE INDEX ix_ext_activities ON activities (source, external_id);

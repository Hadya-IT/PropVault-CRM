-- Hadya CRM — make maintenance_requests idempotent for D365 work-order sync.
-- RUN ONCE (plain DDL; re-running errors on "column already exists", which is harmless).
--   node scripts/run-sql.js ../db/08_maintenance_d365.sql
--
-- Adds the source/external_id/attrs pattern used by units/deals/contacts so the
-- work-order importer can MERGE on (entity_id, source='D365', external_id).

ALTER TABLE maintenance_requests ADD (attrs CLOB CHECK (attrs IS JSON));

ALTER TABLE maintenance_requests ADD (source VARCHAR2(20) DEFAULT 'CRM' NOT NULL);

ALTER TABLE maintenance_requests ADD (external_id VARCHAR2(100));

CREATE UNIQUE INDEX ux_maint_ext ON maintenance_requests (entity_id, source, external_id);
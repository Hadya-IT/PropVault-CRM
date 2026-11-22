-- Hadya CRM — pipelines and milestones copied from Capsule (hadya-com.capsulecrm.com, 22 Nov 2026).
-- Safe to re-run. Run after 03_capsule_ddl.sql:
--   node scripts/run-sql.js ../db/04_capsule_pipelines.sql

-- Retire the prototype stages (kept, not deleted, so nothing that points at them breaks).
UPDATE entity_stages SET active = 0 WHERE pipeline_code = 'default' AND entity_id IN (SELECT id FROM entities WHERE code IN ('JS','SLO','GRV'));

-- JS: JS Lease Pipeline
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Later this Year')
WHEN MATCHED THEN UPDATE SET t.sort_order = 10, t.color = 'slate', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 10, t.stale_days = 14, t.description = 'Customers to be contacted later this Year'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Later this Year', 10, 'slate', 0, 0, 1, 10, 14, 'Customers to be contacted later this Year');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'New')
WHEN MATCHED THEN UPDATE SET t.sort_order = 20, t.color = 'sky', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 20, t.stale_days = 14, t.description = 'New Customer'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'New', 20, 'sky', 0, 0, 1, 20, 14, 'New Customer');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Meeting')
WHEN MATCHED THEN UPDATE SET t.sort_order = 30, t.color = 'blue', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 30, t.stale_days = 14, t.description = 'Already met the customer'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Meeting', 30, 'blue', 0, 0, 1, 30, 14, 'Already met the customer');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Proposal')
WHEN MATCHED THEN UPDATE SET t.sort_order = 40, t.color = 'indigo', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 50, t.stale_days = 14, t.description = 'Official proposal shared with customer'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Proposal', 40, 'indigo', 0, 0, 1, 50, 14, 'Official proposal shared with customer');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Negotiation')
WHEN MATCHED THEN UPDATE SET t.sort_order = 50, t.color = 'violet', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 70, t.stale_days = 14, t.description = 'Customer in final stage of negotiations and getting approvals'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Negotiation', 50, 'violet', 0, 0, 1, 70, 14, 'Customer in final stage of negotiations and getting approvals');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Contracting')
WHEN MATCHED THEN UPDATE SET t.sort_order = 60, t.color = 'amber', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 90, t.stale_days = 14, t.description = 'Customer in contracting phase'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Contracting', 60, 'amber', 0, 0, 1, 90, 14, 'Customer in contracting phase');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Won')
WHEN MATCHED THEN UPDATE SET t.sort_order = 900, t.color = 'emerald', t.is_won = 1, t.is_lost = 0, t.active = 1, t.probability = 100, t.stale_days = NULL, t.description = 'Closed won'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Won', 900, 'emerald', 1, 0, 1, 100, NULL, 'Closed won');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Lost')
WHEN MATCHED THEN UPDATE SET t.sort_order = 910, t.color = 'rose', t.is_won = 0, t.is_lost = 1, t.active = 1, t.probability = 0, t.stale_days = NULL, t.description = 'Closed lost'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Lost', 910, 'rose', 0, 1, 1, 0, NULL, 'Closed lost');

-- JS: JS Retail Pipeline
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'retail' AND t.name = 'Lead')
WHEN MATCHED THEN UPDATE SET t.sort_order = 10, t.color = 'slate', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 10, t.stale_days = NULL, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'retail', 'Lead', 10, 'slate', 0, 0, 1, 10, NULL, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'retail' AND t.name = 'Visit')
WHEN MATCHED THEN UPDATE SET t.sort_order = 20, t.color = 'sky', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 50, t.stale_days = NULL, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'retail', 'Visit', 20, 'sky', 0, 0, 1, 50, NULL, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'retail' AND t.name = 'Offer')
WHEN MATCHED THEN UPDATE SET t.sort_order = 30, t.color = 'blue', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 60, t.stale_days = NULL, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'retail', 'Offer', 30, 'blue', 0, 0, 1, 60, NULL, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'retail' AND t.name = 'Negotiation')
WHEN MATCHED THEN UPDATE SET t.sort_order = 40, t.color = 'indigo', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 70, t.stale_days = NULL, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'retail', 'Negotiation', 40, 'indigo', 0, 0, 1, 70, NULL, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'retail' AND t.name = 'Contracting')
WHEN MATCHED THEN UPDATE SET t.sort_order = 50, t.color = 'violet', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 90, t.stale_days = NULL, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'retail', 'Contracting', 50, 'violet', 0, 0, 1, 90, NULL, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'retail' AND t.name = 'Won')
WHEN MATCHED THEN UPDATE SET t.sort_order = 900, t.color = 'emerald', t.is_won = 1, t.is_lost = 0, t.active = 1, t.probability = 100, t.stale_days = NULL, t.description = 'Closed won'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'retail', 'Won', 900, 'emerald', 1, 0, 1, 100, NULL, 'Closed won');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'JS') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'retail' AND t.name = 'Lost')
WHEN MATCHED THEN UPDATE SET t.sort_order = 910, t.color = 'rose', t.is_won = 0, t.is_lost = 1, t.active = 1, t.probability = 0, t.stale_days = NULL, t.description = 'Closed lost'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'retail', 'Lost', 910, 'rose', 0, 1, 1, 0, NULL, 'Closed lost');

-- SLO: Residential Lease Pipeline
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'SLO') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'New')
WHEN MATCHED THEN UPDATE SET t.sort_order = 10, t.color = 'slate', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 10, t.stale_days = 7, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'New', 10, 'slate', 0, 0, 1, 10, 7, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'SLO') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Qualified')
WHEN MATCHED THEN UPDATE SET t.sort_order = 20, t.color = 'sky', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 30, t.stale_days = 7, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Qualified', 20, 'sky', 0, 0, 1, 30, 7, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'SLO') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Tour')
WHEN MATCHED THEN UPDATE SET t.sort_order = 30, t.color = 'blue', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 50, t.stale_days = 7, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Tour', 30, 'blue', 0, 0, 1, 50, 7, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'SLO') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Proposal')
WHEN MATCHED THEN UPDATE SET t.sort_order = 40, t.color = 'indigo', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 60, t.stale_days = 7, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Proposal', 40, 'indigo', 0, 0, 1, 60, 7, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'SLO') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Negotiation')
WHEN MATCHED THEN UPDATE SET t.sort_order = 50, t.color = 'violet', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 70, t.stale_days = 7, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Negotiation', 50, 'violet', 0, 0, 1, 70, 7, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'SLO') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Contracting')
WHEN MATCHED THEN UPDATE SET t.sort_order = 60, t.color = 'amber', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 90, t.stale_days = 7, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Contracting', 60, 'amber', 0, 0, 1, 90, 7, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'SLO') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Won')
WHEN MATCHED THEN UPDATE SET t.sort_order = 900, t.color = 'emerald', t.is_won = 1, t.is_lost = 0, t.active = 1, t.probability = 100, t.stale_days = NULL, t.description = 'Closed won'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Won', 900, 'emerald', 1, 0, 1, 100, NULL, 'Closed won');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'SLO') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Lost')
WHEN MATCHED THEN UPDATE SET t.sort_order = 910, t.color = 'rose', t.is_won = 0, t.is_lost = 1, t.active = 1, t.probability = 0, t.stale_days = NULL, t.description = 'Closed lost'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Lost', 910, 'rose', 0, 1, 1, 0, NULL, 'Closed lost');

-- GRV: Gravita Lease Pipeline
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'GRV') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Later this Year')
WHEN MATCHED THEN UPDATE SET t.sort_order = 10, t.color = 'slate', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 10, t.stale_days = 30, t.description = 'Customers to be contacted later this Year'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Later this Year', 10, 'slate', 0, 0, 1, 10, 30, 'Customers to be contacted later this Year');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'GRV') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'New')
WHEN MATCHED THEN UPDATE SET t.sort_order = 20, t.color = 'sky', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 20, t.stale_days = 20, t.description = 'New Customer'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'New', 20, 'sky', 0, 0, 1, 20, 20, 'New Customer');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'GRV') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Meeting')
WHEN MATCHED THEN UPDATE SET t.sort_order = 30, t.color = 'blue', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 50, t.stale_days = 15, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Meeting', 30, 'blue', 0, 0, 1, 50, 15, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'GRV') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Proposal')
WHEN MATCHED THEN UPDATE SET t.sort_order = 40, t.color = 'indigo', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 60, t.stale_days = 10, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Proposal', 40, 'indigo', 0, 0, 1, 60, 10, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'GRV') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Negotiation')
WHEN MATCHED THEN UPDATE SET t.sort_order = 50, t.color = 'violet', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 70, t.stale_days = 7, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Negotiation', 50, 'violet', 0, 0, 1, 70, 7, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'GRV') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Contracting')
WHEN MATCHED THEN UPDATE SET t.sort_order = 60, t.color = 'amber', t.is_won = 0, t.is_lost = 0, t.active = 1, t.probability = 90, t.stale_days = 5, t.description = NULL
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Contracting', 60, 'amber', 0, 0, 1, 90, 5, NULL);
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'GRV') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Won')
WHEN MATCHED THEN UPDATE SET t.sort_order = 900, t.color = 'emerald', t.is_won = 1, t.is_lost = 0, t.active = 1, t.probability = 100, t.stale_days = NULL, t.description = 'Closed won'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Won', 900, 'emerald', 1, 0, 1, 100, NULL, 'Closed won');
MERGE INTO entity_stages t USING (SELECT id entity_id FROM entities WHERE code = 'GRV') s
  ON (t.entity_id = s.entity_id AND t.pipeline_code = 'lease' AND t.name = 'Lost')
WHEN MATCHED THEN UPDATE SET t.sort_order = 910, t.color = 'rose', t.is_won = 0, t.is_lost = 1, t.active = 1, t.probability = 0, t.stale_days = NULL, t.description = 'Closed lost'
WHEN NOT MATCHED THEN INSERT (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active, probability, stale_days, description)
  VALUES (s.entity_id, 'lease', 'Lost', 910, 'rose', 0, 1, 1, 0, NULL, 'Closed lost');

-- Lost reasons (same list as Capsule)
MERGE INTO lost_reasons t USING (SELECT 'Became Stale - Not Responsive' name FROM dual) s ON (t.name = s.name)
WHEN NOT MATCHED THEN INSERT (name, sort_order) VALUES (s.name, 10);
MERGE INTO lost_reasons t USING (SELECT 'Budget too low' name FROM dual) s ON (t.name = s.name)
WHEN NOT MATCHED THEN INSERT (name, sort_order) VALUES (s.name, 20);
MERGE INTO lost_reasons t USING (SELECT 'Closed Jeddah Office' name FROM dual) s ON (t.name = s.name)
WHEN NOT MATCHED THEN INSERT (name, sort_order) VALUES (s.name, 30);
MERGE INTO lost_reasons t USING (SELECT 'Direction Changed - Canceled the move' name FROM dual) s ON (t.name = s.name)
WHEN NOT MATCHED THEN INSERT (name, sort_order) VALUES (s.name, 40);
MERGE INTO lost_reasons t USING (SELECT 'Price too high' name FROM dual) s ON (t.name = s.name)
WHEN NOT MATCHED THEN INSERT (name, sort_order) VALUES (s.name, 50);
MERGE INTO lost_reasons t USING (SELECT 'Termination' name FROM dual) s ON (t.name = s.name)
WHEN NOT MATCHED THEN INSERT (name, sort_order) VALUES (s.name, 60);
MERGE INTO lost_reasons t USING (SELECT 'Went to a Competitor' name FROM dual) s ON (t.name = s.name)
WHEN NOT MATCHED THEN INSERT (name, sort_order) VALUES (s.name, 70);

COMMIT;

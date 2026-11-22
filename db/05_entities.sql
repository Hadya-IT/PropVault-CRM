-- Hadya CRM — remaining entities HOMCO, Movenpick, H-Gourmet (Phase 2-4). Safe to re-run.
--   node scripts/run-sql.js ../db/05_entities.sql

-- ===== HMC: HOMCO =====
MERGE INTO entities t USING (SELECT 'HMC' code FROM dual) s ON (t.code = s.code)
WHEN MATCHED THEN UPDATE SET t.name='HOMCO', t.industry='Sales', t.color='rose', t.city='Jeddah', t.sort_order=4, t.active=1
WHEN NOT MATCHED THEN INSERT (code,name,industry,color,city,sort_order) VALUES ('HMC','HOMCO','Sales','rose','Jeddah',4);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.slug='overview')
WHEN MATCHED THEN UPDATE SET t.module_code='overview', t.label='HOMCO Overview', t.sort_order=10, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'overview','overview','HOMCO Overview',10,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.slug='properties')
WHEN MATCHED THEN UPDATE SET t.module_code='units', t.label='Properties', t.sort_order=20, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'units','properties','Properties',20,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.slug='sales-leads')
WHEN MATCHED THEN UPDATE SET t.module_code='leads', t.label='Sales Leads', t.sort_order=30, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'leads','sales-leads','Sales Leads',30,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.slug='pipeline')
WHEN MATCHED THEN UPDATE SET t.module_code='pipeline', t.label='Pipeline', t.sort_order=40, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'pipeline','pipeline','Pipeline',40,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.slug='activities')
WHEN MATCHED THEN UPDATE SET t.module_code='activities', t.label='Activities', t.sort_order=50, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'activities','activities','Activities',50,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.slug='deals')
WHEN MATCHED THEN UPDATE SET t.module_code='deals', t.label='Deals', t.sort_order=60, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'deals','deals','Deals',60,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.slug='customer-experience')
WHEN MATCHED THEN UPDATE SET t.module_code='cx', t.label='Customer Experience', t.sort_order=70, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'cx','customer-experience','Customer Experience',70,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.slug='reports')
WHEN MATCHED THEN UPDATE SET t.module_code='reports', t.label='Reports & Export', t.sort_order=80, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'reports','reports','Reports & Export',80,NULL);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.pipeline_code='sales' AND t.name='Lead')
WHEN MATCHED THEN UPDATE SET t.sort_order=10, t.color='slate', t.is_won=0, t.is_lost=0, t.active=1, t.probability=10
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'sales','Lead',10,'slate',0,0,1,10);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.pipeline_code='sales' AND t.name='Qualified Lead')
WHEN MATCHED THEN UPDATE SET t.sort_order=20, t.color='sky', t.is_won=0, t.is_lost=0, t.active=1, t.probability=30
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'sales','Qualified Lead',20,'sky',0,0,1,30);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.pipeline_code='sales' AND t.name='Meeting')
WHEN MATCHED THEN UPDATE SET t.sort_order=30, t.color='blue', t.is_won=0, t.is_lost=0, t.active=1, t.probability=50
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'sales','Meeting',30,'blue',0,0,1,50);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.pipeline_code='sales' AND t.name='Offer')
WHEN MATCHED THEN UPDATE SET t.sort_order=40, t.color='indigo', t.is_won=0, t.is_lost=0, t.active=1, t.probability=60
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'sales','Offer',40,'indigo',0,0,1,60);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.pipeline_code='sales' AND t.name='Negotiation')
WHEN MATCHED THEN UPDATE SET t.sort_order=50, t.color='violet', t.is_won=0, t.is_lost=0, t.active=1, t.probability=70
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'sales','Negotiation',50,'violet',0,0,1,70);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.pipeline_code='sales' AND t.name='Contracting')
WHEN MATCHED THEN UPDATE SET t.sort_order=60, t.color='amber', t.is_won=0, t.is_lost=0, t.active=1, t.probability=90
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'sales','Contracting',60,'amber',0,0,1,90);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.pipeline_code='sales' AND t.name='Won')
WHEN MATCHED THEN UPDATE SET t.sort_order=900, t.color='emerald', t.is_won=1, t.is_lost=0, t.active=1, t.probability=100
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'sales','Won',900,'emerald',1,0,1,100);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HMC') s ON (t.entity_id=s.eid AND t.pipeline_code='sales' AND t.name='Lost')
WHEN MATCHED THEN UPDATE SET t.sort_order=910, t.color='rose', t.is_won=0, t.is_lost=1, t.active=1, t.probability=0
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'sales','Lost',910,'rose',0,1,1,0);

-- ===== MVP: Movenpick =====
MERGE INTO entities t USING (SELECT 'MVP' code FROM dual) s ON (t.code = s.code)
WHEN MATCHED THEN UPDATE SET t.name='Movenpick', t.industry='Hotel & Hospitality', t.color='cyan', t.city='Jeddah', t.sort_order=5, t.active=1
WHEN NOT MATCHED THEN INSERT (code,name,industry,color,city,sort_order) VALUES ('MVP','Movenpick','Hotel & Hospitality','cyan','Jeddah',5);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.slug='overview')
WHEN MATCHED THEN UPDATE SET t.module_code='overview', t.label='MVP Overview', t.sort_order=10, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'overview','overview','MVP Overview',10,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.slug='rooms')
WHEN MATCHED THEN UPDATE SET t.module_code='units', t.label='Rooms & Venues', t.sort_order=20, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'units','rooms','Rooms & Venues',20,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.slug='event-leads')
WHEN MATCHED THEN UPDATE SET t.module_code='leads', t.label='Event & Group Leads', t.sort_order=30, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'leads','event-leads','Event & Group Leads',30,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.slug='pipeline')
WHEN MATCHED THEN UPDATE SET t.module_code='pipeline', t.label='Pipeline', t.sort_order=40, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'pipeline','pipeline','Pipeline',40,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.slug='bookings')
WHEN MATCHED THEN UPDATE SET t.module_code='bookings', t.label='Reservations', t.sort_order=50, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'bookings','bookings','Reservations',50,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.slug='events')
WHEN MATCHED THEN UPDATE SET t.module_code='events', t.label='Events', t.sort_order=60, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'events','events','Events',60,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.slug='customer-experience')
WHEN MATCHED THEN UPDATE SET t.module_code='cx', t.label='Guest Experience', t.sort_order=70, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'cx','customer-experience','Guest Experience',70,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.slug='reports')
WHEN MATCHED THEN UPDATE SET t.module_code='reports', t.label='Reports & Export', t.sort_order=80, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'reports','reports','Reports & Export',80,NULL);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Enquiry')
WHEN MATCHED THEN UPDATE SET t.sort_order=10, t.color='slate', t.is_won=0, t.is_lost=0, t.active=1, t.probability=10
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Enquiry',10,'slate',0,0,1,10);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Site Visit')
WHEN MATCHED THEN UPDATE SET t.sort_order=20, t.color='sky', t.is_won=0, t.is_lost=0, t.active=1, t.probability=40
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Site Visit',20,'sky',0,0,1,40);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Proposal')
WHEN MATCHED THEN UPDATE SET t.sort_order=30, t.color='blue', t.is_won=0, t.is_lost=0, t.active=1, t.probability=60
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Proposal',30,'blue',0,0,1,60);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Negotiation')
WHEN MATCHED THEN UPDATE SET t.sort_order=40, t.color='indigo', t.is_won=0, t.is_lost=0, t.active=1, t.probability=75
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Negotiation',40,'indigo',0,0,1,75);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Confirmed')
WHEN MATCHED THEN UPDATE SET t.sort_order=50, t.color='violet', t.is_won=0, t.is_lost=0, t.active=1, t.probability=95
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Confirmed',50,'violet',0,0,1,95);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Won')
WHEN MATCHED THEN UPDATE SET t.sort_order=900, t.color='emerald', t.is_won=1, t.is_lost=0, t.active=1, t.probability=100
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Won',900,'emerald',1,0,1,100);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='MVP') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Lost')
WHEN MATCHED THEN UPDATE SET t.sort_order=910, t.color='rose', t.is_won=0, t.is_lost=1, t.active=1, t.probability=0
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Lost',910,'rose',0,1,1,0);

-- ===== HGR: H-Gourmet =====
MERGE INTO entities t USING (SELECT 'HGR' code FROM dual) s ON (t.code = s.code)
WHEN MATCHED THEN UPDATE SET t.name='H-Gourmet', t.industry='Catering & Food', t.color='orange', t.city='Jeddah', t.sort_order=6, t.active=1
WHEN NOT MATCHED THEN INSERT (code,name,industry,color,city,sort_order) VALUES ('HGR','H-Gourmet','Catering & Food','orange','Jeddah',6);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.slug='overview')
WHEN MATCHED THEN UPDATE SET t.module_code='overview', t.label='HGR Overview', t.sort_order=10, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'overview','overview','HGR Overview',10,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.slug='catering-leads')
WHEN MATCHED THEN UPDATE SET t.module_code='leads', t.label='Catering Leads', t.sort_order=20, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'leads','catering-leads','Catering Leads',20,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.slug='pipeline')
WHEN MATCHED THEN UPDATE SET t.module_code='pipeline', t.label='Pipeline', t.sort_order=30, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'pipeline','pipeline','Pipeline',30,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.slug='activities')
WHEN MATCHED THEN UPDATE SET t.module_code='activities', t.label='Activities', t.sort_order=40, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'activities','activities','Activities',40,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.slug='deals')
WHEN MATCHED THEN UPDATE SET t.module_code='deals', t.label='Orders & Contracts', t.sort_order=50, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'deals','deals','Orders & Contracts',50,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.slug='customer-experience')
WHEN MATCHED THEN UPDATE SET t.module_code='cx', t.label='Customer Experience', t.sort_order=60, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'cx','customer-experience','Customer Experience',60,NULL);
MERGE INTO entity_modules t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.slug='reports')
WHEN MATCHED THEN UPDATE SET t.module_code='reports', t.label='Reports & Export', t.sort_order=70, t.enabled=1, t.filter_config=NULL
WHEN NOT MATCHED THEN INSERT (entity_id,module_code,slug,label,sort_order,filter_config) VALUES (s.eid,'reports','reports','Reports & Export',70,NULL);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Enquiry')
WHEN MATCHED THEN UPDATE SET t.sort_order=10, t.color='slate', t.is_won=0, t.is_lost=0, t.active=1, t.probability=10
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Enquiry',10,'slate',0,0,1,10);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Tasting')
WHEN MATCHED THEN UPDATE SET t.sort_order=20, t.color='sky', t.is_won=0, t.is_lost=0, t.active=1, t.probability=40
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Tasting',20,'sky',0,0,1,40);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Quotation')
WHEN MATCHED THEN UPDATE SET t.sort_order=30, t.color='blue', t.is_won=0, t.is_lost=0, t.active=1, t.probability=60
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Quotation',30,'blue',0,0,1,60);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Negotiation')
WHEN MATCHED THEN UPDATE SET t.sort_order=40, t.color='indigo', t.is_won=0, t.is_lost=0, t.active=1, t.probability=75
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Negotiation',40,'indigo',0,0,1,75);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Confirmed')
WHEN MATCHED THEN UPDATE SET t.sort_order=50, t.color='violet', t.is_won=0, t.is_lost=0, t.active=1, t.probability=95
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Confirmed',50,'violet',0,0,1,95);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Won')
WHEN MATCHED THEN UPDATE SET t.sort_order=900, t.color='emerald', t.is_won=1, t.is_lost=0, t.active=1, t.probability=100
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Won',900,'emerald',1,0,1,100);
MERGE INTO entity_stages t USING (SELECT e.id eid FROM entities e WHERE e.code='HGR') s ON (t.entity_id=s.eid AND t.pipeline_code='lease' AND t.name='Lost')
WHEN MATCHED THEN UPDATE SET t.sort_order=910, t.color='rose', t.is_won=0, t.is_lost=1, t.active=1, t.probability=0
WHEN NOT MATCHED THEN INSERT (entity_id,pipeline_code,name,sort_order,color,is_won,is_lost,active,probability) VALUES (s.eid,'lease','Lost',910,'rose',0,1,1,0);

COMMIT;
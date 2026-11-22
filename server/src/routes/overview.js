import { Router } from 'express';
import { ah, forbidden } from '../lib/errors.js';
import { query } from '../db.js';
import { canAccess, visibleEntityIds } from '../auth/authz.js';
import { requireEntity } from '../middleware/auth.js';

const n = (v) => Number(v || 0);
const OCCUPIED = `('Leased','Occupied')`;
const ANNUAL = `NVL(rent_amount,0) * CASE rent_period WHEN 'month' THEN 12 WHEN 'day' THEN 365 ELSE 1 END`;

/**
 * Dashboard data, computed in the database, limited to entities the user may see
 * and where the overview module is viewable.
 */
export function overviewRoutes() {
  const r = Router();

  // ---------- Group overview ----------
  r.get('/overview', ah(async (req, res) => {
    const ctx = req.ctx;
    const vis = visibleEntityIds(ctx);
    const { rows: ents } = await query(`SELECT id, code, name, industry, color FROM entities WHERE active = 1 ORDER BY sort_order, name`);
    const allowed = ents.filter((e) => (vis === 'all' || vis.includes(e.id)) && canAccess(ctx, e.id, 'overview', 'view'));
    if (!allowed.length) return res.json({ entities: [], sources: [], stages: [], quality: [] });

    const binds = Object.fromEntries(allowed.map((e, i) => [`e${i}`, e.id]));
    const IN = allowed.map((_, i) => `:e${i}`).join(',');

    const [units, leads, members, maint, sources, stages, quality] = await Promise.all([
      query(`SELECT entity_id, category, COUNT(*) total, SUM(CASE WHEN status IN ${OCCUPIED} THEN 1 ELSE 0 END) occupied,
                    SUM(CASE WHEN status IN ${OCCUPIED} THEN ${ANNUAL} ELSE 0 END) annual_rent
               FROM units WHERE deleted_at IS NULL AND entity_id IN (${IN}) GROUP BY entity_id, category`, binds),
      query(`SELECT l.entity_id, COUNT(*) total, SUM(l.value_amount) pipeline, ROUND(AVG(l.score)) avg_score,
                    SUM(CASE WHEN s.is_won = 1 THEN 1 ELSE 0 END) won, SUM(CASE WHEN s.is_won = 1 THEN l.value_amount ELSE 0 END) won_value
               FROM leads l LEFT JOIN entity_stages s ON s.id = l.stage_id
              WHERE l.deleted_at IS NULL AND NVL(s.is_lost,0) = 0 AND l.entity_id IN (${IN}) GROUP BY l.entity_id`, binds),
      query(`SELECT entity_id, SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) active, COUNT(*) total,
                    SUM(CASE WHEN status = 'Active' THEN NVL(mrr_amount,0) ELSE 0 END) mrr, ROUND(AVG(nps),1) nps
               FROM contacts WHERE deleted_at IS NULL AND entity_id IN (${IN}) GROUP BY entity_id`, binds),
      query(`SELECT entity_id, COUNT(*) open FROM maintenance_requests
              WHERE deleted_at IS NULL AND status NOT IN ('Resolved','Closed') AND entity_id IN (${IN}) GROUP BY entity_id`, binds),
      query(`SELECT entity_id, NVL(lead_source,'Other') source, COUNT(*) cnt FROM leads
              WHERE deleted_at IS NULL AND entity_id IN (${IN}) GROUP BY entity_id, NVL(lead_source,'Other')`, binds),
      query(`SELECT s.entity_id, s.name, MIN(s.sort_order) sort_order, MIN(s.color) color, COUNT(l.id) cnt
               FROM entity_stages s LEFT JOIN leads l ON l.stage_id = s.id AND l.deleted_at IS NULL
              WHERE s.active = 1 AND s.is_lost = 0 AND s.entity_id IN (${IN})
              GROUP BY s.entity_id, s.name`, binds),
      query(`SELECT l.entity_id, NVL(l.quality_owner,'Unassigned') owner, COUNT(*) cnt, SUM(l.value_amount) pipeline,
                    SUM(CASE WHEN s.is_won = 1 THEN 1 ELSE 0 END) won
               FROM leads l LEFT JOIN entity_stages s ON s.id = l.stage_id
              WHERE l.deleted_at IS NULL AND l.entity_id IN (${IN}) GROUP BY l.entity_id, NVL(l.quality_owner,'Unassigned')`, binds),
    ]);

    const by = (rows) => Object.fromEntries(rows.rows.map((x) => [x.entity_id, x]));
    const L = by(leads), M = by(members), X = by(maint);
    const entities = allowed.map((e) => {
      const cats = units.rows.filter((u) => u.entity_id === e.id);
      const total = cats.reduce((s, c) => s + n(c.total), 0);
      const occ = cats.reduce((s, c) => s + n(c.occupied), 0);
      const l = L[e.id] || {}, m = M[e.id] || {};
      return {
        id: e.id, code: e.code, name: e.name, industry: e.industry, color: e.color,
        units: total, occupied: occ, occupancy: total ? Math.round((occ / total) * 100) : 0,
        annualRent: cats.reduce((s, c) => s + n(c.annual_rent), 0),
        categories: cats.map((c) => ({ category: c.category, total: n(c.total), occupied: n(c.occupied),
          occupancy: n(c.total) ? Math.round((n(c.occupied) / n(c.total)) * 100) : 0 })),
        leads: n(l.total), pipeline: n(l.pipeline), won: n(l.won), wonValue: n(l.won_value), avgScore: n(l.avg_score),
        activeMembers: n(m.active), members: n(m.total), mrr: n(m.mrr), nps: m.nps == null ? null : Number(m.nps),
        openMaintenance: n((X[e.id] || {}).open),
      };
    });

    res.json({
      entities,
      sources: sources.rows.map((s) => ({ entityId: s.entity_id, source: s.source, count: n(s.cnt) })),
      stages: stages.rows.map((s) => ({ entityId: s.entity_id, name: s.name, order: n(s.sort_order), color: s.color, count: n(s.cnt) })),
      quality: quality.rows.map((q) => ({ entityId: q.entity_id, owner: q.owner, count: n(q.cnt), pipeline: n(q.pipeline), won: n(q.won) })),
    });
  }));

  // ---------- Single entity overview ----------
  r.get('/entities/:entityCode/summary', requireEntity, ah(async (req, res) => {
    const id = req.entity.id;
    if (!canAccess(req.ctx, id, 'overview', 'view')) throw forbidden();
    const b = { id };
    const [byStatus, byFloor, leads, members, bookings, maint, mix, mrrByPlan, deals] = await Promise.all([
      query(`SELECT category, status, COUNT(*) cnt, SUM(${ANNUAL}) rent FROM units WHERE deleted_at IS NULL AND entity_id = :id GROUP BY category, status`, b),
      query(`SELECT * FROM (SELECT NVL(floor,'—') floor, SUM(${ANNUAL}) rent FROM units
              WHERE deleted_at IS NULL AND entity_id = :id AND status IN ${OCCUPIED} GROUP BY NVL(floor,'—') ORDER BY 2 DESC) WHERE ROWNUM <= 8`, b),
      query(`SELECT * FROM (SELECT l.id, l.name, l.category, l.value_amount, l.score, s.name stage, s.color
               FROM leads l LEFT JOIN entity_stages s ON s.id = l.stage_id
              WHERE l.deleted_at IS NULL AND l.entity_id = :id AND NVL(s.is_lost,0) = 0 AND NVL(s.is_won,0) = 0
              ORDER BY l.created_at DESC) WHERE ROWNUM <= 6`, b),
      query(`SELECT * FROM (SELECT id, name, company, plan, mrr_amount, nps, TO_CHAR(renewal_date,'YYYY-MM-DD') renewal_date
               FROM contacts WHERE deleted_at IS NULL AND entity_id = :id AND status = 'Active' ORDER BY NVL(mrr_amount,0) DESC) WHERE ROWNUM <= 6`, b),
      query(`SELECT * FROM (SELECT bk.id, u.name unit_name, c.name contact_name, bk.starts_at, bk.ends_at, bk.total_amount, bk.status
               FROM bookings bk JOIN units u ON u.id = bk.unit_id LEFT JOIN contacts c ON c.id = bk.contact_id
              WHERE bk.deleted_at IS NULL AND bk.entity_id = :id AND bk.ends_at >= SYSTIMESTAMP ORDER BY bk.starts_at) WHERE ROWNUM <= 6`, b),
      query(`SELECT priority, COUNT(*) cnt FROM maintenance_requests WHERE deleted_at IS NULL AND entity_id = :id AND status NOT IN ('Resolved','Closed') GROUP BY priority`, b),
      query(`SELECT NVL(JSON_VALUE(attrs,'$.member_type'), NVL(contact_type,'Other')) mtype, COUNT(*) cnt FROM contacts
              WHERE deleted_at IS NULL AND entity_id = :id AND status = 'Active' GROUP BY NVL(JSON_VALUE(attrs,'$.member_type'), NVL(contact_type,'Other'))`, b),
      query(`SELECT NVL(unit_type,'Other') utype, SUM(${ANNUAL}) rent FROM units WHERE deleted_at IS NULL AND entity_id = :id AND status IN ${OCCUPIED} GROUP BY NVL(unit_type,'Other')`, b),
      query(`SELECT status, COUNT(*) cnt, SUM(amount) amount FROM deals WHERE deleted_at IS NULL AND entity_id = :id GROUP BY status`, b),
    ]);

    res.json({
      entity: req.entity,
      units: byStatus.rows.map((x) => ({ category: x.category, status: x.status, count: n(x.cnt), rent: n(x.rent) })),
      revenueByFloor: byFloor.rows.map((x) => ({ floor: x.floor, rent: n(x.rent) })),
      leads: leads.rows.map((x) => ({ id: x.id, name: x.name, category: x.category, value: n(x.value_amount), score: n(x.score), stage: x.stage, color: x.color })),
      members: members.rows.map((x) => ({ ...x, mrr_amount: n(x.mrr_amount) })),
      bookings: bookings.rows.map((x) => ({ ...x, total_amount: n(x.total_amount) })),
      maintenance: maint.rows.map((x) => ({ priority: x.priority, count: n(x.cnt) })),
      memberMix: mix.rows.map((x) => ({ type: x.mtype, count: n(x.cnt) })),
      rentByType: mrrByPlan.rows.map((x) => ({ type: x.utype, rent: n(x.rent) })),
      deals: deals.rows.map((x) => ({ status: x.status, count: n(x.cnt), amount: n(x.amount) })),
    });
  }));

  return r;
}
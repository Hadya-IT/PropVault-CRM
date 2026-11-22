import { useEffect, useMemo, useState } from 'react';
import { api, qs } from '../lib/api';
import { useUI } from '../store/ui';
import { MODULE_DEFS } from './defs';
import { Button, Card, Empty, Kpi, PageHeader, Spinner, cx } from '../components/ui';
import { sar } from '../pages/GroupOverview';

const EXPORTABLE = ['leads', 'units', 'deals', 'customers', 'activities', 'cx', 'maintenance', 'bookings', 'events'];
const csvCell = (v) => {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Reports & Export: per-entity KPIs plus a one-click CSV download for every module. */
export default function ReportsView({ entity, mod, meta }) {
  const notify = useUI((s) => s.notify);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const modules = useMemo(
    () => entity.modules.filter((m) => EXPORTABLE.includes(m.module) && MODULE_DEFS[m.module]),
    [entity.modules],
  );
  const leadsMod = modules.find((m) => m.module === 'leads');
  const stageById = useMemo(() => Object.fromEntries(meta.stages.map((s) => [s.id, s])), [meta.stages]);
  const userById = useMemo(() => Object.fromEntries(meta.users.map((u) => [u.id, u.name])), [meta.users]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(modules.map((m) =>
      api.get(`/e/${entity.code}/m/${m.slug}/records/stats`).then((s) => [m.slug, s]).catch(() => [m.slug, null]),
    )).then((pairs) => { if (alive) { setStats(Object.fromEntries(pairs)); setLoading(false); } });
    return () => { alive = false; };
  }, [entity.code, modules]);

  // Headline KPIs from the leads module (pipeline value, won via won stages).
  const lead = leadsMod && stats[leadsMod.slug];
  const wonIds = new Set(meta.stages.filter((s) => s.is_won).map((s) => s.id));
  const headline = lead ? [
    { label: 'Total Leads', value: lead.total, sub: 'In scope', tone: 'blue' },
    { label: 'Pipeline Value', value: sar(lead.sums?.value_amount || 0), sub: 'All open + closed', tone: 'gold' },
    { label: 'Avg Score', value: lead.avgScore ?? '—', sub: 'Out of 100', tone: 'green' },
    { label: 'Pipeline Stages', value: meta.stages.filter((s) => !s.is_lost).length, sub: 'Configured', tone: 'purple' },
  ] : null;

  const exportCsv = async (m) => {
    setBusy(m.slug);
    try {
      const def = MODULE_DEFS[m.module];
      const base = `/e/${entity.code}/m/${m.slug}/records`;
      const rows = [];
      for (let page = 1; page <= 200; page++) {
        const r = await api.get(`${base}${qs({ page, pageSize: 100 })}`);
        rows.push(...r.data);
        if (rows.length >= r.total || r.data.length === 0) break;
      }
      const cols = def.columns;
      const header = cols.map((c) => c.label);
      const lines = [header.map(csvCell).join(',')];
      for (const row of rows) {
        lines.push(cols.map((c) => {
          let v = row[c.key];
          if (c.type === 'stage') v = stageById[v]?.name ?? '';
          else if (c.type === 'user') v = userById[v] ?? '';
          else if (c.type === 'date') v = v ? String(v).slice(0, 10) : '';
          else if (c.type === 'datetime') v = v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '';
          else if (c.type === 'bool') v = v ? 'Yes' : 'No';
          return csvCell(v);
        }).join(','));
      }
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity.code}-${m.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      notify(`Exported ${rows.length} ${m.label.toLowerCase()} rows`);
    } catch (e) {
      notify(e.message, 'error');
    } finally { setBusy(null); }
  };

  return (
    <div>
      <PageHeader
        title="Reports & Export"
        subtitle={`${entity.name} · download any module as CSV`}
        actions={<Button variant="secondary" onClick={() => window.print()}>Print</Button>}
      />

      {loading ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : (
        <>
          {headline && (
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {headline.map((k) => <Kpi key={k.label} label={k.label} value={k.value} sub={k.sub} tone={k.tone} />)}
            </div>
          )}

          <h3 className="mb-2.5 text-[13px] font-bold tracking-[.04em] text-pv-navy uppercase">Export data</h3>
          {modules.length === 0 ? (
            <Empty title="Nothing to export">This entity has no data modules assigned.</Empty>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((m) => {
                const st = stats[m.slug];
                return (
                  <Card key={m.slug} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-pv-text">{m.label}</p>
                      <p className="text-xs text-pv-text3">{st ? `${st.total.toLocaleString()} records` : '—'}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy === m.slug || !st?.total}
                      onClick={() => exportCsv(m)}
                      className={cx('shrink-0 rounded-lg border-[1.5px] px-3 py-1.5 text-xs font-bold transition',
                        busy === m.slug ? 'border-pv-border bg-pv-bg text-pv-text4' : 'border-pv-accent bg-pv-sky text-pv-accent hover:bg-pv-accent hover:text-white',
                        !st?.total && 'opacity-40')}
                    >
                      {busy === m.slug ? 'Exporting…' : 'Download CSV'}
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
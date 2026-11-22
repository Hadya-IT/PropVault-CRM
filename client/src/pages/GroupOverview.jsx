import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { color } from '../lib/colors';
import { Bar, Card, Kpi, SectionTitle, Spinner, TONE, cx } from '../components/ui';

export const sar = (v) => {
  const n = Number(v || 0);
  if (n >= 1e6) return `SAR ${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `SAR ${Math.round(n / 1e3)}K`;
  return `SAR ${Math.round(n)}`;
};
const short = (v) => sar(v).replace('SAR ', '');

// Stage position → colour (prototype: blue → orange → green across the pipeline)
const stageTone = (i, n) => (i < n * 0.34 ? 'blue' : i < n * 0.67 ? 'orange' : 'green');

function Metric({ value, label, tone }) {
  return (
    <div>
      <p className={cx('text-[17px] font-extrabold', TONE[tone]?.text)}>{value}</p>
      <p className="text-[10px] text-pv-text4">{label}</p>
    </div>
  );
}

function EntityCard({ e, nav, onOpen }) {
  const c = color(e.color);
  const hasMembers = nav?.modules.some((m) => m.module === 'customers');
  const cats = [...e.categories].sort((a, b) => b.total - a.total);
  let metrics;
  let pct = e.occupancy;
  let footer = `${e.leads} leads · ${e.won} signed`;
  if (hasMembers) {
    metrics = [[e.activeMembers, 'Active Members', 'purple'], [short(e.mrr), 'MRR', 'gold'], [e.nps ?? '—', 'NPS', 'green']];
    pct = e.members ? Math.round((e.activeMembers / e.members) * 100) : e.occupancy;
    footer = `${e.leads} membership leads · ${e.units} spaces`;
  } else if (cats.filter((x) => x.total > 0).length >= 2) {
    const [a, b2] = cats.filter((x) => ['Office', 'Retail', 'Apartment', 'Space'].includes(x.category)).concat(cats).slice(0, 2);
    metrics = [[`${a.occupancy}%`, `${a.category} Occ.`, 'gold'], [`${b2.occupancy}%`, `${b2.category} Occ.`, 'green'], [short(e.annualRent), 'Annual Rev.', 'orange']];
  } else if (e.units > 0) {
    metrics = [[`${e.occupancy}%`, 'Occupancy', 'green'], [short(e.annualRent), 'Annual Rev.', 'gold'], [e.openMaintenance, 'Open Maint.', e.openMaintenance ? 'red' : 'green']];
    footer = `${e.leads} tenant leads · ${e.openMaintenance ? `${e.openMaintenance} open maintenance` : 'All maintenance clear'}`;
  } else {
    metrics = [[e.leads, 'Leads', 'blue'], [e.won, 'Closed', 'green'], [short(e.pipeline), 'Pipeline', 'gold']];
    pct = e.leads ? Math.round((e.won / e.leads) * 100) : 0;
    footer = `${pct}% conversion rate`;
  }
  return (
    <button type="button" onClick={onOpen}
      className={cx('rounded-xl border-[1.5px] border-l-4 border-pv-border bg-white px-[18px] py-4 text-left shadow-pv-sm transition hover:shadow-pv-md', c.borderL)}>
      <p className="text-[13px] font-extrabold text-pv-text">{e.name}</p>
      <p className="mb-2.5 text-[10px] text-pv-text3">{e.industry}</p>
      <div className="mb-2 grid grid-cols-3 gap-1.5">{metrics.map(([v, l, t]) => <Metric key={l} value={v} label={l} tone={t} />)}</div>
      <Bar pct={pct} className="h-1" fillClass={c.fill} />
      <p className="mt-1 text-[10px] text-pv-text3">{footer}</p>
    </button>
  );
}

export default function GroupOverview() {
  const { entities: nav } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(null); // null = all entities

  useEffect(() => { api.get('/overview').then(setData).catch((e) => setError(e.message)); }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const ents = tab ? data.entities.filter((e) => e.id === tab) : data.entities;
    const ids = new Set(ents.map((e) => e.id));
    const sum = (k) => ents.reduce((s, e) => s + (e[k] || 0), 0);
    const leads = sum('leads');
    const scoreW = ents.reduce((s, e) => s + e.avgScore * e.leads, 0);
    const sources = Object.entries(data.sources.filter((s) => ids.has(s.entityId)).reduce((m, s) => ({ ...m, [s.source]: (m[s.source] || 0) + s.count }), {})).sort((a, b) => b[1] - a[1]);
    let stages;
    if (tab) stages = data.stages.filter((s) => s.entityId === tab).sort((a, b) => a.order - b.order).map((s) => [s.name, s.count]);
    else {
      const agg = {};
      for (const s of data.stages) { agg[s.name] ??= { count: 0, order: s.order }; agg[s.name].count += s.count; agg[s.name].order = Math.min(agg[s.name].order, s.order); }
      stages = Object.entries(agg).sort((a, b) => a[1].order - b[1].order).slice(0, 10).map(([k, v]) => [k, v.count]);
    }
    const quality = ['Marketing', 'Leasing', 'Shared'].map((o) => {
      const rows = data.quality.filter((q) => ids.has(q.entityId) && q.owner === o);
      return { owner: o, count: rows.reduce((s, q) => s + q.count, 0), won: rows.reduce((s, q) => s + q.won, 0), pipeline: rows.reduce((s, q) => s + q.pipeline, 0) };
    });
    return {
      ents, leads, pipeline: sum('pipeline'), wonValue: sum('wonValue'), won: sum('won'),
      conv: leads ? Math.round((sum('won') / leads) * 100) : 0, score: leads ? Math.round(scoreW / leads) : 0,
      issues: sum('openMaintenance'), sources, stages, quality,
    };
  }, [data, tab]);

  if (error) return <p className="rounded-lg border-[1.5px] border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] font-semibold text-pv-red">{error}</p>;
  if (!data) return <div className="grid place-items-center py-20"><Spinner /></div>;

  const maxSrc = Math.max(1, ...view.sources.map((s) => s[1]));
  const maxStage = Math.max(1, ...view.stages.map((s) => s[1]));
  const tabs = [{ id: null, name: 'All Entities', leads: data.entities.reduce((s, e) => s + e.leads, 0), color: null }, ...data.entities.map((e) => ({ id: e.id, name: e.name, leads: e.leads, color: e.color }))];

  return (
    <div>
      {/* Entity tab row */}
      <div className="mb-5 flex flex-wrap overflow-hidden rounded-[10px] border border-pv-border bg-white" role="tablist">
        {tabs.map((t) => {
          const active = tab === t.id;
          const c = t.color ? color(t.color) : null;
          return (
            <button key={t.id ?? 'all'} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.id)}
              className={cx('min-w-[90px] flex-1 border-b-[3px] px-1.5 py-2.5 text-center transition',
                active ? cx('bg-pv-sky', c ? c.borderB : 'border-pv-accent') : 'border-transparent hover:bg-pv-bg')}>
              <p className={cx('text-[11px] font-bold', active ? (c ? c.text : 'text-pv-accent') : 'text-pv-text3')}>{t.name}</p>
              <p className={cx('text-lg font-extrabold', active ? (c ? c.text : 'text-pv-accent') : 'text-pv-text')}>{t.leads}</p>
              <p className="text-[10px] text-pv-text4">leads</p>
            </button>
          );
        })}
      </div>

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total Leads" value={view.leads} sub="In scope" tone="blue" />
        <Kpi label="Pipeline Value" value={sar(view.pipeline)} sub="Active deals" tone="gold" />
        <Kpi label="Revenue Won" value={sar(view.wonValue)} sub="Closed deals" tone="green" />
        <Kpi label="Conversion Rate" value={`${view.conv}%`} sub="Lead to closed" tone="purple" />
        <Kpi label="Avg Lead Score" value={view.score} sub="Out of 100" tone="orange" />
        <Kpi label="Open Issues" value={view.issues} sub="Maintenance + alerts" tone={view.issues ? 'red' : 'green'} />
      </div>

      {/* Entity performance */}
      {!tab && data.entities.length > 0 && (
        <>
          <p className="mb-3 border-b-2 border-pv-navy pb-2 text-sm font-extrabold text-pv-navy">Entity Performance</p>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.entities.map((e) => {
              const n = nav.find((x) => x.id === e.id);
              return <EntityCard key={e.id} e={e} nav={n} onOpen={() => setTab(e.id)} />;
            })}
          </div>
        </>
      )}
      {tab && (() => {
        const n = nav.find((x) => x.id === tab);
        const first = n?.modules.find((m) => m.module === 'overview') || n?.modules[0];
        return first ? (
          <div className="mb-5 flex justify-end">
            <button type="button" onClick={() => navigate(`/e/${n.code}/${first.slug}`)} className="rounded-lg bg-pv-accent px-4 py-2 text-[13px] font-bold text-white hover:bg-pv-accent2">Open {n.name} →</button>
          </div>
        ) : null;
      })()}

      {/* Analytics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <SectionTitle className="text-pv-navy">Lead Sources</SectionTitle>
          {view.sources.length === 0 && <p className="text-xs text-pv-text4">No leads yet.</p>}
          <div className="space-y-2.5">
            {view.sources.map(([s, n]) => (
              <div key={s} className="grid grid-cols-[88px_1fr_24px] items-center gap-3 text-[13px] text-pv-text2">
                <span className="truncate">{s}</span><Bar pct={(n / maxSrc) * 100} className="h-1.5" /><span className="text-right font-bold text-pv-accent">{n}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle className="text-pv-navy">Pipeline Funnel</SectionTitle>
          {view.stages.length === 0 && <p className="text-xs text-pv-text4">No stages configured.</p>}
          <div className="space-y-2">
            {view.stages.map(([s, n], i) => {
              const t = stageTone(i, view.stages.length);
              return (
                <div key={s}>
                  <div className="flex justify-between text-xs"><span className={cx('font-semibold', TONE[t].text)}>{s}</span><span className="text-pv-text3">{n}</span></div>
                  <Bar pct={n ? Math.max(8, (n / maxStage) * 100) : 0} tone={t} className="h-1" />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle className="text-pv-navy">Marketing vs Leasing</SectionTitle>
          <div className="space-y-4">
            {view.quality.map((q, i) => {
              const tone = ['purple', 'blue', 'gold'][i];
              const pct = view.leads ? Math.round((q.count / view.leads) * 100) : 0;
              return (
                <div key={q.owner}>
                  <div className="flex justify-between text-xs"><span className={cx('text-[13px] font-bold', TONE[tone].text)}>{q.owner}</span><span className="text-pv-text3">{q.count} leads · {q.won} won</span></div>
                  <Bar pct={pct} tone={tone} className="h-1.5" />
                  <p className="mt-0.5 text-[10px] text-pv-text4">{pct}% of total · {sar(q.pipeline)} pipeline</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
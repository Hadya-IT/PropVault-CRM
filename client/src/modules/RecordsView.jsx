import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../lib/api';
import { useUI } from '../store/ui';
import { color } from '../lib/colors';
import { Badge, Bar, Button, Card, Empty, Field, Input, Kpi, Modal, PageHeader, SegTabs, Select, Spinner, Textarea, Toggle, cx, toneOf } from '../components/ui';

const fmtMoney = (v) => (v == null ? '—' : `SAR ${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
const fmtDate = (v) => (v ? String(v).slice(0, 10) : '—');
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const toLocalInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const scoreTone = (s) => (s >= 80 ? 'green' : s >= 60 ? 'gold' : 'red');

export function useRecords(base, { pageSize = 25, facets, filter } = {}) {
  const [state, setState] = useState({ data: [], total: 0, facets: {}, loading: true, error: null });
  const [params, setParams] = useState({ page: 1, q: '', sort: '', filter: filter || {} });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await api.get(`${base}${qs({ ...params, pageSize, facets })}`);
      setState({ data: r.data, total: r.total, facets: r.facets || {}, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [base, params, pageSize, facets]);

  useEffect(() => { load(); }, [load]);
  return { ...state, params, setParams, reload: load, pageSize };
}

/** Scalar aggregates for the module KPI header. Refetched whenever `key` changes (e.g. after a save). */
function useStats(base, key) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let alive = true;
    api.get(`${base}/stats`).then((s) => alive && setStats(s)).catch(() => alive && setStats(null));
    return () => { alive = false; };
  }, [base, key]);
  return stats;
}

const g = (st, grp, k) => st?.groups?.[grp]?.[k] ?? 0;

/** Per-module KPI header: all figures are accurate totals from /stats, not the current page. */
function moduleKpis(module, st) {
  if (!st) return null;
  switch (module) {
    case 'cx': return [
      { label: 'Total Feedback', value: st.total, sub: 'All types', tone: 'blue' },
      { label: 'Avg NPS', value: st.avgScore ?? '—', sub: 'Net Promoter', tone: 'green' },
      { label: 'Complaints', value: g(st, 'feedback_type', 'Complaint'), sub: 'Needs attention', tone: g(st, 'feedback_type', 'Complaint') ? 'red' : 'green' },
      { label: 'Open Issues', value: g(st, 'status', 'Open'), sub: 'Unresolved', tone: g(st, 'status', 'Open') ? 'orange' : 'green' },
    ];
    case 'deals': return [
      { label: 'Total Deals', value: st.total, sub: 'All deals', tone: 'blue' },
      { label: 'Pipeline Value', value: fmtMoney(st.sums?.amount), sub: 'Sum of amounts', tone: 'gold' },
      { label: 'Active', value: g(st, 'status', 'Active'), sub: 'In progress', tone: 'orange' },
      { label: 'Won', value: g(st, 'status', 'Won'), sub: 'Closed won', tone: 'green' },
    ];
    case 'maintenance': return [
      { label: 'Total Requests', value: st.total, sub: 'All time', tone: 'blue' },
      { label: 'Open', value: g(st, 'status', 'Open'), sub: 'Not started', tone: g(st, 'status', 'Open') ? 'orange' : 'green' },
      { label: 'In Progress', value: g(st, 'status', 'In Progress'), sub: 'Being worked', tone: 'purple' },
      { label: 'Urgent', value: g(st, 'priority', 'Urgent'), sub: 'High priority', tone: g(st, 'priority', 'Urgent') ? 'red' : 'green' },
    ];
    case 'customers': return [
      { label: 'Members', value: st.total, sub: 'All members', tone: 'blue' },
      { label: 'Active', value: g(st, 'status', 'Active'), sub: 'Paying', tone: 'green' },
      { label: 'MRR', value: fmtMoney(st.sums?.mrr_amount), sub: 'Monthly recurring', tone: 'gold' },
      { label: 'Churned', value: g(st, 'status', 'Churned'), sub: 'Lost', tone: g(st, 'status', 'Churned') ? 'red' : 'green' },
    ];
    case 'bookings': return [
      { label: 'Bookings', value: st.total, sub: 'All time', tone: 'blue' },
      { label: 'Confirmed', value: g(st, 'status', 'Confirmed'), sub: 'Locked in', tone: 'green' },
      { label: 'Pending', value: g(st, 'status', 'Pending'), sub: 'Awaiting', tone: 'orange' },
      { label: 'Revenue', value: fmtMoney(st.sums?.total_amount), sub: 'Booked value', tone: 'gold' },
    ];
    case 'events': return [
      { label: 'Events', value: st.total, sub: 'All events', tone: 'blue' },
      { label: 'Upcoming', value: g(st, 'status', 'Upcoming'), sub: 'Scheduled', tone: 'orange' },
      { label: 'Completed', value: g(st, 'status', 'Completed'), sub: 'Done', tone: 'green' },
      { label: 'Cancelled', value: g(st, 'status', 'Cancelled'), sub: 'Called off', tone: g(st, 'status', 'Cancelled') ? 'red' : 'purple' },
    ];
    default: return null;
  }
}

const feedbackTone = (s) => (s >= 8 ? 'green' : s >= 6 ? 'gold' : s >= 4 ? 'orange' : 'red');

/** Prototype CX feedback card. */
function FeedbackCard({ f, onOpen, canEdit, meta }) {
  const sc = toneOf({ green: 'active', gold: 'pending', orange: 'pending', red: 'lost' }[feedbackTone(f.score)]);
  const assignee = meta.users.find((u) => u.id === f.assignee_id)?.name;
  return (
    <button type="button" disabled={!canEdit} onClick={onOpen}
      className={cx('block w-full rounded-xl border-[1.5px] border-l-4 bg-white p-3.5 text-left shadow-pv-sm transition hover:shadow-pv-md disabled:cursor-default', sc.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-pv-text">{f.customer_name || 'Anonymous'}</p>
          <p className="text-[11px] text-pv-text4">{fmtDate(f.created_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {f.feedback_type && <Badge status={f.feedback_type}>{f.feedback_type}</Badge>}
          {f.score != null && <span className={cx('text-lg font-extrabold', sc.text)}>{f.score}{f.feedback_type === 'NPS' ? '/10' : ''}</span>}
        </div>
      </div>
      {f.comments && <p className="mt-2 line-clamp-3 text-xs text-pv-text2 italic">“{f.comments}”</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-pv-text4">{assignee ? `Assigned: ${assignee}` : f.category || ''}</span>
        {f.status && <Badge status={f.status}>{f.status}</Badge>}
      </div>
    </button>
  );
}

function Cell({ col, row, meta }) {
  const v = row[col.key];
  if (col.type === 'stage') {
    const s = meta.stages.find((x) => x.id === v);
    return s ? <Badge className={cx(color(s.color).soft, 'border-transparent')}>{s.name}</Badge> : <span className="text-pv-text4">—</span>;
  }
  if (col.type === 'user') return meta.users.find((u) => u.id === v)?.name || <span className="text-pv-text4">—</span>;
  if (col.format === 'money') return <span className="font-bold text-pv-gold">{v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>;
  if (col.key === 'score') return <span className={cx('font-extrabold', toneOf({ green: 'active', gold: 'pending', red: 'lost' }[scoreTone(v)]).text)}>{v ?? '—'}</span>;
  if (col.type === 'date') return <span className="text-pv-text3">{fmtDate(v)}</span>;
  if (col.type === 'datetime') return <span className="text-pv-text3">{fmtDateTime(v)}</span>;
  if (col.type === 'bool') return v ? <Badge tone="green">Yes</Badge> : <Badge tone="gray">No</Badge>;
  if (col.link) return <span className="font-semibold text-pv-accent">{v ?? '—'}</span>;
  if (col.badge && v) return <Badge status={v} tone={['Office', 'Retail', 'Apartment', 'Space'].includes(v) ? ({ Office: 'blue', Retail: 'purple', Apartment: 'green', Space: 'purple' })[v] : undefined}>{v}</Badge>;
  if (col.sub) return (<div><p className="font-semibold text-pv-text">{v ?? '—'}</p>{row[col.sub] && <p className="text-[11px] text-pv-text4">{row[col.sub]}</p>}</div>);
  return <span className={cx(col.truncate && 'block max-w-xs truncate')}>{v ?? '—'}</span>;
}

export function RecordForm({ def, meta, fixed, initial, onSubmit, errors }) {
  const [form, setForm] = useState(() => {
    const f = {};
    for (const fl of def.form) {
      const v = initial?.[fl.key];
      f[fl.key] = fl.type === 'datetime' ? toLocalInput(v) : fl.type === 'bool' ? Boolean(v) : v ?? '';
    }
    return f;
  });
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const fields = def.form.filter((fl) => !(fl.key in fixed));
  const errOf = (k) => errors?.find((e) => e.field === k)?.message;

  const submit = (e) => {
    e.preventDefault();
    const out = {};
    for (const fl of fields) {
      const v = form[fl.key];
      if (fl.type === 'bool') { out[fl.key] = Boolean(v); continue; }
      if (v === '' || v === undefined) { if (initial) out[fl.key] = null; continue; }
      if (fl.type === 'number' || fl.type === 'stage' || fl.type === 'user') out[fl.key] = Number(v);
      else if (fl.type === 'datetime') out[fl.key] = new Date(v).toISOString();
      else out[fl.key] = v;
    }
    onSubmit(out);
  };

  return (
    <form id="record-form" onSubmit={submit} className="grid grid-cols-1 gap-x-[18px] gap-y-4 sm:grid-cols-2">
      {fields.map((fl) => {
        const common = { id: `f-${fl.key}`, value: form[fl.key], onChange: (e) => set(fl.key, e.target.value), required: fl.required };
        let input;
        if (fl.type === 'select') input = <Select {...common} placeholder="—" options={fl.options} />;
        else if (fl.type === 'stage') input = <Select {...common} placeholder="—" options={meta.stages.map((s) => ({ value: s.id, label: s.name }))} />;
        else if (fl.type === 'user') input = <Select {...common} placeholder="Unassigned" options={meta.users.map((u) => ({ value: u.id, label: u.name }))} />;
        else if (fl.type === 'textarea') input = <Textarea {...common} />;
        else if (fl.type === 'bool') input = <div><Toggle checked={Boolean(form[fl.key])} onChange={(v) => set(fl.key, v)} label={fl.label} /></div>;
        else input = <Input {...common} type={fl.type === 'number' ? 'number' : fl.type === 'date' ? 'date' : fl.type === 'datetime' ? 'datetime-local' : 'text'} step={fl.type === 'number' ? 'any' : undefined} />;
        return (
          <div key={fl.key} className={cx(fl.wide && 'sm:col-span-2')}>
            <Field label={fl.label} required={fl.required} error={errOf(fl.key)}>{input}</Field>
          </div>
        );
      })}
    </form>
  );
}

/** Prototype unit card (Office Units / Retail Showrooms / Apartments / Spaces). */
function UnitCard({ u, onOpen, canEdit, leadsHref }) {
  const t = toneOf(u.status);
  const a = u.attrs || {};
  const d365 = a.d365 || {};
  const features = Array.isArray(a.features) ? a.features : [];
  const tenant = a.tenant_name || (u.status !== 'Available' && d365.current_agreement ? 'Tenant on file' : null);
  return (
    <Card className={cx('flex flex-col border-l-4 p-5', t.border)}>
      <button type="button" disabled={!canEdit} onClick={onOpen} className="text-left disabled:cursor-default">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-extrabold text-pv-navy">{u.code}</p>
          <Badge status={u.status}>{u.status}</Badge>
        </div>
        <p className="text-xs text-pv-text3">{[u.floor && (/^\d+$/.test(u.floor) ? `Floor ${u.floor}` : u.floor), u.unit_type].filter(Boolean).join(' · ') || u.name}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          <div><dt className="text-[10px] font-bold tracking-[.06em] text-pv-text4 uppercase">Size</dt><dd className="text-[17px] font-extrabold text-pv-text">{u.size_sqm ?? '—'} <span className="text-xs font-medium text-pv-text3">sqm</span></dd></div>
          <div><dt className="text-[10px] font-bold tracking-[.06em] text-pv-text4 uppercase">Annual Rent</dt><dd className="text-[15px] font-extrabold text-pv-sand">{u.rent_amount ? fmtMoney(u.rent_amount) : '—'}</dd></div>
          <div><dt className="text-[10px] font-bold tracking-[.06em] text-pv-text4 uppercase">{a.view ? 'View' : 'Lease End'}</dt><dd className="text-[13px] font-semibold text-pv-text">{a.view || fmtDate(u.lease_end)}</dd></div>
          <div><dt className="text-[10px] font-bold tracking-[.06em] text-pv-text4 uppercase">{a.fitout ? 'Fitout' : 'Furnishing'}</dt><dd className="text-[13px] font-semibold text-pv-text">{a.fitout || d365.furnishing || '—'}</dd></div>
        </dl>
        {tenant && <p className="mt-3 rounded-lg bg-pv-bg px-2.5 py-2 text-[13px] font-semibold text-pv-text2">{tenant}</p>}
        {features.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {features.slice(0, 3).map((f) => <span key={f} className="rounded bg-pv-sky px-1.5 py-0.5 text-[10px] font-semibold text-pv-accent">{f}</span>)}
            {features.length > 3 && <span className="rounded bg-pv-bg px-1.5 py-0.5 text-[10px] text-pv-text3">+{features.length - 3} more</span>}
          </div>
        )}
      </button>
      {u.status === 'Available' && leadsHref && (
        <Link to={leadsHref} className="mt-3 block rounded-lg bg-pv-accent py-2 text-center text-[13px] font-bold text-white hover:bg-pv-accent2">Request Viewing</Link>
      )}
    </Card>
  );
}

export default function RecordsView({ entity, mod, def, meta }) {
  const base = `/e/${entity.code}/m/${mod.slug}/records`;
  const isUnits = mod.module === 'units';
  const isLeads = mod.module === 'leads';
  const facetCols = isLeads ? 'stage_id,category' : def.columns.some((c) => c.key === 'status') || def.form.some((f) => f.key === 'status') ? 'status' : undefined;
  const isCx = mod.module === 'cx';
  const rec = useRecords(base, { pageSize: isUnits ? 24 : isCx ? 12 : 25, facets: facetCols });
  const notify = useUI((s) => s.notify);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState(null);
  const [statKey, setStatKey] = useState(0);
  const stats = useStats(base, statKey);
  const kpis = moduleKpis(mod.module, stats);
  const columns = def.columns;
  const pages = Math.max(1, Math.ceil(rec.total / rec.pageSize));
  const fixed = mod.fixed || {};
  const leadsMod = entity.modules.find((m) => m.module === 'leads');

  const statusFacet = rec.facets.status || {};
  const statusTotal = Object.values(statusFacet).reduce((a, b) => a + b, 0);
  const curStatus = rec.params.filter.status || '';

  const save = async (data) => {
    setBusy(true); setErrors(null);
    try {
      if (editing?.id) await api.patch(`${base}/${editing.id}`, { ...data, row_version: editing.row_version });
      else await api.post(base, data);
      notify(editing?.id ? 'Saved' : 'Created');
      setEditing(null);
      rec.reload(); setStatKey((k) => k + 1);
    } catch (e) {
      setErrors(e.details || null);
      notify(e.message, 'error');
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!editing?.id) return;
    setBusy(true);
    try { await api.del(`${base}/${editing.id}`); notify('Deleted'); setEditing(null); rec.reload(); setStatKey((k) => k + 1); }
    catch (e) { notify(e.message, 'error'); } finally { setBusy(false); }
  };
  const setSort = (key) => rec.setParams((p) => ({ ...p, page: 1, sort: p.sort === key ? `-${key}` : key }));
  const setFilter = (k, v) => rec.setParams((p) => ({ ...p, page: 1, filter: { ...p.filter, [k]: v } }));

  // Leads KPI strip
  const leadKpis = useMemo(() => {
    if (!isLeads) return null;
    const byCat = rec.facets.category || {};
    const byStage = rec.facets.stage_id || {};
    const total = Object.values(byStage).reduce((a, b) => a + b, 0);
    const wonIds = new Set(meta.stages.filter((s) => s.is_won).map((s) => String(s.id)));
    const won = Object.entries(byStage).filter(([k]) => wonIds.has(k)).reduce((a, [, n]) => a + n, 0);
    const cats = Object.entries(byCat).filter(([k]) => k !== '—').sort((a, b) => b[1] - a[1]).slice(0, 2);
    return { total, won, cats };
  }, [isLeads, rec.facets, meta.stages]);

  const pageSubtitle = isUnits
    ? `${rec.total.toLocaleString()} units${statusFacet.Available ? ` · ${statusFacet.Available} available` : ''}`
    : `${entity.name} · ${rec.total.toLocaleString()} records`;

  return (
    <div>
      <PageHeader
        title={mod.label}
        subtitle={pageSubtitle}
        actions={mod.can.create && <Button onClick={() => { setErrors(null); setEditing({}); }}>+ {isUnits ? 'Add Unit' : isLeads ? 'New Lead' : `New ${def.noun}`}</Button>}
      />

      {leadKpis && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Total Leads" value={leadKpis.total} sub="All enquiries" tone="blue" />
          {leadKpis.cats.map(([k, n], i) => <Kpi key={k} label={`${k} Leads`} value={n} sub={`${k} enquiries`} tone={i ? 'purple' : 'gold'} />)}
          {leadKpis.cats.length < 2 && <Kpi label="Pipeline Stages" value={meta.stages.length} sub="Configured for this entity" tone="purple" />}
          {leadKpis.cats.length < 1 && <Kpi label="Active" value={leadKpis.total - leadKpis.won} sub="Not yet signed" tone="orange" />}
          <Kpi label="Contracts Signed" value={leadKpis.won} sub="Closed deals" tone="green" />
        </div>
      )}

      {kpis && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => <Kpi key={k.label} label={k.label} value={k.value} sub={k.sub} tone={k.tone} />)}
        </div>
      )}

      {/* Status tabs with counts (units, deals, members …) */}
      {!isLeads && statusTotal > 0 && (
        <SegTabs
          value={curStatus}
          onChange={(v) => setFilter('status', v)}
          items={[{ value: '', label: `All (${statusTotal})` }, ...Object.entries(statusFacet).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ value: k, label: `${k} (${n})` }))]}
        />
      )}

      {/* Lead category pills */}
      {isLeads && leadKpis?.cats.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[['', 'All Leads'], ...leadKpis.cats.map(([k]) => [k, k])].map(([v, l]) => (
            <button key={l} type="button" onClick={() => setFilter('category', v)}
              className={cx('rounded-lg border-[1.5px] px-4 py-1.5 text-xs font-bold transition',
                (rec.params.filter.category || '') === v ? 'border-pv-sand bg-[#fdf6e9] text-pv-gold' : 'border-pv-border2 bg-white text-pv-text2 hover:bg-pv-bg')}>
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input type="search" placeholder={`Search ${mod.label.toLowerCase()}…`} className="sm:max-w-xs" value={rec.params.q}
          onChange={(e) => rec.setParams((p) => ({ ...p, page: 1, q: e.target.value }))} />
        {(def.filters || []).filter((f) => f.key !== 'status').map((f) => (
          <Select key={f.key} className="sm:max-w-48" placeholder={`All ${f.label.toLowerCase()}`}
            options={f.type === 'stage' ? meta.stages.map((s) => ({ value: s.id, label: s.name })) : f.options}
            value={rec.params.filter[f.key] ?? ''} onChange={(e) => setFilter(f.key, e.target.value)} />
        ))}
      </div>

      {rec.error && <p className="mb-4 rounded-lg border-[1.5px] border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] font-semibold text-pv-red">{rec.error}</p>}

      {rec.loading && rec.data.length === 0 ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : rec.data.length === 0 ? (
        <Empty title={`No ${def.noun} records yet`}>{mod.can.create ? `Use "+ ${isUnits ? 'Add Unit' : 'New'}" to add one.` : null}</Empty>
      ) : isUnits ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {rec.data.map((u) => (
            <UnitCard key={u.id} u={u} canEdit={mod.can.edit} onOpen={() => mod.can.edit && setEditing(u)} leadsHref={leadsMod ? `/e/${entity.code}/${leadsMod.slug}` : null} />
          ))}
        </div>
      ) : isCx ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rec.data.map((f) => (
            <FeedbackCard key={f.id} f={f} meta={meta} canEdit={mod.can.edit} onOpen={() => mod.can.edit && setEditing(f)} />
          ))}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {rec.data.map((row) => (
              <button key={row.id} type="button" onClick={() => mod.can.edit && setEditing(row)} className="block w-full rounded-xl border-[1.5px] border-pv-border bg-white p-4 text-left shadow-pv-sm">
                <div className="font-semibold text-pv-text"><Cell col={columns[0]} row={row} meta={meta} /></div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  {columns.slice(1, 5).map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-[10px] font-bold tracking-[.06em] text-pv-text4 uppercase">{c.label}</dt>
                      <dd className="truncate text-pv-text2"><Cell col={c} row={row} meta={meta} /></dd>
                    </div>
                  ))}
                </dl>
              </button>
            ))}
          </div>

          {/* Table (prototype th/td styling) */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className={cx('border-b-2 border-pv-border bg-pv-bg px-[15px] py-3 text-[10.5px] font-bold tracking-[.1em] text-pv-text4 uppercase', c.hideSm && 'hidden lg:table-cell')}>
                      <button type="button" className="uppercase hover:text-pv-text" onClick={() => setSort(c.key)}>
                        {c.label}{rec.params.sort === c.key ? ' ↑' : rec.params.sort === `-${c.key}` ? ' ↓' : ''}
                      </button>
                    </th>
                  ))}
                  {mod.can.edit && <th className="border-b-2 border-pv-border bg-pv-bg px-[15px]" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {rec.data.map((row) => (
                  <tr key={row.id} className="group">
                    {columns.map((c, i) => (
                      <td key={c.key} className={cx('border-b border-pv-border px-[15px] py-3 align-middle text-[13px] font-medium text-pv-text2 group-last:border-b-0 group-hover:bg-pv-bg', i === 0 && 'font-semibold text-pv-text', c.hideSm && 'hidden lg:table-cell')}>
                        <Cell col={c} row={row} meta={meta} />
                      </td>
                    ))}
                    {mod.can.edit && (
                      <td className="border-b border-pv-border px-[15px] text-right group-last:border-b-0 group-hover:bg-pv-bg">
                        <button type="button" onClick={() => setEditing(row)} className="rounded-md border-[1.5px] border-pv-border2 bg-white px-2.5 py-1 text-[11px] font-bold text-pv-text2 hover:bg-pv-bg">Edit</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {rec.total > rec.pageSize && (
        <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-pv-text3">
          <button type="button" disabled={rec.params.page <= 1} onClick={() => rec.setParams((p) => ({ ...p, page: p.page - 1 }))} className="rounded-md border border-pv-border bg-white px-3 py-1 disabled:opacity-40">‹ Prev</button>
          <span className="rounded-md border-[1.5px] border-pv-text px-3 py-1 font-bold text-pv-text">{rec.params.page}</span>
          <span>of {pages}</span>
          <button type="button" disabled={rec.params.page >= pages} onClick={() => rec.setParams((p) => ({ ...p, page: p.page + 1 }))} className="rounded-md border border-pv-border bg-white px-3 py-1 disabled:opacity-40">Next ›</button>
        </div>
      )}

      <Modal
        open={editing !== null}
        wide
        title={editing?.id ? `Edit ${def.noun}` : `New ${def.noun}`}
        onClose={() => setEditing(null)}
        footer={<>
          {editing?.id && mod.can.delete && <Button variant="danger" className="mr-auto" disabled={busy} onClick={remove}>Delete</Button>}
          <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" form="record-form" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </>}
      >
        {editing !== null && <RecordForm key={editing.id || 'new'} def={def} meta={meta} fixed={fixed} initial={editing.id ? editing : null} onSubmit={save} errors={errors} />}
      </Modal>
    </div>
  );
}
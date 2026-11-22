import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Badge, Bar, Card, Empty, Kpi, PageHeader, Spinner, TONE, cx, toneOf } from '../components/ui';
import { sar } from '../pages/GroupOverview';
import { color } from '../lib/colors';

const STATUS_ORDER = ['Available', 'Under Negotiation', 'Reserved', 'Leased', 'Occupied', 'Under Renewal', 'Under Termination', 'Under Maintenance', 'Offline'];
const occupiedStatuses = new Set(['Leased', 'Occupied']);

function StatusRow({ status, count, max }) {
  const t = toneOf(status);
  return (
    <div className="grid grid-cols-[10px_1fr_80px_24px] items-center gap-2.5 py-1 text-[13px] text-pv-text2">
      <span className={cx('size-2.5 rounded-full', t.dot)} />
      <span>{status}</span>
      <Bar pct={(count / Math.max(1, max)) * 100} className="h-1" fillClass={t.bar} />
      <span className={cx('text-right font-bold', t.text)}>{count}</span>
    </div>
  );
}

function Panel({ title, sub, action, children, className }) {
  return (
    <Card className={cx('p-5', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-pv-navy">{title}</p>
          {sub && <p className="text-[11px] text-pv-text3">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

const ViewAll = ({ to, children = 'View All' }) => (
  <Link to={to} className="shrink-0 rounded-lg bg-pv-accent px-3.5 py-1.5 text-xs font-bold text-white hover:bg-pv-accent2">{children}</Link>
);

export default function EntityOverview({ entity, mod }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setD(null);
    api.get(`/entities/${entity.code}/summary`).then(setD).catch((e) => setError(e.message));
  }, [entity.code]);

  if (error) return <Empty title="Could not load overview">{error}</Empty>;
  if (!d) return <div className="grid place-items-center py-20"><Spinner /></div>;

  const base = `/e/${entity.code}`;
  const slugOf = (module, pred = () => true) => entity.modules.find((m) => m.module === module && pred(m))?.slug;
  const unitsSlugFor = (category) => slugOf('units', (m) => m.fixed?.category === category) || slugOf('units');
  const leadsSlug = slugOf('leads');
  const membersSlug = slugOf('customers');
  const bookingsSlug = slugOf('bookings');
  const maintSlug = slugOf('maintenance');

  // Units grouped by category → status counts
  const cats = {};
  for (const u of d.units) {
    cats[u.category] ??= { total: 0, occupied: 0, rent: 0, statuses: {} };
    const c = cats[u.category];
    c.total += u.count; c.statuses[u.status] = (c.statuses[u.status] || 0) + u.count;
    if (occupiedStatuses.has(u.status)) { c.occupied += u.count; c.rent += u.rent; }
  }
  const catList = Object.entries(cats).sort((a, b) => b[1].total - a[1].total);
  const totalUnits = catList.reduce((s, [, c]) => s + c.total, 0);
  const totalOcc = catList.reduce((s, [, c]) => s + c.occupied, 0);
  const annualRent = catList.reduce((s, [, c]) => s + c.rent, 0);
  const memberMode = Boolean(membersSlug);
  const activeMembers = d.members.length;
  const mrr = d.members.reduce((s, m) => s + m.mrr_amount, 0);
  const avail = catList.reduce((s, [, c]) => s + (c.statuses.Available || 0), 0);
  const npsVals = d.members.filter((m) => m.nps != null).map((m) => Number(m.nps));
  const nps = npsVals.length ? (npsVals.reduce((a, b) => a + b, 0) / npsVals.length).toFixed(1) : '—';
  const openMaint = d.maintenance.reduce((s, m) => s + m.count, 0);
  const maxFloor = Math.max(1, ...d.revenueByFloor.map((f) => f.rent));
  const accent = color(entity.color);

  return (
    <div>
      <PageHeader
        title={mod.label}
        subtitle={entity.industry}
        actions={<>
          {catList[0] && unitsSlugFor(catList[0][0]) && <Link to={`${base}/${unitsSlugFor(catList[0][0])}`} className="rounded-lg border-[1.5px] border-pv-border2 bg-white px-3.5 py-2 text-[13px] font-bold text-pv-text2 shadow-pv-sm hover:bg-pv-bg">View Units</Link>}
          {leadsSlug && <Link to={`${base}/${leadsSlug}`} className="rounded-lg bg-pv-accent px-3.5 py-2 text-[13px] font-bold text-white hover:bg-pv-accent2">View Leads</Link>}
        </>}
      />

      {/* KPIs */}
      {memberMode ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Active Members" value={activeMembers} sub="Top members by MRR" tone="green" />
          <Kpi label="Monthly Revenue" value={sar(mrr)} sub="MRR from memberships" tone="gold" />
          <Kpi label="Spaces Available" value={avail} sub={`${totalUnits} total spaces`} tone="blue" />
          <Kpi label="Member NPS" value={nps === '—' ? '—' : `${nps}/10`} sub="Satisfaction score" tone="purple" />
          <Kpi label="Upcoming Bookings" value={d.bookings.length} sub="Rooms booked" tone="orange" />
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Total Rentable Units" value={totalUnits} sub={catList.slice(0, 3).map(([k, c]) => `${c.total} ${k.toLowerCase()}`).join(' + ') || 'No units yet'} tone="gold" />
          <Kpi label="Annual Rental Revenue" value={sar(annualRent)} sub="Leased units" tone="green" />
          {catList.slice(0, 2).map(([k, c], i) => (
            <Kpi key={k} label={`${k} Occupancy`} value={`${c.total ? Math.round((c.occupied / c.total) * 100) : 0}%`} sub={`${c.occupied} of ${c.total} occupied`} tone={i === 0 ? 'blue' : 'purple'} />
          ))}
          {catList.length < 2 && <Kpi label={openMaint ? 'Open Maintenance' : 'Occupancy'} value={openMaint ? openMaint : `${totalUnits ? Math.round((totalOcc / totalUnits) * 100) : 0}%`} sub={openMaint ? 'Requests not resolved' : 'Across all units'} tone={openMaint ? 'red' : 'purple'} />}
        </div>
      )}

      {totalUnits === 0 && d.leads.length === 0 && activeMembers === 0 && (
        <Empty title="No data yet">Add units, leads or members, or run the D365 import, and this overview fills in.</Empty>
      )}

      {/* Unit status panels */}
      {catList.length > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {catList.slice(0, memberMode ? 1 : 4).map(([k, c]) => {
            const statuses = Object.entries(c.statuses).sort((a, b) => (STATUS_ORDER.indexOf(a[0]) + 99) % 99 - (STATUS_ORDER.indexOf(b[0]) + 99) % 99);
            const max = Math.max(...statuses.map((s) => s[1]));
            const slug = unitsSlugFor(k);
            return (
              <Panel key={k} title={memberMode ? 'Space Status' : `${k} Units`} sub={`${c.total} units · ${c.occupied} occupied`} action={slug && <ViewAll to={`${base}/${slug}`} />}>
                {statuses.map(([s, n]) => <StatusRow key={s} status={s} count={n} max={max} />)}
              </Panel>
            );
          })}
          {memberMode && d.memberMix.length > 0 && (
            <Panel title="Member Type Mix">
              {d.memberMix.map((m, i) => <StatusRow key={m.type} status={m.type} count={m.count} max={Math.max(...d.memberMix.map((x) => x.count))} />)}
            </Panel>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue by floor / type */}
        {!memberMode && d.revenueByFloor.length > 0 && (
          <Panel title="Revenue by Floor" sub="Annual rent from occupied units">
            <div className="space-y-2.5">
              {d.revenueByFloor.map((f) => (
                <div key={f.floor} className="grid grid-cols-[72px_1fr_76px] items-center gap-3 text-xs text-pv-text2">
                  <span className="truncate">{/^\d+$/.test(f.floor) ? `Floor ${f.floor}` : f.floor}</span>
                  <Bar pct={(f.rent / maxFloor) * 100} className="h-1.5" fillClass={accent.fill} />
                  <span className="text-right font-bold text-pv-gold">{sar(f.rent)}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
        {memberMode && d.rentByType.length > 0 && (
          <Panel title="Revenue by Space Type">
            <div className="space-y-3">
              {d.rentByType.sort((a, b) => b.rent - a.rent).map((r, i) => {
                const t = ['gold', 'purple', 'green', 'blue', 'gray'][i % 5];
                return (
                  <div key={r.type}>
                    <div className="flex justify-between text-xs"><span className="text-pv-text2">{r.type}</span><span className={cx('font-bold', TONE[t].text)}>{sar(r.rent)}</span></div>
                    <Bar pct={(r.rent / Math.max(1, ...d.rentByType.map((x) => x.rent))) * 100} tone={t} className="h-1" />
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* Active leads */}
        {leadsSlug && (
          <Panel title="Active Leads" action={<ViewAll to={`${base}/${leadsSlug}`}>+ New Lead</ViewAll>}>
            {d.leads.length === 0 && <p className="text-xs text-pv-text4">No active leads.</p>}
            <div className="divide-y divide-pv-border">
              {d.leads.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-pv-text">{l.name}</p>
                    <p className="text-[11px] text-pv-text3">{[l.category, l.value ? sar(l.value) : null].filter(Boolean).join(' · ')}</p>
                  </div>
                  {l.stage && <Badge className={color(l.color).soft + ' border-transparent'}>{l.stage}</Badge>}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Members + bookings (co-working) */}
        {memberMode && (
          <Panel title="Active Members" action={membersSlug && <ViewAll to={`${base}/${membersSlug}`}>All Members</ViewAll>} className="overflow-x-auto">
            {d.members.length === 0 ? <p className="text-xs text-pv-text4">No active members.</p> : (
              <table className="w-full text-left text-[13px]">
                <thead><tr className="bg-pv-bg text-[10.5px] tracking-[.1em] text-pv-text4 uppercase"><th className="px-3 py-2.5">Member</th><th className="px-3">Plan</th><th className="px-3">MRR</th><th className="px-3">Renewal</th></tr></thead>
                <tbody className="divide-y divide-pv-border">
                  {d.members.map((m) => (
                    <tr key={m.id} className="hover:bg-pv-bg">
                      <td className="px-3 py-2.5"><p className="font-semibold text-pv-text">{m.name}</p><p className="text-[11px] text-pv-text4">{m.company}</p></td>
                      <td className="px-3 text-pv-text2">{m.plan || '—'}</td>
                      <td className="px-3 font-bold text-pv-gold">{sar(m.mrr_amount)}</td>
                      <td className="px-3 text-pv-text3">{m.renewal_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        )}
        {bookingsSlug && (
          <Panel title="Upcoming Bookings" action={<ViewAll to={`${base}/${bookingsSlug}`}>+ Book Room</ViewAll>}>
            {d.bookings.length === 0 ? <p className="text-xs text-pv-text4">No upcoming bookings.</p> : (
              <div className="divide-y divide-pv-border">
                {d.bookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                    <div className="min-w-0"><p className="truncate font-semibold">{b.unit_name}</p><p className="text-[11px] text-pv-text3">{b.contact_name || '—'} · {new Date(b.starts_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
                    <Badge status={b.status}>{b.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
        {maintSlug && (
          <Panel title="Open Maintenance" sub={`${openMaint} requests`} action={<ViewAll to={`${base}/${maintSlug}`} />}>
            {d.maintenance.length === 0 ? <p className="text-xs text-pv-text4">All maintenance clear.</p> :
              d.maintenance.map((m) => <StatusRow key={m.priority} status={m.priority} count={m.count} max={Math.max(...d.maintenance.map((x) => x.count))} />)}
          </Panel>
        )}
      </div>
    </div>
  );
}
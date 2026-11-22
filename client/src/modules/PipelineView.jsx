import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useUI } from '../store/ui';
import { useRecords } from './RecordsView';
import { Bar, Empty, SegTabs, Spinner, TONE, cx } from '../components/ui';
import { sar } from '../pages/GroupOverview';

const PIPE_LABEL = { lease: 'Lease Pipeline', retail: 'Retail Pipeline', default: 'Pipeline' };
const stageTone = (i, n) => (i < n * 0.34 ? 'blue' : i < n * 0.67 ? 'orange' : 'green');
const scoreTone = (s) => (s >= 80 ? 'green' : s >= 60 ? 'gold' : 'red');
const QUALITY = { Marketing: 'bg-[#f4f0ff] text-[#5f40b2] border-[#d0c8f8]', Leasing: 'bg-pv-sky text-pv-accent border-[#a8d0f0]', Shared: 'bg-[#fffbeb] text-pv-gold border-[#fde68a]' };
const CHIP = { blue: 'bg-pv-sky text-pv-accent', orange: 'bg-[#fff7ed] text-pv-orange', green: 'bg-[#f0fdf4] text-pv-green' };
const initials = (name) => (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : null);

export default function PipelineView({ entity, mod, meta }) {
  const notify = useUI((s) => s.notify);
  const active = meta.stages.filter((s) => s.active !== false);
  const pipelines = [...new Set(active.map((s) => s.pipeline_code))];
  const [pipe, setPipe] = useState(pipelines[0]);
  const all = active.filter((s) => s.pipeline_code === pipe);
  const stages = all.filter((s) => !s.is_won && !s.is_lost);
  const won = all.find((s) => s.is_won), lost = all.find((s) => s.is_lost);
  const openIds = stages.map((s) => s.id).join(',');

  const rec = useRecords(`/e/${entity.code}/m/${mod.slug}/records`, { pageSize: 100, filter: { stage_id: openIds }, facets: 'stage_id' });
  const [moving, setMoving] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);

  const switchPipe = (p) => {
    setPipe(p);
    const ids = active.filter((s) => s.pipeline_code === p && !s.is_won && !s.is_lost).map((s) => s.id).join(',');
    rec.setParams((x) => ({ ...x, page: 1, filter: { ...x.filter, stage_id: ids } }));
  };

  const leadsMod = entity.modules.find((m) => m.module === 'leads');
  const addHref = leadsMod ? `/e/${entity.code}/${leadsMod.slug}` : null;
  const userName = useMemo(() => Object.fromEntries(meta.users.map((u) => [u.id, u.name])), [meta.users]);
  const qCount = (o) => rec.data.filter((l) => l.quality_owner === o).length;
  const facetCount = (s) => (s ? rec.facets.stage_id?.[s.id] ?? rec.facets.stage_id?.[String(s.id)] ?? 0 : 0);

  const move = async (lead, stageId) => {
    if (!stageId || Number(stageId) === lead.stage_id) return;
    setMoving(lead.id);
    try {
      await api.patch(`/e/${entity.code}/m/${mod.slug}/records/${lead.id}`, { stage_id: Number(stageId), row_version: lead.row_version });
      rec.reload();
    } catch (e) { notify(e.message, 'error'); } finally { setMoving(null); }
  };
  const onDrop = (stageId) => {
    const lead = rec.data.find((l) => l.id === dragId);
    setDragId(null); setOver(null);
    if (lead) move(lead, stageId);
  };

  if (!stages.length) return <Empty title="No pipeline stages">An admin can add stages under Entities & Modules.</Empty>;
  const total = rec.data.reduce((s, l) => s + (l.value_amount || 0), 0);
  const projected = rec.data.reduce((s, l) => s + (l.value_amount || 0) * ((all.find((x) => x.id === l.stage_id)?.probability ?? l.score ?? 0) / 100), 0);

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-pv-navy">{entity.name} {PIPE_LABEL[pipe] || pipe}</h2>
          <p className="text-[13px] text-pv-text3">
            {rec.total} open · Total {sar(total)} · Projected {sar(Math.round(projected))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {won && <span className="font-semibold text-pv-green">Won {facetCount(won)}</span>}
          {lost && <span className="font-semibold text-pv-red">Lost {facetCount(lost)}</span>}
          <span className="text-pv-purple">{qCount('Marketing')} Mkt</span>
          <span className="text-pv-accent">{qCount('Leasing')} Sales</span>
        </div>
      </div>

      {pipelines.length > 1 && (
        <div className="mb-3 sm:max-w-md">
          <SegTabs value={pipe} onChange={switchPipe} items={pipelines.map((p) => ({ value: p, label: PIPE_LABEL[p] || p }))} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1">
        {stages.map((s, i) => {
          const n = rec.data.filter((l) => l.stage_id === s.id).length;
          return (
            <span key={s.id} className="flex items-center gap-1">
              <span className={cx('rounded-md px-2 py-0.5 text-[10.5px] font-bold', CHIP[stageTone(i, stages.length)])}>{s.name}{n ? ` ${n}` : ''}</span>
              {i < stages.length - 1 && <span className="text-[10px] text-pv-text4">›</span>}
            </span>
          );
        })}
      </div>

      {rec.loading && !rec.data.length ? <div className="grid place-items-center py-16"><Spinner /></div> : (
        <div className="-mx-4 flex items-start gap-3.5 overflow-x-auto px-4 pb-2.5 sm:mx-0 sm:px-0">
          {stages.map((s, i) => {
            const items = rec.data.filter((l) => l.stage_id === s.id);
            const t = stageTone(i, stages.length);
            return (
              <section key={s.id} aria-label={s.name}
                onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(s.id); } }}
                onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
                onDrop={(e) => { e.preventDefault(); onDrop(s.id); }}
                className={cx('w-[236px] shrink-0 rounded-xl p-1 transition', over === s.id && 'bg-pv-sky ring-2 ring-pv-accent/40')}>
                <div className="mb-2.5 rounded-[10px] border-[1.5px] border-pv-border bg-white px-3.5 py-2.5 shadow-pv-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cx('truncate text-[13px] font-bold', TONE[t].text)}>{s.name}</p>
                    {s.probability != null && <span className="text-[10.5px] font-semibold text-pv-text4">{s.probability}%</span>}
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-pv-text4">{items.length} · {sar(items.reduce((a, l) => a + (l.value_amount || 0), 0))}</p>
                </div>
                {items.map((l) => {
                  const party = l.attrs?.capsule?.party;
                  const close = l.attrs?.capsule?.expectedCloseOn;
                  const owner = userName[l.assignee_id] || l.attrs?.capsule?.owner;
                  const stale = s.stale_days && l.last_activity_at && (Date.now() - new Date(l.last_activity_at)) / 864e5 > s.stale_days;
                  return (
                    <div key={l.id} draggable={mod.can.edit}
                      onDragStart={(e) => { setDragId(l.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDragId(null); setOver(null); }}
                      className={cx('mb-2 rounded-[10px] border-[1.5px] border-l-4 bg-white px-3.5 py-3 shadow-pv-sm transition hover:border-pv-accent hover:shadow-pv-md',
                        stale ? 'border-pv-border border-l-pv-orange' : 'border-pv-border border-l-pv-border',
                        mod.can.edit && 'cursor-grab active:cursor-grabbing', (moving === l.id || dragId === l.id) && 'opacity-50')}>
                      {party && <p className="truncate text-[11px] text-pv-text3">{party}</p>}
                      <p className="truncate text-[13px] font-semibold text-pv-text">{l.name}</p>
                      {l.quality_owner && <span className={cx('mt-1 inline-block rounded-[5px] border-[1.5px] px-2 py-px text-[11px] font-bold', QUALITY[l.quality_owner])}>{l.quality_owner}</span>}
                      <p className="mt-1 text-xs font-bold text-pv-accent">{sar(l.value_amount)}{l.attrs?.capsule?.durationBasis && l.attrs.capsule.durationBasis !== 'FIXED' ? <span className="font-medium text-pv-text4"> / {l.attrs.capsule.durationBasis.toLowerCase()}</span> : null}</p>
                      <div className="mt-1.5 grid grid-cols-[1fr_24px] items-center gap-2">
                        <Bar pct={l.score} tone={scoreTone(l.score)} className="h-1" />
                        <span className={cx('text-right text-[11px] font-extrabold', TONE[scoreTone(l.score)].text)}>{l.score}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px] text-pv-text4">
                        <span className="truncate">{[close && `Close ${fmtDate(close)}`, l.lead_source].filter(Boolean).join(' · ') || (l.created_at && fmtDate(l.created_at))}</span>
                        {owner && <span title={owner} className="grid size-5 shrink-0 place-items-center rounded-full bg-[#f4f0ff] text-[9px] font-bold text-pv-purple">{initials(owner)}</span>}
                      </div>
                      {mod.can.edit && (
                        <select aria-label="Move to stage" value={l.stage_id ?? ''} onChange={(e) => move(l, e.target.value)}
                          className="mt-2 w-full rounded-md border border-pv-border bg-pv-bg3 px-2 py-1 text-[11px] text-pv-text3 outline-none focus:border-pv-accent sm:hidden">
                          {all.map((x) => <option key={x.id} value={x.id}>Move to: {x.name}</option>)}
                        </select>
                      )}
                    </div>
                  );
                })}
                {addHref && mod.can.create && (
                  <Link to={addHref} className="block rounded-[10px] border-[1.5px] border-dashed border-pv-border2 py-2 text-center text-xs font-semibold text-pv-text4 transition hover:border-pv-accent hover:bg-pv-sky hover:text-pv-accent">+ Add Lead</Link>
                )}
              </section>
            );
          })}
          {mod.can.edit && dragId && [won, lost].filter(Boolean).map((s) => (
            <section key={s.id} aria-label={s.name}
              onDragOver={(e) => { e.preventDefault(); setOver(s.id); }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); onDrop(s.id); }}
              className={cx('grid h-32 w-[160px] shrink-0 place-items-center rounded-xl border-2 border-dashed text-sm font-bold transition',
                s.is_won ? 'border-pv-green text-pv-green' : 'border-pv-red text-pv-red', over === s.id && (s.is_won ? 'bg-[#f0fdf4]' : 'bg-[#fef2f2]'))}>
              Drop: {s.name}
            </section>
          ))}
        </div>
      )}
      {rec.total > 100 && <p className="mt-2 text-xs text-pv-text3">Showing the first 100 open leads. Use the Leads list to search all.</p>}
    </div>
  );
}
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { PALETTE } from '../../lib/colors';
import { useUI } from '../../store/ui';
import { useAuth } from '../../store/auth';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, Toggle } from '../../components/ui';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function ModulesTab({ entityId, library, onChanged }) {
  const [rows, setRows] = useState(null);
  const [adding, setAdding] = useState(null);
  const notify = useUI((s) => s.notify);

  const load = () => api.get(`/admin/entities/${entityId}/modules`).then((r) => setRows(r.data));
  useEffect(() => { load(); }, [entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (row, body) => {
    try { await api.patch(`/admin/entities/${entityId}/modules/${row.id}`, body); await load(); onChanged(); }
    catch (e) { notify(e.message, 'error'); }
  };
  const move = (row, dir) => {
    const i = rows.indexOf(row); const other = rows[i + dir];
    if (!other) return;
    patch(row, { sort_order: other.sort_order }).then(() => patch(other, { sort_order: row.sort_order }));
  };

  const add = async (e) => {
    e.preventDefault();
    const lib = library.find((m) => m.code === adding.module_code);
    const filter = adding.filterKey && adding.filterValue ? { [adding.filterKey]: adding.filterValue } : null;
    try {
      await api.post(`/admin/entities/${entityId}/modules`, {
        module_code: adding.module_code, label: adding.label || lib.name, slug: adding.slug || slugify(adding.label || lib.name),
        sort_order: ((rows.at(-1)?.sort_order) ?? 0) + 10, filter_config: filter,
      });
      setAdding(null); await load(); onChanged(); notify('Module assigned');
    } catch (err) { notify(err.message, 'error'); }
  };

  const libSel = library.find((m) => m.code === adding?.module_code);

  if (!rows) return <Spinner />;
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setAdding({ module_code: library.find((m) => m.phase === 1)?.code || '', label: '', slug: '', filterKey: '', filterValue: '' })}>+ Assign module</Button>
      </div>
      <Card className="divide-y divide-slate-100">
        {rows.length === 0 && <p className="p-4 text-sm text-slate-500">No modules yet.</p>}
        {rows.map((r, i) => (
          <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <Input defaultValue={r.label} aria-label="Menu label" onBlur={(e) => e.target.value !== r.label && patch(r, { label: e.target.value })} className="font-semibold" />
              <p className="mt-1 text-xs text-slate-500">
                {r.module_name} · /{r.slug}
                {r.filter_config && Object.entries(r.filter_config).map(([k, v]) => <Badge key={k} className="ml-2 bg-sky-50 text-sky-700 ring-sky-200">{k} = {String(v)}</Badge>)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" disabled={i === 0} onClick={() => move(r, -1)} aria-label="Move up">↑</Button>
              <Button variant="ghost" disabled={i === rows.length - 1} onClick={() => move(r, 1)} aria-label="Move down">↓</Button>
              <Toggle checked={r.enabled} onChange={(v) => patch(r, { enabled: v })} label="Enabled" />
            </div>
          </div>
        ))}
      </Card>

      <Modal open={!!adding} title="Assign module" onClose={() => setAdding(null)}
        footer={<><Button variant="secondary" onClick={() => setAdding(null)}>Cancel</Button><Button type="submit" form="add-mod">Assign</Button></>}>
        {adding && (
          <form id="add-mod" onSubmit={add} className="space-y-4">
            <Field label="Module" required>
              <Select value={adding.module_code} onChange={(e) => setAdding({ ...adding, module_code: e.target.value, filterKey: '' })}
                options={library.map((m) => ({ value: m.code, label: `${m.name}${m.phase > 1 ? ' (phase 2)' : ''}` }))} />
            </Field>
            <Field label="Menu label" hint="e.g. Office Units"><Input value={adding.label} onChange={(e) => setAdding({ ...adding, label: e.target.value })} /></Field>
            <Field label="URL key" hint="Auto from label if empty"><Input value={adding.slug} onChange={(e) => setAdding({ ...adding, slug: slugify(e.target.value) })} /></Field>
            {libSel?.filterable?.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fixed filter (optional)">
                  <Select placeholder="None" value={adding.filterKey} onChange={(e) => setAdding({ ...adding, filterKey: e.target.value })} options={libSel.filterable} />
                </Field>
                <Field label="Value" hint="e.g. Office">
                  <Input value={adding.filterValue} disabled={!adding.filterKey} onChange={(e) => setAdding({ ...adding, filterValue: e.target.value })} />
                </Field>
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}

function StagesTab({ entityId }) {
  const [rows, setRows] = useState(null);
  const notify = useUI((s) => s.notify);
  useEffect(() => { api.get(`/admin/entities/${entityId}/stages`).then((r) => setRows(r.data)); }, [entityId]);
  const set = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = async () => {
    try {
      await api.put(`/admin/entities/${entityId}/stages`, rows.map((r, i) => ({
        ...(r.id ? { id: r.id } : {}), pipeline_code: r.pipeline_code || 'default', name: r.name, sort_order: (i + 1) * 10,
        color: r.color, is_won: r.is_won, is_lost: r.is_lost, active: r.active !== false,
      })));
      notify('Stages saved');
      const r = await api.get(`/admin/entities/${entityId}/stages`); setRows(r.data);
    } catch (e) { notify(e.message, 'error'); }
  };
  if (!rows) return <Spinner />;
  return (
    <div>
      <Card className="divide-y divide-slate-100">
        {rows.map((r, i) => (
          <div key={r.id || `n${i}`} className="grid grid-cols-2 items-center gap-3 p-3 sm:grid-cols-6">
            <Input className="col-span-2" value={r.name} onChange={(e) => set(i, 'name', e.target.value)} aria-label="Stage name" />
            <Select value={r.color} onChange={(e) => set(i, 'color', e.target.value)} options={PALETTE} aria-label="Color" />
            <label className="flex items-center gap-2 text-xs text-slate-600"><Toggle checked={r.is_won} onChange={(v) => set(i, 'is_won', v)} label="Won stage" /> Won</label>
            <label className="flex items-center gap-2 text-xs text-slate-600"><Toggle checked={r.is_lost} onChange={(v) => set(i, 'is_lost', v)} label="Lost stage" /> Lost</label>
            <label className="flex items-center gap-2 text-xs text-slate-600"><Toggle checked={r.active !== false} onChange={(v) => set(i, 'active', v)} label="Active" /> Active</label>
          </div>
        ))}
      </Card>
      <div className="mt-3 flex justify-between">
        <Button variant="secondary" onClick={() => setRows([...rows, { name: 'New stage', color: 'slate', is_won: false, is_lost: false, active: true }])}>+ Add stage</Button>
        <Button onClick={save}>Save stages</Button>
      </div>
    </div>
  );
}

export default function EntityDetail() {
  const { id } = useParams();
  const [entity, setEntity] = useState(null);
  const [library, setLibrary] = useState([]);
  const [tab, setTab] = useState('modules');
  const refreshNav = useAuth((s) => s.refresh);

  useEffect(() => {
    api.get('/admin/entities').then((r) => setEntity(r.data.find((e) => String(e.id) === id) || null));
    api.get('/admin/modules').then((r) => setLibrary(r.data));
  }, [id]);

  if (!entity) return <Spinner />;
  const tabCls = (t) => `rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`;
  return (
    <div>
      <Link to="/admin/entities" className="text-sm text-slate-500 hover:text-slate-800">← Entities</Link>
      <PageHeader title={entity.name} subtitle={`${entity.code} · ${entity.industry || ''}`} />
      <div className="mb-4 flex gap-2">
        <button type="button" className={tabCls('modules')} onClick={() => setTab('modules')}>Modules</button>
        <button type="button" className={tabCls('stages')} onClick={() => setTab('stages')}>Pipeline stages</button>
      </div>
      {tab === 'modules' ? <ModulesTab entityId={entity.id} library={library} onChanged={refreshNav} /> : <StagesTab entityId={entity.id} />}
    </div>
  );
}

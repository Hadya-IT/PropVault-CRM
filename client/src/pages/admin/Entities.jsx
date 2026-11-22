import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { PALETTE, color } from '../../lib/colors';
import { useUI } from '../../store/ui';
import { useAuth } from '../../store/auth';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, cx } from '../../components/ui';

export default function Entities() {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', industry: '', color: 'sky', city: 'Jeddah' });
  const [busy, setBusy] = useState(false);
  const notify = useUI((s) => s.notify);
  const refreshNav = useAuth((s) => s.refresh);

  const load = () => api.get('/admin/entities').then((r) => setList(r.data)).catch((e) => notify(e.message, 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/admin/entities', form);
      notify('Entity created. Now assign modules.');
      setOpen(false); setForm({ code: '', name: '', industry: '', color: 'sky', city: 'Jeddah' });
      load(); refreshNav();
    } catch (err) { notify(err.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Entities & Modules" subtitle="Create entities and decide which modules each one gets" actions={<Button onClick={() => setOpen(true)}>+ New entity</Button>} />
      {!list ? <Spinner /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <Link key={e.id} to={`/admin/entities/${e.id}`} className="block">
              <Card className={cx('border-l-4 p-4 transition hover:shadow-pv-md', color(e.color).borderL)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-bold text-slate-900">{e.name}</p>
                  {!e.active && <Badge className="bg-rose-50 text-rose-700 ring-rose-200">Inactive</Badge>}
                </div>
                <p className="text-xs text-slate-500">{e.code} · {e.industry || '—'}</p>
                <p className="mt-3 text-xs text-slate-600">{e.module_count} modules · {e.user_count} users</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} title="New entity" onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="entity-form" disabled={busy}>Create</Button></>}>
        <form id="entity-form" onSubmit={create} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Code" required hint="2–20 letters/digits, e.g. HMC"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required maxLength={20} /></Field>
          <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Industry"><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="Color"><Select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} options={PALETTE} /></Field>
        </form>
      </Modal>
    </div>
  );
}
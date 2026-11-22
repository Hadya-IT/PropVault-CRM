import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useUI } from '../../store/ui';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, Toggle } from '../../components/ui';

const ENTITY_ROLES = ['company-owner', 'dept-manager', 'sales-agent', 'marketing', 'operation', 'viewer'];
const GLOBAL_ROLES = [{ value: '', label: 'None (entity roles only)' }, { value: 'group-owner', label: 'Group Owner (admin)' }, { value: 'group-supervisor', label: 'Group Supervisor (read all)' }];

export default function Users() {
  const [users, setUsers] = useState(null);
  const [entities, setEntities] = useState([]);
  const [edit, setEdit] = useState(null);
  const notify = useUI((s) => s.notify);

  const load = () => api.get('/admin/users').then((r) => setUsers(r.data));
  useEffect(() => { load(); api.get('/admin/entities').then((r) => setEntities(r.data)); }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = {
      display_name: edit.display_name, global_role: edit.global_role || null, active: edit.active,
      entities: edit.entities.filter((x) => x.entity_id).map((x) => ({ entity_id: Number(x.entity_id), role: x.role, department: x.department || null })),
    };
    try {
      if (edit.id) await api.patch(`/admin/users/${edit.id}`, body);
      else await api.post('/admin/users', { ...body, email: edit.email });
      notify('User saved'); setEdit(null); load();
    } catch (err) { notify(err.message, 'error'); }
  };

  const ename = (id) => entities.find((e) => e.id === id)?.code || id;
  const setEnt = (i, k, v) => setEdit((s) => ({ ...s, entities: s.entities.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));

  return (
    <div>
      <PageHeader title="Users & Roles" subtitle="Only users listed here can sign in with Microsoft"
        actions={<Button onClick={() => setEdit({ email: '', display_name: '', global_role: '', active: true, entities: [] })}>+ Add user</Button>} />
      {!users ? <Spinner /> : (
        <Card className="divide-y divide-slate-100">
          {users.map((u) => (
            <button key={u.id} type="button" onClick={() => setEdit({ ...u, global_role: u.global_role || '' })} className="flex w-full flex-col gap-1 p-4 text-left hover:bg-slate-50 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{u.display_name} {!u.active && <Badge className="ml-1 bg-rose-50 text-rose-700 ring-rose-200">Disabled</Badge>}</p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {u.global_role && <Badge className="bg-amber-50 text-amber-800 ring-amber-200">{u.global_role}</Badge>}
                {u.entities.map((e) => <Badge key={e.entity_id}>{ename(e.entity_id)}: {e.role}</Badge>)}
              </div>
            </button>
          ))}
        </Card>
      )}

      <Modal open={!!edit} wide title={edit?.id ? 'Edit user' : 'Add user'} onClose={() => setEdit(null)}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" form="user-form">Save</Button></>}>
        {edit && (
          <form id="user-form" onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Company email" required><Input type="email" value={edit.email} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, email: e.target.value })} required /></Field>
              <Field label="Name" required><Input value={edit.display_name} onChange={(e) => setEdit({ ...edit, display_name: e.target.value })} required /></Field>
              <Field label="Group role"><Select value={edit.global_role} onChange={(e) => setEdit({ ...edit, global_role: e.target.value })} options={GLOBAL_ROLES} /></Field>
              <Field label="Active"><Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active" /></Field>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">Entity roles</p>
              <div className="space-y-2">
                {edit.entities.map((x, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <Select aria-label="Entity" placeholder="Entity…" value={x.entity_id} onChange={(e) => setEnt(i, 'entity_id', e.target.value)} options={entities.map((en) => ({ value: en.id, label: en.name }))} />
                    <Select aria-label="Role" value={x.role} onChange={(e) => setEnt(i, 'role', e.target.value)} options={ENTITY_ROLES} />
                    <Input aria-label="Department" placeholder="Department" value={x.department || ''} onChange={(e) => setEnt(i, 'department', e.target.value)} />
                    <Button variant="ghost" onClick={() => setEdit({ ...edit, entities: edit.entities.filter((_, j) => j !== i) })} aria-label="Remove">✕</Button>
                  </div>
                ))}
              </div>
              <Button variant="secondary" className="mt-2" onClick={() => setEdit({ ...edit, entities: [...edit.entities, { entity_id: '', role: 'sales-agent', department: '' }] })}>+ Add entity role</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

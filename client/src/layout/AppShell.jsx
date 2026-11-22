import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { color } from '../lib/colors';
import { cx } from '../components/ui';

// Prototype: .nav-btn / .nav-btn.active (inset blue bar)
const navCls = ({ isActive }) =>
  cx('flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[9px] text-left text-[13px] font-semibold transition',
    isActive ? 'bg-pv-bg text-pv-accent shadow-[inset_3px_0_0_#0176d3]' : 'text-pv-text3 hover:bg-pv-bg hover:text-pv-text');
const subCls = ({ isActive }) =>
  cx('mx-1.5 mb-px block rounded-md py-2 pr-2.5 pl-7 text-[12.5px] font-medium transition',
    isActive ? 'bg-pv-bg text-pv-accent shadow-[inset_3px_0_0_#0176d3]' : 'text-pv-text3 hover:bg-pv-bg hover:text-pv-text');

const Label = ({ children }) => <p className="px-1.5 pt-2 pb-1 text-[9px] font-extrabold tracking-[.14em] text-pv-text4 uppercase">{children}</p>;

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const ROLE_LABEL = { 'group-owner': 'Group Owner', 'group-supervisor': 'Group Supervisor' };

function Sidebar() {
  const { user, entities, logout } = useAuth();
  const { openEntity, toggleEntity } = useUI();

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Logo */}
      <div className="flex items-center justify-center border-b border-pv-border px-4 py-4">
        <img src="/hadya-logo.png" alt="Hadya" className="h-14 w-auto" />
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto" aria-label="Main">
        <div className="px-2.5 pt-2.5 pb-1">
          <Label>Overview</Label>
          <NavLink to="/" end className={navCls}><span className="w-5 text-center text-[15px]" aria-hidden="true">◈</span> Dashboard & Analytics</NavLink>
        </div>

        <div className="mx-3 my-1.5 h-px bg-pv-border" />
        <p className="px-[18px] pt-1 pb-1.5 text-[9px] font-extrabold tracking-[.14em] text-pv-text4 uppercase">Entities</p>

        <div className="px-1.5">
          {entities.length === 0 && <p className="px-3 text-xs text-pv-text4">No entity access yet.</p>}
          {entities.map((e) => {
            const open = openEntity === e.code;
            return (
              <div key={e.id} className="mb-0.5">
                <button type="button" onClick={() => toggleEntity(e.code)} aria-expanded={open}
                  className={cx('flex w-full items-center gap-2 rounded-[7px] py-2 pr-3 pl-2.5 text-left text-[12.5px] font-bold transition',
                    open ? 'bg-[#f0f7ff] text-pv-accent' : 'text-pv-text2 hover:bg-pv-bg hover:text-pv-text')}>
                  <span className={cx('size-2 shrink-0 rounded-full', color(e.color).dot)} />
                  <span className="flex-1 truncate">{e.name}</span>
                  <span className={cx('text-[10px] text-pv-text4 transition', open && 'rotate-90')}>›</span>
                </button>
                {open && (
                  <div className="pt-0.5 pb-1">
                    {e.modules.length === 0 && <p className="py-1 pl-7 text-xs text-pv-text4">No modules assigned</p>}
                    {e.modules.map((m) => <NavLink key={m.slug} to={`/e/${e.code}/${m.slug}`} className={subCls}>{m.label}</NavLink>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {user?.isAdmin && (
          <>
            <div className="mx-3 mt-1.5 mb-1 h-px bg-pv-border" />
            <div className="px-2.5 pt-1 pb-2.5">
              <Label>Admin</Label>
              <NavLink to="/admin/entities" className={navCls}><span className="w-5 text-center" aria-hidden="true">⚙</span> Entities & Modules</NavLink>
              <NavLink to="/admin/users" className={navCls}><span className="w-5 text-center" aria-hidden="true">👥</span> Users & Roles</NavLink>
            </div>
          </>
        )}
      </nav>

      {/* User bar */}
      <div className="flex items-center gap-2.5 border-t border-pv-border px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-white/60 bg-pv-sand/20 text-[11px] font-extrabold text-pv-gold">{initials(user?.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-pv-text">{user?.name}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[10px] text-pv-text3">{ROLE_LABEL[user?.globalRole] || user?.email}</span>
            <button type="button" onClick={logout} className="text-[10px] font-bold tracking-[.05em] text-pv-text4 uppercase hover:text-pv-red">Logout</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useTitle(pathname, entities) {
  const m = pathname.match(/^\/e\/([^/]+)\/([^/]+)/);
  if (m) {
    const e = entities.find((x) => x.code === m[1]);
    const mod = e?.modules.find((x) => x.slug === m[2]);
    return { title: e ? e.name : 'Entity', sub: [e?.industry, mod?.label].filter(Boolean).join(' · ') };
  }
  if (pathname.startsWith('/admin/users')) return { title: 'Users & Roles', sub: 'Who can sign in and what they can see' };
  if (pathname.startsWith('/admin')) return { title: 'Entities & Modules', sub: 'Configure entities, modules and pipelines' };
  return { title: 'Group Overview', sub: `All ${entities.length} entities · Group Level` };
}

export default function AppShell() {
  const { entities, logout } = useAuth();
  const { sidebarOpen, setSidebar, setOpenEntity, toast } = useUI();
  const location = useLocation();
  const entityCode = location.pathname.match(/^\/e\/([^/]+)/)?.[1];
  const { title, sub } = useTitle(location.pathname, entities);

  useEffect(() => { setSidebar(false); }, [location.pathname, setSidebar]);
  useEffect(() => { if (entityCode) setOpenEntity(entityCode); }, [entityCode, setOpenEntity]);

  return (
    <div className="flex h-dvh overflow-hidden bg-pv-bg font-sans text-pv-text antialiased">
      {/* Desktop sidebar */}
      <aside className="hidden w-[228px] shrink-0 border-r border-pv-border shadow-[2px_0_8px_rgba(0,0,0,.06)] lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-[rgba(10,20,40,.35)]" onClick={() => setSidebar(false)} />
          <aside className="relative h-full w-[260px] max-w-[85vw] shadow-pv-lg"><Sidebar /></aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3.5 border-b border-pv-border bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,.06)] sm:px-6">
          <button type="button" className="rounded-md p-1.5 text-pv-text2 hover:bg-pv-bg lg:hidden" onClick={() => setSidebar(true)} aria-label="Open menu">☰</button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-pv-text">{title}</h1>
            {sub && <p className="mt-0.5 truncate text-[11px] font-medium text-pv-text3">{sub}</p>}
          </div>
          <button type="button" onClick={logout} className="rounded-lg border-[1.5px] border-pv-border2 bg-white px-3 py-1.5 text-xs font-bold text-pv-text2 shadow-pv-sm transition hover:bg-pv-bg">Logout</button>
        </header>
        <main className="flex-1 overflow-auto px-4 py-5 sm:px-7 sm:py-[26px]">
          <div key={location.pathname} className="motion-safe:animate-swipe-up">
            <Outlet />
          </div>
        </main>
      </div>

      {toast && (
        <div role="status" className={cx('fixed right-4 bottom-4 left-4 z-50 rounded-lg px-4 py-3 text-[13px] font-semibold text-white shadow-pv-md sm:left-auto sm:max-w-sm',
          toast.kind === 'error' ? 'bg-pv-red' : 'bg-pv-navy')}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
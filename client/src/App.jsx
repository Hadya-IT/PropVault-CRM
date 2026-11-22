import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import AppShell from './layout/AppShell';
import Login from './pages/Login';
import GroupOverview from './pages/GroupOverview';
import ModulePage from './pages/ModulePage';
import Entities from './pages/admin/Entities';
import EntityDetail from './pages/admin/EntityDetail';
import Users from './pages/admin/Users';
import { Spinner } from './components/ui';

function AdminOnly({ children }) {
  const isAdmin = useAuth((s) => s.user?.isAdmin);
  return isAdmin ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { status, bootstrap } = useAuth();
  useEffect(() => { bootstrap(); }, [bootstrap]);

  if (status === 'loading') return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  if (status === 'anonymous') return <Login />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<GroupOverview />} />
          <Route path="e/:entityCode/:slug" element={<ModulePage />} />
          <Route path="admin/entities" element={<AdminOnly><Entities /></AdminOnly>} />
          <Route path="admin/entities/:id" element={<AdminOnly><EntityDetail /></AdminOnly>} />
          <Route path="admin/users" element={<AdminOnly><Users /></AdminOnly>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { Loading } from './components/Loading';
import { BoardPage } from './pages/BoardPage';
import { EpicsPage } from './pages/EpicsPage';
import { LoginPage } from './pages/LoginPage';
import { ProjectLayout } from './pages/ProjectLayout';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SignupPage } from './pages/SignupPage';

function AuthEntryRedirect() {
  const { user, loading, needsSignup } = useAuth();
  if (loading || needsSignup === null) return <Loading />;
  if (user) return <Navigate to="/" replace />;
  if (needsSignup) return <Navigate to="/signup" replace />;
  return <Navigate to="/login" replace />;
}

function RequireAuth() {
  const { user, loading, needsSignup } = useAuth();
  if (loading || needsSignup === null) return <Loading />;
  if (!user) {
    return <Navigate to={needsSignup ? '/signup' : '/login'} replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth" element={<AuthEntryRedirect />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<ProjectsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<Navigate to="board" replace />} />
            <Route path="board" element={<BoardPage />} />
            <Route path="epics" element={<EpicsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<AuthEntryRedirect />} />
    </Routes>
  );
}

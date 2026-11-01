/**
 * App.jsx
 * ────────
 * Root application component.
 *
 * Route protection & Portal Separation (RBAC):
 *   <ProtectedRoute>                     — requires any authenticated user
 *   <ProtectedRoute allowedRoles={['STUDENT']}> — student portal only (teachers redirected to /teacher/dashboard)
 *   <ProtectedRoute allowedRoles={['TEACHER']}> — teacher portal only (students redirected to /dashboard)
 *   Super Admin (sababsanjid2@gmail.com / ADMIN / isSuperAdmin) bypasses all role restrictions.
 */

import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';

import LoginPage         from './pages/LoginPage';
import RegisterPage      from './pages/RegisterPage';
import StudentDashboard  from './pages/StudentDashboard';
import TeacherDashboard  from './pages/TeacherDashboard';
import TeacherProblemEditor from './pages/TeacherProblemEditor';
import ContestMonitor     from './pages/ContestMonitor';
import ProblemBankPage   from './pages/ProblemBankPage';
import ProblemDetailPage from './pages/ProblemDetailPage';
import ContestsHubPage         from './pages/ContestsHubPage';
import ContestDetailPage       from './pages/ContestDetailPage';
import ContestArenaPage        from './pages/ContestArenaPage';
import ContestLeaderboardPage  from './pages/ContestLeaderboardPage';
import SettingsPage            from './pages/SettingsPage';

// ── React Query client (shared, one instance) ─────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Route guards ─────────────────────────────────────────────────────────

/**
 * Route protection wrapper:
 *   - Checks authentication (redirects to /login if unauthenticated)
 *   - Checks allowedRoles / role:
 *     - If user is TEACHER attempting to access a student-only route -> redirect to /teacher/dashboard
 *     - If user is STUDENT attempting to access a teacher-only route -> redirect to /dashboard
 *     - Super Admin (sababsanjid2@gmail.com / isSuperAdmin / ADMIN) is allowed on ALL routes.
 */
function ProtectedRoute({ allowedRoles, role }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isSuper = Boolean(
    user.isSuperAdmin ||
    user.role === 'ADMIN' ||
    user.email?.toLowerCase() === 'sababsanjid2@gmail.com'
  );

  const roles = allowedRoles
    ? (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles])
    : (role ? [role] : null);

  if (roles && !roles.includes(user.role) && !isSuper) {
    if (user.role === 'TEACHER') {
      return <Navigate to="/teacher/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

/** Shell with Navbar — wraps authenticated pages. */
function AppShell() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          {/* Public routes — no Navbar, no auth required */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>

              {/* Student Portal Protected Routes */}
              <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
                <Route path="/dashboard" element={<StudentDashboard />} />
              </Route>

              {/* Common problem & contest exploration (accessible by all authenticated users) */}
              <Route path="/problems"     element={<ProblemBankPage />} />
              <Route path="/problems/:id" element={<ProblemDetailPage />} />
              <Route path="/contests"                   element={<ContestsHubPage />} />
              <Route path="/contests/:slug"             element={<ContestDetailPage />} />
              <Route path="/contests/:slug/leaderboard"  element={<ContestLeaderboardPage />} />

              {/* Account Settings & Profile Management */}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<SettingsPage />} />
              <Route path="/settings/remote-accounts" element={<SettingsPage />} />

              {/* Teacher Portal Protected Routes */}
              <Route element={<ProtectedRoute allowedRoles={['TEACHER']} />}>
                <Route path="/teacher" element={<TeacherDashboard />} />
                <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
                <Route path="/teacher/problems/new" element={<TeacherProblemEditor />} />
                <Route path="/teacher/problems/:id/edit" element={<TeacherProblemEditor />} />
                <Route path="/teacher/contests/:slug/monitor" element={<ContestMonitor />} />
                <Route path="/contests/:slug/monitor" element={<ContestMonitor />} />
              </Route>

              {/* Default role-based redirect */}
              <Route path="/" element={<RoleRedirect />} />

            </Route>

            {/* Dedicated full-screen competition arena */}
            <Route path="/contests/:slug/arena" element={<ContestArenaPage />} />
          </Route>

          {/* 404 Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/** Redirect / based on user role. */
function RoleRedirect() {
  const { user } = useAuth();
  return (
    <Navigate
      to={user?.role === 'TEACHER' ? '/teacher/dashboard' : '/dashboard'}
      replace
    />
  );
}

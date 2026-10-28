/**
 * App.jsx
 * ────────
 * Root application component.
 *
 * Route protection:
 *   <ProtectedRoute>          — requires any authenticated user
 *   <ProtectedRoute role="TEACHER"> — requires TEACHER role, redirects others
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
import ProblemBankPage   from './pages/ProblemBankPage';
import ProblemDetailPage from './pages/ProblemDetailPage';
import ContestsHubPage         from './pages/ContestsHubPage';
import ContestDetailPage       from './pages/ContestDetailPage';
import ContestArenaPage        from './pages/ContestArenaPage';
import ContestLeaderboardPage  from './pages/ContestLeaderboardPage';

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
 * Redirects to /login while the session is loading.
 * Once loaded: if not authenticated → /login; if wrong role → /problems.
 */
function ProtectedRoute({ role }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/problems" replace />;
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
      {/*
        AuthProvider is inside QueryClientProvider so AuthContext can
        invalidate queries (e.g., on logout) using the shared client.
      */}
      <AuthProvider>
        <Routes>
          {/* Public routes — no Navbar, no auth required */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>

              {/* Student & Problem routes */}
              <Route path="/dashboard"    element={<StudentDashboard />} />
              <Route path="/problems"     element={<ProblemBankPage />} />
              <Route path="/problems/:id" element={<ProblemDetailPage />} />

              {/* Contest routes */}
              <Route path="/contests"                   element={<ContestsHubPage />} />
              <Route path="/contests/:slug"             element={<ContestDetailPage />} />
              <Route path="/contests/:slug/leaderboard"  element={<ContestLeaderboardPage />} />

              {/* Teacher-only routes */}
              <Route element={<ProtectedRoute role="TEACHER" />}>
                <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
                <Route path="/teacher/problems/new" element={<TeacherProblemEditor />} />
                <Route path="/teacher/problems/:id/edit" element={<TeacherProblemEditor />} />
              </Route>

              {/* Default redirect */}
              <Route path="/" element={<RoleRedirect />} />

            </Route>

            {/* Dedicated full-screen competition arena */}
            <Route path="/contests/:slug/arena" element={<ContestArenaPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/** Redirect / based on role. */
function RoleRedirect() {
  const { user } = useAuth();
  return (
    <Navigate
      to={user?.role === 'TEACHER' ? '/teacher/dashboard' : '/dashboard'}
      replace
    />
  );
}

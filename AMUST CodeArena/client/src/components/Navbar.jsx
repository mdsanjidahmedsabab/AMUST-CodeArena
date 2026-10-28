/**
 * components/Navbar.jsx
 * ──────────────────────
 * Top navigation bar. Shows role-aware links and logout button.
 */

import { Link, NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, LogOut, User, Trophy } from 'lucide-react';
import ArenaLogo from './ArenaLogo';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  const linkCls = ({ isActive }) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
      isActive
        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
    }`;

  return (
    <nav className="bg-[#090d16]/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 text-white font-bold text-lg group">
            <ArenaLogo className="w-7 h-7 transition-transform group-hover:scale-105" />
            <span className="tracking-tight">
              AMUST <span className="bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">CodeArena</span>
            </span>
          </Link>

          {/* Nav links — shown when logged in */}
          {user && (
            <div className="flex items-center gap-1">
              <NavLink to="/problems" className={linkCls}>
                <BookOpen className="w-4 h-4" />
                Problems
              </NavLink>

              <NavLink to="/contests" className={linkCls}>
                <Trophy className="w-4 h-4 text-emerald-400" />
                Contests
              </NavLink>

              {user.role === 'TEACHER' && (
                <NavLink to="/teacher/dashboard" className={linkCls}>
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </NavLink>
              )}

              {user.role === 'STUDENT' && (
                <NavLink to="/dashboard" className={linkCls}>
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </NavLink>
              )}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="flex items-center gap-1.5 text-sm text-gray-400">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user.name}</span>
                  <span className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
                    {user.role}
                  </span>
                </span>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-gray-300
                             hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm
                           font-medium rounded-md transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}

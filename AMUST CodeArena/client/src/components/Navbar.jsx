/**
 * components/Navbar.jsx
 * ──────────────────────
 * Top navigation bar with role-based routing, responsive mobile menu,
 * and seamless Dev/Demo Role Switcher.
 */

import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  User,
  Trophy,
  BarChart3,
  GraduationCap,
  ChevronDown,
  Check,
  Sparkles,
} from 'lucide-react';
import ArenaLogo from './ArenaLogo';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout, switchRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsRoleMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleSwitch = async (targetRole) => {
    if (user?.role === targetRole) {
      setIsRoleMenuOpen(false);
      return;
    }
    setIsSwitchingRole(true);
    try {
      await switchRole(targetRole);
      setIsRoleMenuOpen(false);
      if (targetRole === 'TEACHER') {
        navigate('/teacher');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Failed to switch role in Navbar:', err);
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const linkCls = ({ isActive }) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
      isActive
        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
    }`;

  const teacherLinkCls = (isActive) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
      isActive
        ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm shadow-purple-500/10'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
    }`;

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const isCohortActive = location.pathname.startsWith('/teacher') && location.hash === '#cohort-heatmap';
  const isTeacherDashActive = location.pathname.startsWith('/teacher') && location.hash !== '#cohort-heatmap';

  return (
    <nav className="bg-[#090d16]/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Left: Brand */}
          <Link to="/" className="flex items-center gap-2.5 text-white font-bold text-lg group">
            <ArenaLogo className="w-7 h-7 transition-transform group-hover:scale-105" />
            <span className="tracking-tight">
              AMUST <span className="bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">CodeArena</span>
            </span>
          </Link>

          {/* Center: Nav links — shown when authenticated */}
          {user && (
            <div className="flex items-center gap-1">
              <NavLink to="/problems" className={linkCls}>
                <BookOpen className="w-4 h-4 text-slate-400" />
                <span>Problems</span>
              </NavLink>

              <NavLink to="/contests" className={linkCls}>
                <Trophy className="w-4 h-4 text-emerald-400" />
                <span>Contests</span>
              </NavLink>

              {/* Teacher links */}
              {isTeacher && (
                <>
                  <Link
                    to="/teacher"
                    className={teacherLinkCls(isTeacherDashActive)}
                  >
                    <GraduationCap className="w-4 h-4 text-purple-400" />
                    <span>Teacher Dashboard</span>
                  </Link>

                  <Link
                    to="/teacher#cohort-heatmap"
                    className={teacherLinkCls(isCohortActive)}
                  >
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                    <span>Cohort Heatmap</span>
                  </Link>
                </>
              )}

              {/* Student link */}
              {user.role === 'STUDENT' && (
                <NavLink to="/dashboard" className={linkCls}>
                  <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                  <span>Student Dashboard</span>
                </NavLink>
              )}
            </div>
          )}

          {/* Right: User status & Role switcher & Logout */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:flex items-center gap-1.5 text-sm text-slate-300 font-medium">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{user.name}</span>
                  </span>

                  {/* Interactive Dev Role Switcher */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-sm ${
                        user.role === 'TEACHER'
                          ? 'bg-purple-950/40 text-purple-300 border-purple-500/40 hover:bg-purple-900/40'
                          : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/40'
                      }`}
                      title="Click to switch between Student & Teacher roles (Dev / Demo Mode)"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          user.role === 'TEACHER' ? 'bg-purple-400' : 'bg-emerald-400'
                        } animate-pulse`}
                      />
                      <span>{user.role}</span>
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${
                          isRoleMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Dropdown Menu */}
                    {isRoleMenuOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl">
                        <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1.5 flex items-center justify-between">
                          <span>Role Switcher (Dev / Demo)</span>
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        </div>

                        {/* Switch to Student */}
                        <button
                          type="button"
                          onClick={() => handleRoleSwitch('STUDENT')}
                          disabled={isSwitchingRole}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                            user.role === 'STUDENT'
                              ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                            <div>
                              <div className="font-semibold text-white">STUDENT Portal</div>
                              <div className="text-[10px] text-slate-400">Problem solver & arena competitor</div>
                            </div>
                          </div>
                          {user.role === 'STUDENT' && (
                            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          )}
                        </button>

                        {/* Switch to Teacher */}
                        <button
                          type="button"
                          onClick={() => handleRoleSwitch('TEACHER')}
                          disabled={isSwitchingRole}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left mt-1 ${
                            user.role === 'TEACHER'
                              ? 'bg-purple-500/15 text-purple-300 font-bold border border-purple-500/30'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                            <div>
                              <div className="font-semibold text-white">TEACHER Portal</div>
                              <div className="text-[10px] text-slate-400">Heatmaps, monitoring & authoring</div>
                            </div>
                          </div>
                          {user.role === 'TEACHER' && (
                            <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                          )}
                        </button>

                        <div className="mt-2 pt-2 border-t border-slate-800/80 px-2.5 text-[10px] text-slate-500">
                          Switches database role & issues signed JWT automatically.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Sign out of CodeArena"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-emerald-950/40 transition-all"
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

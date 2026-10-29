/**
 * components/IcpcBalloonCelebration.jsx
 * ──────────────────────────────────────
 * Milestone 9: Live ICPC First-to-Solve Balloon & Celebration Modal/Banner.
 *
 * Features:
 *   - Authentic ICPC balloon color mapping by problem label (A: Red, B: Green, C: Yellow, etc.).
 *   - Animated floating 3D SVG balloon with specular highlight, knot, and swaying string.
 *   - Floating celebratory sparkle particles.
 *   - Sound chime trigger on appearance.
 *   - Dismissible with auto-fadeout after 6 seconds.
 */

import { useState, useEffect } from 'react';
import { Sparkles, Trophy, CheckCircle2, X } from 'lucide-react';
import { soundFx } from '../utils/audioEffects.js';

export const ICPC_BALLOON_COLORS = {
  A: { name: 'Red', bg: '#ef4444', gradient: 'from-red-500 to-rose-700', border: 'border-red-400', text: 'text-red-400' },
  B: { name: 'Green', bg: '#10b981', gradient: 'from-emerald-400 to-teal-700', border: 'border-emerald-400', text: 'text-emerald-400' },
  C: { name: 'Yellow', bg: '#eab308', gradient: 'from-amber-300 to-yellow-600', border: 'border-yellow-400', text: 'text-yellow-400' },
  D: { name: 'Blue', bg: '#3b82f6', gradient: 'from-sky-400 to-blue-700', border: 'border-blue-400', text: 'text-blue-400' },
  E: { name: 'Purple', bg: '#a855f7', gradient: 'from-fuchsia-400 to-purple-700', border: 'border-purple-400', text: 'text-purple-400' },
  F: { name: 'Orange', bg: '#f97316', gradient: 'from-amber-400 to-orange-700', border: 'border-orange-400', text: 'text-orange-400' },
  G: { name: 'Pink', bg: '#ec4899', gradient: 'from-pink-400 to-rose-700', border: 'border-pink-400', text: 'text-pink-400' },
  H: { name: 'Cyan', bg: '#06b6d4', gradient: 'from-teal-300 to-cyan-700', border: 'border-cyan-400', text: 'text-cyan-400' },
  I: { name: 'Indigo', bg: '#6366f1', gradient: 'from-indigo-400 to-violet-700', border: 'border-indigo-400', text: 'text-indigo-400' },
  J: { name: 'Lime', bg: '#84cc16', gradient: 'from-lime-400 to-green-700', border: 'border-lime-400', text: 'text-lime-400' },
};

export function getBalloonColor(label) {
  const norm = String(label || 'A').toUpperCase().trim();
  return ICPC_BALLOON_COLORS[norm] || {
    name: 'Gold',
    bg: '#f59e0b',
    gradient: 'from-amber-400 to-yellow-600',
    border: 'border-amber-400',
    text: 'text-amber-400',
  };
}

export default function IcpcBalloonCelebration({
  show,
  onClose,
  problemLabel = 'A',
  problemTitle = 'Problem',
  points = 100,
  solveCount = 1,
}) {
  const [animating, setAnimating] = useState(false);
  const colorInfo = getBalloonColor(problemLabel);

  useEffect(() => {
    if (show) {
      setAnimating(true);
      // Play celebratory chime
      soundFx.playAcceptedChime();

      // Auto dismiss after 6.5 seconds
      const timer = setTimeout(() => {
        setAnimating(false);
        setTimeout(onClose, 400);
      }, 6500);

      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
      {/* Background soft celebratory glow */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300" />

      {/* Main Floating Celebration Card */}
      <div
        className={`relative pointer-events-auto max-w-md w-full bg-slate-900/95 border-2 ${colorInfo.border} rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center transform transition-all duration-500 ${
          animating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
        style={{
          boxShadow: `0 0 60px -10px ${colorInfo.bg}50`,
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Floating Balloon Visual */}
        <div className="relative my-2 w-36 h-48 flex items-center justify-center">
          {/* Sparkles */}
          <Sparkles className="absolute -top-2 -left-2 w-6 h-6 text-amber-300 animate-bounce" />
          <Sparkles className="absolute top-8 -right-3 w-5 h-5 text-yellow-200 animate-pulse" />

          {/* 3D Balloon SVG */}
          <svg
            viewBox="0 0 100 130"
            className="w-full h-full filter drop-shadow-xl animate-pulse"
            style={{ animationDuration: '3s' }}
          >
            <defs>
              <linearGradient id={`balloon-grad-${problemLabel}`} x1="30%" y1="10%" x2="70%" y2="90%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                <stop offset="25%" stopColor={colorInfo.bg} />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.8" />
              </linearGradient>
              <radialGradient id={`balloon-highlight-${problemLabel}`} cx="35%" cy="30%" r="40%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Balloon Body */}
            <path
              d="M 50 10 C 20 10, 10 35, 10 60 C 10 82, 35 98, 46 104 L 54 104 C 65 98, 90 82, 90 60 C 90 35, 80 10, 50 10 Z"
              fill={`url(#balloon-grad-${problemLabel})`}
            />

            {/* Specular Highlight */}
            <ellipse cx="36" cy="38" rx="14" ry="22" fill={`url(#balloon-highlight-${problemLabel})`} />

            {/* Knot */}
            <polygon points="46,104 54,104 56,110 44,110" fill={colorInfo.bg} />

            {/* Swaying String */}
            <path
              d="M 50 110 Q 45 118, 52 124 T 48 132"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            {/* Problem Letter Stamped on Balloon */}
            <text
              x="50"
              y="68"
              textAnchor="middle"
              fontSize="28"
              fontWeight="900"
              fontFamily="monospace"
              fill="#ffffff"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
            >
              {problemLabel}
            </text>
          </svg>
        </div>

        {/* Badge & Banner */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-semibold uppercase tracking-wider text-amber-300 mb-2">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>ICPC Balloon Awarded</span>
        </div>

        <h3 className="text-xl font-black text-white flex items-center justify-center gap-2">
          <span>Problem {problemLabel} Solved!</span>
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </h3>

        <p className="text-sm text-slate-300 mt-1 max-w-xs font-medium truncate">
          {problemTitle}
        </p>

        <div className="mt-4 flex items-center justify-center gap-4 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-emerald-300">
            +{points} Points
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300">
            Balloon: <span className="font-bold text-white">{colorInfo.name}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg transition active:scale-95"
        >
          Continue Contest
        </button>
      </div>
    </div>
  );
}

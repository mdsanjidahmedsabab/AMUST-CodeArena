/**
 * components/ArenaLogo.jsx
 * ────────────────────────
 * Official AMUST CodeArena interlocking "AC" ribbon monogram.
 * Pure botanical/emerald green (#10b981 to #047857) with crisp silver-white
 * and bright mint highlights (#f8fafc to #a7f3d0) on a dark slate squircle tile.
 */

export default function ArenaLogo({ className = 'w-6 h-6' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <defs>
        {/* Dark Slate Background Squircle */}
        <linearGradient id="amustLogoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#090d16" />
          <stop offset="100%" stopColor="#0b1220" />
        </linearGradient>

        {/* Botanical Emerald Border Glow */}
        <linearGradient id="amustLogoBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#047857" stopOpacity="0.25" />
        </linearGradient>

        {/* Primary Emerald Ribbon (#10b981 to #047857) */}
        <linearGradient id="amustLogoEmerald" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#047857" />
          <stop offset="45%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>

        {/* Deep Botanical Green for Ribbon Folds & Underpasses */}
        <linearGradient id="amustLogoBotanicalDeep" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#065f46" />
          <stop offset="100%" stopColor="#022c22" />
        </linearGradient>

        {/* Crisp Silver-White / Bright Mint Highlight */}
        <linearGradient id="amustLogoSilverMint" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#a7f3d0" />
        </linearGradient>

        {/* 3D Over-Under Ribbon Depth Shadow */}
        <filter id="amustLogoShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.8" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.85" />
        </filter>
      </defs>

      {/* Dark Slate Background Squircle */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="16"
        fill="url(#amustLogoBg)"
        stroke="url(#amustLogoBorder)"
        strokeWidth="1.2"
      />

      {/* 1. C Ribbon Upper Backpass (Under A's right leg) */}
      <path
        d="M44 18C39 14.5 32 15 27 19.5"
        stroke="url(#amustLogoBotanicalDeep)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* 2. The Letter A Main Ribbon */}
      <path
        d="M16 48L28.5 13.5C29.2 11.5 32 11.5 32.8 13.5L44 48"
        stroke="url(#amustLogoEmerald)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 3. The Letter A Crossbar */}
      <path
        d="M21 35.5H38"
        stroke="url(#amustLogoEmerald)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* 4. C Ribbon Forepass (Sweeps in front of A's right leg) */}
      <path
        d="M44 18C49.5 22.5 51 28.5 51 33.5C51 40.5 46.5 48 39 49C31.5 50 24.5 46 22.5 40.5"
        stroke="url(#amustLogoEmerald)"
        strokeWidth="5.2"
        strokeLinecap="round"
        filter="url(#amustLogoShadow)"
      />

      {/* 5. Crisp Silver-White / Mint Highlights along Upper Inner Curves & Bevels */}
      {/* A Apex outer rim */}
      <path
        d="M28.5 13.5C29.2 11.5 32 11.5 32.8 13.5L35.5 20"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* A Apex inner curve bevel */}
      <path
        d="M25 23.5L30.5 14.5L34.5 23.5"
        stroke="url(#amustLogoSilverMint)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* C Upper inner curve highlight */}
      <path
        d="M32 19C36 16.5 41 16.5 45 19.5"
        stroke="url(#amustLogoSilverMint)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* C Shoulder crest highlight */}
      <path
        d="M43 17C47.5 20.5 49.5 25.5 49.5 30"
        stroke="url(#amustLogoSilverMint)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* C Lower inner curve highlight */}
      <path
        d="M36 45.5C41.5 45.5 45.5 41 45.5 34"
        stroke="url(#amustLogoSilverMint)"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
    </svg>
  );
}

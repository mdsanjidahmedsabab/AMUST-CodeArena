/**
 * components/ProctorWarningModal.jsx
 * ──────────────────────────────────
 * Progressive Warning Modal & Disqualification Alert (Milestone 6, REQ-10).
 */

import { AlertTriangle, ShieldAlert, XCircle, CheckCircle2, Maximize, AlertCircle } from 'lucide-react';

export default function ProctorWarningModal({
  modalState,
  onClose,
  integrityScore = 100,
  warningsCount = 0,
  isDisqualified = false,
  disqualifyReason = '',
  onEnterFullscreen = null,
  isFullscreen = false,
}) {
  if (isDisqualified) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-slate-950 border border-rose-600/80 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl shadow-rose-950/50">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mx-auto">
            <XCircle className="w-9 h-9" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Disqualified from Contest</h2>
            <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider">
              Contest Integrity Violation
            </p>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            {disqualifyReason || 'Multiple unacknowledged focus losses and paste anomalies were recorded by the proctoring engine.'}
          </p>
          <div className="text-[11px] text-slate-500">
            Your submissions for this battle have been frozen. If you believe this is an error, contact your course teacher or contest invigilator.
          </div>
        </div>
      </div>
    );
  }

  if (!modalState?.open) return null;

  const isLevel3 = modalState.level >= 3;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className={`bg-slate-950 border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl ${
          isLevel3 ? 'border-rose-600/80 shadow-rose-950/40' : 'border-amber-500/80 shadow-amber-950/40'
        }`}
      >
        {/* Header */}
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isLevel3
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
            }`}
          >
            {isLevel3 ? <ShieldAlert className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">{modalState.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{modalState.message}</p>
          </div>
        </div>

        {/* Integrity Score Meter */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Contest Integrity Meter</span>
            <span
              className={`font-mono font-bold ${
                integrityScore >= 80
                  ? 'text-emerald-400'
                  : integrityScore >= 50
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {integrityScore} / 100 ({warningsCount} warning{warningsCount === 1 ? '' : 's'})
            </span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                integrityScore >= 80
                  ? 'bg-emerald-500'
                  : integrityScore >= 50
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${integrityScore}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-500">
            Violations include tab-switching, leaving full screen, or sudden clipboard paste bursts.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {!isFullscreen && onEnterFullscreen && (
            <button
              onClick={onEnterFullscreen}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Maximize className="w-3.5 h-3.5" />
              <span>Enter Full Screen</span>
            </button>
          )}

          <button
            onClick={onClose}
            className={`ml-auto px-5 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-lg ${
              isLevel3
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/40'
                : 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/40'
            }`}
          >
            I Acknowledge & Return to Arena
          </button>
        </div>
      </div>
    </div>
  );
}

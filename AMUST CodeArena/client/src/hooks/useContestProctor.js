/**
 * hooks/useContestProctor.js
 * ──────────────────────────
 * Client-Side Contest Integrity Telemetry & Anti-Cheat Proctoring Hook (Milestone 6, REQ-10).
 *
 * Tracks:
 *   - Window blur & Tab-switch (document.visibilitychange)
 *   - Fullscreen exits (document.fullscreenchange)
 *   - Monaco code editor paste bursts (large copy-pastes)
 *   - Periodic student presence heartbeats (every 25s)
 *
 * Provides:
 *   - Progressive warning state machine (1: Advisory, 2: Critical Warning, 3+: Integrity Flag & Penalty).
 *   - Real-time disqualification listener & telemetry transmission.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/client';

export function useContestProctor({
  slug,
  enabled = true,
  isLive = true,
  onDisqualified = null,
}) {
  const [warningsCount, setWarningsCount] = useState(0);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [disqualifyReason, setDisqualifyReason] = useState(null);

  // Progressive Alert States
  const [advisoryBanner, setAdvisoryBanner] = useState(null);
  const [warningModal, setWarningModal] = useState({
    open: false,
    level: 0,
    title: '',
    message: '',
    severity: 'LOW',
  });

  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const blurTimestampRef = useRef(null);
  const isTransmittingRef = useRef(false);

  /**
   * Transmits a telemetry violation or heartbeat event to the backend.
   */
  const sendTelemetry = useCallback(
    async (eventType, metadata = {}, snapshotDiff = null) => {
      if (!enabled || !slug || !isLive || isTransmittingRef.current) return;

      try {
        isTransmittingRef.current = true;
        const { data } = await api.post(`/contests/${slug}/telemetry`, {
          eventType,
          metadata: {
            ...metadata,
            clientTimestamp: new Date().toISOString(),
          },
          snapshotDiff,
        });

        if (data) {
          if (data.isDisqualified) {
            setIsDisqualified(true);
            setDisqualifyReason(data.message || 'Disqualified by invigilator');
            if (typeof onDisqualified === 'function') onDisqualified();
          }

          if (data.warningLevel !== undefined) {
            setWarningsCount(data.warningLevel);
          }
          if (data.integrityScore !== undefined) {
            setIntegrityScore(data.integrityScore);
          }

          // Trigger progressive UI feedback based on warningLevel
          if (eventType !== 'HEARTBEAT') {
            if (data.warningLevel === 1) {
              setAdvisoryBanner({
                title: 'Advisory Note: Tab Switch Detected',
                message: 'AMUST CodeArena requires active focus during contests. Further tab switches will be logged.',
              });
              setTimeout(() => setAdvisoryBanner(null), 7000);
            } else if (data.warningLevel === 2) {
              setWarningModal({
                open: true,
                level: 2,
                title: '⚠️ Critical Warning (2/3): Integrity Violation',
                message:
                  'A window blur or fullscreen exit was recorded. You have 1 warning remaining before an official integrity flag and +20 minute ICPC penalty are applied.',
                severity: 'HIGH',
              });
            } else if (data.warningLevel >= 3) {
              setWarningModal({
                open: true,
                level: data.warningLevel,
                title: '🚨 Integrity Flag Triggered (3/3)',
                message:
                  'Multiple telemetry violations recorded. Your submissions have been flagged for invigilator review and an automatic +20 minute penalty has been applied.',
                severity: 'CRITICAL',
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Proctor Telemetry Error]', err.response?.data?.error || err.message);
      } finally {
        isTransmittingRef.current = false;
      }
    },
    [slug, enabled, isLive, onDisqualified]
  );

  // 1. Tab-Switch & Window Blur Detection
  useEffect(() => {
    if (!enabled || !isLive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurTimestampRef.current = Date.now();
      } else {
        if (blurTimestampRef.current) {
          const durationMs = Date.now() - blurTimestampRef.current;
          blurTimestampRef.current = null;
          // Ignore micro-glitches < 1200ms
          if (durationMs >= 1200) {
            sendTelemetry('TAB_SWITCH', {
              durationMs,
              durationSeconds: Math.round(durationMs / 1000),
            });
          }
        }
      }
    };

    const handleWindowBlur = () => {
      if (!blurTimestampRef.current) {
        blurTimestampRef.current = Date.now();
      }
    };

    const handleWindowFocus = () => {
      if (blurTimestampRef.current) {
        const durationMs = Date.now() - blurTimestampRef.current;
        blurTimestampRef.current = null;
        if (durationMs >= 2000) {
          sendTelemetry('WINDOW_BLUR', {
            durationMs,
            durationSeconds: Math.round(durationMs / 1000),
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [enabled, isLive, sendTelemetry]);

  // 2. Fullscreen Exit Detection
  useEffect(() => {
    if (!enabled || !isLive) return;

    const handleFullscreenChange = () => {
      const activeFs = Boolean(document.fullscreenElement);
      setIsFullscreen(activeFs);

      if (!activeFs) {
        sendTelemetry('FULLSCREEN_EXIT', {
          timestamp: Date.now(),
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [enabled, isLive, sendTelemetry]);

  // 3. Periodic Presence Heartbeat (Every 25s)
  useEffect(() => {
    if (!enabled || !isLive) return;

    // Send initial heartbeat
    sendTelemetry('HEARTBEAT');

    const interval = setInterval(() => {
      sendTelemetry('HEARTBEAT');
    }, 25000);

    return () => clearInterval(interval);
  }, [enabled, isLive, sendTelemetry]);

  // 4. Monaco Paste Burst Handler
  const handlePasteBurst = useCallback(
    (pastedText, codeContext = '') => {
      if (!pastedText) return;
      const len = pastedText.length;
      const lines = pastedText.split('\n').length;

      // Flag paste bursts larger than 250 characters
      if (len >= 250) {
        sendTelemetry(
          'PASTE_BURST',
          {
            pasteLength: len,
            linesCount: lines,
            snippetPreview: pastedText.slice(0, 100) + '...',
          },
          pastedText.slice(0, 500)
        );
      }
    },
    [sendTelemetry]
  );

  // Request Fullscreen helper
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      // ignore
    }
  };

  const closeWarningModal = () => {
    setWarningModal((prev) => ({ ...prev, open: false }));
  };

  return {
    warningsCount,
    integrityScore,
    isDisqualified,
    disqualifyReason,
    advisoryBanner,
    setAdvisoryBanner,
    warningModal,
    closeWarningModal,
    isFullscreen,
    enterFullscreen,
    handlePasteBurst,
    sendTelemetry,
  };
}

export default useContestProctor;

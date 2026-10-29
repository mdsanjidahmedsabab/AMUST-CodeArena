/**
 * utils/editorKeybindings.js
 * ──────────────────────────
 * Clean Keybinding Mappings for Monaco Editor (Vim, Emacs, Normal).
 * Provides modal Vim state (NORMAL, INSERT) and Emacs navigation without external runtime dependencies.
 * Hardened with try/catch fallbacks so editor typing is never blocked.
 */

export function attachKeybindings(editor, monaco, mode, onModeChange) {
  if (!editor || !monaco || !mode || mode === 'normal') {
    if (typeof onModeChange === 'function') {
      try {
        onModeChange('NORMAL');
      } catch {}
    }
    return () => {};
  }

  const disposables = [];
  let vimSubMode = 'NORMAL'; // 'NORMAL' | 'INSERT'

  const notify = (m) => {
    vimSubMode = m;
    if (typeof onModeChange === 'function') {
      try {
        onModeChange(m);
      } catch (err) {
        console.warn('onModeChange error:', err);
      }
    }
  };

  try {
    if (mode === 'vim') {
      notify('NORMAL');

      // In Vim mode, intercept keys according to modal state
      const keyListener = editor.onKeyDown((e) => {
        try {
          const keyCode = e.keyCode;
          const browserEvent = e.browserEvent;
          if (!browserEvent) return;

          if (vimSubMode === 'INSERT') {
            if (keyCode === monaco.KeyCode.Escape || browserEvent.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              notify('NORMAL');
            }
            return;
          }

          // ── NORMAL MODE COMMANDS ──
          if (vimSubMode === 'NORMAL') {
            // Allow CP shortcut combinations (Ctrl+Enter, Ctrl+Alt+Enter, Ctrl+C, Ctrl+V, etc.) to pass through
            if (browserEvent.ctrlKey || browserEvent.metaKey || browserEvent.altKey) {
              return;
            }

            const key = browserEvent.key;

            // Mode Switching
            if (key === 'i') {
              e.preventDefault();
              notify('INSERT');
              return;
            }
            if (key === 'a') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'cursorRight', {});
              } catch {}
              notify('INSERT');
              return;
            }
            if (key === 'o') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'editor.action.insertLineAfter', {});
              } catch {}
              notify('INSERT');
              return;
            }
            if (key === 'O') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'editor.action.insertLineBefore', {});
              } catch {}
              notify('INSERT');
              return;
            }
            if (key === 'Escape') {
              e.preventDefault();
              notify('NORMAL');
              return;
            }

            // Navigation
            if (key === 'h') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'cursorLeft', {});
              } catch {}
              return;
            }
            if (key === 'j') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'cursorDown', {});
              } catch {}
              return;
            }
            if (key === 'k') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'cursorUp', {});
              } catch {}
              return;
            }
            if (key === 'l') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'cursorRight', {});
              } catch {}
              return;
            }
            if (key === 'w') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'cursorWordStartRight', {});
              } catch {}
              return;
            }
            if (key === 'b') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'cursorWordStartLeft', {});
              } catch {}
              return;
            }
            if (key === '0') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'cursorLineStart', {});
              } catch {}
              return;
            }
            if (key === '$') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'cursorLineEnd', {});
              } catch {}
              return;
            }
            if (key === 'G') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'cursorBottom', {});
              } catch {}
              return;
            }

            // Editing
            if (key === 'x') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'deleteRight', {});
              } catch {}
              return;
            }
            if (key === 'u') {
              e.preventDefault();
              try {
                editor.trigger('vim', 'undo', {});
              } catch {}
              return;
            }
          }
        } catch (err) {
          console.warn('Vim keyListener caught error:', err);
        }
      });

      disposables.push(keyListener);
    } else if (mode === 'emacs') {
      notify('EMACS');

      // Emacs key combinations
      const emacsBindings = [
        { key: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA, action: 'cursorLineStart' },
        { key: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE, action: 'cursorLineEnd' },
        { key: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, action: 'deleteAllRight' },
        { key: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, action: 'cursorUp' },
        { key: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, action: 'cursorDown' },
        { key: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, action: 'cursorRight' },
        { key: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, action: 'cursorLeft' },
        { key: monaco.KeyMod.Alt | monaco.KeyCode.KeyF, action: 'cursorWordStartRight' },
        { key: monaco.KeyMod.Alt | monaco.KeyCode.KeyB, action: 'cursorWordStartLeft' },
        { key: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, action: 'deleteRight' },
        { key: monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, action: 'undo' },
      ];

      emacsBindings.forEach(({ key, action }) => {
        try {
          const disp = editor.addAction({
            id: `emacs-${action}-${key}`,
            label: `Emacs: ${action}`,
            keybindings: [key],
            run: (ed) => {
              try {
                ed.trigger('emacs', action, {});
              } catch {}
            },
          });
          disposables.push(disp);
        } catch (err) {
          console.warn(`Failed to bind Emacs action ${action}:`, err);
        }
      });
    } else {
      notify('NORMAL');
    }
  } catch (err) {
    console.warn('Error configuring keybinding mode:', err);
    notify('NORMAL');
  }

  return () => {
    disposables.forEach((d) => {
      try {
        if (typeof d?.dispose === 'function') {
          d.dispose();
        }
      } catch (err) {
        console.warn('Keybinding disposal error:', err);
      }
    });
  };
}

/**
 * components/CodeEditor.jsx
 * ─────────────────────────
 * Milestone 9 & Critical Fix: Polished Competitive-Programming Monaco Editor Workspace.
 *
 * Implements:
 *   1. Explicit Pixel/VH Height Fallbacks: Guaranteed non-zero container bounds (min-height 500px, height 100%).
 *   2. Guaranteed Starter Template: C++20 standard template immediately loaded if code state is empty/undefined.
 *   3. Forced Layout & Focus: Scheduled layout recalculation on mount, window resize, and tab change.
 *   4. Themes: vs-dark (safe default), monokai, dracula, one-dark.
 *   5. Keybindings: Normal (standard cursor), Vim, and Emacs modes with mode indicator.
 *   6. Shortcuts: Ctrl+Enter / Cmd+Enter (Run) and Ctrl+Alt+Enter (Submit).
 */

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Code2,
  Palette,
  Keyboard,
  Type,
  AlignLeft,
  RotateCcw,
  Sparkles,
  Play,
  Send,
  HelpCircle,
} from 'lucide-react';
import { THEME_OPTIONS, registerMonacoThemes } from '../utils/monacoThemes.js';
import { attachKeybindings } from '../utils/editorKeybindings.js';

export const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 22];

export const DEFAULT_STARTER_TEMPLATES = {
  cpp: `#include <iostream>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Write your solution here
    
    return 0;
}
`,
  c: `#include <stdio.h>

int main() {
    // Write your solution here
    
    return 0;
}
`,
  python: `import sys

def solve():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    # Write your solution here

if __name__ == '__main__':
    solve()
`,
  java: `import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your solution here

        sc.close();
    }
}
`,
  javascript: `const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
    if (!input || input.length === 0 || input[0] === '') return;

    // Write your solution here
}

solve();
`,
};

export function getDefaultTemplate(lang) {
  return DEFAULT_STARTER_TEMPLATES[lang] || DEFAULT_STARTER_TEMPLATES.cpp;
}

export default function CodeEditor({
  value,
  onChange,
  language = 'cpp',
  onLanguageChange,
  languageOptions = [],
  onRun,
  onSubmit,
  onReset,
  onPaste,
  readOnly = false,
  autoFocus = true,
  extraHeaderActions = null,
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const keybindingDisposerRef = useRef(null);

  // ── Persistent Preferences with Safe Fallbacks ──────────────────────────────
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('codearena_editor_theme');
      if (saved && THEME_OPTIONS.some((t) => t.id === saved)) {
        return saved;
      }
    } catch {}
    return 'vs-dark';
  });

  const [fontSize, setFontSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('codearena_font_size'));
      return saved && FONT_SIZES.includes(saved) ? saved : 14;
    } catch {
      return 14;
    }
  });

  const [keybindingMode, setKeybindingMode] = useState(() => {
    try {
      const saved = localStorage.getItem('codearena_keybinding');
      if (saved && ['normal', 'vim', 'emacs'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'normal';
  });

  const [subModeState, setSubModeState] = useState('NORMAL');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // ── Guaranteed Starter Template on Initial Load ─────────────────────────────
  // If value is undefined, null, or empty, fallback immediately to language template
  const activeCode =
    typeof value === 'string' && value.trim().length > 0
      ? value
      : getDefaultTemplate(language);

  // ── Handlers & Preference Persistence ──────────────────────────────────────
  const handleThemeChange = (newTheme) => {
    const validTheme = THEME_OPTIONS.some((t) => t.id === newTheme) ? newTheme : 'vs-dark';
    setTheme(validTheme);
    try {
      localStorage.setItem('codearena_editor_theme', validTheme);
      if (monacoRef.current) {
        monacoRef.current.editor.setTheme(validTheme);
      }
    } catch {}
  };

  const handleFontSizeChange = (size) => {
    setFontSize(size);
    try {
      localStorage.setItem('codearena_font_size', size);
      if (editorRef.current) {
        editorRef.current.updateOptions({ fontSize: size });
      }
    } catch {}
  };

  const handleKeybindingChange = (mode) => {
    const validMode = ['normal', 'vim', 'emacs'].includes(mode) ? mode : 'normal';
    setKeybindingMode(validMode);
    try {
      localStorage.setItem('codearena_keybinding', validMode);
    } catch {}
    rebindKeys(validMode);
  };

  const rebindKeys = (mode) => {
    if (keybindingDisposerRef.current) {
      try {
        keybindingDisposerRef.current();
      } catch (err) {
        console.warn('Keybinding disposal error:', err);
      }
      keybindingDisposerRef.current = null;
    }

    if (!mode || mode === 'normal') {
      setSubModeState('NORMAL');
      return;
    }

    if (editorRef.current && monacoRef.current) {
      try {
        keybindingDisposerRef.current = attachKeybindings(
          editorRef.current,
          monacoRef.current,
          mode,
          setSubModeState
        );
      } catch (err) {
        console.error(`Failed to attach ${mode} keybindings, reverting to normal:`, err);
        setKeybindingMode('normal');
        try {
          localStorage.setItem('codearena_keybinding', 'normal');
        } catch {}
        setSubModeState('NORMAL');
      }
    }
  };

  const handleFormatCode = () => {
    if (editorRef.current) {
      try {
        editorRef.current.getAction('editor.action.formatDocument')?.run();
      } catch {}
    }
  };

  // ── Monaco Initialization & Forced Layout Recalculation ─────────────────────
  const handleBeforeMount = (monaco) => {
    try {
      registerMonacoThemes(monaco);
    } catch (err) {
      console.warn('Failed to register custom themes:', err);
    }
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Apply configured theme safely with vs-dark fallback
    try {
      const activeTheme = THEME_OPTIONS.some((t) => t.id === theme) ? theme : 'vs-dark';
      monaco.editor.setTheme(activeTheme);
    } catch {
      try {
        monaco.editor.setTheme('vs-dark');
      } catch {}
    }

    // Track Cursor Position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });

    // Paste Telemetry (Anti-Cheat Ingestion)
    editor.onDidPaste((e) => {
      if (typeof onPaste === 'function') {
        try {
          const model = editor.getModel();
          const pastedText = model?.getValueInRange(e.range) || '';
          onPaste({
            pastedText,
            characterCount: pastedText.length,
            lineCount: e.range.endLineNumber - e.range.startLineNumber + 1,
          });
        } catch {}
      }
    });

    // Register CP Keyboard Shortcuts inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (typeof onRun === 'function') {
        onRun();
      }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Enter, () => {
      if (typeof onSubmit === 'function') {
        onSubmit();
      }
    });

    // Attach initial keybindings safely
    rebindKeys(keybindingMode);

    // Force layout on mount (immediate + delayed ticks)
    try {
      editor.layout();
      if (autoFocus) {
        editor.focus();
      }
    } catch {}

    const timer1 = setTimeout(() => {
      try {
        editor.layout();
        if (autoFocus) {
          editor.focus();
        }
      } catch {}
    }, 100);

    const timer2 = setTimeout(() => {
      try {
        editor.layout();
      } catch {}
    }, 300);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  };

  // ── Automatic Window Resize & Layout Sync ──────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      try {
        editorRef.current?.layout();
      } catch {}
    };

    window.addEventListener('resize', handleResize);

    const initialTimer = setTimeout(() => {
      try {
        editorRef.current?.layout();
        if (autoFocus) {
          editorRef.current?.focus();
        }
      } catch {}
    }, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(initialTimer);
      if (keybindingDisposerRef.current) {
        try {
          keybindingDisposerRef.current();
        } catch {}
      }
    };
  }, [autoFocus]);

  // Sync layout whenever language changes
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        editorRef.current?.layout();
      } catch {}
    }, 50);
    return () => clearTimeout(timer);
  }, [language]);

  const monacoLang =
    languageOptions.find((l) => l.value === language)?.monaco || language;

  return (
    <div
      className="flex flex-col h-full min-h-[500px] flex-1 w-full bg-slate-950/60 relative overflow-hidden select-text"
      style={{ minHeight: '500px', height: '100%' }}
    >
      {/* ── Toolbar Header ─────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/80 flex flex-wrap items-center justify-between gap-2.5 shrink-0 backdrop-blur-md select-none">
        {/* Left: Language & Code Reset */}
        <div className="flex items-center gap-2">
          {languageOptions.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              <select
                value={language}
                onChange={(e) => onLanguageChange && onLanguageChange(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
              >
                {languageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {onReset && (
            <button
              onClick={onReset}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800/60"
              title="Reset to starter template"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>

        {/* Right: Theme, Keybindings, Font Size & Format */}
        <div className="flex items-center gap-2">
          {/* Format Code */}
          <button
            onClick={handleFormatCode}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/50 transition"
            title="Auto-format code (Shift+Alt+F)"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>

          {/* Font Size Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-0.5">
            <Type className="w-3 h-3 text-slate-400 mr-1" />
            <select
              value={fontSize}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              className="bg-transparent text-[11px] font-mono text-slate-300 focus:outline-none cursor-pointer"
              title="Font Size"
            >
              {FONT_SIZES.map((sz) => (
                <option key={sz} value={sz} className="bg-slate-900">
                  {sz}px
                </option>
              ))}
            </select>
          </div>

          {/* Theme Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-0.5">
            <Palette className="w-3 h-3 text-slate-400 mr-1" />
            <select
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="bg-transparent text-[11px] font-medium text-slate-300 focus:outline-none cursor-pointer"
              title="Editor Theme"
            >
              {THEME_OPTIONS.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900">
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Keybinding Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-0.5">
            <Keyboard className="w-3 h-3 text-slate-400 mr-1" />
            <select
              value={keybindingMode}
              onChange={(e) => handleKeybindingChange(e.target.value)}
              className="bg-transparent text-[11px] font-medium text-slate-300 focus:outline-none cursor-pointer"
              title="Keybinding Mode"
            >
              <option value="normal" className="bg-slate-900">Normal</option>
              <option value="vim" className="bg-slate-900">Vim</option>
              <option value="emacs" className="bg-slate-900">Emacs</option>
            </select>
          </div>

          {/* Shortcut Help Toggle */}
          <button
            onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Keyboard Shortcuts"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {extraHeaderActions}
        </div>
      </div>

      {/* ── Shortcuts Quick Legend Modal ────────────────────────────────────── */}
      {showShortcutsHelp && (
        <div className="absolute top-12 right-4 z-40 w-72 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-xs text-slate-300 animate-in fade-in duration-200 select-none">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
              CP Shortcuts
            </span>
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="text-slate-500 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 font-mono text-[11px]">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
              <span className="text-slate-400 font-sans">Run Custom Input:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                Ctrl + Enter
              </kbd>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
              <span className="text-slate-400 font-sans">Submit Solution:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                Ctrl + Alt + Enter
              </kbd>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
              <span className="text-slate-400 font-sans">Format Code:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Shift + Alt + F
              </kbd>
            </div>
            {keybindingMode === 'vim' && (
              <div className="pt-2 text-[10px] text-amber-300 font-sans">
                💡 Vim mode active: Press <kbd className="px-1 bg-slate-800 rounded">i</kbd> for Insert, <kbd className="px-1 bg-slate-800 rounded">Esc</kbd> for Normal mode.
              </div>
            )}
            {keybindingMode === 'emacs' && (
              <div className="pt-2 text-[10px] text-indigo-300 font-sans">
                💡 Emacs mode active: <kbd className="px-1 bg-slate-800 rounded">Ctrl+A</kbd> Start, <kbd className="px-1 bg-slate-800 rounded">Ctrl+E</kbd> End, <kbd className="px-1 bg-slate-800 rounded">Ctrl+K</kbd> Kill.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Monaco Editor Instance Container (Guaranteed Explicit Non-Flex Viewport Bounds) ──── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: 'calc(100vh - 280px)', minHeight: '450px' }}
      >
        <Editor
          height="100%"
          width="100%"
          theme={theme || 'vs-dark'}
          language={monacoLang || 'cpp'}
          value={activeCode}
          onChange={(val) => onChange && onChange(val ?? '')}
          beforeMount={handleBeforeMount}
          onMount={handleEditorMount}
          loading={
            <div
              className="flex items-center justify-center h-full w-full bg-slate-950 text-slate-400 font-mono text-xs"
              style={{ height: 'calc(100vh - 280px)', minHeight: '450px' }}
            >
              <div className="w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mr-2" />
              Loading Code Editor...
            </div>
          }
          options={{
            readOnly,
            fontSize: fontSize || 14,
            fontFamily: `'JetBrains Mono', 'Fira Code', Consolas, monospace`,
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12 },
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            tabSize: 4,
            renderLineHighlight: 'line',
            automaticLayout: true,
            cursorBlinking: 'smooth',
            bracketPairColorization: { enabled: true },
            fixedOverflowWidgets: true,
          }}
        />
      </div>

      {/* ── Status Bar ─────────────────────────────────────────────────────── */}
      <div className="px-3 py-1.5 border-t border-slate-800/80 bg-slate-900/90 text-[11px] font-mono text-slate-400 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          {/* Keybinding Mode Badge */}
          {keybindingMode === 'vim' && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                subModeState === 'INSERT'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              Vim: {subModeState}
            </span>
          )}
          {keybindingMode === 'emacs' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              Emacs
            </span>
          )}
          {keybindingMode === 'normal' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500">
              Normal
            </span>
          )}

          {/* Active Theme & Font */}
          <span className="hidden sm:inline text-slate-500">
            {THEME_OPTIONS.find((t) => t.id === theme)?.name || 'VS Dark'} • {fontSize}px
          </span>
        </div>

        {/* Cursor Position & Shortcut Hint */}
        <div className="flex items-center gap-4 text-slate-400">
          <span className="hidden md:inline text-slate-500 text-[10px]">
            Ctrl+Enter: Run | Ctrl+Alt+Enter: Submit
          </span>
          <span className="font-semibold text-slate-300">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
        </div>
      </div>
    </div>
  );
}

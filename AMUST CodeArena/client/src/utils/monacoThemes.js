/**
 * utils/monacoThemes.js
 * ─────────────────────
 * Custom Monaco Editor Color Themes for AMUST CodeArena:
 *   - vs-dark (Monaco built-in)
 *   - monokai (Classic Monokai dark)
 *   - dracula (Dracula official color palette)
 *   - one-dark (Atom One Dark color palette)
 */

export const THEME_OPTIONS = [
  { id: 'vs-dark', name: 'VS Dark', bg: '#1e1e1e', fg: '#d4d4d4', accent: '#007acc' },
  { id: 'monokai', name: 'Monokai', bg: '#272822', fg: '#f8f8f2', accent: '#a6e22e' },
  { id: 'dracula', name: 'Dracula', bg: '#282a36', fg: '#f8f8f2', accent: '#bd93f9' },
  { id: 'one-dark', name: 'One Dark', bg: '#282c34', fg: '#abb2bf', accent: '#61afef' },
];

export function registerMonacoThemes(monaco) {
  if (!monaco || !monaco.editor) return;

  // 1. Monokai Theme
  monaco.editor.defineTheme('monokai', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'F8F8F2', background: '272822' },
      { token: 'comment', foreground: '75715E', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'F92672', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'F8F8F2' },
      { token: 'string', foreground: 'E6DB74' },
      { token: 'number', foreground: 'AE81FF' },
      { token: 'type', foreground: '66D9EF', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'F8F8F2' },
      { token: 'operator', foreground: 'F92672' },
      { token: 'function', foreground: 'A6E22E' },
    ],
    colors: {
      'editor.background': '#272822',
      'editor.foreground': '#F8F8F2',
      'editorCursor.foreground': '#F8F8F0',
      'editor.lineHighlightBackground': '#3E3D32',
      'editorLineNumber.foreground': '#90908A',
      'editorLineNumber.activeForeground': '#C2C2BF',
      'editor.selectionBackground': '#49483E',
      'editor.inactiveSelectionBackground': '#383830',
    },
  });

  // 2. Dracula Theme
  monaco.editor.defineTheme('dracula', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'F8F8F2', background: '282A36' },
      { token: 'comment', foreground: '6272A4', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'FF79C6', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'F8F8F2' },
      { token: 'string', foreground: 'F1FA8C' },
      { token: 'number', foreground: 'BD93F9' },
      { token: 'type', foreground: '8BE9FD', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'F8F8F2' },
      { token: 'operator', foreground: 'FF79C6' },
      { token: 'function', foreground: '50FA7B' },
    ],
    colors: {
      'editor.background': '#282A36',
      'editor.foreground': '#F8F8F2',
      'editorCursor.foreground': '#AEAFAD',
      'editor.lineHighlightBackground': '#44475A75',
      'editorLineNumber.foreground': '#6272A4',
      'editorLineNumber.activeForeground': '#F8F8F2',
      'editor.selectionBackground': '#44475A',
      'editor.inactiveSelectionBackground': '#44475A50',
    },
  });

  // 3. One Dark Theme
  monaco.editor.defineTheme('one-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'ABB2BF', background: '282C34' },
      { token: 'comment', foreground: '5C6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'C678DD', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'E06C75' },
      { token: 'string', foreground: '98C379' },
      { token: 'number', foreground: 'D19A66' },
      { token: 'type', foreground: 'E5C07B', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'ABB2BF' },
      { token: 'operator', foreground: '56B6C2' },
      { token: 'function', foreground: '61AFEF' },
    ],
    colors: {
      'editor.background': '#282C34',
      'editor.foreground': '#ABB2BF',
      'editorCursor.foreground': '#528BFF',
      'editor.lineHighlightBackground': '#2C313C',
      'editorLineNumber.foreground': '#4B5263',
      'editorLineNumber.activeForeground': '#ABB2BF',
      'editor.selectionBackground': '#3E4451',
      'editor.inactiveSelectionBackground': '#3E445170',
    },
  });
}

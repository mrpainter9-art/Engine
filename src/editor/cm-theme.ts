import { EditorView } from 'codemirror';

// Code editor colours matched to the editor's dark theme.
export const oneDarkish = EditorView.theme({
  '&': { color: '#d7dbe3', backgroundColor: '#1d2229', height: '100%', fontSize: '13px' },
  '.cm-content': { caretColor: '#e0e4ec', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
  '.cm-gutters': { backgroundColor: '#1d2229', color: '#5d6573', border: 'none' },
  '.cm-activeLine': { backgroundColor: '#252b34' },
  '.cm-activeLineGutter': { backgroundColor: '#252b34' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#35506e !important' },
  '.cm-cursor': { borderLeftColor: '#e0e4ec' },
  '.cm-scroller': { overflow: 'auto' },
}, { dark: true });

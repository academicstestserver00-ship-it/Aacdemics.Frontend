
import { Editor } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';

export default function CodeEditor({
  code,
  onChange,
  language,
  readOnly = false,
  disablePaste = true,
  onPasteBlocked,
  onPasteDetected,
}) {
  const editorRef = useRef(null);
  const lastValueRef = useRef(code ?? '');

  // Map our language names to Monaco language IDs
  const getMonacoLanguage = (lang) => {
    const languageMap = {
      'python': 'python',
      'c': 'c',
      'java': 'java',
      'cpp': 'cpp',
    };
    return languageMap[lang] || 'python';
  };

  const handlePasteBlocked = () => {
    if (typeof onPasteBlocked === 'function') onPasteBlocked();
  };

  const handlePasteDetected = () => {
    if (typeof onPasteDetected === 'function') onPasteDetected();
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    lastValueRef.current = editor.getValue();

    if (disablePaste) {
      // Block common paste shortcuts
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
        handlePasteBlocked();
      });
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Insert, () => {
        handlePasteBlocked();
      });

      // If paste somehow gets through, undo it immediately
      editor.onDidPaste(() => {
        try {
          editor.trigger('keyboard', 'undo', null);
        } catch {
          editor.setValue(lastValueRef.current || '');
        }
        handlePasteBlocked();
      });
    }
  };

  useEffect(() => {
    lastValueRef.current = code ?? '';
  }, [code]);

  const handleChange = (value) => {
    const next = value ?? '';
    lastValueRef.current = next;
    onChange?.(next);
  };

  return (
    <div
      style={{ height: '100%', background: '#fff', border: '1px solid #e0e0e0' }}
      onPasteCapture={(e) => {
        handlePasteDetected();
        if (!disablePaste) return;
        e.preventDefault();
        handlePasteBlocked();
      }}
    >
      <Editor
        key={disablePaste ? 'paste-blocked' : 'paste-allowed'}
        height="100%"
        language={getMonacoLanguage(language)}
        value={code}
        onChange={handleChange}
        theme="vs-light"
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          readOnly: readOnly,
          wordWrap: 'on',
          fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
          lineHeight: 22,
          padding: { top: 16, bottom: 16 },
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
      />
    </div>
  );
}

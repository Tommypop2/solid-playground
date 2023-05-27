import { Component, createEffect, createSignal, on } from 'solid-js';
import {
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  keymap,
  ViewUpdate,
} from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldKeymap,
} from '@codemirror/language';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { Diagnostic, lintKeymap, linter, setDiagnostics } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { throttle } from '@solid-primitives/scheduled';
import { LinterWorkerPayload, LinterWorkerResponse } from '../../workers/linter';
import { useAppContext } from '../../../playground/context';

const CM6Editor: Component<{
  url: string;
  disabled?: true;
  isDark?: boolean;
  withMinimap?: boolean;
  formatter?: Worker;
  linter?: Worker;
  displayErrors?: boolean;
  onDocChange?: (code: string) => void;
  onEditorReady?: any;
}> = (props) => {
  const appCtx = useAppContext();
  const getContents = (url: string) => {
    const fileName = url.split('/').at(-1);
    const contents = appCtx?.tabs()?.find((tab) => tab.name === fileName)?.source;
    return contents;
  };
  const [editorRef, setEditorRef] = createSignal<HTMLDivElement>();
  let CMView: EditorView | undefined;
  const runLinter = throttle((code: string) => {
    if (props.linter && props.displayErrors) {
      const payload: LinterWorkerPayload = {
        event: 'LINT',
        code,
      };
      props.linter.postMessage(payload);
    }
  }, 250);
  createEffect(
    on(
      () => props.url,
      (url) => {
        if (!CMView) return;
        const contents = getContents(url);
        const update = CMView.state.update({ changes: { from: 0, to: CMView.state.doc.length, insert: contents } });
        CMView.update([update]);
      },
    ),
  );
  const listener = ({ data }: MessageEvent<LinterWorkerResponse>) => {
    if (props.displayErrors) {
      const { event } = data;
      if (event === 'LINT') {
        const issues = data.markers;
        const diagnostics: Diagnostic[] = issues.map((issue) => {
          let severity: 'info' | 'warning' | 'error' = 'info';
          const issueSeverity = issue.severity;
          switch (issueSeverity) {
            case 2:
              severity = 'info';
            case 4:
              severity = 'warning';
            case 8:
              severity = 'error';
          }
          const startLine = CMView?.state.doc.line(issue.startLineNumber);
          const startChar = startLine?.from! + issue.startColumn;
          const endLine = CMView?.state.doc.line(issue.endLineNumber);
          const endChar = endLine?.from! + issue.endColumn;
          return { from: startChar, to: endChar, severity: severity, source: issue.source, message: issue.message };
        });
        CMView?.dispatch(setDiagnostics(CMView.state, diagnostics));
      } else if (event === 'FIX') {
      }
    }
  };
  props.linter?.addEventListener('message', listener);
  createEffect(
    on(editorRef, () => {
      let startState = EditorState.create({
        doc: getContents(props.url),
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...lintKeymap,
          ]),
          javascript({ jsx: true, typescript: true }),
          EditorView.updateListener.of((v: ViewUpdate) => {
            if (!v.docChanged) return;
            const code = v.state.doc.toString();
            runLinter(code);
            props.onDocChange?.(code);
          }),
        ],
      });

      CMView = new EditorView({
        state: startState,
        parent: editorRef(),
      });
    }),
  );
  return <div ref={setEditorRef} class="h-full"></div>;
};
export default CM6Editor;

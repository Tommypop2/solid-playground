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
  hoverTooltip,
  Tooltip,
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
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import {
  closeBrackets,
  autocompletion,
  closeBracketsKeymap,
  completionKeymap,
  CompletionResult,
} from '@codemirror/autocomplete';
import { Diagnostic, lintKeymap, setDiagnostics } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { throttle } from '@solid-primitives/scheduled';
import { LinterWorkerPayload, LinterWorkerResponse } from '../../workers/linter';
import { useAppContext } from '../../../playground/context';
import { color, oneDark, oneDarkHighlightStyle, oneDarkTheme } from '@codemirror/theme-one-dark';
import type { FormatterPayload } from '../../workers/formatter';
import { init } from './setupSolid';
import { displayPartsToString } from 'typescript';
const EditorTheme = EditorView.theme({
  '&': {
    fontSize: '15px',
    height: '100%',
    backgroundColor: '#1e1e1e',
  },
  '.cm-scroller': {
    fontFamily: 'Consolas, "Courier New", monospace',
  },
});
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
  const currentFileName = () => props.url.split('/').at(-1);
  const getContents = () => {
    const fileName = currentFileName();
    const contents = appCtx?.tabs()?.find((tab) => tab.name === fileName)?.source;
    return contents;
  };
  const env = init(appCtx?.tabs()!);
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
  const runFormatter = async (value: string, position: number) => {
    if (!CMView) return;
    const payload: FormatterPayload = {
      event: 'FORMAT_CURSOR',
      code: value,
      cursorOffset: position,
    };
    props.formatter!.postMessage(payload);

    const data: { text: string; cursorOffset: number }[] = await new Promise((resolve) => {
      props.formatter!.addEventListener(
        'message',
        ({ data: { transformed } }) => {
          resolve([
            {
              text: transformed.formatted,
              cursorOffset: transformed.cursorOffset,
            },
          ]);
        },
        { once: true },
      );
    });
    const newCode = data[0].text;
    const newOffset = data[0].cursorOffset;
    const codeUpdate = CMView.state.update({ changes: { from: 0, to: CMView.state.doc.length, insert: newCode } });

    CMView.dispatch(codeUpdate, { selection: { anchor: newOffset } });
  };
  createEffect(
    on(
      () => props.url,
      () => {
        if (!CMView) return;
        const contents = getContents();
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
        doc: getContents(),
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
          syntaxHighlighting(oneDarkHighlightStyle, { fallback: true }),
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
            indentWithTab,
            {
              key: 'Ctrl-s',
              run: (v) => {
                const code = v.state.doc.toString();
                const tab = appCtx?.tabs()?.find((tab) => tab.name === currentFileName());
                tab!.source = code;
                props.onDocChange?.(code);
                return true;
              },
            },
            {
              key: 'Alt-F',
              run: (v) => {
                console.log('Formatting');
                runFormatter(v.state.doc.toString(), v.state.selection.asSingle().mainIndex);
                return true;
              },
            },
          ]),
          javascript({ jsx: true, typescript: true }),
          hoverTooltip((view, pos, side) => {
            const tooltip: Tooltip = {
              pos,
              create(_) {
                const toolTip = env.languageService.getQuickInfoAtPosition('main.tsx', pos);
                const dom = document.createElement('div');
                dom.setAttribute('class', 'cm-quickinfo-tooltip');
                dom.textContent = displayPartsToString(toolTip?.displayParts);
                // dom.textContent = '123';
                return { dom };
              },
            };
            return tooltip;
          }),
          EditorView.updateListener.of((v: ViewUpdate) => {
            if (!v.docChanged) return;
            const code = v.state.doc.toString();
            runLinter(code);
            props.onDocChange?.(code);
          }),
          EditorTheme,
          oneDarkTheme,
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

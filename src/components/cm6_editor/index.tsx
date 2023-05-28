import { Accessor, Component, createEffect, createSignal, on, onCleanup, untrack } from 'solid-js';
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
import { foldGutter, indentOnInput, syntaxHighlighting, bracketMatching, foldKeymap } from '@codemirror/language';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import {
  closeBrackets,
  autocompletion,
  closeBracketsKeymap,
  completionKeymap,
  CompletionResult,
  completeFromList,
} from '@codemirror/autocomplete';
import { Diagnostic, lintKeymap, setDiagnostics } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { throttle } from '@solid-primitives/scheduled';
import { LinterWorkerPayload, LinterWorkerResponse } from '../../workers/linter';
// import { color, oneDark, oneDarkHighlightStyle, oneDarkTheme } from '@codemirror/theme-one-dark';
import type { FormatterPayload } from '../../workers/formatter';
import { init } from './setupSolid';
import { displayPartsToString } from 'typescript';
import { vsCodeDarkPlusTheme, vsCodeDarkPlusHighlightStyle } from './themes/vs-code-dark-plus';
import { Tab } from 'solid-repl';
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
  currentTab: string;
  disabled?: true;
  isDark?: boolean;
  withMinimap?: boolean;
  formatter?: Worker;
  linter?: Worker;
  displayErrors?: boolean;
  onDocChange?: (code: string) => void;
  onEditorReady?: any;
  tabs: Accessor<Tab[]>;
}> = (props) => {
  const currentFileName = () => props.currentTab;
  const getContents = () => {
    const fileName = currentFileName();
    const contents = props.tabs().find((tab) => tab.name === fileName)?.source;
    return contents;
  };
  const env = init(props.tabs(), props.disabled ? 'output_dont_import.ts' : 'main.tsx');
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
  createEffect(() => {
    if (
      untrack(() => props.currentTab) === 'output_dont_import.ts' &&
      props.tabs()[0].name === 'output_dont_import.ts'
    ) {
      if (!CMView) return;
      const update = CMView.state.update({
        changes: { from: 0, to: CMView.state.doc.length, insert: props.tabs()[0].source },
      });
      CMView.dispatch(update);
    }
  });
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
    on(currentFileName, () => {
      if (!CMView) return;
      const contents = getContents();
      const update = CMView.state.update({ changes: { from: 0, to: CMView.state.doc.length, insert: contents } });
      CMView.update([update]);
    }),
  );
  // Below is super crude and quite slow. In the future, tabs should be diffed so that only updated tabs are updated in the typescript fs
  createEffect(
    on(props.tabs, (tabs) => {
      tabs?.forEach((tab) => env.createFile(tab.name, tab.source));
    }),
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
          syntaxHighlighting(vsCodeDarkPlusHighlightStyle, { fallback: true }),
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
                const tab = props.tabs().find((tab) => tab.name === currentFileName());
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
          autocompletion({
            activateOnTyping: true,
            maxRenderedOptions: 30,
            override: [
              async (ctx): Promise<CompletionResult | null> => {
                const { pos } = ctx;
                try {
                  const completions = env.languageService.getCompletionsAtPosition(currentFileName()!, pos, {});
                  if (!completions) {
                    console.log('Unable to get completions', { pos });
                    return null;
                  }

                  return completeFromList(
                    completions.entries.map((c, _) => ({
                      type: c.kind,
                      label: c.name,
                      boost: 1 / Number(c.sortText),
                    })),
                  )(ctx);
                } catch (e) {
                  console.log('Unable to get completions', { pos, error: e });
                  return null;
                }
              },
            ],
          }),
          hoverTooltip((view, pos, side) => {
            const tooltip: Tooltip = {
              pos,
              create(_) {
                const quickInfo = env.languageService.getQuickInfoAtPosition(currentFileName()!, pos);
                const dom = document.createElement('div');
                dom.setAttribute('class', 'cm-quickinfo-tooltip');
                dom.textContent = quickInfo
                  ? displayPartsToString(quickInfo.displayParts) +
                    (quickInfo.documentation?.length ? '\n' + displayPartsToString(quickInfo.documentation) : '')
                  : '';
                // dom.textContent = '123';
                return { dom };
              },
            };
            return tooltip;
          }),
          EditorView.updateListener.of((v: ViewUpdate) => {
            if (!v.docChanged) return;
            const userTransaction = v.transactions.find(
              (transaction) => transaction.isUserEvent('input') || transaction.isUserEvent('delete'),
            );
            if (!userTransaction) return;
            const code = v.state.doc.toString();
            const tab = props.tabs().find((tab) => tab.name === currentFileName());
            tab!.source = code;
            runLinter(code);
            props.onDocChange?.(code);
          }),
          EditorTheme,
          vsCodeDarkPlusTheme,
          EditorState.readOnly.of(props.disabled ?? false),
        ],
      });

      CMView = new EditorView({
        state: startState,
        parent: editorRef(),
      });
    }),
  );
  onCleanup(() => {
    if (!CMView) return;
    CMView.destroy();
  });
  return <div ref={setEditorRef} class="h-full"></div>;
};
export default CM6Editor;

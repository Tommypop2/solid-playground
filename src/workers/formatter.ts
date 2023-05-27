import prettier from 'prettier/standalone';
import parserBabel from 'prettier/parser-babel';
export type FormatterPayload = {
  event: string;
  code: string;
  cursorOffset?: number;
};
function format(code: string) {
  return prettier.format(code, {
    parser: 'babel-ts',
    plugins: [parserBabel],
  });
}
function formatWithCursor(code: string, cursorOffset: number) {
  return prettier.formatWithCursor(code, {
    parser: 'babel-ts',
    plugins: [parserBabel],
    cursorOffset,
  });
}
self.addEventListener('message', async ({ data }: { data: FormatterPayload }) => {
  const { event, code, cursorOffset } = data;

  switch (event) {
    case 'FORMAT':
      self.postMessage({
        event: 'FORMAT',
        code: await format(code),
      });
      break;
    case 'FORMAT_CURSOR':
      self.postMessage({
        event: 'FORMAT_CURSOR',
        transformed: formatWithCursor(code, cursorOffset ?? 0),
      });
      break;
  }
});

export {};

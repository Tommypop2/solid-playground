import type { ImportMap, Tab } from 'solid-repl';

import { transform } from '@babel/standalone';
// @ts-ignore
import babelPresetSolid from 'babel-preset-solid';
// @ts-ignore
import './wasm_exec.js';
import url from './compiler.wasm.gz?url';
export const CDN_URL = (importee: string) => `https://jspm.dev/${importee}`;
declare global {
  interface Window {
    onWasmLoaded: () => void;
  }
}
let tabsCache: Tab[] = [];
let wasmReady = false;
self.onWasmLoaded = async () => {
  wasmReady = true;
  if (tabsCache.length == 0) return;
  await compile(tabsCache);
};
// @ts-ignore
const go = new Go();
const result = WebAssembly.instantiateStreaming(fetch(url), go.importObject);
result.then((res) => {
  go.run(res.instance);
});
function transformCode(code: string, filename: string) {
  if (filename.endsWith('.css')) {
    return code;
  }
  let { code: transformedCode } = transform(code, {
    presets: [
      [babelPresetSolid, { generate: 'dom', hydratable: false }],
      ['typescript', { onlyRemoveTypeImports: true }],
    ],
    filename: filename + '.tsx',
  });
  return transformedCode;
}
let importMap: ImportMap = {};

async function compile(tabs: Tab[]) {
  let tabsArr = [];
  for (const tab of tabs) {
    // tabsLookup.set(`./${tab.name.replace(/.(tsx|jsx)$/, '')}`, tab);
    if (tab.name.endsWith('.json')) {
      continue;
    }
    const tabName = `./${tab.name.replace(/.(tsx|jsx)$/, '')}`;
    tabsArr.push([tabName, transformCode(tab.source, tabName)]);
  }
  importMap = {};
  if (!wasmReady) {
    tabsCache = tabs;
    return { event: 'NOT_READY' };
  }
  const code = (self as any).build(JSON.stringify({ Files: tabsArr }));
  importMap = (self as any).getImportMap();
  return { event: 'ESBUILD', compiled: code, import_map: importMap };
}

async function babel(tab: Tab, compileOpts: any) {
  const { code } = await transform(tab.source, {
    presets: [
      [babelPresetSolid, compileOpts],
      ['typescript', { onlyRemoveTypeImports: true }],
    ],
    filename: tab.name,
  });
  return { event: 'BABEL', compiled: code };
}

self.addEventListener('message', async ({ data }) => {
  const { event, tabs, tab, compileOpts } = data;

  try {
    if (event === 'BABEL') {
      self.postMessage(await babel(tab, compileOpts));
    } else if (event === 'ESBUILD') {
      self.postMessage(await compile(tabs));
    }
  } catch (e) {
    console.error(e);
    self.postMessage({ event: 'ERROR', error: (e as Error).message });
  }
});

export {};

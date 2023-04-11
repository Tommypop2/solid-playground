import type { ImportMap, Tab } from 'solid-repl';

import { transform } from '@babel/standalone';
// @ts-ignore
import babelPresetSolid from 'babel-preset-solid';
// @ts-ignore
import { rollup, Plugin } from '@rollup/browser';
// @ts-ignore
import './wasm_exec.js';
import dd from 'dedent';
import url from './compiler.wasm?url';
export const CDN_URL = (importee: string) => `https://jspm.dev/${importee}`;
// @ts-ignore
const go = new Go();
const result = await WebAssembly.instantiateStreaming(fetch(url), go.importObject);
go.run(result.instance);
const tabsLookup = new Map<string, Tab>();

function uid(str: string) {
  return Array.from(str)
    .reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0)
    .toString();
}
function transformCode(code: string, filename: string) {
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

async function compile(tabs: Tab[], event: string) {
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
  const code = (self as any).build(JSON.stringify({ Files: tabsArr }));
  importMap = (self as any).getImportMap();
  if (event === 'ROLLUP') {
    return { event, compiled: code, import_map: importMap };
  }
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
    } else if (event === 'ROLLUP' || event === 'IMPORTS') {
      self.postMessage(await compile(tabs, event));
    }
  } catch (e) {
    console.error(e);
    self.postMessage({ event: 'ERROR', error: (e as Error).message });
  }
});

export {};

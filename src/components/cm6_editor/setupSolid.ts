import { Tab } from 'solid-repl';
import ts from 'typescript';
import { createSystem, createVirtualTypeScriptEnvironment } from '@typescript/vfs';
import sPackageJson from '/node_modules/solid-js/package.json?raw';
import sWebPackageJson from '/node_modules/solid-js/web/package.json?raw';
import sJsxRuntime from '/node_modules/solid-js/jsx-runtime.d.ts?raw';
import sIndex from '/node_modules/solid-js/types/index.d.ts?raw';
import sJsx from '/node_modules/solid-js/types/jsx.d.ts?raw';
import sArray from '/node_modules/solid-js/types/reactive/array.d.ts?raw';
import sObservable from '/node_modules/solid-js/types/reactive/observable.d.ts?raw';
import sScheduler from '/node_modules/solid-js/types/reactive/scheduler.d.ts?raw';
import sSignal from '/node_modules/solid-js/types/reactive/signal.d.ts?raw';
import sComponent from '/node_modules/solid-js/types/render/component.d.ts?raw';
import sFlow from '/node_modules/solid-js/types/render/flow.d.ts?raw';
import sHydration from '/node_modules/solid-js/types/render/hydration.d.ts?raw';
import sRenderIndex from '/node_modules/solid-js/types/render/index.d.ts?raw';
import sSuspense from '/node_modules/solid-js/types/render/Suspense.d.ts?raw';
import sClient from '/node_modules/solid-js/web/types/client.d.ts?raw';
import sCore from '/node_modules/solid-js/web/types/core.d.ts?raw';
import sWebIndex from '/node_modules/solid-js/web/types/index.d.ts?raw';
import sWebJsx from '/node_modules/solid-js/web/types/jsx.d.ts?raw';
import sServerMock from '/node_modules/solid-js/web/types/server-mock.d.ts?raw';
import sStoreIndex from '/node_modules/solid-js/store/types/index.d.ts?raw';
import sStateModifier from '/node_modules/solid-js/store/types/modifiers.d.ts?raw';
import sMutable from '/node_modules/solid-js/store/types/mutable.d.ts?raw';
import sServer from '/node_modules/solid-js/store/types/server.d.ts?raw';
import sStore from '/node_modules/solid-js/store/types/store.d.ts?raw';
import { libFileMap } from './lib';

export const init = (tabs: Tab[]) => {
  let fsMap = libFileMap;
  Object.keys(fsMap).forEach((key) => {
    const value = fsMap[key];
    delete fsMap[key];
    fsMap['/' + key] = value;
  });
  tabs?.forEach((tab) => {
    fsMap[tab.name] = tab.source;
  });
  const system = createSystem(new Map(Object.entries(libFileMap)));
  function csm(source: string, path: string) {
    system.writeFile(`node_modules/solid-js/${path}`, source);
  }
  // function cm(source: string, path: string) {
  //   system.writeFile(path, source);
  // }
  csm(sPackageJson, 'package.json');
  csm(sWebPackageJson, 'web/package.json');
  csm(sJsxRuntime, 'jsx-runtime.d.ts');
  csm(sIndex, 'types/index.d.ts');
  csm(sJsx, 'types/jsx.d.ts');
  csm(sArray, 'types/reactive/array.d.ts');
  csm(sObservable, 'types/reactive/mutable.d.ts');
  csm(sScheduler, 'types/reactive/scheduler.d.ts');
  csm(sSignal, 'types/reactive/signal.d.ts');
  csm(sComponent, 'types/render/component.d.ts');
  csm(sFlow, 'types/render/flow.d.ts');
  csm(sHydration, 'types/render/hydration.d.ts');
  csm(sRenderIndex, 'types/render/index.d.ts');
  csm(sSuspense, 'types/render/Suspense.d.ts');
  csm(sClient, 'web/types/client.d.ts');
  csm(sCore, 'web/types/core.d.ts');
  csm(sWebIndex, 'web/types/index.d.ts');
  csm(sWebJsx, 'web/types/jsx.d.ts');
  csm(sServerMock, 'web/types/server-mock.d.ts');
  csm(sStoreIndex, 'store/types/index.d.ts');
  csm(sStateModifier, 'store/types/modifiers.d.ts');
  csm(sMutable, 'store/types/mutable.d.ts');
  csm(sServer, 'store/types/server.d.ts');
  csm(sStore, 'store/types/store.d.ts');
  const env = createVirtualTypeScriptEnvironment(system, ['main.tsx'], ts);
  return env;
};

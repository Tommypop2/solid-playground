import { Accessor, Component, createEffect, createSignal, onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';
import { useZoom } from '../hooks/useZoom';
import { isGecko, isChromium } from '@solid-primitives/platform';
const generateHTML = (isDark: boolean, devtools: string) => {
  const html = `
  <!doctype html>
  <html${isDark ? ' class="dark"' : ''}>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      <link href="https://unpkg.com/modern-normalize@1.1.0/modern-normalize.css" rel="stylesheet">

      <style>
        html, body {
          position: relative;
          width: 100%;
          height: 100%;
        }

        body {
          color: #333;
          margin: 0;
          padding: 8px;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
          max-width: 100%;
        }

        .dark body {
          color: #e5e7eb;
        }

        .dark {
          color-scheme: dark;
        }

        input, button, select, textarea {
          padding: 0.4em;
          margin: 0 0 0.5em 0;
          box-sizing: border-box;
          border: 1px solid #ccc;
          border-radius: 2px;
        }

        button {
          color: #333;
          background-color: #f4f4f4;
          outline: none;
        }

        button:disabled {
          color: #999;
        }

        button:not(:disabled):active {
          background-color: #ddd;
        }

        button:focus {
          border-color: #666;
        }
      </style>
      ${devtools}
      <script>
        window.addEventListener('message', async ({ data }) => {
          const { event, value, import_map } = data;

          if (event !== 'CODE_UPDATE') return;
          const map_script = document.createElement('script');
          map_script.innerHTML = import_map;
          map_script.id = 'map_script';
          map_script.type = 'importmap';
          document.body.appendChild(map_script);

          window.dispose?.();
          window.dispose = undefined;
          

          document.getElementById('app').innerHTML = "";
    
          console.clear();
    
          document.getElementById('appsrc')?.remove();
          const script = document.createElement('script');
          script.src = value;
          script.id = 'appsrc';
          script.type = 'module';
          document.body.appendChild(script);
        
          const load = document.getElementById('load');
          if (load) load.remove();
          
        })
      </script>
    </head>
    
    <body>
      <div id="load" style="display: flex; height: 80vh; align-items: center; justify-content: center;">
        <p style="font-size: 1.5rem">Loading the playground...</p>
      </div>
      <div id="app"></div>
      <script id="appsrc" type="module"></script>
    </body>
  </html>`;
  return html;
};
export const Preview: Component<Props> = (props) => {
  const { zoomState } = useZoom();

  let iframe!: HTMLIFrameElement;

  const [isIframeReady, setIframeReady] = createSignal(false);

  if (!isServer) {
    try {
      const selectedPanel = localStorage.getItem('panel-selectedTab');
      if (!selectedPanel) {
        localStorage.setItem('panel-selectedTab', '"console"');
      }
    } catch (err) {}
  }

  createEffect(() => {
    if (!props.code) return;
    if (!isIframeReady()) return;

    const blob = new Blob([props.code], {
      type: 'text/javascript',
    });
    const src = URL.createObjectURL(blob);
    onCleanup(() => URL.revokeObjectURL(src));
    let import_map = { imports: props.importMap() };
    iframe.contentWindow!.postMessage(
      { event: 'CODE_UPDATE', value: src, import_map: JSON.stringify(import_map) },
      '*',
    );
  });

  createEffect(() => {
    if (!isIframeReady()) return;

    iframe.contentWindow!.postMessage({ event: 'DEVTOOLS', value: props.devtools }, '*');
  });

  createEffect(() => {
    if (!isIframeReady()) return;

    iframe.contentDocument!.documentElement.classList.toggle('dark', props.isDark);
    iframe.contentWindow!.postMessage({ event: 'THEME', value: props.isDark }, '*');
  });

  const devtools =
    isChromium || isGecko
      ? `<script src="https://cdn.jsdelivr.net/npm/chii@1.2.0/public/target.js" embedded="true" cdn="https://cdn.jsdelivr.net/npm/chii@1.2.0/public"></script>
      <script>
        let bodyHeight;
        window.addEventListener('message', async ({ data }) => {
          try {
            const { event, value } = data;

            if (event === 'DEVTOOLS') {
              const iframe = document.querySelector('.__chobitsu-hide__ iframe')
              if (value) {
                iframe.parentElement.style.display = 'block';
                if (bodyHeight) {
                  document.body.style.height = bodyHeight + 'px';
                }
              } else {
                iframe.parentElement.style.display = 'none';
                bodyHeight = document.body.style.height;
                document.body.style.height = 'auto';
              }
            }
          } catch (e) {
            console.error(e)
          }
        });
      </script>`
      : `<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
      <script src="https://cdn.jsdelivr.net/npm/eruda-dom"></script>
      <script type="module">
        eruda.init({
          tool: ["console", "network", "resources", "elements"],
          defaults: {
            displaySize: 40,
          }
        });
        eruda.add(erudaDom);
        eruda.position({ x: window.innerWidth - 30, y: window.innerHeight - 30 });
        const style = Object.assign(document.createElement('link'), {
          rel: 'stylesheet',
          href: '${location.origin}/eruda.css'
        });
        eruda._shadowRoot.appendChild(style);
        window.addEventListener('message', async ({ data }) => {
          try {
            const { event, value } = data;

            if (event === 'DEVTOOLS') {
              if (value) eruda.show();
              else eruda.hide();
            } else if (event === 'THEME') {
              eruda._devTools.config.set('theme', value ? 'Dark' : 'Light');
              eruda._$el[0].style.colorScheme = value ? 'dark' : 'light';
            }
          } catch (e) {
            console.error(e)
          }
        });
      </script>`;
  let [src, setSrc] = createSignal<string>();

  const html = generateHTML(props.isDark, devtools);
  const blob = new Blob([html], {
    type: 'text/html',
  });
  setSrc(URL.createObjectURL(blob));
  onCleanup(() => {
    URL.revokeObjectURL(src()!);
    setSrc(undefined);
  });

  createEffect(() => {
    // Bail early on first mount or we are already reloading
    if (!props.reloadSignal) return;

    // Otherwise, reload everytime we clicked the reload button
    setIframeReady(false);
    iframe.src = src()!;
  });

  const styleScale = () => {
    if (zoomState.scale === 100 || !zoomState.scaleIframe) return '';

    return `width: ${zoomState.scale}%; height: ${zoomState.scale}%; transform: scale(${
      zoomState.zoom / 100
    }); transform-origin: 0 0;`;
  };

  return (
    <div class="relative h-full w-full">
      {/* <Show when={src() != undefined}> */}
        <iframe
          title="Solid REPL"
          class="dark:bg-other row-start-5 block h-full w-full overflow-auto bg-white p-0"
          classList={props.classList}
          style={styleScale()}
          ref={iframe}
          src={src()}
          onload={[setIframeReady, true]}
          // @ts-ignore
          sandbox="allow-popups-to-escape-sandbox allow-scripts allow-popups allow-forms allow-pointer-lock allow-top-navigation allow-modals allow-same-origin"
        ></iframe>
      {/* </Show> */}
    </div>
  );
};

type Props = {
  importMap: Accessor<any>;
  classList?: {
    [k: string]: boolean | undefined;
  };
  code: string;
  reloadSignal: boolean;
  devtools: boolean;
  isDark: boolean;
};

'use client';

import Editor from '@monaco-editor/react';
import type { WebContainer } from '@webcontainer/api';
import { Braces, FileCode2, FolderOpen, Play, Plus, RefreshCw, Square, TerminalSquare, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BrowserApiTester from '@/components/BrowserApiTester';
import BrowserTerminal, { type BrowserTerminalHandle } from '@/components/BrowserTerminal';
import {
  ensureParentDirectory,
  normalizeWorkspacePath,
  scanWorkspace,
  type WorkspaceFile,
} from '@/lib/webcontainer/workspace';

type RuntimeWindow = Window & {
  __upstreamWebContainer?: Promise<WebContainer>;
};

const INITIAL_FILES: WorkspaceFile[] = [
  {
    name: 'index.js',
    language: 'javascript',
    content: `const message = 'Hello from Node.js in your browser!';

console.log(message);
console.log('Node version:', process.version);
`,
  },
  {
    name: 'package.json',
    language: 'json',
    content: `{
  "name": "upstream-browser-workspace",
  "private": true,
  "scripts": { "start": "node index.js" }
}
`,
  },
];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

function getRuntime() {
  if (!window.isSecureContext) {
    return Promise.reject(new Error('The browser Node.js runtime requires HTTPS or localhost.'));
  }
  if (!window.crossOriginIsolated) {
    return Promise.reject(new Error('Browser isolation is not active. Reload this page directly and verify the COOP/COEP response headers.'));
  }

  const runtimeWindow = window as RuntimeWindow;
  if (!runtimeWindow.__upstreamWebContainer) {
    const bootPromise = import('@webcontainer/api').then(({ WebContainer }) =>
      WebContainer.boot({ coep: 'require-corp' }),
    );
    runtimeWindow.__upstreamWebContainer = bootPromise;
    void bootPromise.catch(() => {
      if (runtimeWindow.__upstreamWebContainer === bootPromise) {
        delete runtimeWindow.__upstreamWebContainer;
      }
    });
  }
  return runtimeWindow.__upstreamWebContainer;
}

function toFileTree(files: WorkspaceFile[]) {
  return Object.fromEntries(files.map((file) => [file.name, { file: { contents: file.content } }]));
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export default function BrowserCodeEditor() {
  const [files, setFiles] = useState<WorkspaceFile[]>(INITIAL_FILES);
  const [activeName, setActiveName] = useState(INITIAL_FILES[0].name);
  const [runtime, setRuntime] = useState<WebContainer | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<'booting' | 'ready' | 'error'>('booting');
  const [runtimeMessage, setRuntimeMessage] = useState('Booting browser Node.js…');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [explorerWidth, setExplorerWidth] = useState(220);
  const [editorShare, setEditorShare] = useState(60);
  const [terminalShare, setTerminalShare] = useState(50);
  const [bottomTab, setBottomTab] = useState<'terminal' | 'api'>('terminal');
  const terminalRef = useRef<BrowserTerminalHandle | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const mainPaneRef = useRef<HTMLDivElement | null>(null);
  const bottomPaneRef = useRef<HTMLDivElement | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFile = useMemo(
    () => files.find((file) => file.name === activeName) ?? files[0],
    [activeName, files],
  );

  const refreshFiles = useCallback(async (container: WebContainer) => {
    const nextFiles = await scanWorkspace(container);
    if (!nextFiles.length) return;
    setFiles(nextFiles);
    setActiveName((current) => nextFiles.some((file) => file.name === current) ? current : nextFiles[0].name);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeServer: (() => void) | undefined;
    let watcher: { close(): void } | undefined;
    const isolationReloadKey = 'upstream-code-editor-isolation-reload';
    const reportError = (message: string) => queueMicrotask(() => {
      if (cancelled) return;
      setRuntimeStatus('error');
      setRuntimeMessage(message);
    });

    if (!window.isSecureContext) {
      reportError('Open the editor over HTTPS or localhost.');
      return;
    }
    if (!window.crossOriginIsolated) {
      if (!window.sessionStorage.getItem(isolationReloadKey)) {
        window.sessionStorage.setItem(isolationReloadKey, '1');
        window.location.reload();
        return;
      }
      reportError('COOP/COEP isolation headers are missing from the /code-editor document.');
      return;
    }
    window.sessionStorage.removeItem(isolationReloadKey);

    void getRuntime().then(async (container) => {
      await container.mount(toFileTree(INITIAL_FILES));
      await refreshFiles(container);
      if (cancelled) return;

      unsubscribeServer = container.on('server-ready', (_port, url) => setPreviewUrl(url));
      watcher = container.fs.watch('.', { recursive: true }, () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => { void refreshFiles(container); }, 500);
      });
      setRuntime(container);
      setRuntimeStatus('ready');
      setRuntimeMessage('Node.js and interactive shell are running in this browser.');
    }).catch((error: unknown) => {
      reportError(error instanceof Error ? error.message : String(error));
    });

    return () => {
      cancelled = true;
      unsubscribeServer?.();
      watcher?.close();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [refreshFiles]);

  useEffect(() => {
    window.localStorage.setItem('upstream-editor-layout', JSON.stringify({ explorerWidth, editorShare, terminalShare }));
  }, [editorShare, explorerWidth, terminalShare]);

  const updateActiveFile = (content: string) => {
    if (!activeFile) return;
    const nextFile = { ...activeFile, content };
    setFiles((current) => current.map((file) => file.name === activeName ? nextFile : file));
    if (runtime) void runtime.fs.writeFile(nextFile.name, content);
  };

  const addFile = async () => {
    if (!runtime) return;
    const path = normalizeWorkspacePath(window.prompt('File path (for example, src/App.tsx)') ?? '');
    if (!path || files.some((file) => file.name === path)) return;
    await ensureParentDirectory(runtime, path);
    await runtime.fs.writeFile(path, '');
    await refreshFiles(runtime);
    setActiveName(path);
  };

  const deleteActiveFile = async () => {
    if (!runtime || files.length === 1 || !activeFile) return;
    await runtime.fs.rm(activeFile.name, { force: true });
    await refreshFiles(runtime);
  };

  const beginResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    cursor: 'col-resize' | 'row-resize',
    onMove: (event: PointerEvent) => void,
  ) => {
    event.preventDefault();
    const previousCursor = document.body.style.cursor;
    const previousSelection = document.body.style.userSelect;
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';

    const finish = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelection;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish, { once: true });
  };

  const resizeExplorer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (!bounds) return;
    beginResize(event, 'col-resize', (move) =>
      setExplorerWidth(clamp(move.clientX - bounds.left, 160, Math.min(420, bounds.width * 0.45))),
    );
  };

  const resizeEditor = (event: React.PointerEvent<HTMLButtonElement>) => {
    const bounds = mainPaneRef.current?.getBoundingClientRect();
    if (!bounds) return;
    beginResize(event, 'row-resize', (move) =>
      setEditorShare(clamp(((move.clientY - bounds.top) / bounds.height) * 100, 25, 78)),
    );
  };

  const resizeTerminal = (event: React.PointerEvent<HTMLButtonElement>) => {
    const bounds = bottomPaneRef.current?.getBoundingClientRect();
    if (!bounds) return;
    beginResize(event, 'col-resize', (move) =>
      setTerminalShare(clamp(((move.clientX - bounds.left) / bounds.width) * 100, 25, 75)),
    );
  };

  const runActiveFile = () => {
    if (!activeFile || !/\.(?:cjs|js|mjs)$/.test(activeFile.name)) return;
    terminalRef.current?.run(`node ${shellQuote(activeFile.name)}`);
    terminalRef.current?.focus();
  };

  const scaffoldReact = () => {
    terminalRef.current?.run(
      'npx --yes create-vite@latest react-app --template react && cd react-app && npm install && npm run dev -- --host 0.0.0.0',
    );
    terminalRef.current?.focus();
  };

  return (
    <main className="flex h-screen min-h-[620px] flex-col overflow-hidden bg-[#0B0F17] text-white">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#10151d] px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center bg-primary-500 text-white">
            <FileCode2 className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">Upstream Code Editor</h1>
            <p className="font-mono text-[11px] text-[#919EAB]">{runtimeMessage}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`size-2 rounded-full ${runtimeStatus === 'ready' ? 'bg-primary-500' : runtimeStatus === 'error' ? 'bg-red-500' : 'animate-pulse bg-amber-400'}`} />
          <button type="button" onClick={scaffoldReact} disabled={runtimeStatus !== 'ready'} className="h-9 bg-white/10 px-3 font-bold hover:bg-white/15 disabled:opacity-40">
            Create React app
          </button>
          <button type="button" onClick={runActiveFile} disabled={runtimeStatus !== 'ready' || !activeFile} className="inline-flex h-9 items-center gap-2 bg-primary-500 px-4 font-bold disabled:opacity-40">
            <Play className="size-4" /> Run file
          </button>
        </div>
      </header>

      <section ref={workspaceRef} className="flex min-h-0 flex-1 overflow-hidden">
        <aside style={{ width: explorerWidth }} className="min-w-0 shrink-0 overflow-auto bg-[#10151d]">
          <div className="sticky top-0 z-10 flex h-11 items-center justify-between border-b border-white/10 bg-[#10151d] px-3">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#919EAB]">
              <FolderOpen className="size-4" /> Explorer
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={() => { if (runtime) void refreshFiles(runtime); }} className="p-1.5 text-[#919EAB] hover:bg-white/10 hover:text-white" aria-label="Refresh files">
                <RefreshCw className="size-4" />
              </button>
              <button type="button" onClick={() => { void addFile(); }} className="p-1.5 text-[#919EAB] hover:bg-white/10 hover:text-white" aria-label="Add file">
                <Plus className="size-4" />
              </button>
              <button type="button" onClick={() => { void deleteActiveFile(); }} disabled={files.length === 1} className="p-1.5 text-[#919EAB] hover:bg-white/10 hover:text-white disabled:opacity-30" aria-label="Delete active file">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          <nav aria-label="Workspace files" className="py-2">
            {files.map((file) => (
              <button
                type="button"
                key={file.name}
                onClick={() => setActiveName(file.name)}
                title={file.name}
                className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left font-mono text-xs ${file.name === activeName ? 'border-primary-500 bg-white/[0.06] text-white' : 'border-transparent text-[#919EAB] hover:bg-white/[0.04] hover:text-white'}`}
              >
                <FileCode2 className="size-4 shrink-0" />
                <span className="truncate">{file.name}</span>
              </button>
            ))}
          </nav>
        </aside>

        <button
          type="button"
          role="separator"
          aria-label="Resize file explorer"
          aria-orientation="vertical"
          aria-valuenow={Math.round(explorerWidth)}
          onPointerDown={resizeExplorer}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') setExplorerWidth((value) => clamp(value - 16, 160, 420));
            if (event.key === 'ArrowRight') setExplorerWidth((value) => clamp(value + 16, 160, 420));
          }}
          className="w-1.5 shrink-0 cursor-col-resize border-x border-white/5 bg-[#151b24] hover:bg-primary-500 focus:bg-primary-500"
        />

        <div ref={mainPaneRef} className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <section style={{ flexBasis: `${editorShare}%` }} aria-label="Code editor" className="min-h-0 shrink-0 bg-[#0d1117]">
            <div className="flex h-10 items-center border-b border-white/10 bg-[#10151d] px-4 font-mono text-xs text-white">
              {activeFile?.name ?? 'No file selected'}
            </div>
            <div className="h-[calc(100%-2.5rem)]">
              {activeFile && (
                <Editor
                  height="100%"
                  language={activeFile.language}
                  path={activeFile.name}
                  theme="vs-dark"
                  value={activeFile.content}
                  onChange={(value) => updateActiveFile(value ?? '')}
                  options={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, minimap: { enabled: true }, padding: { top: 16 }, scrollBeyondLastLine: false, automaticLayout: true }}
                />
              )}
            </div>
          </section>

          <button
            type="button"
            role="separator"
            aria-label="Resize editor and bottom panel"
            aria-orientation="horizontal"
            aria-valuenow={Math.round(editorShare)}
            onPointerDown={resizeEditor}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') setEditorShare((value) => clamp(value - 3, 25, 78));
              if (event.key === 'ArrowDown') setEditorShare((value) => clamp(value + 3, 25, 78));
            }}
            className="h-1.5 shrink-0 cursor-row-resize border-y border-white/5 bg-[#151b24] hover:bg-primary-500 focus:bg-primary-500"
          />

          <section className="flex min-h-0 flex-1 flex-col bg-[#090d12]">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#10151d] px-3">
              <div role="tablist" aria-label="Workspace tools" className="flex h-full items-center">
                <button
                  type="button"
                  role="tab"
                  aria-selected={bottomTab === 'terminal'}
                  onClick={() => setBottomTab('terminal')}
                  className={`inline-flex h-full items-center gap-2 border-b-2 px-3 text-xs font-bold uppercase tracking-wider ${bottomTab === 'terminal' ? 'border-primary-500 text-white' : 'border-transparent text-[#919EAB] hover:text-white'}`}
                >
                  <TerminalSquare className="size-4" /> Terminal
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={bottomTab === 'api'}
                  onClick={() => setBottomTab('api')}
                  className={`inline-flex h-full items-center gap-2 border-b-2 px-3 text-xs font-bold uppercase tracking-wider ${bottomTab === 'api' ? 'border-primary-500 text-white' : 'border-transparent text-[#919EAB] hover:text-white'}`}
                >
                  <Braces className="size-4" /> API Client
                </button>
              </div>
              {bottomTab === 'terminal' && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => terminalRef.current?.interrupt()} className="inline-flex h-7 items-center gap-1.5 bg-red-500/15 px-2 text-xs text-red-300 hover:bg-red-500/25">
                    <Square className="size-3" /> Ctrl+C
                  </button>
                  <button type="button" onClick={() => terminalRef.current?.clear()} className="h-7 px-2 text-xs text-[#919EAB] hover:bg-white/10 hover:text-white">Clear</button>
                </div>
              )}
            </div>

            <div ref={bottomPaneRef} className="flex min-h-0 flex-1 overflow-hidden">
              <div style={{ flexBasis: previewUrl ? `${terminalShare}%` : '100%' }} className="relative min-w-0 shrink-0 overflow-hidden">
                <div
                  role="tabpanel"
                  aria-label="Terminal"
                  aria-hidden={bottomTab !== 'terminal'}
                  className={`absolute inset-0 ${bottomTab === 'terminal' ? 'visible' : 'pointer-events-none invisible'}`}
                >
                  {runtime ? (
                    <BrowserTerminal ref={terminalRef} runtime={runtime} />
                  ) : (
                    <div className="p-4 font-mono text-xs text-[#919EAB]">{runtimeMessage}</div>
                  )}
                </div>
                <div
                  role="tabpanel"
                  aria-label="API Client"
                  aria-hidden={bottomTab !== 'api'}
                  className={`absolute inset-0 ${bottomTab === 'api' ? 'visible' : 'pointer-events-none invisible'}`}
                >
                  <BrowserApiTester />
                </div>
              </div>

              {previewUrl && (
                <>
                  <button
                    type="button"
                    role="separator"
                    aria-label="Resize bottom panel and preview"
                    aria-orientation="vertical"
                    aria-valuenow={Math.round(terminalShare)}
                    onPointerDown={resizeTerminal}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowLeft') setTerminalShare((value) => clamp(value - 3, 25, 75));
                      if (event.key === 'ArrowRight') setTerminalShare((value) => clamp(value + 3, 25, 75));
                    }}
                    className="w-1.5 shrink-0 cursor-col-resize border-x border-white/5 bg-[#151b24] hover:bg-primary-500 focus:bg-primary-500"
                  />
                  <iframe
                    title="Application preview"
                    src={previewUrl}
                    className="h-full min-w-0 flex-1 bg-white"
                    sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin"
                  />
                </>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

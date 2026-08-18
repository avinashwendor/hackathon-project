'use client';

import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type BrowserTerminalHandle = {
  clear(): void;
  focus(): void;
  interrupt(): void;
  run(command: string): void;
};

type BrowserTerminalProps = {
  runtime: WebContainer;
};

const BrowserTerminal = forwardRef<BrowserTerminalHandle, BrowserTerminalProps>(
  function BrowserTerminal({ runtime }, ref) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const inputRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
    const shellRef = useRef<WebContainerProcess | null>(null);

    useImperativeHandle(ref, () => ({
      clear: () => terminalRef.current?.clear(),
      focus: () => terminalRef.current?.focus(),
      interrupt: () => { void inputRef.current?.write('\x03'); },
      run: (command) => { void inputRef.current?.write(`${command}\r`); },
    }), []);

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      let disposed = false;
      const terminal = new Terminal({
        allowProposedApi: false,
        convertEol: true,
        cursorBlink: true,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 13,
        theme: {
          background: '#090d12',
          foreground: '#d7e0ea',
          cursor: '#f97316',
          selectionBackground: '#1f6f4a',
        },
      });
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(host);
      terminalRef.current = terminal;

      const fit = () => {
        try { fitAddon.fit(); } catch { /* The panel may be temporarily collapsed. */ }
      };
      const resizeObserver = new ResizeObserver(fit);
      resizeObserver.observe(host);
      requestAnimationFrame(fit);

      let dataDisposable: { dispose(): void } | undefined;
      void runtime.spawn('jsh', {
        terminal: { cols: Math.max(terminal.cols, 1), rows: Math.max(terminal.rows, 1) },
      }).then(async (shell) => {
        if (disposed) {
          shell.kill();
          return;
        }
        shellRef.current = shell;
        inputRef.current = shell.input.getWriter();
        dataDisposable = terminal.onData((data) => { void inputRef.current?.write(data); });
        terminal.onResize(({ cols, rows }) => shell.resize({ cols, rows }));
        terminal.focus();
        await shell.output.pipeTo(new WritableStream({ write: (data) => terminal.write(data) }));
      }).catch((error: unknown) => {
        terminal.writeln(`\r\nUnable to start terminal: ${error instanceof Error ? error.message : String(error)}`);
      });

      return () => {
        disposed = true;
        resizeObserver.disconnect();
        dataDisposable?.dispose();
        shellRef.current?.kill();
        inputRef.current?.releaseLock();
        inputRef.current = null;
        shellRef.current = null;
        terminalRef.current = null;
        terminal.dispose();
      };
    }, [runtime]);

    return <div ref={hostRef} className="h-full min-h-0 w-full overflow-hidden bg-[#090d12] p-2" />;
  },
);

BrowserTerminal.displayName = 'BrowserTerminal';

export default BrowserTerminal;

'use client';

import { Send, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

type ApiResult = {
  body: string;
  elapsedMs: number;
  headers: Record<string, string>;
  status: number;
  statusText: string;
};

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const BODY_METHODS = new Set<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

function parseHeaders(value: string) {
  const parsed: unknown = JSON.parse(value || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers must be a JSON object.');
  }

  const headers = new Headers();
  for (const [name, headerValue] of Object.entries(parsed)) {
    if (typeof headerValue !== 'string') throw new Error(`Header "${name}" must be a string.`);
    headers.set(name, headerValue);
  }
  return headers;
}

function formatBody(value: string) {
  if (!value) return '';
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}

export default function BrowserApiTester() {
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('/api/health');
  const [headersText, setHeadersText] = useState('{\n  "Content-Type": "application/json"\n}');
  const [body, setBody] = useState('{\n  \n}');
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const sendRequest = async () => {
    if (!url.trim() || loading) return;

    try {
      const headers = parseHeaders(headersText);
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError(null);
      setResult(null);
      const startedAt = performance.now();
      const response = await fetch(url.trim(), {
        method,
        headers,
        body: BODY_METHODS.has(method) && body.trim() ? body : undefined,
        credentials: 'same-origin',
        redirect: 'follow',
        signal: controller.signal,
      });
      const responseBody = await response.text();
      if (controllerRef.current !== controller) return;

      setResult({
        body: formatBody(responseBody),
        elapsedMs: performance.now() - startedAt,
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
        statusText: response.statusText,
      });
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        setError('Request cancelled.');
      } else {
        setError(
          requestError instanceof Error
            ? `${requestError.message}${requestError instanceof TypeError ? ' The target may be offline or blocking browser CORS.' : ''}`
            : 'Request failed.',
        );
      }
    } finally {
      controllerRef.current = null;
      setLoading(false);
    }
  };

  const cancelRequest = () => controllerRef.current?.abort();
  const bodyEnabled = BODY_METHODS.has(method);

  return (
    <div className="h-full overflow-auto bg-[#0b1017] p-3 text-xs text-white">
      <div className="flex min-w-[520px] gap-2">
        <label className="sr-only" htmlFor="api-method">HTTP method</label>
        <select
          id="api-method"
          value={method}
          onChange={(event) => setMethod(event.target.value as HttpMethod)}
          className="h-9 border border-white/10 bg-[#161c24] px-3 font-mono font-bold text-[#f97316] outline-none focus:border-[#f97316]"
        >
          {METHODS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label className="sr-only" htmlFor="api-url">Request URL</label>
        <input
          id="api-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void sendRequest(); }}
          className="h-9 min-w-0 flex-1 border border-white/10 bg-[#090d12] px-3 font-mono text-white outline-none focus:border-[#f97316]"
          placeholder="https://api.example.com/users"
        />
        {loading ? (
          <button type="button" onClick={cancelRequest} className="inline-flex h-9 items-center gap-2 bg-red-500/20 px-4 font-bold text-red-300 hover:bg-red-500/30">
            <Square className="size-3.5" /> Cancel
          </button>
        ) : (
          <button type="button" onClick={() => { void sendRequest(); }} className="inline-flex h-9 items-center gap-2 bg-[#f97316] px-4 font-bold hover:bg-[#ea5a0b]">
            <Send className="size-3.5" /> Send
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-[#637381]">
        Requests run from your browser. External APIs must allow CORS; relative URLs target this Upstream deployment.
      </p>

      <div className="mt-3 grid min-w-[720px] grid-cols-2 gap-3">
        <section className="space-y-3" aria-label="Request configuration">
          <label className="block">
            <span className="mb-1 block font-bold uppercase tracking-wider text-[#919EAB]">Headers · JSON</span>
            <textarea
              value={headersText}
              onChange={(event) => setHeadersText(event.target.value)}
              spellCheck={false}
              className="h-32 w-full resize-y border border-white/10 bg-[#090d12] p-3 font-mono leading-5 outline-none focus:border-[#f97316]"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between font-bold uppercase tracking-wider text-[#919EAB]">
              Request body
              {!bodyEnabled && <span className="normal-case tracking-normal text-[#637381]">Unavailable for {method}</span>}
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              disabled={!bodyEnabled}
              spellCheck={false}
              className="h-48 w-full resize-y border border-white/10 bg-[#090d12] p-3 font-mono leading-5 outline-none focus:border-[#f97316] disabled:cursor-not-allowed disabled:opacity-35"
            />
          </label>
        </section>

        <section className="min-w-0 space-y-3" aria-label="API response" aria-live="polite">
          <div className="flex h-8 items-center gap-3 border-b border-white/10">
            <span className="font-bold uppercase tracking-wider text-[#919EAB]">Response</span>
            {result && (
              <>
                <span className={`font-mono font-bold ${result.status >= 200 && result.status < 400 ? 'text-[#f97316]' : 'text-red-400'}`}>
                  {result.status} {result.statusText}
                </span>
                <span className="font-mono text-[#637381]">{result.elapsedMs.toFixed(0)} ms</span>
              </>
            )}
            {loading && <span className="animate-pulse font-mono text-amber-300">Sending…</span>}
          </div>
          {error && <div className="border border-red-500/30 bg-red-500/10 p-3 text-red-300">{error}</div>}
          <div>
            <p className="mb-1 font-bold uppercase tracking-wider text-[#919EAB]">Response headers</p>
            <pre className="h-28 overflow-auto border border-white/10 bg-[#090d12] p-3 font-mono leading-5 text-[#b7c2ce]">
              {result ? JSON.stringify(result.headers, null, 2) : 'No response yet.'}
            </pre>
          </div>
          <div>
            <p className="mb-1 font-bold uppercase tracking-wider text-[#919EAB]">Response body</p>
            <pre className="h-52 overflow-auto whitespace-pre-wrap break-words border border-white/10 bg-[#090d12] p-3 font-mono leading-5 text-[#d7e0ea]">
              {result?.body || (result ? '(empty response)' : 'Send a request to inspect the response.')}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}

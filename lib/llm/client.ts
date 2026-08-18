import { config } from "@/lib/config";

/* ---------------------------------------------------------------------------
   Omega C client (OpenAI-compatible chat completions).

   Three things this has to survive: a missing key, a slow response, and a
   model that wraps its JSON in prose or a fenced block. All three are handled
   here so the agent pipeline never has to think about them — it asks for a
   typed object and gets either that object or null, and null always has a
   deterministic path behind it.
--------------------------------------------------------------------------- */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Nudges the model toward a bare JSON object and enables repair on parse. */
  json?: boolean;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  model: string;
  tokens: { prompt: number; completion: number };
  ms: number;
}

export class LLMUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMUnavailableError";
  }
}

export function llmConfigured(): boolean {
  return Boolean(config.llm.apiKey);
}

/**
 * Which generation path a call will take, for the diagnostics panel.
 *
 * Generation is Omega C only. Google's key in this deployment is scoped to
 * embeddings, so the two concerns stay on separate providers by design.
 */
export function activeLlm(): { provider: "omega" | "none"; model: string } {
  return config.llm.apiKey
    ? { provider: "omega", model: config.llm.model }
    : { provider: "none", model: "deterministic" };
}

interface CompletionResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

async function once(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llm.timeoutMs);
  options.signal?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    const res = await fetch(`${config.llm.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? config.llm.model,
        messages,
        temperature: options.temperature ?? config.llm.temperature,
        max_tokens: options.maxTokens ?? 2048,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);

    let json: CompletionResponse;
    try {
      json = JSON.parse(text) as CompletionResponse;
    } catch {
      throw new Error(`non-JSON response: ${text.slice(0, 200)}`);
    }
    if (json.error) throw new Error(json.error.message ?? "unknown provider error");

    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("response had no message content");

    return {
      content,
      model: json.model ?? options.model ?? config.llm.model,
      tokens: {
        prompt: json.usage?.prompt_tokens ?? 0,
        completion: json.usage?.completion_tokens ?? 0,
      },
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
  if (!llmConfigured()) throw new LLMUnavailableError("OMEGA_API_KEY is not set");

  let lastError: unknown;
  for (let attempt = 0; attempt <= config.llm.maxRetries; attempt++) {
    try {
      return await once(messages, options);
    } catch (err) {
      lastError = err;
      const message = (err as Error).message ?? "";
      // A bad request will fail identically on retry; only back off on transport
      // and capacity errors.
      const retriable = /429|5\d\d|timeout|abort|fetch failed|ECONN|network/i.test(message);
      if (!retriable || attempt === config.llm.maxRetries) break;
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt + Math.random() * 250));
    }
  }
  throw new LLMUnavailableError(`Omega C call failed: ${(lastError as Error)?.message ?? "unknown"}`);
}

/* --- JSON --------------------------------------------------------------- */

/** Pull the first complete JSON object out of a response, fence or prose included. */
export function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();

  const start = body.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  return null;
}

export interface JsonChatResult<T> {
  data: T;
  raw: string;
  model: string;
  tokens: { prompt: number; completion: number };
  ms: number;
}

/**
 * Ask for a JSON object. Returns null instead of throwing when the model or the
 * network is unavailable, because every caller has a deterministic fallback and
 * a degraded answer is worth more than an exception.
 */
export async function chatJson<T>(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<JsonChatResult<T> | null> {
  try {
    const result = await chat(
      [
        ...messages,
        { role: "system", content: "Respond with a single JSON object and nothing else. No prose, no code fence." },
      ],
      { ...options, json: true },
    );
    const extracted = extractJson(result.content);
    if (!extracted) {
      console.warn("[llm] no JSON object found in response");
      return null;
    }
    return {
      data: JSON.parse(extracted) as T,
      raw: result.content,
      model: result.model,
      tokens: result.tokens,
      ms: result.ms,
    };
  } catch (err) {
    console.warn("[llm]", (err as Error).message);
    return null;
  }
}

/* --- Streaming ----------------------------------------------------------- */

/** Server-sent token stream, used by the live reasoning view. */
export async function* chatStream(
  messages: ChatMessage[],
  options: ChatOptions = {},
): AsyncGenerator<string> {
  if (!llmConfigured()) throw new LLMUnavailableError("OMEGA_API_KEY is not set");

  const res = await fetch(`${config.llm.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.llm.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? config.llm.model,
      messages,
      temperature: options.temperature ?? config.llm.temperature,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
    }),
    signal: options.signal,
    cache: "no-store",
  });

  if (!res.ok || !res.body) {
    throw new LLMUnavailableError(`stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const chunk = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Partial frame; the next read completes it.
      }
    }
  }
}

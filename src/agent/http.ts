// POST con tiempo de espera y reintentos, como los SDK de Python (timeout=30 s, max_retries=2).
import { AgentError, MAX_RETRIES, REQUEST_TIMEOUT_S } from './common';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function shouldRetry(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 60) return seconds * 1000;
  // Igual que los SDK: 0,5 s, 1 s... con algo de variación, máximo 8 s
  const base = Math.min(0.5 * 2 ** attempt, 8);
  return base * (1 - 0.25 * Math.random()) * 1000;
}

export interface PostOptions {
  timeoutMs?: number;
  retries?: number;
}

export async function postJson(url: string, headers: Record<string, string>, body: unknown,
                               options: PostOptions = {}): Promise<any> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_S * 1000;
  const retries = options.retries ?? MAX_RETRIES;
  const payload = JSON.stringify(body);
  let lastError = '';

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', headers, body: payload, signal: controller.signal });
    } catch (e) {
      // Error de red o tiempo de espera agotado: se reintenta
      clearTimeout(timer);
      lastError = controller.signal.aborted ? `Timeout after ${timeoutMs} ms` : `Network error: ${String(e)}`;
      if (attempt < retries) await sleep(retryDelayMs(attempt, null));
      continue;
    }
    let text: string;
    try {
      text = await response.text();
    } catch (e) {
      clearTimeout(timer);
      lastError = controller.signal.aborted ? `Timeout after ${timeoutMs} ms` : `Network error: ${String(e)}`;
      if (attempt < retries) await sleep(retryDelayMs(attempt, null));
      continue;
    }
    clearTimeout(timer);

    if (response.ok) {
      try {
        return JSON.parse(text);
      } catch {
        throw new AgentError(`Invalid JSON from ${url}`);
      }
    }
    lastError = `HTTP ${response.status}: ${text.slice(0, 500)}`;
    if (!shouldRetry(response.status)) throw new AgentError(lastError);
    if (attempt < retries) await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
  }
  throw new AgentError(lastError);
}

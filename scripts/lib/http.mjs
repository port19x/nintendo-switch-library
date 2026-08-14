/**
 * Minimal HTTP helpers: browser-ish headers, timeouts, retry with backoff,
 * and a bounded-concurrency mapper. No dependencies — Node 18+ `fetch`.
 */

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch() with a timeout and retries on 429/5xx/network errors.
 * 4xx (other than 429) is returned as-is — those are "answers", not failures.
 */
export async function request(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = 30_000,
    retries = 3,
    retryBaseDelay = 800,
    accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryBaseDelay * 2 ** (attempt - 1));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method,
        body,
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept,
          'accept-language': 'en-US,en;q=0.9,de;q=0.8',
          ...headers,
        },
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} from ${url}`);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error(`request failed: ${url}`);
}

export async function requestText(url, options) {
  const res = await request(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

export async function requestJson(url, options) {
  const res = await request(url, { accept: 'application/json, text/plain, */*', ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response from ${url}: ${text.slice(0, 200)}`);
  }
}

/** Map over items with bounded concurrency, preserving input order in the result. */
export async function pool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

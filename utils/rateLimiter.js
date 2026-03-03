import { CONFIG } from '../config.js';

const queue = [];
let processing = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function rateLimit(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  const { fn, resolve, reject } = queue.shift();
  try {
    const result = await fn();
    resolve(result);
  } catch (error) {
    reject(error);
  }

  setTimeout(() => {
    processing = false;
    processQueue();
  }, CONFIG.RATE_LIMIT_DELAY);
}

/**
 * Fetch wrapper that enforces rate limiting, checks response status,
 * and retries on 429 (Too Many Requests) using Discord's retry_after.
 */
export async function discordFetch(url, options = {}) {
  for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    const response = await rateLimit(() => fetch(url, options));

    if (response.status === 429) {
      const body = await response.json().catch(() => ({}));
      const retryAfter = (body.retry_after ?? 5) * 1000;
      await sleep(retryAfter);
      continue;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  }

  throw new Error('Max retries exceeded due to rate limiting');
}

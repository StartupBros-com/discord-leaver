import { CONFIG } from '../config.js';

const queue = [];
let processing = false;

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
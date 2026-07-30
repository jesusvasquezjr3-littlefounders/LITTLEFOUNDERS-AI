import { createClient } from 'redis';
import { getConfig } from '../env.js';
import type { Request, Response, NextFunction } from 'express';

export const isTestOrDev = process.env.NODE_ENV !== 'production';

export const cacheClient = createClient({
  url: getConfig().REDIS_URL,
});

if (!isTestOrDev) {
  cacheClient.on('error', (err) => console.error('[dataintel] Cache Client Error', err));
}

const DEFAULT_TTL = 300;

export function cacheMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET') {
    return next();
  }

  const key = `dataintel:etag:${req.originalUrl}`;

  if (!cacheClient.isOpen) {
    return next();
  }

  cacheClient.get(key).then((etag) => {
    if (etag) {
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', `private, max-age=${DEFAULT_TTL}`);
      const ifNoneMatch = req.get('If-None-Match');
      if (ifNoneMatch === etag) {
        return res.status(304).end();
      }
    }
    next();
  }).catch(() => next());
}

export async function cacheResult(key: string, data: unknown): Promise<void> {
  if (!cacheClient.isOpen) {
    return;
  }
  try {
    const body = JSON.stringify(data);
    const hash = simpleHash(body);
    const etag = `"${hash}"`;
    await cacheClient.setEx(`dataintel:etag:${key}`, DEFAULT_TTL, etag);
    await cacheClient.setEx(`dataintel:data:${key}`, DEFAULT_TTL, body);
  } catch {
    // cache is best-effort
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

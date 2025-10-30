import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import { renderToPipeableStream } from 'react-dom/server';
import { ServerRouter } from 'react-router';
import type { EntryContext } from 'react-router';
import { isbot } from 'isbot';
import { PassThrough } from 'node:stream';
import { initializeCronJobs } from './lib/cron-scheduler.server';
import { warmupCache, CACHE_KEYS } from './lib/cache-manager.server';
import { fetchPartnerAdsData } from './lib/partnerads-api.server';
import { fetchAdtractionData } from './lib/adtraction-api.server';

// Initialize cron jobs when server starts
console.log('[Entry Server] Server starting...');

// Cache warmup with timeout: Warm up source caches on startup
// Timeout prevents hanging during server startup
const WARMUP_TIMEOUT_MS = 30_000; // 30 seconds max for warmup

(async () => {
  const startTime = Date.now();

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Cache warmup timeout')), WARMUP_TIMEOUT_MS);
  });

  try {
    // Race warmup against timeout
    await Promise.race([
      (async () => {
        console.log('[Entry Server] Warming source caches...');

        // Warm up individual sources in parallel
        // Note: warmupCache already has request deduplication via forceRefreshCache
        const results = await Promise.allSettled([
          warmupCache(CACHE_KEYS.PARTNERADS, fetchPartnerAdsData),
          warmupCache(CACHE_KEYS.ADTRACTION, fetchAdtractionData),
        ]);

        if (results[0].status === 'rejected') {
          console.error('[Entry Server] Partner-ads warmup failed:', results[0].reason);
        }
        if (results[1].status === 'rejected') {
          console.error('[Entry Server] Adtraction warmup failed:', results[1].reason);
        }

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[Entry Server] Cache warmup completed in ${Date.now() - startTime}ms (${successCount}/2 sources)`);
      })(),
      timeoutPromise,
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Cache warmup timeout') {
      console.error(`[Entry Server] Cache warmup timed out after ${WARMUP_TIMEOUT_MS}ms - server will continue with lazy loading`);
    } else {
      console.error('[Entry Server] Unexpected cache warmup error:', error);
    }
  }
})();

// Initialize cron scheduler
initializeCronJobs();

const ABORT_DELAY = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: any
) {
  return isbot(request.headers.get('user-agent') || '')
    ? handleBotRequest(
        request,
        responseStatusCode,
        responseHeaders,
        routerContext
      )
    : handleBrowserRequest(
        request,
        responseStatusCode,
        responseHeaders,
        routerContext
      );
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onAllReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set('Content-Type', 'text/html');

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set('Content-Type', 'text/html');

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

function createReadableStreamFromReadable(readable: NodeJS.ReadableStream) {
  return new ReadableStream({
    start(controller) {
      readable.on('data', (chunk) => {
        controller.enqueue(chunk);
      });
      readable.on('end', () => {
        controller.close();
      });
      readable.on('error', (error) => {
        controller.error(error);
      });
    },
    cancel() {
      if ('destroy' in readable && typeof readable.destroy === 'function') {
        readable.destroy();
      }
    },
  });
}

import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import { renderToPipeableStream } from 'react-dom/server';
import { ServerRouter } from 'react-router';
import type { EntryContext } from 'react-router';
import { isbot } from 'isbot';
import { PassThrough } from 'node:stream';
import { initializeCronJobs } from './lib/cron-scheduler.server';
import { warmupCache, getCached, setCache } from './lib/cache-manager.server';
import { fetchPartnerAdsData } from './lib/partnerads-api.server';
import { fetchAdtractionData } from './lib/adtraction-api.server';
import { mergeAffiliateData } from './lib/affiliate-merger.server';

// Initialize cron jobs when server starts
console.log('[Entry Server] Server starting...');

// Warm up caches on startup (don't wait for them)
Promise.all([
  warmupCache('partnerads-data', fetchPartnerAdsData),
  warmupCache('adtraction-data', fetchAdtractionData),
])
  .then(async ([partneradsData, adtractionData]) => {
    console.log('[Entry Server] Source caches warmed up successfully');

    // Also warm up merged cache if not present
    const mergedCache = await getCached('merged-data');
    if (!mergedCache && partneradsData && adtractionData) {
      console.log('[Entry Server] Creating merged cache during warmup...');
      const merged = mergeAffiliateData(partneradsData, adtractionData);
      await setCache('merged-data', merged);
      console.log('[Entry Server] Merged cache created successfully');
    } else if (mergedCache) {
      console.log('[Entry Server] Merged cache already exists');
    }

    console.log('[Entry Server] All caches warmed up successfully');
  })
  .catch((error) => console.error('[Entry Server] Cache warmup failed:', error));

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

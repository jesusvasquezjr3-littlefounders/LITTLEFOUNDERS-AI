/** Classify rendered assets separately from expected Core business refusals. */
export function isAuditedAsset(url, resourceType, origin) {
  const parsed = new URL(url);
  return parsed.origin === origin && (parsed.pathname.startsWith('/scenes/')
    || ['Script', 'Image', 'Media', 'Font', 'Stylesheet'].includes(resourceType));
}

export function assetHttpFailure(response, resourceType, origin) {
  return response.status >= 400 && isAuditedAsset(response.url, resourceType, origin)
    ? `${response.status} ${response.url}` : null;
}

/** Canceled requests remain failures when they belong to a tracked asset. */
export function assetTransportFailure(trackedUrl, errorText) {
  return trackedUrl ? `${errorText} ${trackedUrl}` : null;
}

/** Attach once before navigation; all classified assets share one pending queue. */
export function trackAuditedAssets(page, origin) {
  if (page.auditedAssets) return page.auditedAssets;
  const tracker = { pending: new Map(), failures: [] };
  page.auditedAssets = tracker;
  page.pendingAssets = tracker.pending;
  page.assetFailures = tracker.failures;
  page.ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.sessionId !== page.sessionId) return;
    const p = message.params;
    if (message.method === 'Network.requestWillBeSent') {
      if (isAuditedAsset(p.request.url, p.type, origin)) tracker.pending.set(p.requestId, p.request.url);
    } else if (message.method === 'Network.responseReceived') {
      const failure = assetHttpFailure(p.response, p.type, origin);
      if (failure) tracker.failures.push(failure);
    } else if (message.method === 'Network.loadingFinished') tracker.pending.delete(p.requestId);
    else if (message.method === 'Network.loadingFailed') {
      const failure = assetTransportFailure(tracker.pending.get(p.requestId), p.errorText);
      if (failure) tracker.failures.push(failure);
      tracker.pending.delete(p.requestId);
    }
  });
  return tracker;
}

/** Let responsive picture selection, decode and chained scene requests finish. */
export async function waitForAuditedAssets(page, { timeoutMs = 15000, label = 'assets' } = {}) {
  if (!page.auditedAssets) throw Error('Attach trackAuditedAssets before waiting');
  const end = Date.now() + timeoutMs;
  let stable = 0;
  while (Date.now() < end) {
    await page.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
    const state = await page.evaluate(`({
      imagesReady: [...document.images].every(image => image.complete),
      broken: [...document.images].filter(image => image.complete && (image.currentSrc || image.src) && image.naturalWidth === 0).map(image => image.currentSrc || image.src),
      stagesReady: [...document.querySelectorAll('[data-mentor-stage]')].every(stage => stage.dataset.ready === 'true'),
    })`);
    if (state.broken.length) throw Error(`${label}: broken rendered images: ${JSON.stringify(state.broken)}`);
    if (state.imagesReady && state.stagesReady && page.auditedAssets.pending.size === 0) {
      if (++stable >= 2) return;
      continue;
    } else stable = 0;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error(`${label}: assets never became ready: ${JSON.stringify([...page.auditedAssets.pending.values()])}`);
}

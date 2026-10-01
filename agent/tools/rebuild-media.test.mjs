import assert from 'node:assert/strict';
import test from 'node:test';
import { assetHttpFailure, assetTransportFailure, isAuditedAsset, trackAuditedAssets, waitForAuditedAssets } from '../../frontend/scripts/audits/media.mjs';
const origin = 'http://127.0.0.1:5181';
test('expected Core permission refusal is not a media failure', () => {
  assert.equal(assetHttpFailure({ url: `${origin}/api/v1/tutor/memory-proposals`, status: 403 }, 'XHR', origin), null);
  assert.equal(assetHttpFailure({ url: `${origin}/api/v1/tutor/memory-proposals`, status: 403 }, 'Fetch', origin), null);
});
for (const [path, type] of [['/assets/TutorStage.js', 'Script'], ['/scenes/rho.glb', 'Fetch'], ['/scenes/diorama-a.glb', 'XHR'], ['/rebuild/brand/mark.svg', 'Image'], ['/fonts/nunito.woff2', 'Font'], ['/assets/app.css', 'Stylesheet'], ['/sounds/clip.mp3', 'Media']]) {
  test(`real ${type} asset HTTP/transport failures remain audited`, () => {
    const url = origin + path;
    assert.equal(assetHttpFailure({ url, status: 403 }, type, origin), `403 ${url}`);
    assert.equal(assetHttpFailure({ url, status: 404 }, type, origin), `404 ${url}`);
    assert.equal(assetHttpFailure({ url, status: 200 }, type, origin), null);
    assert.equal(isAuditedAsset(url, type, origin), true);
    assert.equal(assetTransportFailure(url, 'net::ERR_ABORTED'), `net::ERR_ABORTED ${url}`);
    assert.equal(assetTransportFailure(url, 'Failed to fetch'), `Failed to fetch ${url}`);
  });
}

function fakePage() {
  return { ws: new EventTarget(), sessionId: 'page', evaluate: async expression => expression.startsWith('new Promise') ? undefined
    : { imagesReady: true, broken: [], stagesReady: true } };
}
function emit(page, method, params) {
  page.ws.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ sessionId: page.sessionId, method, params }) }));
}
test('all asset classes enter pending queue; responsive image completion is required', async () => {
  const page = fakePage(), tracker = trackAuditedAssets(page, origin);
  emit(page, 'Network.requestWillBeSent', { requestId: 'image', type: 'Image', request: { url: `${origin}/rebuild/mentor-stills/rho.png` } });
  emit(page, 'Network.requestWillBeSent', { requestId: 'api', type: 'XHR', request: { url: `${origin}/api/v1/tutor/memory-proposals` } });
  assert.deepEqual([...tracker.pending.keys()], ['image']);
  setTimeout(() => emit(page, 'Network.loadingFinished', { requestId: 'image' }), 20);
  await waitForAuditedAssets(page, { timeoutMs: 500 });
  assert.equal(tracker.pending.size, 0);
});
test('asset abortion remains recorded while clearing pending transport', () => {
  const page = fakePage(), tracker = trackAuditedAssets(page, origin);
  const url = `${origin}/rebuild/mentor-stills/rho.png`;
  emit(page, 'Network.requestWillBeSent', { requestId: 'image', type: 'Image', request: { url } });
  emit(page, 'Network.loadingFailed', { requestId: 'image', errorText: 'net::ERR_ABORTED', canceled: true });
  assert.deepEqual(tracker.failures, [`net::ERR_ABORTED ${url}`]);
  assert.equal(tracker.pending.size, 0);
});
test('wait rejects decoded broken rendered images', async () => {
  const page = fakePage(); trackAuditedAssets(page, origin);
  page.evaluate = async expression => expression.startsWith('new Promise') ? undefined
    : { imagesReady: true, broken: ['missing.png'], stagesReady: true };
  await assert.rejects(waitForAuditedAssets(page), /broken rendered images/);
});

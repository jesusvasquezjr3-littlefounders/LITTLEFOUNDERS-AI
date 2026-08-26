import { useEffect, useState } from 'react';

/*
 * CAN THIS BROWSER PLAY A VIDEO WITH A TRANSPARENT BACKGROUND?
 *
 * The Landing diorama is a cut-out — it sits over the section's own background
 * and over two blurred glow blobs whose position depends on the viewport width,
 * so its transparency cannot be baked into an opaque rectangle at any single
 * size. It genuinely needs an alpha channel.
 *
 * The only alpha-video codec we can produce off macOS is VP9-in-WebM. Chromium
 * and Firefox honour its alpha channel; WebKit plays the same file and IGNORES
 * the alpha, compositing the cut-out onto opaque black — a black rectangle
 * where the island should be, which is a far worse outcome than no animation.
 * (Apple's own guidance for Safari is HEVC-with-alpha, which needs an Apple
 * encoder we do not have.)
 *
 * `canPlayType` cannot answer this: it reports on the container and codec, and
 * both browsers say yes. So the question is answered the only way it can be —
 * by decoding a 583-byte, 16x16, fully TRANSPARENT VP9 frame and reading back
 * whether it stayed transparent. A browser that honours alpha returns alpha 0;
 * one that does not returns an opaque black pixel.
 *
 * The probe runs once per document, off a data URI (no network, no request),
 * and its promise is shared. On anything that fails, times out, or throws, the
 * answer is  and the caller shows the still — never a black box.
 */
const PROBE_SRC =
  'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAIXEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggEpTbuMU6uEHFO7a1OsggIB7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjAuMTYuMTAwV0GNTGF2ZjYwLjE2LjEwMESJiEBEAAAAAAAAFlSua8yuAQAAAAAAAEPXgQFzxYj8pf6AEqen1ZyBACK1nIN1bmSIgQCGhVZfVlA5g4EBI+ODhAJiWgDglLCBELqBEJqBAlPAgQFVsIRVuYEBElTDZ0CAc3OgY8CAZ8iaRaOHRU5DT0RFUkSHjUxhdmY2MC4xNi4xMDBzc9pjwItjxYj8pf6AEqen1WfIpUWjh0VOQ09ERVJEh5hMYXZjNjAuMzEuMTAyIGxpYnZweC12cDlnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAwLjA0MDAwMDAwMAAfQ7Z1zeeBAKDIoaCBAAAAgkmDQgAA8AD2ADgkHBiMAAAwYAAAEL//+o3gAHWho6ah7oEBpZyCSYNCAADwAPYAOCQcGIwAADBgAAAQv//7aGgAHFO7a5G7j7OBALeK94EB8YIBr/CBAw==';

const PROBE_TIMEOUT_MS = 2000;

let probe: Promise<boolean> | null = null;

export function detectAlphaVideoSupport(): Promise<boolean> {
  if (probe) return probe;

  probe = new Promise<boolean>((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }

    const video = document.createElement('video');
    // A browser that cannot play WebM at all is answered without decoding.
    if (!video.canPlayType('video/webm; codecs="vp9"')) {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (supported: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(supported);
    };

    const timer = window.setTimeout(() => finish(false), PROBE_TIMEOUT_MS);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('error', () => finish(false), { once: true });
    video.addEventListener(
      'loadeddata',
      () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 2;
          canvas.height = 2;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) {
            finish(false);
            return;
          }
          // clearRect first: without it the canvas' own initial state could be
          // mistaken for the video having drawn transparency.
          context.clearRect(0, 0, 2, 2);
          context.drawImage(video, 0, 0, 2, 2);
          // `noUncheckedIndexedAccess`: a 1x1 RGBA read always has four
          // entries, but the type system cannot know that, and a missing one
          // must read as "not supported" rather than as transparent.
          const alpha = context.getImageData(0, 0, 1, 1).data[3];
          finish(alpha !== undefined && alpha < 8);
        } catch {
          // A tainted canvas or a decode failure is a "no", not a crash.
          finish(false);
        }
      },
      { once: true },
    );
    video.src = PROBE_SRC;
  });

  return probe;
}

/**
 * `null` while the probe is still running — callers should render nothing
 * rather than guess, because guessing wrong in either direction shows the user
 * either a black rectangle or a needless second download.
 */
export function useAlphaVideoSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void detectAlphaVideoSupport().then((value) => {
      if (alive) setSupported(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  return supported;
}

/**
 * `prefers-reduced-motion`. An animated <img> could not honour this; a <video>
 * can, so it does — the still is the same first frame, so the section loses its
 * motion and nothing else.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

import { useEffect, useRef } from 'react';
import { useStillOnly } from './hero/HeroVideo';
import './actor.css';

/*
 * A character in motion on the landing, standing on the page itself: a short looping video of the real 3D model performing a catalogue
 * pose (scripts/render-site-actors.mjs), one file for both colour modes (always lit by the light rig, so the character stays bright on a dark page). A video has no alpha channel in the codecs every browser plays, so
 * the clip is twice as wide: the colour (premultiplied) on the left and the alpha as grey on the right. A small WebGL shader puts the
 * halves back together on a transparent canvas, so there is no rectangle around the character. The poster (a transparent WebP) paints
 * at once and is what stays for reduced motion, less data, or a browser without WebGL. Muted, hidden from assistive technology, started
 * and paused by visibility, never a sound.
 */
const BASE = '/rebuild/landing/actors';

const VERTEX = 'attribute vec2 p; varying vec2 uv; void main() { uv = vec2((p.x + 1.0) / 2.0, (1.0 - p.y) / 2.0); gl_Position = vec4(p, 0.0, 1.0); }';
const FRAGMENT = 'precision mediump float; varying vec2 uv; uniform sampler2D tex;'
  + ' void main() { vec3 c = texture2D(tex, vec2(uv.x * 0.5, uv.y)).rgb; float a = texture2D(tex, vec2(0.5 + uv.x * 0.5, uv.y)).r; gl_FragColor = vec4(c, a); }';

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

export function ActorClip({ name, width = 640, height = 760, className }: { name: string; width?: number; height?: number; className?: string }) {
  const still = useStillOnly();
  const canvas = useRef<HTMLCanvasElement>(null);
  const poster = `${BASE}/${name}.webp`;

  useEffect(() => {
    const target = canvas.current;
    if (still || !target) return;
    const gl = target.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    let stopped = false, visible = false, waiting = false;
    // A lost context (a hidden tab, a busy GPU) must not leave a blank rectangle: the poster takes the place again.
    target.addEventListener('webglcontextlost', (event) => { event.preventDefault(); stopped = true; target.parentElement?.removeAttribute('data-playing'); target.style.display = 'none'; });

    const video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
    video.src = `${BASE}/${name}.mp4`;

    const draw = () => {
      waiting = false;
      if (stopped || !visible) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      target.parentElement?.setAttribute('data-playing', 'true'); // the poster steps aside: it is the same character at rest
      next();
    };
    const next = () => {
      if (waiting || stopped || !visible) return;
      waiting = true;
      if ('requestVideoFrameCallback' in video) (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(draw);
      else requestAnimationFrame(draw);
    };
    const watch = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) { void video.play().then(next).catch(() => {}); } else video.pause();
    }, { threshold: 0.2 });
    watch?.observe(target);
    return () => { stopped = true; watch?.disconnect(); video.pause(); video.removeAttribute('src'); video.load(); gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, [name, still]);

  return <span className={`lf-actor${className ? ` ${className}` : ''}`} aria-hidden="true">
    <img src={poster} alt="" width={width} height={height} decoding="async" />
    {still ? null : <canvas ref={canvas} width={width} height={height} />}
  </span>;
}

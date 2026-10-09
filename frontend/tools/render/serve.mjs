// A tiny static server for the render tools: the tool's own page, three.js from node_modules, and the artist
// source models in glb/. It needs no dev server and listens on a free local port.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = resolve(fileURLToPath(import.meta.url), '../../..');
const repo = resolve(frontend, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json' };

/** Serves `pageDir` at `/`, plus `/three/`, `/glb/` (the source models) and `/clips/` (the shared clip library). Resolves to `{ origin, close }`. */
export async function startServer(pageDir) {
  const roots = [
    ['/three/', join(frontend, 'node_modules/three/')],
    ['/glb/', join(repo, 'glb/')],
    ['/clips/', join(frontend, 'public/scenes/')],
    ['/', pageDir + '/'],
  ];
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    const root = roots.find(([prefix]) => path.startsWith(prefix));
    const file = root && normalize(join(root[1], path.slice(root[0].length)));

    if (!file || !file.startsWith(normalize(root[1])) || !existsSync(file) || !statSync(file).isFile()) { response.writeHead(404).end(); return; }

    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });

  await new Promise((done) => server.listen(0, '127.0.0.1', done));

  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

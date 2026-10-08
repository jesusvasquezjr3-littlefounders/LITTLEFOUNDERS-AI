import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

/*
 * A DEVELOPMENT FIXTURE: serves the KartRush stand-in (src/games/kartrush/__fixtures__/game-stub.html)
 * on http://localhost:4010, an origin on the host's allow-list, so /learn/play/kartrush can be driven by
 * hand before the real game is deployed. It speaks only the host side of kr.v1; there is nothing here to
 * ship. Usage, from frontend/: `node scripts/dev-game-stub.mjs [port]` (default 4010).
 */
const file = fileURLToPath(new URL('../src/games/kartrush/__fixtures__/game-stub.html', import.meta.url));
const port = Number(process.argv[2] ?? 4010);

createServer((request, response) => {
  if (request.url?.startsWith('/favicon')) { response.writeHead(204).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(readFileSync(file));
}).listen(port, () => console.log(`KartRush stub on http://localhost:${port}/ (and http://127.0.0.1:${port}/)`));

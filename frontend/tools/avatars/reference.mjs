// Step 1 of the avatar rebuild (docs/design/CHARACTER-AVATARS.md): reference renders of each character's head from
// the artist source model in glb/, into audit-out/avatars/<character>/ (not tracked). A developer tool run by hand.
//
//   npm run avatars:reference                          all four characters, both passes, 1600 px high
//   npm run avatars:reference -- --character Rho       one character (Rho, Zara, Liruf, Dina)
//   npm run avatars:reference -- --pass albedo         one pass (albedo, lit)
//
// Needs Chrome (CHROME_PATH if unusual). No dev server: the page, three.js and the models are served here.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, parseArgs, sleep } from '../audit/lib.mjs';
import { startServer } from '../render/serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
const characters = typeof args.character === 'string' ? args.character.split(',') : ['Rho', 'Zara', 'Liruf', 'Dina'];
const passes = typeof args.pass === 'string' ? args.pass.split(',') : ['albedo', 'lit'];
const height = Number(args.height ?? 1600);
const out = resolve(here, '../../audit-out/avatars');
const server = await startServer(here);
const browser = await launch();

try {
  for (const character of characters) {
    const page = await browser.newPage({ width: 800, height: 800, url: `${server.origin}/head-reference.html?character=${character}`, settle: 500 });

    for (let n = 0; n < 300 && !(await page.ev("document.body.dataset.ready === '1'")); n++) await sleep(200);

    if (!(await page.ev("document.body.dataset.ready === '1'"))) throw new Error(`${character}: the page never became ready`);

    console.log(character, await page.ev("(window.__log ?? []).join(' ; ')"));
    mkdirSync(join(out, character.toLowerCase()), { recursive: true });

    for (const pass of passes) {
      const url = await page.ev(`window.__render('${pass}', ${height})`);

      writeFileSync(join(out, character.toLowerCase(), `ref-${pass}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }

    await page.close();
  }

  console.log(`reference renders in ${out}`);
} finally {
  await browser.close();
  server.close();
}

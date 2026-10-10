// Makes every image the emails use, into public/email/v1/: the picture of the four characters (email-scene.js), the
// logo in color, in ink and in white, and the four social marks. A developer tool, run by hand; not part of the build.
//
//   npm run render:email                 everything
//   npm run render:email -- --still      only a PNG of the picture into audit-out/email-render/ to look at
//
// Mail programs show PNG and JPEG reliably and little else, so nothing here is WebP or SVG. The picture has no
// background (it sits on the email's own color, light or dark), so it is a PNG, and pngquant reduces it to a palette
// with smooth transparency: about 100 KB instead of 400. The files are addressed by emails that were already sent:
// never rename or delete one, add a v2 folder instead (docs/features/F-002-emails.md).
// Needs Chrome (CHROME_PATH if unusual), pngquant (PNGQUANT=<path to the program> if it is not on the PATH) and the
// source models in glb/. No dev server is needed.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, parseArgs, sleep } from '../audit/lib.mjs';
import { startServer } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '../..');
const args = parseArgs();
const outDir = join(frontend, 'public/email/v1');
const scratch = join(frontend, 'audit-out/email-render');
const PNGQUANT = process.env.PNGQUANT ?? 'pngquant';

// Colors of src/styles/lf-theme.css. The ink logo carries a thin outline in the page color: it cannot be seen on a
// light page, and it keeps the logo readable in the mail programs that turn a light page dark by themselves.
const INK = '#11132a';
const CANVAS = '#f4f5fd';
const MARK = '#83869a'; // --v-edge: readable on the light and on the dark page alike

const bytes = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');
const save = (name, dataUrl) => {
  writeFileSync(join(outDir, name), bytes(dataUrl));
  console.log(`${name}: ${(statSync(join(outDir, name)).size / 1024).toFixed(1)} KB`);
};

mkdirSync(outDir, { recursive: true });
mkdirSync(scratch, { recursive: true });

const server = await startServer(here);
const browser = await launch();

try {
  // ---- the picture
  const scene = await browser.newPage({ width: 1040, height: 640, url: `${server.origin}/email-scene.html`, settle: 500 });

  for (let n = 0; n < 400; n++) {
    if (await scene.ev("document.body.dataset.ready === '1'")) break;
    await sleep(200);
  }

  if (!(await scene.ev("document.body.dataset.ready === '1'"))) throw new Error('the scene never became ready');

  await scene.ev('window.__render(0)');

  writeFileSync(join(scratch, 'hero.png'), bytes(await scene.ev("window.__frame('image/png')")));

  if (args.still) {
    console.log(`still in ${scratch}`);
  } else {
    const run = spawnSync(PNGQUANT, ['--quality=70-90', '--speed', '1', '--strip', '--force', '--output', join(outDir, 'hero.png'), join(scratch, 'hero.png')], { encoding: 'utf8' });

    if (run.status !== 0) throw new Error(`pngquant failed (is it installed? set PNGQUANT to its path): ${run.error?.message ?? run.stderr}`);

    console.log(`hero.png: ${(statSync(join(outDir, 'hero.png')).size / 1024).toFixed(1)} KB`);
  }

  await scene.close();

  if (!args.still) {
    // ---- the logos and the social marks, drawn on a canvas in the same browser (no image library needed)
    const page = await browser.newPage({ width: 10, height: 10, url: 'about:blank', settle: 0 });
    const logo = readFileSync(join(frontend, 'public/brand/logo.png')).toString('base64');
    const draw = (body) => page.ev(`(async () => {
      const img = new Image();

      img.src = 'data:image/png;base64,${logo}';
      await img.decode();

      const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      /** The logo's shape filled with one color, at w x h. */
      const tinted = (w, h, color) => {
        const c = canvas(w, h);
        const g = c.getContext('2d');

        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, w, h);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, w, h);

        return c;
      };

      ${body}
    })()`);

    // in color, shown 168 px wide
    save('logo.png', await draw(`
      const c = canvas(336, 61);
      const g = c.getContext('2d');

      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, 336, 61);

      return c.toDataURL('image/png');`));

    // in ink with the thin outline, and in white: shown 132 px wide, with 4 px of room for the outline
    save('logo-ink.png', await draw(`
      const W = 264, H = 48, PAD = 4;
      const c = canvas(W + PAD * 2, H + PAD * 2);
      const g = c.getContext('2d');
      const halo = tinted(W, H, '${CANVAS}');

      for (let a = 0; a < 16; a++) g.drawImage(halo, PAD + Math.cos(a * Math.PI / 8) * 2, PAD + Math.sin(a * Math.PI / 8) * 2);

      g.drawImage(tinted(W, H, '${INK}'), PAD, PAD);

      return c.toDataURL('image/png');`));
    save('logo-white.png', await draw(`
      const W = 264, H = 48, PAD = 4;
      const c = canvas(W + PAD * 2, H + PAD * 2);

      c.getContext('2d').drawImage(tinted(W, H, '#ffffff'), PAD, PAD);

      return c.toDataURL('image/png');`));

    // the social marks: the same drawings the site's footer uses (src/components/icons/social.tsx)
    const source = readFileSync(join(frontend, 'src/components/icons/social.tsx'), 'utf8');

    for (const [name, component] of [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['x', 'X'], ['linkedin', 'LinkedIn']]) {
      const path = source.match(new RegExp(`export const ${component}: Glyph[\\s\\S]*?<path d="([^"]+)"`))?.[1];

      if (!path) throw new Error(`no drawing found for ${component}`);

      save(`social-${name}.png`, await page.ev(`(() => {
        const c = document.createElement('canvas');

        c.width = c.height = 48;

        const g = c.getContext('2d');

        g.scale(2, 2);
        g.fillStyle = '${MARK}';
        g.fill(new Path2D(${JSON.stringify(path)}), 'evenodd');

        return c.toDataURL('image/png');
      })()`));
    }

    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

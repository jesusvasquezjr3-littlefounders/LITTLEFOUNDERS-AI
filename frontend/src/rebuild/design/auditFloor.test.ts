// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * 02 rule 11 in the pre-merge text-fit audit (scripts/audits/in-page.mjs): visible, non-SVG text under the 14 px
 * floor is a finding, and 12 px is no longer a step of the proportion type scale. The audit itself runs in a real
 * browser; here its in-page function runs in jsdom with a stubbed layout, so the rule is pinned by behaviour.
 */
const frontend = resolve(__dirname, '../../..');
const page = () => import(/* @vite-ignore */ pathToFileURL(resolve(frontend, 'scripts/audits/in-page.mjs')).href) as Promise<{ installAudit: () => void }>;
type Audit = { textFit: () => [string, string][] };

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('the 14 px text floor in the text-fit audit (02 rule 11)', () => {
  it('reports visible text under 14 px, and nothing at 14 px or hidden', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20, toJSON: () => ({}) });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ font: '', measureText: () => ({ width: 1 }) } as unknown as RenderingContext);
    document.body.innerHTML = `<div class="lf-rebuild" data-copy-role="body">
      <span id="small" style="font-size: 12.8px">Invite link</span>
      <span id="caption" style="font-size: 14px">Monday</span>
      <span id="hidden" style="font-size: 12px; position: absolute; clip-path: inset(50%)">Hidden name</span>
      <svg><text style="font-size: 9px">3</text></svg>
    </div>`;
    (await page()).installAudit();
    const findings = ((window as unknown as { __lfAudit: Audit }).__lfAudit).textFit().filter(([type]) => type === 'font<14px');
    expect(findings.map(([, detail]) => detail)).toEqual(['span "Invite link" 12.80px']);
  });

  it('no longer accepts 12 px as a step of the type scale', () => {
    const source = readFileSync(resolve(frontend, 'scripts/audits/in-page.mjs'), 'utf8');
    expect(source).toMatch(/const SCALE = \[14, 16,/);
  });
});

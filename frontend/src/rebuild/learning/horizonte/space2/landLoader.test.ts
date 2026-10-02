import { geoOrthographic, geoPath } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { loadLand } from './landLoader';

describe('F4.8 land loader (the real 110 m coastlines, no mocks)', () => {
  it('loads the land once and draws it on an orthographic globe', async () => {
    const land = await loadLand();
    expect(land).not.toBeNull();
    expect(await loadLand()).toBe(land);
    const path = geoPath(geoOrthographic().translate([120, 120]).scale(104).clipAngle(90).rotate([99, -19]).precision(0.5));
    const drawn = path(land!);
    expect(drawn).toBeTruthy();
    expect(drawn!.length).toBeGreaterThan(500);
  });
});

import type { GeoObject } from 'd3-geo';
import type { Topology } from 'topojson-client';

let pending: Promise<GeoObject | null> | null = null;

/**
 * The coastlines of the globe, loaded the first time a globe is drawn and then kept. The 110 m Natural Earth land topology is a
 * bundled JSON module (55 KB raw) that Vite splits into its own chunk, so no public asset, request or manifest row is involved.
 * A failure resolves to null: the globe stays a plain sphere with its places and routes, and nothing else depends on the land.
 */
export function loadLand(): Promise<GeoObject | null> {
  pending ??= Promise.all([import('topojson-client'), import('world-atlas/land-110m.json')])
    .then(([client, atlas]) => {
      const topology = atlas.default as unknown as Topology;
      return client.feature(topology, topology.objects.land);
    })
    .catch(() => null);
  return pending;
}

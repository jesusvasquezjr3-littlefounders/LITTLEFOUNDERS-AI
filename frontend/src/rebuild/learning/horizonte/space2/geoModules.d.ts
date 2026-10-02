/*
 * Minimal ambient types for the two map libraries the globe board uses; neither ships types and the repo adds no @types packages.
 * Only the calls the board makes are declared. The GeoJSON shapes are local on purpose: there is no @types/geojson either.
 */
declare module 'd3-geo' {
  export type GeoPoint = readonly [number, number];
  export interface GeoLineString { type: 'LineString'; coordinates: readonly GeoPoint[] }
  export interface GeoSphere { type: 'Sphere' }
  export interface GeoMultiLineString { type: 'MultiLineString'; coordinates: ReadonlyArray<readonly GeoPoint[]> }
  export interface GeoGeometryCollection { type: 'FeatureCollection' | 'Feature' | 'MultiPolygon' | 'Polygon'; [key: string]: unknown }
  export type GeoObject = GeoLineString | GeoSphere | GeoMultiLineString | GeoGeometryCollection;

  export interface GeoProjection {
    (point: GeoPoint): [number, number] | null;
    rotate(angles: readonly [number, number] | readonly [number, number, number]): GeoProjection;
    translate(offset: readonly [number, number]): GeoProjection;
    scale(factor: number): GeoProjection;
    clipAngle(degrees: number | null): GeoProjection;
    precision(value: number): GeoProjection;
  }
  export interface GeoPath { (object: GeoObject): string | null }

  export function geoOrthographic(): GeoProjection;
  export function geoPath(projection: GeoProjection): GeoPath;
  export function geoGraticule10(): GeoMultiLineString;
  /** The angle in radians between two [longitude, latitude] points. */
  export function geoDistance(a: GeoPoint, b: GeoPoint): number;
}

declare module 'topojson-client' {
  import type { GeoObject } from 'd3-geo';
  export interface Topology { type: 'Topology'; objects: Record<string, unknown>; arcs: unknown }
  export function feature(topology: Topology, object: unknown): GeoObject;
}

declare module 'world-atlas/land-110m.json' {
  import type { Topology } from 'topojson-client';
  const topology: Topology;
  export default topology;
}
